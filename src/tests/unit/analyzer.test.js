/**
 * Unit Tests for Analyzer Module (M8)
 * 
 * Tests the Dynamic Time Warping algorithm, per-note evaluation,
 * aggregate scoring, tolerance configuration, and performance history.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { Analyzer, ToleranceConfig, TOLERANCE_PRESETS } from '../../core/analyzer.js';
import { Storage } from '../../core/storage.js';

// Mock Storage class for testing
class MockStorage {
  constructor() {
    this.data = new Map();
  }
  
  get(key, defaultValue = null) {
    return this.data.get(key) || defaultValue;
  }
  
  set(key, value) {
    this.data.set(key, value);
    return true;
  }
  
  delete(key) {
    return this.data.delete(key);
  }
  
  has(key) {
    return this.data.has(key);
  }
}

test.describe('Analyzer', () => {
  
  test.beforeEach(() => {
    // Reset global state before each test
    global.console = {
      ...console,
      warn: () => {} // Suppress warnings in tests
    };
  });

  test('should initialize with default configuration', () => {
    const analyzer = new Analyzer();
    
    assert.strictEqual(analyzer.tolerances.preset, 'NORMAL');
    assert.strictEqual(analyzer.tolerances.pitch, 50);
    assert.strictEqual(analyzer.tolerances.timing, 100);
    assert.strictEqual(analyzer.config.enableHistory, true);
    assert.strictEqual(analyzer.config.maxHistorySize, 100);
  });

  test('should initialize with custom configuration', () => {
    const analyzer = new Analyzer({
      preset: 'EASY',
      enableHistory: false,
      maxHistorySize: 50
    });
    
    assert.strictEqual(analyzer.tolerances.preset, 'EASY');
    assert.strictEqual(analyzer.tolerances.pitch, 100);
    assert.strictEqual(analyzer.tolerances.timing, 200);
    assert.strictEqual(analyzer.config.enableHistory, false);
    assert.strictEqual(analyzer.config.maxHistorySize, 50);
  });

  test('Analyzer - perfect synthetic performance yields 100% score', async () => {
    const analyzer = new Analyzer({
      pitchTolerance: 50,
      timingTolerance: 100
    });
    
    // Mock storage
    analyzer.storage = new MockStorage();
    
    // Create reference timeline
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500 },
      { id: 'n2', midi: 62, timestamp: 500, duration: 500 },
      { id: 'n3', midi: 64, timestamp: 1000, duration: 500 }
    ];
    
    // Create perfect detected stream
    const detected = [
      { type: 'monophonic', midi: 60, timestamp: 0, confidence: 1.0 },
      { type: 'monophonic', midi: 62, timestamp: 500, confidence: 1.0 },
      { type: 'monophonic', midi: 64, timestamp: 1000, confidence: 1.0 }
    ];
    
    const result = await analyzer.analyze(reference, detected);
    
    assert.strictEqual(result.aggregate.correctPercentage, 100, 
      'Perfect performance should be 100%');
    assert.strictEqual(result.aggregate.notesCorrect, 3);
    assert.strictEqual(result.aggregate.notesMissed, 0);
    assert.strictEqual(result.aggregate.notesWrongPitch, 0);
    assert.strictEqual(result.aggregate.notesWrongTiming, 0);
    assert.strictEqual(result.aggregate.notesExtra, 0);
    assert.strictEqual(result.aggregate.totalNotes, 3);
  });

  test('Analyzer - intentional pitch errors flagged as WRONG_PITCH', async () => {
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500 },
      { id: 'n2', midi: 62, timestamp: 500, duration: 500 }
    ];
    
    // Wrong notes detected (1 semitone off)
    const detected = [
      { type: 'monophonic', midi: 61, timestamp: 0, confidence: 0.9 },  // C# instead of C
      { type: 'monophonic', midi: 64, timestamp: 500, confidence: 0.9 } // E instead of D
    ];
    
    const result = await analyzer.analyze(reference, detected);
    
    assert.strictEqual(result.aggregate.notesWrongPitch, 2, 
      'Should flag 2 wrong pitch notes');
    assert.strictEqual(result.aggregate.notesCorrect, 0);
    assert.strictEqual(result.aggregate.notesMissed, 0);
    assert.strictEqual(result.perNote[0].classification, 'WRONG_PITCH');
    assert.strictEqual(result.perNote[1].classification, 'WRONG_PITCH');
    assert.strictEqual(result.perNote[0].pitchDeviation, 1);
    assert.strictEqual(result.perNote[1].pitchDeviation, 2);
  });

  test('Analyzer - intentional timing errors flagged correctly', async () => {
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500 },
      { id: 'n2', midi: 62, timestamp: 500, duration: 500 }
    ];
    
    // Correct pitch but late timing (150ms late, outside 100ms tolerance)
    const detected = [
      { type: 'monophonic', midi: 60, timestamp: 150, confidence: 0.9 },  // 150ms late
      { type: 'monophonic', midi: 62, timestamp: 650, confidence: 0.9 }   // 150ms late
    ];
    
    const result = await analyzer.analyze(reference, detected);
    
    assert.strictEqual(result.aggregate.notesWrongTiming, 2, 
      'Should flag 2 notes with wrong timing');
    assert.strictEqual(result.aggregate.notesCorrect, 0);
    assert.strictEqual(result.aggregate.notesMissed, 0);
    assert.ok(Math.abs(result.perNote[0].timingDeviation) > 100, 
      'Timing deviation should exceed tolerance');
    assert.strictEqual(result.perNote[0].timingDeviation, 150);
    assert.strictEqual(result.perNote[1].timingDeviation, 150);
  });

  test('Analyzer - DTW alignment handles missing and extra notes', async () => {
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500 },
      { id: 'n2', midi: 62, timestamp: 500, duration: 500 },
      { id: 'n3', midi: 64, timestamp: 1000, duration: 500 }
    ];
    
    // Detected: correct n1, missed n2, correct n3, extra note
    const detected = [
      { type: 'monophonic', midi: 60, timestamp: 0, confidence: 0.9 },
      // n2 missed
      { type: 'monophonic', midi: 64, timestamp: 1000, confidence: 0.9 },
      { type: 'monophonic', midi: 65, timestamp: 1500, confidence: 0.8 } // Extra
    ];
    
    const result = await analyzer.analyze(reference, detected);
    
    assert.strictEqual(result.aggregate.notesCorrect, 2, 'Should have 2 correct notes');
    assert.strictEqual(result.aggregate.notesMissed, 1, 'Should have 1 missed note');
    assert.strictEqual(result.aggregate.notesExtra, 1, 'Should have 1 extra note');
    
    // Verify missed note classification
    const missedNote = result.perNote.find(n => n.noteId === 'n2');
    assert.strictEqual(missedNote.classification, 'MISSED');
    assert.strictEqual(missedNote.detectedMidi, null);
    
    // Verify correct notes
    const correctNotes = result.perNote.filter(n => n.classification === 'CORRECT');
    assert.strictEqual(correctNotes.length, 2);
  });

  test('Analyzer - tolerance presets apply correctly', () => {
    const analyzer = new Analyzer({ preset: 'EASY' });
    
    // Verify EASY preset values
    assert.strictEqual(analyzer.tolerances.pitch, 100);
    assert.strictEqual(analyzer.tolerances.timing, 200);
    assert.strictEqual(analyzer.tolerances.preset, 'EASY');
    
    // Change to HARD
    analyzer.setTolerances({ preset: 'HARD' });
    assert.strictEqual(analyzer.tolerances.pitch, 25);
    assert.strictEqual(analyzer.tolerances.timing, 50);
    assert.strictEqual(analyzer.tolerances.preset, 'HARD');
    
    // Custom tolerance
    analyzer.setTolerances({ preset: 'CUSTOM', pitch: 75, timing: 150 });
    assert.strictEqual(analyzer.tolerances.pitch, 75);
    assert.strictEqual(analyzer.tolerances.timing, 150);
    assert.strictEqual(analyzer.tolerances.preset, 'CUSTOM');
  });

  test('Analyzer - timing consistency score calculation', async () => {
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500 },
      { id: 'n2', midi: 62, timestamp: 500, duration: 500 },
      { id: 'n3', midi: 64, timestamp: 1000, duration: 500 },
      { id: 'n4', midi: 65, timestamp: 1500, duration: 500 }
    ];
    
    // Consistent timing (all 10ms early)
    const detectedConsistent = [
      { type: 'monophonic', midi: 60, timestamp: -10, confidence: 0.9 },
      { type: 'monophonic', midi: 62, timestamp: 490, confidence: 0.9 },
      { type: 'monophonic', midi: 64, timestamp: 990, confidence: 0.9 },
      { type: 'monophonic', midi: 65, timestamp: 1490, confidence: 0.9 }
    ];
    
    const resultConsistent = await analyzer.analyze(reference, detectedConsistent);
    
    // Should have high consistency score (all within tolerance, consistent)
    assert.ok(resultConsistent.aggregate.timingConsistencyScore > 90,
      'Consistent timing should score high');
    
    // Inconsistent timing (varying errors)
    const detectedInconsistent = [
      { type: 'monophonic', midi: 60, timestamp: -50, confidence: 0.9 },
      { type: 'monophonic', midi: 62, timestamp: 550, confidence: 0.9 },
      { type: 'monophonic', midi: 64, timestamp: 980, confidence: 0.9 },
      { type: 'monophonic', midi: 65, timestamp: 1600, confidence: 0.9 }
    ];
    
    const resultInconsistent = await analyzer.analyze(reference, detectedInconsistent);
    
    // Should have lower consistency score
    assert.ok(resultInconsistent.aggregate.timingConsistencyScore < 
      resultConsistent.aggregate.timingConsistencyScore,
      'Inconsistent timing should score lower');
  });

  test('Analyzer - handles polyphonic detected notes', async () => {
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500 },
      { id: 'n2', midi: 64, timestamp: 0, duration: 500 } // Chord (C and E)
    ];
    
    // Polyphonic detection of chord
    const detected = [
      {
        type: 'polyphonic',
        timestamp: 0,
        notes: [
          { midi: 60, confidence: 0.9 },
          { midi: 64, confidence: 0.85 }
        ]
      }
    ];
    
    const result = await analyzer.analyze(reference, detected);
    
    assert.strictEqual(result.aggregate.notesCorrect, 2, 
      'Should correctly identify both notes in chord');
    assert.strictEqual(result.aggregate.notesMissed, 0);
    assert.strictEqual(result.aggregate.totalNotes, 2);
  });

  test('Analyzer - performance history stored and retrieved', async () => {
    const mockStorage = new MockStorage();
    const analyzer = new Analyzer({ 
      enableHistory: true, 
      maxHistorySize: 3 
    });
    analyzer.storage = mockStorage;
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500, exerciseId: 'test-ex' }
    ];
    
    const detected = [
      { type: 'monophonic', midi: 60, timestamp: 0, confidence: 1.0 }
    ];
    
    // Perform multiple analyses
    await analyzer.analyze(reference, detected);
    await analyzer.analyze(reference, detected);
    await analyzer.analyze(reference, detected);
    await analyzer.analyze(reference, detected); // 4th one (exceeds max)
    
    const history = analyzer.getHistory();
    
    assert.strictEqual(history.length, 3, 
      'History should be limited to maxHistorySize (circular buffer)');
    
    // Verify structure
    assert.ok(history[0].exerciseId);
    assert.ok(history[0].timestamp);
    assert.ok(typeof history[0].correctPercentage === 'number');
    assert.ok(history[0].correctPercentage === 100);
  });

  test('Analyzer - history export and import', async () => {
    const analyzer = new Analyzer({ enableHistory: true });
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500, exerciseId: 'test-ex' }
    ];
    
    const detected = [
      { type: 'monophonic', midi: 60, timestamp: 0, confidence: 1.0 }
    ];
    
    await analyzer.analyze(reference, detected);
    
    // Export
    const exported = analyzer.exportHistory();
    assert.ok(typeof exported === 'string');
    
    const parsed = JSON.parse(exported);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].correctPercentage, 100);
    
    // Clear history
    analyzer.clearHistory();
    assert.strictEqual(analyzer.getHistory().length, 0);
    
    // Import
    analyzer.importHistory(exported);
    assert.strictEqual(analyzer.getHistory().length, 1);
  });

  test('Analyzer - handles empty detection stream gracefully', async () => {
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500 },
      { id: 'n2', midi: 62, timestamp: 500, duration: 500 }
    ];
    
    const detected = []; // No notes detected
    
    const result = await analyzer.analyze(reference, detected);
    
    assert.strictEqual(result.aggregate.correctPercentage, 0);
    assert.strictEqual(result.aggregate.notesMissed, 2);
    assert.strictEqual(result.aggregate.notesCorrect, 0);
    assert.strictEqual(result.perNote.length, 2);
    assert.strictEqual(result.perNote[0].classification, 'MISSED');
    assert.strictEqual(result.perNote[1].classification, 'MISSED');
  });

  test('Analyzer - validation of input parameters', async () => {
    const analyzer = new Analyzer();
    analyzer.storage = new MockStorage();
    
    // Empty reference timeline should throw error
    await assert.rejects(
      async () => await analyzer.analyze([], []),
      { message: /empty/i }
    );
    
    // Null reference should throw error
    await assert.rejects(
      async () => await analyzer.analyze(null, []),
      { message: /empty/i }
    );
    
    // Non-array reference should throw error
    await assert.rejects(
      async () => await analyzer.analyze('not-an-array', []),
      { message: /must be an array/i }
    );
  });

  test('Analyzer - tolerance configuration edge cases', () => {
    const analyzer = new Analyzer();
    
    // Invalid preset should throw error
    assert.throws(() => {
      analyzer.setTolerances({ preset: 'INVALID' });
    }, { message: /Unknown tolerance preset/ });
    
    // Invalid custom tolerance should throw error
    assert.throws(() => {
      analyzer.setTolerances({ preset: 'CUSTOM' }); // No pitch/timing provided
    });
  });

  test('Analyzer - export/import validation', async () => {
    const analyzer = new Analyzer({ enableHistory: true });
    analyzer.storage = new MockStorage();
    
    // Invalid JSON should throw error
    assert.throws(() => {
      analyzer.importHistory('invalid-json');
    }, { message: /Import failed/ });
    
    // Invalid format should throw error
    assert.throws(() => {
      analyzer.importHistory('{"not": "an array"}');
    }, { message: /Invalid history format/ });
    
    // Invalid entry format should throw error
    assert.throws(() => {
      analyzer.importHistory(JSON.stringify([
        { invalid: 'entry' } // Missing required fields
      ]));
    }, { message: /Invalid history entry format/ });
  });

  test('Analyzer - single note exercise handling', async () => {
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500 }
    ];
    
    const detected = [
      { type: 'monophonic', midi: 60, timestamp: 0, confidence: 1.0 }
    ];
    
    const result = await analyzer.analyze(reference, detected);
    
    assert.strictEqual(result.aggregate.totalNotes, 1);
    assert.strictEqual(result.aggregate.notesCorrect, 1);
    assert.strictEqual(result.aggregate.notesMissed, 0);
    assert.strictEqual(result.perNote.length, 1);
    assert.strictEqual(result.perNote[0].classification, 'CORRECT');
  });

  test('Analyzer - notes within tolerance are correct', async () => {
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500 }
    ];
    
    // Within tolerance: 0.4 semitone (40 cents) and 80ms
    const detected = [
      { type: 'monophonic', midi: 60.4, timestamp: 80, confidence: 0.9 }
    ];
    
    const result = await analyzer.analyze(reference, detected);
    
    assert.strictEqual(result.aggregate.notesCorrect, 1);
    assert.strictEqual(result.aggregate.notesWrongPitch, 0);
    assert.strictEqual(result.aggregate.notesWrongTiming, 0);
    assert.strictEqual(result.perNote[0].classification, 'CORRECT');
    assert.strictEqual(result.perNote[0].pitchCorrect, true);
    assert.strictEqual(result.perNote[0].timingCorrect, true);
  });

  test('Analyzer - notes exactly at tolerance boundary', async () => {
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500 }
    ];
    
    // Exactly at tolerance boundary: 0.5 semitone (50 cents) and 100ms
    const detected = [
      { type: 'monophonic', midi: 60.5, timestamp: 100, confidence: 0.9 }
    ];
    
    const result = await analyzer.analyze(reference, detected);
    
    assert.strictEqual(result.aggregate.notesCorrect, 1);
    assert.strictEqual(result.perNote[0].classification, 'CORRECT');
    // At boundary should be considered correct
    assert.strictEqual(result.perNote[0].pitchCorrect, true);
    assert.strictEqual(result.perNote[0].timingCorrect, true);
  });

  test('Analyzer - priority when both pitch and timing are wrong', async () => {
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500 }
    ];
    
    // Both wrong: 1 semitone (100 cents) and 150ms
    const detected = [
      { type: 'monophonic', midi: 61, timestamp: 150, confidence: 0.9 }
    ];
    
    const result = await analyzer.analyze(reference, detected);
    
    // Should be classified as WRONG_PITCH (prioritized)
    assert.strictEqual(result.perNote[0].classification, 'WRONG_PITCH');
    assert.strictEqual(result.aggregate.notesWrongPitch, 1);
    assert.strictEqual(result.aggregate.notesWrongTiming, 0);
  });

  test('Analyzer - getTolerances method', () => {
    const analyzer = new Analyzer({ preset: 'HARD' });
    
    const tolerances = analyzer.getTolerances();
    
    assert.strictEqual(tolerances.pitch, 25);
    assert.strictEqual(tolerances.timing, 50);
    assert.strictEqual(tolerances.preset, 'HARD');
  });

  test('Analyzer - history filtering by exerciseId', async () => {
    const analyzer = new Analyzer({ enableHistory: true });
    analyzer.storage = new MockStorage();
    
    const reference1 = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500, exerciseId: 'exercise-1' }
    ];
    
    const reference2 = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500, exerciseId: 'exercise-2' }
    ];
    
    const detected = [
      { type: 'monophonic', midi: 60, timestamp: 0, confidence: 1.0 }
    ];
    
    await analyzer.analyze(reference1, detected);
    await analyzer.analyze(reference2, detected);
    
    const allHistory = analyzer.getHistory();
    assert.strictEqual(allHistory.length, 2);
    
    const exercise1History = analyzer.getHistory('exercise-1');
    assert.strictEqual(exercise1History.length, 1);
    assert.strictEqual(exercise1History[0].exerciseId, 'exercise-1');
    
    const exercise2History = analyzer.getHistory('exercise-2');
    assert.strictEqual(exercise2History.length, 1);
    assert.strictEqual(exercise2History[0].exerciseId, 'exercise-2');
    
    const nonExistentHistory = analyzer.getHistory('non-existent');
    assert.strictEqual(nonExistentHistory.length, 0);
  });

  test('Analyzer - clear history by exerciseId', async () => {
    const analyzer = new Analyzer({ enableHistory: true });
    analyzer.storage = new MockStorage();
    
    const reference1 = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500, exerciseId: 'exercise-1' }
    ];
    
    const reference2 = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500, exerciseId: 'exercise-2' }
    ];
    
    const detected = [
      { type: 'monophonic', midi: 60, timestamp: 0, confidence: 1.0 }
    ];
    
    await analyzer.analyze(reference1, detected);
    await analyzer.analyze(reference2, detected);
    
    assert.strictEqual(analyzer.getHistory().length, 2);
    
    // Clear only exercise-1
    analyzer.clearHistory('exercise-1');
    
    assert.strictEqual(analyzer.getHistory().length, 1);
    assert.strictEqual(analyzer.getHistory('exercise-1').length, 0);
    assert.strictEqual(analyzer.getHistory('exercise-2').length, 1);
  });

  test('Analyzer - event emission during analysis', async () => {
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500 }
    ];
    
    const detected = [
      { type: 'monophonic', midi: 60, timestamp: 0, confidence: 1.0 }
    ];
    
    let startedEvent = null;
    let completeEvent = null;
    
    analyzer.on('analysis:started', (data) => {
      startedEvent = data;
    });
    
    analyzer.on('analysis:complete', (data) => {
      completeEvent = data;
    });
    
    await analyzer.analyze(reference, detected);
    
    assert.ok(startedEvent);
    assert.strictEqual(startedEvent.referenceCount, 1);
    assert.strictEqual(startedEvent.detectedCount, 1);
    
    assert.ok(completeEvent);
    assert.ok(completeEvent.result);
    assert.strictEqual(completeEvent.result.aggregate.notesCorrect, 1);
  });

  test('Analyzer - error event emission on invalid input', async () => {
    const analyzer = new Analyzer();
    analyzer.storage = new MockStorage();
    
    let errorEvent = null;
    
    analyzer.on('analysis:error', (data) => {
      errorEvent = data;
    });
    
    await assert.rejects(
      async () => await analyzer.analyze([], []),
      { message: /empty/i }
    );
    
    assert.ok(errorEvent);
    assert.ok(errorEvent.error);
    assert.ok(errorEvent.error.includes('empty'));
  });

  test('Analyzer - ToleranceConfig class functionality', () => {
    // Test all presets
    assert.throws(() => {
      new ToleranceConfig('INVALID_PRESET');
    }, { message: /Unknown tolerance preset/ });
    
    const easy = new ToleranceConfig('EASY');
    assert.strictEqual(easy.pitch, 100);
    assert.strictEqual(easy.timing, 200);
    assert.strictEqual(easy.preset, 'EASY');
    
    const normal = new ToleranceConfig('NORMAL');
    assert.strictEqual(normal.pitch, 50);
    assert.strictEqual(normal.timing, 100);
    assert.strictEqual(normal.preset, 'NORMAL');
    
    const hard = new ToleranceConfig('HARD');
    assert.strictEqual(hard.pitch, 25);
    assert.strictEqual(hard.timing, 50);
    assert.strictEqual(hard.preset, 'HARD');
    
    const custom = new ToleranceConfig('CUSTOM', 75, 150);
    assert.strictEqual(custom.pitch, 75);
    assert.strictEqual(custom.timing, 150);
    assert.strictEqual(custom.preset, 'CUSTOM');
    
    const customDefaults = new ToleranceConfig('CUSTOM'); // Uses defaults
    assert.strictEqual(customDefaults.pitch, 50);
    assert.strictEqual(customDefaults.timing, 100);
    assert.strictEqual(customDefaults.preset, 'CUSTOM');
  });

  test('Analyzer - very large exercise performance', async () => {
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    
    analyzer.storage = new MockStorage();
    
    // Generate 100-note exercise
    const reference = Array.from({ length: 100 }, (_, i) => ({
      id: `n${i}`,
      midi: 60 + (i % 12),
      timestamp: i * 500,
      duration: 500
    }));
    
    // Generate synthetic perfect performance
    const detected = reference.map(note => ({
      type: 'monophonic',
      midi: note.midi,
      timestamp: note.timestamp,
      confidence: 0.9
    }));
    
    const startTime = performance.now();
    const result = await analyzer.analyze(reference, detected);
    const duration = performance.now() - startTime;
    
    // Performance assertion
    assert.ok(duration < 100, 
      `Analysis took ${duration.toFixed(2)}ms, should be < 100ms`);
    
    // Correctness assertion
    assert.strictEqual(result.aggregate.correctPercentage, 100);
    assert.strictEqual(result.aggregate.totalNotes, 100);
    assert.ok(result.analysisTime > 0);
    
    console.log(`Analysis of 100 notes completed in ${duration.toFixed(2)}ms`);
  });

  test('Analyzer - TOLERANCE_PRESETS export', () => {
    assert.ok(TOLERANCE_PRESETS.EASY);
    assert.ok(TOLERANCE_PRESETS.NORMAL);
    assert.ok(TOLERANCE_PRESETS.HARD);
    assert.ok(TOLERANCE_PRESETS.CUSTOM);
    
    assert.strictEqual(TOLERANCE_PRESETS.EASY.pitch, 100);
    assert.strictEqual(TOLERANCE_PRESETS.NORMAL.pitch, 50);
    assert.strictEqual(TOLERANCE_PRESETS.HARD.pitch, 25);
  });

  test('Analyzer - analysis with different confidence levels', async () => {
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500 }
    ];
    
    const detected = [
      { type: 'monophonic', midi: 60, timestamp: 0, confidence: 0.5 }
    ];
    
    const result = await analyzer.analyze(reference, detected);
    
    // Low confidence but correct pitch/timing should still be CORRECT
    assert.strictEqual(result.aggregate.notesCorrect, 1);
    assert.strictEqual(result.perNote[0].detectedConfidence, 0.5);
    assert.strictEqual(result.perNote[0].classification, 'CORRECT');
  });
});
