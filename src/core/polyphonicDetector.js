/**
 * @module polyphonicDetector
 * @description Polyphonic pitch detection with TensorFlow.js Magenta model
 * 
 * Integrates TensorFlow.js Onsets & Frames model for multi-note detection with:
 * - Model loading with progress indication
 * - Audio processing pipeline (resampling, normalization, chunking)
 * - Web Worker inference (optional)
 * - Graceful degradation to monophonic mode
 * - Memory-efficient processing
 * 
 * @extends EventEmitter
 * @fires PolyphonicDetector#poly:modelLoading
 * @fires PolyphonicDetector#poly:modelLoaded
 * @fires PolyphonicDetector#poly:modelError
 * @fires PolyphonicDetector#poly:fallback
 * @fires PolyphonicDetector#poly:detected
 * @fires PolyphonicDetector#poly:started
 * @fires PolyphonicDetector#poly:stopped
 * @fires PolyphonicDetector#poly:inferenceError
 * @fires PolyphonicDetector#poly:notReady
 * @fires PolyphonicDetector#poly:workerError
 * 
 * @see Architecture.md §3.5 (Polyphonic Detector Module)
 * @see Architecture.md §4.2 (PitchStream - Polyphonic Event)
 * @see prompt_07.md (Complete implementation specifications)
 */

import { EventEmitter } from '../utils/eventEmitter.js';
import { Logger } from '../utils/logger.js';
import { performanceMonitor } from '../utils/performanceMonitor.js';

/**
 * PolyphonicDetector - Chord-based pitch detection
 * 
 * Responsibilities:
 * - Load and run TensorFlow.js Magenta Onsets & Frames model
 * - Process audio in 8-second chunks with resampling to 16kHz
 * - Detect multiple simultaneous pitches (chords)
 * - Provide graceful degradation to monophonic mode
 * - Emit polyphonic PitchStream events
 * - Manage memory efficiently (target <150MB model)
 * 
 * @extends EventEmitter
 */
class PolyphonicDetector extends EventEmitter {
  /**
   * Initialize polyphonic detector and prepare model loading
   * 
   * @param {string} modelPath - Path to model.json
   * @param {DetectorConfig} config - Configuration options
   * 
   * @example
   * const detector = new PolyphonicDetector('assets/models/magenta/model.json', {
   *   chunkSize: 8.0,
   *   targetSampleRate: 16000,
   *   confidenceThreshold: 0.5,
   *   fallbackToMonophonic: true
   * });
   */
  constructor(modelPath, config = {}) {
    super();
    
    /**
     * Model path for TensorFlow.js model
     * @type {string}
     */
    this.modelPath = modelPath || 'assets/models/magenta/model.json';
    
    /**
     * Configuration options
     * @type {DetectorConfig}
     */
    this.config = {
      chunkSize: 8.0,                    // Seconds (model requirement)
      targetSampleRate: 16000,           // Hz (model requirement)
      confidenceThreshold: 0.5,          // 0.0-1.0
      maxConcurrentInferences: 1,        // Limit parallel processing
      timeoutMs: 30000,                  // Model load timeout
      enableWebWorker: false,            // Use Web Worker for inference
      fallbackToMonophonic: true,        // Auto-fallback on failure
      estimatedModelSize: 150 * 1024 * 1024, // 150MB
      ...config
    };
    
    /**
     * TensorFlow.js model
     * @type {tf.GraphModel|null}
     */
    this.model = null;
    
    /**
     * Model loaded state
     * @type {boolean}
     */
    this.modelLoaded = false;
    
    /**
     * Detection active state
     * @type {boolean}
     */
    this.isActive = false;
    
    /**
     * Model load start time
     * @type {number}
     */
    this.loadStartTime = 0;
    
    /**
     * Web Audio context for processing
     * @type {AudioContext|null}
     */
    this.audioContext = null;
    
    /**
     * Microphone stream
     * @type {MediaStream|null}
     */
    this.stream = null;
    
    /**
     * Audio processing nodes
     * @type {MediaStreamAudioSourceNode|null}
     */
    this.sourceNode = null;
    
    /**
     * Script processor for audio chunking
     * @type {ScriptProcessorNode|null}
     */
    this.processorNode = null;
    
    /**
     * Audio buffer for chunking
     * @type {Float32Array|null}
     */
    this.audioBuffer = null;
    
    /**
     * Current buffer index
     * @type {number}
     */
    this.bufferIndex = 0;
    
    /**
     * Chunk size in samples
     * @type {number}
     */
    this.chunkSizeInSamples = 0;
    
    /**
     * Web Worker for inference (optional)
     * @type {Worker|null}
     */
    this.worker = null;
    
    /**
     * Inference in progress flag
     * @type {boolean}
     */
    this.isInferring = false;
    
    /**
     * Total inference count
     * @type {number}
     */
    this.inferenceCount = 0;
    
    /**
     * Detection start time for timestamps
     * @type {number}
     */
    this.startTime = 0;
    
    /**
     * Error state
     * @type {string|null}
     */
    this.errorState = null;
    
    Logger.log(Logger.INFO, 'PolyphonicDetector', 'Initialized', {
      modelPath: this.modelPath,
      chunkSize: this.config.chunkSize,
      targetSampleRate: this.config.targetSampleRate
    });
  }

  /**
   * Load TensorFlow.js Lite model from local files
   * 
   * @returns {Promise<boolean>} True if loaded, false if failed
   * 
   * @emits PolyphonicDetector#poly:modelLoading
   * @emits PolyphonicDetector#poly:modelLoaded
   * @emits PolyphonicDetector#poly:modelError
   * @emits PolyphonicDetector#poly:fallback
   * 
   * @example
   * const success = await detector.loadModel();
   * if (!success) {
   *   console.log('Using monophonic mode');
   * }
   */
  async loadModel() {
    Logger.log(Logger.INFO, 'PolyphonicDetector', 'Starting model load', {
      modelPath: this.modelPath
    });
    
    try {
      this.emit('poly:modelLoading', { 
        percent: 0, 
        status: 'Initializing...'
      });
      
      // Check if TensorFlow.js is available
      if (typeof tf === 'undefined') {
        throw new Error('TensorFlow.js not loaded. Include tf.min.js before using PolyphonicDetector.');
      }
      
      this.loadStartTime = Date.now();
      
      // Load model with timeout and progress
      const loadPromise = this._loadModelWithProgress();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Model load timeout')), this.config.timeoutMs);
      });
      
      this.model = await Promise.race([loadPromise, timeoutPromise]);
      
      // Validate model structure
      this._validateModelStructure();
      
      this.modelLoaded = true;
      
      const loadTime = Date.now() - this.loadStartTime;
      
      this.emit('poly:modelLoaded', {
        modelInfo: this._getModelInfo(),
        loadTime: loadTime
      });
      
      Logger.log(Logger.INFO, 'PolyphonicDetector', 'Model loaded successfully', {
        loadTime: `${loadTime}ms`,
        modelInfo: this._getModelInfo()
      });
      
      return true;
      
    } catch (error) {
      Logger.log(Logger.ERROR, 'PolyphonicDetector', 'Model load failed', {
        error: error.message,
        stack: error.stack
      });
      
      this.modelLoaded = false;
      this.errorState = error.message;
      
      this.emit('poly:modelError', {
        error: error.message,
        fallbackMode: 'monophonic-only',
        recoverable: this._isRecoverableError(error)
      });
      
      if (this.config.fallbackToMonophonic) {
        this._notifyFallback();
      }
      
      return false;
    }
  }

  /**
   * Load model with progress indication
   * 
   * @private
   * @returns {Promise<tf.GraphModel>} Loaded model
   */
  async _loadModelWithProgress() {
    return new Promise(async (resolve, reject) => {
      try {
        // Check if model file exists first
        const response = await fetch(this.modelPath);
        if (!response.ok) {
          throw new Error(`Model file not found: ${this.modelPath} (${response.status})`);
        }
        
        // Estimate model size from response headers
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          this.config.estimatedModelSize = parseInt(contentLength, 10);
        }
        
        const model = await tf.loadGraphModel(this.modelPath, {
          onProgress: (fraction) => {
            const percent = Math.round(fraction * 100);
            const bytesLoaded = fraction * this.config.estimatedModelSize;
            const bytesTotal = this.config.estimatedModelSize;
            
            this.emit('poly:modelLoading', {
              percent: percent,
              status: 'Downloading model...',
              bytesLoaded: bytesLoaded,
              bytesTotal: bytesTotal
            });
          }
        });
        
        resolve(model);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Validate model structure
   * 
   * @private
   * @throws {Error} If model structure is invalid
   */
  _validateModelStructure() {
    if (!this.model || !this.model.inputs || !this.model.inputs[0]) {
      throw new Error('Invalid model: missing inputs');
    }
    
    const inputShape = this.model.inputs[0].shape;
    
    if (!inputShape || inputShape.length < 2) {
      throw new Error(`Invalid model structure: unexpected input shape ${JSON.stringify(inputShape)}`);
    }
    
    // Expected: [batch, samples] or [batch, samples, channels]
    Logger.log(Logger.DEBUG, 'PolyphonicDetector', 'Model validation passed', {
      inputShape: inputShape,
      outputCount: this.model.outputs.length
    });
  }

  /**
   * Get model information
   * 
   * @private
   * @returns {Object} Model information
   */
  _getModelInfo() {
    try {
      const inputShape = this.model.inputs[0].shape;
      const outputShape = this.model.outputs[0].shape;
      
      // Estimate model size
      let sizeBytes = 0;
      if (this.model.weights) {
        this.model.weights.forEach(weight => {
          sizeBytes += weight.size * 4; // Float32 = 4 bytes
        });
      }
      
      return {
        inputShape,
        outputShape,
        sizeBytes,
        sizeMB: Math.round(sizeBytes / 1024 / 1024)
      };
    } catch (error) {
      Logger.log(Logger.WARN, 'PolyphonicDetector', 'Failed to get model info', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Check if error is recoverable
   * 
   * @private
   * @param {Error} error - The error to check
   * @returns {boolean} True if error might be transient
   */
  _isRecoverableError(error) {
    return error.message.includes('fetch') || 
           error.message.includes('network') ||
           error.message.includes('timeout') ||
           error.message.includes('Model file not found');
  }

  /**
   * Notify user of fallback mode
   * 
   * @private
   */
  _notifyFallback() {
    Logger.log(Logger.WARN, 'PolyphonicDetector', 'Polyphonic detection unavailable - using monophonic fallback');
    
    this.emit('poly:fallback', {
      reason: 'Model load failed',
      message: 'Polyphonic chord detection is unavailable. The app will continue with single-note detection only.',
      canRetry: this._isRecoverableError({ message: this.errorState })
    });
  }

  /**
   * Start polyphonic detection from microphone
   * 
   * @param {AudioContext} audioContext - Web Audio context
   * @param {MediaStream} stream - Microphone audio stream
   * @returns {Promise<void>}
   * 
   * @emits PolyphonicDetector#poly:notReady
   * @emits PolyphonicDetector#poly:started
   * @emits PolyphonicDetector#poly:error
   * 
   * @example
   * await detector.start(audioContext, microphoneStream);
   */
  async start(audioContext, stream) {
    if (!this.modelLoaded) {
      Logger.log(Logger.WARN, 'PolyphonicDetector', 'Model not loaded, polyphonic detection unavailable');
      this.emit('poly:notReady', { 
        message: 'Model not loaded. Use loadModel() first or continue with monophonic detection.' 
      });
      return;
    }
    
    if (this.isActive) {
      Logger.log(Logger.WARN, 'PolyphonicDetector', 'Detection already active');
      return;
    }
    
    try {
      this.audioContext = audioContext;
      this.stream = stream;
      
      // Create audio processing chain
      this.sourceNode = audioContext.createMediaStreamSource(stream);
      
      // Use ScriptProcessorNode for audio buffering (AudioWorklet would be better but requires more setup)
      this.processorNode = audioContext.createScriptProcessor(4096, 1, 1);
      
      // Setup audio buffering
      this.chunkSizeInSamples = this.config.chunkSize * this.config.targetSampleRate;
      this.audioBuffer = new Float32Array(this.chunkSizeInSamples);
      this.bufferIndex = 0;
      
      // Setup Web Worker if enabled
      if (this.config.enableWebWorker) {
        await this._setupWebWorker();
      }
      
      // Setup audio processing
      this.processorNode.onaudioprocess = (event) => {
        this._onAudioProcess(event);
      };
      
      // Connect audio chain
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(audioContext.destination);
      
      this.isActive = true;
      this.startTime = Date.now();
      this.emit('poly:started', { 
        chunkSize: this.config.chunkSize,
        targetSampleRate: this.config.targetSampleRate
      });
      
      Logger.log(Logger.INFO, 'PolyphonicDetector', 'Detection started', {
        chunkSize: this.config.chunkSize,
        targetSampleRate: this.config.targetSampleRate,
        webWorker: this.config.enableWebWorker
      });
      
    } catch (error) {
      Logger.log(Logger.ERROR, 'PolyphonicDetector', 'Failed to start detection', {
        error: error.message
      });
      this.emit('poly:error', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup Web Worker for inference
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _setupWebWorker() {
    try {
      this.worker = new Worker('src/workers/polyDetector.worker.js');
      
      this.worker.onmessage = (event) => {
        const { type, results, error, inferenceTime } = event.data;
        
        switch (type) {
          case 'modelLoaded':
            Logger.log(Logger.INFO, 'PolyphonicDetector', 'Model loaded in Web Worker');
            break;
            
          case 'inferenceComplete':
            Logger.log(Logger.DEBUG, 'PolyphonicDetector', `Worker inference: ${inferenceTime}ms`);
            this._handleInferenceResults(results);
            break;
            
          case 'error':
          case 'modelLoadError':
          case 'inferenceError':
            Logger.log(Logger.ERROR, 'PolyphonicDetector', 'Worker error:', error);
            this.emit('poly:error', { error });
            break;
        }
      };
      
      this.worker.onerror = (error) => {
        Logger.log(Logger.ERROR, 'PolyphonicDetector', 'Worker error:', error);
        this.emit('poly:workerError', { error: error.message });
      };
      
      // Load model in worker
      this.worker.postMessage({
        type: 'loadModel',
        data: { modelPath: this.modelPath }
      });
      
    } catch (error) {
      Logger.log(Logger.WARN, 'PolyphonicDetector', 'Web Worker setup failed, falling back to direct execution', {
        error: error.message
      });
      this.config.enableWebWorker = false;
    }
  }

  /**
   * Handle audio processing events
   * 
   * @private
   * @param {AudioProcessingEvent} event - Audio processing event
   */
  _onAudioProcess(event) {
    const inputData = event.inputBuffer.getChannelData(0);
    const outputData = event.outputBuffer.getChannelData(0);
    
    // Passthrough audio
    outputData.set(inputData);
    
    // Accumulate audio into chunk buffer
    const remaining = this.chunkSizeInSamples - this.bufferIndex;
    const toCopy = Math.min(inputData.length, remaining);
    
    if (toCopy > 0) {
      this.audioBuffer.set(
        inputData.subarray(0, toCopy),
        this.bufferIndex
      );
      this.bufferIndex += toCopy;
    }
    
    // When chunk is full, process it
    if (this.bufferIndex >= this.chunkSizeInSamples) {
      const audioChunk = this.audioBuffer.slice();
      this._processChunk(audioChunk);
      
      // Reset buffer for next chunk
      this.bufferIndex = 0;
      this.audioBuffer.fill(0);
    }
  }

  /**
   * Process audio chunk through inference pipeline
   * 
   * @private
   * @param {Float32Array} audioChunk - Audio data to process
   */
  async _processChunk(audioChunk) {
    // Prevent concurrent inferences
    if (this.isInferring && this.config.maxConcurrentInferences <= 1) {
      Logger.log(Logger.DEBUG, 'PolyphonicDetector', 'Inference already in progress, skipping chunk');
      return;
    }
    
    this.isInferring = true;
    
    try {
      performanceMonitor.startMeasurement('polyphonicInference');
      
      // Resample if needed
      const resampled = this._resampleIfNeeded(audioChunk);
      
      // Normalize amplitude
      const normalized = this._normalizeAmplitude(resampled);
      
      // Run inference (Web Worker or direct)
      let results;
      if (this.config.enableWebWorker && this.worker) {
        results = await this._inferenceViaWorker(normalized);
      } else {
        results = await this._inferenceDirect(normalized);
      }
      
      // Process results
      this._handleInferenceResults(results);
      
    } catch (error) {
      Logger.log(Logger.ERROR, 'PolyphonicDetector', 'Inference error:', {
        error: error.message,
        inferenceCount: this.inferenceCount
      });
      this.emit('poly:inferenceError', { error: error.message });
    } finally {
      this.isInferring = false;
      
      const latency = performanceMonitor.endMeasurement('polyphonicInference');
      if (latency > 300) {
        Logger.log(Logger.WARN, 'PolyphonicDetector', `High inference latency: ${latency.toFixed(2)}ms`);
      }
    }
  }

  /**
   * Resample audio to target sample rate
   * 
   * @private
   * @param {Float32Array} audioChunk - Audio data to resample
   * @returns {Float32Array} Resampled audio data
   */
  _resampleIfNeeded(audioChunk) {
    const currentSampleRate = this.audioContext.sampleRate;
    const targetSampleRate = this.config.targetSampleRate;
    
    if (currentSampleRate === targetSampleRate) {
      return audioChunk;
    }
    
    // Simple linear interpolation resampling
    const ratio = targetSampleRate / currentSampleRate;
    const newLength = Math.floor(audioChunk.length * ratio);
    const resampled = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i / ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, audioChunk.length - 1);
      const fraction = srcIndex - srcIndexFloor;
      
      resampled[i] = audioChunk[srcIndexFloor] * (1 - fraction) + 
                     audioChunk[srcIndexCeil] * fraction;
    }
    
    Logger.log(Logger.DEBUG, 'PolyphonicDetector', 'Audio resampled', {
      from: currentSampleRate,
      to: targetSampleRate,
      ratio: ratio.toFixed(2)
    });
    
    return resampled;
  }

  /**
   * Normalize amplitude to [-1, 1] range
   * 
   * @private
   * @param {Float32Array} audioChunk - Audio data to normalize
   * @returns {Float32Array} Normalized audio data
   */
  _normalizeAmplitude(audioChunk) {
    // Find max absolute value
    let max = 0;
    for (let i = 0; i < audioChunk.length; i++) {
      max = Math.max(max, Math.abs(audioChunk[i]));
    }
    
    // Normalize to [-1, 1]
    if (max > 0 && max !== 1) {
      const normalized = new Float32Array(audioChunk.length);
      for (let i = 0; i < audioChunk.length; i++) {
        normalized[i] = audioChunk[i] / max;
      }
      return normalized;
    }
    
    return audioChunk;
  }

  /**
   * Run inference directly (no Web Worker)
   * 
   * @private
   * @param {Float32Array} audioData - Audio data for inference
   * @returns {Promise<Array>} Detected notes
   */
  async _inferenceDirect(audioData) {
    const startTime = performance.now();
    
    try {
      // Create input tensor
      // Shape: [1, samples] for mono audio
      const inputTensor = tf.tensor2d([audioData], [1, audioData.length]);
      
      // Run model
      const outputTensors = await this.model.executeAsync(inputTensor);
      
      // Parse outputs (implementation depends on specific model)
      const results = this._parseModelOutput(outputTensors);
      
      // Clean up tensors
      inputTensor.dispose();
      if (Array.isArray(outputTensors)) {
        outputTensors.forEach(t => t.dispose());
      } else {
        outputTensors.dispose();
      }
      
      const inferenceTime = performance.now() - startTime;
      Logger.log(Logger.DEBUG, 'PolyphonicDetector', `Direct inference: ${inferenceTime.toFixed(2)}ms`);
      
      return results;
      
    } catch (error) {
      Logger.log(Logger.ERROR, 'PolyphonicDetector', 'Direct inference failed:', error);
      throw error;
    }
  }

  /**
   * Run inference via Web Worker
   * 
   * @private
   * @param {Float32Array} audioData - Audio data for inference
   * @returns {Promise<Array>} Detected notes
   */
  async _inferenceViaWorker(audioData) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker inference timeout'));
      }, 10000);
      
      const handler = (event) => {
        if (event.data.type === 'inferenceComplete') {
          clearTimeout(timeout);
          this.worker.removeEventListener('message', handler);
          resolve(event.data.results);
        } else if (event.data.type === 'inferenceError') {
          clearTimeout(timeout);
          this.worker.removeEventListener('message', handler);
          reject(new Error(event.data.error));
        }
      };
      
      this.worker.addEventListener('message', handler);
      this.worker.postMessage({
        type: 'inference',
        data: { audioData: Array.from(audioData) }
      });
    });
  }

  /**
   * Parse model output tensors into note events
   * 
   * @private
   * @param {tf.Tensor|tf.Tensor[]} outputTensors - Model output
   * @returns {Array} Detected notes
   */
  _parseModelOutput(outputTensors) {
    // Extract tensor data - implementation depends on specific model version
    // This is a simplified version for development
    
    let onsetsTensor, framesTensor, velocitiesTensor;
    
    if (Array.isArray(outputTensors)) {
      [onsetsTensor, framesTensor, velocitiesTensor] = outputTensors;
    } else {
      onsetsTensor = outputTensors;
    }
    
    // Get data as arrays
    const onsetsData = onsetsTensor.dataSync();
    const framesData = framesTensor ? framesTensor.dataSync() : null;
    const velocitiesData = velocitiesTensor ? velocitiesTensor.dataSync() : null;
    
    // Parse into note events
    const notes = [];
    const shape = onsetsTensor.shape; // [batch, time, pitches]
    const numTimeSteps = shape[1];
    const numPitches = shape[2]; // Usually 88 (piano range) or 128 (full MIDI)
    
    for (let t = 0; t < numTimeSteps; t++) {
      for (let p = 0; p < numPitches; p++) {
        const index = t * numPitches + p;
        const onsetProb = onsetsData[index];
        
        // Threshold filtering
        if (onsetProb > this.config.confidenceThreshold) {
          notes.push({
            midi: p + 21, // Offset if model outputs piano range (A0=21)
            confidence: onsetProb,
            velocity: velocitiesData ? Math.round(velocitiesData[index] * 127) : 64,
            timeStep: t
          });
        }
      }
    }
    
    return this._deduplicateNotes(notes);
  }

  /**
   * Remove duplicate detections in same time window
   * 
   * @private
   * @param {Array} notes - Notes to deduplicate
   * @returns {Array} Deduplicated notes
   */
  _deduplicateNotes(notes) {
    const uniqueNotes = [];
    const seen = new Set();
    
    notes.forEach(note => {
      const key = `${note.midi}-${note.timeStep}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueNotes.push(note);
      }
    });
    
    return uniqueNotes;
  }

  /**
   * Handle inference results and emit events
   * 
   * @private
   * @param {Array} results - Detected notes
   */
  _handleInferenceResults(results) {
    if (results.length === 0) {
      return; // No notes detected
    }
    
    this.inferenceCount++;
    
    // Emit polyphonic PitchStream event
    const pitchEvent = {
      type: 'polyphonic',
      timestamp: Date.now() - this.startTime,
      notes: results.map(r => ({
        midi: r.midi,
        confidence: r.confidence,
        velocity: r.velocity
      })),
      onset: true
    };
    
    this.emit('poly:detected', pitchEvent);
  }

  /**
   * Stop polyphonic detection
   * 
   * @emits PolyphonicDetector#poly:stopped
   * 
   * @example
   * await detector.stop();
   */
  stop() {
    if (!this.isActive) return;
    
    try {
      // Disconnect audio nodes
      if (this.processorNode) {
        this.processorNode.disconnect();
        this.processorNode.onaudioprocess = null;
        this.processorNode = null;
      }
      
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
      
      // Terminate worker
      if (this.worker) {
        this.worker.postMessage({ type: 'dispose' });
        this.worker.terminate();
        this.worker = null;
      }
      
      // Clear buffers
      this.audioBuffer = null;
      this.bufferIndex = 0;
      
      this.isActive = false;
      this.emit('poly:stopped');
      
      Logger.log(Logger.INFO, 'PolyphonicDetector', 'Detection stopped', {
        inferenceCount: this.inferenceCount
      });
      
    } catch (error) {
      Logger.log(Logger.ERROR, 'PolyphonicDetector', 'Error stopping detection:', error);
    }
  }

  /**
   * Check if model is loaded and ready
   * 
   * @returns {boolean} Model ready state
   * 
   * @example
   * if (detector.isReady()) {
   *   console.log('Ready for detection');
   * }
   */
  isReady() {
    return this.modelLoaded && !this.errorState;
  }

  /**
   * Get current detector state
   * 
   * @returns {PolyphonicState} Current state object
   * 
   * @example
   * const state = detector.getState();
   * console.log(state.inferenceCount);
   */
  getState() {
    return {
      modelLoaded: this.modelLoaded,
      isActive: this.isActive,
      modelInfo: this._getModelInfo(),
      lastInferenceTime: Date.now() - this.startTime,
      memoryUsage: performance.memory ? performance.memory.usedJSHeapSize : 0,
      inferenceCount: this.inferenceCount,
      errorState: this.errorState
    };
  }

  /**
   * Dispose of resources
   * 
   * @example
   * detector.dispose();
   */
  dispose() {
    this.stop();
    
    // Dispose TensorFlow model
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    
    this.modelLoaded = false;
    this.errorState = null;
    
    Logger.log(Logger.INFO, 'PolyphonicDetector', 'Disposed');
  }
}

/**
 * @typedef {Object} DetectorConfig
 * @property {number} chunkSize - Audio chunk size in seconds (default: 8.0)
 * @property {number} targetSampleRate - Target sample rate in Hz (default: 16000)
 * @property {number} confidenceThreshold - Confidence threshold 0.0-1.0 (default: 0.5)
 * @property {number} maxConcurrentInferences - Max parallel inferences (default: 1)
 * @property {number} timeoutMs - Model load timeout in ms (default: 30000)
 * @property {boolean} enableWebWorker - Use Web Worker for inference (default: false)
 * @property {boolean} fallbackToMonophonic - Auto-fallback on failure (default: true)
 */

/**
 * @typedef {Object} PolyphonicState
 * @property {boolean} modelLoaded - Model loaded state
 * @property {boolean} isActive - Detection active state
 * @property {Object|null} modelInfo - Model information
 * @property {number} lastInferenceTime - Last inference time in ms
 * @property {number} memoryUsage - Memory usage in bytes
 * @property {number} inferenceCount - Total inference count
 * @property {string|null} errorState - Current error state
 */

export { PolyphonicDetector };
export default PolyphonicDetector;
