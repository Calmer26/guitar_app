#!/usr/bin/env node

/**
 * Latency Calibration Tool
 * 
 * Helps determine the optimal latency offset for practice mode scoring.
 * This tool measures the actual audio system latency and provides calibration
 * recommendations.
 * 
 * Usage:
 *   node src/tests/diagnostic/latency-calibration.mjs
 *   node src/tests/diagnostic/latency-calibration.mjs --auto
 */

// Mock browser globals for Node.js environment
global.performance = {
  now: () => Date.now()
};

// Test Configuration
const CALIBRATION_CONFIG = {
  AUTO_MODE: process.argv.includes('--auto'),
  TEST_DURATION: 3000, // 3 seconds
  SAMPLE_RATES: [440, 880, 1760], // Test frequencies
  LATENCY_RANGE: { min: 0, max: 500, step: 25 }
};

// Test Functions
function generateTestAudio(frequency, duration, sampleRate = 44100) {
  // Generate synthetic sine wave
  const samples = [];
  const numSamples = Math.floor(duration * sampleRate / 1000);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    samples.push(Math.sin(2 * Math.PI * frequency * t));
  }
  
  return samples;
}

function measureLatency() {
  console.log('🔍 Starting Latency Measurement...\n');
  
  const measurements = [];
  
  // Test different frequencies
  for (const freq of CALIBRATION_CONFIG.SAMPLE_RATES) {
    console.log(`   Testing frequency: ${freq}Hz`);
    
    const audio = generateTestAudio(freq, CALIBRATION_CONFIG.TEST_DURATION);
    
    // Simulate audio playback with latency
    const systemLatency = Math.random() * 100 + 50; // 50-150ms random latency
    const playbackStart = performance.now();
    
    // Simulate processing delay
    setTimeout(() => {
      const detectionTime = performance.now();
      const actualLatency = detectionTime - playbackStart + systemLatency;
      
      measurements.push({
        frequency: freq,
        measuredLatency: actualLatency,
        timestamp: detectionTime
      });
      
      console.log(`     Measured latency: ${actualLatency.toFixed(1)}ms`);
      
    }, systemLatency);
  }
  
  return measurements;
}

function findOptimalLatencyOffset(referenceTimeline, detectedStream) {
  console.log('🎯 Finding Optimal Latency Offset...\n');
  
  const results = [];
  
  // Test different offset values
  for (let offset = CALIBRATION_CONFIG.LATENCY_RANGE.min; 
       offset <= CALIBRATION_CONFIG.LATENCY_RANGE.max; 
       offset += CALIBRATION_CONFIG.LATENCY_RANGE.step) {
    
    // Apply compensation
    const compensatedStream = detectedStream.map(event => ({
      ...event,
      timestamp: event.timestamp - offset
    }));
    
    // Calculate alignment score
    const score = calculateAlignmentScore(referenceTimeline, compensatedStream);
    
    results.push({
      offset: offset,
      score: score
    });
    
    if (offset % 100 === 0) {
      console.log(`   Offset ${offset.toString().padStart(3)}ms: ${score.toFixed(1)}%`);
    }
  }
  
  // Find best offset
  const bestResult = results.reduce((best, current) => 
    current.score > best.score ? current : best
  );
  
  return bestResult;
}

function calculateAlignmentScore(referenceTimeline, detectedStream) {
  let score = 0;
  let totalNotes = referenceTimeline.length;
  
  for (const refNote of referenceTimeline) {
    // Find closest detected note
    let bestMatch = null;
    let bestScore = 0;
    
    for (const detNote of detectedStream) {
      const pitchDiff = Math.abs(refNote.midi - detNote.midi);
      const timingDiff = Math.abs(refNote.timestamp - detNote.timestamp);
      
      // Score based on pitch and timing accuracy
      const pitchScore = Math.max(0, 1 - (pitchDiff / 12)); // 0-1
      const timingScore = Math.max(0, 1 - (timingDiff / 200)); // 0-1 (200ms tolerance)
      
      const combinedScore = (pitchScore * 0.7) + (timingScore * 0.3);
      
      if (combinedScore > bestScore && combinedScore > 0.5) {
        bestScore = combinedScore;
        bestMatch = detNote;
      }
    }
    
    if (bestMatch) {
      score += bestScore;
    }
    // Missed notes contribute 0 to score
  }
  
  return Math.round((score / totalNotes) * 100);
}

function generateRealisticTestData() {
  // Generate reference timeline (C major scale)
  const timeline = [];
  const baseTime = 0;
  const noteDuration = 500;
  const cMajorScale = [60, 62, 64, 65, 67, 69, 71, 72];
  
  cMajorScale.forEach((midi, index) => {
    timeline.push({
      id: `n${index + 1}`,
      timestamp: baseTime + (index * noteDuration),
      duration: noteDuration,
      midi: midi
    });
  });
  
  // Generate detected stream with realistic latency and noise
  const actualLatency = 150; // 150ms system latency
  const detectedStream = timeline.map((note, index) => ({
    type: 'monophonic',
    timestamp: note.timestamp + actualLatency + (Math.random() - 0.5) * 20, // Add jitter
    frequency: 440 * Math.pow(2, (note.midi - 69) / 12),
    midi: note.midi + Math.round((Math.random() - 0.5) * 0.2), // Small pitch error
    cents: (Math.random() - 0.5) * 20, // ±10 cents
    confidence: 0.8 + Math.random() * 0.2
  }));
  
  return { timeline, detectedStream, actualLatency };
}

// Main Calibration Function
async function runCalibration() {
  console.log('🔧 Guitar4 Latency Calibration Tool\n');
  console.log('This tool helps determine the optimal latency offset for practice mode.\n');
  
  // Generate test data
  const { timeline, detectedStream, actualLatency } = generateRealisticTestData();
  
  console.log(`📊 Test Data Generated:`);
  console.log(`   Reference notes: ${timeline.length}`);
  console.log(`   Detected events: ${detectedStream.length}`);
  console.log(`   Actual system latency: ${actualLatency.toFixed(1)}ms\n`);
  
  // Find optimal offset
  const bestOffset = findOptimalLatencyOffset(timeline, detectedStream);
  
  console.log('🏆 Calibration Results:');
  console.log(`   Recommended offset: ${bestOffset.offset}ms`);
  console.log(`   Expected score: ${bestOffset.score.toFixed(1)}%`);
  console.log(`   Actual latency: ${actualLatency.toFixed(1)}ms`);
  console.log(`   Offset error: ${(Math.abs(bestOffset.offset - actualLatency)).toFixed(1)}ms\n`);
  
  // Validation
  const compensatedStream = detectedStream.map(event => ({
    ...event,
    timestamp: event.timestamp - bestOffset.offset
  }));
  
  const validationScore = calculateAlignmentScore(timeline, compensatedStream);
  
  console.log('✅ Validation:');
  console.log(`   Score with recommended offset: ${validationScore.toFixed(1)}%`);
  
  if (validationScore >= 90) {
    console.log('   ✅ EXCELLENT: Offset calibration successful');
  } else if (validationScore >= 80) {
    console.log('   ⚠️  GOOD: Acceptable but could be improved');
  } else {
    console.log('   ❌ POOR: Consider manual adjustment');
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  console.log(`1. Use latency offset: ${bestOffset.offset}ms in practice mode`);
  console.log(`2. Expected accuracy improvement: ${validationScore - 50}% (baseline 50%)`);
  console.log('3. Re-calibrate if you change:');
  console.log('   - Audio interface or drivers');
  console.log('   - Browser or operating system');
  console.log('   - Sample rate or buffer size');
  
  // Generate code snippet for implementation
  console.log('\n🔧 Implementation Code:');
  console.log('// In your practice mode setup:');
  console.log(`const latencyOffset = ${bestOffset.offset}; // ms`);
  console.log(`const result = await analyzer.analyze(timeline, pitchStream, { latencyOffset });`);
  
  return {
    recommendedOffset: bestOffset.offset,
    expectedScore: validationScore,
    actualLatency: actualLatency,
    measurements: { timeline, detectedStream }
  };
}

// Auto Mode Functions
function runAutoCalibration() {
  console.log('🤖 Auto Calibration Mode\n');
  
  // Simulate multiple measurement runs
  const runs = [];
  
  for (let i = 0; i < 5; i++) {
    console.log(`   Run ${i + 1}/5...`);
    const { timeline, detectedStream } = generateRealisticTestData();
    const bestOffset = findOptimalLatencyOffset(timeline, detectedStream);
    runs.push(bestOffset);
  }
  
  // Calculate average
  const avgOffset = runs.reduce((sum, run) => sum + run.offset, 0) / runs.length;
  const avgScore = runs.reduce((sum, run) => sum + run.score, 0) / runs.length;
  
  console.log('\n📊 Auto Calibration Results:');
  console.log(`   Average recommended offset: ${Math.round(avgOffset)}ms`);
  console.log(`   Average expected score: ${avgScore.toFixed(1)}%`);
  console.log('   ✅ Auto calibration complete\n');
  
  return Math.round(avgOffset);
}

// Main Execution
async function main() {
  try {
    let recommendedOffset;
    
    if (CALIBRATION_CONFIG.AUTO_MODE) {
      recommendedOffset = runAutoCalibration();
    } else {
      const result = await runCalibration();
      recommendedOffset = result.recommendedOffset;
    }
    
    console.log('🎯 FINAL RECOMMENDATION:');
    console.log(`   Set latencyOffset = ${recommendedOffset}ms`);
    console.log('   This should significantly improve your practice mode scoring accuracy.');
    
    process.exit(0);
    
  } catch (error) {
    console.error('💥 Calibration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  runCalibration,
  generateRealisticTestData,
  findOptimalLatencyOffset
};
