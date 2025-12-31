/**
 * @module playbackEngine
 * @description Deterministic audio playback and cursor management
 * 
 * Manages audio playback with Tone.js Transport, providing tick events
 * for visual cursor updates and state machine for playback control.
 * 
 * @see Architecture.md §3.3 (Playback Engine Module)
 * @see Architecture.md §4.4 (PlaybackConfig Structure)
 * @see Architecture.md §5.2 (Playback Engine Events)
 * @see Architecture.md §6.3 (Playback Pipeline)
 * @see Architecture.md §8.1 (Latency Budget)
 */

import { EventEmitter } from '../utils/eventEmitter.js';
import { Logger } from '../utils/logger.js';
import { PLAYBACK_STATES } from '../utils/constants.js';


// Use global Tone if available (Node/Test), otherwise check window
let Tone = typeof global !== 'undefined' ? global.Tone : window.Tone;
if (!Tone) {
  try {
    Tone = await import('tone');
  } catch (error) {
    // In test environment, this will be mocked
    console.warn('Tone.js not available, using mock');
  }
}

/**
 * PlaybackEngine - Control audio playback and emit timing events
 * 
 * Responsibilities:
 * - Schedule and control audio playback
 * - Emit tick events for visual cursor updates
 * - Manage playback state machine (stopped, playing, paused)
 * - Handle tempo changes and seek operations
 * - Provide deterministic scheduling using Tone.js Transport
 * - M5: Audio synthesis and sample-based playback
 */
class PlaybackEngine extends EventEmitter {
  /**
   * Initialize PlaybackEngine with timeline and configuration
   * 
   * @param {Array} timeline - Timeline array from ExerciseLoader
   * @param {Object} config - Playback configuration options
   * @throws {Error} If timeline is invalid or empty
   * 
   * @example
   * const engine = new PlaybackEngine(timeline, { bpm: 120, volume: 0.7 });
   */
  constructor(timeline, config = {}) {
    super();
    
    if (!timeline || !Array.isArray(timeline)) {
      throw new Error('PlaybackEngine requires a valid timeline array');
    }
    
    if (timeline.length === 0) {
      throw new Error('Timeline cannot be empty');
    }
    
    this.timeline = timeline;
    this.config = this._mergeConfig(config);
    this.state = PLAYBACK_STATES.STOPPED;
    this.currentPosition = 0; // milliseconds
    this.scheduledEvents = [];
    this.currentNoteIndex = 0;
    this.currentSystem = 1;
    this.startTime = null;
    
    // ====================
    // Audio Components (M5)
    // ====================
    this.synthesizer = null;
    this.sampler = null;
    this.metronome = null;
    this.drumMachine = null;
    // Normalize instrument mode to handle both "samples" and "sample"
    const mode = this.config.instrumentMode || 'synth';
    this.currentInstrumentMode = mode === 'samples' ? 'sample' : mode;
    this.samplesLoaded = false;
    this.sampleLoadPromise = null;

    Logger.log(Logger.DEBUG, 'PlaybackEngine', 'Initializing with instrument config', {
      configInstrument: this.config.instrument,
      currentMode: this.currentInstrumentMode
    });
    
    // Set Tone.js Transport BPM
    if (Tone && Tone.Transport) {
      Tone.Transport.bpm.value = this.config.bpm;
    }
    
    Logger.log(Logger.INFO, 'PlaybackEngine', 
      `Initialized with ${timeline.length} notes at ${this.config.bpm} BPM`);
  }

  /**
   * Merge user config with defaults, filtering undefined values
   * 
   * @param {Object} config - User configuration
   * @returns {Object} Merged configuration
   * @private
   */
  _mergeConfig(config) {
    const defaults = {
      bpm: 120,
      instrumentMode: 'synth',
      instrument: 'acoustic',
      volume: 0.7,
      metronomeEnabled: false,
      metronomeVolume: 0.5,
      loopEnabled: false,
      timeSignature: { beats: 4, beatType: 4 }
    };

    // Merge config with defaults, filtering undefined/null values
    const merged = { ...defaults };
    if (config && typeof config === 'object') {
      Object.keys(config).forEach(key => {
        if (config[key] !== undefined && config[key] !== null) {
          merged[key] = config[key];
        }
      });
    }

    return merged;
  }

  /**
   * Valid state transitions map
   * @private
   */
  static get VALID_TRANSITIONS() {
    return {
      [PLAYBACK_STATES.STOPPED]: [PLAYBACK_STATES.PLAYING],
      [PLAYBACK_STATES.PLAYING]: [PLAYBACK_STATES.PAUSED, PLAYBACK_STATES.STOPPED],
      [PLAYBACK_STATES.PAUSED]: [PLAYBACK_STATES.PLAYING, PLAYBACK_STATES.STOPPED]
    };
  }

  /**
   * Validate state transition
   * @private
   * @param {string} newState - Target state
   * @returns {boolean} True if transition valid
   */
  _validateTransition(newState) {
    const validNextStates = PlaybackEngine.VALID_TRANSITIONS[this.state] || [];
    return validNextStates.includes(newState);
  }

  /**
   * Set playback state with validation and event emission
   * @private
   * @param {string} newState - Target state
   * @throws {Error} If transition invalid
   */
  _setState(newState) {
    if (!this._validateTransition(newState)) {
      throw new Error(
        `Invalid state transition: ${this.state} → ${newState}`
      );
    }
    
    const oldState = this.state;
    this.state = newState;
    
    // Emit state change event
    this.emit('playback:stateChanged', {
      oldState,
      newState,
      timestamp: Date.now()
    });
  }

  /**
   * Start or resume playback from current or specified position
   * 
   * @param {number} offsetMs - Optional start position in milliseconds
   * @returns {Promise<void>} Resolution when playback starts
   * @throws {Error} If audio context not started or invalid state
   * 
   * @example
   * await engine.play(); // Start from current position
   * await engine.play(5000); // Start from 5 seconds
   */
  async play(offsetMs = 0) {
    try {
      // Check Audio Context State
      if (Tone && Tone.context && Tone.context.state !== 'running') {
        throw new Error('Audio context not started. User gesture required.');
      }

      // Ensure global Transport starts from a clean state
      // NOTE: Don't use cancel() as it clears ALL events including drum events
      if (Tone && Tone.Transport) {
        Tone.Transport.stop();
        // Only reset position, preserve all scheduled events (including drums)
        Tone.Transport.position = 0;
      }

      // NEW: Initialize audio components if not already done
      if (!this.synthesizer) {
        await this.initializeAudio();
      }

      // Validate state transition
      if (!this._validateTransition(PLAYBACK_STATES.PLAYING)) {
        throw new Error(`Cannot play from ${this.state} state`);
      }
      
      // Set position if offset provided
      if (offsetMs !== undefined && offsetMs !== this.currentPosition) {
        this.seek(offsetMs);
      }

      // Find starting note
      this.currentNoteIndex = this._findFirstMusicalNote();

      // Clear previous schedule
      this._clearScheduledEvents();

      // Schedule all events
      this._scheduleAllEvents();

      // Set state BEFORE starting transport (this will emit stateChanged event)
      this._setState(PLAYBACK_STATES.PLAYING);
      
      this.startTime = Date.now() - this.currentPosition;

      // Start Transport
      if (Tone && Tone.Transport) {
        const startSeconds = this._convertMsToSeconds(this.currentPosition);
        Tone.Transport.start('+0', startSeconds);
      }

      // Emit event
      this.emit('playback:started', {
        startTime: this.startTime,
        offsetMs: this.currentPosition,
        bpm: this.config.bpm
      });

      Logger.log(Logger.INFO, 'PlaybackEngine', `Started playback at ${this.currentPosition}ms`);
    } catch (error) {
      Logger.log(Logger.ERROR, 'PlaybackEngine', 'Failed to start playback', { error });
      this.emit('playback:error', { error: error.message });
      // Don't throw - keep app stable
    }
  }

  /**
   * Pause playback, maintaining current position
   * 
   * @returns {void}
   * 
   * @example
   * engine.pause();
   */
  pause() {
    try {
      // Validate state transition
      if (!this._validateTransition(PLAYBACK_STATES.PAUSED)) {
        throw new Error(`Cannot pause from ${this.state} state`);
      }
      
      // Pause Transport
      if (Tone && Tone.Transport) {
        Tone.Transport.pause();
      }
      
      // Calculate current position before changing state
      if (this.startTime) {
        this.currentPosition = Date.now() - this.startTime;
      }
      
      // Set state (this will emit stateChanged event)
      this._setState(PLAYBACK_STATES.PAUSED);
      
      // Emit paused event
      this.emit('playback:paused', {
        currentPosition: this.currentPosition,
        noteId: this.timeline[this.currentNoteIndex]?.id
      });
      
      Logger.log(Logger.INFO, 'PlaybackEngine', 
        `Paused at ${this.currentPosition}ms`);
    } catch (error) {
      this.emit('playback:error', {
        error: error.message,
        state: this.state,
        method: 'pause'
      });
    }
  }

  /**
   * Stop playback and reset to beginning
   * 
   * @returns {void}
   * 
   * @example
   * engine.stop();
   */
  stop() {
    try {
      // Validate can stop (can stop from any non-stopped state)
      if (this.state === PLAYBACK_STATES.STOPPED) {
        return; // Already stopped, no-op
      }
      
      // Stop Transport
      if (Tone && Tone.Transport) {
        Tone.Transport.stop();
      }
      
      // Clear scheduled events
      this._clearScheduledEvents();
      
      // Reset cursor
      this.currentNoteIndex = 0;
      this.currentSystem = 1;
      
      // Set state (this will emit stateChanged event)
      this._setState(PLAYBACK_STATES.STOPPED);
      
      // Reset position and start time
      this.currentPosition = 0;
      this.startTime = null;
      
      // Emit stopped event
      this.emit('playback:stopped', {
        timestamp: Date.now()
      });
      
      Logger.log(Logger.INFO, 'PlaybackEngine', 'Stopped');
    } catch (error) {
      this.emit('playback:error', {
        error: error.message,
        state: this.state,
        method: 'stop'
      });
    }
  }

  /**
   * Jump to specific position in timeline
   * 
   * @param {number} positionMs - Target position in milliseconds
   * @returns {void}
   * 
   * @example
   * engine.seek(10000); // Jump to 10 seconds
   */
  seek(positionMs) {
    if (positionMs < 0) {
      positionMs = 0;
    }
    
    const maxPosition = this.timeline[this.timeline.length - 1].timestamp;
    if (positionMs > maxPosition) {
      positionMs = maxPosition;
    }
    
    // Update position
    this.currentPosition = positionMs;
    
    // Find corresponding note index
    this.currentNoteIndex = this.timeline.findIndex(
      note => note.timestamp >= positionMs
    );
    
    if (this.currentNoteIndex === -1) {
      this.currentNoteIndex = this.timeline.length - 1;
    }
    
    // If playing, reschedule from new position
    if (this.state === PLAYBACK_STATES.PLAYING && Tone && Tone.Transport) {
      Tone.Transport.stop();
      this._clearScheduledEvents();
      this._scheduleAllEvents();
      
      const startSeconds = this._convertMsToSeconds(positionMs);
      Tone.Transport.start('+0', startSeconds);
    }
    
    Logger.log(Logger.INFO, 'PlaybackEngine', 
      `Seek to ${positionMs}ms (note index ${this.currentNoteIndex})`);
  }

  /**
   * Change playback tempo
   * 
   * @param {number} bpm - Beats per minute (20-300)
   * @returns {void}
   * @throws {Error} If BPM is out of valid range
   * 
   * @example
   * engine.setTempo(180); // Speed up to 180 BPM
   */
  setTempo(bpm) {
    if (bpm < 20 || bpm > 300) {
      throw new Error('BPM must be between 20 and 300');
    }
    
    const oldBpm = this.config.bpm;
    this.config.bpm = bpm;
    
    // Update Tone.Transport BPM
    if (Tone && Tone.Transport) {
      Tone.Transport.bpm.value = bpm;
    }
    
    // Emit event
    this.emit('playback:tempo', {
      newBpm: bpm,
      oldBpm: oldBpm
    });
    
    Logger.log(Logger.INFO, 'PlaybackEngine', 
      `Tempo changed: ${oldBpm} → ${bpm} BPM`);
  }

  /**
   * Get current playback position
   * 
   * @returns {number} Current position in milliseconds
   * 
   * @example
   * const position = engine.getCurrentPosition();
   */
  getCurrentPosition() {
    if (this.state === PLAYBACK_STATES.PLAYING && this.startTime) {
      return Date.now() - this.startTime;
    }
    
    return this.currentPosition;
  }

  /**
   * Get current playback state
   * 
   * @returns {string} Current state (STOPPED, PLAYING, PAUSED)
   * 
   * @example
   * const state = engine.getState();
   */
  getState() {
    return this.state;
  }

  /**
   * Find first actual note (skip clef, key signature, time signature)
   * 
   * @returns {number} Index of first note or 0
   * @private
   */
  _findFirstMusicalNote() {
    // In our timeline, all entries are actual notes (no metadata)
    // So first note is always index 0
    // This method exists for future enhancement
    
    // Future: could check for 'type' property to skip non-notes
    return 0;
  }

  /**
   * Schedule all timeline notes on Tone.Transport
   * 
   * @returns {void}
   * @private
   */
  _scheduleAllEvents() {
    // Schedule only notes from currentNoteIndex onwards
    for (let i = this.currentNoteIndex; i < this.timeline.length; i++) {
      const note = this.timeline[i];
      this._scheduleNote(note);
    }
    
    // NEW: Schedule metronome clicks if enabled
    if (this.config.metronomeEnabled) {
      this._scheduleMetronome();
    }
    
    // Schedule playback completed event at the end
    const lastNote = this.timeline[this.timeline.length - 1];
    const endTime = lastNote.timestamp + lastNote.duration;
    const endSeconds = this._convertMsToSeconds(endTime);
    
    if (Tone && Tone.Transport) {
      const completedEventId = Tone.Transport.schedule((time) => {
        this.emit('playback:completed', {
          duration: endTime,
          noteCount: this.timeline.length
        });
        
        // Auto-stop after completion
        this.stop();
      }, endSeconds);
      
      this.scheduledEvents.push(completedEventId);
    }
    
    Logger.log(Logger.DEBUG, 'PlaybackEngine', 
      `Scheduled ${this.timeline.length - this.currentNoteIndex} events`);
  }

  /**
   * Schedule single note event on Transport
   * 
   * @param {Object} note - Note to schedule
   * @returns {void}
   * @private
   */
  _scheduleNote(note) {
    const noteSeconds = this._convertMsToSeconds(note.timestamp);
    
    if (Tone && Tone.Transport) {
      const eventId = Tone.Transport.schedule((time) => {
        // Emit tick event for UI update
        this._emitTick(note, time);
        
        // Update current position
        this.currentPosition = note.timestamp;
        
        // NEW: Play audio
        this._playNoteAudio(note, time);
        
      }, noteSeconds);
      
      this.scheduledEvents.push(eventId);
    }
  }

  /**
   * Emit tick event with note information
   * 
   * @param {Object} note - Current note
   * @param {number} time - Web Audio context time
   * @returns {void}
   * @private
   */
  _emitTick(note, time) {
    // Check for system change
    const systemChanged = this._detectSystemChange(note);
    
    // Emit tick event
    this.emit('playback:tick', {
      noteId: note.id,
      timestamp: Date.now(),
      systemNumber: note.system,
      midi: note.midi,
      audioContextTime: time
    });
    
    // Emit system change if needed
    if (systemChanged) {
      this.emit('playback:systemChange', {
        systemNumber: note.system,
        timestamp: Date.now()
      });
    }
    
    Logger.log(Logger.DEBUG, 'PlaybackEngine', 
      `Tick: ${note.id} (${note.isRest ? "REST" : note.pitch.step + note.pitch.octave})`);
  }

  /**
   * Detect if note is on a new system
   * 
   * @param {Object} note - Current note
   * @returns {boolean} True if system changed
   * @private
   */
  _detectSystemChange(note) {
    if (note.system !== this.currentSystem) {
      this.currentSystem = note.system;
      return true;
    }
    return false;
  }

  /**
   * Convert milliseconds to seconds for Tone.Transport
   * 
   * @param {number} ms - Milliseconds
   * @returns {number} Seconds
   * @private
   */
  _convertMsToSeconds(ms) {
    return ms / 1000;
  }

  /**
   * Clear all scheduled events from the Transport
   * and reset local tracking
   *
   * @returns {void}
   * @private
   */
  _clearScheduledEvents() {
    if (Tone && Tone.Transport) {
      // Only clear PlaybackEngine's own events, NOT drum events
      this.scheduledEvents.forEach(eventId => {
        Tone.Transport.clear(eventId);
      });

      // Reset Transport position but DON'T cancel all events
      // This preserves drum events scheduled by DrumMachine
      Tone.Transport.position = 0;
    }

    // Reset local tracking
    this.scheduledEvents = [];

    Logger.log(
      Logger.DEBUG,
      'PlaybackEngine',
      'Cleared PlaybackEngine events (preserved drum events)'
    );
  }

  /**
   * Validate current state before operations
   * 
   * @param {Array<string>} requiredStates - Valid states for operation
   * @returns {void}
   * @throws {Error} If current state is not in required states
   * @private
   */
  _validateState(requiredStates) {
    if (!requiredStates.includes(this.state)) {
      throw new Error(
        `Invalid state for operation. Current: ${this.state}, Required: ${requiredStates.join(' or ')}`
      );
    }
  }

  // ====================
  // Audio Integration (M5)
  // ====================

  /**
   * Initialize all audio components
   * 
   * @returns {Promise<boolean>} Success status
   */
  async initializeAudio() {
    Logger.log(Logger.INFO, 'PlaybackEngine', 'Initializing audio components');
    
    try {
      // Ensure Tone.js context is started and running
      await this._ensureAudioContextReady();
      
      // Create synthesizer (always available)
      this._createSynthesizer();
      
      // Create metronome
      this._createMetronome();
      
      // Create sampler if in sample mode
      if (this.currentInstrumentMode === 'sample') {
        await this._createSampler();
      }
      
      Logger.log(Logger.INFO, 'PlaybackEngine', 'Audio initialized successfully');
      return true;
      
    } catch (error) {
      Logger.log(Logger.ERROR, 'PlaybackEngine', 'Audio initialization failed', { error });
      this.emit('playback:error', {
        error: 'Audio initialization failed',
        details: error.message
      });
      return false;
    }
  }

  /**
   * Ensure Tone.js audio context is started and ready for use
   * 
   * @returns {Promise<void>} Resolves when audio context is ready
   * @private
   */
  async _ensureAudioContextReady() {
    Logger.log(Logger.INFO, 'PlaybackEngine', 'Ensuring audio context is ready');
    
    // Start Tone.js if not already started
    if (typeof Tone.start === 'function') {
      Logger.log(Logger.DEBUG, 'PlaybackEngine', 'Starting Tone.js context');
      await Tone.start();
    }
    
    // Resume context if needed
    if (Tone.context && typeof Tone.context.resume === 'function') {
      Logger.log(Logger.DEBUG, 'PlaybackEngine', 'Resuming Tone.js context');
      await Tone.context.resume();
    }
    
    // Wait for context to be in running state
    await this._waitForAudioContextReady();
    
    Logger.log(Logger.INFO, 'PlaybackEngine', 'Audio context is ready');
  }

  /**
   * Wait for Tone.js audio context to be in running state
   * 
   * @returns {Promise<void>} Resolves when context is running
   * @private
   */
  async _waitForAudioContextReady() {
    return new Promise((resolve) => {
      const checkReady = () => {
        if (Tone.context && Tone.context.state === 'running') {
          Logger.log(Logger.DEBUG, 'PlaybackEngine', 'Audio context is running');
          resolve();
        } else {
          Logger.log(Logger.DEBUG, 'PlaybackEngine', 
            `Audio context state: ${Tone.context?.state || 'unknown'}, waiting...`);
          setTimeout(checkReady, 50);
        }
      };
      checkReady();
    });
  }

  /**
   * Create synthesizer for synthesis mode
   * @private
   */
  _createSynthesizer() {
    // Create PolySynth with AMSynth voice
    this.synthesizer = new Tone.PolySynth(Tone.AMSynth, {
      maxPolyphony: 6, // Support up to 6 simultaneous notes (guitar chords)
      volume: this._volumeToDecibels(this.config.volume)
    }).toDestination();
    
    // Configure envelope for guitar-like sound
    this.synthesizer.set({
      envelope: {
        attack: 0.01,  // Fast attack
        decay: 0.2,
        sustain: 0.3,
        release: 0.5
      },
      harmonicity: 3.5,
      modulationIndex: 10
    });
    
    Logger.log(Logger.DEBUG, 'PlaybackEngine', 'Synthesizer created');
  }

  /**
   * Create sampler for sample-based playback
   * @private
   */
  async _createSampler() {
    const instrument = this.config.instrument || 'acoustic';

    Logger.log(Logger.INFO, 'PlaybackEngine',
      `Loading ${instrument} samples...`);

    // Define sample URLs for common MIDI notes
    // For guitar: typically E2 (40) to E5 (76)
    const sampleMap = this._buildSampleMap(instrument);
    const sampleKeys = Object.keys(sampleMap);

    Logger.log(Logger.DEBUG, 'PlaybackEngine',
      'Creating sampler', { instrument, baseUrl: instrument === 'acoustic' ? 'samples/acoustic/' : `samples/instruments/${instrument}/`, sampleCount: sampleKeys.length });

    if (sampleKeys.length === 0) {
      Logger.log(Logger.ERROR, 'PlaybackEngine',
        'No samples defined for instrument, falling back to synth', { instrument });

      this.samplesLoaded = false;
      this.currentInstrumentMode = 'synth';
      this.sampler = null;
      this.availableSampleNotes = [];
      return;
    }

    this.availableSampleNotes = sampleKeys;

    // Determine base URL based on instrument location
    let baseUrl;
    if (instrument === 'acoustic') {
      baseUrl = 'samples/acoustic/';
    } else {
      // Electric guitar, piano, cello are in samples/instruments/
      baseUrl = `samples/instruments/${instrument}/`;
    }

    // Create sampler
    this.sampler = new Tone.Sampler({
      urls: sampleMap,
      baseUrl: baseUrl,
      volume: this._volumeToDecibels(this.config.volume),
      onload: () => {
        this.samplesLoaded = true;
        Logger.log(Logger.INFO, 'PlaybackEngine', 'Samples loaded successfully');
        this.emit('audio:samplesLoaded', { instrument });
      },
      onerror: (error) => {
        Logger.log(Logger.ERROR, 'PlaybackEngine', 'Sample loading failed', { error });
        this.emit('audio:samplesError', { error: error.message });

        // Fallback to synth mode
        this.currentInstrumentMode = 'synth';
      }
    }).toDestination();
    
    // Return promise that resolves when samples loaded
    return new Promise((resolve, reject) => {
      const checkLoaded = setInterval(() => {
        if (this.samplesLoaded) {
          clearInterval(checkLoaded);
          resolve();
        }
      }, 100);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (!this.samplesLoaded) {
          clearInterval(checkLoaded);
          reject(new Error('Sample loading timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Build sample file mapping for Sampler
   *
   * @param {string} instrument - Instrument name
   * @returns {Object} Sample file mapping
   * @private
   */
  _buildSampleMap(instrument) {
    if (instrument === 'acoustic') {
      // Acoustic guitar samples: A2 to Gs4 (available range)
      // Using Tone.js standard "#" notation as keys, mapping to "s" filenames
      return {
        'A2': 'A2.wav',
        'A3': 'A3.wav',
        'A4': 'A4.wav',
        'A#2': 'As2.wav',
        'A#3': 'As3.wav',
        'A#4': 'As4.wav',
        'B2': 'B2.wav',
        'B3': 'B3.wav',
        'B4': 'B4.wav',
        'C3': 'C3.wav',
        'C4': 'C4.wav',
        'C5': 'C5.wav',
        'C#3': 'Cs3.wav',
        'C#4': 'Cs4.wav',
        'C#5': 'Cs5.wav',
        'D2': 'D2.wav',
        'D3': 'D3.wav',
        'D4': 'D4.wav',
        'D5': 'D5.wav',
        'D#2': 'Ds2.wav',
        'D#3': 'Ds3.wav',
        'D#4': 'Ds4.wav',
        'E2': 'E2.wav',
        'E3': 'E3.wav',
        'E4': 'E4.wav',
        'F2': 'F2.wav',
        'F3': 'F3.wav',
        'F4': 'F4.wav',
        'F#2': 'Fs2.wav',
        'F#3': 'Fs3.wav',
        'F#4': 'Fs4.wav',
        'G2': 'G2.wav',
        'G3': 'G3.wav',
        'G4': 'G4.wav',
        'G#2': 'Gs2.wav',
        'G#3': 'Gs3.wav',
        'G#4': 'Gs4.wav'
      };
    } else if (instrument === 'piano') {
      // Piano samples: wider range
      // Using Tone.js standard "#" notation as keys, mapping to "s" filenames
      return {
        'C2': 'C2.wav',
        'C3': 'C3.wav',
        'C4': 'C4.wav',  // Middle C
        'C5': 'C5.wav',
        'C6': 'C6.wav',
        'C7': 'C7.wav',
        'C#2': 'Cs2.wav',
        'C#3': 'Cs3.wav',
        'C#4': 'Cs4.wav',
        'C#5': 'Cs5.wav',
        'C#6': 'Cs6.wav',
        'C#7': 'Cs7.wav',
        'D2': 'D2.wav',
        'D3': 'D3.wav',
        'D4': 'D4.wav',
        'D#2': 'Ds2.wav',
        'D#3': 'Ds3.wav',
        'D#4': 'Ds4.wav',
        'D#5': 'Ds5.wav',
        'D#6': 'Ds6.wav',
        'D#7': 'Ds7.wav',
        'E2': 'E2.wav',
        'E3': 'E3.wav',
        'E4': 'E4.wav',
        'F2': 'F2.wav',
        'F3': 'F3.wav',
        'F4': 'F4.wav',
        'F#2': 'Fs2.wav',
        'F#3': 'Fs3.wav',
        'F#4': 'Fs4.wav',
        'F#5': 'Fs5.wav',
        'F#6': 'Fs6.wav',
        'F#7': 'Fs7.wav',
        'G2': 'G2.wav',
        'G3': 'G3.wav',
        'G4': 'G4.wav',
        'G#2': 'Gs2.wav',
        'G#3': 'Gs3.wav',
        'G#4': 'Gs4.wav',
        'G#5': 'Gs5.wav',
        'G#6': 'Gs6.wav',
        'G#7': 'Gs7.wav',
        'A1': 'A1.wav',
        'A2': 'A2.wav',
        'A3': 'A3.wav',
        'A4': 'A4.wav',
        'A5': 'A5.wav',
        'A6': 'A6.wav',
        'A7': 'A7.wav',
        'A#1': 'As1.wav',
        'A#2': 'As2.wav',
        'A#3': 'As3.wav',
        'A#4': 'As4.wav',
        'A#5': 'As5.wav',
        'A#6': 'As6.wav',
        'A#7': 'As7.wav',
        'B1': 'B1.wav',
        'B2': 'B2.wav',
        'B3': 'B3.wav',
        'B4': 'B4.wav',
        'B5': 'B5.wav',
        'B6': 'B6.wav',
        'B7': 'B7.wav'
      };
    } else if (instrument === 'cello') {
      // Cello samples: C2 to Gs4 (available range)
      // Using Tone.js standard "#" notation as keys, mapping to "s" filenames
      return {
        'C2': 'C2.wav',
        'C3': 'C3.wav',
        'C4': 'C4.wav',
        'C5': 'C5.wav',
        'C#3': 'Cs3.wav',
        'C#4': 'Cs4.wav',
        'D2': 'D2.wav',
        'D3': 'D3.wav',
        'D4': 'D4.wav',
        'D#2': 'Ds2.wav',
        'D#3': 'Ds3.wav',
        'D#4': 'Ds4.wav',
        'E2': 'E2.wav',
        'E3': 'E3.wav',
        'E4': 'E4.wav',
        'F2': 'F2.wav',
        'F3': 'F3.wav',
        'F4': 'F4.wav',
        'F#3': 'Fs3.wav',
        'F#4': 'Fs4.wav',
        'G2': 'G2.wav',
        'G3': 'G3.wav',
        'G4': 'G4.wav',
        'G#2': 'Gs2.wav',
        'G#3': 'Gs3.wav',
        'G#4': 'Gs4.wav'
      };
    } else if (instrument === 'guitar-electric') {
      // Electric guitar samples: available range
      // Using Tone.js standard "#" notation as keys, mapping to filenames
      return {
        'A2': 'A2.wav',
        'A3': 'A3.wav',
        'A4': 'A4.wav',
        'A5': 'A5.wav',
        'C3': 'C3.wav',
        'C4': 'C4.wav',
        'C5': 'C5.wav',
        'C6': 'C6.wav',
        'C#2': 'Cs2.wav',
        'D#3': 'Ds3.wav',
        'D#4': 'Ds4.wav',
        'D#5': 'Ds5.wav',
        'E2': 'E2.wav',
        'F#2': 'Fs2.wav',
        'F#3': 'Fs3.wav',
        'F#4': 'Fs4.wav',
        'F#5': 'Fs5.wav'
      };
    }

    return {};
  }

  /**
   * Create metronome sound generator
   * @private
   */
  _createMetronome() {
    // Simple synth for metronome clicks
    this.metronome = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      volume: this._volumeToDecibels(this.config.metronomeVolume)
    }).toDestination();
    
    Logger.log(Logger.DEBUG, 'PlaybackEngine', 'Metronome created');
  }

  /**
   * Convert volume (0-1) to decibels
   * 
   * @param {number} volume - Volume level 0.0 to 1.0
   * @returns {number} Volume in decibels
   * @private
   */
  _volumeToDecibels(volume) {
    // Convert linear volume (0-1) to decibels (-60 to 0)
    if (volume <= 0) return -Infinity;
    if (volume >= 1) return 0;
    
    // Logarithmic scaling: dB = 20 * log10(volume)
    // Map 0-1 to -60 to 0 dB
    return 20 * Math.log10(volume) * 3; // *3 to scale to -60 range
  }

  /**
   * Play audio for note using current instrument mode
   *
   * @param {Object} note - Note to play
   * @param {number} time - Web Audio context time
   * @private
   */
  _playNoteAudio(note, time) {
    try {
      if (this.currentInstrumentMode === 'synth') {
        this._triggerSynthNote(note, time);
      } else if (this.currentInstrumentMode === 'sample') {
        this._triggerSampleNote(note, time);
      }

      // NOTE: Drums are now scheduled independently via DrumMachine.scheduleDrums()
      // They should NOT be triggered by individual note playback
    } catch (error) {
      Logger.log(Logger.ERROR, 'PlaybackEngine',
        'Audio playback error', { error, noteId: note.id });
    }
  }

  /**
   * Play note using synthesizer
   * 
   * @param {Object} note - Note to play
   * @param {number} time - Web Audio context time
   * @private
   */
  _triggerSynthNote(note, time) {
    if (!this.synthesizer) {
      Logger.log(Logger.WARN, 'PlaybackEngine', 'Synthesizer not initialized');
      return;
    }
    
    // Convert MIDI to frequency
    const frequency = Tone.Frequency(note.midi, 'midi').toFrequency();
    
    // Convert duration from ms to seconds
    const durationSeconds = note.duration / 1000;
    
    // Trigger note
    this.synthesizer.triggerAttackRelease(
      frequency,
      durationSeconds,
      time,
      0.8 // Velocity (0-1)
    );
  }

  /**
   * Play note using sampler
   *
   * @param {Object} note - Note to play
   * @param {number} time - Web Audio context time
   * @private
   */
  _triggerSampleNote(note, time) {
    // Convert MIDI to note name (e.g., 60 -> 'C4')
    const noteName = Tone.Frequency(note.midi, 'midi').toNote();

    Logger.log(Logger.DEBUG, 'PlaybackEngine', 'Trigger sample note', {
      noteId: note.id,
      midi: note.midi,
      noteName,
      instrument: this.config.instrument,
      samplesLoaded: this.samplesLoaded,
      availableSampleNotes: this.availableSampleNotes?.slice(0, 5) // Show first 5 for debugging
    });

    // Defensive checks before triggering
    if (!this.sampler) {
      Logger.log(Logger.WARN, 'PlaybackEngine', 'Sample playback preconditions failed: no sampler', {
        noteName,
        hasSampler: false,
        samplesLoaded: this.samplesLoaded,
        availableNotes: this.availableSampleNotes?.length || 0
      });
      return this._triggerSynthNote(note, time);
    }

    if (!this.samplesLoaded) {
      Logger.log(Logger.WARN, 'PlaybackEngine', 'Sample playback preconditions failed: samples not loaded', {
        noteName,
        hasSampler: !!this.sampler,
        samplesLoaded: false,
        availableNotes: this.availableSampleNotes?.length || 0
      });
      return this._triggerSynthNote(note, time);
    }

    if (!this.availableSampleNotes || !this.availableSampleNotes.includes(noteName)) {
      Logger.log(Logger.WARN, 'PlaybackEngine', 'Sample playback preconditions failed: note not available', {
        noteName,
        hasSampler: !!this.sampler,
        samplesLoaded: this.samplesLoaded,
        availableNotes: this.availableSampleNotes?.length || 0,
        noteInAvailable: this.availableSampleNotes?.includes(noteName)
      });
      return this._triggerSynthNote(note, time);
    }

    // Convert duration from ms to seconds
    const durationSeconds = note.duration / 1000;

    // Trigger sample with error handling
    try {
      this.sampler.triggerAttackRelease(
        noteName,
        durationSeconds,
        time,
        0.8 // Velocity
      );
    } catch (error) {
      Logger.log(Logger.ERROR, 'PlaybackEngine', 'Sample trigger failed, falling back to synth', {
        error: error.message,
        noteId: note.id,
        noteName,
        instrument: this.config.instrument
      });
      // Fallback to synth on any trigger error
      this._triggerSynthNote(note, time);
    }
  }

  /**
   * Schedule metronome clicks on beats
   * @private
   */
  _scheduleMetronome() {
    if (!this.metronome) return;
    
    // Get time signature from config or default to 4/4
    const beatsPerMeasure = this.config.timeSignature?.beats || 4;
    const beatType = this.config.timeSignature?.beatType || 4;
    
    // Calculate beat duration in milliseconds
    const beatDurationMs = (60000 / this.config.bpm) * (4 / beatType);
    
    // Get exercise duration
    const lastNote = this.timeline[this.timeline.length - 1];
    const exerciseDurationMs = lastNote.timestamp + lastNote.duration;
    
    // Schedule clicks for each beat
    let currentBeatTime = 0;
    let beatNumber = 1;
    
    while (currentBeatTime < exerciseDurationMs) {
      const beatSeconds = this._convertMsToSeconds(currentBeatTime);
      const isDownbeat = beatNumber === 1;
      
      const eventId = Tone.Transport.schedule((time) => {
        this._playMetronomeClick(time, isDownbeat);
      }, beatSeconds);
      
      this.scheduledEvents.push(eventId);
      
      currentBeatTime += beatDurationMs;
      beatNumber = (beatNumber % beatsPerMeasure) + 1;
    }
    
    Logger.log(Logger.DEBUG, 'PlaybackEngine', 
      `Scheduled metronome: ${Math.ceil(exerciseDurationMs / beatDurationMs)} beats`);
  }

  /**
   * Play metronome click sound
   * 
   * @param {number} time - Web Audio context time
   * @param {boolean} isDownbeat - True if first beat of measure
   * @private
   */
  _playMetronomeClick(time, isDownbeat) {
    if (!this.metronome) return;
    
    // Higher pitch for downbeat, lower for other beats
    const pitch = isDownbeat ? 'C5' : 'C4';
    
    this.metronome.triggerAttackRelease(pitch, '32n', time);
  }

  /**
   * Switch between synth and sample modes
   * 
   * @param {string} mode - 'synth' or 'sample'
   */
  async setInstrumentMode(mode) {
    if (mode !== 'synth' && mode !== 'sample' && mode !== 'samples') {
      throw new Error('Invalid instrument mode. Use "synth" or "samples"');
    }

    // Normalize "samples" to "sample" for internal consistency
    const normalizedMode = mode === 'samples' ? 'sample' : mode;

    if (normalizedMode === this.currentInstrumentMode) {
      return; // Already in this mode
    }

    const previousMode = this.currentInstrumentMode;
    this.currentInstrumentMode = normalizedMode;

    Logger.log(Logger.INFO, 'PlaybackEngine',
      `Switching instrument mode: ${previousMode} → ${normalizedMode}`);

    // If switching to sample mode, load samples
    if (normalizedMode === 'sample' && !this.samplesLoaded) {
      try {
        await this._createSampler();
      } catch (error) {
        Logger.log(Logger.ERROR, 'PlaybackEngine',
          'Failed to load samples, staying in synth mode', { error });
        this.currentInstrumentMode = 'synth';
        throw error;
      }
    }
    
    this.emit('audio:modeChanged', {
      mode: this.currentInstrumentMode,
      previousMode
    });
  }

  /**
   * Set instrument type
   * 
   * @param {string} instrument - Instrument name
   */
  setInstrument(instrument) {
    this.config.instrument = instrument;
    
    // If in sample mode, reload samples
    if (this.currentInstrumentMode === 'sample' && this.sampler) {
      Logger.log(Logger.INFO, 'PlaybackEngine', 
        `Switching instrument to ${instrument}`);
      this.samplesLoaded = false;
      this._createSampler().catch(error => {
        Logger.log(Logger.ERROR, 'PlaybackEngine', 
          'Failed to load new instrument samples', { error });
        this.currentInstrumentMode = 'synth';
      });
    }
  }

  /**
   * Set master volume
   * 
   * @param {number} volume - Volume level (0.0 to 1.0)
   */
  setVolume(volume) {
    if (volume < 0 || volume > 1) {
      throw new Error('Volume must be between 0 and 1');
    }
    
    this.config.volume = volume;
    const volumeDb = this._volumeToDecibels(volume);
    
    // Update synthesizer volume
    if (this.synthesizer) {
      this.synthesizer.volume.value = volumeDb;
    }
    
    // Update sampler volume
    if (this.sampler) {
      this.sampler.volume.value = volumeDb;
    }
    
    Logger.log(Logger.DEBUG, 'PlaybackEngine', 
      `Volume set to ${(volume * 100).toFixed(0)}%`);
  }

  /**
   * Set metronome volume
   * 
   * @param {number} volume - Volume level (0.0 to 1.0)
   */
  setMetronomeVolume(volume) {
    if (volume < 0 || volume > 1) {
      throw new Error('Metronome volume must be between 0 and 1');
    }
    
    this.config.metronomeVolume = volume;
    
    if (this.metronome) {
      this.metronome.volume.value = this._volumeToDecibels(volume);
    }
    
    Logger.log(Logger.DEBUG, 'PlaybackEngine', 
      `Metronome volume set to ${(volume * 100).toFixed(0)}%`);
  }

  /**
   * Toggle metronome on/off
   */
  toggleMetronome() {
    this.config.metronomeEnabled = !this.config.metronomeEnabled;
    
    Logger.log(Logger.INFO, 'PlaybackEngine', 
      `Metronome ${this.config.metronomeEnabled ? 'enabled' : 'disabled'}`);
    
    // If currently playing, need to reschedule
    if (this.state === PLAYBACK_STATES.PLAYING) {
      Logger.log(Logger.WARN, 'PlaybackEngine', 
        'Metronome toggle during playback requires restart');
      // Could implement hot-swap here, but for M5 just log warning
    }
    
    this.emit('audio:metronomeToggled', {
      enabled: this.config.metronomeEnabled
    });
  }

  /**
   * Preload samples in background
   */
  async preloadSamples() {
    if (this.currentInstrumentMode === 'sample' && !this.samplesLoaded) {
      try {
        await this._createSampler();
      } catch (error) {
        Logger.log(Logger.ERROR, 'PlaybackEngine', 
          'Failed to preload samples', { error });
        throw error;
      }
    }
  }

  /**
   * Set drum machine for jamming mode
   *
   * @param {DrumMachine} drumMachine - Drum machine instance
   */
  setDrumMachine(drumMachine) {
    this.drumMachine = drumMachine;
    Logger.log(Logger.INFO, 'PlaybackEngine', 'Drum machine set for jamming mode', {
      drumMachineReady: drumMachine ? drumMachine.isReady() : false,
      drumMachineStyle: drumMachine ? drumMachine.getCurrentStyle() : 'none'
    });
  }

  /**
   * Get sample path for MIDI note
   *
   * @param {number} midiNote - MIDI note number
   * @returns {string} Sample file path
   * @private
   */
  _getSamplePath(midiNote) {
    // For future implementation - get closest sample for MIDI note
    const noteName = Tone.Frequency(midiNote, 'midi').toNote();
    return `${this.config.instrument}/${noteName}.wav`;
  }
}

export { PlaybackEngine };
