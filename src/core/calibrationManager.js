/**
 * @module calibrationManager
 * @description Audio latency calibration using user's selected instrument
 * 
 * Implements pre-practice calibration system that:
 * 1. Plays calibration tone using user's selected instrument/sample (more accurate)
 * 2. Measures detection latency 
 * 3. Stores result in settings for auto-calibration
 * 4. Provides fallback if measurement fails
 * 
 * M14: Integrated with PlaybackEngine for consistent audio routing
 * IMPROVED: Uses user's actual instrument selection for accurate latency measurement
 * FIXED: Captures user settings even before PlaybackEngine is created
 */

import { EventEmitter } from '../utils/eventEmitter.js';
import { Logger } from '../utils/logger.js';

export class CalibrationManager extends EventEmitter {
  /**
   * Initialize calibration manager
   * @param {Object} settingsManager - Settings manager instance
   * @param {Object} pitchDetector - Pitch detector instance
   * @param {Object} playbackEngine - PlaybackEngine instance for consistent audio routing
   */
  constructor(settingsManager, pitchDetector, playbackEngine = null) {
    super();
    
    this.settingsManager = settingsManager;
    this.pitchDetector = pitchDetector;
    this.playbackEngine = playbackEngine;
    
    // NEW: Store user instrument settings for calibration even before PlaybackEngine exists
    this.userInstrumentSettings = {
      instrument: 'acoustic',
      mode: 'synth'
    };
    
    this.isCalibrating = false;
    this.tonePlayer = null;
    
    Logger.log(Logger.DEBUG, 'CalibrationManager', 'Calibration manager initialized', {
      hasPlaybackEngine: !!playbackEngine,
      userSettings: this.userInstrumentSettings
    });
  }

  /**
   * Set user's instrument settings for calibration
   * @param {Object} settings - User's instrument selection
   */
  setUserInstrumentSettings(settings) {
    if (settings) {
      this.userInstrumentSettings = {
        ...this.userInstrumentSettings,
        ...settings
      };
      
      Logger.log(Logger.INFO, 'CalibrationManager', 'User instrument settings updated', {
        settings: this.userInstrumentSettings
      });
    }
  }

  /**
   * Check if calibration is available
   * @returns {boolean} True if calibration can be performed
   */
  isCalibrationAvailable() {
    return this.pitchDetector !== null && this._hasAudioContext();
  }

  /**
   * Check if audio context is available
   * @returns {boolean} True if audio context available
   * @private
   */
  _hasAudioContext() {
    // Check if we have PlaybackEngine with Tone.js context
    if (this.playbackEngine && this.playbackEngine.synthesizer) {
      return true;
    }
    
    // Fallback to our own audio context
    return this.audioContext !== null;
  }

  /**
   * Get audio context (Tone.js from PlaybackEngine or fallback AudioContext)
   * @returns {AudioContext} Audio context instance
   * @private
   */
  _getAudioContext() {
    // Use PlaybackEngine's Tone.js context if available
    if (this.playbackEngine && window.Tone && window.Tone.context) {
      return window.Tone.context;
    }
    
    // Fallback to our own audio context
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    return this.audioContext;
  }

  /**
   * Start audio latency calibration process
   * @returns {Promise<Object>} Calibration result
   */
  async startCalibration() {
    if (this.isCalibrating) {
      throw new Error('Calibration already in progress');
    }
    
    this.isCalibrating = true;
    
    try {
      this.emit('calibration:started');
      
      // Get current latency estimate from pitch detector
      const currentLatency = this.pitchDetector.getLatencyEstimate();
      
      Logger.log(Logger.INFO, 'CalibrationManager', 'Starting calibration with user settings', {
        currentLatency,
        usingPlaybackEngine: !!this.playbackEngine,
        userInstrument: this.userInstrumentSettings.instrument,
        userMode: this.userInstrumentSettings.mode
      });
      
      // Step 1: Create calibration tone using user's selected instrument
      const toneStartTime = Date.now();
      const calibrationTone = await this._createCalibrationTone();
      
      this.emit('calibration:tone_playing', { 
        expectedDuration: calibrationTone.duration,
        startTime: toneStartTime,
        audioPath: this.playbackEngine ? 'playbackEngine' : 'userSettings',
        instrument: calibrationTone.instrument,
        mode: calibrationTone.mode
      });
      
      // Step 2: Wait for detection
      const detection = await this._waitForDetection(toneStartTime, 3000);
      
      // Step 3: Calculate latency
      const measuredLatency = this._calculateLatency(toneStartTime, detection.timestamp);
      
      // Step 4: Save result
      await this._saveCalibrationResult(measuredLatency, detection.confidence);
      
      // Step 5: Update pitch detector
      await this._updatePitchDetector(measuredLatency);
      
      const result = {
        success: true,
        measuredLatency: measuredLatency,
        confidence: detection.confidence,
        isReliable: this._isReliableMeasurement(measuredLatency, detection.confidence),
        audioPath: this.playbackEngine ? 'playbackEngine' : 'userSettings',
        instrument: calibrationTone.instrument,
        mode: calibrationTone.mode,
        method: calibrationTone.method,
        timestamp: Date.now()
      };
      
      this.emit('calibration:complete', { result });
      
      Logger.log(Logger.INFO, 'CalibrationManager', 'Calibration completed with user settings', result);
      
      return result;
      
    } catch (error) {
      const result = {
        success: false,
        error: error.message,
        audioPath: this.playbackEngine ? 'playbackEngine' : 'userSettings',
        timestamp: Date.now()
      };
      
      this.emit('calibration:failed', { result });
      
      Logger.log(Logger.ERROR, 'CalibrationManager', 'Calibration failed', {
        error: error.message,
        audioPath: this.playbackEngine ? 'playbackEngine' : 'userSettings'
      });
      
      return result;
      
    } finally {
      this.isCalibrating = false;
    }
  }

  /**
   * Create calibration tone using user's selected instrument for accurate measurement
   * @private
   * @returns {Promise<Object>} Tone generation result
   */
  async _createCalibrationTone() {
    const duration = 1000; // 1 second
    const frequency = 440; // A4
    
    // PRIMARY: Use PlaybackEngine with user's selected instrument (most accurate)
    if (this.playbackEngine && this.playbackEngine.synthesizer) {
      Logger.log(Logger.DEBUG, 'CalibrationManager', 'Using PlaybackEngine with user settings for calibration tone');
      
      try {
        // Get current instrument and mode from PlaybackEngine
        const currentInstrument = this.playbackEngine.config?.instrument || this.userInstrumentSettings.instrument;
        const currentMode = this.playbackEngine.currentInstrumentMode || this.userInstrumentSettings.mode;
        
        Logger.log(Logger.INFO, 'CalibrationManager', 'Calibrating with PlaybackEngine user settings', {
          instrument: currentInstrument,
          mode: currentMode
        });
        
        // Create a note object for the calibration tone
        const calibrationNote = {
          id: 'calibration-tone',
          pitch: { step: 'A', octave: 4 },
          midi: 69, // A4 MIDI note
          frequency: 440,
          duration: duration,
          isRest: false
        };
        
        // Use PlaybackEngine's methods to play the tone with selected instrument
        const currentTime = window.Tone.now();
        
        if (currentMode === 'sample' && this.playbackEngine.sampler && this.playbackEngine.samplesLoaded) {
          // Use sample-based playback (most accurate representation of actual playback)
          Logger.log(Logger.DEBUG, 'CalibrationManager', 'Using sample-based calibration tone');
          this.playbackEngine._triggerSampleNote(calibrationNote, currentTime);
        } else {
          // Use synthesizer (either in synth mode or if samples not available)
          Logger.log(Logger.DEBUG, 'CalibrationManager', 'Using synthesizer calibration tone');
          this.playbackEngine._triggerSynthNote(calibrationNote, currentTime);
        }
        
        return {
          frequency,
          duration,
          startTime: Date.now(),
          method: 'playbackEngine',
          instrument: currentInstrument,
          mode: currentMode
        };
      } catch (error) {
        Logger.log(Logger.WARN, 'CalibrationManager', 'PlaybackEngine calibration failed, falling back to user settings', { error });
        // Fall through to user settings method
      }
    }
    
    // SECONDARY: Use user's stored settings with direct Tone.js synthesis
    if (window.Tone && window.Tone.context) {
      Logger.log(Logger.DEBUG, 'CalibrationManager', 'Using user settings with direct Tone.js synthesis');
      
      try {
        // Ensure audio context is running
        await window.Tone.context.resume();
        
        // Create PolySynth with user's settings
        const synthesizer = new Tone.PolySynth(Tone.AMSynth, {
          maxPolyphony: 6,
          volume: -10 // Lower volume for calibration
        });
        
        // Configure envelope for guitar-like sound
        synthesizer.set({
          envelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.3,
            release: 0.5
          },
          harmonicity: 3.5,
          modulationIndex: 10
        });
        
        // Apply user's instrument-specific settings
        if (this.userInstrumentSettings.instrument === 'piano') {
          synthesizer.set({
            envelope: {
              attack: 0.005,
              decay: 0.1,
              sustain: 0.9,
              release: 2.0
            }
          });
        } else if (this.userInstrumentSettings.instrument === 'cello') {
          synthesizer.set({
            envelope: {
              attack: 0.1,
              decay: 0.3,
              sustain: 0.7,
              release: 1.5
            }
          });
        }
        
        // Play the calibration tone
        const currentTime = window.Tone.now();
        synthesizer.triggerAttackRelease(
          frequency,
          duration / 1000,
          currentTime,
          0.5 // Volume
        );
        
        return {
          frequency,
          duration,
          startTime: Date.now(),
          method: 'userSettings',
          instrument: this.userInstrumentSettings.instrument,
          mode: this.userInstrumentSettings.mode
        };
      } catch (error) {
        Logger.log(Logger.WARN, 'CalibrationManager', 'User settings synthesis failed, falling back to direct', { error });
        // Fall through to direct AudioContext method
      }
    }
    
    // FALLBACK: Use direct AudioContext (least accurate, but always works)
    Logger.log(Logger.DEBUG, 'CalibrationManager', 'Using direct AudioContext for calibration tone');
    
    const audioContext = this._getAudioContext();
    
    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    // Create oscillator and gain
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Set up oscillator
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    // Set up envelope (smooth attack/decay)
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.1); // Attack
    gainNode.gain.linearRampToValueAtTime(0.3, now + duration / 1000 - 0.1); // Sustain
    gainNode.gain.linearRampToValueAtTime(0, now + duration / 1000); // Decay
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Start and stop
    oscillator.start(now);
    oscillator.stop(now + duration / 1000);
    
    return {
      frequency,
      duration,
      startTime: Date.now(),
      method: 'audioContext',
      instrument: 'synthetic',
      mode: 'direct'
    };
  }

  /**
   * Wait for pitch detection event
   * @private
   * @param {number} expectedStartTime - When tone should be detected
   * @param {number} timeout - Maximum wait time in ms
   * @returns {Promise<Object>} Detection result
   */
  async _waitForDetection(expectedStartTime, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Timeout waiting for tone detection'));
      }, timeout);
      
      const detectionHandler = (data) => {
        // Only accept A4 detections within reasonable time window
        const timeSinceStart = data.timestamp - expectedStartTime;
        const isCorrectPitch = Math.abs(data.frequency - 440) < 10; // Within 10 Hz of A4
        const isInWindow = timeSinceStart > 50 && timeSinceStart < 1500; // 50ms to 1.5s after start
        
        if (isCorrectPitch && isInWindow) {
          cleanup();
          resolve(data);
        }
      };
      
      const silenceHandler = (data) => {
        // Check if we're in a long silence period during expected detection
        if (Date.now() - expectedStartTime > 500) {
          // We should have detected the tone by now
          console.log('⚠️ Calibration: No tone detected during expected window');
        }
      };
      
      const cleanup = () => {
        clearTimeout(timeoutId);
        this.pitchDetector.off('pitch:detected', detectionHandler);
        this.pitchDetector.off('pitch:silence', silenceHandler);
      };
      
      // Set up listeners
      this.pitchDetector.on('pitch:detected', detectionHandler);
      this.pitchDetector.on('pitch:silence', silenceHandler);
    });
  }

  /**
   * Calculate measured latency
   * @private
   * @param {number} toneStartTime - When tone was played
   * @param {number} detectionTime - When tone was detected
   * @returns {number} Latency in milliseconds
   */
  _calculateLatency(toneStartTime, detectionTime) {
    return Math.max(0, detectionTime - toneStartTime);
  }

  /**
   * Save calibration result to settings
   * @private
   * @param {number} latency - Measured latency
   * @param {number} confidence - Detection confidence
   */
  async _saveCalibrationResult(latency, confidence) {
    // Only save if measurement is reasonable
    if (this._isReliableMeasurement(latency, confidence)) {
      this.settingsManager.saveCalibratedLatency(latency);
    } else {
      Logger.log(Logger.WARN, 'CalibrationManager', 'Unreliable measurement, not saving', {
        latency,
        confidence
      });
    }
  }

  /**
   * Check if measurement is reliable
   * @private
   * @param {number} latency - Measured latency
   * @param {number} confidence - Detection confidence
   * @returns {boolean} True if reliable
   */
  _isReliableMeasurement(latency, confidence) {
    // Latency should be between 50ms and 800ms
    const reasonableLatency = latency >= 50 && latency <= 800;
    
    // Confidence should be high
    const highConfidence = confidence >= 0.7;
    
    return reasonableLatency && highConfidence;
  }

  /**
   * Update pitch detector with new latency
   * @private
   * @param {number} latency - New latency to use
   */
  async _updatePitchDetector(latency) {
    if (this.pitchDetector) {
      this.pitchDetector.setLatencyEstimate(latency);
      this.pitchDetector.setAutoCalibration(false); // Disable auto-calibration when we have reliable measurement
      
      Logger.log(Logger.INFO, 'CalibrationManager', 'Pitch detector updated with user settings calibration', {
        newLatency: latency
      });
    }
  }

  /**
   * Get calibration status
   * @returns {Object} Current calibration status
   */
  getCalibrationStatus() {
    return {
      hasCalibrated: this.settingsManager.isCalibrated(),
      effectiveLatency: this.settingsManager.getEffectiveLatency(),
      calibratedLatency: this.settingsManager.getSetting('calibratedLatency'),
      fallbackLatency: this.settingsManager.getSetting('fallbackLatency'),
      isCalibrating: this.isCalibrating,
      audioPath: this.playbackEngine ? 'playbackEngine' : 'userSettings',
      selectedInstrument: this.userInstrumentSettings.instrument,
      selectedMode: this.userInstrumentSettings.mode
    };
  }

  /**
   * Set audio context for calibration (legacy method)
   * @param {AudioContext} audioContext - Audio context instance
   */
  setAudioContext(audioContext) {
    this.audioContext = audioContext;
    Logger.log(Logger.DEBUG, 'CalibrationManager', 'Audio context set');
  }

  /**
   * Set PlaybackEngine for consistent audio routing
   * @param {Object} playbackEngine - PlaybackEngine instance
   */
  setPlaybackEngine(playbackEngine) {
    this.playbackEngine = playbackEngine;
    Logger.log(Logger.DEBUG, 'CalibrationManager', 'PlaybackEngine set for calibration with user settings');
  }

  /**
   * Reset calibration
   */
  resetCalibration() {
    this.settingsManager.resetCalibration();
    
    // Reset pitch detector to use fallback latency
    if (this.pitchDetector) {
      const fallbackLatency = this.settingsManager.getSetting('fallbackLatency');
      this.pitchDetector.setLatencyEstimate(fallbackLatency);
      this.pitchDetector.setAutoCalibration(true); // Re-enable auto-calibration
    }
    
    Logger.log(Logger.INFO, 'CalibrationManager', 'Calibration reset');
  }
}
