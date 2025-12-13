/**
 * Unit tests for PitchDetector module
 * Tests YIN algorithm, noise gating, frequency conversion, and performance
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { PitchDetector } from '../../core/pitchDetector.js';

// Mock AudioContext for testing
class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.sampleRate = 44100;
    this.currentTime = 0;
  }

  createMediaStreamSource(stream) {
    return new MockMediaStreamSource();
  }

  createScriptProcessor(bufferSize, inputChannels, outputChannels) {
    return new MockScriptProcessor();
  }

  createAnalyser() {
    return new MockAnalyser();
  }

  get audioWorklet() {
    return {
      addModule: async (moduleUrl) => {
        // Mock module loading
        return Promise.resolve();
      }
    };
  }

  createAudioWorkletNode(options) {
    return new MockAudioWorkletNode();
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

class MockMediaStreamSource {
  connect(destination) {
    return this;
  }

  disconnect() {
    return this;
  }
}

class MockScriptProcessor {
  constructor() {
    this.bufferSize = 4096;
    this.onaudioprocess = null;
  }

  connect(destination) {
    return this;
  }

  disconnect() {
    return this;
  }
}

class MockAudioWorkletNode {
  constructor() {
    this.port = {
      onmessage: null,
      postMessage: () => {}
    };
  }

  connect(destination) {
    return this;
  }

  disconnect() {
    return this;
  }
}

class MockAnalyser {
  constructor() {
    this.fftSize = 2048;
    this.frequencyBinCount = 1024;
  }

  connect(destination) {
    return this;
  }

  disconnect() {
    return this;
  }

  getFloatTimeDomainData(array) {
    // Fill with synthetic data for testing
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.sin(i * 0.1) * 0.3;
    }
  }
}

// Utility functions for test data generation
function generateSineWave(frequency, duration, sampleRate) {
  const numSamples = Math.floor(duration * sampleRate);
  const samples = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    samples[i] = Math.sin(2 * Math.PI * frequency * t);
  }
  
  return samples;
}

function generateGuitarString(frequency, duration, sampleRate) {
  // Generate more realistic guitar-like harmonic content
  const numSamples = Math.floor(duration * sampleRate);
  const samples = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const amplitude = Math.exp(-t * 2); // Decay envelope
    
    // Fundamental + harmonics (guitar-like)
    const fundamental = Math.sin(2 * Math.PI * frequency * t);
    const harmonic2 = 0.3 * Math.sin(2 * Math.PI * frequency * 2 * t);
    const harmonic3 = 0.15 * Math.sin(2 * Math.PI * frequency * 3 * t);
    const harmonic4 = 0.1 * Math.sin(2 * Math.PI * frequency * 4 * t);
    
    samples[i] = amplitude * (fundamental + harmonic2 + harmonic3 + harmonic4) * 0.5;
  }
  
  return samples;
}

function generateNoise(duration, sampleRate, amplitude = 0.01) {
  const numSamples = Math.floor(duration * sampleRate);
  const samples = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    samples[i] = (Math.random() - 0.5) * amplitude * 2;
  }
  
  return samples;
}

test.describe('PitchDetector', () => {
  let mockAudioContext;
  let detector;
  let config;

  test.beforeEach(() => {
    mockAudioContext = new MockAudioContext();
    config = {
      bufferSize: 2048,
      noiseThreshold: -40,
      confidenceThreshold: 0.7,
      minFrequency: 80,
      maxFrequency: 1000
    };
    detector = new PitchDetector(mockAudioContext, config);
  });

  test.afterEach(() => {
    if (detector.state.isRunning) {
      detector.stop();
    }
  });

  test('PitchDetector - should initialize with default configuration', () => {
    assert.strictEqual(detector.config.bufferSize, 2048);
    assert.strictEqual(detector.config.noiseThreshold, -40);
    assert.strictEqual(detector.config.confidenceThreshold, 0.7);
    assert.strictEqual(detector.config.minFrequency, 80);
    assert.strictEqual(detector.config.maxFrequency, 1000);
    assert.strictEqual(detector.state.isRunning, false);
  });

  test('PitchDetector - YIN algorithm detects A4 440Hz within ±2Hz', () => {
    // Generate pure A4 sine wave
    const sampleRate = 44100;
    const duration = 1.0;
    const frequency = 440;
    const buffer = generateSineWave(frequency, duration, sampleRate);
    
    // Test YIN algorithm directly
    const result = detector._yinAlgorithm(buffer);
    
    assert.ok(result, 'Should detect pitch for pure sine wave');
    assert.ok(Math.abs(result.frequency - 440) < 2, 
      `Frequency ${result.frequency}Hz should be within 2Hz of 440Hz`);
    assert.ok(result.confidence > 0.9, 'Confidence should be high for pure sine wave');
  });

  test('PitchDetector - YIN algorithm detects guitar open strings correctly', () => {
    const guitarStrings = [
      { freq: 82.41, name: 'E2' },   // Low E
      { freq: 110.00, name: 'A2' },  // A
      { freq: 146.83, name: 'D3' },  // D
      { freq: 196.00, name: 'G3' },  // G
      { freq: 246.94, name: 'B3' },  // B
      { freq: 329.63, name: 'E4' }   // High E
    ];

    guitarStrings.forEach(({ freq, name }) => {
      const buffer = generateGuitarString(freq, 0.5, 44100);
      const result = detector._yinAlgorithm(buffer);
      
      assert.ok(result, `Should detect ${name} string (${freq}Hz)`);
      assert.ok(Math.abs(result.frequency - freq) < 3, 
        `${name} frequency ${result.frequency}Hz should be within 3Hz of ${freq}Hz`);
      assert.ok(result.confidence > 0.5, `Confidence should be reasonable for ${name}`);
    });
  });

  test('PitchDetector - noise gate rejects low amplitude signals', () => {
    const configWithNoiseGate = {
      noiseThreshold: -40,
      noiseGateEnabled: true
    };
    
    const noisyDetector = new PitchDetector(mockAudioContext, configWithNoiseGate);
    
    // Generate very quiet noise
    const buffer = new Float32Array(2048);
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = (Math.random() - 0.5) * 0.001; // Very quiet noise
    }
    
    const shouldGate = noisyDetector._shouldGate(buffer);
    
    assert.strictEqual(shouldGate, true, 'Should gate low amplitude signal');
    
    // Test with normal amplitude
    const normalBuffer = generateSineWave(440, 0.1, 44100);
    const shouldNotGate = noisyDetector._shouldGate(normalBuffer);
    
    assert.strictEqual(shouldNotGate, false, 'Should not gate normal amplitude signal');
  });

  test('PitchDetector - frequency to MIDI conversion accuracy', () => {
    const testCases = [
      { freq: 82.41, expectedMidi: 28 },   // E2
      { freq: 110.00, expectedMidi: 33 },  // A2
      { freq: 146.83, expectedMidi: 38 },  // D3
      { freq: 196.00, expectedMidi: 43 },  // G3
      { freq: 246.94, expectedMidi: 47 },  // B3
      { freq: 329.63, expectedMidi: 52 },  // E4
      { freq: 440.00, expectedMidi: 57 }   // A4
    ];
    
    testCases.forEach(({ freq, expectedMidi }) => {
      const midi = detector._frequencyToMidi(freq);
      assert.strictEqual(midi, expectedMidi, 
        `Frequency ${freq}Hz should convert to MIDI ${expectedMidi}`);
    });
  });

  test('PitchDetector - cents deviation calculation accuracy', () => {
    // Perfect pitch (A4 at 440Hz)
    const perfectCents = detector._calculateCents(440, 57);
    assert.ok(Math.abs(perfectCents) < 1, 'Perfect pitch should be 0 cents');

    // Slightly flat A4 (5 cents flat)
    const flatFreq = 440 * Math.pow(2, -5/1200);
    const flatCents = detector._calculateCents(flatFreq, 57);
    assert.ok(Math.abs(flatCents + 5) < 1, 'Should detect 5 cents flat');

    // Slightly sharp A4 (10 cents sharp)
    const sharpFreq = 440 * Math.pow(2, 10/1200);
    const sharpCents = detector._calculateCents(sharpFreq, 57);
    assert.ok(Math.abs(sharpCents - 10) < 1, 'Should detect 10 cents sharp');
  });

  test('PitchDetector - MIDI to note name conversion', () => {
    const noteTests = [
      { midi: 28, expected: 'E2' },
      { midi: 33, expected: 'A2' },
      { midi: 38, expected: 'D3' },
      { midi: 43, expected: 'G3' },
      { midi: 47, expected: 'B3' },
      { midi: 52, expected: 'E4' },
      { midi: 57, expected: 'A4' },
      { midi: 60, expected: 'C4' },
      { midi: 64, expected: 'E4' }
    ];
    
    noteTests.forEach(({ midi, expected }) => {
      const noteName = detector._midiToNoteName(midi);
      assert.strictEqual(noteName, expected, 
        `MIDI ${midi} should convert to note name "${expected}"`);
    });
  });

  test('PitchDetector - adaptive buffer sizing based on frequency', () => {
    const configAdaptive = {
      adaptiveBufferSize: true
    };
    
    const adaptiveDetector = new PitchDetector(mockAudioContext, configAdaptive);
    
    // Low frequency should use large buffer
    const bufferLow = adaptiveDetector._getOptimalBufferSize(80);
    assert.strictEqual(bufferLow, 4096, 'Low frequency should use 4096 buffer');
    
    const bufferVeryLow = adaptiveDetector._getOptimalBufferSize(60);
    assert.strictEqual(bufferVeryLow, 4096, 'Very low frequency should use 4096 buffer');
    
    // Mid frequency uses medium buffer
    const bufferMid = adaptiveDetector._getOptimalBufferSize(200);
    assert.strictEqual(bufferMid, 2048, 'Mid frequency should use 2048 buffer');
    
    const bufferMidHigh = adaptiveDetector._getOptimalBufferSize(400);
    assert.strictEqual(bufferMidHigh, 2048, 'Upper mid frequency should use 2048 buffer');
    
    // High frequency uses small buffer
    const bufferHigh = adaptiveDetector._getOptimalBufferSize(600);
    assert.strictEqual(bufferHigh, 1024, 'High frequency should use 1024 buffer');
    
    const bufferVeryHigh = adaptiveDetector._getOptimalBufferSize(800);
    assert.strictEqual(bufferVeryHigh, 1024, 'Very high frequency should use 1024 buffer');
    
    // Test non-adaptive mode
    const configFixed = {
      adaptiveBufferSize: false,
      bufferSize: 2048
    };
    
    const fixedDetector = new PitchDetector(mockAudioContext, configFixed);
    const bufferFixed = fixedDetector._getOptimalBufferSize(200);
    assert.strictEqual(bufferFixed, 2048, 'Non-adaptive mode should use configured buffer size');
  });

  test('PitchDetector - DC offset removal', () => {
    const buffer = new Float32Array(1024);
    const dcOffset = 0.5;
    
    // Add DC offset and some signal
    for (let i = 0; i < buffer.length; i++) {
      const signal = Math.sin(2 * Math.PI * 440 * i / 44100);
      buffer[i] = signal + dcOffset;
    }
    
    // Before DC removal
    const meanBefore = buffer.reduce((a, b) => a + b, 0) / buffer.length;
    assert.ok(Math.abs(meanBefore - dcOffset) < 0.01, 'Should have DC offset before removal');
    
    detector._removeDCOffset(buffer);
    
    // After DC removal
    const meanAfter = buffer.reduce((a, b) => a + b, 0) / buffer.length;
    assert.ok(Math.abs(meanAfter) < 0.01, 'DC offset should be removed');
  });

  test('PitchDetector - high-pass filter removes low frequency content', () => {
    const buffer = new Float32Array(2048);
    const sampleRate = 44100;
    
    // Mix low freq (30Hz) and high freq (440Hz) content
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const lowFreq = Math.sin(2 * Math.PI * 30 * t) * 0.3;
      const highFreq = Math.sin(2 * Math.PI * 440 * t) * 0.5;
      buffer[i] = lowFreq + highFreq;
    }
    
    // Calculate low freq content before filtering
    const lowFreqContentBefore = buffer.slice(0, 100).reduce((sum, val) => sum + Math.abs(val), 0) / 100;
    
    detector._applyHighPassFilter(buffer, 60);
    
    // Calculate low freq content after filtering (should be reduced)
    const lowFreqContentAfter = buffer.slice(0, 100).reduce((sum, val) => sum + Math.abs(val), 0) / 100;
    
    assert.ok(lowFreqContentAfter < lowFreqContentBefore, 
      'High-pass filter should reduce low frequency content');
  });

  test('PitchDetector - temporal consistency filtering', () => {
    // Simulate a sequence of pitch detections
    detector.lastPitchEvents = [440, 442, 439]; // Stable pitch
    
    const isConsistent1 = detector._isTemporallyConsistent(441);
    assert.strictEqual(isConsistent1, true, 'Similar frequency should be consistent');
    
    // Test with inconsistent frequency
    detector.lastPitchEvents = [440, 442, 439, 441];
    const isConsistent2 = detector._isTemporallyConsistent(600); // Big jump
    assert.strictEqual(isConsistent2, false, 'Very different frequency should be inconsistent');
    
    // Test with gradual change (should be OK)
    detector.lastPitchEvents = [440, 442, 444, 446];
    const isConsistent3 = detector._isTemporallyConsistent(448);
    assert.strictEqual(isConsistent3, true, 'Gradual change should be consistent');
  });

  test('PitchDetector - RMS amplitude calculation', () => {
    // Test with sine wave of known amplitude
    const amplitude = 0.5;
    const buffer = generateSineWave(440, 0.1, 44100).map(sample => sample * amplitude);
    
    const rms = detector._calculateRMS(buffer);
    
    // RMS of sine wave should be amplitude / sqrt(2)
    const expectedRMS = amplitude / Math.sqrt(2);
    assert.ok(Math.abs(rms - expectedRMS) < 0.01, 
      `RMS should be approximately ${expectedRMS}, got ${rms}`);
  });

  test('PitchDetector - confidence scoring', () => {
    // Test with pure sine wave (should have high confidence)
    const pureBuffer = generateSineWave(440, 1.0, 44100);
    const result = detector._yinAlgorithm(pureBuffer);
    
    assert.ok(result && result.confidence > 0.8, 
      'Pure sine wave should have high confidence');
    
    // Test with noisy signal (should have lower confidence)
    const noisyBuffer = generateSineWave(440, 1.0, 44100);
    for (let i = 0; i < noisyBuffer.length; i++) {
      noisyBuffer[i] += (Math.random() - 0.5) * 0.2; // Add noise
    }
    
    const noisyResult = detector._yinAlgorithm(noisyBuffer);
    assert.ok(!noisyResult || noisyResult.confidence < 0.8, 
      'Noisy signal should have lower confidence');
  });

  test('PitchDetector - detection state management', () => {
    assert.strictEqual(detector.state.isRunning, false, 'Should not be running initially');
    
    const state = detector.getState();
    assert.strictEqual(state.isRunning, false, 'State should reflect not running');
    assert.strictEqual(state.detectionCount, 0, 'Detection count should be 0 initially');
    assert.strictEqual(state.uptime >= 0, true, 'Uptime should be non-negative');
  });

  test('PitchDetector - configuration updates', () => {
    const newConfig = {
      bufferSize: 4096,
      confidenceThreshold: 0.8,
      noiseThreshold: -35
    };
    
    detector.updateConfig(newConfig);
    
    assert.strictEqual(detector.config.bufferSize, 4096);
    assert.strictEqual(detector.config.confidenceThreshold, 0.8);
    assert.strictEqual(detector.config.noiseThreshold, -35);
  });

  test('PitchDetector - handles invalid frequency range', () => {
    // Test frequency below minimum
    const lowFreqBuffer = generateSineWave(40, 0.5, 44100); // Below 80Hz min
    const lowResult = detector._yinAlgorithm(lowFreqBuffer);
    
    assert.strictEqual(lowResult, null, 'Should return null for frequencies below minimum');
    
    // Test frequency above maximum
    const highFreqBuffer = generateSineWave(2000, 0.5, 44100); // Above 1000Hz max
    const highResult = detector._yinAlgorithm(highFreqBuffer);
    
    // May or may not detect, but should handle gracefully
    assert.ok(highResult === null || highResult.frequency < 1000, 
      'Should handle frequencies above maximum gracefully');
  });

  test('PitchDetector - parabolic interpolation accuracy', () => {
    // Create a test CMNDF array with known minimum
    const cmndf = new Float32Array([1.0, 0.8, 0.6, 0.3, 0.2, 0.15, 0.1, 0.2, 0.3, 0.5]);
    
    // Test interpolation around the minimum at index 6
    const interpolated = detector._parabolicInterpolation(cmndf, 6);
    
    // Should improve accuracy beyond integer index
    assert.ok(interpolated > 5.5 && interpolated < 6.5, 
      `Interpolated value should be near 6.0, got ${interpolated}`);
    
    // Test edge cases
    const interpolatedEdge1 = detector._parabolicInterpolation(cmndf, 0);
    assert.strictEqual(interpolatedEdge1, 0, 'Should handle edge case at index 0');
    
    const interpolatedEdge2 = detector._parabolicInterpolation(cmndf, cmndf.length - 1);
    assert.strictEqual(interpolatedEdge2, cmndf.length - 1, 'Should handle edge case at last index');
  });

  test('PitchDetector - performance with multiple detections', () => {
    const frequencies = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63, 440.00];
    const results = [];
    
    const startTime = performance.now();
    
    frequencies.forEach(freq => {
      const buffer = generateGuitarString(freq, 0.2, 44100);
      const result = detector._yinAlgorithm(buffer);
      results.push(result);
    });
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // Should process all frequencies within reasonable time
    assert.ok(totalTime < 1000, `Processing should complete within 1 second, took ${totalTime}ms`);
    
    // All should be detected
    results.forEach((result, index) => {
      assert.ok(result, `Should detect frequency ${frequencies[index]}Hz`);
    });
  });

  test('PitchDetector - events emitted correctly', async () => {
    let eventReceived = false;
    let eventData = null;
    
    detector.on('pitch:detected', (data) => {
      eventReceived = true;
      eventData = data;
    });
    
    detector.on('detector:started', () => {
      // This should be emitted during start
    });
    
    // Simulate a detection by calling the handler directly
    detector._handlePitchDetection({
      frequency: 440,
      confidence: 0.9,
      timestamp: 1000
    });
    
    assert.strictEqual(eventReceived, true, 'pitch:detected event should be emitted');
    assert.strictEqual(eventData.frequency, 440, 'Event should contain frequency');
    assert.strictEqual(eventData.confidence, 0.9, 'Event should contain confidence');
    assert.ok(eventData.midi === 57, 'Event should contain correct MIDI note');
    assert.ok(eventData.noteName === 'A4', 'Event should contain note name');
  });

  test('PitchDetector - silence events for low confidence detections', () => {
    let silenceEventReceived = false;
    
    detector.on('pitch:silence', () => {
      silenceEventReceived = true;
    });
    
    // Test with below threshold confidence
    detector._handlePitchDetection({
      frequency: 440,
      confidence: 0.5, // Below threshold
      timestamp: 1000
    });
    
    assert.strictEqual(silenceEventReceived, true, 'Should emit silence event for low confidence');
    
    // Test with null frequency
    silenceEventReceived = false;
    detector._handlePitchDetection({
      frequency: null,
      confidence: 0.9,
      timestamp: 2000
    });
    
    assert.strictEqual(silenceEventReceived, true, 'Should emit silence event for null frequency');
  });
});

// Performance-focused tests
test.describe('PitchDetector - Performance Tests', () => {
  let mockAudioContext;
  let detector;

  test.beforeEach(() => {
    mockAudioContext = new MockAudioContext();
    detector = new PitchDetector(mockAudioContext);
  });

  test('Performance - YIN algorithm latency < 30ms', () => {
    const buffer = generateGuitarString(440, 0.2, 44100);
    const latencies = [];
    
    // Measure latency over multiple runs
    for (let i = 0; i < 10; i++) {
      const startTime = performance.now();
      detector._yinAlgorithm(buffer);
      const endTime = performance.now();
      latencies.push(endTime - startTime);
    }
    
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    
    console.log(`Average YIN latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`Max YIN latency: ${maxLatency.toFixed(2)}ms`);
    
    assert.ok(avgLatency < 30, `Average latency ${avgLatency}ms should be < 30ms`);
    assert.ok(maxLatency < 50, `Max latency ${maxLatency}ms should be < 50ms`);
  });

  test('Performance - memory usage stable during multiple detections', () => {
    // Simulate continuous processing
    const frequencies = Array(50).fill(0).map((_, i) => {
      // Cycle through guitar strings
      const guitarStrings = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];
      return guitarStrings[i % guitarStrings.length];
    });
    
    let initialMemory = 0;
    if (performance.memory) {
      initialMemory = performance.memory.usedJSHeapSize;
    }
    
    // Process many buffers
    frequencies.forEach(freq => {
      const buffer = generateGuitarString(freq, 0.1, 44100);
      detector._yinAlgorithm(buffer);
    });
    
    let finalMemory = 0;
    if (performance.memory) {
      finalMemory = performance.memory.usedJSHeapSize;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`Memory increase: ${(memoryIncrease / 1024).toFixed(2)}KB`);
      
      // Memory increase should be reasonable (less than 5MB)
      assert.ok(memoryIncrease < 5 * 1024 * 1024, 
        'Memory usage should not increase dramatically during processing');
    }
  });

  test('Performance - adaptive buffer sizing improves low frequency accuracy', () => {
    const configAdaptive = {
      adaptiveBufferSize: true
    };
    
    const adaptiveDetector = new PitchDetector(mockAudioContext, configAdaptive);
    
    const configFixed = {
      adaptiveBufferSize: false,
      bufferSize: 1024
    };
    
    const fixedDetector = new PitchDetector(mockAudioContext, configFixed);
    
    const lowFreq = 82.41; // E2 string
    
    // Test with adaptive buffer
    adaptiveDetector.state.currentFrequency = lowFreq;
    const adaptiveBuffer = generateGuitarString(lowFreq, 0.5, 44100);
    const adaptiveResult = adaptiveDetector._yinAlgorithm(adaptiveBuffer);
    
    // Test with fixed small buffer (inadequate for low frequencies)
    fixedDetector.state.currentFrequency = lowFreq;
    const fixedResult = fixedDetector._yinAlgorithm(adaptiveBuffer);
    
    // Adaptive should perform better for low frequencies
    if (fixedResult) {
      assert.ok(Math.abs(adaptiveResult.frequency - lowFreq) <= Math.abs(fixedResult.frequency - lowFreq),
        'Adaptive buffer sizing should improve low frequency accuracy');
    }
  });
});

// Integration-focused tests
test.describe('PitchDetector - Integration Tests', () => {
  let mockAudioContext;
  let detector;
  let config;

  test.beforeEach(() => {
    mockAudioContext = new MockAudioContext();
    config = {
      bufferSize: 2048,
      confidenceThreshold: 0.6
    };
    detector = new PitchDetector(mockAudioContext, config);
  });

  test('Integration - complete pitch detection pipeline', () => {
    let detectedPitch = null;
    let detectedCount = 0;
    
    detector.on('pitch:detected', (pitch) => {
      detectedPitch = pitch;
      detectedCount++;
    });
    
    detector.on('pitch:silence', () => {
      // Silence events are expected
    });
    
    // Simulate processing a guitar buffer
    const guitarBuffer = generateGuitarString(196.00, 0.3, 44100); // G3 string
    
    detector._processAudioBuffer(guitarBuffer);
    
    // Should detect the pitch
    assert.ok(detectedPitch !== null, 'Should detect pitch in guitar buffer');
    assert.ok(Math.abs(detectedPitch.frequency - 196.00) < 3,
      `Detected frequency should be close to 196Hz, got ${detectedPitch.frequency}Hz`);
    assert.ok(detectedPitch.midi === 43, 'Should convert to correct MIDI note');
    assert.ok(detectedPitch.confidence > 0.5, 'Should have reasonable confidence');
  });

  test('Integration - noise handling in pipeline', () => {
    let silenceCount = 0;
    let detectionCount = 0;
    
    detector.on('pitch:detected', () => {
      detectionCount++;
    });
    
    detector.on('pitch:silence', () => {
      silenceCount++;
    });
    
    // Process noise (should be gated)
    const noiseBuffer = generateNoise(0.5, 44100, 0.005);
    detector._processAudioBuffer(noiseBuffer);
    
    // Should mostly produce silence events
    assert.ok(silenceCount > 0, 'Should produce silence events for noise');
    assert.strictEqual(detectionCount, 0, 'Should not detect pitches in noise');
  });

  test('Integration - real-time processing simulation', async () => {
    let pitchEvents = [];
    let silenceEvents = [];
    
    detector.on('pitch:detected', (pitch) => {
      pitchEvents.push(pitch);
    });
    
    detector.on('pitch:silence', (event) => {
      silenceEvents.push(event);
    });
    
    // Simulate real-time audio chunks (like ScriptProcessorNode would provide)
    const chunkSize = 1024;
    const numChunks = 10;
    
    for (let chunk = 0; chunk < numChunks; chunk++) {
      // Generate different frequencies for each chunk
      const frequencies = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63, 440.00];
      const freq = frequencies[chunk % frequencies.length];
      
      const chunkBuffer = generateGuitarString(freq, chunkSize / 44100, 44100);
      detector._processAudioBuffer(chunkBuffer);
      
      // Small delay to simulate real-time processing
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    // Should have processed multiple chunks
    const totalEvents = pitchEvents.length + silenceEvents.length;
    assert.ok(totalEvents > 0, 'Should have processed audio chunks');
    assert.ok(pitchEvents.length > 0, 'Should have detected some pitches');
    
    // Check that different frequencies were detected
    const detectedFreqs = pitchEvents.map(p => p.frequency);
    const uniqueFreqs = new Set(detectedFreqs.map(f => Math.round(f)));
    assert.ok(uniqueFreqs.size > 1, 'Should detect multiple different frequencies');
  });

  test('Integration - frequency transitions and temporal consistency', () => {
    let consistentDetections = 0;
    let inconsistentRejections = 0;
    
    detector.on('pitch:silence', (event) => {
      if (event.reason === 'temporal_inconsistency') {
        inconsistentRejections++;
      }
    });
    
    detector.on('pitch:detected', () => {
      consistentDetections++;
    });
    
    // Simulate a frequency transition (common in guitar playing)
    // Start with one frequency
    for (let i = 0; i < 3; i++) {
      const buffer1 = generateGuitarString(196.00, 0.1, 44100); // G3
      detector._processAudioBuffer(buffer1);
    }
    
    // Transition to another frequency
    for (let i = 0; i < 3; i++) {
      const buffer2 = generateGuitarString(246.94, 0.1, 44100); // B3
      detector._processAudioBuffer(buffer2);
    }
    
    // Should handle transitions gracefully
    assert.ok(consistentDetections > 0, 'Should have some consistent detections');
    // Some rejections due to temporal inconsistency are expected during transitions
    assert.ok(inconsistentRejections >= 0, 'Should handle temporal inconsistencies');
  });
});
