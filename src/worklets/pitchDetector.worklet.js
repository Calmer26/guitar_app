/**
 * AudioWorklet for real-time pitch detection
 * 
 * Runs in a separate audio thread to provide low-latency pitch detection
 * for the Guitar4 application. Implements a simplified YIN algorithm
 * optimized for AudioWorklet constraints.
 * 
 * This worklet processes audio buffers and sends pitch detection results
 * back to the main thread via message passing.
 */

class PitchDetectorWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Configuration for pitch detection
    this.config = {
      bufferSize: 2048,
      minFrequency: 80,
      maxFrequency: 1000,
      confidenceThreshold: 0.7,
      sampleRate: sampleRate
    };
    
    // Buffer for accumulating audio samples
    this.audioBuffer = new Float32Array(4096);
    this.bufferIndex = 0;
    this.bufferFull = false;
    
    // YIN algorithm state
    this.lastPitchEvents = [];
    this.maxHistoryLength = 5;
    
    // Performance tracking
    this.processingCount = 0;
    this.lastProcessTime = currentTime;
    
    // Handle messages from main thread
    this.port.onmessage = (event) => {
      if (event.data.command === 'updateConfig') {
        this.config = { ...this.config, ...event.data.config };
      } else if (event.data.command === 'stop') {
        // Worklet will be terminated by main thread
      }
    };
  }

  /**
   * Process audio input and detect pitch
   * @param {Array} inputs - Audio input buffers
   * @param {Array} outputs - Audio output buffers
   * @param {Object} parameters - Audio parameters
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    // Return if no input or empty
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }
    
    const inputChannel = input[0];
    
    // Accumulate samples in buffer
    for (let i = 0; i < inputChannel.length; i++) {
      this.audioBuffer[this.bufferIndex] = inputChannel[i];
      this.bufferIndex++;
      
      // Process when buffer is full
      if (this.bufferIndex >= this.config.bufferSize) {
        this._processBuffer();
        this.bufferIndex = 0;
      }
    }
    
    // Copy input to output (passthrough for monitoring)
    const output = outputs[0];
    if (output && output[0]) {
      output[0].set(inputChannel);
    }
    
    this.processingCount++;
    return true;
  }

  /**
   * Process accumulated audio buffer for pitch detection
   * @private
   */
  _processBuffer() {
    try {
      // Apply preprocessing
      this._removeDCOffset(this.audioBuffer, this.bufferIndex);
      this._applyHighPassFilter(this.audioBuffer, this.bufferIndex);
      
      // Check noise gate
      const rms = this._calculateRMS(this.audioBuffer, this.bufferIndex);
      const rmsDb = 20 * Math.log10(rms + 1e-10);
      
      if (rmsDb < -40) { // Noise gate threshold
        this.port.postMessage({
          type: 'pitch',
          frequency: null,
          confidence: 0,
          timestamp: currentTime * 1000, // Convert to milliseconds
          amplitude: rms,
          reason: 'below_noise_threshold'
        });
        return;
      }
      
      // Run simplified YIN algorithm
      const result = this._yinAlgorithm(this.audioBuffer, this.bufferIndex);
      
      if (result && result.frequency >= this.config.minFrequency && 
          result.frequency <= this.config.maxFrequency &&
          result.confidence >= this.config.confidenceThreshold) {
        
        // Apply temporal consistency check
        if (this._isTemporallyConsistent(result.frequency)) {
          this.port.postMessage({
            type: 'pitch',
            frequency: result.frequency,
            confidence: result.confidence,
            timestamp: currentTime * 1000, // Convert to milliseconds
            amplitude: rms
          });
        } else {
          this.port.postMessage({
            type: 'pitch',
            frequency: null,
            confidence: 0,
            timestamp: currentTime * 1000,
            amplitude: rms,
            reason: 'temporal_inconsistency'
          });
        }
      } else {
        this.port.postMessage({
          type: 'pitch',
          frequency: null,
          confidence: result ? result.confidence : 0,
          timestamp: currentTime * 1000,
          amplitude: rms,
          reason: result ? 'low_confidence' : 'no_pitch_detected'
        });
      }
    } catch (error) {
      this.port.postMessage({
        type: 'error',
        error: error.message || 'Processing error in worklet'
      });
    }
  }

  /**
   * Simplified YIN algorithm optimized for AudioWorklet
   * @private
   * @param {Float32Array} buffer - Audio buffer
   * @param {number} bufferSize - Size of valid data in buffer
   * @returns {Object|null} Detection result or null
   */
  _yinAlgorithm(buffer, bufferSize) {
    const halfBufferSize = Math.floor(bufferSize / 2);
    
    // Difference function (optimized version)
    const difference = new Float32Array(halfBufferSize);
    
    // Use reduced complexity for real-time processing
    const maxTau = Math.min(halfBufferSize, Math.floor(this.config.sampleRate / this.config.minFrequency));
    
    for (let tau = 2; tau < maxTau; tau++) {
      let sum = 0;
      // Sample every 2nd point to reduce computation
      for (let i = 0; i < halfBufferSize; i += 2) {
        const delta = buffer[i] - buffer[i + tau];
        sum += delta * delta;
      }
      difference[tau] = sum;
    }
    
    // Cumulative mean normalized difference (simplified)
    const cmndf = new Float32Array(maxTau);
    cmndf[0] = 1;
    let runningSum = 0;
    
    for (let tau = 1; tau < maxTau; tau++) {
      runningSum += difference[tau];
      if (runningSum > 0) {
        cmndf[tau] = difference[tau] / (runningSum / tau);
      } else {
        cmndf[tau] = 1;
      }
    }
    
    // Find minimum below threshold
    const threshold = 0.1;
    let tau = -1;
    
    for (let i = 2; i < maxTau - 1; i++) {
      if (cmndf[i] < threshold) {
        // Find local minimum
        while (i + 1 < maxTau && cmndf[i + 1] < cmndf[i]) {
          i++;
        }
        tau = i;
        break;
      }
    }
    
    if (tau === -1) {
      return null;
    }
    
    // Parabolic interpolation for better accuracy
    let betterTau = tau;
    if (tau > 0 && tau < cmndf.length - 1) {
      const s0 = cmndf[tau - 1];
      const s1 = cmndf[tau];
      const s2 = cmndf[tau + 1];
      
      const denominator = (s0 - 2 * s1 + s2);
      if (Math.abs(denominator) > 1e-10) {
        betterTau = tau + 0.5 * (s0 - s2) / denominator;
      }
    }
    
    // Convert to frequency
    const frequency = this.config.sampleRate / betterTau;
    
    // Calculate confidence
    let confidence = 1 - cmndf[tau];
    confidence = Math.min(confidence, 1.0);
    
    return { frequency, confidence };
  }

  /**
   * Calculate RMS amplitude
   * @private
   * @param {Float32Array} buffer - Audio buffer
   * @param {number} bufferSize - Size of valid data
   * @returns {number} RMS amplitude
   */
  _calculateRMS(buffer, bufferSize) {
    let sum = 0;
    for (let i = 0; i < bufferSize; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / bufferSize);
  }

  /**
   * Remove DC offset from buffer
   * @private
   * @param {Float32Array} buffer - Audio buffer
   * @param {number} bufferSize - Size of valid data
   */
  _removeDCOffset(buffer, bufferSize) {
    let sum = 0;
    for (let i = 0; i < bufferSize; i++) {
      sum += buffer[i];
    }
    const mean = sum / bufferSize;
    
    for (let i = 0; i < bufferSize; i++) {
      buffer[i] -= mean;
    }
  }

  /**
   * Apply high-pass filter
   * @private
   * @param {Float32Array} buffer - Audio buffer
   * @param {number} bufferSize - Size of valid data
   * @param {number} cutoffHz - Cutoff frequency
   */
  _applyHighPassFilter(buffer, bufferSize, cutoffHz = 60) {
    const RC = 1 / (2 * Math.PI * cutoffHz);
    const dt = 1 / this.config.sampleRate;
    const alpha = RC / (RC + dt);

    let y = buffer[0];
    for (let i = 1; i < bufferSize; i++) {
      y = alpha * (y + buffer[i] - buffer[i - 1]);
      buffer[i] = y;
    }
  }

  /**
   * Check temporal consistency of pitch detections
   * @private
   * @param {number} frequency - Detected frequency
   * @returns {boolean} True if consistent
   */
  _isTemporallyConsistent(frequency) {
    this.lastPitchEvents.push(frequency);
    if (this.lastPitchEvents.length > this.maxHistoryLength) {
      this.lastPitchEvents.shift();
    }

    if (this.lastPitchEvents.length < 2) {
      return true;
    }

    const recentFreq = this.lastPitchEvents.slice(-3);
    const avgRecent = recentFreq.reduce((a, b) => a + b, 0) / recentFreq.length;
    const maxDeviation = avgRecent * 0.05; // Allow 5% deviation

    return Math.abs(frequency - avgRecent) <= maxDeviation;
  }
}

// Register the worklet processor
registerProcessor('pitch-detector-worklet', PitchDetectorWorklet);
