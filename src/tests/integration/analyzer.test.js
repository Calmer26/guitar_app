/**
 * Integration Tests for Analyzer Module (M8)
 * 
 * Tests complete pipeline integration from pitch detection to analysis
 * and real-time analysis during playback.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { Analyzer } from '../../core/analyzer.js';
import { PitchDetector } from '../../core/pitchDetector.js';
import { PlaybackEngine } from '../../core/playbackEngine.js';
import { Storage } from '../../core/storage.js';
import { EventEmitter } from '../../utils/eventEmitter.js';

// Mock storage class for testing
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
}

// Audio sample generator for synthetic testing
class AudioSampleGenerator {
  static generateSineWave(frequency, duration, sampleRate = 44100) {
    const numSamples = duration * sampleRate;
    const samples = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      samples[i] = Math.sin(2 * Math.PI * frequency * t);
    }
    
    return samples;
  }
  
  static generateNote(noteNumber, duration, sampleRate = 44100) {
    const frequency = 440 * Math.pow(2, (noteNumber - 69) / 12);
    return this.generateSineWave(frequency, duration, sampleRate);
  }
}

// Mock media stream for testing
function createMockStream(audioData) {
  const mockStream = new EventTarget();
  mockStream.getAudioTracks = () => [{
    getSettings: () => ({ sampleRate: 44100 }),
    stop: () => {}
  }];
  mockStream.getVideoTracks = () => [];
  mockStream._audioData = audioData;
  return mockStream;
}

// Mock AudioContext for testing
class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.sampleRate = 44100;
    this.currentTime = 0;
    
    // Mock nodes
    this.mockAnalyser = {
      fftSize: 2048,
      frequencyBinCount: 1024,
      connect: () => {},
      disconnect: () => {},
      getFloatTimeDomainData: (array) => {
        // Fill with synthetic data based on current frequency
        if (this._currentFrequency) {
          const samples = AudioSampleGenerator.generateSineWave(
            this._currentFrequency, 
            array.length / this.sampleRate, 
            this.sampleRate
          );
          array.set(samples.slice(0, array.length));
        } else {
          // Fill with silence
          array.fill(0);
        }
      }
    };
  }
  
  createAnalyser() {
    return this.mockAnalyser;
  }
  
  createMediaStreamSource(stream) {
    return {
      connect: () => {},
      disconnect: () => {}
    };
  }
  
  createScriptProcessor(bufferSize, inputChannels, outputChannels) {
    return {
      connect: () => {},
      disconnect: () => {},
      onaudioprocess: null,
      setCurrentFrequency: (freq) => {
        this._currentFrequency = freq;
      }
    };
  }
  
  async resume() {
    return Promise.resolve();
  }
  
  async suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
  
  // Mock the getUserMedia method
  static async getUserMedia(constraints) {
    return createMockStream(AudioSampleGenerator.generateSineWave(440, 1));
  }
}

// Mock Tone.js for testing
global.Tone = {
  Transport: {
    start: () => {},
    stop: () => {},
    pause: () => {},
    schedule: () => {},
    scheduleRepeat: () => {}
  },
  PolySynth: class {
    triggerAttackRelease() {}
  },
  Player: class {
    start() {}
    stop() {}
  }
};

test.describe('Analyzer Integration Tests', () => {
  
  test.beforeEach(() => {
    // Mock global objects
    global.performance = {
      now: () => Date.now()
    };
    
    global.console = {
      ...console,
      warn: () => {} // Suppress warnings in tests
    };
  });

  test('Integration - pitch detection to analysis pipeline', async () => {
    const mockAudioContext = new MockAudioContext();
    mockAudioContext.getUserMedia = MockAudioContext.getUserMedia;
    
    // Setup detector
    const detector = new PitchDetector(mockAudioContext, { 
      bufferSize: 2048 
    });
    
    // Setup analyzer
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 1000 }, // C4
      { id: 'n2', midi: 62, timestamp: 1000, duration: 1000 } // D4
    ];
    
    const detectedStream = [];
    
    // Collect detected pitches
    detector.on('pitch:detected', (pitch) => {
      detectedStream.push(pitch);
    });
    
    // Start detection with synthetic audio
    await detector.start(createMockStream(
      AudioSampleGenerator.generateNote(60, 1.0) // C4 for 1 second
    ));
    
    // Simulate detection by manually triggering pitch events
    // (since we can't easily simulate the full pitch detection pipeline in tests)
    const mockPitchEvents = [
      { type: 'monophonic', midi: 60, timestamp: 0, confidence: 0.9 },
      { type: 'monophonic', midi: 62, timestamp: 1000, confidence: 0.85 }
    ];
    
    // Analyze the mock detected stream
    const result = await analyzer.analyze(reference, mockPitchEvents);
    
    // Validate results
    assert.ok(result.aggregate.correctPercentage > 0, 
      'Should detect some correct notes');
    assert.ok(result.perNote.length > 0);
    assert.strictEqual(result.perNote.length, reference.length);
    assert.ok(result.aggregate.totalNotes === reference.length);
    
    console.log('Pipeline test completed:', {
      referenceCount: reference.length,
      detectedCount: mockPitchEvents.length,
      correctNotes: result.aggregate.notesCorrect,
      totalNotes: result.aggregate.totalNotes
    });
  });

  test('Integration - real-time analysis during playback', async () => {
    const mockAudioContext = new MockAudioContext();
    
    // Setup playback engine
    const timeline = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500 },
      { id: 'n2', midi: 62, timestamp: 500, duration: 500 },
      { id: 'n3', midi: 64, timestamp: 1000, duration: 500 }
    ];
    
    const playbackEngine = new PlaybackEngine(timeline, { 
      bpm: 120 
    });
    
    // Setup detector
    const detector = new PitchDetector(mockAudioContext, {
      bufferSize: 2048
    });
    
    // Setup analyzer
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    analyzer.storage = new MockStorage();
    
    const detectedStream = [];
    let analysisResult = null;
    let playbackCompleted = false;
    
    // Collect detected pitches
    detector.on('pitch:detected', (pitch) => {
      detectedStream.push(pitch);
    });
    
    // Setup analysis trigger on playback completion
    playbackEngine.on('playback:completed', async () => {
      playbackCompleted = true;
      analysisResult = await analyzer.analyze(timeline, detectedStream);
    });
    
    // Start playback
    await playbackEngine.play();
    
    // Simulate detection during playback
    const mockPitchEvents = [
      { type: 'monophonic', midi: 60, timestamp: 0, confidence: 0.9 },
      { type: 'monophonic', midi: 62, timestamp: 500, confidence: 0.85 },
      { type: 'monophonic', midi: 64, timestamp: 1000, confidence: 0.9 }
    ];
    
    // Add events to detected stream
    mockPitchEvents.forEach(event => {
      detectedStream.push(event);
    });
    
    // Simulate playback completion
    playbackEngine.emit('playback:completed', {});
    
    // Wait for analysis to complete
    await new Promise(resolve => {
      const checkComplete = () => {
        if (analysisResult) {
          resolve();
        } else {
          setTimeout(checkComplete, 10);
        }
      };
      checkComplete();
    });
    
    // Validate results
    assert.ok(playbackCompleted, 'Playback should complete');
    assert.ok(analysisResult, 'Analysis should complete');
    assert.ok(analysisResult.aggregate.totalNotes > 0);
    assert.strictEqual(analysisResult.perNote.length, timeline.length);
    
    console.log('Real-time analysis test completed:', {
      timelineLength: timeline.length,
      detectedEvents: detectedStream.length,
      analysisResult: analysisResult.aggregate.correctPercentage
    });
  });

  test('Integration - polyphonic detection with analysis', async () => {
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 1000 }, // C4
      { id: 'n2', midi: 64, timestamp: 0, duration: 1000 }, // E4 (chord)
      { id: 'n3', midi: 67, timestamp: 1000, duration: 500 } // G4
    ];
    
    // Simulate polyphonic detection
    const detectedStream = [
      {
        type: 'polyphonic',
        timestamp: 0,
        notes: [
          { midi: 60, confidence: 0.9 },
          { midi: 64, confidence: 0.85 }
        ]
      },
      {
        type: 'polyphonic',
        timestamp: 1000,
        notes: [
          { midi: 67, confidence: 0.9 },
          { midi: 71, confidence: 0.8 } // Extra note (B4)
        ]
      }
    ];
    
    const result = await analyzer.analyze(reference, detectedStream);
    
    // Validate polyphonic handling
    assert.strictEqual(result.aggregate.totalNotes, 3);
    assert.ok(result.aggregate.notesCorrect >= 2, 
      'Should detect at least 2 notes correctly');
    assert.ok(result.aggregate.notesExtra >= 1, 
      'Should detect extra notes');
    
    // Verify chord detection
    const chordNotes = result.perNote.filter(n => 
      n.expectedTimestamp === 0 && n.classification === 'CORRECT'
    );
    assert.strictEqual(chordNotes.length, 2, 
      'Should detect both notes in chord');
    
    console.log('Polyphonic integration test:', {
      chordNotesDetected: chordNotes.length,
      extraNotes: result.aggregate.notesExtra,
      totalCorrect: result.aggregate.notesCorrect
    });
  });

  test('Integration - storage persistence through analysis', async () => {
    const analyzer = new Analyzer({ 
      enableHistory: true, 
      maxHistorySize: 5 
    });
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500, exerciseId: 'test-exercise' }
    ];
    
    const detected = [
      { type: 'monophonic', midi: 60, timestamp: 0, confidence: 1.0 }
    ];
    
    // Perform first analysis
    const result1 = await analyzer.analyze(reference, detected);
    
    // Change reference and perform second analysis
    const reference2 = [
      { id: 'n1', midi: 62, timestamp: 0, duration: 500, exerciseId: 'test-exercise' }
    ];
    
    const result2 = await analyzer.analyze(reference2, detected);
    
    // Verify history persistence
    const history = analyzer.getHistory();
    assert.strictEqual(history.length, 2, 
      'Should have 2 history entries');
    
    assert.strictEqual(history[0].correctPercentage, 100);
    assert.strictEqual(history[1].correctPercentage, 0); // Wrong pitch
    
    // Verify exercise-specific filtering
    const exerciseHistory = analyzer.getHistory('test-exercise');
    assert.strictEqual(exerciseHistory.length, 2);
    
    // Verify circular buffer
    for (let i = 0; i < 6; i++) {
      await analyzer.analyze(reference, detected);
    }
    
    const finalHistory = analyzer.getHistory();
    assert.strictEqual(finalHistory.length, 5, 
      'History should be limited to maxHistorySize');
    
    console.log('Storage persistence test:', {
      initialHistorySize: history.length,
      finalHistorySize: finalHistory.length,
      firstScore: history[0].correctPercentage,
      secondScore: history[1].correctPercentage
    });
  });

  test('Integration - tolerance changes affect analysis', async () => {
    const analyzer = new Analyzer({ 
      preset: 'NORMAL',
      pitchTolerance: 50,
      timingTolerance: 100
    });
    analyzer.storage = new MockStorage();
    
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500 }
    ];
    
    // Detected: 0.6 semitone off (60 cents) and 120ms late
    // Should be WRONG_PITCH with NORMAL (50 cent tolerance)
    // Should be CORRECT with EASY (100 cent tolerance)
    const detected = [
      { type: 'monophonic', midi: 60.6, timestamp: 120, confidence: 0.9 }
    ];
    
    // Test with NORMAL preset
    analyzer.setTolerances({ preset: 'NORMAL' });
    const resultNormal = await analyzer.analyze(reference, detected);
    
    // Test with EASY preset
    analyzer.setTolerances({ preset: 'EASY' });
    const resultEasy = await analyzer.analyze(reference, detected);
    
    // Verify different results based on tolerances
    assert.strictEqual(resultNormal.aggregate.notesWrongPitch, 1);
    assert.strictEqual(resultNormal.perNote[0].classification, 'WRONG_PITCH');
    
    assert.strictEqual(resultEasy.aggregate.notesCorrect, 1);
    assert.strictEqual(resultEasy.perNote[0].classification, 'CORRECT');
    
    // Verify timing classification differs too
    assert.strictEqual(resultNormal.aggregate.notesWrongTiming, 1);
    assert.strictEqual(resultEasy.aggregate.notesWrongTiming, 0); // 120ms < 200ms (EASY)
    
    console.log('Tolerance change test:', {
      normalClassification: resultNormal.perNote[0].classification,
      easyClassification: resultEasy.perNote[0].classification,
      normalPitchCorrect: resultNormal.perNote[0].pitchCorrect,
      easyPitchCorrect: resultEasy.perNote[0].pitchCorrect
    });
  });

  test('Integration - error handling across modules', async () => {
    const analyzer = new Analyzer();
    analyzer.storage = new MockStorage();
    
    // Test with invalid reference timeline
    await assert.rejects(
      async () => await analyzer.analyze([], []),
      { message: /empty/i }
    );
    
    // Test with null reference
    await assert.rejects(
      async () => await analyzer.analyze(null, []),
      { message: /empty/i }
    );
    
    // Test with empty detected stream (should not throw)
    const reference = [
      { id: 'n1', midi: 60, timestamp: 0, duration: 500 }
    ];
    
    const result = await analyzer.analyze(reference, []);
    
    assert.strictEqual(result.aggregate.correctPercentage, 0);
    assert.strictEqual(result.aggregate.notesMissed, 1);
    assert.strictEqual(result.perNote[0].classification, 'MISSED');
    
    console.log('Error handling test passed');
  });

  test('Integration - performance analysis with large dataset', async () => {
    const analyzer = new Analyzer({ 
      pitchTolerance: 50, 
      timingTolerance: 100 
    });
    analyzer.storage = new MockStorage();
    
    // Generate large exercise (50 notes)
    const reference = Array.from({ length: 50 }, (_, i) => ({
      id: `n${i}`,
      midi: 60 + (i % 12),
      timestamp: i * 200,
      duration: 200,
      exerciseId: 'large-exercise'
    }));
    
    // Generate detected stream with some errors
    const detected = reference.map((note, i) => ({
      type: 'monophonic',
      midi: note.midi + (i % 10 === 0 ? 1 : 0), // Add errors every 10th note
      timestamp: note.timestamp + (i % 5 === 0 ? 50 : 0), // Add timing errors
      confidence: 0.8 + (Math.random() * 0.2) // Variable confidence
    }));
    
    const startTime = performance.now();
    const result = await analyzer.analyze(reference, detected);
    const analysisTime = performance.now() - startTime;
    
    // Performance assertions
    assert.ok(analysisTime < 100, 
      `Large dataset analysis should complete in < 100ms, took ${analysisTime.toFixed(2)}ms`);
    
    // Correctness assertions
    assert.strictEqual(result.aggregate.totalNotes, 50);
    assert.ok(result.aggregate.notesCorrect >= 35, 
      'Should have reasonable correctness with intentional errors');
    assert.ok(result.aggregate.notesWrongPitch >= 3, 
      'Should detect some pitch errors');
    assert.ok(result.aggregate.notesWrongTiming >= 5, 
      'Should detect some timing errors');
    
    // Verify history integration
    const history = analyzer.getHistory('large-exercise');
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].totalNotes, 50);
    
    console.log('Performance test completed:', {
      analysisTime: analysisTime.toFixed(2) + 'ms',
      noteCount: result.aggregate.totalNotes,
      correctness: result.aggregate.correctPercentage + '%',
      historyEntries: history.length
    });
  });

  test('Integration - event emission throughout pipeline', async () => {
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
    
    const events = [];
    
    // Subscribe to all events
    analyzer.on('analysis:started', (data) => {
      events.push({ type: 'started', data });
    });
    
    analyzer.on('analysis:complete', (data) => {
      events.push({ type: 'complete', data });
    });
    
    analyzer.on('analysis:error', (data) => {
      events.push({ type: 'error', data });
    });
    
    await analyzer.analyze(reference, detected);
    
    // Validate event sequence
    assert.strictEqual(events.length, 2); // started + complete
    
    assert.strictEqual(events[0].type, 'started');
    assert.strictEqual(events[0].data.referenceCount, 1);
    assert.strictEqual(events[0].data.detectedCount, 1);
    
    assert.strictEqual(events[1].type, 'complete');
    assert.ok(events[1].data.result);
    assert.strictEqual(events[1].data.result.aggregate.notesCorrect, 1);
    
    console.log('Event emission test:', {
      eventCount: events.length,
      eventTypes: events.map(e => e.type)
    });
  });
});
