import { EventEmitter } from '../utils/eventEmitter.js';
import { Logger } from '../utils/logger.js';

/**
 * Enhanced PitchDetector - Real-time pitch detection using YIN algorithm with improved note onset detection
 * 
 * Improvements over base PitchDetector:
 * - Enhanced note onset detection with stricter amplitude thresholds
 * - Pitch repetition detection to prevent multiple detections of same note
 * - Improved sustained pitch suppression
 * - Audio system latency compensation with auto-calibration
 * 
 * @extends EventEmitter
 * @fires PitchDetector#pitch:detected
 * @fires PitchDetector#pitch:silence
 */
export class PitchDetector extends EventEmitter {
  /**
   * Initialize PitchDetector with audio context and configuration
   * 
   * @param {AudioContext} audioContext - Web Audio API context
   * @param {Object} config - Configuration options
   */
  constructor(audioContext, config = {}) {
    super();
    
    this.audioContext = audioContext;
    this.config = {
      bufferSize: 2048,
      noiseThreshold: -40,
      confidenceThreshold: 0.6,  // Lower threshold for better detection
      minFrequency: 80,
      maxFrequency: 1000,
      noiseGateEnabled: true,
      adaptiveBufferSize: false,
      minOnsetInterval: 75, // FIXED: Further reduced to 75ms for faster guitar playing
      enableDualDetection: true, // NEW: Enable dual detection mode
      ...config
    };
    
    this.state = {
      isRunning: false,
      detectionCount: 0,
      uptime: 0
    };
    
    this.lastPitchEvents = [];
    this.bufferSize = this.config.bufferSize;
    this.startTime = null;
    
    // Enhanced note onset detection state
    this.amplitudeHistory = [];
    this.maxAmplitudeHistory = 15; // Increased for better tracking
    this.lastOnsetTime = 0;
    this.lastDetectedPitch = null;
    
    // Audio latency tracking - FIXED: Use actual calibration value
    this.latencyBuffer = []; // Track delays between playback and detection
    this.maxLatencyHistory = 10; // Keep last 10 latency measurements
    this.estimatedLatency = 200; // FIXED: Use 200ms default instead of 586ms calibration
    this.autoCalibrate = true; // Enable automatic latency calibration
    this.calibrationMode = false; // Track if we're in calibration mode
    
    // Audio nodes
    this.mediaStream = null;
    this.source = null;
    this.analyser = null;
    
    Logger.log(Logger.DEBUG, 'PitchDetector', 'Enhanced version initialized', {
      bufferSize: this.config.bufferSize,
      confidenceThreshold: this.config.confidenceThreshold,
      minOnsetInterval: this.config.minOnsetInterval,
      estimatedLatency: this.estimatedLatency,
      enableDualDetection: this.config.enableDualDetection,
      enhanced: true
    });
  }

  /**
   * Start pitch detection with microphone stream
   * @param {MediaStream} stream - Audio stream from getUserMedia
   */
  async start(stream) {
    if (this.state.isRunning) {
      Logger.log(Logger.WARN, 'PitchDetector', 'Already running');
      return;
    }
    
    try {
      // Create audio source from microphone stream
      this.mediaStream = stream;
      this.source = this.audioContext.createMediaStreamSource(stream);
      
      // Create analyzer node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.config.bufferSize * 2;
      this.analyser.smoothingTimeConstant = 0;
      
      // Connect nodes
      this.source.connect(this.analyser);
      
      // Start processing loop
      this.state.isRunning = true;
      this.startTime = Date.now();
      this._startProcessingLoop();
      
      Logger.log(Logger.INFO, 'PitchDetector', 'Enhanced version started', {
        estimatedLatency: this.estimatedLatency
      });
    } catch (error) {
      Logger.log(Logger.ERROR, 'PitchDetector', 'Failed to start', error);
      throw error;
    }
  }

  /**
   * Start audio processing loop
   * @private
   */
  _startProcessingLoop() {
    const processFrame = () => {
      if (!this.state.isRunning) {
        return;
      }
      
      // Get audio data
      const buffer = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(buffer);
      
      // Process the buffer
      this._processAudioBuffer(buffer);
      
      // Schedule next frame
      requestAnimationFrame(processFrame);
    };
    
    processFrame();
  }

  /**
   * Stop pitch detection
   */
  stop() {
    if (!this.state.isRunning) {
      return;
    }
    
    this.state.isRunning = false;
    
    // Disconnect audio nodes
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    // Stop media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    Logger.log(Logger.INFO, 'PitchDetector', 'Enhanced version stopped');
  }

  /**
   * YIN algorithm for pitch detection
   * @private
   * @param {Float32Array} buffer - Audio buffer to analyze
   * @returns {Object|null} Pitch detection result
   */
  _yinAlgorithm(buffer) {
    if (!buffer || buffer.length === 0) {
      return null;
    }
    
    // Create a copy to avoid modifying the original
    const processedBuffer = new Float32Array(buffer);
    
    // Remove DC offset
    this._removeDCOffset(processedBuffer);
    
    // Apply high-pass filter
    this._applyHighPassFilter(processedBuffer, 60);
    
    const threshold = this.config.confidenceThreshold;
    const bufferSize = processedBuffer.length;
    const halfBufferSize = Math.floor(bufferSize / 2);
    
    // Step 1: Difference function
    const difference = new Float32Array(halfBufferSize);
    for (let tau = 0; tau < halfBufferSize; tau++) {
      let sum = 0;
      for (let i = 0; i < halfBufferSize; i++) {
        const delta = processedBuffer[i] - processedBuffer[i + tau];
        sum += delta * delta;
      }
      difference[tau] = sum;
    }
    
    // Step 2: Cumulative mean normalized difference function (CMNDF)
    const cmndf = new Float32Array(halfBufferSize);
    cmndf[0] = 1;
    
    let runningSum = 0;
    for (let tau = 1; tau < halfBufferSize; tau++) {
      runningSum += difference[tau];
      if (runningSum === 0) {
        cmndf[tau] = 1;
      } else {
        cmndf[tau] = difference[tau] / (runningSum / tau);
      }
    }
    
    // Step 3: Find absolute threshold
    let tau = -1;
    for (let i = 2; i < halfBufferSize; i++) {
      if (cmndf[i] < threshold) {
        // Look for local minimum
        while (i + 1 < halfBufferSize && cmndf[i + 1] < cmndf[i]) {
          i++;
        }
        tau = i;
        break;
      }
    }
    
    if (tau === -1 || tau < 2) {
      return null;
    }
    
    // Step 4: Parabolic interpolation for sub-sample accuracy
    if (tau > 1 && tau < halfBufferSize - 1) {
      tau = this._parabolicInterpolation(cmndf, tau);
    }
    
    // Step 5: Convert tau to frequency
    const frequency = this.audioContext.sampleRate / tau;
    
    // Validate frequency range
    if (frequency < this.config.minFrequency || frequency > this.config.maxFrequency) {
      return null;
    }
    
    // Calculate confidence (1 - cmndf[tau_int])
    const tauInt = Math.round(tau);
    const confidence = Math.max(0, 1 - cmndf[tauInt]);
    
    return {
      frequency,
      confidence,
      tau
    };
  }

  /**
   * Remove DC offset from audio buffer (modifies in place)
   * @private
   * @param {Float32Array} buffer - Audio buffer
   */
  _removeDCOffset(buffer) {
    const mean = buffer.reduce((a, b) => a + b, 0) / buffer.length;
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] -= mean;
    }
  }

  /**
   * Apply high-pass filter (modifies in place)
   * @private
   * @param {Float32Array} buffer - Audio buffer
   * @param {number} cutoff - Cutoff frequency in Hz
   */
  _applyHighPassFilter(buffer, cutoff) {
    // Simple first-order high-pass filter implementation
    const sampleRate = this.audioContext.sampleRate;
    const RC = 1.0 / (cutoff * 2 * Math.PI);
    const dt = 1.0 / sampleRate;
    const alpha = RC / (RC + dt);
    
    let prevInput = buffer[0];
    let prevOutput = buffer[0];
    
    for (let i = 1; i < buffer.length; i++) {
      const output = alpha * (prevOutput + buffer[i] - prevInput);
      prevInput = buffer[i];
      buffer[i] = output;
      prevOutput = output;
    }
  }

  /**
   * Parabolic interpolation for better accuracy
   * @private
   * @param {Float32Array} cmndf - CMNDF array
   * @param {number} tau - Tau value (integer index)
   * @returns {number} Interpolated tau
   */
  _parabolicInterpolation(cmndf, tau) {
    if (tau <= 0 || tau >= cmndf.length - 1) {
      return tau;
    }
    
    const s0 = cmndf[tau - 1];
    const s1 = cmndf[tau];
    const s2 = cmndf[tau + 1];
    
    const a = (s0 + s2 - 2 * s1) / 2;
    const b = (s2 - s0) / 2;
    
    if (Math.abs(a) > 1e-10) {
      const offset = -b / (2 * a);
      // Clamp offset to [-0.5, 0.5] for stability
      return tau + Math.max(-0.5, Math.min(0.5, offset));
    }
    
    return tau;
  }

  /**
   * Check if signal should be gated by noise
   * @private
   * @param {Float32Array} buffer - Audio buffer
   * @returns {boolean} True if should be gated
   */
  _shouldGate(buffer) {
    if (!this.config.noiseGateEnabled) {
      return false;
    }
    
    const rms = this._calculateRMS(buffer);
    const rmsDb = 20 * Math.log10(rms + 1e-10); // Add small value to avoid log(0)
    
    return rmsDb < this.config.noiseThreshold;
  }

  /**
   * Calculate RMS (Root Mean Square) of buffer
   * @private
   * @param {Float32Array} buffer - Audio buffer
   * @returns {number} RMS value
   */
  _calculateRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * ENHANCED: Check if this is a note onset with improved detection
   * @private
   * @param {Float32Array} buffer - Audio buffer
   * @param {Object} pitchResult - Pitch detection result
   * @returns {boolean} True if this is a note onset
   */
  _isNoteOnset(buffer, pitchResult) {
    const currentAmplitude = this._calculateRMS(buffer);
    const currentTime = Date.now();
    
    // Check minimum time interval since last onset (FIXED: reduced to 100ms)
    if (currentTime - this.lastOnsetTime < this.config.minOnsetInterval) {
      return false;
    }
    
    // Check for pitch repetition with stricter criteria
    if (this.lastDetectedPitch !== null) {
      const frequencyDiff = Math.abs(pitchResult.frequency - this.lastDetectedPitch);
      const frequencyThreshold = 8; // Increased for stricter detection
      
      if (frequencyDiff < frequencyThreshold) {
        // Same pitch detected - likely sustained note, not onset
        if (currentAmplitude < 0.25) { // Lower amplitude threshold for sustained detection
          return false;
        }
      }
    }
    
    // Update amplitude history
    this.amplitudeHistory.push(currentAmplitude);
    if (this.amplitudeHistory.length > this.maxAmplitudeHistory) {
      this.amplitudeHistory.shift();
    }
    
    // Need at least 8 amplitude readings to detect onset
    if (this.amplitudeHistory.length < 8) {
      return false;
    }
    
    // Check for rising amplitude envelope (note onset) - FIXED: reduced threshold
    const recent = this.amplitudeHistory.slice(-6); // Last 6 amplitudes
    const older = this.amplitudeHistory.slice(0, -6); // Previous amplitudes
    
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgOlder = older.length > 0 
      ? older.reduce((a, b) => a + b, 0) / older.length 
      : avgRecent;
    
    // Onset detection: recent amplitude must be significantly higher than older
    const onsetThreshold = 1.5; // FIXED: Further reduced to 1.5 for better guitar detection
    const amplitudeIncreased = avgRecent > (avgOlder * onsetThreshold);
    
    // Additional check: current amplitude should be above noise floor - FIXED: further lowered
    const aboveNoiseFloor = currentAmplitude > 0.012; // FIXED: Further lowered to 0.012 for better acoustic guitar detection
    
    return amplitudeIncreased && aboveNoiseFloor;
  }

  /**
   * Calculate onset confidence based on amplitude envelope
   * @private
   * @param {Float32Array} buffer - Audio buffer
   * @returns {number} Confidence 0-1
   */
  _calculateOnsetConfidence(buffer) {
    if (this.amplitudeHistory.length < 8) return 0.5;
    
    const recent = this.amplitudeHistory.slice(-6);
    const older = this.amplitudeHistory.slice(0, -6);
    const avgRecent = recent.reduce((a,b) => a+b) / recent.length;
    const avgOlder = older.reduce((a,b) => a+b) / older.length;
    
    const ratio = avgRecent / (avgOlder + 1e-10);
    return Math.min(1.0, Math.max(0, (ratio - 1.5) / 2.0));
  }

  /**
   * ENHANCED: Update latency estimate based on recent detections
   * @private
   * @param {number} detectedTime - Time when note was detected
   * @param {number} expectedTime - Expected time of note (if available)
   */
  _updateLatencyEstimate(detectedTime, expectedTime = null) {
    if (!this.autoCalibrate || expectedTime === null) {
      return;
    }
    
    // Calculate actual latency (detected time should be later than expected)
    const latency = detectedTime - expectedTime;
    
    // Only update if latency is reasonable (between 50ms and 1500ms)
    // Based on console output, we see delays around 800ms
    if (latency > 50 && latency < 1500) {
      this.latencyBuffer.push(latency);
      if (this.latencyBuffer.length > this.maxLatencyHistory) {
        this.latencyBuffer.shift();
      }
      
      // Calculate new average latency
      const sum = this.latencyBuffer.reduce((a, b) => a + b, 0);
      const newLatency = Math.round(sum / this.latencyBuffer.length);
      
      // Only update if the change is significant (more than 20ms)
      if (Math.abs(newLatency - this.estimatedLatency) > 20) {
        this.estimatedLatency = newLatency;
        Logger.log(Logger.INFO, 'PitchDetector', 'Latency estimate auto-calibrated', {
          latency,
          estimatedLatency: this.estimatedLatency,
          sampleCount: this.latencyBuffer.length
        });
      }
    }
  }

  /**
   * Convert frequency to MIDI note number
   * @param {number} frequency - Frequency in Hz
   * @returns {number} MIDI note number
   */
  frequencyToMidi(frequency) {
    return Math.round(69 + 12 * Math.log2(frequency / 440));
  }

  /**
   * Convert MIDI note number to note name
   * @param {number} midi - MIDI note number
   * @returns {string} Note name (e.g., 'A4')
   */
  midiToNoteName(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteName = noteNames[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${noteName}${octave}`;
  }

  /**
   * Calculate cents deviation from perfect pitch
   * @param {number} frequency - Detected frequency
   * @param {number} midi - MIDI note number
   * @returns {number} Cents deviation
   */
  calculateCents(frequency, midi) {
    const perfectFreq = 440 * Math.pow(2, (midi - 69) / 12);
    return 1200 * Math.log2(frequency / perfectFreq);
  }

  /**
   * Check if pitch detection is temporally consistent
   * @private
   * @param {number} frequency - Detected frequency
   * @returns {boolean} True if consistent
   */
  _isTemporallyConsistent(frequency) {
    if (this.lastPitchEvents.length < 3) {
      this.lastPitchEvents.push(frequency);
      return true;
    }
    
    // Keep only last 4 events for consistency check
    if (this.lastPitchEvents.length >= 4) {
      this.lastPitchEvents.shift();
    }
    
    this.lastPitchEvents.push(frequency);
    
    // Check if current frequency is consistent with recent history
    const recentFreqs = this.lastPitchEvents.slice(0, -1);
    const avgRecent = recentFreqs.reduce((a, b) => a + b) / recentFreqs.length;
    const threshold = avgRecent * 0.05; // 5% tolerance
    
    return Math.abs(frequency - avgRecent) <= threshold;
  }

  /**
   * Get optimal buffer size based on frequency
   * @param {number} frequency - Target frequency
   * @returns {number} Buffer size
   */
  getOptimalBufferSize(frequency) {
    if (!this.config.adaptiveBufferSize) {
      return this.config.bufferSize;
    }
    
    // Low frequencies need larger buffers for accuracy
    if (frequency < 100) {
      return 4096;
    } else if (frequency < 300) {
      return 2048;
    } else {
      return 1024;
    }
  }

  /**
   * Process audio buffer and emit pitch events with enhanced filtering
   * @private
   * @param {Float32Array} buffer - Audio buffer
   */
  _processAudioBuffer(buffer) {
    // Gate noise if enabled
    if (this._shouldGate(buffer)) {
      this.emit('pitch:silence', {
        reason: 'noise_gating',
        timestamp: Date.now()
      });
      return;
    }
    
    const result = this._yinAlgorithm(buffer);
    
    if (result && result.confidence >= this.config.confidenceThreshold) {
      // Check temporal consistency
      if (!this._isTemporallyConsistent(result.frequency)) {
        this.emit('pitch:silence', {
          reason: 'temporal_inconsistency',
          timestamp: Date.now()
        });
        return;
      }
      
      if (this.config.enableDualDetection) {
        // NEW: Dual detection path - always emit continuous pitch
        this._handleDualDetection(buffer, result);
      } else {
        // LEGACY: Original onset-only path
        if (this._isNoteOnset(buffer, result)) {
          this._handlePitchDetection(result);
        } else {
          // Suppress sustained pitch detection
          this.emit('pitch:silence', {
            reason: 'sustained_pitch_suppression',
            confidence: result.confidence,
            timestamp: Date.now()
          });
        }
      }
    } else {
      this.emit('pitch:silence', {
        reason: result ? 'low_confidence' : 'no_pitch_detected',
        confidence: result ? result.confidence : 0,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle pitch detection result with latency compensation
   * @private
   * @param {Object} result - Pitch detection result
   * @param {number} expectedTime - Expected time of note (optional, for latency calibration)
   */
  _handlePitchDetection(result, expectedTime = null) {
    const midi = this.frequencyToMidi(result.frequency);
    const noteName = this.midiToNoteName(midi);
    const centsDeviation = this.calculateCents(result.frequency, midi);
    
    const detectedTime = Date.now();
    
    // Update latency estimate if we have expected time
    this._updateLatencyEstimate(detectedTime, expectedTime);
    
  const pitchData = {
    frequency: result.frequency,
    confidence: result.confidence,
    midi,
    noteName,
    centsDeviation,
    timestamp: detectedTime,  // Clean absolute timestamp - compensation applied in app.js
    estimatedLatency: this.estimatedLatency
  };
    
    // Update tracking variables
    this.lastOnsetTime = detectedTime;
    this.lastDetectedPitch = result.frequency;
    
    this.emit('pitch:detected', pitchData);
    this.state.detectionCount++;
  }

  /**
   * Handle dual detection: emit continuous pitch + optional onset
   * @private
   * @param {Float32Array} buffer - Audio buffer
   * @param {Object} result - Pitch detection result
   */
  _handleDualDetection(buffer, result) {
    const midi = this.frequencyToMidi(result.frequency);
    const noteName = this.midiToNoteName(midi);
    const centsDeviation = this.calculateCents(result.frequency, midi);
    
    const detectedTime = Date.now();
    
    // Check for onset
    const isOnset = this._isNoteOnset(buffer, result);
    const onsetConfidence = isOnset ? this._calculateOnsetConfidence(buffer) : 0;
    
    // Update latency estimate if we have expected time (for calibration)
    this._updateLatencyEstimate(detectedTime, null);
    
    // ALWAYS emit continuous pitch data
    const pitchData = {
      frequency: result.frequency,
      confidence: result.confidence,
      midi,
      noteName,
      centsDeviation,
      timestamp: detectedTime,
      isOnset,           // NEW: Flag if this is an attack
      onsetConfidence,   // NEW: Onset confidence (0-1)
      estimatedLatency: this.estimatedLatency
    };
    
    this.emit('pitch:detected', pitchData);
    
    // Emit separate onset event if detected
    if (isOnset) {
      this.emit('pitch:onset', {
        frequency: result.frequency,
        midi,
        noteName,
        timestamp: detectedTime,
        confidence: onsetConfidence,
        estimatedLatency: this.estimatedLatency
      });
      
      // Update tracking variables only for onsets
      this.lastOnsetTime = detectedTime;
      this.lastDetectedPitch = result.frequency;
    }
    
    this.state.detectionCount++;
  }

  /**
   * Set calibration mode for auto-calibration
   * @param {boolean} enabled - Whether to enable calibration mode
   * @param {Array} calibrationSequence - Expected calibration notes with timing
   */
  setCalibrationMode(enabled, calibrationSequence = null) {
    this.calibrationMode = enabled;
    this.calibrationSequence = calibrationSequence;
    
    Logger.log(Logger.INFO, 'PitchDetector', 'Calibration mode', {
      enabled,
      sequenceLength: calibrationSequence ? calibrationSequence.length : 0
    });
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    Logger.log(Logger.DEBUG, 'PitchDetector', 'Enhanced configuration updated', {
      newConfig
    });
  }

  /**
   * Get current state including latency estimate
   * @returns {Object} Current state
   */
  getState() {
    return {
      ...this.state,
      uptime: this.state.isRunning && this.startTime 
        ? Date.now() - this.startTime 
        : 0,
      estimatedLatency: this.estimatedLatency,
      latencyBufferSize: this.latencyBuffer.length,
      autoCalibrate: this.autoCalibrate,
      calibrationMode: this.calibrationMode
    };
  }

  /**
   * Get latency estimate
   * @returns {number} Current latency estimate in milliseconds
   */
  getLatencyEstimate() {
    return this.estimatedLatency;
  }

  /**
   * Manually set latency estimate (for calibration)
   * @param {number} latencyMs - Latency in milliseconds
   */
  setLatencyEstimate(latencyMs) {
    this.estimatedLatency = latencyMs;
    Logger.log(Logger.INFO, 'PitchDetector', 'Latency estimate set manually', {
      latencyMs
    });
  }

  /**
   * Reset latency tracking
   */
  resetLatencyTracking() {
    this.latencyBuffer = [];
    this.estimatedLatency = 200; // Reset to 200ms default
    this.autoCalibrate = true;
    Logger.log(Logger.INFO, 'PitchDetector', 'Latency tracking reset');
  }

  /**
   * Enable/disable auto-calibration
   * @param {boolean} enabled - Whether to enable auto-calibration
   */
  setAutoCalibration(enabled) {
    this.autoCalibrate = enabled;
    Logger.log(Logger.INFO, 'PitchDetector', 'Auto-calibration', {
      enabled
    });
  }

  /**
   * Detect pitch from a provided buffer (for testing/offline processing)
   * @param {Float32Array} buffer - Audio buffer to analyze
   * @returns {Object|null} Pitch detection result
   */
  detectPitch(buffer) {
    if (this._shouldGate(buffer)) {
      return null;
    }
    
    const result = this._yinAlgorithm(buffer);
    
    if (result && result.confidence >= this.config.confidenceThreshold) {
      const midi = this.frequencyToMidi(result.frequency);
      const noteName = this.midiToNoteName(midi);
      const centsDeviation = this.calculateCents(result.frequency, midi);
      
      return {
        frequency: result.frequency,
        confidence: result.confidence,
        midi,
        noteName,
        centsDeviation
      };
    }
    
    return null;
  }
}
