/**
 * @module drumPatterns
 * @description Drum pattern library for various musical styles
 *
 * Each pattern defines hits per beat subdivision for different drum styles.
 * Patterns are designed to work with 4/4 time signature by default.
 */

/**
 * Drum pattern library
 * Each pattern defines hits per beat subdivision
 */
export const DRUM_PATTERNS = {
  rock: {
    name: 'Rock',
    description: 'Standard rock beat with quarter note rhythm',
    timeSignatures: ['4/4'],
    subdivisions: 4, // Quarter notes per measure in 4/4 (reduced from 8)
    pattern: [
      { kick: true, snare: false, hihat: true },   // Beat 1 - hi-hat on downbeat
      { kick: false, snare: true, hihat: false },  // Beat 2 - no hi-hat
      { kick: true, snare: false, hihat: true },   // Beat 3 - hi-hat on downbeat
      { kick: false, snare: true, hihat: false }   // Beat 4 - no hi-hat
    ]
  },

  jazz: {
    name: 'Jazz (Swing)',
    description: 'Swing feel with basic rhythm',
    timeSignatures: ['4/4'],
    subdivisions: 4, // Quarter notes (reduced from 12 triplets)
    pattern: [
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: true, hihat: true },
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: true, hihat: true }
    ]
  },

  latin: {
    name: 'Latin',
    description: 'Bossa nova or samba pattern',
    timeSignatures: ['4/4'],
    subdivisions: 16, // 16th notes
    pattern: [
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: false, hihat: false },
      { kick: false, snare: false, hihat: true },
      { kick: true, snare: false, hihat: false },
      { kick: false, snare: true, hihat: true },
      { kick: false, snare: false, hihat: false },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: false, hihat: false },
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: false, hihat: false },
      { kick: false, snare: false, hihat: true },
      { kick: true, snare: false, hihat: false },
      { kick: false, snare: true, hihat: true },
      { kick: false, snare: false, hihat: false },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: false, hihat: false }
    ]
  },

  ballad: {
    name: 'Ballad',
    description: 'Slow, simple pattern with brushes feel',
    timeSignatures: ['4/4'],
    subdivisions: 4, // Quarter notes
    pattern: [
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: true, hihat: true },
      { kick: false, snare: false, hihat: true }
    ]
  },

  funk: {
    name: 'Funk',
    description: 'Syncopated groove with ghost notes',
    timeSignatures: ['4/4'],
    subdivisions: 16,
    pattern: [
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: true, snare: false, hihat: false },
      { kick: false, snare: true, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: false, hihat: false },
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: true, snare: false, hihat: false },
      { kick: false, snare: true, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: false, hihat: false }
    ]
  },

  waltz: {
    name: 'Waltz',
    description: '3/4 time signature pattern',
    timeSignatures: ['3/4'],
    subdivisions: 3,
    pattern: [
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: true, hihat: true }
    ]
  },

  reggae: {
    name: 'Reggae',
    description: 'One drop rhythm with emphasis on 3',
    timeSignatures: ['4/4'],
    subdivisions: 8,
    pattern: [
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: true, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: true, hihat: true },
      { kick: false, snare: false, hihat: true }
    ]
  },

  blues: {
    name: 'Blues Shuffle',
    description: 'Shuffle feel with swung eighths',
    timeSignatures: ['4/4'],
    subdivisions: 12,
    pattern: [
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: false, hihat: false },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: false, hihat: false },
      { kick: false, snare: true, hihat: true },
      { kick: false, snare: false, hihat: false },
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: false, hihat: false },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: false, hihat: false },
      { kick: false, snare: true, hihat: true },
      { kick: false, snare: false, hihat: false }
    ]
  },

  pop: {
    name: 'Pop',
    description: 'Simple, driving pop beat',
    timeSignatures: ['4/4'],
    subdivisions: 8,
    pattern: [
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: true, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: true, hihat: true },
      { kick: false, snare: false, hihat: true }
    ]
  }
};

/**
 * Get pattern for specific time signature
 *
 * @param {string} styleName - Drum style name
 * @param {string} timeSignature - Time signature (e.g., '4/4', '3/4')
 * @returns {Object|null} Pattern object or null if not supported
 */
export function getPatternForTimeSignature(styleName, timeSignature) {
  const pattern = DRUM_PATTERNS[styleName];
  if (!pattern) return null;

  if (pattern.timeSignatures.includes(timeSignature)) {
    return pattern;
  }

  // Try to find a compatible pattern
  // For now, just return the pattern if it supports 4/4 and we need 4/4
  if (timeSignature === '4/4' && pattern.timeSignatures.includes('4/4')) {
    return pattern;
  }

  return null;
}

/**
 * Get all available drum styles
 *
 * @returns {Array} Array of style objects with name and description
 */
export function getAvailableStyles() {
  return Object.entries(DRUM_PATTERNS).map(([key, pattern]) => ({
    id: key,
    name: pattern.name,
    description: pattern.description,
    timeSignatures: pattern.timeSignatures
  }));
}
