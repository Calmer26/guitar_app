/**
 * Tuner Module - Real-time guitar tuning display with visual feedback
 * 
 * Provides accurate pitch detection display with exponential smoothing,
 * color-coded accuracy zones, and support for reference pitch adjustment.
 * Integrates with PitchDetector to receive real-time pitch events.
 * 
 * @extends EventEmitter
 * @fires tuner:started - Emitted when tuner activates
 * @fires tuner:stopped - Emitted when tuner deactivates
 * @fires tuner:update - Emitted on each pitch update with current state
 * @fires tuner:referencePitchChanged - Emitted when reference pitch changes
 */

import { EventEmitter } from '../utils/eventEmitter.js';
import { Logger } from '../utils/logger.js';

const DEFAULT_CONFIG = {
  referencePitch: 440,
  smoothingFactor: 0.2,
  updateRate: 60,
  confidenceThreshold: 0.7,
  zones: {
    inTune: { min: -5, max: 5, color: 'green' },
    close: { min: -20, max: 20, color: 'orange' },
    outOfTune: { min: -50, max: 50, color: 'red' }
  }
};

/**
 * Tuner configuration structure
 * @typedef {Object} TunerConfig
 * @property {number} referencePitch - A4 frequency in Hz (default: 440)
 * @property {number} smoothingFactor - Exponential smoothing factor 0.0-0.99 (default: 0.2)
 * @property {number} updateRate - Target Hz for visual updates (default: 60)
 * @property {number} confidenceThreshold - Minimum confidence to display (default: 0.7)
 * @property {Object} zones - Color zone configuration
 */

/**
 * Tuner state structure
 * @typedef {Object} TunerState
 * @property {boolean} active - Tuner running status
 * @property {number} frequency - Smoothed frequency in Hz
 * @property {string} noteName - Note name (e.g., "A4", "E♭3")
 * @property {number} cents - Cents deviation from nearest note
 * @property {number} needleAngle - Angle for needle rotation (-45 to +45)
 * @property {string} color - Current zone color
 * @property {number} confidence - Detection confidence (0-1)
 * @property {number} referencePitch - Current A4 reference
 */

export class Tuner extends EventEmitter {
  /**
   * Initialize tuner with configuration
   * @param {TunerConfig} config - Tuner configuration
   */
  constructor(config = {}) {
    super();
    
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // State
    this.active = false;
    this.pitchDetector = null;
    
    // Smoothing state
    this.smoothedFrequency = null;
    this.smoothedCents = null;
    
    // Current display values
    this.currentState = this._getEmptyState();
    
    // Throttling
    this.lastUpdateTime = 0;
    this.updateInterval = 1000 / this.config.updateRate; // milliseconds
    this.pendingUpdate = false;
    
    // Event handler binding
    this._onPitchDetected = this._onPitchDetected.bind(this);
    
    Logger.log(Logger.INFO, 'Tuner', 'Initialized', {
      referencePitch: this.config.referencePitch,
      smoothingFactor: this.config.smoothingFactor
    });
  }
  
  /**
   * Get empty/default state
   * @private
   * @returns {TunerState} Empty state object
   */
  _getEmptyState() {
    return {
      active: false,
      frequency: 0,
      noteName: '--',
      cents: 0,
      needleAngle: 0,
      color: this.config.zones.outOfTune.color,
      confidence: 0,
      referencePitch: this.config.referencePitch
    };
  }
  
  /**
   * Start tuner mode (connect to pitch detector)
   * @param {PitchDetector} pitchDetector - Detector instance to use
   * @throws {Error} If pitchDetector is not provided
   */
  start(pitchDetector) {
    if (this.active) {
      Logger.log(Logger.WARN, 'Tuner', 'Already active');
      return;
    }
    
    if (!pitchDetector) {
      throw new Error('PitchDetector instance required');
    }
    
    this.pitchDetector = pitchDetector;
    this.active = true;
    
    // Reset smoothing state
    this.reset();
    
    // Subscribe to pitch detection events
    this.pitchDetector.on('pitch:detected', this._onPitchDetected);
    
    this.currentState.active = true;
    this.currentState.referencePitch = this.config.referencePitch;
    
    this.emit('tuner:started', {
      referencePitch: this.config.referencePitch,
      smoothingFactor: this.config.smoothingFactor
    });
    
    Logger.log(Logger.INFO, 'Tuner', 'Started');
  }
  
  /**
   * Stop tuner mode
   */
  stop() {
    if (!this.active) {
      return;
    }
    
    this.active = false;
    
    // Unsubscribe from pitch detector
    if (this.pitchDetector) {
      this.pitchDetector.off('pitch:detected', this._onPitchDetected);
      this.pitchDetector = null;
    }
    
    // Reset state
    this.currentState = this._getEmptyState();
    
    this.emit('tuner:stopped', {});
    
    Logger.log(Logger.INFO, 'Tuner', 'Stopped');
  }
  
  /**
   * Reset smoothing (clear history)
   */
  reset() {
    this.smoothedFrequency = null;
    this.smoothedCents = null;
    this.lastUpdateTime = 0;
  }
  
  /**
   * Handle pitch detected event from detector
   * @private
   * @param {Object} pitchData - Pitch detection data from PitchDetector
   */
  _onPitchDetected(pitchData) {
    if (!this.active) {
      return;
    }
    
    // Check confidence threshold
    if (pitchData.confidence < this.config.confidenceThreshold) {
      // Low confidence - don't update display
      return;
    }
    
    // Throttle updates to target rate
    const now = performance.now();
    if (now - this.lastUpdateTime < this.updateInterval) {
      return; // Skip this update
    }
    
    this.lastUpdateTime = now;
    
    // Apply exponential smoothing
    const smoothedData = this._applySmoothing(
      pitchData.frequency,
      pitchData.centsDeviation || pitchData.cents || 0
    );
    
    // Calculate display values
    const displayState = this._calculateDisplayState(smoothedData);
    
    // Update current state
    this.currentState = {
      active: true,
      frequency: displayState.frequency,
      noteName: displayState.noteName,
      cents: displayState.cents,
      needleAngle: displayState.needleAngle,
      color: displayState.color,
      confidence: pitchData.confidence,
      referencePitch: this.config.referencePitch
    };
    
    // Emit update event via requestAnimationFrame
    if (!this.pendingUpdate) {
      this.pendingUpdate = true;
      requestAnimationFrame(() => {
        this.emit('tuner:update', { ...this.currentState });
        this.pendingUpdate = false;
      });
    }
  }
  
  /**
   * Apply exponential smoothing to frequency and cents
   * @private
   * @param {number} rawFrequency - Raw detected frequency
   * @param {number} rawCents - Raw cents deviation
   * @returns {Object} Smoothed values
   */
  _applySmoothing(rawFrequency, rawCents) {
    const α = this.config.smoothingFactor;
    
    // Initialize on first detection
    if (this.smoothedFrequency === null) {
      this.smoothedFrequency = rawFrequency;
      this.smoothedCents = rawCents;
    } else {
      // Apply exponential moving average
      // smoothed = α * current + (1 - α) * previous
      this.smoothedFrequency = (α * rawFrequency) + 
                               ((1 - α) * this.smoothedFrequency);
      
      this.smoothedCents = (α * rawCents) + 
                           ((1 - α) * this.smoothedCents);
    }
    
    return {
      frequency: this.smoothedFrequency,
      cents: this.smoothedCents
    };
  }
  
  /**
   * Calculate display state from smoothed values
   * @private
   * @param {Object} smoothedData - Smoothed frequency and cents
   * @returns {Object} Display state
   */
  _calculateDisplayState(smoothedData) {
    const { frequency, cents } = smoothedData;
    
    // Calculate nearest MIDI note
    const midiNote = this._frequencyToMidi(frequency);
    
    // Get note name with accidentals
    const noteName = this._midiToNoteName(midiNote);
    
    // Calculate needle angle (-45° to +45° for ±50 cents)
    const needleAngle = this._centsToNeedleAngle(cents);
    
    // Determine color zone
    const color = this._getColorForCents(cents);
    
    return {
      frequency: Math.round(frequency * 10) / 10, // 1 decimal place
      noteName: noteName,
      cents: Math.round(cents),
      needleAngle: needleAngle,
      color: color
    };
  }
  
  /**
   * Convert frequency to MIDI note number
   * @private
   * @param {number} frequency - Frequency in Hz
   * @returns {number} MIDI note number
   */
  _frequencyToMidi(frequency) {
    // MIDI note = 69 + 12 * log2(f / A4)
    const A4 = this.config.referencePitch;
    const midiFloat = 69 + 12 * Math.log2(frequency / A4);
    return Math.round(midiFloat);
  }
  
  /**
   * Convert MIDI note to note name with accidentals
   * @private
   * @param {number} midiNote - MIDI note number (0-127)
   * @returns {string} Note name (e.g., "A4", "E♭3")
   */
  _midiToNoteName(midiNote) {
    const noteNames = [
      'C', 'C♯', 'D', 'E♭', 'E', 'F', 
      'F♯', 'G', 'A♭', 'A', 'B♭', 'B'
    ];
    
    const octave = Math.floor(midiNote / 12) - 1;
    const noteIndex = midiNote % 12;
    
    return noteNames[noteIndex] + octave;
  }
  
  /**
   * Convert cents deviation to needle angle
   * @private
   * @param {number} cents - Cents deviation (-50 to +50)
   * @returns {number} Needle angle in degrees (-45 to +45)
   */
  _centsToNeedleAngle(cents) {
    // Map ±50 cents to ±45 degrees
    const maxCents = 50;
    const maxAngle = 45;
    
    // Clamp cents to ±50
    const clampedCents = Math.max(-maxCents, Math.min(maxCents, cents));
    
    // Calculate angle
    const angle = (clampedCents / maxCents) * maxAngle;
    
    return angle;
  }
  
  /**
   * Determine color based on cents deviation
   * @private
   * @param {number} cents - Cents deviation
   * @returns {string} Color hex code
   */
  _getColorForCents(cents) {
    const absCents = Math.abs(cents);
    
    // In tune (green)
    if (absCents <= this.config.zones.inTune.max) {
      return this.config.zones.inTune.color;
    }
    
    // Close (orange)
    if (absCents <= this.config.zones.close.max) {
      return this.config.zones.close.color;
    }
    
    // Out of tune (red)
    return this.config.zones.outOfTune.color;
  }
  
  /**
   * Set reference pitch (A4 frequency)
   * @param {number} frequency - Reference A4 in Hz
   * @throws {Error} If frequency is out of valid range (420-460 Hz)
   */
  setReferencePitch(frequency) {
    // Validate range (420-460 Hz is reasonable)
    if (frequency < 420 || frequency > 460) {
      throw new Error('Reference pitch must be between 420 and 460 Hz');
    }
    
    const oldPitch = this.config.referencePitch;
    this.config.referencePitch = frequency;
    
    // Reset smoothing to recalculate immediately
    this.reset();
    
    Logger.log(Logger.INFO, 'Tuner', 'Reference pitch changed', {
      from: oldPitch,
      to: frequency
    });
    
    this.emit('tuner:referencePitchChanged', {
      oldPitch: oldPitch,
      newPitch: frequency
    });
  }
  
  /**
   * Get reference pitch
   * @returns {number} Current A4 reference frequency
   */
  getReferencePitch() {
    return this.config.referencePitch;
  }
  
  /**
   * Update smoothing factor
   * @param {number} factor - 0.0 (no smoothing) to 0.99 (heavy smoothing)
   * @throws {Error} If factor is out of valid range
   */
  setSmoothingFactor(factor) {
    // Validate range
    if (factor < 0 || factor > 0.99) {
      throw new Error('Smoothing factor must be between 0.0 and 0.99');
    }
    
    const oldFactor = this.config.smoothingFactor;
    this.config.smoothingFactor = factor;
    
    Logger.log(Logger.INFO, 'Tuner', 'Smoothing factor changed', {
      from: oldFactor,
      to: factor
    });
    
    // Note: Don't reset smoothing state, just use new factor going forward
  }
  
  /**
   * Get smoothing factor
   * @returns {number} Current smoothing factor
   */
  getSmoothingFactor() {
    return this.config.smoothingFactor;
  }
  
  /**
   * Get current tuner state
   * @returns {TunerState} Current state
   */
  getState() {
    return { ...this.currentState };
  }
  
  /**
   * Check if tuner is active
   * @returns {boolean} Active status
   */
  isActive() {
    return this.active;
  }
}
