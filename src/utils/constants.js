/**
 * @module constants
 * @description Centralized configuration constants for the application
 * 
 * Contains all configuration values, thresholds, and constants used throughout
 * the application. Organized by functional area for easy maintenance.
 */

// Audio Configuration
export const AUDIO_CONFIG = {
  SAMPLE_RATE: 44100,      // Audio sample rate in Hz
  BUFFER_SIZE: 2048,       // Audio buffer size for analysis
  FFT_SIZE: 2048,          // FFT size for frequency analysis
  MIN_FREQUENCY: 80,       // Minimum frequency to detect (Hz)
  MAX_FREQUENCY: 1000,     // Maximum frequency to detect (Hz)
  NOISE_THRESHOLD_DB: -40  // Noise gate threshold in dB
};

// Performance Targets
export const PERFORMANCE_TARGETS = {
  PITCH_DETECTION_LATENCY_MS: 30,     // Maximum pitch detection latency
  TOTAL_FEEDBACK_LATENCY_MS: 80,      // Total pipeline latency
  PLAYBACK_TICK_UPDATE_MS: 20,        // Visual cursor update rate
  MAX_MEMORY_MB: 300                  // Maximum memory usage
};

// Storage Keys
export const STORAGE_KEYS = {
  SETTINGS: 'g4:settings',
  LAST_EXERCISE: 'g4:lastExercise',
  EXERCISE_CACHE_PREFIX: 'g4:exerciseCache:',
  PERFORMANCE_HISTORY: 'g4:perfHistory',
  AUDIO_CONTEXT_STATE: 'g4:audioContextState',
  ERRORS: 'g4:errors'
};

// Tolerance Presets
export const TOLERANCE_PRESETS = {
  EASY: { pitch: 100, timing: 200 },    // Easy: 100 cents, 200ms
  NORMAL: { pitch: 50, timing: 100 },   // Normal: 50 cents, 100ms
  HARD: { pitch: 25, timing: 50 }       // Hard: 25 cents, 50ms
};

// Tuner Configuration
export const TUNER_CONFIG = {
  REFERENCE_A4: 440,         // A4 reference frequency in Hz
  SMOOTHING_FACTOR: 0.2,     // Exponential smoothing factor (0-0.99)
  UPDATE_RATE_HZ: 50,        // UI update rate in Hz
  IN_TUNE_THRESHOLD: 5,      // Green zone: ±5 cents
  CLOSE_THRESHOLD: 20,       // Orange zone: ±20 cents
  NEEDLE_RANGE_CENTS: 50     // Needle display range: ±50 cents
};

// UI Constants
export const UI_CONSTANTS = {
  TABS: ['practice', 'tuner', 'lessons', 'settings'],
  DEFAULT_TAB: 'practice',
  NOTIFICATION_DURATION_MS: 3000,
  MIN_WINDOW_WIDTH: 1280,
  MIN_WINDOW_HEIGHT: 720
};

// Playback States
export const PLAYBACK_STATES = {
  STOPPED: 'stopped',
  PLAYING: 'playing',
  PAUSED: 'paused'
};

// Event Names
export const EVENT_NAMES = {
  // Exercise events
  EXERCISE_LOADED: 'exercise:loaded',
  EXERCISE_ERROR: 'exercise:error',
  
  // Playback events
  PLAYBACK_STARTED: 'playback:started',
  PLAYBACK_PAUSED: 'playback:paused',
  PLAYBACK_STOPPED: 'playback:stopped',
  PLAYBACK_TICK: 'playback:tick',
  PLAYBACK_COMPLETED: 'playback:completed',
  SYSTEM_CHANGE: 'playback:systemChange',
  
  // Pitch detection events
  PITCH_DETECTED: 'pitch:detected',
  PITCH_ERROR: 'pitch:error',
  
  // Analysis events
  ANALYSIS_COMPLETE: 'analysis:complete',
  ANALYSIS_ERROR: 'analysis:error',
  
  // Tuner events
  TUNER_UPDATE: 'tuner:update',
  TUNER_ERROR: 'tuner:error',
  
  // UI events
  TAB_SWITCHED: 'ui:tabSwitched',
  NOTIFICATION: 'ui:notification',
  ERROR_DISPLAY: 'ui:errorDisplay'
};

// Error Messages
export const ERROR_MESSAGES = {
  // Audio errors
  AUDIO_CONTEXT_SUSPENDED: 'Audio context is suspended. Click "Start Audio" to enable.',
  MICROPHONE_DENIED: 'Microphone access denied. Please grant permission for pitch detection.',
  AUDIO_CONTEXT_FAILED: 'Failed to initialize audio context.',
  
  // Exercise errors
  INVALID_XML: 'Invalid or malformed MusicXML file.',
  XML_PARSE_ERROR: 'Error parsing XML. Please check the file format.',
  FILE_TOO_LARGE: 'File is too large. Maximum size is 5MB.',
  UNSUPPORTED_FILE: 'Unsupported file type. Please use MusicXML files.',
  
  // Pitch detection errors
  PITCH_DETECTION_FAILED: 'Pitch detection failed. Please check microphone.',
  NO_AUDIO_INPUT: 'No audio input detected. Please check microphone connection.',
  
  // Storage errors
  STORAGE_QUOTA_EXCEEDED: 'Storage quota exceeded. Some data may not be saved.',
  STORAGE_UNAVAILABLE: 'Local storage is not available.'
};

// Instrument Types
export const INSTRUMENT_TYPES = {
  GUITAR: 'guitar',
  PIANO: 'piano',
  UKULELE: 'ukulene'
};

// Guitar Tuning (standard tuning in MIDI numbers)
export const GUITAR_TUNING = {
  E2: 40,  // 6th string (lowest)
  A2: 45,  // 5th string
  D3: 50,  // 4th string
  G3: 55,  // 3rd string
  B3: 59,  // 2nd string
  E4: 64   // 1st string (highest)
};
