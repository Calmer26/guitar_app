/**
 * Unit tests for Tuner Module
 * Tests real-time tuning display, exponential smoothing, and visual feedback
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { Tuner } from '../../core/tuner.js';

// Mock EventEmitter for testing
class MockEventEmitter {
  constructor() {
    this.events = {};
  }
  
  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return () => this.off(event, listener);
  }
  
  off(event, listener) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }
  
  emit(event, data) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(data));
  }
}

// Mock PitchDetector for testing
class MockPitchDetector extends MockEventEmitter {
  constructor() {
    super();
  }
  
  emitPitchDetected(frequency, midi, cents, confidence) {
    this.emit('pitch:detected', {
      frequency,
      midi,
      cents,
      confidence,
      timestamp: Date.now()
    });
  }
}

// Test helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

test.describe('Tuner Module', () => {
  test('Tuner - sustained A4 displays 440.0 Hz ±0.1', async () => {
    const tuner = new Tuner({ referencePitch: 440, smoothingFactor: 0.2 });
    const mockDetector = new MockPitchDetector();
    
    tuner.start(mockDetector);
    
    // Feed A4 frequency repeatedly
    for (let i = 0; i < 10; i++) {
      mockDetector.emitPitchDetected(440.0, 69, 0, 0.95);
      await sleep(50);
    }
    
    const state = tuner.getState();
    
    assert.ok(Math.abs(state.frequency - 440.0) < 0.1, 
      `Frequency ${state.frequency} should be within 0.1 of 440.0`);
    assert.strictEqual(state.noteName, 'A4');
    assert.strictEqual(state.color, tuner.config.zones.inTune.color);
    
    tuner.stop();
  });
  
  test('Tuner - slightly flat note shows negative cents with orange/red', async () => {
    const tuner = new Tuner({ referencePitch: 440, smoothingFactor: 0.2 });
    const mockDetector = new MockPitchDetector();
    
    tuner.start(mockDetector);
    
    // Feed slightly flat A4 (15 cents flat)
    for (let i = 0; i < 10; i++) {
      mockDetector.emitPitchDetected(435.0, 69, -15, 0.9);
      await sleep(50);
    }
    
    const state = tuner.getState();
    
    assert.ok(state.cents < 0, 'Cents should be negative for flat note');
    assert.ok(Math.abs(state.cents + 15) < 5, 'Should be approximately -15 cents');
    assert.strictEqual(state.color, tuner.config.zones.close.color, 
      'Should show orange (close) color');
    assert.ok(state.needleAngle < 0, 'Needle should rotate left (negative angle)');
    
    tuner.stop();
  });
  
  test('Tuner - needle movement smooth without jitter', async () => {
    const tuner = new Tuner({ 
      referencePitch: 440, 
      smoothingFactor: 0.3  // Moderate smoothing
    });
    const mockDetector = new MockPitchDetector();
    
    tuner.start(mockDetector);
    
    const needleAngles = [];
    
    tuner.on('tuner:update', (state) => {
      needleAngles.push(state.needleAngle);
    });
    
    // Feed slightly varying frequencies (simulating real detection jitter)
    const frequencies = [438, 441, 439, 440, 442, 439, 440, 441];
    
    for (const freq of frequencies) {
      mockDetector.emitPitchDetected(freq, 69, 0, 0.9);
      await sleep(50);
    }
    
    // Calculate smoothness (should not have large jumps)
    let maxJump = 0;
    for (let i = 1; i < needleAngles.length; i++) {
      const jump = Math.abs(needleAngles[i] - needleAngles[i - 1]);
      maxJump = Math.max(maxJump, jump);
    }
    
    assert.ok(maxJump < 10, 
      `Maximum needle jump ${maxJump}° should be < 10° (smoothing working)`);
    
    tuner.stop();
  });
  
  test('Tuner - cents calculation accurate', () => {
    const tuner = new Tuner({ referencePitch: 440 });
    
    // Test cases: [frequency, expected_cents]
    const testCases = [
      [440.0, 0],      // Perfect A4
      [446.16, 25],    // ~25 cents sharp
      [433.99, -25],   // ~25 cents flat
      [466.16, 100],   // A#4 (100 cents sharp)
      [415.30, -100]   // G#4 (100 cents flat)
    ];
    
    testCases.forEach(([frequency, expectedCents]) => {
      const calculatedCents = tuner._frequencyToCents(frequency, 440);
      
      assert.ok(Math.abs(calculatedCents - expectedCents) < 5,
        `Frequency ${frequency} Hz should be ~${expectedCents} cents, ` +
        `got ${calculatedCents.toFixed(1)}`);
    });
  });
  
  test('Tuner - smoothing filter behavior with various factors', async () => {
    // Test different smoothing factors
    const factors = [0.1, 0.5, 0.9];
    
    for (const factor of factors) {
      const tuner = new Tuner({ 
        referencePitch: 440, 
        smoothingFactor: factor 
      });
      const mockDetector = new MockPitchDetector();
      
      tuner.start(mockDetector);
      
      // Feed sudden jump in frequency
      mockDetector.emitPitchDetected(400, 67, 0, 0.9);
      await sleep(50);
      
      const initialState = tuner.getState();
      
      // Sudden jump to 450 Hz
      mockDetector.emitPitchDetected(450, 70, 0, 0.9);
      await sleep(50);
      
      const afterJumpState = tuner.getState();
      
      // With low smoothing (e.g., 0.1), should respond quickly
      // With high smoothing (e.g., 0.9), should respond slowly
      const frequencyChange = Math.abs(
        afterJumpState.frequency - initialState.frequency
      );
      
      if (factor < 0.3) {
        // Low smoothing - should change significantly
        assert.ok(frequencyChange > 20, 
          `Low smoothing (${factor}) should respond quickly`);
      } else if (factor > 0.7) {
        // High smoothing - should change gradually
        assert.ok(frequencyChange < 20, 
          `High smoothing (${factor}) should respond slowly`);
      }
      
      tuner.stop();
    }
  });
  
  test('Tuner - reference pitch adjustment affects calculations', async () => {
    const tuner = new Tuner({ referencePitch: 440, smoothingFactor: 0.2 });
    const mockDetector = new MockPitchDetector();
    
    tuner.start(mockDetector);
    
    // Feed 440 Hz
    mockDetector.emitPitchDetected(440.0, 69, 0, 0.9);
    await sleep(50);
    
    let state = tuner.getState();
    assert.strictEqual(state.noteName, 'A4', 'Should be A4 at 440 Hz reference');
    assert.ok(Math.abs(state.cents) < 5, 'Should be in tune');
    
    // Change reference to 432 Hz
    tuner.setReferencePitch(432);
    
    // Same 440 Hz input
    mockDetector.emitPitchDetected(440.0, 69, 0, 0.9);
    await sleep(50);
    
    state = tuner.getState();
    
    // At 432 Hz reference, 440 Hz should be sharp
    assert.ok(state.cents > 0, 
      'With 432 Hz reference, 440 Hz should show as sharp');
    
    tuner.stop();
  });
  
  test('Tuner - color zones correct', () => {
    const tuner = new Tuner({ referencePitch: 440 });
    
    // Test cases: [cents, expected_color_zone]
    const testCases = [
      [0, 'inTune'],      // Green
      [5, 'inTune'],      // Green (at boundary)
      [-5, 'inTune'],     // Green (at boundary)
      [10, 'close'],      // Orange
      [-15, 'close'],     // Orange
      [20, 'close'],      // Orange (at boundary)
      [25, 'outOfTune'],  // Red
      [-40, 'outOfTune'], // Red
      [50, 'outOfTune']   // Red (max)
    ];
    
    testCases.forEach(([cents, expectedZone]) => {
      const color = tuner._getColorForCents(cents);
      const expectedColor = tuner.config.zones[expectedZone].color;
      
      assert.strictEqual(color, expectedColor,
        `Cents ${cents} should be in ${expectedZone} zone`);
    });
  });
  
  test('Tuner - needle angle calculation', () => {
    const tuner = new Tuner({ referencePitch: 440 });
    
    // Test cases: [cents, expected_angle_range]
    const testCases = [
      [0, [0, 0]],          // Center
      [50, [45, 45]],       // Max right
      [-50, [-45, -45]],    // Max left
      [25, [22, 23]],       // Half right
      [-25, [-23, -22]],    // Half left
      [100, [45, 45]]       // Clamped at max
    ];
    
    testCases.forEach(([cents, [minAngle, maxAngle]]) => {
      const angle = tuner._centsToNeedleAngle(cents);
      
      assert.ok(angle >= minAngle && angle <= maxAngle,
        `Cents ${cents} should produce angle between ${minAngle}° and ${maxAngle}°, ` +
        `got ${angle.toFixed(1)}°`);
    });
  });
  
  test('Tuner - ignores low confidence detections', async () => {
    const tuner = new Tuner({ 
      referencePitch: 440, 
      confidenceThreshold: 0.7 
    });
    const mockDetector = new MockPitchDetector();
    
    tuner.start(mockDetector);
    
    // Feed high confidence detection
    mockDetector.emitPitchDetected(440.0, 69, 0, 0.9);
    await sleep(50);
    
    const goodState = tuner.getState();
    assert.strictEqual(goodState.frequency, 440.0);
    
    // Feed low confidence detection (should be ignored)
    mockDetector.emitPitchDetected(500.0, 71, 0, 0.5);  // Below threshold
    await sleep(50);
    
    const afterLowConfidence = tuner.getState();
    
    // Should still show previous good value
    assert.ok(Math.abs(afterLowConfidence.frequency - 440.0) < 10,
      'Low confidence detection should be ignored');
    
    tuner.stop();
  });
  
  test('Tuner - start/stop behavior', () => {
    const tuner = new Tuner({ referencePitch: 440 });
    const mockDetector = new MockPitchDetector();
    
    assert.strictEqual(tuner.isActive(), false, 'Initially inactive');
    
    // Start
    tuner.start(mockDetector);
    assert.strictEqual(tuner.isActive(), true, 'Active after start');
    
    // Stop
    tuner.stop();
    assert.strictEqual(tuner.isActive(), false, 'Inactive after stop');
    
    // Should not crash if stopped twice
    tuner.stop();
    assert.strictEqual(tuner.isActive(), false, 'Still inactive');
    
    // Should reset state on stop
    const state = tuner.getState();
    assert.strictEqual(state.noteName, '--', 'Note name reset');
    assert.strictEqual(state.frequency, 0, 'Frequency reset');
  });
  
  test('Tuner - configuration validation', () => {
    const tuner = new Tuner();
    
    // Valid reference pitch
    tuner.setReferencePitch(440);
    assert.strictEqual(tuner.getReferencePitch(), 440);
    
    // Invalid reference pitch (too low)
    assert.throws(() => {
      tuner.setReferencePitch(300);
    }, { message: /between 420 and 460/ });
    
    // Invalid reference pitch (too high)
    assert.throws(() => {
      tuner.setReferencePitch(500);
    }, { message: /between 420 and 460/ });
    
    // Valid smoothing factor
    tuner.setSmoothingFactor(0.5);
    assert.strictEqual(tuner.getSmoothingFactor(), 0.5);
    
    // Invalid smoothing factor (too low)
    assert.throws(() => {
      tuner.setSmoothingFactor(-0.1);
    }, { message: /between 0.0 and 0.99/ });
    
    // Invalid smoothing factor (too high)
    assert.throws(() => {
      tuner.setSmoothingFactor(1.5);
    }, { message: /between 0.0 and 0.99/ });
  });
  
  test('Tuner - event emission', async () => {
    const tuner = new Tuner({ referencePitch: 440 });
    const mockDetector = new MockPitchDetector();
    
    const events = [];
    
    tuner.on('tuner:started', (data) => {
      events.push({ type: 'started', data });
    });
    
    tuner.on('tuner:update', (data) => {
      events.push({ type: 'update', data });
    });
    
    tuner.on('tuner:stopped', (data) => {
      events.push({ type: 'stopped', data });
    });
    
    tuner.on('tuner:referencePitchChanged', (data) => {
      events.push({ type: 'referencePitchChanged', data });
    });
    
    // Start event
    tuner.start(mockDetector);
    await sleep(10);
    assert.strictEqual(events[0].type, 'started');
    assert.strictEqual(events[0].data.referencePitch, 440);
    
    // Update events
    mockDetector.emitPitchDetected(440.0, 69, 0, 0.9);
    await sleep(100);
    assert.ok(events.some(e => e.type === 'update'));
    
    // Reference pitch change event
    tuner.setReferencePitch(432);
    await sleep(10);
    assert.strictEqual(events[events.length - 1].type, 'referencePitchChanged');
    assert.strictEqual(events[events.length - 1].data.oldPitch, 440);
    assert.strictEqual(events[events.length - 1].data.newPitch, 432);
    
    // Stop event
    tuner.stop();
    await sleep(10);
    assert.strictEqual(events[events.length - 1].type, 'stopped');
  });
});

// Helper method to add to Tuner class for testing (frequency to cents conversion)
Tuner.prototype._frequencyToCents = function(frequency, referenceFreq) {
  const targetMidi = 69 + 12 * Math.log2(frequency / referenceFreq);
  const nearestMidi = Math.round(targetMidi);
  const expectedFreq = referenceFreq * Math.pow(2, (nearestMidi - 69) / 12);
  const cents = 1200 * Math.log2(frequency / expectedFreq);
  return cents;
};
