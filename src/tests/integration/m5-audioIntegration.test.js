/**
 * @module m5-audioIntegration.test
 * @description M5 Audio Integration Tests
 *
 * Tests the new audio synthesis and sample playback features
 * added in milestone 5.
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

// Tone.js mocks are now provided by src/tests/setup.js

// Helper function to load XML file
function loadXMLFile(filename) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const filePath = join(__dirname, '../../../assets/exercises', filename);
  return readFileSync(filePath, 'utf8');
}

test('M5 - Audio initialization with Tone.js components', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine
  const engine = new PlaybackEngine(exercise.timeline);

  // Verify initial audio state
  assert.strictEqual(engine.synthesizer, null, 'Synthesizer should not be initialized yet');
  assert.strictEqual(engine.sampler, null, 'Sampler should not be initialized yet');
  assert.strictEqual(engine.metronome, null, 'Metronome should not be initialized yet');
  assert.strictEqual(engine.samplesLoaded, false, 'Samples should not be loaded yet');

  // Test synthesizer creation
  engine._createSynthesizer();
  assert.ok(engine.synthesizer, 'Synthesizer should be created');
  assert.strictEqual(engine.synthesizer.maxPolyphony, 6, 'Synthesizer should support 6 voices');

  // Test metronome creation
  engine._createMetronome();
  assert.ok(engine.metronome, 'Metronome should be created');

  // Test volume conversion
  const volumeDb = engine._volumeToDecibels(0.7);
  assert.ok(volumeDb < 0, 'Volume should be converted to negative dB');
  assert.ok(volumeDb > -60, 'Volume should be in reasonable range');

  Logger.log(Logger.INFO, 'M5Test', 'Audio initialization validated');
});

test('M5 - Sample-based playback with Tone.Sampler', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine with sample mode
  const engine = new PlaybackEngine(exercise.timeline, {
    instrumentMode: 'sample',
    instrument: 'guitar-electric'
  });

  // Verify sample map generation
  const sampleMap = engine._buildSampleMap('guitar-electric');
  assert.ok(sampleMap['E2'], 'Sample map should include E2');
  assert.ok(sampleMap['A4'], 'Sample map should include A4');

  // Test sampler creation
  await engine._createSampler();
  assert.ok(engine.sampler, 'Sampler should be created');
  assert.ok(engine.samplesLoaded, 'Samples should be marked as loaded');

  // Verify sample map was passed correctly
  assert.deepStrictEqual(engine.sampler.urls, sampleMap, 'Sample URLs should match map');
  assert.strictEqual(engine.sampler.baseUrl, 'samples/instruments/guitar-electric/', 
    'Base URL should be correct');

  Logger.log(Logger.INFO, 'M5Test', 'Sample-based playback validated');
});

test('M5 - Metronome scheduling and audio playback', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine with metronome enabled
  const engine = new PlaybackEngine(exercise.timeline, {
    bpm: 120,
    metronomeEnabled: true,
    metronomeVolume: 0.5,
    timeSignature: { beats: 4, beatType: 4 }
  });

  // Create metronome
  engine._createMetronome();
  assert.ok(engine.metronome, 'Metronome should be created');

  // Test metronome scheduling
  engine._scheduleMetronome();

  // Verify metronome events were scheduled
  const noteCount = exercise.timeline.length;
  const initialEventCount = engine.scheduledEvents.length;

  // Check that we have additional events for metronome
  assert.ok(initialEventCount > noteCount,
    'Should have additional events for metronome');

  // Test metronome click sound
  engine._playMetronomeClick(0, true); // Downbeat
  assert.strictEqual(engine.metronome.triggerCount, 1, 'Metronome should trigger for downbeat');
  
  engine._playMetronomeClick(0.5, false); // Not downbeat
  assert.strictEqual(engine.metronome.triggerCount, 2, 'Metronome should trigger for regular beat');

  Logger.log(Logger.INFO, 'M5Test', 'Metronome scheduling validated');
});

test('M5 - Audio mode switching (synth ↔ sample)', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine
  const engine = new PlaybackEngine(exercise.timeline, {
    instrumentMode: 'synth'
  });

  // Create synthesizer for synth mode
  engine._createSynthesizer();
  assert.ok(engine.synthesizer, 'Synthesizer should be created');
  assert.strictEqual(engine.currentInstrumentMode, 'synth', 'Should start in synth mode');

  // Test switching to sample mode
  await engine.setInstrumentMode('sample');
  assert.strictEqual(engine.currentInstrumentMode, 'sample', 'Should be in sample mode now');
  assert.ok(engine.sampler, 'Sampler should be created');

  // Test switching back to synth mode
  await engine.setInstrumentMode('synth');
  assert.strictEqual(engine.currentInstrumentMode, 'synth', 'Should be back in synth mode');
  assert.ok(engine.synthesizer, 'Synthesizer should still be available');

  // Test invalid mode
  try {
    await engine.setInstrumentMode('invalid');
    assert.fail('Should throw error for invalid mode');
  } catch (error) {
    assert.ok(error.message.includes('Invalid instrument mode'));
  }

  Logger.log(Logger.INFO, 'M5Test', 'Audio mode switching validated');
});

test('M5 - Volume controls and parameter updates', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine
  const engine = new PlaybackEngine(exercise.timeline, {
    volume: 0.5,
    metronomeVolume: 0.3
  });

  // Create audio components
  engine._createSynthesizer();
  engine._createMetronome();

  // Test volume conversion
  const volumeDb = engine._volumeToDecibels(0.5);
  assert.ok(typeof volumeDb === 'number', 'Volume conversion should return number');
  assert.ok(volumeDb <= 0, 'Volume should be negative or zero dB');

  // Test volume setting
  engine.setVolume(0.8);
  assert.strictEqual(engine.config.volume, 0.8, 'Volume should be updated in config');
  assert.ok(engine.synthesizer.volume.value <= 0, 'Synthesizer volume should be set');

  // Test metronome volume setting
  engine.setMetronomeVolume(0.6);
  assert.strictEqual(engine.config.metronomeVolume, 0.6, 'Metronome volume should be updated');
  assert.ok(engine.metronome.volume.value <= 0, 'Metronome volume should be set');

  // Test invalid volume values
  try {
    engine.setVolume(1.5);
    assert.fail('Should throw error for volume > 1');
  } catch (error) {
    assert.ok(error.message.includes('Volume must be between 0 and 1'));
  }

  try {
    engine.setVolume(-0.1);
    assert.fail('Should throw error for volume < 0');
  } catch (error) {
    assert.ok(error.message.includes('Volume must be between 0 and 1'));
  }

  Logger.log(Logger.INFO, 'M5Test', 'Volume controls validated');
});

test('M5 - Metronome toggle and state management', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine with metronome initially disabled
  const engine = new PlaybackEngine(exercise.timeline, {
    metronomeEnabled: false
  });

  // Test initial state
  assert.strictEqual(engine.config.metronomeEnabled, false, 'Metronome should be disabled initially');

  // Test toggle to enabled
  engine.toggleMetronome();
  assert.strictEqual(engine.config.metronomeEnabled, true, 'Metronome should be enabled after toggle');

  // Test toggle back to disabled
  engine.toggleMetronome();
  assert.strictEqual(engine.config.metronomeEnabled, false, 'Metronome should be disabled after second toggle');

  Logger.log(Logger.INFO, 'M5Test', 'Metronome toggle validated');
});

test('M5 - Audio error handling and fallback mechanisms', async () => {
  // Mock Tone.Sampler that fails to load
  global.Tone.Sampler = class MockFailingSampler {
    constructor(config) {
      setTimeout(() => {
        if (config.onerror) config.onerror(new Error('Sample loading failed'));
      }, 10);
    }
    toDestination() { return this; }
  };

  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine
  const engine = new PlaybackEngine(exercise.timeline, {
    instrumentMode: 'sample'
  });

  // Track events
  const events = [];
  engine.on('audio:samplesError', (data) => {
    events.push({ type: 'audio:samplesError', data });
  });

  // Test sample loading failure
  try {
    await engine._createSampler();
    
    // Should eventually fall back to synth mode
    await new Promise(resolve => setTimeout(resolve, 50));
    
    assert.strictEqual(engine.currentInstrumentMode, 'synth', 'Should fallback to synth mode on error');
    
    const errorEvents = events.filter(e => e.type === 'audio:samplesError');
    assert.ok(errorEvents.length > 0, 'Should emit samples error event');
    
  } catch (error) {
    // Expected to fail or fallback
    assert.ok(error.message.includes('Sample loading') || 
             engine.currentInstrumentMode === 'synth');
  }

  Logger.log(Logger.INFO, 'M5Test', 'Audio error handling validated');
});

test('M5 - Integration with UI event flow', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine with UI-relevant config
  const engine = new PlaybackEngine(exercise.timeline, {
    bpm: 120,
    instrument: 'guitar-electric',
    instrumentMode: 'synth',
    volume: 0.7,
    metronomeEnabled: true,
    metronomeVolume: 0.5
  });

  // Test event emissions for UI updates
  const uiEvents = [];
  engine.on('audio:modeChanged', (data) => uiEvents.push(data));
  engine.on('audio:metronomeToggled', (data) => uiEvents.push(data));

  // Simulate UI interactions
  await engine.setInstrumentMode('sample');
  const modeChangeEvent = uiEvents.find(e => e.mode === 'sample');
  assert.ok(modeChangeEvent, 'Should emit mode change event');

  engine.toggleMetronome();
  const metronomeToggleEvent = uiEvents.find(e => e.enabled === false);
  assert.ok(metronomeToggleEvent, 'Should emit metronome toggle event');

  Logger.log(Logger.INFO, 'M5Test', 'UI integration events validated');
});

test('M5 - Complete audio playback with samples', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine with sample mode
  const engine = new PlaybackEngine(exercise.timeline, {
    instrumentMode: 'sample',
    instrument: 'guitar-electric'
  });

  // Initialize audio
  await engine.initializeAudio();
  assert.ok(engine.samplesLoaded, 'Samples should be loaded');

  // Start playback
  await engine.play();

  // Simulate note events
  const firstNote = exercise.timeline[0];
  engine._playNoteAudio(firstNote, 0);

  // Verify audio was triggered
  assert.ok(engine.sampler.notes.length > 0, 'Sample should have been triggered');

  // Test with a few more notes
  for (let i = 1; i < Math.min(3, exercise.timeline.length); i++) {
    engine._playNoteAudio(exercise.timeline[i], i * 0.5);
  }

  assert.ok(engine.sampler.notes.length >= 3, 'Multiple notes should have been triggered');

  Logger.log(Logger.INFO, 'M5Test', 
    `Complete audio playback validated with ${engine.sampler.notes.length} notes`);
});

test('M5 - Instrument switching during sample mode', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine in sample mode
  const engine = new PlaybackEngine(exercise.timeline, {
    instrumentMode: 'sample',
    instrument: 'guitar-electric'
  });

  // Initialize with guitar samples
  await engine._createSampler();
  assert.ok(engine.samplesLoaded, 'Guitar samples should be loaded');
  const initialSampler = engine.sampler;

  // Switch to piano
  engine.setInstrument('piano');
  assert.strictEqual(engine.config.instrument, 'piano', 'Instrument should be updated');

  // Note: The actual sample reloading is async and happens in background
  // We just verify the config is updated
  assert.strictEqual(engine.samplesLoaded, false, 'Samples should be reset for reload');

  Logger.log(Logger.INFO, 'M5Test', 'Instrument switching validated');
});

test('M5 - Audio context initialization flow', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine
  const engine = new PlaybackEngine(exercise.timeline);

  // Test audio initialization when context is running
  const result = await engine.initializeAudio();
  assert.ok(result, 'Audio initialization should succeed when context is running');
  assert.ok(engine.synthesizer, 'Synthesizer should be created');
  assert.ok(engine.metronome, 'Metronome should be created');

  // Test initialization in sample mode
  const engineSample = new PlaybackEngine(exercise.timeline, {
    instrumentMode: 'sample',
    instrument: 'guitar-electric'
  });

  const resultSample = await engineSample.initializeAudio();
  assert.ok(resultSample, 'Audio initialization should succeed in sample mode');
  assert.ok(engineSample.synthesizer, 'Synthesizer should be created');
  assert.ok(engineSample.sampler, 'Sampler should be created');
  assert.ok(engineSample.samplesLoaded, 'Samples should be loaded');

  Logger.log(Logger.INFO, 'M5Test', 'Audio context initialization validated');
});

test('M5 - Synthesized vs Sample playback modes', async () => {
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = loadXMLFile('twinkle2.xml');
  const exercise = await loader.parseXML(xmlContent);

  // Create engine
  const engine = new PlaybackEngine(exercise.timeline);

  // Initialize audio
  engine._createSynthesizer();
  engine._createMetronome();

  const testNote = exercise.timeline[0];

  // Test synth mode
  engine.currentInstrumentMode = 'synth';
  engine._triggerSynthNote(testNote, 0);
  assert.ok(engine.synthesizer.notes.length > 0, 'Synthesizer should trigger note');

  // Test sample mode (with mock sampler)
  global.Tone.Sampler = class MockSampler {
    constructor() {
      this.notes = [];
    }
    toDestination() { return this; }
    triggerAttackRelease(noteName, duration, time, velocity) {
      this.notes.push({ noteName, duration, time, velocity });
    }
  };

  engine.sampler = new global.Tone.Sampler();
  engine.samplesLoaded = true;
  engine.currentInstrumentMode = 'sample';
  
  engine._triggerSampleNote(testNote, 0.5);
  assert.ok(engine.sampler.notes.length > 0, 'Sampler should trigger note');

  Logger.log(Logger.INFO, 'M5Test', 'Synthesized vs Sample playback modes validated');
});
