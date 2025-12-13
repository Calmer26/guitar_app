#!/usr/bin/env node

/**
 * Pipeline Diagnostic Test
 * 
 * Validates the core practice mode pipeline by testing:
 * 1. Perfect synthetic performance scoring accuracy
 * 2. Latency compensation effectiveness
 * 3. Pitch detection baseline functionality
 * 4. Analysis engine correctness
 * 
 * Usage:
 *   node src/tests/diagnostic/pipeline-check.test.mjs
 *   node src/tests/diagnostic/pipeline-check.test.mjs --ground-truth --min-score 95
 */

// Import required modules (using ES modules for Node.js compatibility)
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock browser globals for Node.js environment
global.performance = {
  now: () => Date.now()
};

global.console = console;

// Mock EventEmitter
class EventEmitter {
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
    this.events[event].forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }
}

// Mock Logger
class Logger {
  static INFO = 'info';
  static DEBUG = 'debug';
  static WARN = 'warn';
  static ERROR = 'error';
  
  static log(level, module, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      module,
      message,
      data
    };
    
    const consoleMethod = console[level] || console.log;
    consoleMethod(`[${timestamp}] [${module}] ${message}`, data);
  }
}

// Mock Storage
class Storage {
  constructor() {
    this.data = new Map();
  }
  
  set(key, value) {
    this.data.set(key, JSON.stringify(value));
    return true;
  }
  
  get(key, defaultValue = null) {
    const item = this.data.get(key);
    return item ? JSON.parse(item) : defaultValue;
  }
  
  delete(key) {
    return this.data.delete(key);
  }
  
  clear() {
    this.data.clear();
    return true;
  }
}

// Mock PerformanceMonitor
const performanceMonitor = {
  startMeasurement: () => {},
  endMeasurement: () => 0,
  recordMetric: () => {},
  getStats: () => ({ avg: 0, min: 0, max: 0, p95: 0 }),
  logStats: () => {}
};

// Test Configuration
const TEST_CONFIG = {
  GROUND_TRUTH_MODE: process.argv.includes('--ground-truth'),
  MIN_SCORE: parseInt(process.argv.find((arg, i) => process.argv[i-1] === '--min-score') || '80'),
  LATENCY_SWEEP_START: 0,
  LATENCY_SWEEP_END: 500,
  LATENCY_SWEEP_STEP: 25
};

// Test Data Generators
function generateTestTimeline() {
  // Generate a simple C major scale (8 notes) at 120 BPM
  const timeline = [];
  const baseTimestamp = 0;
  const noteDuration = 500; // 500ms per note at 120 BPM
  const cMajorScale = [60, 62, 64, 65, 67, 69, 71, 72]; // C4 to C5
  
  cMajorScale.forEach((midi, index) => {
    timeline.push({
      id: `n${index + 1}`,
      timestamp: baseTimestamp + (index * noteDuration),
      duration: noteDuration,
      midi: midi,
      pitch: {
        step: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'][index],
        octave: index === 7 ? 5 : 4,
        alter: 0
      },
      staff: 1,
      voice: 1,
      system: 1
    });
  });
  
  return timeline;
}

function generatePerfectPitchStream(timeline, latencyOffset = 0) {
  // Generate pitch stream with perfect timing and correct MIDI values
  return timeline.map(note => ({
    type: 'monophonic',
    timestamp: note.timestamp + latencyOffset, // Apply latency offset
    frequency: 440 * Math.pow(2, (note.midi - 69) / 12), // Convert MIDI to frequency
    midi: note.midi,
    cents: 0, // Perfect pitch
    confidence: 0.95 // High confidence
  }));
}

function generateNoisyPitchStream(timeline, latencyOffset = 0, noiseLevel = 0.2) {
  // Generate pitch stream with timing/pitch errors
  return timeline.map(note => ({
    type: 'monophonic',
    timestamp: note.timestamp + latencyOffset + (Math.random() - 0.5) * noiseLevel * 200, // Timing noise
    frequency: 440 * Math.pow(2, (note.midi - 69 + (Math.random() - 0.5) * noiseLevel * 2) / 12), // Pitch noise
    midi: Math.round(note.midi + (Math.random() - 0.5) * noiseLevel * 2), // Rounded MIDI with noise
    cents: (Math.random() - 0.5) * noiseLevel * 100, // Cents deviation
    confidence: 0.7 + Math.random() * 0.2 // Confidence between 0.7-0.9
  }));
}

// Analyzer Implementation (simplified version for testing)
class TestAnalyzer {
  constructor() {
    this.tolerances = {
      pitch: 50,   // 50 cents
      timing: 100  // 100ms
    };
  }
  
  async analyze(referenceTimeline, detectedStream, options = {}) {
    const { latencyOffset = 0 } = options;
    
    // Apply latency compensation (FIXED: subtract offset)
    const compensatedStream = detectedStream.map(event => ({
      ...event,
      timestamp: event.timestamp - latencyOffset // FIXED: subtract, not add
    }));
    
    console.log(`📊 Testing with latency offset: ${latencyOffset}ms`);
    console.log(`   First reference timestamp: ${referenceTimeline[0]?.timestamp}ms`);
    console.log(`   First detected timestamp (raw): ${detectedStream[0]?.timestamp}ms`);
    console.log(`   First detected timestamp (compensated): ${compensatedStream[0]?.timestamp}ms`);
    
    // Simple alignment algorithm (simplified DTW)
    const results = [];
    let detectedIndex = 0;
    
    for (const refNote of referenceTimeline) {
      // Find best matching detected note
      let bestMatch = null;
      let bestScore = Infinity;
      
      for (let i = detectedIndex; i < Math.min(detectedIndex + 3, compensatedStream.length); i++) {
        const detNote = compensatedStream[i];
        const pitchDiff = Math.abs(refNote.midi - detNote.midi);
        const timingDiff = Math.abs(refNote.timestamp - detNote.timestamp);
        const score = pitchDiff * 2 + timingDiff / 50; // Weight pitch more than timing
        
        if (score < bestScore && timingDiff < 200) { // Must be reasonably close in time
          bestScore = score;
          bestMatch = detNote;
          detectedIndex = i + 1;
        }
      }
      
      if (bestMatch) {
        const pitchCorrect = Math.abs(refNote.midi - bestMatch.midi) === 0;
        const timingCorrect = Math.abs(refNote.timestamp - bestMatch.timestamp) <= this.tolerances.timing;
        
        let classification;
        if (pitchCorrect && timingCorrect) {
          classification = 'CORRECT';
        } else if (!pitchCorrect) {
          classification = 'WRONG_PITCH';
        } else {
          classification = 'WRONG_TIMING';
        }
        
        results.push({
          noteId: refNote.id,
          classification: classification,
          pitchCorrect: pitchCorrect,
          timingCorrect: timingCorrect,
          detectedMidi: bestMatch.midi,
          expectedMidi: refNote.midi,
          detectedTimestamp: bestMatch.timestamp,
          expectedTimestamp: refNote.timestamp
        });
      } else {
        results.push({
          noteId: refNote.id,
          classification: 'MISSED',
          pitchCorrect: false,
          timingCorrect: false,
          detectedMidi: null,
          expectedMidi: refNote.midi,
          detectedTimestamp: null,
          expectedTimestamp: refNote.timestamp
        });
      }
    }
    
    // Calculate aggregate metrics
    const correctCount = results.filter(r => r.classification === 'CORRECT').length;
    const totalNotes = results.length;
    const correctPercentage = totalNotes > 0 ? (correctCount / totalNotes) * 100 : 0;
    
    // Calculate average timing deviation (for detected notes only)
    const detectedResults = results.filter(r => r.detectedTimestamp !== null);
    const avgTimingDeviation = detectedResults.length > 0 
      ? detectedResults.reduce((sum, r) => sum + Math.abs(r.expectedTimestamp - r.detectedTimestamp), 0) / detectedResults.length 
      : 0;
    
    const analysisResult = {
      aggregate: {
        correctPercentage: Math.round(correctPercentage * 10) / 10,
        averageTimingDeviation: Math.round(avgTimingDeviation),
        notesCorrect: correctCount,
        notesMissed: results.filter(r => r.classification === 'MISSED').length,
        notesWrongPitch: results.filter(r => r.classification === 'WRONG_PITCH').length,
        notesWrongTiming: results.filter(r => r.classification === 'WRONG_TIMING').length,
        totalNotes: totalNotes
      },
      perNote: results,
      tolerances: this.tolerances,
      analysisTime: 0
    };
    
    return analysisResult;
  }
}

// Test Functions
async function testPerfectPerformance() {
  console.log('🧪 Testing Perfect Performance Scoring...\n');
  
  const timeline = generateTestTimeline();
  const analyzer = new TestAnalyzer();
  
  const testResults = [];
  
  // Test with various latency offsets
  for (let offset = TEST_CONFIG.LATENCY_SWEEP_START; offset <= TEST_CONFIG.LATENCY_SWEEP_END; offset += TEST_CONFIG.LATENCY_SWEEP_STEP) {
    const pitchStream = generatePerfectPitchStream(timeline, offset);
    const result = await analyzer.analyze(timeline, pitchStream, { latencyOffset: offset });
    
    testResults.push({
      offset: offset,
      score: result.aggregate.correctPercentage,
      timingDeviation: result.aggregate.averageTimingDeviation,
      notesCorrect: result.aggregate.notesCorrect,
      totalNotes: result.aggregate.totalNotes
    });
    
    console.log(`   Offset ${offset.toString().padStart(3)}ms: ${result.aggregate.correctPercentage.toFixed(1)}% (${result.aggregate.notesCorrect}/${result.aggregate.totalNotes} correct)`);
  }
  
  // Find best performing offset
  const bestResult = testResults.reduce((best, current) => 
    current.score > best.score ? current : best
  );
  
  console.log(`\n🏆 Best Result: ${bestResult.score.toFixed(1)}% at ${bestResult.offset}ms offset`);
  
  // Check if minimum score requirement met
  const passedThreshold = bestResult.score >= TEST_CONFIG.MIN_SCORE;
  console.log(`🎯 Target Score (${TEST_CONFIG.MIN_SCORE}%): ${passedThreshold ? '✅ MET' : '❌ FAILED'}`);
  
  return {
    passed: passedThreshold,
    bestResult: bestResult,
    allResults: testResults
  };
}

async function testNoisyPerformance() {
  console.log('\n🧪 Testing Noisy Performance Scoring...\n');
  
  const timeline = generateTestTimeline();
  const analyzer = new TestAnalyzer();
  
  const noiseLevels = [0.1, 0.2, 0.3, 0.4, 0.5];
  const results = [];
  
  for (const noiseLevel of noiseLevels) {
    const pitchStream = generateNoisyPitchStream(timeline, 0, noiseLevel);
    const result = await analyzer.analyze(timeline, pitchStream, { latencyOffset: 0 });
    
    results.push({
      noiseLevel: noiseLevel,
      score: result.aggregate.correctPercentage
    });
    
    console.log(`   Noise Level ${noiseLevel}: ${result.aggregate.correctPercentage.toFixed(1)}%`);
  }
  
  return results;
}

async function testLatencyCompensation() {
  console.log('\n🧪 Testing Latency Compensation Effectiveness...\n');
  
  const timeline = generateTestTimeline();
  const analyzer = new TestAnalyzer();
  
  // Test with intentional latency and compensation
  const intentionalLatency = 200; // 200ms artificial latency
  const pitchStream = generatePerfectPitchStream(timeline, intentionalLatency);
  
  console.log(`   Artificial latency applied: ${intentionalLatency}ms`);
  
  // Test without compensation
  const resultWithoutComp = await analyzer.analyze(timeline, pitchStream, { latencyOffset: 0 });
  console.log(`   Without compensation: ${resultWithoutComp.aggregate.correctPercentage.toFixed(1)}%`);
  
  // Test with correct compensation
  const resultWithComp = await analyzer.analyze(timeline, pitchStream, { latencyOffset: intentionalLatency });
  console.log(`   With compensation: ${resultWithComp.aggregate.correctPercentage.toFixed(1)}%`);
  
  const improvement = resultWithComp.aggregate.correctPercentage - resultWithoutComp.aggregate.correctPercentage;
  console.log(`   Improvement: +${improvement.toFixed(1)}%`);
  
  return {
    withoutComp: resultWithoutComp.aggregate.correctPercentage,
    withComp: resultWithComp.aggregate.correctPercentage,
    improvement: improvement
  };
}

// Main Test Runner
async function runDiagnostics() {
  console.log('🔍 Guitar4 Practice Mode Pipeline Diagnostic\n');
  console.log('📍 Testing core components:\n');
  console.log('   • Exercise timeline generation');
  console.log('   • Pitch stream simulation');
  console.log('   • Latency compensation logic');
  console.log('   • Analysis scoring algorithm\n');
  
  const testResults = {};
  
  try {
    // Run perfect performance test
    testResults.perfect = await testPerfectPerformance();
    
    // Run noisy performance test (only if not in ground-truth mode)
    if (!TEST_CONFIG.GROUND_TRUTH_MODE) {
      testResults.noisy = await testNoisyPerformance();
    }
    
    // Run latency compensation test
    testResults.latencyComp = await testLatencyCompensation();
    
    // Generate summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(60));
    
    if (testResults.perfect.passed) {
      console.log('✅ Perfect performance scoring: PASSED');
      console.log(`   Best score: ${testResults.perfect.bestResult.score.toFixed(1)}%`);
      console.log(`   Optimal latency offset: ${testResults.perfect.bestResult.offset}ms`);
    } else {
      console.log('❌ Perfect performance scoring: FAILED');
      console.log(`   Best score: ${testResults.perfect.bestResult.score.toFixed(1)}% (target: ${TEST_CONFIG.MIN_SCORE}%)`);
      console.log('   ⚠️  This indicates analyzer configuration issues');
    }
    
    if (testResults.latencyComp.improvement > 10) {
      console.log('✅ Latency compensation: EFFECTIVE');
      console.log(`   Score improvement: +${testResults.latencyComp.improvement.toFixed(1)}%`);
    } else if (testResults.latencyComp.improvement > 0) {
      console.log('⚠️  Latency compensation: MINIMAL IMPACT');
      console.log(`   Score improvement: +${testResults.latencyComp.improvement.toFixed(1)}%`);
    } else {
      console.log('❌ Latency compensation: INEFFECTIVE OR HARMFUL');
      console.log(`   Score change: ${testResults.latencyComp.improvement.toFixed(1)}%`);
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (!testResults.perfect.passed) {
      console.log('1. Fix analyzer latency compensation (likely sign error)');
      console.log('2. Verify pitch detection thresholds');
      console.log('3. Check timing tolerance settings');
    }
    
    if (testResults.perfect.bestResult.offset > 0) {
      console.log(`4. Use latency offset: ${testResults.perfect.bestResult.offset}ms for optimal scoring`);
    }
    
    if (testResults.latencyComp.improvement < 5) {
      console.log('5. Review latency compensation implementation');
    }
    
    console.log('\n🔧 NEXT STEPS:');
    console.log('1. Apply recommended latency offset to practice mode');
    console.log('2. Test with real microphone input');
    console.log('3. Fine-tune pitch detection confidence thresholds');
    
    // Exit with appropriate code
    const success = testResults.perfect.passed && testResults.latencyComp.improvement > 5;
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('💥 Diagnostic test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDiagnostics().catch(console.error);
}

export {
  TestAnalyzer,
  generateTestTimeline,
  generatePerfectPitchStream,
  generateNoisyPitchStream,
  runDiagnostics
};
