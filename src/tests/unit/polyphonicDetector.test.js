/**
 * @fileoverview Unit tests for PolyphonicDetector
 * @module tests/unit/polyphonicDetector.test
 * @description Comprehensive test suite for TensorFlow.js polyphonic detection
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { PolyphonicDetector } from '../../core/polyphonicDetector.js';

// Mock dependencies
const mockConfig = {
  chunkSize: 8.0,
  targetSampleRate: 16000,
  confidenceThreshold: 0.5,
  enableWebWorker: false,
  fallbackToMonophonic: true,
  timeoutMs: 30000
};

test.describe('PolyphonicDetector', () => {
  
  test('should initialize with default configuration', () => {
    const detector = new PolyphonicDetector('assets/models/magenta/model.json');
    
    assert.strictEqual(detector.modelPath, 'assets/models/magenta/model.json');
    assert.strictEqual(detector.config.chunkSize, 8.0);
    assert.strictEqual(detector.config.targetSampleRate, 16000);
    assert.strictEqual(detector.config.confidenceThreshold, 0.5);
    assert.strictEqual(detector.modelLoaded, false);
    assert.strictEqual(detector.isActive, false);
    assert.strictEqual(detector.errorState, null);
  });
  
  test('should initialize with custom configuration', () => {
    const customConfig = {
      chunkSize: 4.0,
      confidenceThreshold: 0.7,
      enableWebWorker: true
    };
    
    const detector = new PolyphonicDetector('custom/path/model.json', customConfig);
    
    assert.strictEqual(detector.modelPath, 'custom/path/model.json');
    assert.strictEqual(detector.config.chunkSize, 4.0);
    assert.strictEqual(detector.config.confidenceThreshold, 0.7);
    assert.strictEqual(detector.config.enableWebWorker, true);
  });
  
  test('should not be ready initially', () => {
    const detector = new PolyphonicDetector('assets/models/magenta/model.json');
    
    assert.strictEqual(detector.isReady(), false);
  });
  
  test('should get current state', () => {
    const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
    
    const state = detector.getState();
    
    assert.strictEqual(state.modelLoaded, false);
    assert.strictEqual(state.isActive, false);
    assert.strictEqual(state.modelInfo, null);
    assert.strictEqual(state.inferenceCount, 0);
    assert.strictEqual(state.errorState, null);
  });

  test.describe('Model Loading', () => {
    
    test('should emit modelLoading events during load', async () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      // Mock TensorFlow.js
      global.tf = {
        loadGraphModel: () => Promise.reject(new Error('Model not found'))
      };
      
      const progressEvents = [];
      const errorEvents = [];
      
      detector.on('poly:modelLoading', (data) => {
        progressEvents.push(data);
      });
      
      detector.on('poly:modelError', (data) => {
        errorEvents.push(data);
      });
      
      await detector.loadModel();
      
      assert.ok(progressEvents.length > 0, 'Should emit modelLoading events');
      assert.ok(progressEvents[0].percent !== undefined, 'Progress should include percent');
      assert.ok(errorEvents.length > 0, 'Should emit error event');
      assert.strictEqual(errorEvents[0].fallbackMode, 'monophonic-only');
      assert.strictEqual(detector.modelLoaded, false);
    });
    
    test('should handle model load timeout', async () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', {
        ...mockConfig,
        timeoutMs: 100
      });
      
      // Mock TensorFlow.js that never resolves
      global.tf = {
        loadGraphModel: () => new Promise(() => {}) // Never resolves
      };
      
      const errorEvents = [];
      detector.on('poly:modelError', (data) => {
        errorEvents.push(data);
      });
      
      const result = await detector.loadModel();
      
      assert.strictEqual(result, false, 'Should return false on timeout');
      assert.ok(errorEvents.length > 0, 'Should emit error event');
      assert.ok(errorEvents[0].error.includes('timeout'), 'Should timeout error');
    });
    
    test('should validate model structure', async () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      // Mock TensorFlow.js with invalid model
      global.tf = {
        loadGraphModel: () => Promise.resolve({
          inputs: [],
          outputs: [],
          weights: []
        })
      };
      
      const errorEvents = [];
      detector.on('poly:modelError', (data) => {
        errorEvents.push(data);
      });
      
      await detector.loadModel();
      
      assert.ok(errorEvents.length > 0, 'Should emit error for invalid model');
      assert.ok(errorEvents[0].error.includes('missing inputs'), 'Should validate inputs');
    });
    
    test('should check for recoverable errors', async () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      const networkError = new Error('Network error');
      const fileError = new Error('Model file not found');
      const otherError = new Error('Other error');
      
      assert.strictEqual(detector._isRecoverableError(networkError), true);
      assert.strictEqual(detector._isRecoverableError(fileError), true);
      assert.strictEqual(detector._isRecoverableError(otherError), false);
    });
    
    test('should notify fallback mode', async () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      // Mock TensorFlow.js to fail
      global.tf = {
        loadGraphModel: () => Promise.reject(new Error('Model not found'))
      };
      
      const fallbackEvents = [];
      detector.on('poly:fallback', (data) => {
        fallbackEvents.push(data);
      });
      
      await detector.loadModel();
      
      assert.ok(fallbackEvents.length > 0, 'Should emit fallback event');
      assert.ok(fallbackEvents[0].message.includes('monophonic'), 'Should mention monophonic');
      assert.strictEqual(fallbackEvents[0].canRetry, true, 'Should allow retry for missing file');
    });

  });
  
  test.describe('Audio Processing', () => {
    
    test('should resample audio correctly', () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', {
        ...mockConfig,
        targetSampleRate: 16000
      });
      
      // Mock audio context
      detector.audioContext = { sampleRate: 44100 };
      
      // Create 44100Hz audio (1 second)
      const audioChunk = new Float32Array(44100);
      for (let i = 0; i < audioChunk.length; i++) {
        audioChunk[i] = Math.sin(2 * Math.PI * 440 * i / 44100);
      }
      
      const resampled = detector._resampleIfNeeded(audioChunk);
      
      // Should be resampled to 16000Hz (approximately)
      const expectedLength = Math.floor(44100 * 16000 / 44100);
      assert.ok(Math.abs(resampled.length - 16000) < 100, 
        `Resampled length ${resampled.length} should be close to 16000`);
      
      // Verify values are reasonable (not NaN, not all zeros)
      const hasValues = resampled.some(val => !isNaN(val) && val !== 0);
      assert.ok(hasValues, 'Resampled audio should contain values');
    });
    
    test('should handle resampling when sample rates match', () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', {
        ...mockConfig,
        targetSampleRate: 44100
      });
      
      detector.audioContext = { sampleRate: 44100 };
      
      const audioChunk = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      const resampled = detector._resampleIfNeeded(audioChunk);
      
      assert.strictEqual(resampled, audioChunk, 'Should return original array when rates match');
    });
    
    test('should normalize amplitude to [-1, 1]', () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      // Create audio with amplitude 0.5
      const audioChunk = new Float32Array(1000);
      for (let i = 0; i < audioChunk.length; i++) {
        audioChunk[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / 44100);
      }
      
      const normalized = detector._normalizeAmplitude(audioChunk);
      
      // Find max absolute value
      let max = 0;
      for (let i = 0; i < normalized.length; i++) {
        max = Math.max(max, Math.abs(normalized[i]));
      }
      
      assert.ok(Math.abs(max - 1.0) < 0.01, 
        `Normalized max ${max} should be close to 1.0`);
      
      // Verify all values are in [-1, 1]
      const allValid = normalized.every(val => val >= -1 && val <= 1);
      assert.ok(allValid, 'All normalized values should be in [-1, 1]');
    });
    
    test('should handle empty audio chunk', () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      const audioChunk = new Float32Array([]);
      const normalized = detector._normalizeAmplitude(audioChunk);
      
      assert.strictEqual(normalized.length, 0, 'Empty chunk should remain empty');
    });
    
    test('should handle audio with zero amplitude', () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      const audioChunk = new Float32Array([0, 0, 0, 0, 0]);
      const normalized = detector._normalizeAmplitude(audioChunk);
      
      assert.strictEqual(normalized, audioChunk, 'Zero amplitude should remain unchanged');
    });

  });
  
  test.describe('Note Processing', () => {
    
    test('should deduplicate notes in same time window', () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      const notes = [
        { midi: 60, timeStep: 0, confidence: 0.9, velocity: 64 },
        { midi: 60, timeStep: 0, confidence: 0.85, velocity: 64 }, // Duplicate
        { midi: 64, timeStep: 0, confidence: 0.8, velocity: 64 },
        { midi: 60, timeStep: 1, confidence: 0.9, velocity: 64 }  // Different time
      ];
      
      const deduplicated = detector._deduplicateNotes(notes);
      
      assert.strictEqual(deduplicated.length, 3, 'Should remove one duplicate');
      
      // Verify unique combinations
      const keys = deduplicated.map(n => `${n.midi}-${n.timeStep}`);
      const uniqueKeys = new Set(keys);
      assert.strictEqual(keys.length, uniqueKeys.size, 'All should be unique');
      
      // Check specific notes remain
      const note60Step0 = deduplicated.find(n => n.midi === 60 && n.timeStep === 0);
      const note64Step0 = deduplicated.find(n => n.midi === 64 && n.timeStep === 0);
      const note60Step1 = deduplicated.find(n => n.midi === 60 && n.timeStep === 1);
      
      assert.ok(note60Step0, 'Note C4 at step 0 should remain');
      assert.ok(note64Step0, 'Note E4 at step 0 should remain');
      assert.ok(note60Step1, 'Note C4 at step 1 should remain');
    });
    
    test('should handle empty notes array', () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      const deduplicated = detector._deduplicateNotes([]);
      
      assert.strictEqual(deduplicated.length, 0, 'Empty array should remain empty');
    });
    
    test('should parse model output with single tensor', () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      // Mock model output
      const mockTensor = {
        dataSync: () => {
          // Simulate [batch, time, pitches] = [1, 10, 88]
          const data = new Float32Array(10 * 88);
          // Set some high probabilities
          data[0] = 0.9;  // step 0, pitch 0
          data[64] = 0.8; // step 0, pitch 64
          data[880] = 0.7; // step 10, pitch 0
          return data;
        },
        shape: [1, 10, 88]
      };
      
      const results = detector._parseModelOutput(mockTensor);
      
      assert.ok(results.length > 0, 'Should detect notes');
      assert.strictEqual(results[0].midi, 21, 'Should offset by 21 (A0)');
    });
    
    test('should filter by confidence threshold', () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', {
        ...mockConfig,
        confidenceThreshold: 0.8
      });
      
      // Mock model output with varying confidences
      const mockTensor = {
        dataSync: () => {
          const data = new Float32Array(88);
          data[0] = 0.9;   // Above threshold
          data[1] = 0.75;  // Below threshold
          data[2] = 0.85;  // Above threshold
          return data;
        },
        shape: [1, 1, 88]
      };
      
      const results = detector._parseModelOutput(mockTensor);
      
      assert.strictEqual(results.length, 2, 'Should only include high confidence notes');
      assert.strictEqual(results[0].confidence, 0.9);
      assert.strictEqual(results[1].confidence, 0.85);
    });

  });
  
  test.describe('Error Handling', () => {
    
    test('should handle TensorFlow.js not loaded', async () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      // Ensure tf is undefined
      global.tf = undefined;
      
      const errorEvents = [];
      detector.on('poly:modelError', (data) => {
        errorEvents.push(data);
      });
      
      await detector.loadModel();
      
      assert.ok(errorEvents.length > 0, 'Should emit error');
      assert.ok(errorEvents[0].error.includes('TensorFlow.js not loaded'), 'Should mention TF.js');
    });
    
    test('should handle start without model', async () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      const notReadyEvents = [];
      detector.on('poly:notReady', (data) => {
        notReadyEvents.push(data);
      });
      
      await detector.start({}, {});
      
      assert.ok(notReadyEvents.length > 0, 'Should emit notReady event');
      assert.strictEqual(detector.isActive, false, 'Should not become active');
    });
    
    test('should handle double start', async () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      // Mock successful model load
      global.tf = {
        loadGraphModel: () => Promise.resolve({
          inputs: [{ shape: [1, 128000] }],
          outputs: [{ shape: [1, 10, 88] }],
          weights: [],
          dispose: () => {}
        })
      };
      
      await detector.loadModel();
      
      // Mock audio context and stream
      const mockAudioContext = {
        createMediaStreamSource: () => ({ connect: () => {} }),
        createScriptProcessor: () => ({ 
          connect: () => {},
          onaudioprocess: null
        }),
        sampleRate: 44100
      };
      
      const mockStream = {};
      
      // First start should work
      await detector.start(mockAudioContext, mockStream);
      assert.strictEqual(detector.isActive, true, 'Should be active after first start');
      
      // Second start should be ignored
      await detector.start(mockAudioContext, mockStream);
      assert.strictEqual(detector.isActive, true, 'Should remain active');
    });

  });
  
  test.describe('State Management', () => {
    
    test('should dispose resources properly', async () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      // Mock model
      global.tf = {
        loadGraphModel: () => Promise.resolve({
          dispose: () => {},
          inputs: [{ shape: [1, 128000] }],
          outputs: [{ shape: [1, 10, 88] }]
        })
      };
      
      await detector.loadModel();
      assert.strictEqual(detector.modelLoaded, true, 'Model should be loaded');
      
      detector.dispose();
      
      assert.strictEqual(detector.modelLoaded, false, 'Model should be unloaded');
      assert.strictEqual(detector.model, null, 'Model reference should be null');
      assert.strictEqual(detector.errorState, null, 'Error state should be cleared');
    });
    
    test('should stop detection', async () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      // Mock active detection
      detector.isActive = true;
      detector.processorNode = {
        disconnect: () => {},
        onaudioprocess: () => {}
      };
      detector.sourceNode = {
        disconnect: () => {}
      };
      
      const stoppedEvents = [];
      detector.on('poly:stopped', () => {
        stoppedEvents.push(true);
      });
      
      detector.stop();
      
      assert.strictEqual(detector.isActive, false, 'Should not be active');
      assert.strictEqual(detector.processorNode, null, 'Processor should be null');
      assert.strictEqual(detector.sourceNode, null, 'Source should be null');
      assert.ok(stoppedEvents.length > 0, 'Should emit stopped event');
    });
    
    test('should handle stop when not active', () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      assert.strictEqual(detector.isActive, false, 'Should not be active initially');
      
      // Should not throw or cause issues
      detector.stop();
      
      assert.strictEqual(detector.isActive, false, 'Should remain inactive');
    });

  });
  
  test.describe('Mock Functionality', () => {
    
    test('should use mock model loader for development', async () => {
      const detector = new PolyphonicDetector('invalid/path/model.json', mockConfig);
      
      // Mock model loader to simulate development mode
      detector.loadModel = async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
        
        this.emit('poly:modelError', {
          error: 'Model files not found (development mode)',
          fallbackMode: 'monophonic-only',
          recoverable: false
        });
        
        this._notifyFallback();
        return false;
      };
      
      const fallbackEvents = [];
      detector.on('poly:fallback', (data) => {
        fallbackEvents.push(data);
      });
      
      const result = await detector.loadModel();
      
      assert.strictEqual(result, false, 'Should return false for missing model');
      assert.ok(fallbackEvents.length > 0, 'Should emit fallback event');
      assert.ok(fallbackEvents[0].message.includes('development mode'), 'Should mention development mode');
    });
    
    test('should handle model file existence check', async () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      // Mock fetch to simulate file not found
      global.fetch = () => Promise.resolve({ ok: false, status: 404 });
      
      const errorEvents = [];
      detector.on('poly:modelError', (data) => {
        errorEvents.push(data);
      });
      
      await detector.loadModel();
      
      assert.ok(errorEvents.length > 0, 'Should emit error for missing file');
      assert.ok(errorEvents[0].error.includes('not found'), 'Should mention file not found');
    });

  });

  test.describe('Memory Management', () => {
    
    test('should get memory usage info', () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      // Mock performance.memory
      const mockMemory = { usedJSHeapSize: 1024 * 1024 * 50 }; // 50MB
      Object.defineProperty(global, 'performance', {
        value: { memory: mockMemory },
        configurable: true
      });
      
      const state = detector.getState();
      
      assert.strictEqual(state.memoryUsage, 50 * 1024 * 1024, 'Should report memory usage');
    });
    
    test('should handle missing performance.memory', () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      // Mock performance without memory
      Object.defineProperty(global, 'performance', {
        value: {},
        configurable: true
      });
      
      const state = detector.getState();
      
      assert.strictEqual(state.memoryUsage, 0, 'Should return 0 when memory API not available');
    });

  });

  test.describe('Integration Scenarios', () => {
    
    test('should complete full workflow with synthetic data', async () => {
      const detector = new PolyphonicDetector('assets/models/magenta/model.json', mockConfig);
      
      // Mock successful model load
      global.tf = {
        loadGraphModel: () => Promise.resolve({
          inputs: [{ shape: [1, 128000] }],
          outputs: [{ shape: [1, 10, 88] }],
          weights: [],
          executeAsync: () => Promise.resolve({
            dataSync: () => {
              const data = new Float32Array(10 * 88);
              data[0] = 0.9; // High confidence note
              return data;
            },
            shape: [1, 10, 88],
            dispose: () => {}
          }),
          dispose: () => {}
        })
      };
      
      // Load model
      const loadSuccess = await detector.loadModel();
      assert.strictEqual(loadSuccess, true, 'Should load successfully');
      assert.strictEqual(detector.isReady(), true, 'Should be ready');
      
      // Mock audio processing
      detector.audioContext = {
        createMediaStreamSource: () => ({ connect: () => {} }),
        createScriptProcessor: () => ({ 
          connect: () => {},
          onaudioprocess: null
        }),
        sampleRate: 44100,
        destination: {}
      };
      
      const mockStream = {};
      
      const detectionEvents = [];
      detector.on('poly:detected', (event) => {
        detectionEvents.push(event);
      });
      
      // Start detection
      await detector.start(detector.audioContext, mockStream);
      assert.strictEqual(detector.isActive, true, 'Should be active');
      
      // Test audio processing pipeline
      const testAudio = new Float32Array(4096).fill(0.1);
      detector._onAudioProcess({
        inputBuffer: { getChannelData: () => testAudio },
        outputBuffer: { set: () => {} }
      });
      
      // Note: Full inference testing would require the actual model
      // This test verifies the pipeline structure
      
      // Stop detection
      detector.stop();
      assert.strictEqual(detector.isActive, false, 'Should stop successfully');
      
      // Cleanup
      detector.dispose();
      assert.strictEqual(detector.modelLoaded, false, 'Should dispose properly');
    });

  });

});

// Clean up mocks
after(() => {
  delete global.tf;
  delete global.fetch;
  delete global.performance;
});
