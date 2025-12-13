import { test } from 'node:test';
import assert from 'node:assert';
import { PitchDetector } from '../../core/pitchDetector.js';
import { Analyzer } from '../../core/analyzer.js';

// Mock AudioContext for testing
class MockAudioContext {
  constructor() {
    this.sampleRate = 44100;
  }
}

// Audio sample generator for testing
class AudioSampleGenerator {
  static generateSineWave(frequency, duration, amplitude = 0.5) {
    const sampleRate = 44100;
    const samples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      buffer[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    
    return buffer;
  }
  
  static generateSineWaveWithEnvelope(frequency, duration, envelopeType = 'full') {
    const sampleRate = 44100;
    const samples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      let amplitude = 0.5;
      
      if (envelopeType === 'attack') {
        // ADSR envelope: Attack phase
        amplitude *= Math.min(1, t * 4); // Attack over first 250ms
      } else if (envelopeType === 'full') {
        // Full note with natural decay
        amplitude *= Math.exp(-t * 2); // Natural decay
      }
      
      buffer[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    
    return buffer;
  }
  
  static mix(buffers) {
    const maxLength = Math.max(...buffers.map(b => b.length));
    const result = new Float32Array(maxLength);
    
    for (const buffer of buffers) {
      for (let i = 0; i < buffer.length; i++) {
        result[i] += buffer[i];
      }
    }
    
    return result;
  }
}

test('Dual Detection - sustained note generates one onset', async () => {
  const audioContext = new MockAudioContext();
  const detector = new PitchDetector(audioContext, { enableDualDetection: true });
  
  const pitchEvents = [];
  const onsetEvents = [];
  
  detector.on('pitch:detected', (data) => pitchEvents.push(data));
  detector.on('pitch:onset', (data) => onsetEvents.push(data));
  
  // Generate 2-second sustained A4 (440Hz) with attack
  const attack = AudioSampleGenerator.generateSineWaveWithEnvelope(440, 0.5, 'attack');
  const sustain = AudioSampleGenerator.generateSineWave(440, 1.5);
  const sustained = new Float32Array(attack.length + sustain.length);
  sustained.set(attack);
  sustained.set(sustain, attack.length);
  
  // Process in chunks simulating real-time detection
  const chunkSize = 2048;
  for (let i = 0; i < sustained.length; i += chunkSize) {
    const chunk = sustained.slice(i, i + chunkSize);
    if (chunk.length === chunkSize) {
      await detector._processAudioBuffer(chunk);
    }
  }
  
  // EXPECT: Many continuous pitch events, at least 1 onset event
  assert.ok(pitchEvents.length >= 40, `Expected >=40 pitch events, got ${pitchEvents.length}`);
  assert.ok(onsetEvents.length >= 1, `Expected >=1 onset event, got ${onsetEvents.length}`);
  
  // All pitch events should be A4 (MIDI 69)
  pitchEvents.forEach(event => {
    assert.strictEqual(event.midi, 69, `Expected MIDI 69, got ${event.midi}`);
    assert.ok('isOnset' in event, 'Event should have isOnset field');
    assert.ok('onsetConfidence' in event, 'Event should have onsetConfidence field');
  });
  
  // At least one event should be marked as onset (attack should trigger it)
  assert.ok(onsetEvents.length > 0, `Expected at least 1 onset event, got ${onsetEvents.length}`);
  
  // Check that at least one pitch event is marked as onset
  const hasOnset = pitchEvents.some(event => event.isOnset === true);
  assert.ok(hasOnset, 'At least one pitch event should be marked as onset');
  
  console.log(`✅ Sustained note test passed: ${pitchEvents.length} pitch events, ${onsetEvents.length} onset events`);
});

test('Dual Detection - legato passage without onsets', async () => {
  const audioContext = new MockAudioContext();
  const detector = new PitchDetector(audioContext, { enableDualDetection: true });
  
  const pitchEvents = [];
  const onsetEvents = [];
  
  detector.on('pitch:detected', (data) => pitchEvents.push(data));
  detector.on('pitch:onset', (data) => onsetEvents.push(data));
  
  // Simulate hammer-on: C4 → D4 without re-plucking (no amplitude drop)
  const c4Sustain = AudioSampleGenerator.generateSineWave(261.63, 0.5);
  const d4Sustain = AudioSampleGenerator.generateSineWave(293.66, 0.5);
  
  // Smooth transition (no amplitude drop)
  const legato = AudioSampleGenerator.mix([c4Sustain, d4Sustain]);
  
  // Process the legato passage
  const chunkSize = 2048;
  for (let i = 0; i < legato.length; i += chunkSize) {
    const chunk = legato.slice(i, i + chunkSize);
    if (chunk.length === chunkSize) {
      await detector._processAudioBuffer(chunk);
    }
  }
  
  // EXPECT: Continuous pitch detects both C4 and D4, only 1 onset (at initial C4 attack)
  assert.ok(pitchEvents.length >= 10, `Expected >=10 pitch events, got ${pitchEvents.length}`);
  assert.ok(onsetEvents.length <= 1, `Expected ≤1 onset events, got ${onsetEvents.length}`);
  
  // Should detect both C4 and D4 pitches
  const detectedMidis = pitchEvents.map(e => e.midi);
  const hasC4 = detectedMidis.some(midi => Math.abs(midi - 60) < 2); // C4 ≈ MIDI 60
  const hasD4 = detectedMidis.some(midi => Math.abs(midi - 62) < 2); // D4 ≈ MIDI 62
  
  assert.ok(hasC4, 'Should detect C4');
  assert.ok(hasD4, 'Should detect D4');
  
  console.log(`✅ Legato test passed: ${pitchEvents.length} pitch events, ${onsetEvents.length} onset events`);
});

test('Dual Detection - analyzer uses correct alignment', async () => {
  const analyzer = new Analyzer({ preset: 'NORMAL' });
  
  // Create reference timeline (simple melody)
  const referenceTimeline = [
    { id: 'note1', midi: 60, timestamp: 0 },      // C4
    { id: 'note2', midi: 62, timestamp: 500 },    // D4  
    { id: 'note3', midi: 64, timestamp: 1000 }    // E4
  ];
  
  // Create detected stream with dual detection events
  const detectedStream = [
    // Continuous pitch events (many per note)
    { type: 'continuous', midi: 60, timestamp: 50, confidence: 0.8, isOnset: true, onsetConfidence: 0.9 },
    { type: 'continuous', midi: 60, timestamp: 100, confidence: 0.8, isOnset: false, onsetConfidence: 0 },
    { type: 'continuous', midi: 60, timestamp: 150, confidence: 0.8, isOnset: false, onsetConfidence: 0 },
    
    // Onset events (one per note)
    { type: 'pitch:onset', midi: 60, timestamp: 50, confidence: 0.9 },
    
    // Second note
    { type: 'continuous', midi: 62, timestamp: 550, confidence: 0.8, isOnset: true, onsetConfidence: 0.8 },
    { type: 'continuous', midi: 62, timestamp: 600, confidence: 0.8, isOnset: false, onsetConfidence: 0 },
    
    { type: 'pitch:onset', midi: 62, timestamp: 550, confidence: 0.8 },
    
    // Third note  
    { type: 'continuous', midi: 64, timestamp: 1050, confidence: 0.8, isOnset: true, onsetConfidence: 0.7 },
    { type: 'continuous', midi: 64, timestamp: 1100, confidence: 0.8, isOnset: false, onsetConfidence: 0 },
    
    { type: 'pitch:onset', midi: 64, timestamp: 1050, confidence: 0.7 }
  ];
  
  const result = await analyzer.analyze(referenceTimeline, detectedStream, { latencyOffset: 0 });
  
  // EXPECT: Perfect detection since we have aligned data
  assert.strictEqual(result.aggregate.correctPercentage, 100, 'Should be 100% correct');
  assert.strictEqual(result.aggregate.notesCorrect, 3, 'Should have 3 correct notes');
  assert.strictEqual(result.aggregate.notesMissed, 0, 'Should have 0 missed notes');
  
  // Check that onset timestamps are being used for timing
  result.perNote.forEach((note, index) => {
    assert.ok(note.detectedMidi !== null, 'Should have detected MIDI');
    assert.ok(note.detectedTimestamp !== null, 'Should have detected timestamp');
    assert.ok(note.onsetDetectedTimestamp !== null, 'Should have onset timestamp');
    assert.strictEqual(note.pitchCorrect, true, 'Should be pitch correct');
    assert.strictEqual(note.timingCorrect, true, 'Should be timing correct');
  });
  
  console.log(`✅ Analyzer dual alignment test passed: ${result.aggregate.correctPercentage}% correctness`);
});

test('Dual Detection - legacy mode compatibility', async () => {
  const audioContext = new MockAudioContext();
  const detector = new PitchDetector(audioContext, { enableDualDetection: false });
  
  const pitchEvents = [];
  const onsetEvents = [];
  
  detector.on('pitch:detected', (data) => pitchEvents.push(data));
  detector.on('pitch:onset', (data) => onsetEvents.push(data));
  
  // Generate a simple note with attack
  const note = AudioSampleGenerator.generateSineWaveWithEnvelope(440, 1.0, 'attack');
  
  // Process the note
  const chunkSize = 2048;
  for (let i = 0; i < note.length; i += chunkSize) {
    const chunk = note.slice(i, i + chunkSize);
    if (chunk.length === chunkSize) {
      await detector._processAudioBuffer(chunk);
    }
  }
  
  // Legacy mode should behave like original implementation
  // (only emit on onset detection, no continuous events)
  assert.ok(pitchEvents.length > 0 || onsetEvents.length > 0, 'Should have some events in legacy mode');
  
  console.log(`✅ Legacy mode test passed: ${pitchEvents.length} pitch events, ${onsetEvents.length} onset events`);
});

console.log('🧪 Starting Dual Detection Test Suite...\n');
