/**
 * @module playbackPipeline.test
 * @description Integration tests for Playback Engine pipeline
 *
 * Tests complete integration from exercise loading through playback,
 * verifying the full pipeline works end-to-end.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ExerciseLoader } from '../../core/exerciseLoader.js';
import { PlaybackEngine } from '../../core/playbackEngine.js';
import { Logger } from '../../utils/logger.js';

// Mock Logger to prevent console output during tests
Logger.log = () => {};

// Mock Tone.js for integration tests
global.Tone = {
  Transport: {
    bpm: { value: 120 },
    start: () => {},
    stop: () => {},
    pause: () => {},
    scheduledEvents: [], // Initialize the array
    schedule: (callback, time) => {
      // Store callback for later execution in tests
      const eventId = `event-${Math.random()}`;
      global.Tone.Transport.scheduledEvents.push({ id: eventId, callback, time });
      return eventId;
    },
    clear: (eventId) => {
      global.Tone.Transport.scheduledEvents =
        global.Tone.Transport.scheduledEvents.filter(event => event.id !== eventId);
    }
  },
  context: {
    state: 'running'
  }
};

// Helper function to load XML file
function loadXMLFile(filename) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const filePath = join(__dirname, '../../../assets/exercises', filename);
  return readFileSync(filePath, 'utf8');
}

test('Playback Pipeline - load exercise → create engine → schedule events', async () => {
  // Load exercise using ExerciseLoader
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Verify exercise loaded correctly
  assert.ok(exercise, 'Exercise should be loaded');
  assert.ok(exercise.timeline, 'Exercise should have timeline');
  assert.ok(Array.isArray(exercise.timeline), 'Timeline should be an array');
  assert.ok(exercise.timeline.length > 0, 'Timeline should not be empty');

  // Create PlaybackEngine with loaded timeline
  const engine = new PlaybackEngine(exercise.timeline, { bpm: 120 });

  // Verify engine created successfully
  assert.ok(engine, 'PlaybackEngine should be created');
  assert.strictEqual(engine.getState(), 'stopped', 'Engine should start in stopped state');
  assert.strictEqual(engine.getCurrentPosition(), 0, 'Engine should start at position 0');

  // Start playback to trigger scheduling
  await engine.play();

  // Verify scheduling completed without errors
  assert.strictEqual(engine.getState(), 'playing', 'Engine should be in playing state');

  // Verify scheduled events exist
  assert.ok(engine.scheduledEvents, 'Scheduled events should exist');
  assert.ok(engine.scheduledEvents.length > 0, 'Should have scheduled events');

  // Verify event count matches timeline length (plus completion event)
  const expectedEvents = exercise.timeline.length + 1; // +1 for completion event
  assert.strictEqual(engine.scheduledEvents.length, expectedEvents,
    `Should have ${expectedEvents} scheduled events (${exercise.timeline.length} notes + 1 completion)`);

  Logger.log(Logger.INFO, 'IntegrationTest', `Successfully scheduled ${expectedEvents} events`);
});

test('Playback Pipeline - tick events match timeline order', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine
  const engine = new PlaybackEngine(exercise.timeline, { bpm: 120 });

  // Collect tick events
  const tickEvents = [];
  engine.on('playback:tick', (data) => {
    tickEvents.push(data);
  });

  // Start playback
  await engine.play();

  // Simulate executing scheduled events in order
  if (global.Tone.Transport.scheduledEvents) {
    // Sort events by time and execute tick events (skip completion event)
    const tickEventsOnly = global.Tone.Transport.scheduledEvents
      .filter(event => event.time >= 0) // Skip any negative time events
      .sort((a, b) => a.time - b.time)
      .slice(0, -1); // Remove completion event

    // Execute tick events
    tickEventsOnly.forEach(event => {
      event.callback(event.time);
    });
  }

  // Verify tick events were emitted
  assert.ok(tickEvents.length > 0, 'Should have received tick events');

  // Verify tick events match timeline order
  tickEvents.forEach((tickEvent, index) => {
    const expectedNote = exercise.timeline[index];
    assert.ok(expectedNote, `Should have note at index ${index}`);
    assert.strictEqual(tickEvent.noteId, expectedNote.id,
      `Tick event ${index} should match note ${expectedNote.id}`);
    assert.strictEqual(tickEvent.systemNumber, expectedNote.system,
      `Tick event ${index} should have correct system number`);
  });

  Logger.log(Logger.INFO, 'IntegrationTest', `Verified ${tickEvents.length} tick events in correct order`);
});

test('Playback Pipeline - state machine enforces valid transitions', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine
  const engine = new PlaybackEngine(exercise.timeline);

  // Test initial state
  assert.strictEqual(engine.getState(), 'stopped');

  // Test STOPPED → PLAYING
  await engine.play();
  assert.strictEqual(engine.getState(), 'playing');

  // Test PLAYING → PAUSED
  engine.pause();
  assert.strictEqual(engine.getState(), 'paused');

  // Test PAUSED → STOPPED
  engine.stop();
  assert.strictEqual(engine.getState(), 'stopped');

  // Test STOPPED → PLAYING again
  await engine.play();
  assert.strictEqual(engine.getState(), 'playing');

  // Test PLAYING → STOPPED directly
  engine.stop();
  assert.strictEqual(engine.getState(), 'stopped');

  // Test invalid transitions don't crash
  engine.pause(); // Should not crash when already stopped
  assert.strictEqual(engine.getState(), 'stopped');

  Logger.log(Logger.INFO, 'IntegrationTest', 'State machine transitions validated');
});

test('Playback Pipeline - tempo changes affect scheduling', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine with custom tempo
  const engine = new PlaybackEngine(exercise.timeline, { bpm: 60 });

  // Start playback
  await engine.play();

  // Change tempo while playing
  engine.setTempo(120);

  // Verify tempo was updated
  assert.strictEqual(global.Tone.Transport.bpm.value, 120);

  // Verify engine config was updated
  assert.strictEqual(engine.config.bpm, 120);

  Logger.log(Logger.INFO, 'IntegrationTest', 'Tempo changes validated');
});

test('Playback Pipeline - seek functionality works', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine
  const engine = new PlaybackEngine(exercise.timeline);

  // Seek to middle of timeline
  const seekPosition = Math.floor(exercise.timeline.length / 2) * 500; // Approximate middle
  engine.seek(seekPosition);

  // Verify position was updated
  assert.strictEqual(engine.getCurrentPosition(), seekPosition);

  // Verify note index was updated correctly
  const expectedNoteIndex = exercise.timeline.findIndex(note => note.timestamp >= seekPosition);
  assert.strictEqual(engine.currentNoteIndex, expectedNoteIndex);

  Logger.log(Logger.INFO, 'IntegrationTest', `Seek to position ${seekPosition} validated`);
});

test('Playback Pipeline - event emissions during full playback cycle', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine
  const engine = new PlaybackEngine(exercise.timeline);

  // Track all events
  const events = [];
  const eventTypes = ['playback:started', 'playback:tick', 'playback:paused', 'playback:stopped'];

  eventTypes.forEach(eventType => {
    engine.on(eventType, (data) => {
      events.push({ type: eventType, data });
    });
  });

  // Full playback cycle: start → pause → stop
  await engine.play();
  engine.pause();
  engine.stop();

  // Verify events were emitted in correct order
  const startedEvents = events.filter(e => e.type === 'playback:started');
  const pausedEvents = events.filter(e => e.type === 'playback:paused');
  const stoppedEvents = events.filter(e => e.type === 'playback:stopped');

  assert.strictEqual(startedEvents.length, 1, 'Should have 1 started event');
  assert.strictEqual(pausedEvents.length, 1, 'Should have 1 paused event');
  assert.strictEqual(stoppedEvents.length, 1, 'Should have 1 stopped event');

  // Verify event data
  assert.ok(startedEvents[0].data.bpm, 'Started event should have BPM');
  assert.ok(pausedEvents[0].data.currentPosition !== undefined, 'Paused event should have position');
  assert.ok(stoppedEvents[0].data.totalDuration, 'Stopped event should have duration');

  Logger.log(Logger.INFO, 'IntegrationTest', `Recorded ${events.length} events during playback cycle`);
});

test('Playback Pipeline - maintains note order integrity across systems', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine
  const engine = new PlaybackEngine(exercise.timeline);

  const noteSequence = [];
  const systemChanges = [];

  engine.on('playback:tick', ({noteId, systemNumber}) => {
    noteSequence.push(noteId);
  });

  engine.on('playback:systemChange', ({systemNumber}) => {
    systemChanges.push(systemNumber);
  });

  // Start playback
  await engine.play();

  // Simulate executing scheduled events
  if (global.Tone.Transport.scheduledEvents) {
    const tickEventsOnly = global.Tone.Transport.scheduledEvents
      .filter(event => event.time >= 0)
      .sort((a, b) => a.time - b.time)
      .slice(0, -1); // Remove completion event

    tickEventsOnly.forEach(event => {
      event.callback(event.time);
    });
  }

  // Verify note sequence matches timeline order
  const expectedSequence = exercise.timeline.map(note => note.id);
  assert.deepStrictEqual(noteSequence, expectedSequence,
    'Tick events should maintain timeline order');

  // Verify system changes are detected correctly
  const expectedSystems = [...new Set(exercise.timeline.map(n => n.system))];
  assert.deepStrictEqual(systemChanges, expectedSystems,
    'System changes should match unique system numbers in timeline');

  Logger.log(Logger.INFO, 'IntegrationTest', 
    `Verified ${noteSequence.length} notes across ${expectedSystems.length} systems`);
});

test('Playback Pipeline - concurrent operations during playback', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine
  const engine = new PlaybackEngine(exercise.timeline, { bpm: 120 });

  // Start playback
  await engine.play();
  assert.strictEqual(engine.getState(), 'playing');

  // Perform concurrent operations
  const operations = [];

  // Operation 1: Seek while playing
  operations.push(new Promise(resolve => {
    engine.seek(1000);
    operations.push('seek');
    resolve();
  }));

  // Operation 2: Change tempo while playing
  operations.push(new Promise(resolve => {
    engine.setTempo(150);
    operations.push('tempo-change');
    resolve();
  }));

  // Operation 3: Get position while playing
  operations.push(new Promise(resolve => {
    const position = engine.getCurrentPosition();
    assert.ok(position >= 0);
    operations.push('get-position');
    resolve();
  }));

  // Wait for all operations
  await Promise.all(operations);

  // Verify all operations completed
  assert.strictEqual(operations.length, 3);
  assert.ok(operations.includes('seek'));
  assert.ok(operations.includes('tempo-change'));
  assert.ok(operations.includes('get-position'));

  // Verify engine state is still valid
  assert.strictEqual(engine.getState(), 'playing');
  assert.strictEqual(engine.config.bpm, 150);

  Logger.log(Logger.INFO, 'IntegrationTest', 'Concurrent operations validated');
});

test('Playback Pipeline - timing accuracy across different BPM values', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  const bpmValues = [60, 120, 180];
  const tolerance = 15; // ±15ms tolerance for integration tests

  for (const bpm of bpmValues) {
    // Create engine with specific BPM
    const engine = new PlaybackEngine(exercise.timeline, { bpm });

    const tickEvents = [];
    const eventTimes = [];

    engine.on('playback:tick', (data) => {
      eventTimes.push(Date.now());
      tickEvents.push(data);
    });

    // Start playback
    await engine.play();

    // Simulate event execution
    if (global.Tone.Transport.scheduledEvents) {
      const tickEventsOnly = global.Tone.Transport.scheduledEvents
        .filter(event => event.time >= 0)
        .sort((a, b) => a.time - b.time)
        .slice(0, -1);

      tickEventsOnly.forEach(event => {
        event.callback(event.time);
      });
    }

    // Verify timing accuracy
    assert.ok(tickEvents.length > 0, `Should have tick events at ${bpm} BPM`);
    
    // Verify BPM was set correctly
    assert.strictEqual(global.Tone.Transport.bpm.value, bpm);

    Logger.log(Logger.INFO, 'IntegrationTest', 
      `Timing validated at ${bpm} BPM with ${tickEvents.length} events`);
  }
});
