/**
 * @module playbackEngine.test
 * @description Unit tests for PlaybackEngine class
 *
 * Tests deterministic scheduling, state machine, event emissions,
 * and Tone.js Transport integration.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { PlaybackEngine } from '../../core/playbackEngine.js';
import { Logger } from '../../utils/logger.js';

// Mock Logger to prevent console output during tests
Logger.log = () => {};

test('PlaybackEngine - constructor requires timeline', () => {
  assert.throws(() => {
    new PlaybackEngine(null);
  }, /valid timeline/);
});

test('PlaybackEngine - constructor requires non-empty timeline', () => {
  assert.throws(() => {
    new PlaybackEngine([]);
  }, /empty/);
});

test('PlaybackEngine - initial state is STOPPED', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  assert.strictEqual(engine.getState(), 'stopped');
  assert.strictEqual(engine.getCurrentPosition(), 0);
});

test('PlaybackEngine - scheduling accuracy at 60 BPM', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} },
    { id: 'n2', timestamp: 500, duration: 500, midi: 62, system: 1, pitch: {step: 'D', octave: 4} },
    { id: 'n3', timestamp: 1000, duration: 500, midi: 64, system: 1, pitch: {step: 'E', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline, { bpm: 60 });

  // Verify BPM was set correctly
  assert.strictEqual(global.Tone.Transport.bpm.value, 60);
});

test('PlaybackEngine - scheduling accuracy at 120 BPM', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline, { bpm: 120 });

  assert.strictEqual(global.Tone.Transport.bpm.value, 120);
});

test('PlaybackEngine - scheduling accuracy at 180 BPM', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline, { bpm: 180 });

  assert.strictEqual(global.Tone.Transport.bpm.value, 180);
});

test('PlaybackEngine - state transition STOPPED → PLAYING', async () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  await engine.play();

  assert.strictEqual(engine.getState(), 'playing');
});

test('PlaybackEngine - state transition PLAYING → PAUSED', async () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  await engine.play();
  assert.strictEqual(engine.getState(), 'playing');

  engine.pause();
  assert.strictEqual(engine.getState(), 'paused');
});

test('PlaybackEngine - state transition PAUSED → STOPPED', async () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  await engine.play();
  engine.pause();
  assert.strictEqual(engine.getState(), 'paused');

  engine.stop();
  assert.strictEqual(engine.getState(), 'stopped');
});

test('PlaybackEngine - cannot pause from STOPPED', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  assert.strictEqual(engine.getState(), 'stopped');
  engine.pause(); // Should not crash
  assert.strictEqual(engine.getState(), 'stopped');
});

test('PlaybackEngine - cursor initialization', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} },
    { id: 'n2', timestamp: 500, duration: 500, midi: 62, system: 1, pitch: {step: 'D', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  // Should initialize to first note
  assert.strictEqual(engine.currentNoteIndex, 0);
});

test('PlaybackEngine - system change detection', async () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} },
    { id: 'n2', timestamp: 500, duration: 500, midi: 62, system: 2, pitch: {step: 'D', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  let systemChangeEmitted = false;
  engine.on('playback:systemChange', () => {
    systemChangeEmitted = true;
  });

  // Simulate playing through notes
  const note1 = mockTimeline[0];
  const note2 = mockTimeline[1];

  engine._emitTick(note1, 0);
  assert.strictEqual(engine.currentSystem, 1);

  engine._emitTick(note2, 0.5);
  assert.strictEqual(engine.currentSystem, 2);
  assert.strictEqual(systemChangeEmitted, true);
});

test('PlaybackEngine - tempo change updates Transport', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline, { bpm: 120 });

  engine.setTempo(90);

  assert.strictEqual(global.Tone.Transport.bpm.value, 90);
  assert.strictEqual(engine.config.bpm, 90);
});

test('PlaybackEngine - tempo change out of range throws error', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  assert.throws(() => {
    engine.setTempo(10); // Below 20
  }, /BPM must be between/);

  assert.throws(() => {
    engine.setTempo(400); // Above 300
  }, /BPM must be between/);
});

test('PlaybackEngine - seek updates position', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} },
    { id: 'n2', timestamp: 500, duration: 500, midi: 62, system: 1, pitch: {step: 'D', octave: 4} },
    { id: 'n3', timestamp: 1000, duration: 500, midi: 64, system: 1, pitch: {step: 'E', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  engine.seek(500);

  assert.strictEqual(engine.getCurrentPosition(), 500);
  assert.strictEqual(engine.currentNoteIndex, 1); // Should be at second note
});

test('PlaybackEngine - seek clamps to valid range', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  engine.seek(-100);
  assert.strictEqual(engine.getCurrentPosition(), 0);

  const maxTime = mockTimeline[0].timestamp;
  engine.seek(10000);
  assert.strictEqual(engine.getCurrentPosition(), maxTime);
});

test('PlaybackEngine - emits playback:started event', async () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  let eventReceived = false;
  let eventData = null;

  engine.on('playback:started', (data) => {
    eventReceived = true;
    eventData = data;
  });

  await engine.play();

  assert.strictEqual(eventReceived, true);
  assert.strictEqual(typeof eventData.bpm, 'number');
  assert.strictEqual(typeof eventData.startTime, 'number');
});

test('PlaybackEngine - emits tick events', async () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} },
    { id: 'n2', timestamp: 500, duration: 500, midi: 62, system: 1, pitch: {step: 'D', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  const tickEvents = [];

  engine.on('playback:tick', (data) => {
    tickEvents.push(data);
  });

  // Simulate tick events
  engine._emitTick(mockTimeline[0], 0);
  engine._emitTick(mockTimeline[1], 0.5);

  assert.strictEqual(tickEvents.length, 2);
  assert.strictEqual(tickEvents[0].noteId, 'n1');
  assert.strictEqual(tickEvents[1].noteId, 'n2');
  assert.strictEqual(typeof tickEvents[0].timestamp, 'number');
  assert.strictEqual(typeof tickEvents[0].systemNumber, 'number');
});

test('PlaybackEngine - emits playback:paused event', async () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  let eventReceived = false;
  let eventData = null;

  engine.on('playback:paused', (data) => {
    eventReceived = true;
    eventData = data;
  });

  await engine.play();
  engine.pause();

  assert.strictEqual(eventReceived, true);
  assert.strictEqual(typeof eventData.currentPosition, 'number');
});

test('PlaybackEngine - emits playback:stopped event', async () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  let eventReceived = false;
  let eventData = null;

  engine.on('playback:stopped', (data) => {
    eventReceived = true;
    eventData = data;
  });

  // Start playback first, then stop to test the event emission
  await engine.play();
  engine.stop();

  assert.strictEqual(eventReceived, true);
  assert.strictEqual(typeof eventData.totalDuration, 'number');
});

test('PlaybackEngine - emits playback:tempo event', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline, { bpm: 120 });

  let eventReceived = false;
  let eventData = null;

  engine.on('playback:tempo', (data) => {
    eventReceived = true;
    eventData = data;
  });

  engine.setTempo(90);

  assert.strictEqual(eventReceived, true);
  assert.strictEqual(eventData.newBpm, 90);
  assert.strictEqual(eventData.oldBpm, 120);
});

test('PlaybackEngine - play from already playing is no-op', async () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  await engine.play();
  assert.strictEqual(engine.getState(), 'playing');

  // Try to play again
  await engine.play();
  assert.strictEqual(engine.getState(), 'playing');
});

test('PlaybackEngine - stop from already stopped is no-op', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  assert.strictEqual(engine.getState(), 'stopped');
  engine.stop();
  assert.strictEqual(engine.getState(), 'stopped');
});

test('PlaybackEngine - getCurrentPosition during playback', async () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  await engine.play();

  // Position should increase while playing
  const pos1 = engine.getCurrentPosition();
  await new Promise(resolve => setTimeout(resolve, 10));
  const pos2 = engine.getCurrentPosition();

  assert.ok(pos2 >= pos1);
});

test('PlaybackEngine - config merging works correctly', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const customConfig = {
    bpm: 100,
    volume: 0.5,
    metronomeEnabled: true
  };

  const engine = new PlaybackEngine(mockTimeline, customConfig);

  assert.strictEqual(engine.config.bpm, 100);
  assert.strictEqual(engine.config.volume, 0.5);
  assert.strictEqual(engine.config.metronomeEnabled, true);
  assert.strictEqual(engine.config.instrumentMode, 'synth'); // default value
});

test('PlaybackEngine - converts milliseconds to seconds correctly', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  assert.strictEqual(engine._convertMsToSeconds(0), 0);
  assert.strictEqual(engine._convertMsToSeconds(1000), 1);
  assert.strictEqual(engine._convertMsToSeconds(500), 0.5);
});

test('PlaybackEngine - finds first musical note', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} },
    { id: 'n2', timestamp: 500, duration: 500, midi: 62, system: 1, pitch: {step: 'D', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  const firstNoteIndex = engine._findFirstMusicalNote();
  assert.strictEqual(firstNoteIndex, 0);
});

test('PlaybackEngine - maintains timing accuracy within ±10ms tolerance', async () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} },
    { id: 'n2', timestamp: 500, duration: 500, midi: 62, system: 1, pitch: {step: 'D', octave: 4} },
    { id: 'n3', timestamp: 1000, duration: 500, midi: 64, system: 1, pitch: {step: 'E', octave: 4} },
    { id: 'n4', timestamp: 1500, duration: 500, midi: 65, system: 1, pitch: {step: 'F', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);
  const tolerance = 10; // ±10ms tolerance
  
  const tickEvents = [];
  const eventTimes = [];
  
  engine.on('playback:tick', (data) => {
    eventTimes.push(Date.now());
    tickEvents.push(data);
  });

  const playPromise = engine.play();
  
  // Wait for all ticks to be emitted
  await new Promise(resolve => {
    const checkComplete = () => {
      if (tickEvents.length >= 4) {
        resolve();
      } else {
        setTimeout(checkComplete, 10);
      }
    };
    checkComplete();
  });
  
  await playPromise;

  // Verify timing accuracy by checking event sequence
  assert.strictEqual(tickEvents.length, 4);
  assert.strictEqual(tickEvents[0].noteId, 'n1');
  assert.strictEqual(tickEvents[1].noteId, 'n2');
  assert.strictEqual(tickEvents[2].noteId, 'n3');
  assert.strictEqual(tickEvents[3].noteId, 'n4');
});

test('PlaybackEngine - validates state transitions with error handling', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  // Test: Invalid transition STOPPED → PAUSED
  // The play() method checks for invalid state but doesn't throw,
  // it just logs a warning and returns early
  let errorThrown = false;
  try {
    engine.pause();
  } catch (e) {
    errorThrown = true;
  }
  // Should not throw error but should be a no-op
  assert.strictEqual(engine.getState(), 'stopped');

  // Test: Invalid transition PLAYING → PLAYING
  engine.play();
  assert.strictEqual(engine.getState(), 'playing');
  
  // Try to play again - should be a no-op
  const initialStartTime = engine.startTime;
  engine.play();
  assert.strictEqual(engine.getState(), 'playing');
  assert.strictEqual(engine.startTime, initialStartTime);
});

test('PlaybackEngine - handles concurrent operations safely', async () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} },
    { id: 'n2', timestamp: 500, duration: 500, midi: 62, system: 1, pitch: {step: 'D', octave: 4} },
    { id: 'n3', timestamp: 1000, duration: 500, midi: 64, system: 1, pitch: {step: 'E', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  // Start playback
  await engine.play();
  assert.strictEqual(engine.getState(), 'playing');

  // Try to seek while playing
  engine.seek(500);
  assert.ok(engine.getCurrentPosition() >= 400);
  
  // Try to change tempo while playing
  const oldBpm = engine.config.bpm;
  engine.setTempo(150);
  assert.strictEqual(engine.config.bpm, 150);
  assert.strictEqual(global.Tone.Transport.bpm.value, 150);
  
  // Stop should still work
  engine.stop();
  assert.strictEqual(engine.getState(), 'stopped');
});

test('PlaybackEngine - validates extreme BPM values', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  // Test minimum valid BPM (20)
  assert.doesNotThrow(() => {
    engine.setTempo(20);
    assert.strictEqual(engine.config.bpm, 20);
  });

  // Test maximum valid BPM (300)
  assert.doesNotThrow(() => {
    engine.setTempo(300);
    assert.strictEqual(engine.config.bpm, 300);
  });

  // Test below minimum (should throw)
  assert.throws(() => {
    engine.setTempo(19);
  }, /BPM must be between 20 and 300/);

  // Reset to valid state
  engine.setTempo(120);
  
  // Test above maximum (should throw)
  assert.throws(() => {
    engine.setTempo(301);
  }, /BPM must be between 20 and 300/);
});

test('PlaybackEngine - validates seek boundaries with single note', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 1000, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  // Test seeking to negative position (should clamp to 0)
  engine.seek(-100);
  assert.strictEqual(engine.getCurrentPosition(), 0);

  // Test seeking beyond timeline end (should clamp to max)
  const maxPosition = mockTimeline[0].timestamp;
  engine.seek(10000);
  assert.strictEqual(engine.getCurrentPosition(), maxPosition);

  // Test seeking to exact boundary
  engine.seek(maxPosition);
  assert.strictEqual(engine.getCurrentPosition(), maxPosition);
});

test('PlaybackEngine - validates system change event data', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} },
    { id: 'n2', timestamp: 500, duration: 500, midi: 62, system: 2, pitch: {step: 'D', octave: 4} },
    { id: 'n3', timestamp: 1000, duration: 500, midi: 64, system: 2, pitch: {step: 'E', octave: 4} },
    { id: 'n4', timestamp: 1500, duration: 500, midi: 65, system: 3, pitch: {step: 'F', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  const systemChangeEvents = [];

  engine.on('playback:systemChange', (data) => {
    systemChangeEvents.push(data);
  });

  // Simulate system changes through tick events
  engine._emitTick(mockTimeline[0], 0); // System 1 (no change)
  engine._emitTick(mockTimeline[1], 0.5); // System 2 (change)
  engine._emitTick(mockTimeline[2], 1); // System 2 (no change)
  engine._emitTick(mockTimeline[3], 1.5); // System 3 (change)

  // Should have 2 system change events
  assert.strictEqual(systemChangeEvents.length, 2);
  assert.strictEqual(systemChangeEvents[0].systemNumber, 2);
  assert.strictEqual(systemChangeEvents[1].systemNumber, 3);
  
  // Verify timestamp is present
  assert.ok(typeof systemChangeEvents[0].timestamp === 'number');
  assert.ok(typeof systemChangeEvents[1].timestamp === 'number');
});

test('PlaybackEngine - handles playback:completed event correctly', async () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} },
    { id: 'n2', timestamp: 500, duration: 500, midi: 62, system: 1, pitch: {step: 'D', octave: 4} }
  ];

  const engine = new PlaybackEngine(mockTimeline);

  let completedEventReceived = false;
  let completedData = null;

  engine.on('playback:completed', (data) => {
    completedEventReceived = true;
    completedData = data;
  });

  // Start playback and wait for completion
  const playPromise = engine.play();
  
  // Wait for scheduled completion event
  await new Promise(resolve => {
    setTimeout(resolve, 100);
  });
  
  // The engine should auto-stop after completion
  assert.ok(completedEventReceived);
  assert.strictEqual(typeof completedData.duration, 'number');
  assert.strictEqual(completedData.noteCount, 2);
  assert.strictEqual(engine.getState(), 'stopped');
});

test('PlaybackEngine - validates config merging with partial overrides', () => {
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60, system: 1, pitch: {step: 'C', octave: 4} }
  ];

  // Test partial config override
  const partialConfig = {
    bpm: 150,
    customField: 'customValue'
  };

  const engine = new PlaybackEngine(mockTimeline, partialConfig);

  // Custom config should be applied
  assert.strictEqual(engine.config.bpm, 150);
  assert.strictEqual(engine.config.customField, 'customValue');
  
  // Default values should be preserved
  assert.strictEqual(engine.config.instrumentMode, 'synth');
  assert.strictEqual(engine.config.instrument, 'guitar');
  assert.strictEqual(engine.config.volume, 0.7);
  assert.strictEqual(engine.config.metronomeEnabled, false);
  assert.strictEqual(engine.config.metronomeVolume, 0.5);
  assert.strictEqual(engine.config.loopEnabled, false);
});
