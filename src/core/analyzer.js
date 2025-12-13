/**
 * Performance Analyzer Module - M8
 * 
 * Implements Dynamic Time Warping (DTW) algorithm for analyzing student performance
 * against reference timeline. Provides detailed accuracy metrics including pitch
 * correctness, timing deviation, and aggregate scoring.
 * 
 * @extends EventEmitter
 * @fires Analyzer#analysis:started
 * @fires Analyzer#analysis:complete
 * @fires Analyzer#analysis:error
 */

import { EventEmitter } from '../utils/eventEmitter.js';
import { Logger } from '../utils/logger.js';
import { Storage } from './storage.js';
import { performanceMonitor } from '../utils/performanceMonitor.js';
import { SCORING, SMOOTHING_PRESETS } from './enhancedAnalyzerConstants.js';

/**
 * Tolerance presets configuration
 */
const TOLERANCE_PRESETS = {
  EASY: {
    pitch: 100,    // ±100 cents (1 semitone)
    timing: 200    // ±200 milliseconds
  },
  NORMAL: {
    pitch: 50,     // ±50 cents (half semitone)
    timing: 100    // ±100 milliseconds
  },
  HARD: {
    pitch: 25,     // ±25 cents (quarter semitone)
    timing: 50     // ±50 milliseconds
  },
  CUSTOM: {
    pitch: null,   // User-defined
    timing: null   // User-defined
  }
};

/**
 * Tolerance configuration class
 */
class ToleranceConfig {
  constructor(preset = 'NORMAL', customPitch = null, customTiming = null) {
    if (preset === 'CUSTOM') {
      this.pitch = customPitch || 50;
      this.timing = customTiming || 100;
    } else {
      const presetConfig = TOLERANCE_PRESETS[preset];
      if (presetConfig) {
        this.pitch = presetConfig.pitch;
        this.timing = presetConfig.timing;
      } else {
        throw new Error(`Unknown tolerance preset: ${preset}`);
      }
    }
    this.preset = preset;
  }
}

/**
 * Performance Analyzer with Dynamic Time Warping capability
 */
export class Analyzer extends EventEmitter {
  /**
   * Initialize analyzer with tolerance configuration
   * @param {Object} config - Configuration with tolerances and options
   */
  constructor(config = {}) {
    super();
    
    // Default configuration
    const DEFAULT_CONFIG = {
      enableHistory: true,
      maxHistorySize: 100,
      dtwWeights: {
        pitch: 0.6,
        timing: 0.4
      }
    };
    
    // Merge configuration with defaults
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize tolerance configuration
    this.tolerances = new ToleranceConfig(
      this.config.preset,
      this.config.pitchTolerance,
      this.config.timingTolerance
    );
    
    // Initialize storage module
    this.storage = new Storage();
    
    // Track extra notes (notes detected but not in reference)
    this._extraNotes = [];
    
    Logger.log(Logger.INFO, 'Analyzer', 'Analyzer initialized', {
      preset: this.tolerances.preset,
      pitchTolerance: this.tolerances.pitch,
      timingTolerance: this.tolerances.timing,
      historyEnabled: this.config.enableHistory
    });
  }

  /**
   * Calculate tempo-aware timing tolerance based on BPM and difficulty
   * @private
   * @param {number} tempoBpm - Tempo in beats per minute
   * @param {string} difficulty - Difficulty preset (EASY/NORMAL/HARD)
   * @returns {number} Timing tolerance in milliseconds
   */
  _getTimingToleranceForTempo(tempoBpm, difficulty) {
    const beatMs = 60000 / tempoBpm;

    const factors = {
      EASY: 0.35,    // 35% of a beat
      NORMAL: 0.25,  // 25% of a beat
      HARD: 0.15     // 15% of a beat
    };

    const factor = factors[difficulty] || factors.NORMAL;

    return Math.round(beatMs * factor);
  }

  /**
   * Analyze performance against reference timeline
   * @param {Array} referenceTimeline - Expected notes from exercise
   * @param {Array} detectedStream - Detected pitch events with RAW timestamps
   * @param {Object} options - Analysis options
   * @param {number} options.latencyOffset - Audio latency in ms to compensate for speaker→mic delay
   * @param {number} options.tempo - Current tempo in BPM for tolerance scaling
   * @param {string} options.difficulty - Difficulty preset for tolerance scaling
   * @returns {Promise<AnalysisResult>} Per-note and aggregate results
   * @throws {Error} If reference timeline is invalid
   */
  async analyze(referenceTimeline, detectedStream, options = {}) {
    const startTime = performance.now();
    const { latencyOffset = 0 } = options; // Extract latency offset, default to 0

    this.emit('analysis:started', {
      referenceNotes: referenceTimeline.length,
      detectedEvents: detectedStream.length,
      latencyOffset: latencyOffset // Log the offset being applied
    });

    // Separate into two streams for dual detection
    const allPitchEvents = detectedStream.filter(e => e.type !== 'pitch:onset');
    const onsetEvents = detectedStream.filter(e => e.type === 'pitch:onset');

    console.log('📊 Analyzer received dual detection streams:');
    console.log('- Total events:', detectedStream.length);
    console.log('- All pitch events:', allPitchEvents.length);
    console.log('- Onset events:', onsetEvents.length);
    console.log('- Latency offset:', latencyOffset + 'ms');

    console.log('📊 Analyzer received latency offset:', latencyOffset + 'ms');

    // FIXED: Apply latency compensation by shifting detected timestamps BACKWARD
    // Detected timestamps are "late" by the speaker-to-mic latency, so we SUBTRACT the offset
    const compensatedStream = detectedStream.map(event => {
      const rawTimestamp = event.timestamp;
      const compensatedTimestamp = rawTimestamp - latencyOffset; // SUBTRACT, not add!

      return {
        ...event,
        timestamp: compensatedTimestamp,          // use compensated time everywhere
        compensatedTimestamp,                    // keep for debugging / extra notes
        originalTimestamp: rawTimestamp          // preserve raw value
      };
    });

    console.log('✅ Applied latency compensation to detected stream:');
    console.log('- Original first timestamp:', detectedStream[0]?.timestamp + 'ms');
    console.log('- Compensated first timestamp:', compensatedStream[0]?.timestamp + 'ms');
    console.log('- Shift amount (SUBTRACTED):', latencyOffset + 'ms');

    // Enhanced Validation: Check that compensation makes sense and provide recommendations
    if (compensatedStream.length > 0 && referenceTimeline.length > 0) {
    const firstDetected = compensatedStream[0].timestamp;
    const firstReference = referenceTimeline[0].timestamp;
    const timeDiff = Math.abs(firstDetected - firstReference);
        const originalFirstDetected = detectedStream[0].timestamp;

    console.log('🔍 Enhanced Validation Check:');
    console.log('- First detected timestamp (original):', originalFirstDetected + 'ms');
    console.log('- First detected timestamp (compensated):', firstDetected + 'ms');
        console.log('- First reference timestamp:', firstReference + 'ms');
    console.log('- Time difference (should be <500ms):', timeDiff + 'ms');
    console.log('- Applied latency offset:', latencyOffset + 'ms');

    if (timeDiff > 500) {
    // Calculate recommended new calibration
      const additionalNeeded = timeDiff - 250; // Target 250ms gap
        const recommendedNewOffset = latencyOffset + additionalNeeded;
          
          console.warn('⚠️  Large timing gap detected!');
          console.warn('   Current calibration appears too low.');
          console.warn('   RECOMMENDATION: Increase latency offset from', latencyOffset + 'ms to ~' + Math.round(recommendedNewOffset) + 'ms');
          console.warn('   This would reduce the gap from', timeDiff + 'ms to ~250ms');
          
          // Emit event with calibration recommendation
          this.emit('analysis:calibrationRecommendation', {
            currentOffset: latencyOffset,
            recommendedOffset: Math.round(recommendedNewOffset),
            timeDifference: timeDiff,
            additionalOffset: Math.round(additionalNeeded)
          });
        } else if (timeDiff > 250) {
          console.log('⚠️  Moderate timing gap detected. Consider minor calibration adjustment.');
          const recommendedOffset = latencyOffset + 100;
          console.log('   Suggested offset increase: ' + latencyOffset + 'ms → ~' + recommendedOffset + 'ms');
        } else {
          console.log('✅ Timing alignment looks reasonable (<250ms gap)');
        }
      }

    // Adaptive latency calibration suggestion
    if (compensatedStream.length >= 5) {
      // Calculate median timing deviation from first 5-10 notes
      const earlyNotes = compensatedStream.slice(0, Math.min(10, compensatedStream.length));
      const timingDeviations = [];
      
      earlyNotes.forEach((detected, idx) => {
        if (idx < referenceTimeline.length) {
          const deviation = detected.timestamp - referenceTimeline[idx].timestamp;
          timingDeviations.push(deviation);
        }
      });
      
      if (timingDeviations.length >= 5) {
        // Sort and get median
        const sorted = [...timingDeviations].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        
        console.log('📊 Timing Deviation Analysis (first 10 notes):');
        console.log('- Median deviation:', Math.round(median) + 'ms');
        console.log('- All deviations:', timingDeviations.map(d => Math.round(d) + 'ms').join(', '));
        
        // If there's a consistent bias (median > 50ms or < -50ms), suggest adjustment
        if (Math.abs(median) > 50) {
          const recommendedAdjustment = Math.round(-median); // Negative because we want to compensate
          const newLatency = latencyOffset + recommendedAdjustment;
          
          console.warn('⚙️ Detected systematic timing bias!');
          console.warn(`   Median timing deviation: ${Math.round(median)}ms`);
          console.warn(`   Suggested latency adjustment: ${latencyOffset}ms → ${newLatency}ms`);
          console.warn(`   (Change by ${recommendedAdjustment > 0 ? '+' : ''}${recommendedAdjustment}ms)`);
          
          this.emit('analysis:adaptiveCalibration', {
            currentLatency: latencyOffset,
            medianDeviation: Math.round(median),
            recommendedLatency: newLatency,
            adjustment: recommendedAdjustment,
            confidence: timingDeviations.length >= 8 ? 'high' : 'medium'
          });
        } else {
          console.log('✅ No systematic timing bias detected (<50ms median deviation)');
        }
      }
    }

    try {
      performanceMonitor.startMeasurement('analysis');
      
      // Validate inputs
      if (!referenceTimeline || referenceTimeline.length === 0) {
        throw new Error('Reference timeline is empty');
      }
      
      if (!Array.isArray(referenceTimeline)) {
        throw new Error('Reference timeline must be an array');
      }

      Logger.log(Logger.INFO, 'Analyzer', 'Starting analysis', {
        referenceNotes: referenceTimeline.length,
        detectedEvents: detectedStream ? detectedStream.length : 0
      });

      if (!detectedStream || detectedStream.length === 0) {
        console.warn('No notes detected in performance');
        return this._generateEmptyResult(referenceTimeline);
      }
      
      // Apply latency compensation to both streams
      const compensatedAllPitchEvents = allPitchEvents.map(event => ({
        ...event,
        timestamp: event.timestamp - latencyOffset,
        compensatedTimestamp: event.timestamp - latencyOffset,
        originalTimestamp: event.timestamp
      }));
      
      const compensatedOnsetEvents = onsetEvents.map(event => ({
        ...event,
        timestamp: event.timestamp - latencyOffset,
        compensatedTimestamp: event.timestamp - latencyOffset,
        originalTimestamp: event.timestamp
      }));

      // Apply temporal smoothing to detected streams (Performous-inspired)
      const settings = this.storage.get('g4:settings', {});
      const smoothingFactor = settings.analyzerSmoothing || 0.5;

      const smoothedAllPitchEvents = this._applyTemporalSmoothing(compensatedAllPitchEvents, {
        smoothingFactor
      });
      const smoothedOnsetEvents = this._applyTemporalSmoothing(compensatedOnsetEvents, {
        smoothingFactor
      });

      // Convert to simplified format for DTW
      const normalizedPitchEvents = this._normalizePitchStream(smoothedAllPitchEvents);
      const normalizedOnsetEvents = this._normalizePitchStream(smoothedOnsetEvents);

      Logger.log(Logger.DEBUG, 'Analyzer', 'Dual detection streams normalized', {
        pitchEvents: normalizedPitchEvents.length,
        onsetEvents: normalizedOnsetEvents.length
      });

      // Calculate tempo-aware timing tolerance
      const difficulty = options.difficulty || this.tolerances.preset || 'NORMAL';
      const tempo = options.tempo || (referenceTimeline[0]?.tempo || 0); // Use 0 if no tempo available
      
      const basePreset = TOLERANCE_PRESETS[difficulty] || TOLERANCE_PRESETS.NORMAL;
      
      // Always attempt tempo-aware calculation when tempo is available
      let tempoAwareTiming;
      if (tempo > 0) {
        tempoAwareTiming = this._getTimingToleranceForTempo(tempo, difficulty);
      } else {
        // Fallback to static tolerance when tempo unavailable
        tempoAwareTiming = basePreset.timing;
      }
      
      // Update tolerances for this analysis - USE tempo-aware values consistently
      this.tolerances = {
        pitch: basePreset.pitch,
        timing: tempoAwareTiming,  // This is now the calculated tempo-aware value
        preset: difficulty
      };
      
      // Console logging for tolerance verification (visible in console)
      console.log(
        `[Analyzer] Tempo: ${tempo} BPM, difficulty: ${difficulty}, timing tolerance: ${this.tolerances.timing} ms`
      );

      // Run sequential best-fit matching algorithm
      performanceMonitor.startMeasurement('sequentialMatching');

      console.log('🔍 Sequential Best-Fit Matching - Reference Timeline:', referenceTimeline.map(r => ({ midi: r.midi, timestamp: r.timestamp })));
      console.log('🔍 Sequential Best-Fit Matching - Normalized Pitch Events:', normalizedPitchEvents.map(p => ({ midi: p.midi, timestamp: p.timestamp })));
      console.log('🔍 Sequential Best-Fit Matching - Normalized Onset Events:', normalizedOnsetEvents.map(o => ({ midi: o.midi, timestamp: o.timestamp })));

      // Evaluate notes using sequential best-fit matching
      this._extraNotes = []; // Reset extra notes tracking
      const perNoteResults = this._evaluateNotesWithSequentialMatching(
        referenceTimeline,
        normalizedPitchEvents,
        normalizedOnsetEvents,
        options.tempo || 120
      );

      const matchingLatency = performanceMonitor.endMeasurement('sequentialMatching');

      if (matchingLatency > 100) {
        Logger.log(Logger.WARN, 'Analyzer', 'Sequential matching exceeded 100ms', {
          latency: Math.round(matchingLatency),
          referenceNotes: referenceTimeline.length,
          pitchEvents: normalizedPitchEvents.length,
          onsetEvents: normalizedOnsetEvents.length
        });
      }
      
      // Calculate aggregate metrics
      const aggregate = this._calculateAggregateMetrics(perNoteResults);
      
      // Build result object
      const analysisTime = performance.now() - startTime;
      const duration = this._calculateDuration(referenceTimeline);
      
      const result = {
        aggregate,
        perNote: perNoteResults,
        exerciseId: referenceTimeline[0]?.exerciseId || 'unknown',
        timestamp: Date.now(),
        tolerances: {
          pitch: this.tolerances.pitch,
          timing: this.tolerances.timing,
          preset: this.tolerances.preset,
          tempoBpm: tempo,
          songTitle: referenceTimeline[0]?.title || 'Untitled'
        },
        duration: duration,
        analysisTime: Math.round(analysisTime)
      };
      
      // Store in history
      if (this.config.enableHistory) {
        this._addToHistory(result);
      }
      
      performanceMonitor.endMeasurement('analysis');
      
      const latency = analysisTime;
      if (latency > 100) {
        Logger.log(Logger.WARN, 'Analyzer', 'Analysis exceeded 100ms target', {
          duration: Math.round(latency),
          noteCount: referenceTimeline.length
        });
      } else {
        Logger.log(Logger.INFO, 'Analyzer', 'Analysis completed', {
          duration: Math.round(latency),
          correctness: aggregate.correctPercentage
        });
      }

      this.emit('analysis:complete', { result });
      
      return result;

    } catch (error) {
      const errorMsg = `Analysis failed: ${error.message}`;
      Logger.log(Logger.ERROR, 'Analyzer', errorMsg, { error: error.stack });
      
      this.emit('analysis:error', { error: error.message });
      throw error;
    }
  }

  /**
   * Set analysis tolerances with validation
   * @param {ToleranceConfig} tolerances - New tolerance configuration
   * @throws {Error} If tolerances invalid
   */
  setTolerances(tolerances) {
    // Validate tolerances object
    if (!tolerances || typeof tolerances !== 'object') {
      throw new Error('Tolerances must be an object');
    }
    
    // Validate pitch tolerance
    if (typeof tolerances.pitch !== 'number' || tolerances.pitch <= 0) {
      throw new Error('Pitch tolerance must be a positive number');
    }
    
    // Validate timing tolerance
    if (typeof tolerances.timing !== 'number' || tolerances.timing <= 0) {
      throw new Error('Timing tolerance must be a positive number');
    }
    
    // Validate preset if provided
    if (tolerances.preset) {
      const validPresets = ['EASY', 'NORMAL', 'HARD', 'CUSTOM'];
      if (!validPresets.includes(tolerances.preset)) {
        throw new Error(
          `Invalid preset: ${tolerances.preset}. Must be one of: ${validPresets.join(', ')}`
        );
      }
    }
    
    // Update tolerances
    this.tolerances = { ...tolerances };
    
    // Emit event
    this.emit('analyzer:tolerancesChanged', {
      tolerances: this.tolerances,
      timestamp: Date.now()
    });
    
    Logger.log(Logger.INFO, 'Analyzer', 'Tolerances updated', {
      preset: this.tolerances.preset,
      pitch: this.tolerances.pitch,
      timing: this.tolerances.timing
    });
  }

  /**
   * Get current tolerance configuration
   * @returns {Object} Current tolerances
   */
  getTolerances() {
    return {
      pitch: this.tolerances.pitch,
      timing: this.tolerances.timing,
      preset: this.tolerances.preset
    };
  }

  /**
   * Get performance history
   * @param {string} exerciseId - Optional filter by exercise
   * @returns {Array} Past analysis results
   */
  getHistory(exerciseId = null) {
    try {
      const history = this.storage.get('g4:perfHistory', []);
      
      if (exerciseId) {
        return history.filter(entry => entry.exerciseId === exerciseId);
      }
      
      return history;
    } catch (error) {
      Logger.log(Logger.ERROR, 'Analyzer', 'Failed to get history', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Clear performance history
   * @param {string} exerciseId - Optional clear only specific exercise
   */
  clearHistory(exerciseId = null) {
    try {
      if (exerciseId) {
        const history = this.storage.get('g4:perfHistory', []);
        const filtered = history.filter(entry => entry.exerciseId !== exerciseId);
        this.storage.set('g4:perfHistory', filtered);
        Logger.log(Logger.INFO, 'Analyzer', 'History cleared for exercise', { exerciseId });
      } else {
        this.storage.delete('g4:perfHistory');
        Logger.log(Logger.INFO, 'Analyzer', 'All history cleared');
      }
    } catch (error) {
      Logger.log(Logger.ERROR, 'Analyzer', 'Failed to clear history', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Export history as JSON
   * @returns {string} JSON string of history
   */
  exportHistory() {
    try {
      const history = this.getHistory();
      return JSON.stringify(history, null, 2);
    } catch (error) {
      Logger.log(Logger.ERROR, 'Analyzer', 'Failed to export history', {
        error: error.message
      });
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  /**
   * Import history from JSON
   * @param {string} jsonData - JSON string to import
   */
  importHistory(jsonData) {
    try {
      const history = JSON.parse(jsonData);
      
      // Validate structure
      if (!Array.isArray(history)) {
        throw new Error('Invalid history format: expected array');
      }
      
      // Validate each entry has required fields
      for (const entry of history) {
        if (!entry.exerciseId || !entry.timestamp || typeof entry.correctPercentage !== 'number') {
          throw new Error('Invalid history entry format');
        }
      }
      
      this.storage.set('g4:perfHistory', history);
      Logger.log(Logger.INFO, 'Analyzer', 'History imported', { 
        entries: history.length 
      });
      
    } catch (error) {
      Logger.log(Logger.ERROR, 'Analyzer', 'Failed to import history', {
        error: error.message
      });
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  // Private Methods

  /**
   * Dynamic Time Warping algorithm for sequence alignment
   * @private
   * @param {Array} reference - Reference note sequence
   * @param {Array} detected - Detected note sequence
   * @returns {Array} Alignment path mapping reference to detected indices
   */
  _dynamicTimeWarping(reference, detected) {
    const refLen = reference.length;
    const detLen = detected.length;

    if (refLen === 0 || detLen === 0) {
      return [];
    }

    // Initialize cost matrix with Infinity
    const cost = Array(refLen + 1)
      .fill(null)
      .map(() => Array(detLen + 1).fill(Infinity));

    cost[0][0] = 0; // Starting point

    // Fill cost matrix
    for (let i = 1; i <= refLen; i++) {
      for (let j = 1; j <= detLen; j++) {
        // Distance between reference[i-1] and detected[j-1]
        const distance = this._calculateDistance(
          reference[i - 1],
          detected[j - 1]
        );

        const minPrev = Math.min(
          cost[i - 1][j],     // insertion (missed reference note)
          cost[i][j - 1],     // deletion (extra detected note)
          cost[i - 1][j - 1]  // match/substitution
        );

        cost[i][j] = distance + minPrev;
      }
    }

    // Backtrack to find optimal path
    const path = [];
    let i = refLen;
    let j = detLen;

    while (i > 0 && j > 0) {
      const diagonal = cost[i - 1][j - 1];
      const up = cost[i - 1][j];
      const left = cost[i][j - 1];

      const min = Math.min(diagonal, up, left);

      if (min === diagonal) {
        // Real match between reference[i-1] and detected[j-1]
        path.unshift({ refIndex: i - 1, detIndex: j - 1 });
        i--;
        j--;
      } else if (min === up) {
        // Missed reference note: move up, do not create a match pair here
        i--;
      } else {
        // Extra detected note: move left, do not create a match pair here
        j--;
      }
    }

    // Any remaining i>0 means missed reference notes handled later
    // Any remaining j>0 means extra detected notes handled later

    return path;
  }

  /**
   * Calculate weighted distance between two notes - FIXED: Always use relative timestamp
   * @private
   * @param {Object} refNote - Reference note from timeline
   * @param {Object} detNote - Detected note from pitch stream
   * @returns {number} Weighted distance
   */
  _calculateDistance(refNote, detNote) {
    // Pitch distance (normalized to 0-1 range)
    const pitchDiff = Math.abs(refNote.midi - detNote.midi);
    const normalizedPitch = pitchDiff / 12; // Divide by octave

    // Timing distance (normalized to 0-1 range) - FIXED: Always use relative timestamp from detNote.timestamp
    const detectedTimestamp = detNote.timestamp;
    const timingDiff = Math.abs(refNote.timestamp - detectedTimestamp);
    const normalizedTiming = timingDiff / 1000; // Divide by 1 second

    // Weighted combination
    const α = this.config.dtwWeights.pitch;    // Default: 0.6
    const β = this.config.dtwWeights.timing;   // Default: 0.4

    const distance = (α * normalizedPitch) + (β * normalizedTiming);

    return distance;
  }

  /**
   * Evaluate each note for correctness with continuous scoring - NEW: Gradual falloff zones
   * @private
   * @param {Array} alignmentPath - DTW alignment path
   * @param {Array} reference - Reference timeline
   * @param {Array} detected - Detected pitch stream
   * @returns {Array} Per-note evaluation results with continuous scoring
   */
  _evaluateNotes(alignmentPath, reference, detected) {
    const results = [];
    const matchedRefIndices = new Set();
    const matchedDetIndices = new Set();

    // Process aligned notes
    alignmentPath.forEach(({ refIndex, detIndex }) => {
      const refNote = reference[refIndex];
      const detNote = detected[detIndex];

      matchedRefIndices.add(refIndex);
      matchedDetIndices.add(detIndex);

      // Calculate deviations - FIXED: Always use relative timestamp
      const pitchDeviation = detNote.midi - refNote.midi;
      const detectedTimestamp = detNote.timestamp;
      const timingDeviation = detectedTimestamp - refNote.timestamp;

      // Debug logging for latency compensation
      if (detNote.compensatedTimestamp !== undefined) {
        Logger.log(Logger.DEBUG, 'Analyzer', 'Using compensated timestamp', {
          noteId: refNote.id,
          rawTimestamp: detNote.originalTimestamp,
          compensatedTimestamp: detNote.compensatedTimestamp,
          latencyCompensation: detNote.originalTimestamp - detNote.compensatedTimestamp,
          referenceTime: refNote.timestamp,
          timingDeviation: timingDeviation
        });
      }

      // NEW: Continuous scoring with gradual falloff zones
      const pitchScore = this._getPitchScoreMultiplier(pitchDeviation);
      const timingScore = this._getTimingScoreMultiplier(timingDeviation);
      const combinedScore = pitchScore * timingScore;

      console.log(`🔢 Note ${refIndex + 1} continuous scoring:`, {
        pitchDeviation: pitchDeviation.toFixed(2),
        timingDeviation: timingDeviation.toFixed(0) + 'ms',
        pitchScore: pitchScore.toFixed(2),
        timingScore: timingScore.toFixed(2),
        combinedScore: combinedScore.toFixed(3),
        expectedClassification: combinedScore >= 0.95 ? 'PERFECT' :
                               combinedScore >= 0.8 ? 'GREAT' :
                               combinedScore >= 0.6 ? 'GOOD' :
                               combinedScore >= 0.4 ? 'OK' : 'POOR'
      });

      // Classify note based on combined score (continuous system)
      let classification;
      if (combinedScore >= 0.95) {
        classification = 'PERFECT';
      } else if (combinedScore >= 0.8) {
        classification = 'GREAT';
      } else if (combinedScore >= 0.6) {
        classification = 'GOOD';
      } else if (combinedScore >= 0.4) {
        classification = 'OK';
      } else {
        classification = 'POOR';
      }

      results.push({
        noteId: refNote.id,
        classification: classification,
        expectedMidi: refNote.midi,
        expectedTimestamp: refNote.timestamp,
        detectedMidi: detNote.midi,
        detectedTimestamp: detectedTimestamp, // Use compensated timestamp
        detectedTimestampRaw: detNote.originalTimestamp, // NEW: Original timestamp for transparency
        detectedTimestampCompensated: detectedTimestamp, // NEW: After compensation
        latencyCompensation: detNote.originalTimestamp - detectedTimestamp, // NEW: Amount compensated
        detectedConfidence: detNote.confidence,
        pitchDeviation: pitchDeviation,
        timingDeviation: timingDeviation,
        pitchScore: pitchScore, // NEW: Continuous pitch score (0-1)
        timingScore: timingScore, // NEW: Continuous timing score (0-1)
        combinedScore: combinedScore, // NEW: Combined score (0-1)
        score: combinedScore * 100 // NEW: Score as percentage
      });
    });

    // Find missed notes (in reference but not detected)
    reference.forEach((refNote, index) => {
      if (!matchedRefIndices.has(index)) {
        results.push({
          noteId: refNote.id,
          classification: 'MISSED',
          expectedMidi: refNote.midi,
          expectedTimestamp: refNote.timestamp,
          detectedMidi: null,
          detectedTimestamp: null,
          detectedTimestampRaw: null,
          detectedTimestampCompensated: null,
          latencyCompensation: null,
          detectedConfidence: null,
          pitchDeviation: 0,
          timingDeviation: 0,
          pitchScore: 0,
          timingScore: 0,
          combinedScore: 0,
          score: 0
        });
      }
    });

    // Find extra notes (detected but not in reference)
    const extraNotes = [];
    detected.forEach((detNote, index) => {
      if (!matchedDetIndices.has(index)) {
        const detectedTimestamp = detNote.compensatedTimestamp !== undefined
          ? detNote.compensatedTimestamp
          : detNote.timestamp;
        extraNotes.push({
          classification: 'EXTRA',
          detectedMidi: detNote.midi,
          detectedTimestamp: detectedTimestamp,
          detectedTimestampRaw: detNote.originalTimestamp,
          detectedTimestampCompensated: detectedTimestamp,
          latencyCompensation: detNote.originalTimestamp - detectedTimestamp,
          detectedConfidence: detNote.confidence
        });
      }
    });

    // Store extra notes count in aggregate (not in perNote array)
    this._extraNotes = extraNotes;

    // Sort results by expected timestamp for consistent ordering
    return results.sort((a, b) => a.expectedTimestamp - b.expectedTimestamp);
  }

  /**
   * Evaluate notes using dual alignment - NEW method for dual detection
   * @private
   * @param {Array} reference - Reference timeline
   * @param {Array} allPitchEvents - All continuous pitch events
   * @param {Array} onsetEvents - Onset detection events only
   * @param {Array} pitchPath - DTW alignment path for pitch
   * @param {Array} timingPath - DTW alignment path for timing
   * @returns {Array} Per-note evaluation results
   */
  _evaluateNotesWithDualAlignment(reference, allPitchEvents, onsetEvents, pitchPath, timingPath) {
    const results = [];
    const pitchMatches = new Map();
    const timingMatches = new Map();

    console.log('🔍 DTW Debug - Evaluating dual alignment:');
    console.log('- Reference notes:', reference.length);
    console.log('- Pitch events:', allPitchEvents.length);
    console.log('- Onset events:', onsetEvents.length);
    console.log('- Pitch alignment path:', pitchPath.length, 'matches');
    console.log('- Timing alignment path:', timingPath.length, 'matches');

    // Process pitch alignment matches
    pitchPath.forEach(({refIndex, detIndex}) => {
      pitchMatches.set(refIndex, allPitchEvents[detIndex]);
    });

    // Process timing alignment matches
    timingPath.forEach(({refIndex, detIndex}) => {
      timingMatches.set(refIndex, onsetEvents[detIndex]);
    });
    
    // Evaluate each reference note
    reference.forEach((refNote, refIndex) => {
      const pitchEvent = pitchMatches.get(refIndex);
      let onsetEvent = timingMatches.get(refIndex);

      console.log(`🔍 Evaluating note ${refIndex + 1} (${refNote.id}):`, {
        expectedMidi: refNote.midi,
        expectedTime: refNote.timestamp,
        hasPitchEvent: !!pitchEvent,
        hasOnsetEvent: !!onsetEvent,
        pitchEvent: pitchEvent ? {
          midi: pitchEvent.midi,
          timestamp: pitchEvent.timestamp,
          confidence: pitchEvent.confidence
        } : null,
        onsetEvent: onsetEvent ? {
          midi: onsetEvent.midi,
          timestamp: onsetEvent.timestamp,
          confidence: onsetEvent.confidence
        } : null
      });

      if (!pitchEvent) {
        console.log(`❌ Note ${refIndex + 1} marked as MISSED - no pitch event found`);
        // Completely missed...
        results.push({
          noteId: refNote.id,
          classification: 'MISSED',
          expectedMidi: refNote.midi,
          expectedTimestamp: refNote.timestamp,
          detectedMidi: null,
          detectedTimestamp: null,
          detectedTimestampRaw: null,
          detectedTimestampCompensated: null,
          latencyCompensation: null,
          detectedConfidence: null,
          onsetDetectedTimestamp: null,
          onsetConfidence: 0,
          pitchDeviation: 0,
          timingDeviation: 0,
          pitchCorrect: false,
          timingCorrect: false
        });
        return;
      }

      // IMPROVED: Prioritize onset pitch over continuous pitch to avoid lag
      // If we have both onset and pitch, use the pitch from whichever is more confident
      let selectedPitch;
      let pitchSource;

      if (onsetEvent && pitchEvent) {
        // Both available - compare confidence and timing proximity
        const onsetConfidence = onsetEvent.confidence || 0;
        const pitchConfidence = pitchEvent.confidence || 0;
        
        // If onset happened within 100ms of pitch detection and has decent confidence,
        // trust the onset pitch more (it's fresher and less likely to be lagging)
        const timeDiff = Math.abs(onsetEvent.timestamp - pitchEvent.timestamp);
        
        if (timeDiff < 100 && onsetConfidence > 0.3) {
          selectedPitch = onsetEvent.midi;
          pitchSource = 'onset';
        } else if (pitchConfidence > onsetConfidence) {
          selectedPitch = pitchEvent.midi;
          pitchSource = 'continuous';
        } else {
          selectedPitch = onsetEvent.midi;
          pitchSource = 'onset-fallback';
        }
      } else if (onsetEvent) {
        selectedPitch = onsetEvent.midi;
        pitchSource = 'onset-only';
      } else {
        selectedPitch = pitchEvent.midi;
        pitchSource = 'continuous-only';
      }

      // Pitch accuracy using selected pitch
      const pitchDeviation = selectedPitch - refNote.midi;
      const pitchCorrect = Math.abs(pitchDeviation * 100) <= this.tolerances.pitch;

      // Log pitch source selection for debugging (first 5 notes only)
      if (refIndex < 5) {
        console.log(`Note ${refIndex + 1} pitch selected from: ${pitchSource}`, {
          onset: onsetEvent?.midi,
          continuous: pitchEvent?.midi,
          selected: selectedPitch,
          expected: refNote.midi
        });
      }
      
      // Timing accuracy from onset detection - USE calculated tempo-aware tolerance
      let timingCorrect = false;
      let timingDeviation = 0;
      let onsetTime = null;
      let onsetConfidence = 0;
      
      if (onsetEvent) {
        timingDeviation = onsetEvent.timestamp - refNote.timestamp;
        // Use the calculated tempo-aware timing tolerance (214ms at 98 BPM EASY)
        timingCorrect = Math.abs(timingDeviation) <= this.tolerances.timing;
        onsetTime = onsetEvent.timestamp;
        onsetConfidence = onsetEvent.confidence || 0;
      } else {
        // Pitch detected but no onset - timing incorrect
        // Use the continuous pitch timestamp for timing deviation calculation
        timingDeviation = pitchEvent.timestamp - refNote.timestamp;
        // Use the calculated tempo-aware timing tolerance for continuous pitch events too
        timingCorrect = Math.abs(timingDeviation) <= this.tolerances.timing;
        onsetTime = null;
        onsetConfidence = 0;
      }
      
      // NEW: Continuous scoring with gradual falloff zones
      const pitchScore = this._getPitchScoreMultiplier(pitchDeviation);
      const timingScore = this._getTimingScoreMultiplier(timingDeviation);
      const combinedScore = pitchScore * timingScore;

      // Classify note based on combined score (continuous system)
      let classification;
      if (combinedScore >= 0.95) {
        classification = 'PERFECT';
      } else if (combinedScore >= 0.8) {
        classification = 'GREAT';
      } else if (combinedScore >= 0.6) {
        classification = 'GOOD';
      } else if (combinedScore >= 0.4) {
        classification = 'OK';
      } else {
        classification = 'POOR';
      }

      results.push({
        noteId: refNote.id,
        classification,
        expectedMidi: refNote.midi,
        expectedTimestamp: refNote.timestamp,
        detectedMidi: selectedPitch, // Use the selected pitch (onset or continuous)
        detectedTimestamp: pitchEvent.timestamp,
        detectedTimestampRaw: pitchEvent.originalTimestamp,
        detectedTimestampCompensated: pitchEvent.compensatedTimestamp,
        latencyCompensation: pitchEvent.originalTimestamp - pitchEvent.compensatedTimestamp,
        detectedConfidence: pitchEvent.confidence,
        onsetDetectedTimestamp: onsetTime,
        onsetConfidence,
        pitchDeviation,
        timingDeviation,
        pitchScore, // NEW: Continuous pitch score (0-1)
        timingScore, // NEW: Continuous timing score (0-1)
        combinedScore, // NEW: Combined score (0-1)
        score: combinedScore * 100 // NEW: Score as percentage
      });
      
      // Debug logging for timing analysis
      if (refIndex < 5) { // Log first 5 notes for debugging
        console.log(`Note ${refIndex + 1} (${refNote.id}):`, {
          expectedTime: refNote.timestamp,
          detectedTime: pitchEvent.timestamp,
          onsetTime: onsetTime,
          timingDeviation: timingDeviation,
          tolerance: this.tolerances.timing,
          pitchCorrect,
          timingCorrect,
          classification
        });
      }
    });
    
    // Handle extra notes (detected but not in reference)
    this._handleExtraNotesWithDualAlignment(allPitchEvents, onsetEvents, pitchMatches, timingMatches);
    
    // Summary statistics for debugging (updated for continuous scoring)
    const summary = {
      perfect: results.filter(r => r.classification === 'PERFECT').length,
      great: results.filter(r => r.classification === 'GREAT').length,
      good: results.filter(r => r.classification === 'GOOD').length,
      ok: results.filter(r => r.classification === 'OK').length,
      poor: results.filter(r => r.classification === 'POOR').length,
      missed: results.filter(r => r.classification === 'MISSED').length
    };

    // Calculate overall accuracy (continuous scoring)
    const totalScored = results.filter(r => r.classification !== 'MISSED').length;
    const excellent = summary.perfect + summary.great; // 95%+ and 80%+ scores
    const acceptable = summary.good + summary.ok;     // 60%+ and 40%+ scores
    const overallAccuracy = totalScored > 0 ? Math.round(((excellent + acceptable) / totalScored) * 100) : 0;

    console.log('📈 Analysis Summary (Continuous Scoring):', {
      ...summary,
      totalNotes: results.length,
      scoredNotes: totalScored,
      excellentNotes: excellent,
      acceptableNotes: acceptable,
      overallAccuracy: overallAccuracy + '%',
      timingTolerance: this.tolerances.timing + 'ms',
      pitchTolerance: this.tolerances.pitch + ' cents'
    });

    // Log specific problematic notes
    const problematicNotes = results.filter(r => 
      r.classification === 'WRONG_PITCH' && Math.abs(r.timingDeviation) < 150
    );
    if (problematicNotes.length > 0) {
      console.log('🎯 Notes with good timing but wrong pitch (potential pitch lag):', 
        problematicNotes.map(n => ({
          note: n.noteId,
          expected: n.expectedMidi,
          detected: n.detectedMidi,
          timingOff: Math.round(n.timingDeviation) + 'ms',
          confidence: Math.round(n.detectedConfidence * 100) + '%'
        }))
      );
    }

    return results.sort((a, b) => a.expectedTimestamp - b.expectedTimestamp);
  }

  /**
   * Evaluate notes using sequential best-fit matching algorithm
   * @private
   * @param {Array} reference - Reference timeline
   * @param {Array} allPitchEvents - All continuous pitch events
   * @param {Array} onsetEvents - Onset detection events only
   * @param {number} currentTempo - Current tempo in BPM for window sizing
   * @returns {Array} Per-note evaluation results
   */
  _evaluateNotesWithSequentialMatching(reference, allPitchEvents, onsetEvents, currentTempo) {
    const results = [];
    const usedDetectionIndices = new Set();

    console.log('🔍 Sequential Best-Fit Matching - Processing reference notes in chronological order:');
    console.log('- Reference notes:', reference.length);
    console.log('- Available pitch events:', allPitchEvents.length);
    console.log('- Available onset events:', onsetEvents.length);
    console.log('- Current tempo:', currentTempo, 'BPM');

    // PHASE 1: Track previous reference notes for sequence context
    const previousRefNotes = [];

    // Process reference notes in chronological order
    reference.forEach((refNote, refIndex) => {
      console.log(`🔍 Processing reference note ${refIndex + 1}/${reference.length}: ${refNote.id} (MIDI: ${refNote.midi}, Time: ${refNote.timestamp}ms)`);

      // Find best matching detection for this reference note
      const bestMatch = this._findBestSequentialMatch(
        refNote,
        allPitchEvents,
        onsetEvents,
        usedDetectionIndices,
        currentTempo,
        previousRefNotes.slice(0, 2), // Pass last 2 reference notes for sequence context
        refIndex // Pass note index for adaptive window scaling
      );

      // PHASE 1: Update sequence tracking with matched note
      if (bestMatch) {
        previousRefNotes.unshift({
          midi: refNote.midi,
          timestamp: bestMatch.selectedTimestamp // Use the matched timestamp for interval calculations
        });
        // Keep only last 2 notes for context
        if (previousRefNotes.length > 2) {
          previousRefNotes.pop();
        }
      }

      if (bestMatch) {
        // Mark detection as used
        usedDetectionIndices.add(bestMatch.detectionIndex);

        // Calculate scoring
        const pitchDeviation = bestMatch.selectedPitch - refNote.midi;
        const timingDeviation = bestMatch.selectedTimestamp - refNote.timestamp;

        const pitchScore = this._getPitchScoreMultiplier(pitchDeviation);
        const timingScore = this._getTimingScoreMultiplier(timingDeviation);
        const combinedScore = pitchScore * timingScore;

        // Classify note based on combined score
        let classification;
        if (combinedScore >= 0.95) {
          classification = 'PERFECT';
        } else if (combinedScore >= 0.8) {
          classification = 'GREAT';
        } else if (combinedScore >= 0.6) {
          classification = 'GOOD';
        } else if (combinedScore >= 0.4) {
          classification = 'OK';
        } else {
          classification = 'POOR';
        }

        console.log(`✅ Matched reference note ${refIndex + 1} with detection:`, {
          expectedMidi: refNote.midi,
          detectedMidi: bestMatch.selectedPitch,
          expectedTime: refNote.timestamp,
          detectedTime: bestMatch.selectedTimestamp,
          timingDeviation: Math.round(timingDeviation),
          pitchDeviation: pitchDeviation.toFixed(2),
          source: bestMatch.source,
          combinedScore: combinedScore.toFixed(3),
          classification
        });

        results.push({
          noteId: refNote.id,
          classification,
          expectedMidi: refNote.midi,
          expectedTimestamp: refNote.timestamp,
          detectedMidi: bestMatch.selectedPitch,
          detectedTimestamp: bestMatch.selectedTimestamp,
          detectedTimestampRaw: bestMatch.originalTimestamp,
          detectedTimestampCompensated: bestMatch.selectedTimestamp,
          latencyCompensation: bestMatch.originalTimestamp - bestMatch.selectedTimestamp,
          detectedConfidence: bestMatch.confidence,
          onsetDetectedTimestamp: bestMatch.onsetTimestamp,
          onsetConfidence: bestMatch.onsetConfidence || 0,
          pitchDeviation,
          timingDeviation,
          pitchScore,
          timingScore,
          combinedScore,
          score: combinedScore * 100
        });
      } else {
        console.log(`❌ No suitable match found for reference note ${refIndex + 1} - marking as MISSED`);

        results.push({
          noteId: refNote.id,
          classification: 'MISSED',
          expectedMidi: refNote.midi,
          expectedTimestamp: refNote.timestamp,
          detectedMidi: null,
          detectedTimestamp: null,
          detectedTimestampRaw: null,
          detectedTimestampCompensated: null,
          latencyCompensation: null,
          detectedConfidence: null,
          onsetDetectedTimestamp: null,
          onsetConfidence: 0,
          pitchDeviation: 0,
          timingDeviation: 0,
          pitchScore: 0,
          timingScore: 0,
          combinedScore: 0,
          score: 0
        });
      }
    });

    // Handle extra notes (detected but not matched to any reference)
    this._handleExtraNotesForSequentialMatching(allPitchEvents, onsetEvents, usedDetectionIndices);

    // Summary statistics
    const summary = {
      perfect: results.filter(r => r.classification === 'PERFECT').length,
      great: results.filter(r => r.classification === 'GREAT').length,
      good: results.filter(r => r.classification === 'GOOD').length,
      ok: results.filter(r => r.classification === 'OK').length,
      poor: results.filter(r => r.classification === 'POOR').length,
      missed: results.filter(r => r.classification === 'MISSED').length
    };

    const totalScored = results.filter(r => r.classification !== 'MISSED').length;
    const excellent = summary.perfect + summary.great;
    const acceptable = summary.good + summary.ok;
    const overallAccuracy = totalScored > 0 ? Math.round(((excellent + acceptable) / totalScored) * 100) : 0;

    console.log('📈 Sequential Matching Summary:', {
      ...summary,
      totalNotes: results.length,
      scoredNotes: totalScored,
      excellentNotes: excellent,
      acceptableNotes: acceptable,
      overallAccuracy: overallAccuracy + '%',
      extraNotes: this._extraNotes.length,
      timingTolerance: this.tolerances.timing + 'ms',
      pitchTolerance: this.tolerances.pitch + ' cents'
    });

    return results.sort((a, b) => a.expectedTimestamp - b.expectedTimestamp);
  }

  /**
   * Find best sequential match for a reference note using multi-tier fallback system
   * @private
   * @param {Object} refNote - Reference note
   * @param {Array} allPitchEvents - All pitch events
   * @param {Array} onsetEvents - Onset events
   * @param {Set} usedDetectionIndices - Indices of already used detections
   * @param {number} currentTempo - Current tempo in BPM
   * @param {Array} previousRefNotes - Previous 2-3 reference notes for sequence context
   * @param {number} noteIndex - Position of note in sequence (0-based)
   * @returns {Object|null} Best match result or null
   */
  _findBestSequentialMatch(refNote, allPitchEvents, onsetEvents, usedDetectionIndices, currentTempo, previousRefNotes = [], noteIndex = 0) {
    // PHASE 3: Multi-tier matching with cascading fallback system
    const matchingTiers = [
      {
        name: 'strict',
        windowMultiplier: 1.0,
        pitchTolerance: 1.0,  // Normal pitch tolerance
        timingTolerance: 1.0, // Normal timing tolerance
        minScore: 0.6         // Require 60%+ match quality
      },
      {
        name: 'relaxed',
        windowMultiplier: 1.5,
        pitchTolerance: 1.5,  // 50% more lenient on pitch
        timingTolerance: 1.5, // 50% more lenient on timing
        minScore: 0.4         // Accept 40%+ match quality
      },
      {
        name: 'fallback',
        windowMultiplier: 2.0,
        pitchTolerance: 3.0,  // Very lenient on pitch (3 semitones)
        timingTolerance: 2.0, // 100% more lenient on timing
        minScore: 0.2         // Accept any reasonable match (20%+)
      }
    ];

    console.log(`   🔄 PHASE 3: Multi-tier matching for note ${noteIndex + 1} (${refNote.id})`);

    // Try each tier in order until we find a match
    for (const tier of matchingTiers) {
      console.log(`   Trying ${tier.name} tier (window x${tier.windowMultiplier}, pitch tol x${tier.pitchTolerance})`);

      const match = this._findMatchWithTierConfig(
        refNote,
        allPitchEvents,
        onsetEvents,
        usedDetectionIndices,
        currentTempo,
        noteIndex,
        previousRefNotes,
        tier
      );

      if (match) {
        console.log(`   ✅ ${tier.name} tier succeeded: score=${match.totalScore.toFixed(3)}`);
        return match;
      }

      console.log(`   ❌ ${tier.name} tier failed - trying next tier`);
    }

    console.log(`   💀 All tiers failed - no match found for note ${noteIndex + 1}`);
    return null;
  }

  /**
   * Find match using specific tier configuration
   * @private
   * @param {Object} refNote - Reference note
   * @param {Array} allPitchEvents - All pitch events
   * @param {Array} onsetEvents - Onset events
   * @param {Set} usedDetectionIndices - Indices of already used detections
   * @param {number} currentTempo - Current tempo in BPM
   * @param {number} noteIndex - Position of note in sequence
   * @param {Array} previousRefNotes - Previous reference notes for sequence context
   * @param {Object} tier - Matching tier configuration
   * @returns {Object|null} Match result or null
   */
  _findMatchWithTierConfig(refNote, allPitchEvents, onsetEvents, usedDetectionIndices, currentTempo, noteIndex, previousRefNotes, tier) {
    // Calculate tier-adjusted window size
    const baseWindowSize = this._calculateMatchingWindow(currentTempo, noteIndex);
    const windowSize = baseWindowSize * tier.windowMultiplier;
    const windowStart = refNote.timestamp - windowSize;
    const windowEnd = refNote.timestamp + windowSize * 0.7; // Favor earlier detections

    // PHASE 1: Consecutive pitch handling - build sequence context
    const sequenceContext = {
      isConsecutiveSamePitch: previousRefNotes.length >= 1 && previousRefNotes[0].midi === refNote.midi,
      expectedInterval: previousRefNotes.length >= 1 ?
        (refNote.timestamp - previousRefNotes[0].timestamp) : null,
      previousPitch: previousRefNotes.length >= 1 ? previousRefNotes[0].midi : null
    };

    let bestScore = -Infinity;
    let bestMatch = null;

    // Search through all available pitch events
    allPitchEvents.forEach((pitchEvent, pitchIndex) => {
      if (usedDetectionIndices.has(pitchIndex)) return;

      const eventTime = pitchEvent.timestamp;
      if (eventTime < windowStart || eventTime > windowEnd) return;

      // Find corresponding onset event (if any) within reasonable time window
      const correspondingOnset = this._findCorrespondingOnset(pitchEvent, onsetEvents, 100); // 100ms window

      // Select pitch source (prioritize onset if available and confident)
      let selectedPitch = pitchEvent.midi;
      let selectedTimestamp = eventTime;
      let source = 'continuous';
      let confidence = pitchEvent.confidence || 0;
      let onsetTimestamp = null;
      let onsetConfidence = 0;

      if (correspondingOnset) {
        // Use onset pitch if it's more confident or closer in time
        const onsetTimeDiff = Math.abs(correspondingOnset.timestamp - eventTime);
        const onsetConfidence = correspondingOnset.confidence || 0;

        if (onsetConfidence > confidence || onsetTimeDiff < 50) {
          selectedPitch = correspondingOnset.midi;
          selectedTimestamp = correspondingOnset.timestamp;
          source = 'onset';
          confidence = onsetConfidence;
          onsetTimestamp = correspondingOnset.timestamp;
          onsetConfidence = onsetConfidence;
        }
      }

      // Calculate match score with tier-adjusted tolerances
      const pitchDiff = Math.abs(selectedPitch - refNote.midi);
      const timeDiff = Math.abs(selectedTimestamp - refNote.timestamp);

      // Pitch score (0-1, higher is better) - adjusted by tier tolerance
      const pitchScore = pitchDiff === 0 ? 1.0 : Math.max(0, 1 - (pitchDiff * 0.15 / tier.pitchTolerance));

      // Timing score (0-1, higher is better, favor closer matches) - adjusted by tier tolerance
      const timingScore = Math.max(0, 1 - (timeDiff / (windowSize * 2 / tier.timingTolerance)));

      // PHASE 1: Apply sequence bonus for consecutive same-pitch notes
      let sequenceBonus = 1.0;
      if (sequenceContext.isConsecutiveSamePitch && sequenceContext.expectedInterval) {
        // Calculate how well this detection matches the expected interval from previous note
        const previousMatchTime = previousRefNotes[0].timestamp;
        const expectedCurrentTime = previousMatchTime + sequenceContext.expectedInterval;
        const intervalDeviation = Math.abs(selectedTimestamp - expectedCurrentTime);

        // Sequence bonus: closer to expected interval = higher bonus (up to 10% score increase)
        const maxIntervalDeviation = 200; // 200ms tolerance for interval matching
        sequenceBonus = 1.0 + Math.max(0, (1.0 - (intervalDeviation / maxIntervalDeviation)) * 0.1);
      }

      // Combined score with slight preference for pitch accuracy, plus sequence bonus
      const totalScore = ((pitchScore * 0.7) + (timingScore * 0.3)) * sequenceBonus;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestMatch = {
          detectionIndex: pitchIndex,
          selectedPitch,
          selectedTimestamp,
          originalTimestamp: pitchEvent.originalTimestamp || eventTime,
          confidence,
          source,
          onsetTimestamp,
          onsetConfidence,
          pitchScore,
          timingScore,
          totalScore,
          sequenceBonus,
          tier: tier.name // Track which tier succeeded
        };
      }
    });

    // Return match if it meets tier's minimum score requirement
    if (bestMatch && bestScore >= tier.minScore) {
      return bestMatch;
    }

    return null;
  }

  /**
   * Calculate dynamic matching window based on tempo and note position
   * @private
   * @param {number} currentTempo - Current tempo in BPM
   * @param {number} noteIndex - Position of note in sequence (0-based)
   * @returns {number} Window size in milliseconds
   */
  _calculateMatchingWindow(currentTempo, noteIndex = 0) {
    // Base window on beat duration, with minimum and maximum bounds
    const beatDuration = 60000 / currentTempo;
    let windowSize = Math.min(500, Math.max(150, beatDuration * 0.75));

    // PHASE 2: Adaptive window scaling for late-game notes
    // Expand windows progressively for notes 12+ to handle accumulated timing drift
    const windowScaling = [
      [0, 1.0],   // First 12 notes: 100% base window
      [12, 1.25], // After note 12: 125% (25% expansion)
      [20, 1.5],  // After note 20: 150% (50% expansion)
      [30, 1.75]  // After note 30: 175% (75% expansion)
    ];

    // Find the appropriate scaling factor based on note position
    let scaleFactor = 1.0;
    for (const [threshold, factor] of windowScaling) {
      if (noteIndex >= threshold) {
        scaleFactor = factor;
      } else {
        break; // windowScaling is sorted, so we can break early
      }
    }

    const scaledWindowSize = windowSize * scaleFactor;

    // Log window scaling for debugging (only for notes 10+)
    if (noteIndex >= 10) {
      console.log(`   🔄 Adaptive window scaling: note ${noteIndex + 1}, base=${Math.round(windowSize)}ms, scale=${scaleFactor.toFixed(2)}x, final=${Math.round(scaledWindowSize)}ms`);
    }

    return scaledWindowSize;
  }

  /**
   * Find corresponding onset event for a pitch event
   * @private
   * @param {Object} pitchEvent - Pitch event
   * @param {Array} onsetEvents - All onset events
   * @param {number} timeWindow - Time window in milliseconds
   * @returns {Object|null} Corresponding onset event or null
   */
  _findCorrespondingOnset(pitchEvent, onsetEvents, timeWindow) {
    const pitchTime = pitchEvent.timestamp;

    for (const onsetEvent of onsetEvents) {
      const timeDiff = Math.abs(onsetEvent.timestamp - pitchTime);
      if (timeDiff <= timeWindow) {
        return onsetEvent;
      }
    }

    return null;
  }

  /**
   * Handle extra notes for sequential matching
   * @private
   * @param {Array} allPitchEvents - All pitch events
   * @param {Array} onsetEvents - Onset events
   * @param {Set} usedDetectionIndices - Indices of used detections
   */
  _handleExtraNotesForSequentialMatching(allPitchEvents, onsetEvents, usedDetectionIndices) {
    const extraNotes = [];

    // Find unmatched pitch events
    allPitchEvents.forEach((detNote, index) => {
      if (!usedDetectionIndices.has(index)) {
        const detectedTimestamp = detNote.compensatedTimestamp !== undefined
          ? detNote.compensatedTimestamp
          : detNote.timestamp;
        extraNotes.push({
          classification: 'EXTRA',
          detectedMidi: detNote.midi,
          detectedTimestamp: detectedTimestamp,
          detectedTimestampRaw: detNote.originalTimestamp,
          detectedTimestampCompensated: detectedTimestamp,
          latencyCompensation: detNote.originalTimestamp - detectedTimestamp,
          detectedConfidence: detNote.confidence
        });
      }
    });

    // Find unmatched onset events
    onsetEvents.forEach((detNote) => {
      const detectedTimestamp = detNote.compensatedTimestamp !== undefined
        ? detNote.compensatedTimestamp
        : detNote.timestamp;
      extraNotes.push({
        classification: 'EXTRA',
        detectedMidi: detNote.midi,
        detectedTimestamp: detectedTimestamp,
        detectedTimestampRaw: detNote.originalTimestamp,
        detectedTimestampCompensated: detectedTimestamp,
        latencyCompensation: detNote.originalTimestamp - detectedTimestamp,
        detectedConfidence: detNote.confidence
      });
    });

    this._extraNotes = extraNotes;
  }

  /**
   * Handle extra notes for dual alignment
   * @private
   * @param {Array} allPitchEvents - All pitch events
   * @param {Array} onsetEvents - Onset events
   * @param {Map} pitchMatches - Pitch alignment matches
   * @param {Map} timingMatches - Timing alignment matches
   */
  _handleExtraNotesWithDualAlignment(allPitchEvents, onsetEvents, pitchMatches, timingMatches) {
    const extraNotes = [];

    // Find unmatched pitch events
    allPitchEvents.forEach((detNote, index) => {
      let isMatched = false;
      for (const [refIndex, matchedEvent] of pitchMatches) {
        if (matchedEvent === detNote) {
          isMatched = true;
          break;
        }
      }
      if (!isMatched) {
        const detectedTimestamp = detNote.compensatedTimestamp !== undefined
          ? detNote.compensatedTimestamp
          : detNote.timestamp;
        extraNotes.push({
          classification: 'EXTRA',
          detectedMidi: detNote.midi,
          detectedTimestamp: detectedTimestamp,
          detectedTimestampRaw: detNote.originalTimestamp,
          detectedTimestampCompensated: detectedTimestamp,
          latencyCompensation: detNote.originalTimestamp - detectedTimestamp,
          detectedConfidence: detNote.confidence
        });
      }
    });

    // Find unmatched onset events
    onsetEvents.forEach((detNote, index) => {
      let isMatched = false;
      for (const [refIndex, matchedEvent] of timingMatches) {
        if (matchedEvent === detNote) {
          isMatched = true;
          break;
        }
      }
      if (!isMatched) {
        const detectedTimestamp = detNote.compensatedTimestamp !== undefined
          ? detNote.compensatedTimestamp
          : detNote.timestamp;
        extraNotes.push({
          classification: 'EXTRA',
          detectedMidi: detNote.midi,
          detectedTimestamp: detectedTimestamp,
          detectedTimestampRaw: detNote.originalTimestamp,
          detectedTimestampCompensated: detectedTimestamp,
          latencyCompensation: detNote.originalTimestamp - detectedTimestamp,
          detectedConfidence: detNote.confidence
        });
      }
    });

    this._extraNotes = extraNotes;
  }

  /**
   * Calculate aggregate performance metrics with continuous scoring
   * @private
   * @param {Array} perNoteResults - Results from per-note evaluation
   * @returns {Object} Aggregate metrics
   */
  _calculateAggregateMetrics(perNoteResults) {
    const total = perNoteResults.length;

    if (total === 0) {
      return this._getEmptyAggregate();
    }

    // Count by classification (continuous system)
    const counts = {
      perfect: 0,
      great: 0,
      good: 0,
      ok: 0,
      poor: 0,
      missed: 0
    };

    const timingDeviations = [];
    let totalScore = 0;
    let totalPossibleScore = 0;

    perNoteResults.forEach(result => {
      // Count classifications
      switch (result.classification) {
        case 'PERFECT':
          counts.perfect++;
          break;
        case 'GREAT':
          counts.great++;
          break;
        case 'GOOD':
          counts.good++;
          break;
        case 'OK':
          counts.ok++;
          break;
        case 'POOR':
          counts.poor++;
          break;
        case 'MISSED':
          counts.missed++;
          break;
      }

      // Accumulate continuous scores
      totalScore += result.score || 0;
      totalPossibleScore += 100; // Each note is worth 100 points

      // Collect timing deviations (only for detected notes)
      if (result.detectedTimestamp !== null) {
        timingDeviations.push(Math.abs(result.timingDeviation));
      }
    });

    // Calculate overall accuracy percentage (continuous scoring)
    const correctPercentage = totalPossibleScore > 0 ? (totalScore / totalPossibleScore) * 100 : 0;

    // Calculate average timing deviation
    const avgTiming = timingDeviations.length > 0
      ? timingDeviations.reduce((a, b) => a + b, 0) / timingDeviations.length
      : 0;

    // Calculate timing consistency (based on standard deviation)
    const timingConsistency = this._calculateConsistencyScore(timingDeviations);

    // Calculate grade distribution
    const excellent = counts.perfect + counts.great; // 95%+ and 80%+ scores
    const acceptable = counts.good + counts.ok;     // 60%+ and 40%+ scores
    const failed = counts.poor + counts.missed;     // <40% and missed

    return {
      // Overall performance
      score: Math.round(totalScore),
      scorePercentage: Math.round(correctPercentage * 10) / 10, // 1 decimal
      grade: this._calculateGrade(correctPercentage),

      // Detailed breakdown
      counts,

      // Accuracy metrics
      correctPercentage: Math.round(correctPercentage * 10) / 10,
      excellentPercentage: total > 0 ? Math.round((excellent / total) * 100) : 0,
      acceptablePercentage: total > 0 ? Math.round((acceptable / total) * 100) : 0,
      failedPercentage: total > 0 ? Math.round((failed / total) * 100) : 0,

      // Timing metrics
      averageTimingDeviation: Math.round(avgTiming),
      timingConsistencyScore: Math.round(timingConsistency),

      // Legacy compatibility (map to old format)
      notesCorrect: excellent + acceptable,
      notesMissed: counts.missed,
      notesWrongPitch: counts.poor,
      notesWrongTiming: counts.poor,
      notesExtra: this._extraNotes.length,
      totalNotes: total
    };
  }

  /**
   * Calculate timing consistency score (0-100)
   * @private
   * @param {Array} deviations - Array of absolute timing deviations
   * @returns {number} Consistency score (higher is better)
   */
  _calculateConsistencyScore(deviations) {
    if (deviations.length < 2) {
      return 100; // Perfect consistency if 0 or 1 note
    }
    
    // Calculate standard deviation
    const mean = deviations.reduce((a, b) => a + b, 0) / deviations.length;
    const squaredDiffs = deviations.map(d => Math.pow(d - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / deviations.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalize to 0-100 scale
    // Assumption: stdDev of 0 = 100, stdDev of 200ms or more = 0
    const maxStdDev = 200;
    const score = Math.max(0, 100 - (stdDev / maxStdDev * 100));
    
    return score;
  }

  /**
   * Get empty aggregate metrics
   * @private
   * @returns {Object} Empty aggregate object
   */
  _getEmptyAggregate() {
    return {
      correctPercentage: 0,
      averageTimingDeviation: 0,
      timingConsistencyScore: 0,
      notesCorrect: 0,
      notesMissed: 0,
      notesWrongPitch: 0,
      notesWrongTiming: 0,
      notesExtra: 0,
      totalNotes: 0
    };
  }

  /**
   * Normalize pitch stream (handle both monophonic and polyphonic) - ENHANCED with compensation data
   * @private
   * @param {Array} pitchStream - Raw pitch stream from detectors
   * @returns {Array} Normalized note array
   */
  _normalizePitchStream(pitchStream) {
    return pitchStream.map(event => {
      // Handle dual detection events (continuous pitch events)
      return {
        midi: event.midi || event.frequency,
        timestamp: event.timestamp,
        compensatedTimestamp: event.compensatedTimestamp, // ENHANCED: Preserve compensation
        originalTimestamp: event.originalTimestamp, // ENHANCED: Original timestamp
        confidence: event.confidence,
        isOnset: event.isOnset, // NEW: For dual detection
        onsetConfidence: event.onsetConfidence // NEW: For dual detection
      };
    });
  }

  /**
   * Generate empty result when no notes detected
   * @private
   * @param {Array} referenceTimeline - Reference timeline
   * @returns {Object} Empty result object
   */
  _generateEmptyResult(referenceTimeline) {
    const perNote = referenceTimeline.map(note => ({
      noteId: note.id,
      classification: 'MISSED',
      expectedMidi: note.midi,
      expectedTimestamp: note.timestamp,
      detectedMidi: null,
      detectedTimestamp: null,
      detectedTimestampRaw: null,
      detectedTimestampCompensated: null,
      latencyCompensation: null,
      detectedConfidence: null,
      pitchDeviation: 0,
      timingDeviation: 0,
      pitchCorrect: false,
      timingCorrect: false
    }));
    
    const result = {
      aggregate: {
        correctPercentage: 0,
        averageTimingDeviation: 0,
        timingConsistencyScore: 0,
        notesCorrect: 0,
        notesMissed: referenceTimeline.length,
        notesWrongPitch: 0,
        notesWrongTiming: 0,
        notesExtra: 0,
        totalNotes: referenceTimeline.length
      },
      perNote,
      exerciseId: referenceTimeline[0]?.exerciseId || 'unknown',
      timestamp: Date.now(),
      tolerances: this.tolerances,
      duration: this._calculateDuration(referenceTimeline),
      analysisTime: 0
    };
    
    this.emit('analysis:complete', { result });
    return result;
  }

  /**
   * Calculate duration of exercise
   * @private
   * @param {Array} timeline - Note timeline
   * @returns {number} Duration in milliseconds
   */
  _calculateDuration(timeline) {
    if (timeline.length === 0) return 0;
    const last = timeline[timeline.length - 1];
    return last.timestamp + (last.duration || 0);
  }

  /**
   * Apply temporal smoothing filter (Performous-inspired)
   * Filters out rapid pitch fluctuations that aren't musically meaningful
   * @private
   * @param {Array} detectedStream - Raw detected pitches
   * @param {Object} options - Smoothing options
   * @param {number} options.smoothingFactor - 0-1 smoothing factor (default: 0.5)
   * @returns {Array} Smoothed pitch stream
   */
  _applyTemporalSmoothing(detectedStream, options = {}) {
    if (!detectedStream || detectedStream.length === 0) return [];

    const smoothingFactor = options.smoothingFactor || 0.5; // 0-1 range from settings
    const windowMs = 50 + (smoothingFactor * 150); // Map 0-1 to 50-200ms window

    console.log(`🔧 Applying temporal smoothing: factor=${smoothingFactor.toFixed(2)}, window=${windowMs.toFixed(0)}ms`);

    const smoothed = [];
    const window = windowMs;

    for (let i = 0; i < detectedStream.length; i++) {
      const current = detectedStream[i];

      // Get nearby detections within window
      const nearby = detectedStream.filter(d =>
        Math.abs(d.timestamp - current.timestamp) < window
      );

      if (nearby.length === 0) {
        smoothed.push(current);
        continue;
      }

      // Find most common MIDI note in window (mode)
      const midiCounts = {};
      nearby.forEach(d => {
        const midi = Math.round(d.midi || d.frequency || 0);
        midiCounts[midi] = (midiCounts[midi] || 0) + (d.confidence || 1);
      });

      const dominantMidi = Object.keys(midiCounts)
        .reduce((a, b) => midiCounts[a] > midiCounts[b] ? a : b);

      // Average frequency of dominant MIDI
      const dominantDetections = nearby.filter(d =>
        Math.round(d.midi || d.frequency || 0) === parseInt(dominantMidi)
      );

      const avgFrequency = dominantDetections.length > 0
        ? dominantDetections.reduce((sum, d) => sum + (d.frequency || d.midi * 8.1758), 0) / dominantDetections.length
        : current.frequency || current.midi * 8.1758;

      // Boost confidence slightly for smoothed detections
      const avgConfidence = dominantDetections.reduce((sum, d) => sum + (d.confidence || 1), 0) / dominantDetections.length;

      smoothed.push({
        ...current,
        midi: parseInt(dominantMidi),
        frequency: avgFrequency,
        confidence: Math.min(1.0, avgConfidence * 1.1), // Boost confidence slightly
        smoothed: true,
        originalMidi: current.midi,
        originalFrequency: current.frequency
      });
    }

    console.log(`✅ Temporal smoothing applied: ${detectedStream.length} → ${smoothed.length} events`);
    return smoothed;
  }

  /**
   * Get pitch score multiplier based on cents deviation (gradual falloff)
   * @private
   * @param {number} pitchDeviation - Pitch deviation in semitones
   * @returns {number} Score multiplier (0.0 to 1.0)
   */
  _getPitchScoreMultiplier(pitchDeviation) {
    const centsDev = Math.abs(pitchDeviation * 100); // Convert to cents

    // Performous-inspired pitch zones
    if (centsDev <= 5) return 1.0;      // Perfect: ±5 cents → 100% points
    if (centsDev <= 15) return 0.8;     // Great: ±15 cents → 80% points
    if (centsDev <= 25) return 0.6;     // Good: ±25 cents → 60% points
    if (centsDev <= 50) return 0.4;     // OK: ±50 cents → 40% points
    return 0.0;                         // Poor: >50 cents → 0% points
  }

  /**
   * Get timing score multiplier based on milliseconds deviation (gradual falloff)
   * @private
   * @param {number} timingDeviation - Timing deviation in milliseconds
   * @returns {number} Score multiplier (0.0 to 1.0)
   */
  _getTimingScoreMultiplier(timingDeviation) {
    const msDev = Math.abs(timingDeviation);

    // Performous-inspired timing zones
    if (msDev <= 50) return 1.0;         // Perfect: ±50ms → 100% points
    if (msDev <= 150) {                  // Good: ±150ms → 70% points (linear falloff)
      // Linear interpolation between 50ms (1.0) and 150ms (0.7)
      const ratio = (msDev - 50) / (150 - 50);
      return 1.0 - (ratio * 0.3);
    }
    if (msDev <= 250) {                  // OK: ±250ms → 40% points (linear falloff)
      // Linear interpolation between 150ms (0.7) and 250ms (0.4)
      const ratio = (msDev - 150) / (250 - 150);
      return 0.7 - (ratio * 0.3);
    }
    return 0.4;                          // Still OK: >250ms → 40% points (minimum)
  }

  /**
   * Calculate letter grade from percentage
   * @private
   * @param {number} percentage - Correctness percentage
   * @returns {string} Letter grade (S, A, B, C, D, F)
   */
  _calculateGrade(percentage) {
    if (percentage >= 95) return 'S';  // Perfect
    if (percentage >= 90) return 'A+';
    if (percentage >= 85) return 'A';
    if (percentage >= 80) return 'A-';
    if (percentage >= 75) return 'B+';
    if (percentage >= 70) return 'B';
    if (percentage >= 65) return 'B-';
    if (percentage >= 60) return 'C+';
    if (percentage >= 55) return 'C';
    if (percentage >= 50) return 'C-';
    if (percentage >= 45) return 'D';
    return 'F';
  }

  /**
   * Add analysis result to history
   * @private
   * @param {Object} result - Analysis result
   */
  _addToHistory(result) {
    try {
      // Get existing history from storage
      const history = this.storage.get('g4:perfHistory', []);

      // Add new result
      history.push({
        exerciseId: result.exerciseId,
        timestamp: result.timestamp,
        correctPercentage: result.aggregate.correctPercentage,
        averageTimingDeviation: result.aggregate.averageTimingDeviation,
        timingConsistencyScore: result.aggregate.timingConsistencyScore,
        tolerances: result.tolerances,
        notesCorrect: result.aggregate.notesCorrect,
        totalNotes: result.aggregate.totalNotes
      });

      // Implement circular buffer (keep only last maxHistorySize entries)
      if (history.length > this.config.maxHistorySize) {
        history.splice(0, history.length - this.config.maxHistorySize);
      }

      // Save to storage
      this.storage.set('g4:perfHistory', history);

    } catch (error) {
      Logger.log(Logger.WARN, 'Analyzer', 'Failed to store history', {
        error: error.message
      });
      // Don't throw - history is not critical for analysis
    }
  }
}

// Export ToleranceConfig for external use
export { ToleranceConfig, TOLERANCE_PRESETS };
