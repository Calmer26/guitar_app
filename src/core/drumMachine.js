/**
 * @module drumMachine
 * @description Drum accompaniment system using Tone.js
 *
 * Generates synchronized drum patterns that play along with musical exercises.
 * Supports multiple drum styles and integrates with PlaybackEngine tempo.
 */

import { EventEmitter } from '../utils/eventEmitter.js';
import { Logger } from '../utils/logger.js';

/**
 * DrumMachine - Generate and play drum patterns synchronized with playback
 *
 * Responsibilities:
 * - Create Tone.js drum synthesizers (kick, snare, hi-hat, etc.)
 * - Generate drum patterns for various styles
 * - Schedule drum hits on Tone.Transport
 * - Sync with PlaybackEngine tempo and time signature
 * - Provide volume/mix controls
 */
export class DrumMachine extends EventEmitter {
  /**
   * Initialize DrumMachine
   *
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    super();

    this.config = {
      drumVolume: config.drumVolume || 0.6,
      accentStrength: config.accentStrength || 1.2,
      ...config
    };

    // Drum voices (Tone.js synthesizers)
    this.kick = null;
    this.snare = null;
    this.hihat = null;
    this.crash = null;
    this.tom = null;

    // Pattern data
    this.currentStyle = 'rock';
    this.patterns = {};
    this.scheduledDrumEvents = [];

    Logger.log(Logger.INFO, 'DrumMachine', 'Initialized', {
      volume: this.config.drumVolume,
      accentStrength: this.config.accentStrength
    });
  }

  /**
   * Initialize drum synthesizers and load patterns
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Create drum synths
      this._createDrumSynths();

      // Load drum patterns (will be imported dynamically)
      await this._loadDrumPatterns();

      Logger.log(Logger.INFO, 'DrumMachine', 'Drum machine initialized successfully');
    } catch (error) {
      Logger.log(Logger.ERROR, 'DrumMachine', 'Failed to initialize drum machine', { error });
      throw error;
    }
  }

  /**
   * Reinitialize drum synthesizers after audio context activation
   * This is called when the audio context becomes available
   *
   * @returns {Promise<void>}
   */
  async reinitializeAudio() {
    try {
      Logger.log(Logger.INFO, 'DrumMachine', 'Reinitializing audio components after context activation');

      // Dispose existing synthesizers if they exist
      this._disposeSynths();

      // Recreate synthesizers with active audio context
      this._createDrumSynths();

      Logger.log(Logger.INFO, 'DrumMachine', 'Audio components reinitialized successfully');
    } catch (error) {
      Logger.log(Logger.ERROR, 'DrumMachine', 'Failed to reinitialize audio components', { error });
      throw error;
    }
  }

  /**
   * Create Tone.js drum synthesizers
   * @private
   */
  _createDrumSynths() {
    // Ensure Tone.js context is ready
    if (Tone && Tone.context && Tone.context.state !== 'running') {
      Logger.log(Logger.WARN, 'DrumMachine', 'Tone.js context not running, synthesizers may not work');
    }

    // Create a master volume node for all drums
    this.masterVolume = new Tone.Volume(this._volumeToDecibels(this.config.drumVolume)).toDestination();

    // Kick drum (bass drum)
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
    }).connect(this.masterVolume);

    // Snare drum
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
    }).connect(this.masterVolume);

    // Hi-hat (closed)
    this.hihat = new Tone.MetalSynth({
      frequency: 200,
      envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5
    }).connect(this.masterVolume);

    // Crash cymbal
    this.crash = new Tone.MetalSynth({
      frequency: 250,
      envelope: { attack: 0.001, decay: 1, release: 2 },
      harmonicity: 3.1,
      modulationIndex: 16,
      resonance: 3000,
      octaves: 1.5
    }).connect(this.masterVolume);

    // Tom (optional)
    this.tom = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.5, sustain: 0.1, release: 1 }
    }).connect(this.masterVolume);

    Logger.log(Logger.DEBUG, 'DrumMachine', 'Drum synthesizers created and connected to master volume');
  }

  /**
   * Dispose of existing synthesizers
   * @private
   */
  _disposeSynths() {
    // Dispose synthesizers
    if (this.kick) {
      this.kick.dispose();
      this.kick = null;
    }
    if (this.snare) {
      this.snare.dispose();
      this.snare = null;
    }
    if (this.hihat) {
      this.hihat.dispose();
      this.hihat = null;
    }
    if (this.crash) {
      this.crash.dispose();
      this.crash = null;
    }
    if (this.tom) {
      this.tom.dispose();
      this.tom = null;
    }

    // Dispose master volume
    if (this.masterVolume) {
      this.masterVolume.dispose();
      this.masterVolume = null;
    }

    Logger.log(Logger.DEBUG, 'DrumMachine', 'Existing synthesizers disposed');
  }

  /**
   * Load drum patterns dynamically
   * @private
   */
  async _loadDrumPatterns() {
    try {
      // Import drum patterns
      const { DRUM_PATTERNS } = await import('../data/drumPatterns.js');
      this.patterns = DRUM_PATTERNS;

      Logger.log(Logger.INFO, 'DrumMachine', '✅ LOADED drum patterns from drumPatterns.js file', {
        patternCount: Object.keys(this.patterns).length,
        availableStyles: Object.keys(this.patterns),
        rockPatternSubdivisions: this.patterns.rock?.subdivisions,
        rockPatternLength: this.patterns.rock?.pattern?.length
      });
    } catch (error) {
      Logger.log(Logger.ERROR, 'DrumMachine', '❌ FAILED to load drum patterns from file, using fallback', {
        error: error.message,
        errorStack: error.stack
      });
      // Create fallback patterns
      this._createFallbackPatterns();
    }
  }

  /**
   * Create basic fallback patterns if loading fails
   * @private
   */
  _createFallbackPatterns() {
    this.patterns = {
      rock: {
        name: 'Rock',
        description: 'Standard rock beat with quarter note rhythm',
        timeSignatures: ['4/4'],
        subdivisions: 4, // Quarter notes per measure (reduced from 8)
        pattern: [
          { kick: true, snare: false, hihat: true },   // Beat 1
          { kick: false, snare: true, hihat: true },   // Beat 2
          { kick: true, snare: false, hihat: true },   // Beat 3
          { kick: false, snare: true, hihat: true }    // Beat 4
        ]
      }
    };

    Logger.log(Logger.WARN, 'DrumMachine', '⚠️ USING FALLBACK drum patterns (4 subdivisions per measure)', {
      fallbackRockSubdivisions: this.patterns.rock.subdivisions,
      fallbackRockPatternLength: this.patterns.rock.pattern.length
    });
  }

  /**
   * Change drum pattern style
   *
   * @param {string} styleName - Name of the drum style
   */
  setStyle(styleName) {
    if (!this.patterns[styleName]) {
      Logger.log(Logger.WARN, 'DrumMachine', 'Unknown drum style', { styleName });
      return;
    }

    this.currentStyle = styleName;
    this.emit('drum:styleChanged', { style: styleName });

    Logger.log(Logger.INFO, 'DrumMachine', 'Drum style changed', { style: styleName });
  }

  /**
   * Schedule drum patterns for the entire exercise
   *
   * @param {Array} timeline - Exercise timeline
   * @param {number} tempo - BPM
   * @param {Object} timeSignature - Time signature object
   * @param {Object} upbeat - Upbeat information (optional)
   */
  scheduleDrums(timeline, tempo, timeSignature, upbeat = null) {
    // Store upbeat info for beat calculation
    this.upbeat = upbeat || { hasUpbeat: false, upbeatBeats: 0, startBeat: 1 };
    this.tempo = tempo;
    this.timeSignature = timeSignature;

    Logger.log(Logger.INFO, 'DrumMachine', '=== STARTING DRUM SCHEDULING ===', {
      timelineLength: timeline.length,
      tempo: tempo,
      timeSignature: timeSignature,
      upbeat: this.upbeat,
      transportState: Tone.Transport ? Tone.Transport.state : 'unknown',
      transportPosition: Tone.Transport ? Tone.Transport.position : 'unknown',
      audioContextState: Tone.context ? Tone.context.state : 'unknown'
    });

    // Clear previous schedule
    this._clearScheduledDrums();

    // Get pattern for current style
    const pattern = this.patterns[this.currentStyle];
    if (!pattern) {
      Logger.log(Logger.ERROR, 'DrumMachine', 'No pattern available for style', {
        style: this.currentStyle,
        availableStyles: Object.keys(this.patterns)
      });
      return;
    }

    // Calculate timing parameters
    const beatDuration = 60000 / tempo; // ms per beat
    const measureDuration = beatDuration * (timeSignature.beats || 4);
    const subdivisionDuration = beatDuration; // Each subdivision is a quarter note (beat)

    Logger.log(Logger.DEBUG, 'DrumMachine', 'Timing calculations', {
      beatDuration: beatDuration + 'ms',
      measureDuration: measureDuration + 'ms',
      subdivisionDuration: subdivisionDuration + 'ms',
      patternSubdivisions: pattern.subdivisions
    });

    // Schedule drum hits at regular intervals (independent of note timing)
    const exerciseDuration = timeline[timeline.length - 1]?.timestamp || 0;

    // Calculate total measures based on exercise duration and time signature
    const beatsPerMeasure = timeSignature.beats || 4;
    const totalMeasures = Math.ceil((exerciseDuration / 1000) / (60 / tempo) / beatsPerMeasure);
    const totalSubdivisions = totalMeasures * pattern.subdivisions;

    Logger.log(Logger.INFO, 'DrumMachine', 'Starting drum hit scheduling loop', {
      exerciseDuration: exerciseDuration + 'ms',
      totalMeasures: totalMeasures,
      totalSubdivisions: totalSubdivisions,
      patternLength: pattern.pattern.length
    });

    let currentTime = 0;
    let measureNumber = 0;
    let subdivisionIndex = 0;
    let scheduledHits = 0;

    // Schedule exactly the number of subdivisions needed for the musical structure
    while (subdivisionIndex < totalSubdivisions) {
      // Get the hit for this subdivision
      const hit = pattern.pattern[subdivisionIndex % pattern.pattern.length];

      if (hit) {
        Logger.log(Logger.DEBUG, 'DrumMachine', 'Scheduling drum hit', {
          time: currentTime + 'ms',
          measure: measureNumber,
          subdivision: subdivisionIndex,
          hit: hit
        });
        this._scheduleDrumHit(hit, currentTime, measureNumber, subdivisionIndex);
        scheduledHits++;
      }

      // Move to next subdivision
      currentTime += subdivisionDuration;
      subdivisionIndex++;

      // Check if we've completed a measure
      if (subdivisionIndex % pattern.subdivisions === 0) {
        measureNumber++;
      }
    }

    Logger.log(Logger.INFO, 'DrumMachine', '=== DRUM SCHEDULING COMPLETE ===', {
      style: this.currentStyle,
      measures: measureNumber,
      subdivisions: subdivisionIndex,
      scheduledHits: scheduledHits,
      duration: exerciseDuration + 'ms',
      scheduledEventsCount: this.scheduledDrumEvents.length,
      transportState: Tone.Transport ? Tone.Transport.state : 'unknown'
    });
  }

  /**
   * Schedule a single drum hit at specified time
   *
   * @param {Object} hit - Drum hit definition
   * @param {number} timeMs - Time in milliseconds
   * @param {number} measureNumber - Current measure number
   * @param {number} subdivisionIndex - Index within the pattern
   * @private
   */
  _scheduleDrumHit(hit, timeMs, measureNumber, subdivisionIndex) {
    const timeSeconds = timeMs / 1000;

    Logger.log(Logger.DEBUG, 'DrumMachine', 'Scheduling Transport event', {
      timeMs: timeMs + 'ms',
      timeSeconds: timeSeconds + 's',
      measureNumber: measureNumber,
      subdivisionIndex: subdivisionIndex,
      transportState: Tone.Transport ? Tone.Transport.state : 'unknown',
      transportPosition: Tone.Transport ? Tone.Transport.position : 'unknown',
      hit: hit
    });

    try {
      const eventId = Tone.Transport.schedule((time) => {
        // Calculate beat number with upbeat awareness
        const beatNumber = this._calculateBeatNumber(timeMs);
        
        Logger.log(Logger.DEBUG, 'DrumMachine', '=== TRANSPORT EVENT FIRED ===', {
          scheduledTime: timeSeconds + 's',
          actualTime: time,
          timeDifference: (time - timeSeconds) + 's',
          transportState: Tone.Transport ? Tone.Transport.state : 'unknown',
          transportPosition: Tone.Transport ? Tone.Transport.position : 'unknown',
          measureNumber: measureNumber,
          subdivisionIndex: subdivisionIndex,
          beatNumber: beatNumber,
          hit: hit
        });
        this._playDrumHit(hit, time, measureNumber, subdivisionIndex, beatNumber);
      }, timeSeconds);

      this.scheduledDrumEvents.push(eventId);

      Logger.log(Logger.DEBUG, 'DrumMachine', 'Transport event scheduled successfully', {
        eventId: eventId,
        scheduledTime: timeSeconds + 's',
        totalScheduledEvents: this.scheduledDrumEvents.length
      });

    } catch (error) {
      Logger.log(Logger.ERROR, 'DrumMachine', 'Failed to schedule Transport event', {
        error: error.message,
        timeMs: timeMs,
        timeSeconds: timeSeconds,
        hit: hit
      });
    }
  }

  /**
   * Play a single drum hit
   *
   * @param {Object} hit - Drum hit definition
   * @param {number} time - Web Audio context time
   * @param {number} measureNumber - Current measure number
   * @param {number} hitIndex - Index within the pattern
   * @param {number} beatNumber - Calculated beat number (1-based)
   * @private
   */
  _playDrumHit(hit, time, measureNumber, hitIndex, beatNumber) {
    Logger.log(Logger.DEBUG, 'DrumMachine', 'Playing drum hit', {
      hit: hit,
      time: time,
      measureNumber: measureNumber,
      hitIndex: hitIndex,
      beatNumber: beatNumber,
      audioContextState: Tone.context ? Tone.context.state : 'unknown',
      transportState: Tone.Transport ? Tone.Transport.state : 'unknown'
    });

    try {
      // Play kick drum
      if (hit.kick) {
        // Accent first beat of measure
        const isDownbeat = hitIndex === 0;
        const velocity = isDownbeat ? this.config.accentStrength : 1.0;
        if (this.kick) {
          this.kick.triggerAttackRelease('C1', '8n', time, velocity);
          Logger.log(Logger.DEBUG, 'DrumMachine', 'Kick triggered', { time, velocity, isDownbeat });
        } else {
          Logger.log(Logger.ERROR, 'DrumMachine', 'Kick synthesizer not available');
        }
      }

      // Play snare drum
      if (hit.snare) {
        if (this.snare) {
          this.snare.triggerAttackRelease('8n', time);
          Logger.log(Logger.DEBUG, 'DrumMachine', 'Snare triggered', { time });
        } else {
          Logger.log(Logger.ERROR, 'DrumMachine', 'Snare synthesizer not available');
        }
      }

      // Play hi-hat
      if (hit.hihat) {
        if (this.hihat) {
          this.hihat.triggerAttackRelease('16n', time);
          Logger.log(Logger.DEBUG, 'DrumMachine', 'Hi-hat triggered', { time });
        } else {
          Logger.log(Logger.ERROR, 'DrumMachine', 'Hi-hat synthesizer not available');
        }
      }

      // Play crash on first beat of first measure
      if (hit.crash || (hit.kick && measureNumber === 0 && hitIndex === 0)) {
        if (this.crash) {
          this.crash.triggerAttackRelease('2n', time);
          Logger.log(Logger.DEBUG, 'DrumMachine', 'Crash triggered', { time, measureNumber, hitIndex });
        } else {
          Logger.log(Logger.ERROR, 'DrumMachine', 'Crash synthesizer not available');
        }
      }

      // Play tom (if defined in pattern)
      if (hit.tom) {
        if (this.tom) {
          this.tom.triggerAttackRelease('F3', '8n', time);
          Logger.log(Logger.DEBUG, 'DrumMachine', 'Tom triggered', { time });
        } else {
          Logger.log(Logger.ERROR, 'DrumMachine', 'Tom synthesizer not available');
        }
      }

      // Emit beat event for visual feedback
      this.emit('drum:beat', {
        measure: measureNumber,
        beat: hitIndex,
        beatNumber: beatNumber, // NEW: Include calculated beat number
        time: time
      });

      Logger.log(Logger.DEBUG, 'DrumMachine', 'Drum hit completed successfully');

    } catch (error) {
      Logger.log(Logger.ERROR, 'DrumMachine', 'Error playing drum hit', { error, hit, time });
    }
  }

  /**
   * Calculate which beat number to display based on timestamp and upbeat info
   * 
   * @param {number} timestamp - Current timestamp in ms
   * @returns {number} Beat number to display (1-based)
   * @private
   */
  _calculateBeatNumber(timestamp) {
    if (!this.upbeat || !this.timeSignature || !this.tempo) {
      return 1; // Fallback
    }

    const beatDurationMs = (60000 / this.tempo) * (4 / this.timeSignature.beatType);
    const beatsPerMeasure = this.timeSignature.beats;
    
    // If we have an upbeat, we need to adjust the beat calculation
    if (this.upbeat.hasUpbeat) {
      const upbeatDurationMs = this.upbeat.upbeatBeats * beatDurationMs;
      
      if (timestamp < upbeatDurationMs) {
        // We're in the upbeat measure - calculate which beat of the upbeat
        const beatInUpbeat = Math.floor(timestamp / beatDurationMs);
        const calculatedBeat = this.upbeat.startBeat + beatInUpbeat;
        
        Logger.log(Logger.DEBUG, 'DrumMachine', 'Beat calculation (upbeat)', {
          timestamp: timestamp + 'ms',
          upbeatDurationMs: upbeatDurationMs + 'ms',
          beatInUpbeat: beatInUpbeat,
          startBeat: this.upbeat.startBeat,
          calculatedBeat: calculatedBeat
        });
        
        return calculatedBeat;
      } else {
        // After upbeat - adjust time by subtracting upbeat duration
        const adjustedTime = timestamp - upbeatDurationMs;
        const beatNumber = Math.floor(adjustedTime / beatDurationMs) % beatsPerMeasure + 1;
        
        Logger.log(Logger.DEBUG, 'DrumMachine', 'Beat calculation (post-upbeat)', {
          timestamp: timestamp + 'ms',
          adjustedTime: adjustedTime + 'ms',
          beatNumber: beatNumber
        });
        
        return beatNumber;
      }
    }
    
    // No upbeat - normal calculation
    const beatNumber = Math.floor(timestamp / beatDurationMs) % beatsPerMeasure + 1;
    
    Logger.log(Logger.DEBUG, 'DrumMachine', 'Beat calculation (no upbeat)', {
      timestamp: timestamp + 'ms',
      beatNumber: beatNumber
    });
    
    return beatNumber;
  }

  /**
   * Clear all scheduled drum events
   * @private
   */
  _clearScheduledDrums() {
    this.scheduledDrumEvents.forEach(eventId => {
      Tone.Transport.clear(eventId);
    });
    this.scheduledDrumEvents = [];

    Logger.log(Logger.DEBUG, 'DrumMachine', 'Cleared scheduled drum events');
  }

  /**
   * Set master drum volume
   *
   * @param {number} volume - Volume level (0.0 to 1.0)
   */
  setVolume(volume) {
    if (volume < 0 || volume > 1) {
      Logger.log(Logger.WARN, 'DrumMachine', 'Invalid volume', { volume });
      return;
    }

    this.config.drumVolume = volume;
    const volumeDb = this._volumeToDecibels(volume);

    // Update master volume node
    if (this.masterVolume) {
      this.masterVolume.volume.value = volumeDb;
    }

    this.emit('drum:volumeChanged', { volume });

    Logger.log(Logger.DEBUG, 'DrumMachine', 'Volume changed', { volume, volumeDb });
  }

  /**
   * Convert volume (0-1) to decibels
   *
   * @param {number} volume - Linear volume (0-1)
   * @returns {number} Volume in decibels
   * @private
   */
  _volumeToDecibels(volume) {
    if (volume <= 0) return -Infinity;
    if (volume >= 1) return 0;
    return 20 * Math.log10(volume) * 3; // *3 to scale to -60 range
  }

  /**
   * Get available drum styles
   *
   * @returns {Array} Array of style names
   */
  getAvailableStyles() {
    return Object.keys(this.patterns);
  }

  /**
   * Get current drum style info
   *
   * @returns {Object} Current style information
   */
  getCurrentStyle() {
    return {
      name: this.currentStyle,
      pattern: this.patterns[this.currentStyle]
    };
  }

  /**
   * Check if drum machine is ready
   *
   * @returns {boolean} True if initialized and patterns loaded
   */
  isReady() {
    return this.kick !== null && Object.keys(this.patterns).length > 0;
  }

  /**
   * Destroy drum machine and cleanup
   */
  destroy() {
    this._clearScheduledDrums();

    // Dispose synthesizers
    if (this.kick) this.kick.dispose();
    if (this.snare) this.snare.dispose();
    if (this.hihat) this.hihat.dispose();
    if (this.crash) this.crash.dispose();
    if (this.tom) this.tom.dispose();

    // Dispose master volume
    if (this.masterVolume) this.masterVolume.dispose();

    this.removeAllListeners();

    Logger.log(Logger.INFO, 'DrumMachine', 'Destroyed');
  }
}
