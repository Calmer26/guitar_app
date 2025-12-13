/**
 * Temporal Smoothing Tests
 *
 * Tests the temporal smoothing filter implementation in the analyzer.
 * This filter reduces false negatives by smoothing rapid pitch fluctuations.
 */

import { Analyzer } from '../../core/analyzer.js';
import { SettingsManager } from '../../utils/settingsManager.js';

describe('Temporal Smoothing', () => {
  let analyzer;
  let settingsManager;

  beforeEach(() => {
    // Mock settings manager for testing
    settingsManager = {
      get: jest.fn((key) => {
        if (key === 'g4:settings') {
          return { analyzerSmoothing: 0.5 }; // Default 50% smoothing
        }
        return {};
      })
    };

    analyzer = new Analyzer();
    // Override the storage to use our mock
    analyzer.storage = settingsManager;
  });

  test('should apply temporal smoothing to detected stream', () => {
    // Create test data with rapid pitch fluctuations
    const detectedStream = [
      { midi: 60, frequency: 261.63, confidence: 0.9, timestamp: 0 },
      { midi: 61, frequency: 277.18, confidence: 0.8, timestamp: 50 }, // Fluctuation
      { midi: 60, frequency: 261.63, confidence: 0.9, timestamp: 100 },
      { midi: 59, frequency: 246.94, confidence: 0.7, timestamp: 150 }, // Another fluctuation
      { midi: 60, frequency: 261.63, confidence: 0.9, timestamp: 200 }
    ];

    const smoothed = analyzer._applyTemporalSmoothing(detectedStream, { smoothingFactor: 0.5 });

    // Should maintain same number of events
    expect(smoothed).toHaveLength(5);

    // Should have smoothed property
    expect(smoothed[0]).toHaveProperty('smoothed', true);
    expect(smoothed[0]).toHaveProperty('originalMidi', 60);

    // Should boost confidence slightly
    expect(smoothed[0].confidence).toBeGreaterThan(0.9);
  });

  test('should handle empty stream', () => {
    const smoothed = analyzer._applyTemporalSmoothing([], { smoothingFactor: 0.5 });
    expect(smoothed).toEqual([]);
  });

  test('should handle single event', () => {
    const singleEvent = [{ midi: 60, frequency: 261.63, confidence: 0.9, timestamp: 0 }];
    const smoothed = analyzer._applyTemporalSmoothing(singleEvent, { smoothingFactor: 0.5 });

    expect(smoothed).toHaveLength(1);
    expect(smoothed[0]).toEqual(singleEvent[0]);
  });

  test('should respect smoothing factor parameter', () => {
    const detectedStream = [
      { midi: 60, frequency: 261.63, confidence: 0.9, timestamp: 0 },
      { midi: 61, frequency: 277.18, confidence: 0.8, timestamp: 10 }
    ];

    // Test with low smoothing (smaller window)
    const lowSmooth = analyzer._applyTemporalSmoothing(detectedStream, { smoothingFactor: 0.1 });
    expect(lowSmooth).toHaveLength(2);

    // Test with high smoothing (larger window)
    const highSmooth = analyzer._applyTemporalSmoothing(detectedStream, { smoothingFactor: 0.9 });
    expect(highSmooth).toHaveLength(2);
  });

  test('should find dominant MIDI note in window', () => {
    // Create stream where one note appears more frequently
    const detectedStream = [
      { midi: 60, frequency: 261.63, confidence: 0.9, timestamp: 0 },
      { midi: 61, frequency: 277.18, confidence: 0.8, timestamp: 20 },
      { midi: 60, frequency: 261.63, confidence: 0.9, timestamp: 40 },
      { midi: 60, frequency: 261.63, confidence: 0.9, timestamp: 60 },
      { midi: 61, frequency: 277.18, confidence: 0.8, timestamp: 80 }
    ];

    const smoothed = analyzer._applyTemporalSmoothing(detectedStream, { smoothingFactor: 0.5 });

    // MIDI 60 should be dominant (appears 3 times vs 2 times for 61)
    expect(smoothed[0].midi).toBe(60);
    expect(smoothed[0].originalMidi).toBe(60);
  });

  test('should average frequency of dominant MIDI notes', () => {
    const detectedStream = [
      { midi: 60, frequency: 260, confidence: 0.9, timestamp: 0 },
      { midi: 60, frequency: 263, confidence: 0.9, timestamp: 20 },
      { midi: 60, frequency: 262, confidence: 0.9, timestamp: 40 }
    ];

    const smoothed = analyzer._applyTemporalSmoothing(detectedStream, { smoothingFactor: 0.5 });

    // Should average the frequencies: (260 + 263 + 262) / 3 = 261.666...
    expect(smoothed[0].frequency).toBeCloseTo(261.67, 1);
  });
});
