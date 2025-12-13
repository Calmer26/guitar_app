/**
 * Enhanced Analyzer Constants - Inspired by Performous
 *
 * Scoring constants and configuration for improved timing/scoring system.
 * Implements temporal smoothing, continuous scoring, and tiered scoring zones.
 */

// Scoring constants (inspired by Performous)
export const SCORING = {
  // Points awarded per second of correct playing
  POINTS_PER_SECOND: 100,

  // Maximum score is 10000 (like Performous)
  MAX_SCORE: 10000,

  // Pitch tolerance zones (cents deviation)
  PITCH_ZONES: {
    PERFECT: 5,      // Within 5 cents: 100% points
    GREAT: 15,       // Within 15 cents: 80% points
    GOOD: 25,        // Within 25 cents: 60% points
    OK: 50,          // Within 50 cents: 40% points
    MISS: Infinity   // Beyond 50 cents: 0% points
  },

  // Timing window (milliseconds before/after note)
  TIMING_WINDOWS: {
    EARLY_PERFECT: -50,    // 50ms early still perfect
    EARLY_GOOD: -150,      // 150ms early gets reduced points
    LATE_PERFECT: 50,      // 50ms late still perfect
    LATE_GOOD: 150         // 150ms late gets reduced points
  },

  // Temporal smoothing window (filter rapid pitch changes)
  SMOOTHING_WINDOW_MS: 100,

  // Minimum note duration to require hold validation
  HOLD_THRESHOLD_MS: 500
};

// Difficulty presets with smoothing configurations
export const SMOOTHING_PRESETS = {
  EASY: {
    windowMs: 150,    // More aggressive smoothing for beginners
    enabled: true
  },
  NORMAL: {
    windowMs: 100,    // Balanced smoothing
    enabled: true
  },
  HARD: {
    windowMs: 75,     // Less smoothing for advanced players
    enabled: true
  },
  DISABLED: {
    windowMs: 0,      // No smoothing
    enabled: false
  }
};
