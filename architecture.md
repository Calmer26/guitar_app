# ARCHITECTURE.md - Guitar4 System Architecture

**Version**: 1.0  
**Date**: 2025-11-01  
**Status**: Development Reference Document  
**Purpose**: Comprehensive architectural specification for Cline AI-driven development

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [System Design Principles](#2-system-design-principles)
3. [Module Architecture](#3-module-architecture)
4. [Data Contracts](#4-data-contracts)
5. [Event-Driven Communication](#5-event-driven-communication)
6. [Data Flow Pipelines](#6-data-flow-pipelines)
7. [Error Handling Strategy](#7-error-handling-strategy)
8. [Performance Architecture](#8-performance-architecture)
9. [Testing Architecture](#9-testing-architecture)
10. [Governance Integration](#10-governance-integration)
11. [Browser Compatibility Layer](#11-browser-compatibility-layer)
12. [Security Architecture](#12-security-architecture)

---

## 1. Architecture Overview

### 1.1 System Architecture Pattern

Guitar4 follows a **modular event-driven architecture** with the following characteristics:

- **Loose coupling**: Modules communicate through events, not direct calls
- **Single responsibility**: Each module owns one domain area
- **Testability**: Pure functions and dependency injection enable comprehensive testing
- **Progressive enhancement**: Features degrade gracefully when dependencies unavailable
- **Client-side only**: All processing occurs in browser, no backend services

### 1.2 High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Manager                            │
│  (Orchestrates user interactions and view synchronization)  │
└───────────┬─────────────────────────────────────┬───────────┘
            │                                     │
    ┌───────▼────────┐                   ┌───────▼────────┐
    │  Exercise      │                   │   Settings &   │
    │  Loader        │                   │   Storage      │
    └───────┬────────┘                   └────────────────┘
            │
    ┌───────▼────────────────────────────────────────────┐
    │           Notation Renderer (OSMD)                 │
    │  ┌──────────────────┐  ┌──────────────────┐      │
    │  │ Standard Notation│  │    Tablature     │      │
    │  └──────────────────┘  └──────────────────┘      │
    └────────────────────────────────────────────────────┘
            │
    ┌───────▼────────┐
    │   Playback     │◄─────────┐
    │   Engine       │          │
    └───────┬────────┘          │
            │                   │
    ┌───────▼────────┐   ┌──────┴──────┐
    │  Tone.js Audio │   │   Analyzer  │
    │  Synthesis     │   │   (DTW)     │
    └────────────────┘   └──────▲──────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
            ┌───────┴────────┐    ┌────────┴──────────┐
            │  Monophonic    │    │   Polyphonic      │
            │  Pitch Detector│    │   Detector        │
            │  (YIN)         │    │   (Magenta)       │
            └───────▲────────┘    └────────▲──────────┘
                    │                      │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Web Audio API     │
                    │   (Microphone)      │
                    └─────────────────────┘
```

### 1.3 Directory Structure

```
guitar4/
├── assets/
│   ├── exercises/           # MusicXML sample files
│   │   ├── twinkle2.xml
│   │   ├── chord-exercise.xml
│   │   ├── long-form.xml
│   │   ├── tempo-change.xml
│   │   └── alternate-time.xml
│   ├── samples/             # Audio samples
│   │   ├── guitar/
│   │   │   ├── 40.wav      # E2
│   │   │   ├── 41.wav      # F2
│   │   │   └── ...         # MIDI 40-84
│   │   └── piano/
│   │       └── ...          # MIDI 21-108
│   └── models/
│       └── magenta/         # TensorFlow Lite model
│           ├── model.json
│           └── *.bin
├── src/
│   ├── core/                # Core modules
│   │   ├── exerciseLoader.js
│   │   ├── notationRenderer.js
│   │   ├── playbackEngine.js
│   │   ├── pitchDetector.js
│   │   ├── polyphonicDetector.js
│   │   ├── analyzer.js
│   │   ├── tuner.js
│   │   ├── uiManager.js
│   │   └── storage.js
│   ├── utils/               # Shared utilities
│   │   ├── eventEmitter.js
│   │   ├── audioContext.js
│   │   ├── constants.js
│   │   └── logger.js
│   └── tests/
│       ├── unit/
│       │   ├── loader.test.js
│       │   ├── playback.test.js
│       │   ├── analyzer.test.js
│       │   └── storage.test.js
│       └── e2e/
│           ├── notation.test.js
│           ├── practice.test.js
│           └── tuner.test.js
├── .cline/
│   ├── CLINE_TODO.md
│   └── governance/
│       └── hooks/
│           └── pre-commit
├── index.html
├── styles.css
├── package.json
├── README.md
├── TESTING.md
├── DEV_NOTES.md
├── ARCHITECTURE.md         # This file
├── RULES.md
├── MASTER_PROMPT.md
└── CLINE_MEMORY.md
```

---

## 2. System Design Principles

### 2.1 Core Architectural Principles

**Principle 1: Event-Driven Communication**
- Modules emit events for state changes
- Modules subscribe to events from dependencies
- No direct function calls between core modules
- EventEmitter pattern for pub-sub

**Principle 2: Single Responsibility**
- Each module owns exactly one domain
- Clear boundaries prevent feature creep
- Modules replaceable without affecting others

**Principle 3: Dependency Injection**
- External dependencies passed at initialization
- Enables testing with mocks
- Configuration over hard-coded values

**Principle 4: Progressive Enhancement**
- Core features work without advanced capabilities
- Graceful degradation when features unavailable
- Feature detection before initialization

**Principle 5: Performance by Design**
- Latency targets drive architecture decisions
- Async operations never block main thread
- Memory management explicit and monitored

### 2.2 Design Patterns Used

**Observer Pattern**
- EventEmitter for inter-module communication
- UI subscribes to state change events
- Decouples producers from consumers

**Strategy Pattern**
- Pitch detection: monophonic vs. polyphonic
- Audio playback: synthesis vs. samples
- Analysis: configurable tolerance levels

**Facade Pattern**
- Storage module abstracts LocalStorage
- Audio context manager wraps Web Audio API
- Simplifies complex subsystems

**Factory Pattern**
- OSMD instance creation
- Tone.js instrument instantiation
- Pitch detector initialization

**State Machine Pattern**
- Playback engine states: stopped, playing, paused
- Audio context states: suspended, running, closed
- Explicit state transitions with validation

### 2.3 Technology Stack Decisions

| Technology | Purpose | Rationale |
|------------|---------|-----------|
| **Vanilla JavaScript (ES6+)** | Core application | No framework overhead, maximum performance, full control |
| **OpenSheetMusicDisplay** | Music notation rendering | Mature MusicXML support, SVG output, active maintenance |
| **Tone.js** | Audio synthesis & scheduling | Comprehensive Web Audio abstraction, deterministic timing |
| **TensorFlow.js Lite** | Polyphonic detection | Pre-trained Magenta model, browser-optimized |
| **Web Audio API** | Audio I/O | Native browser API, lowest latency path |
| **LocalStorage** | Client-side persistence | Simple key-value store, synchronous API, universal support |
| **Playwright** | E2E testing | Headful audio testing, cross-browser, modern automation |
| **Node.js Test Runner** | Unit testing | No dependencies, fast execution, built-in |

---

## 3. Module Architecture

### 3.1 Exercise Loader Module

**File**: `src/core/exerciseLoader.js`

**Responsibility**: Parse MusicXML files and generate ExerciseJSON structure

**Public API**:
```javascript
class ExerciseLoader {
  /**
   * Parse MusicXML string into ExerciseJSON
   * @param {string} xmlContent - Raw MusicXML content
   * @returns {Promise<ExerciseJSON>} Parsed exercise data
   * @throws {ParseError} If XML invalid or missing required elements
   */
  async parseXML(xmlContent)
  
  /**
   * Load exercise from file
   * @param {File} file - File object from input element
   * @returns {Promise<ExerciseJSON>} Parsed exercise data
   */
  async loadFromFile(file)
  
  /**
   * Validate ExerciseJSON structure
   * @param {Object} exerciseJSON - Exercise data to validate
   * @returns {ValidationResult} Validation status and errors
   */
  validateExercise(exerciseJSON)
}
```

**Internal Implementation**:
- Use DOMParser to parse XML
- Extract metadata: title, composer, tempo, time signature
- Identify staves: staff 1 (notation), staff 2 (tablature)
- Build timeline: convert divisions to milliseconds
- Handle rest elements: advance time forward (fixed from previous rewind behavior)
- Automatic deduplication: remove identical notes across staves (2ms timestamp tolerance)
- Separate OSMD inputs: filter staff-specific elements
- Handle backup elements for voice management
- Extract tablature data: string/fret notations

**Dependencies**:
- None (pure data transformation)

**Events Emitted**:
```javascript
'exercise:loaded'    // {exerciseJSON, source}
'exercise:error'     // {error, file}
'parse:progress'     // {percent, stage}
```

**Error Handling**:
- Validate XML structure before parsing
- Catch malformed note elements
- Provide detailed error messages with line numbers
- Never crash on invalid input

**Testing Strategy**:
- Unit tests with all sample XML files
- Edge cases: empty measures, missing attributes, invalid durations
- Performance test: 200 measure file < 2 seconds

---

### 3.2 Notation Renderer Module

**File**: `src/core/notationRenderer.js`

**Responsibility**: Render single OSMD instances with DOM element mapping

**Public API**:
```javascript
class NotationRenderer {
  /**
   * Initialize renderer with container elements
   * @param {HTMLElement} notationContainer - Standard notation div
   * @param {HTMLElement} tabContainer - Tablature div
   */
  constructor(notationContainer, tabContainer)
  
  /**
   * Render exercise in both views
   * @param {ExerciseJSON} exercise - Parsed exercise data
   * @returns {Promise<RenderResult>} Render status and element map
   */
  async render(exercise)
  
  /**
   * Highlight note elements by ID
   * @param {string[]} noteIds - Array of note identifiers
   * @param {string} className - CSS class to apply
   */
  highlightNotes(noteIds, className)
  
  /**
   * Clear all highlights
   */
  clearHighlights()
  
  /**
   * Scroll to note by ID
   * @param {string} noteId - Note identifier
   * @param {ScrollOptions} options - Scroll behavior configuration
   */
  scrollToNote(noteId, options)
  
  /**
   * Get DOM element for note ID
   * @param {string} noteId - Note identifier
   * @returns {SVGElement|null} Rendered note element
   */
  getNoteElement(noteId)
}
```

**Internal Implementation**:
- Create single OSMD instances: `osmdNotation`
- Configure OSMD options: cursor disabled initially, auto-resize enabled
- Render notation staff and tablature staff 
- Post-process SVG: add data-note-id attributes
- Build noteElementMap: noteId → SVGElement
- Implement progressive rendering for large scores

**OSMD Configuration**:
```javascript
{
  drawTitle: false,
  drawComposer: false,
  drawCredits: false,
  backend: 'svg',
  autoResize: true,
  renderSingleHorizontalStaffline: false
}
```

**Data Attribute Mapping**:
- Parse OSMD's internal note representations
- Match to timeline note IDs via pitch + timestamp
- Add `data-note-id="n1"` to SVG <g> elements
- Handle chords: multiple IDs on same element group

**Dependencies**:
- OpenSheetMusicDisplay library
- ExerciseJSON from loader

**Events Emitted**:
```javascript
'render:start'       // {exerciseId}
'render:progress'    // {percent, system}
'render:complete'    // {noteCount, systemCount}
'render:error'       // {error, stage}
```

**Error Handling**:
- Catch OSMD rendering exceptions
- Display placeholder for unrenderable sections
- Log detailed errors for debugging

**Testing Strategy**:
- E2E test: verify dual containers present
- E2E test: validate data-note-id attributes
- E2E test: check SVG structure and content
- Unit test: element mapping correctness

---

### 3.3 Playback Engine Module

**File**: `src/core/playbackEngine.js`

**Responsibility**: Deterministic audio scheduling and playback state management

**Public API**:
```javascript
class PlaybackEngine extends EventEmitter {
  /**
   * Initialize with timeline and configuration
   * @param {Timeline} timeline - Array of note events
   * @param {PlaybackConfig} config - BPM, instrument mode, etc.
   */
  constructor(timeline, config)
  
  /**
   * Start playback from current position
   * @param {number} offsetMs - Start position in milliseconds
   */
  async play(offsetMs = 0)
  
  /**
   * Pause playback, maintain position
   */
  pause()
  
  /**
   * Stop playback, reset to beginning
   */
  stop()
  
  /**
   * Seek to position
   * @param {number} positionMs - Target position in milliseconds
   */
  seek(positionMs)
  
  /**
   * Update tempo
   * @param {number} bpm - New beats per minute
   */
  setTempo(bpm)
  
  /**
   * Switch instrument mode
   * @param {string} mode - 'synth' | 'sample'
   */
  setInstrumentMode(mode)
  
  /**
   * Get current playback position
   * @returns {number} Position in milliseconds
   */
  getCurrentPosition()
}
```

**Internal Implementation**:

**State Machine**:
```javascript
const PlaybackState = {
  STOPPED: 'stopped',
  PLAYING: 'playing',
  PAUSED: 'paused'
};
```

**Scheduling Algorithm**:
1. Convert timeline to Tone.js Transport events
2. Schedule all events before playback starts
3. Use Tone.Transport.scheduleRepeat for tick emission
4. Emit tick events at note onset times
5. Track current system for scroll events

**Audio Synthesis**:
- Synth mode: use Tone.PolySynth with AMSynth
- Sample mode: use Tone.Player instances
- Preload all samples before playback
- Handle note overlaps with polyphony

**Cursor Management**:
- Initialize cursor at first musical note (skip clef)
- Emit tick event with noteId and systemNumber
- Track current note index
- Emit systemChange when crossing system boundary

**Dependencies**:
- Tone.js for audio synthesis
- AudioContext (managed by uiManager)
- Sample files (if sample mode)

**Events Emitted**:
```javascript
'playback:started'     // {startTime, offsetMs}
'playback:tick'        // {noteId, timestamp, systemNumber}
'playback:systemChange' // {systemNumber}
'playback:paused'      // {currentPosition}
'playback:stopped'     // {}
'playback:completed'   // {duration, noteCount}
'playback:error'       // {error, state}
```

**Error Handling**:
- Validate timeline before scheduling
- Handle audio context suspension
- Catch synthesis errors gracefully
- Emit error events, never throw

**Performance Considerations**:
- Pre-schedule all events (< 100ms overhead)
- Use object pooling for event data
- Minimize event payload size
- Measure actual vs. scheduled timing

**Testing Strategy**:
- Unit test: scheduling accuracy at various BPMs
- Unit test: state transitions valid
- Unit test: cursor initialization correct
- Integration test: audio output timing
- Latency measurement: tick event to cursor update < 20ms

---

### 3.4 Pitch Detector Module (Monophonic)

**File**: `src/core/pitchDetector.js`

**Responsibility**: Real-time fundamental frequency detection using YIN algorithm

**Public API**:
```javascript
class PitchDetector extends EventEmitter {
  /**
   * Initialize detector with configuration
   * @param {AudioContext} audioContext - Web Audio context
   * @param {DetectorConfig} config - Buffer size, update rate, threshold
   */
  constructor(audioContext, config)
  
  /**
   * Start pitch detection from microphone
   * @param {MediaStream} stream - Microphone audio stream
   */
  async start(stream)
  
  /**
   * Stop detection
   */
  stop()
  
  /**
   * Update configuration
   * @param {Partial<DetectorConfig>} config - Configuration updates
   */
  updateConfig(config)
  
  /**
   * Get current detection state
   * @returns {DetectorState} Active, frequency, confidence
   */
  getState()
}
```

**Internal Implementation**:

**YIN Algorithm Steps**:
1. Capture time-domain audio using AnalyserNode
2. Calculate difference function: `d(tau) = sum((x[j] - x[j+tau])^2)`
3. Calculate cumulative mean normalized difference: `d'(tau)`
4. Find first tau where `d'(tau) < threshold`
5. Apply parabolic interpolation for sub-sample accuracy
6. Convert tau to frequency: `f = sampleRate / tau`

**Adaptive Buffer Sizing**:
- Low frequencies (< 100Hz): 4096 samples
- Mid frequencies (100-500Hz): 2048 samples
- High frequencies (> 500Hz): 1024 samples
- Adjust based on detected pitch history

**Noise Gating**:
- Calculate RMS amplitude of input signal
- Reject detections below threshold (default -40dB)
- Filter out DC offset before processing
- High-pass filter at 60Hz to remove low-frequency rumble

**Confidence Scoring**:
- Clarity of autocorrelation peak: `1 / d'(tau)`
- Harmonic-to-noise ratio consideration
- Temporal consistency with previous detections
- Output confidence value 0.0 to 1.0

**Dependencies**:
- Web Audio API (AudioContext, AnalyserNode)
- AudioWorklet for low-latency processing (fallback to ScriptProcessorNode)

**Events Emitted**:
```javascript
'pitch:detected'   // {frequency, midiNote, cents, confidence, timestamp}
'pitch:silence'    // {timestamp}
'detector:started' // {config}
'detector:stopped' // {}
'detector:error'   // {error}
```

**Error Handling**:
- Handle microphone permission denial
- Catch audio processing exceptions
- Validate buffer sizes before processing
- Graceful degradation if AudioWorklet unavailable

**Performance Targets**:
- Processing latency: < 30ms
- Update rate: 50Hz (20ms intervals)
- CPU usage: < 25% single core
- Memory: < 10MB

**Testing Strategy**:
- Unit test: YIN algorithm with synthetic sine waves
- Unit test: noise gating thresholds
- Integration test: guitar open string recordings
- Latency measurement: input to event emission
- Accuracy test: A4 440Hz ± 2Hz

---

### 3.5 Polyphonic Detector Module

**File**: `src/core/polyphonicDetector.js`

**Responsibility**: Multi-pitch detection using TensorFlow Lite Onsets & Frames model

**Public API**:
```javascript
class PolyphonicDetector extends EventEmitter {
  /**
   * Initialize detector and load model
   * @param {string} modelPath - Path to model.json
   * @param {DetectorConfig} config - Configuration
   */
  constructor(modelPath, config)
  
  /**
   * Load TensorFlow Lite model
   * @returns {Promise<LoadResult>} Model loaded status
   */
  async loadModel()
  
  /**
   * Start polyphonic detection
   * @param {AudioContext} audioContext - Web Audio context
   * @param {MediaStream} stream - Microphone audio stream
   */
  async start(audioContext, stream)
  
  /**
   * Stop detection
   */
  stop()
  
  /**
   * Check if model loaded successfully
   * @returns {boolean} Model ready state
   */
  isReady()
}
```

**Internal Implementation**:

**Model Loading**:
- Load model.json and weight files from assets/models/magenta/
- Display loading progress (file size / bytes loaded)
- Validate model architecture matches expected input
- Implement timeout (30 seconds) with fallback
- Cache loaded model in memory for session

**Audio Processing Pipeline**:
1. Capture audio using Web Audio API
2. Buffer audio into 8-second chunks (model input requirement)
3. Resample to 16kHz if needed (model's expected sample rate)
4. Normalize audio amplitude to [-1, 1] range
5. Pass to model inference in Web Worker

**Inference Execution**:
- Run inference in Web Worker to avoid UI blocking
- Use TensorFlow.js executeAsync for non-blocking execution
- Parse model output: onset times and active notes
- Convert to MIDI note numbers (0-127)
- Associate timestamps with detections

**Output Processing**:
- Filter low-confidence detections (< 0.5 threshold)
- Remove duplicate detections in time window
- Merge overlapping note events
- Emit structured note events

**Dependencies**:
- TensorFlow.js Lite
- Web Audio API
- Web Worker for inference
- Magenta Onsets & Frames model files

**Events Emitted**:
```javascript
'poly:detected'       // {notes: [midiNote, ...], timestamp, confidence}
'poly:modelLoading'   // {percent, bytesLoaded, bytesTotal}
'poly:modelLoaded'    // {modelInfo}
'poly:modelError'     // {error}
'poly:started'        // {}
'poly:stopped'        // {}
```

**Error Handling**:
- Detect model file missing, emit error, disable polyphonic features
- Handle insufficient memory gracefully
- Catch inference exceptions, continue with monophonic
- Validate model output structure before processing

**Graceful Degradation**:
- If model fails to load, emit error and return to monophonic-only mode
- Display user notification explaining limitation
- Provide retry mechanism for transient failures
- Store degradation state in session

**Performance Targets**:
- Model load time: < 10 seconds
- Inference latency: < 200ms per chunk
- Memory usage: stable < 150MB
- No browser freezing during inference

**Testing Strategy**:
- Smoke test: verify model loads from local path
- Unit test: two-note chord detection
- Integration test: real guitar chord input
- Memory test: extended session stability
- Fallback test: graceful degradation when model unavailable

---

### 3.6 Analyzer Module

**File**: `src/core/analyzer.js`

**Responsibility**: Performance analysis using Dynamic Time Warping alignment

**Public API**:
```javascript
class Analyzer extends EventEmitter {
  /**
   * Initialize analyzer with tolerance configuration
   * @param {AnalyzerConfig} config - Pitch and timing tolerances
   */
  constructor(config)
  
  /**
   * Analyze performance against reference timeline
   * @param {Timeline} referenceTimeline - Expected notes
   * @param {PitchStream} detectedStream - Detected pitch events
   * @returns {Promise<AnalysisResult>} Per-note and aggregate results
   */
  async analyze(referenceTimeline, detectedStream)
  
  /**
   * Update tolerance levels (difficulty)
   * @param {ToleranceConfig} tolerances - New thresholds
   */
  setTolerances(tolerances)
  
  /**
   * Get performance history
   * @returns {PerformanceHistory[]} Past analysis results
   */
  getHistory()
  
  /**
   * Clear performance history
   */
  clearHistory()
}
```

**Internal Implementation**:

**Dynamic Time Warping Algorithm**:
1. Build cost matrix: rows = reference, cols = detected
2. Cost function: pitch distance + timing distance
3. Fill matrix with cumulative minimum path cost
4. Backtrack to find optimal alignment path
5. Extract note correspondences from path

**Cost Function**:
```javascript
cost(ref, detected) = 
  α * pitchDistance(ref.midi, detected.midi) +
  β * timingDistance(ref.timestamp, detected.timestamp)
```
- α (pitch weight): 0.6
- β (timing weight): 0.4
- Pitch distance: abs(midi1 - midi2) / 12 (normalized semitones)
- Timing distance: abs(t1 - t2) / 1000 (normalized seconds)

**Per-Note Evaluation**:
- **Pitch Correctness**: detected MIDI within ± tolerance (default ±50 cents)
- **Timing Deviation**: abs(detected - reference) in milliseconds
- **Classification**:
  - `CORRECT`: pitch and timing within tolerance
  - `WRONG_PITCH`: timing OK, pitch incorrect
  - `WRONG_TIMING`: pitch OK, timing outside tolerance
  - `MISSED`: no corresponding detection
  - `EXTRA`: detection with no reference note

**Aggregate Scoring**:
```javascript
{
  correctPercentage: (correctNotes / totalNotes) * 100,
  averageTimingDeviation: mean(abs(timing deviations)),
  timingConsistencyScore: 100 - (stddev(timing deviations) / maxDeviation * 100),
  notesCorrect: count(CORRECT),
  notesMissed: count(MISSED),
  notesWrongPitch: count(WRONG_PITCH),
  notesWrongTiming: count(WRONG_TIMING),
  notesExtra: count(EXTRA)
}
```

**Tolerance Presets**:
```javascript
const TOLERANCE_PRESETS = {
  EASY: { pitch: 100, timing: 200 },    // cents, ms
  NORMAL: { pitch: 50, timing: 100 },
  HARD: { pitch: 25, timing: 50 }
};
```

**Performance History**:
- Store analysis results with timestamp
- Include exerciseId, score, tolerances used
- Limit to 100 most recent entries (circular buffer)
- Persist to LocalStorage via storage module

**Dependencies**:
- Timeline from exercise loader
- PitchStream from pitch detectors
- Storage module for history persistence

**Events Emitted**:
```javascript
'analysis:started'    // {referenceCount, detectedCount}
'analysis:complete'   // {result: AnalysisResult}
'analysis:error'      // {error}
```

**Error Handling**:
- Validate input streams before processing
- Handle empty detected stream (no input)
- Catch DTW algorithm exceptions
- Return partial results on non-critical errors

**Performance Targets**:
- Analysis completion: < 100ms for 100 notes
- Real-time capable: analyze during playback
- Memory: < 20MB for large exercises

**Testing Strategy**:
- Unit test: perfect performance yields 100% score
- Unit test: intentionally mistimed notes flagged correctly
- Unit test: DTW alignment correctness
- Integration test: synthetic performance data
- Performance test: 200 note exercise analysis time

---

### 3.7 Tuner Module

**File**: `src/core/tuner.js`

**Responsibility**: Real-time tuning display with visual feedback

**Public API**:
```javascript
class Tuner extends EventEmitter {
  /**
   * Initialize tuner with configuration
   * @param {TunerConfig} config - Reference pitch, smoothing factor
   */
  constructor(config)
  
  /**
   * Start tuner mode
   * @param {PitchDetector} pitchDetector - Detector instance
   */
  start(pitchDetector)
  
  /**
   * Stop tuner mode
   */
  stop()
  
  /**
   * Set reference pitch (A4 frequency)
   * @param {number} frequency - Reference A4 in Hz (e.g., 440, 432)
   */
  setReferencePitch(frequency)
  
  /**
   * Update smoothing factor
   * @param {number} factor - 0.0 (no smoothing) to 0.99 (heavy smoothing)
   */
  setSmoothingFactor(factor)
}
```

**Internal Implementation**:

**Exponential Smoothing Filter**:
```javascript
smoothedFrequency = α * currentFrequency + (1 - α) * previousFrequency
```
- α (smoothing factor): 0.2 default (configurable 0.0-0.99)
- Lower α = more smoothing, less responsive
- Higher α = less smoothing, more responsive
- Apply to both frequency and cents deviation separately

**Pitch Calculation**:
1. Receive frequency from pitch detector
2. Apply smoothing filter
3. Calculate nearest MIDI note: `round(12 * log2(f / 440) + 69)`
4. Calculate expected frequency: `440 * 2^((midi - 69) / 12)`
5. Calculate cents deviation: `1200 * log2(detected / expected)`

**Color-Coded Zones**:
```javascript
const TUNING_ZONES = {
  IN_TUNE:  { min: -5,  max: 5,   color: '#00C853' }, // green
  CLOSE:    { min: -20, max: 20,  color: '#FFA726' }, // orange
  OUT_TUNE: { min: -50, max: 50,  color: '#E53935' }  // red
};
```

**Visual Needle Calculation**:
- Map cents deviation (-50 to +50) to needle angle (-45° to +45°)
- Apply CSS transform: `rotate(${angle}deg)`
- Center position (0 cents) = vertical needle
- Left deflection = flat, right deflection = sharp

**Display Format**:
- Frequency: `XXX.X Hz` (1 decimal place)
- Note name: `E2`, `A3`, `B♭4` (with accidentals)
- Cents deviation: `+XX` or `-XX` cents
- Color indicator based on accuracy zone

**Reference Pitch Adjustment**:
- Store reference pitch in config (default 440Hz)
- Recalculate all note frequencies when changed
- Common alternatives: 432Hz, 442Hz, 444Hz
- Update display immediately on change

**Dependencies**:
- PitchDetector for frequency input
- No direct audio capture (uses detector's output)

**Events Emitted**:
```javascript
'tuner:update'     // {frequency, noteName, cents, color, confidence}
'tuner:started'    // {}
'tuner:stopped'    // {}
```

**Error Handling**:
- Handle no pitch detected gracefully (show "--" Hz)
- Validate smoothing factor range
- Catch calculation errors (invalid frequencies)

**Performance Targets**:
- Update rate: 30-60 Hz for smooth needle movement
- No visual jitter with appropriate smoothing
- CPU usage: < 5% single core

**Testing Strategy**:
- Manual test: sustain A4, verify 440.0 Hz ± 0.1 Hz
- Manual test: flat note shows negative cents and appropriate color
- Unit test: cents calculation accuracy
- Unit test: smoothing filter behavior
- Manual test: needle movement smooth without jitter

---

### 3.8 UI Manager Module

**File**: `src/core/uiManager.js`

**Responsibility**: Orchestrate UI interactions and coordinate module communication

**Public API**:
```javascript
class UIManager {
  /**
   * Initialize UI manager with dependencies
   * @param {Object} modules - All core modules
   */
  constructor(modules)
  
  /**
   * Initialize application
   */
  async init()
  
  /**
   * Switch between tabs
   * @param {string} tabName - 'practice' | 'tuner' | 'lessons' | 'settings'
   */
  switchTab(tabName)
  
  /**
   * Load exercise and update UI
   * @param {File|string} exercise - File or exercise ID
   */
  async loadExercise(exercise)
  
  /**
   * Show notification to user
   * @param {string} message - Notification text
   * @param {string} type - 'info' | 'success' | 'warning' | 'error'
   */
  showNotification(message, type)
}
```

**Internal Implementation**:

**Initialization Flow**:
1. Initialize storage module
2. Load user settings from storage
3. Set up event listeners on UI elements
4. Initialize audio context manager (suspended state)
5. Load last-opened exercise if available
6. Set up module event subscriptions
7. Display initial tab (Practice)

**Tab Management**:
- Practice tab: notation, playback controls, feedback
- Tuner tab: tuner interface, pitch display
- Lessons tab: exercise library, file upload
- Settings tab: preferences, audio configuration

**Audio Context Lifecycle**:
- Display "Start Audio Context" button on page load
- Activate audio context on user gesture (click)
- Store activation state in session
- Resume context if suspended (tab backgrounding)
- Show context state indicator

**Event Subscriptions**:
```javascript
// Exercise loading
exerciseLoader.on('exercise:loaded', this.onExerciseLoaded.bind(this));
exerciseLoader.on('exercise:error', this.onExerciseError.bind(this));

// Playback events
playbackEngine.on('playback:tick', this.onPlaybackTick.bind(this));
playbackEngine.on('playback:systemChange', this.onSystemChange.bind(this));
playbackEngine.on('playback:completed', this.onPlaybackComplete.bind(this));

// Analysis events
analyzer.on('analysis:complete', this.onAnalysisComplete.bind(this));

// Tuner events
tuner.on('tuner:update', this.onTunerUpdate.bind(this));
```

**Playback Control Handlers**:
```javascript
onPlayClick() {
  if (!this.audioContextActivated) {
    this.showNotification('Please activate audio context first', 'warning');
    return;
  }
  this.playbackEngine.play();
  this.updatePlayButtonState('playing');
}

onPauseClick() {
  this.playbackEngine.pause();
  this.updatePlayButtonState('paused');
}

onStopClick() {
  this.playbackEngine.stop();
  this.updatePlayButtonState('stopped');
  this.notationRenderer.clearHighlights();
}
```

**Real-Time Feedback Display**:
1. Subscribe to `analysis:complete` events
2. Extract per-note results from AnalysisResult
3. Call `notationRenderer.highlightNotes()` with appropriate classes
4. Update score display in header
5. Accumulate results for end-of-exercise summary

**Keyboard Shortcuts**:
```javascript
const KEYBOARD_SHORTCUTS = {
  ' ': 'togglePlayPause',
  'Escape': 'stop',
  'ArrowRight': 'seekForward',
  'ArrowLeft': 'seekBackward',
  '+': 'increaseTempo',
  '-': 'decreaseTempo',
  'm': 'toggleMetronome',
  'Tab': 'nextTab'
};
```

**Responsive Layout**:
- Detect viewport size changes
- Adjust notation view aspect ratio
- Collapse secondary panels on narrow screens
- Maintain minimum usable width (1280px recommended)

**Dependencies**:
- All core modules (exerciseLoader, notationRenderer, playbackEngine, etc.)
- Storage module for settings persistence

**Events Emitted**:
```javascript
'ui:tabChanged'      // {tabName}
'ui:exerciseLoaded'  // {exerciseId}
'ui:audioActivated'  // {}
```

**Error Handling**:
- Display user-friendly error notifications
- Log detailed errors to console
- Maintain UI stability on module errors
- Provide recovery actions where applicable

**Testing Strategy**:
- E2E test: tab navigation functional
- E2E test: playback controls respond correctly
- E2E test: audio context button workflow
- E2E test: keyboard shortcuts work
- Integration test: event subscription correctness

---

### 3.9 Storage Module

**File**: `src/core/storage.js`

**Responsibility**: Abstract LocalStorage with structured API and error handling

**Public API**:
```javascript
class Storage {
  /**
   * Get value by key
   * @param {string} key - Storage key
   * @param {any} defaultValue - Fallback if key not found
   * @returns {any} Stored value or default
   */
  get(key, defaultValue = null)
  
  /**
   * Set value by key
   * @param {string} key - Storage key
   * @param {any} value - Value to store (will be JSON serialized)
   * @returns {boolean} Success status
   */
  set(key, value)
  
  /**
   * Delete value by key
   * @param {string} key - Storage key
   * @returns {boolean} Success status
   */
  delete(key)
  
  /**
   * Clear all namespaced keys
   * @returns {boolean} Success status
   */
  clear()
  
  /**
   * Get all keys with optional prefix filter
   * @param {string} prefix - Optional key prefix
   * @returns {string[]} Array of keys
   */
  keys(prefix = '')
  
  /**
   * Check if key exists
   * @param {string} key - Storage key
   * @returns {boolean} Existence status
   */
  has(key)
}
```

**Internal Implementation**:

**Key Namespacing**:
- Prefix all keys with `g4:` to avoid collisions
- Example: `g4:settings`, `g4:lastExercise`, `g4:history:001`

**Data Schema Versioning**:
```javascript
const SCHEMA_VERSION = 1;

function wrapData(value) {
  return {
    version: SCHEMA_VERSION,
    timestamp: Date.now(),
    data: value
  };
}

function unwrapData(wrapped) {
  if (wrapped.version !== SCHEMA_VERSION) {
    return migrateData(wrapped);
  }
  return wrapped.data;
}
```

**Migration Support**:
```javascript
function migrateData(oldData) {
  const migrations = {
    0: migrateV0toV1,
    // Future migrations added here
  };
  
  let data = oldData;
  for (let v = oldData.version; v < SCHEMA_VERSION; v++) {
    data = migrations[v](data);
  }
  return data;
}
```

**Storage Keys**:
```javascript
const STORAGE_KEYS = {
  SETTINGS: 'settings',
  LAST_EXERCISE: 'lastExercise',
  EXERCISE_CACHE: 'exerciseCache:',  // + exerciseId
  PERFORMANCE_HISTORY: 'perfHistory',
  AUDIO_CONTEXT_STATE: 'audioContextState'
};
```

**Quota Management**:
- Catch QuotaExceededError exceptions
- Calculate total storage usage
- Display warning at 80% quota
- Provide clear storage option in settings
- Implement circular buffer for history (oldest deleted first)

**Error Handling**:
```javascript
set(key, value) {
  try {
    const wrapped = wrapData(value);
    const serialized = JSON.stringify(wrapped);
    localStorage.setItem(this.namespace + key, serialized);
    return true;
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      this.handleQuotaExceeded();
    } else {
      console.error('Storage error:', error);
    }
    return false;
  }
}
```

**Data Export**:
```javascript
exportData() {
  const allData = {};
  this.keys().forEach(key => {
    allData[key] = this.get(key);
  });
  return JSON.stringify(allData, null, 2);
}
```

**Dependencies**:
- Browser LocalStorage API (fallback to in-memory if unavailable)

**Events Emitted**:
```javascript
'storage:quotaExceeded'  // {usage, limit}
'storage:error'          // {error, key}
```

**Performance Considerations**:
- Synchronous operations (LocalStorage limitation)
- Cache frequently accessed values in memory
- Debounce rapid set operations
- Minimize serialization overhead

**Testing Strategy**:
- Unit test: get/set/delete operations
- Unit test: namespace collision prevention
- Unit test: schema versioning and migration
- Unit test: quota exceeded handling
- Integration test: settings persistence across sessions

---

## 4. Data Contracts

### 4.1 ExerciseJSON Structure

**Purpose**: Unified representation of parsed musical exercise

```javascript
{
  // Metadata
  id: string,                    // Unique identifier (hash or filename)
  title: string,                 // Exercise title
  composer: string,              // Composer name (optional)
  
  // Musical properties
  tempo: number,                 // Beats per minute
  timeSignature: {
    beats: number,               // Numerator (e.g., 4 in 4/4)
    beatType: number             // Denominator (e.g., 4 in 4/4)
  },
  
  // Instrument configuration
  tuning: string[],              // Array of pitch strings ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']
  
  // Timeline: chronological note events
  timeline: [
    {
      id: string,                // Unique note identifier (e.g., 'n1', 'n2')
      timestamp: number,         // Milliseconds from start
      duration: number,          // Milliseconds
      midi: number,              // MIDI note number (0-127)
      pitch: {
        step: string,            // Note letter (C, D, E, F, G, A, B)
        octave: number,          // Octave number
        alter: number            // Accidental (-1 flat, 0 natural, 1 sharp)
      },
      staff: number,             // Staff number (1 for notation, 2 for tab)
      voice: number,             // Voice number for polyphony
      
      // Tablature data (if staff === 2)
      tab: {
        string: number,          // String number (1-6)
        fret: number             // Fret number (0-24)
      } | null,
      
      // Additional properties
      dynamics: string,          // 'pp', 'p', 'mp', 'mf', 'f', 'ff' (optional)
      articulation: string[],    // ['staccato', 'accent', etc.] (optional)
      system: number             // System number for layout (1-indexed)
    }
  ],
  
  // OSMD-specific input strings
  osmdNotation: string,          // MusicXML string with staff 1 only

  
  // Layout information
  systemCount: number,           // Total number of systems
  measureCount: number           // Total number of measures
}
```

**Validation Rules**:
- `id` must be unique and non-empty
- `tempo` must be > 0 and < 500
- `timeline` must be sorted by timestamp (ascending)
- Each note `id` must be unique within timeline
- `staff` must be 1 or 2
- `midi` must be 0-127
- `tab.string` must be 1-6 if present
- `tab.fret` must be 0-24 if present

---

### 4.2 PitchStream Event Structure

**Purpose**: Normalized output from pitch detection modules

**Monophonic Event**:
```javascript
{
  type: 'monophonic',
  timestamp: number,             // Milliseconds since detection started
  frequency: number,             // Detected frequency in Hz
  midi: number,                  // Nearest MIDI note number
  cents: number,                 // Cents deviation from nearest semitone (-50 to +50)
  confidence: number,            // Detection confidence (0.0 to 1.0)
  amplitude: number              // RMS amplitude in dB
}
```

**Polyphonic Event**:
```javascript
{
  type: 'polyphonic',
  timestamp: number,             // Milliseconds since detection started
  notes: [
    {
      midi: number,              // MIDI note number
      confidence: number,        // Per-note confidence (0.0 to 1.0)
      velocity: number           // Note velocity/amplitude (0-127)
    }
  ],
  onset: boolean                 // True if attack detected
}
```

**Silence Event**:
```javascript
{
  type: 'silence',
  timestamp: number,             // Milliseconds since detection started
  duration: number               // Duration of silence in ms
}
```

---

### 4.3 AnalysisResult Structure

**Purpose**: Output from analyzer module for performance feedback

```javascript
{
  // Aggregate metrics
  aggregate: {
    correctPercentage: number,           // 0-100
    averageTimingDeviation: number,      // Milliseconds
    timingConsistencyScore: number,      // 0-100
    notesCorrect: number,
    notesMissed: number,
    notesWrongPitch: number,
    notesWrongTiming: number,
    notesExtra: number,
    totalNotes: number
  },
  
  // Per-note results
  perNote: [
    {
      noteId: string,                    // References timeline note id
      classification: string,            // 'CORRECT' | 'WRONG_PITCH' | 'WRONG_TIMING' | 'MISSED'
      
      // Reference data
      expectedMidi: number,
      expectedTimestamp: number,
      
      // Detected data
      detectedMidi: number | null,
      detectedTimestamp: number | null,
      
      // Deviations
      pitchDeviation: number,            // Semitones difference
      timingDeviation: number,           // Milliseconds difference
      
      // Correctness flags
      pitchCorrect: boolean,
      timingCorrect: boolean
    }
  ],
  
  // Metadata
  exerciseId: string,
  timestamp: number,                     // Analysis completion time
  tolerances: {
    pitch: number,                       // Cents
    timing: number                       // Milliseconds
  },
  duration: number                       // Total exercise duration in ms
}
```

---

### 4.4 PlaybackConfig Structure

**Purpose**: Configuration for playback engine

```javascript
{
  bpm: number,                           // Beats per minute (default: 120)
  instrumentMode: string,                // 'synth' | 'sample' (default: 'synth')
  instrument: string,                    // 'guitar' | 'piano' (default: 'guitar')
  volume: number,                        // Master volume 0.0-1.0 (default: 0.7)
  metronomeEnabled: boolean,             // Metronome on/off (default: false)
  metronomeVolume: number,               // Metronome volume 0.0-1.0 (default: 0.5)
  loopEnabled: boolean,                  // Loop playback (default: false)
  loopStart: number | null,              // Loop start in ms (null = disabled)
  loopEnd: number | null                 // Loop end in ms (null = disabled)
}
```

---

### 4.5 DetectorConfig Structure

**Purpose**: Configuration for pitch detection

```javascript
{
  // Buffer configuration
  bufferSize: number,                    // 1024, 2048, 4096 (default: 2048)
  updateRate: number,                    // Hz (default: 50)
  
  // Noise gating
  noiseThreshold: number,                // dB (default: -40)
  noiseGateEnabled: boolean,             // default: true
  
  // Detection parameters
  confidenceThreshold: number,           // 0.0-1.0 (default: 0.7)
  minFrequency: number,                  // Hz (default: 80)
  maxFrequency: number,                  // Hz (default: 1000)
  
  // Smoothing (for tuner)
  smoothingFactor: number,               // 0.0-0.99 (default: 0.2)
  
  // Adaptive settings
  adaptiveBufferSize: boolean            // default: true
}
```

---

### 4.6 ToleranceConfig Structure

**Purpose**: Analysis tolerance configuration (difficulty levels)

```javascript
{
  pitch: number,                         // Cents tolerance (default: 50)
  timing: number,                        // Milliseconds tolerance (default: 100)
  preset: string                         // 'EASY' | 'NORMAL' | 'HARD' | 'CUSTOM'
}
```

**Preset Values**:
```javascript
const TOLERANCE_PRESETS = {
  EASY:   { pitch: 100, timing: 200 },
  NORMAL: { pitch: 50,  timing: 100 },
  HARD:   { pitch: 25,  timing: 50 }
};
```

---

## 5. Event-Driven Communication

### 5.1 Event Bus Architecture

**EventEmitter Pattern**:
- All core modules extend EventEmitter base class
- Modules emit events for state changes
- UI Manager subscribes to all module events
- Modules can subscribe to each other via UI Manager mediation

**EventEmitter Base Class**:
```javascript
// src/utils/eventEmitter.js
class EventEmitter {
  constructor() {
    this.events = {};
  }
  
  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return () => this.off(event, listener);  // Return unsubscribe function
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
  
  once(event, listener) {
    const onceListener = (data) => {
      listener(data);
      this.off(event, onceListener);
    };
    this.on(event, onceListener);
  }
}
```

### 5.2 Event Catalog

**Exercise Loader Events**:
```javascript
'exercise:loaded'     // { exerciseJSON, source, parseTime }
'exercise:error'      // { error, file, lineNumber }
'parse:progress'      // { percent, stage, currentMeasure }
```

**Notation Renderer Events**:
```javascript
'render:start'        // { exerciseId }
'render:progress'     // { percent, systemNumber, totalSystems }
'render:complete'     // { noteCount, systemCount, renderTime }
'render:error'        // { error, stage, systemNumber }
```

**Playback Engine Events**:
```javascript
'playback:started'    // { startTime, offsetMs, bpm }
'playback:tick'       // { noteId, timestamp, systemNumber, midi }
'playback:systemChange' // { systemNumber, timestamp }
'playback:paused'     // { currentPosition, noteId }
'playback:stopped'    // { totalDuration }
'playback:completed'  // { duration, noteCount }
'playback:error'      // { error, state }
'playback:tempo'      // { newBpm, oldBpm }
```

**Pitch Detector Events**:
```javascript
'pitch:detected'      // { frequency, midiNote, cents, confidence, timestamp }
'pitch:silence'       // { timestamp, duration }
'detector:started'    // { config }
'detector:stopped'    // {}
'detector:error'      // { error }
```

**Polyphonic Detector Events**:
```javascript
'poly:detected'       // { notes: [{midi, confidence}], timestamp, onset }
'poly:modelLoading'   // { percent, bytesLoaded, bytesTotal }
'poly:modelLoaded'    // { modelInfo, loadTime }
'poly:modelError'     // { error, fallbackMode }
'poly:started'        // { config }
'poly:stopped'        // {}
```

**Analyzer Events**:
```javascript
'analysis:started'    // { referenceCount, detectedCount }
'analysis:progress'   // { percent, currentNote }
'analysis:complete'   // { result: AnalysisResult }
'analysis:error'      // { error }
```

**Tuner Events**:
```javascript
'tuner:update'        // { frequency, noteName, cents, color, confidence }
'tuner:started'       // {}
'tuner:stopped'       // {}
```

**Storage Events**:
```javascript
'storage:quotaExceeded' // { usage, limit, recommendation }
'storage:error'       // { error, key, operation }
```

**UI Manager Events**:
```javascript
'ui:tabChanged'       // { tabName, previousTab }
'ui:exerciseLoaded'   // { exerciseId, title }
'ui:audioActivated'   // { contextState }
'ui:notification'     // { message, type, duration }
```

### 5.3 Event Flow Examples

**Example 1: Loading and Playing Exercise**

```
User clicks "Load Sample"
  │
  ├─> UIManager.loadExercise()
  │     │
  │     ├─> ExerciseLoader.loadFromFile()
  │     │     │
  │     │     ├─> emit('parse:progress', {percent: 50})
  │     │     └─> emit('exercise:loaded', {exerciseJSON})
  │     │
  │     ├─> UIManager receives 'exercise:loaded'
  │     │     │
  │     │     ├─> NotationRenderer.render(exerciseJSON)
  │     │     │     └─> emit('render:complete', {noteCount})
  │     │     │
  │     │     ├─> PlaybackEngine.init(exerciseJSON.timeline)
  │     │     └─> Storage.set('lastExercise', exerciseJSON.id)
  │     │
  │     └─> UIManager updates UI state
  │
User clicks "Play"
  │
  ├─> UIManager.onPlayClick()
  │     │
  │     ├─> PlaybackEngine.play()
  │     │     │
  │     │     ├─> emit('playback:started', {startTime})
  │     │     ├─> Schedule all note events
  │     │     └─> Start emitting 'playback:tick' events
  │     │
  │     ├─> NotationRenderer receives 'playback:tick'
  │     │     └─> highlightNotes([noteId])
  │     │
  │     └─> Audio synthesis plays note
```

**Example 2: Real-Time Pitch Detection and Analysis**

```
User enables microphone
  │
  ├─> UIManager.startPracticeMode()
  │     │
  │     ├─> PitchDetector.start(stream)
  │     │     └─> emit('detector:started')
  │     │
  │     └─> PolyphonicDetector.start(audioContext, stream)
  │           └─> emit('poly:started')
  │
Continuous pitch detection
  │
  ├─> PitchDetector emits 'pitch:detected'
  │     │
  │     └─> Analyzer receives detected pitch
  │           │
  │           ├─> Compare with reference timeline
  │           ├─> Calculate per-note results
  │           └─> emit('analysis:complete', {result})
  │
UIManager receives 'analysis:complete'
  │
  ├─> Extract per-note results
  ├─> NotationRenderer.highlightNotes(correctNotes, 'correct')
  ├─> NotationRenderer.highlightNotes(incorrectNotes, 'incorrect')
  └─> Update score display
```

---

## 6. Data Flow Pipelines

### 6.1 Exercise Loading Pipeline

```
MusicXML File
  │
  ├─> ExerciseLoader.loadFromFile()
  │     │
  │     ├─> Read file content
  │     ├─> Parse XML with DOMParser
  │     ├─> Extract metadata (title, tempo, time signature)
  │     ├─> Parse part structure
  │     │     │
  │     │     ├─> Identify staff 1 (notation) and staff 2 (tablature)
  │     │     ├─> Extract note elements from measures
  │     │     └─> Handle backup/forward elements for voice management
  │     │
  │     ├─> Build timeline
  │     │     │
  │     │     ├─> Convert divisions to milliseconds
  │     │     ├─> Calculate absolute timestamps
  │     │     ├─> Extract pitch data (step, octave, alter)
  │     │     ├─> Convert to MIDI note numbers
  │     │     ├─> Extract tablature data (string, fret)
  │     │     └─> Assign unique note IDs
  │     │
  │     ├─> Separate OSMD inputs
  │     │     │
  │     │     ├─> Clone XML for notation (keep staff 1)
  │     │     ├─> Clone XML for tablature (keep staff 2)
  │     │     └─> Serialize to strings
  │     │
  │     └─> Return ExerciseJSON
  │
  ├─> Storage.set('exerciseCache:' + id, exerciseJSON)
  │
  └─> Emit 'exercise:loaded' event
```

### 6.2 Notation Rendering Pipeline

```
ExerciseJSON
  │
  ├─> NotationRenderer.render(exercise)
  │     │
  │     ├─> Create OSMD instance for notation
  │     │     │
  │     │     ├─> Load exercise.osmdNotation string
  │     │     ├─> Configure rendering options
  │     │     └─> Render to notation container SVG
  │     │
  │     ├─> Create OSMD instance for tablature
  │     │     │
  │     │     ├─> Load exercise.osmdTab string
  │     │     ├─> Configure rendering options
  │     │     └─> Render to tablature container SVG
  │     │
  │     ├─> Post-process SVG elements
  │     │     │
  │     │     ├─> Query all note group elements
  │     │     ├─> Match to timeline notes by pitch + timestamp
  │     │     ├─> Add data-note-id attributes
  │     │     └─> Build noteElementMap
  │     │
  │     └─> Emit 'render:complete' event
  │
  └─> UI displays dual notation views
```

### 6.3 Playback Pipeline

```
Timeline + PlaybackConfig
  │
  ├─> PlaybackEngine.play()
  │     │
  │     ├─> Initialize Tone.Transport
  │     ├─> Set BPM from config
  │     │
  │     ├─> Schedule all note events
  │     │     │
  │     │     ├─> Convert timeline timestamps to Transport time
  │     │     ├─> For each note:
  │     │     │     │
  │     │     │     ├─> Schedule tick event emission
  │     │     │     ├─> Schedule audio synthesis/sample
  │     │     │     └─> Track system number for scrolling
  │     │     │
  │     │     └─> Start Transport
  │     │
  │     ├─> Emit 'playback:started' event
  │     │
  │     └─> Begin tick event loop
  │           │
  │           ├─> At each note onset:
  │           │     │
  │           │     ├─> Emit 'playback:tick' with noteId
  │           │     ├─> Check for system change
  │           │     │     └─> Emit 'playback:systemChange' if needed
  │           │     │
  │           │     └─> Trigger audio output
  │           │           │
  │           │           ├─> If synth mode: Tone.Synth.triggerAttackRelease()
  │           │           └─> If sample mode: Tone.Player.start()
  │           │
  │           └─> On completion:
  │                 └─> Emit 'playback:completed' event
  │
  ├─> NotationRenderer receives 'playback:tick'
  │     │
  │     ├─> Get note element from noteElementMap
  │     ├─> Add 'active' CSS class
  │     ├─> Remove 'active' from previous note
  │     └─> Check if scrolling needed
  │           │
  │           ├─> Calculate note vertical position
  │           ├─> If below viewport threshold:
  │           │     └─> Scroll both notation and tab containers
  │           └─> Apply smooth scrolling animation
  │
  └─> Audio output synchronized with visual feedback
```

### 6.4 Pitch Detection Pipeline (Monophonic)

```
Microphone Audio Stream
  │
  ├─> Web Audio API AudioContext
  │     │
  │     ├─> Create MediaStreamSource from microphone
  │     ├─> Connect to AnalyserNode
  │     └─> Configure FFT size and smoothing
  │
  ├─> AudioWorklet (or ScriptProcessorNode fallback)
  │     │
  │     ├─> Receive time-domain audio buffer
  │     │
  │     ├─> Pre-processing
  │     │     │
  │     │     ├─> Calculate RMS amplitude
  │     │     ├─> Apply noise gate (reject if below threshold)
  │     │     ├─> Remove DC offset
  │     │     └─> Apply high-pass filter (60Hz cutoff)
  │     │
  │     ├─> YIN Algorithm
  │     │     │
  │     │     ├─> Calculate difference function d(tau)
  │     │     ├─> Calculate cumulative mean normalized difference d'(tau)
  │     │     ├─> Find first minimum below threshold
  │     │     ├─> Apply parabolic interpolation
  │     │     └─> Convert tau to frequency
  │     │
  │     ├─> Confidence scoring
  │     │     │
  │     │     ├─> Evaluate autocorrelation peak clarity
  │     │     ├─> Check harmonic-to-noise ratio
  │     │     └─> Calculate confidence (0.0-1.0)
  │     │
  │     ├─> Pitch conversion
  │     │     │
  │     │     ├─> Convert frequency to MIDI note
  │     │     ├─> Calculate cents deviation
  │     │     └─> Determine note name
  │     │
  │     └─> Output PitchStream event
  │           │
  │           └─> Emit 'pitch:detected' event
  │
  ├─> PitchDetector emits event
  │
  └─> Consumers receive pitch data
        │
        ├─> Analyzer (for performance analysis)
        ├─> Tuner (for tuning display)
        └─> UI Manager (for real-time feedback)
```

### 6.5 Polyphonic Detection Pipeline

```
Microphone Audio Stream
  │
  ├─> Web Audio API AudioContext
  │     │
  │     ├─> Create MediaStreamSource
  │     ├─> Connect to ScriptProcessorNode (4096 buffer)
  │     └─> Buffer audio chunks (8 seconds for model input)
  │
  ├─> Audio Preprocessing
  │     │
  │     ├─> Accumulate samples into chunk buffer
  │     ├─> Check if chunk complete (8 seconds)
  │     ├─> Resample to 16kHz if needed
  │     ├─> Normalize amplitude to [-1, 1]
  │     └─> Convert to Float32Array
  │
  ├─> Web Worker (inference thread)
  │     │
  │     ├─> Receive audio chunk via postMessage
  │     │
  │     ├─> TensorFlow.js Model Inference
  │     │     │
  │     │     ├─> Convert audio to tensor
  │     │     ├─> Run model.executeAsync()
  │     │     ├─> Parse output tensors
  │     │     │     │
  │     │     │     ├─> Onset activations (note attacks)
  │     │     │     ├─> Frame activations (sustained notes)
  │     │     │     └─> Velocity estimates
  │     │     │
  │     │     └─> Post-process model output
  │     │           │
  │     │           ├─> Apply confidence threshold (0.5)
  │     │           ├─> Convert activations to MIDI notes
  │     │           ├─> Remove duplicates in time window
  │     │           └─> Associate timestamps
  │     │
  │     └─> Return results to main thread
  │
  ├─> PolyphonicDetector receives results
  │     │
  │     ├─> Format as PitchStream event (polyphonic type)
  │     └─> Emit 'poly:detected' event
  │
  └─> Consumers receive polyphonic data
        │
        ├─> Analyzer (merge with monophonic stream)
        └─> UI Manager (for chord feedback)
```

### 6.6 Performance Analysis Pipeline

```
Reference Timeline + Detected PitchStream
  │
  ├─> Analyzer.analyze(timeline, pitchStream)
  │     │
  │     ├─> Preprocess inputs
  │     │     │
  │     │     ├─> Extract reference note sequence
  │     │     ├─> Extract detected note sequence
  │     │     └─> Validate both sequences non-empty
  │     │
  │     ├─> Dynamic Time Warping
  │     │     │
  │     │     ├─> Build cost matrix (ref × detected)
  │     │     │     │
  │     │     │     ├─> For each cell (i, j):
  │     │     │     │     │
  │     │     │     │     ├─> Calculate pitch distance
  │     │     │     │     ├─> Calculate timing distance
  │     │     │     │     ├─> Combine: cost = α*pitch + β*timing
  │     │     │     │     └─> Add to cumulative path cost
  │     │     │     │
  │     │     │     └─> Fill entire matrix
  │     │     │
  │     │     ├─> Backtrack from bottom-right to top-left
  │     │     │     │
  │     │     │     ├─> Follow minimum cost path
  │     │     │     └─> Build alignment mapping
  │     │     │
  │     │     └─> Output note correspondences
  │     │
  │     ├─> Per-Note Evaluation
  │     │     │
  │     │     ├─> For each reference note:
  │     │     │     │
  │     │     │     ├─> Find corresponding detected note (via DTW)
  │     │     │     │
  │     │     │     ├─> If no correspondence:
  │     │     │     │     └─> Classify as MISSED
  │     │     │     │
  │     │     │     ├─> If correspondence exists:
  │     │     │     │     │
  │     │     │     │     ├─> Calculate pitch deviation (semitones)
  │     │     │     │     ├─> Calculate timing deviation (milliseconds)
  │     │     │     │     │
  │     │     │     │     ├─> Check pitch correctness
  │     │     │     │     │     └─> Within tolerance? → pitchCorrect = true/false
  │     │     │     │     │
  │     │     │     │     ├─> Check timing correctness
  │     │     │     │     │     └─> Within tolerance? → timingCorrect = true/false
  │     │     │     │     │
  │     │     │     │     └─> Classify note:
  │     │     │     │           │
  │     │     │     │           ├─> Both correct → CORRECT
  │     │     │     │           ├─> Pitch wrong, timing OK → WRONG_PITCH
  │     │     │     │           ├─> Pitch OK, timing wrong → WRONG_TIMING
  │     │     │     │           └─> Both wrong → WRONG_PITCH (prioritize pitch)
  │     │     │     │
  │     │     │     └─> Store per-note result
  │     │     │
  │     │     └─> Identify extra detections (no reference match)
  │     │
  │     ├─> Aggregate Scoring
  │     │     │
  │     │     ├─> Count classifications
  │     │     │     │
  │     │     │     ├─> notesCorrect = count(CORRECT)
  │     │     │     ├─> notesMissed = count(MISSED)
  │     │     │     ├─> notesWrongPitch = count(WRONG_PITCH)
  │     │     │     ├─> notesWrongTiming = count(WRONG_TIMING)
  │     │     │     └─> notesExtra = count(EXTRA)
  │     │     │
  │     │     ├─> Calculate correctness percentage
  │     │     │     └─> (notesCorrect / totalNotes) * 100
  │     │     │
  │     │     ├─> Calculate timing metrics
  │     │     │     │
  │     │     │     ├─> Average deviation = mean(|timingDeviations|)
  │     │     │     └─> Consistency score = 100 - (stddev / maxDev * 100)
  │     │     │
  │     │     └─> Build aggregate result object
  │     │
  │     ├─> Build AnalysisResult structure
  │     │     │
  │     │     ├─> Include aggregate metrics
  │     │     ├─> Include per-note results array
  │     │     └─> Add metadata (exerciseId, timestamp, tolerances)
  │     │
  │     └─> Emit 'analysis:complete' event with result
  │
  ├─> UIManager receives analysis result
  │     │
  │     ├─> Extract per-note classifications
  │     │
  │     ├─> Update notation highlighting
  │     │     │
  │     │     ├─> Correct notes → green highlight
  │     │     ├─> Wrong pitch → red highlight with pitch annotation
  │     │     ├─> Wrong timing → orange highlight with timing arrow
  │     │     └─> Missed notes → gray highlight
  │     │
  │     ├─> Update score display
  │     │     │
  │     │     ├─> Show correctness percentage
  │     │     ├─> Show note counts breakdown
  │     │     └─> Show timing consistency score
  │     │
  │     └─> Store result in performance history
  │           └─> Storage.set('perfHistory', updatedHistory)
  │
  └─> User sees real-time feedback and final score
```

### 6.7 Tuner Display Pipeline

```
Microphone Audio Stream
  │
  ├─> PitchDetector (dedicated tuner mode)
  │     │
  │     └─> Emit 'pitch:detected' events at high rate (60Hz)
  │
  ├─> Tuner.onPitchDetected(pitchEvent)
  │     │
  │     ├─> Apply exponential smoothing
  │     │     │
  │     │     ├─> smoothedFreq = α * current + (1-α) * previous
  │     │     └─> smoothedCents = α * currentCents + (1-α) * previousCents
  │     │
  │     ├─> Calculate display values
  │     │     │
  │     │     ├─> Nearest MIDI note from smoothed frequency
  │     │     ├─> Note name with accidentals (e.g., "E♭4")
  │     │     ├─> Cents deviation from nearest note
  │     │     └─> Frequency display (XXX.X Hz)
  │     │
  │     ├─> Determine color zone
  │     │     │
  │     │     ├─> If |cents| <= 5: green (IN_TUNE)
  │     │     ├─> If |cents| <= 20: orange (CLOSE)
  │     │     └─> If |cents| > 20: red (OUT_TUNE)
  │     │
  │     ├─> Calculate needle angle
  │     │     │
  │     │     ├─> Map cents (-50 to +50) to angle (-45° to +45°)
  │     │     └─> angle = (cents / 50) * 45
  │     │
  │     └─> Emit 'tuner:update' event
  │           │
  │           └─> { frequency, noteName, cents, color, angle, confidence }
  │
  ├─> UI receives 'tuner:update' event
  │     │
  │     ├─> Update frequency display: "440.0 Hz"
  │     ├─> Update note name display: "A4"
  │     ├─> Update cents display: "+0 cents"
  │     ├─> Update needle rotation: transform: rotate(0deg)
  │     ├─> Update color indicators: background-color: green
  │     └─> Update with smooth transitions (CSS animations)
  │
  └─> User sees real-time tuning feedback
```

---

## 7. Error Handling Strategy

### 7.1 Error Categories

**Category 1: User Input Errors**
- Invalid file format (not MusicXML)
- Malformed XML structure
- Unsupported MusicXML features
- File too large (> 5MB)

**Handling Strategy**:
- Validate input before processing
- Display user-friendly error messages
- Suggest corrective actions
- Never crash application

**Category 2: Resource Unavailability**
- Magenta model files missing
- Audio samples not loaded
- Microphone permission denied
- Insufficient memory

**Handling Strategy**:
- Detect unavailability early
- Graceful degradation to fallback features
- Display clear status indicators
- Provide retry mechanisms

**Category 3: Runtime Exceptions**
- Audio context suspended unexpectedly
- OSMD rendering failures
- Web Audio API errors
- Pitch detection algorithm failures

**Handling Strategy**:
- Wrap critical operations in try-catch
- Emit error events rather than throwing
- Log detailed errors for debugging
- Maintain application stability

**Category 4: Performance Issues**
- Browser memory exhaustion
- CPU overload causing lag
- Storage quota exceeded
- Audio buffer underruns

**Handling Strategy**:
- Monitor resource usage proactively
- Warn users before limits reached
- Adjust processing parameters dynamically
- Provide manual optimization controls

### 7.2 Module-Specific Error Handling

**ExerciseLoader**:
```javascript
async parseXML(xmlContent) {
  try {
    // Validate input
    if (!xmlContent || typeof xmlContent !== 'string') {
      throw new Error('Invalid XML content: must be non-empty string');
    }
    
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    
    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error(`XML parse error: ${parserError.textContent}`);
    }
    
    // Validate required elements
    const scorePartwise = xmlDoc.querySelector('score-partwise');
    if (!scorePartwise) {
      throw new Error('Invalid MusicXML: missing score-partwise element');
    }
    
    // Continue parsing...
    
  } catch (error) {
    this.emit('exercise:error', {
      error: error.message,
      type: 'parse',
      recoverable: false
    });
    throw error;  // Re-throw for caller handling
  }
}
```

**NotationRenderer**:
```javascript
async render(exercise) {
  try {
    // Attempt notation rendering
    await this.renderNotation(exercise.osmdNotation);
  } catch (error) {
    console.error('Notation rendering failed:', error);
    this.emit('render:error', {
      error: error.message,
      stage: 'notation',
      fallback: 'single-view'
    });
    // Continue without notation view (tablature only)
  }
  
  try {
    // Attempt tablature rendering
    await this.renderTablature(exercise.osmdTab);
  } catch (error) {
    console.error('Tablature rendering failed:', error);
    this.emit('render:error', {
      error: error.message,
      stage: 'tablature',
      fallback: 'notation-only'
    });
    // Continue without tablature view
  }
  
  // Validate at least one view succeeded
  if (!this.notationRendered && !this.tabRendered) {
    throw new Error('Both notation and tablature rendering failed');
  }
}
```

**PlaybackEngine**:
```javascript
play(offsetMs = 0) {
  try {
    // Check audio context state
    if (Tone.context.state === 'suspended') {
      throw new Error('Audio context suspended - user activation required');
    }
    
    // Validate timeline exists
    if (!this.timeline || this.timeline.length === 0) {
      throw new Error('No timeline loaded - load exercise first');
    }
    
    // Start playback
    Tone.Transport.start('+0', offsetMs / 1000);
    this.state = PlaybackState.PLAYING;
    this.emit('playback:started', { startTime: Date.now(), offsetMs });
    
  } catch (error) {
    this.emit('playback:error', {
      error: error.message,
      state: this.state,
      recoverable: error.message.includes('suspended')
    });
    
    // Don't re-throw - maintain application stability
  }
}
```

**PolyphonicDetector**:
```javascript
async loadModel() {
  try {
    this.emit('poly:modelLoading', { percent: 0 });
    
    // Attempt model load with timeout
    const model = await Promise.race([
      tf.loadGraphModel(this.modelPath),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Model load timeout')), 30000)
      )
    ]);
    
    this.model = model;
    this.modelLoaded = true;
    this.emit('poly:modelLoaded', { modelInfo: model.modelSignature });
    
  } catch (error) {
    console.error('Polyphonic model load failed:', error);
    
    this.emit('poly:modelError', {
      error: error.message,
      fallbackMode: 'monophonic-only'
    });
    
    // Set flag for graceful degradation
    this.modelLoaded = false;
    this.fallbackToMonophonic = true;
    
    // Application continues in monophonic mode
  }
}

start(audioContext, stream) {
  if (!this.modelLoaded) {
    console.warn('Polyphonic detection unavailable - using monophonic fallback');
    // Redirect to monophonic detector
    return;
  }
  
  // Continue with polyphonic detection
}
```

**Storage**:
```javascript
set(key, value) {
  try {
    const wrapped = this.wrapData(value);
    const serialized = JSON.stringify(wrapped);
    
    // Check size before storing
    if (serialized.length > 5 * 1024 * 1024) {  // 5MB limit per key
      throw new Error('Data too large for single key');
    }
    
    localStorage.setItem(this.namespace + key, serialized);
    return true;
    
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      this.handleQuotaExceeded();
      this.emit('storage:quotaExceeded', {
        usage: this.getStorageUsage(),
        limit: this.getStorageLimit(),
        recommendation: 'Clear old performance history'
      });
    } else {
      console.error('Storage error:', error);
      this.emit('storage:error', {
        error: error.message,
        key,
        operation: 'set'
      });
    }
    return false;
  }
}

handleQuotaExceeded() {
  // Attempt to free space by removing oldest history entries
  const historyKey = this.namespace + STORAGE_KEYS.PERFORMANCE_HISTORY;
  try {
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    if (history.length > 10) {
      // Keep only 10 most recent entries
      const trimmed = history.slice(-10);
      localStorage.setItem(historyKey, JSON.stringify(trimmed));
      console.log('Trimmed performance history to free storage space');
    }
  } catch (e) {
    console.error('Failed to free storage space:', e);
  }
}
```

### 7.3 Graceful Degradation Matrix

| Feature | Primary Implementation | Fallback 1 | Fallback 2 | User Impact |
|---------|----------------------|-----------|-----------|-------------|
| **Polyphonic Detection** | Magenta Onsets & Frames | Monophonic YIN only | Manual note entry | Chord exercises require multiple plays |
| **AudioWorklet** | Low-latency audio processing | ScriptProcessorNode | No real-time detection | Higher latency (100-200ms) |
| **OSMD Rendering** | Dual notation + tab | Single view only | Text-based timeline | Reduced visual feedback |
| **Sample Playback** | Audio sample files | Tone.js synthesis | No audio playback | Synthesized sound quality |
| **LocalStorage** | Persistent settings | In-memory session storage | No persistence | Settings lost on refresh |
| **Web Audio API** | Full pitch detection | No real-time analysis | Playback only mode | No performance feedback |

### 7.4 Error Logging and Reporting

**Console Logging Strategy**:
```javascript
// src/utils/logger.js
class Logger {
  static ERROR = 'error';
  static WARN = 'warn';
  static INFO = 'info';
  static DEBUG = 'debug';
  
  static log(level, module, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      module,
      message,
      data
    };
    
    // Console output
    const consoleMethod = console[level] || console.log;
    consoleMethod(`[${timestamp}] [${module}] ${message}`, data);
    
    // Store critical errors for reporting
    if (level === Logger.ERROR) {
      this.storeError(logEntry);
    }
  }
  
  static storeError(logEntry) {
    const errors = JSON.parse(localStorage.getItem('g4:errors') || '[]');
    errors.push(logEntry);
    
    // Keep only last 50 errors
    const trimmed = errors.slice(-50);
    localStorage.setItem('g4:errors', JSON.stringify(trimmed));
  }
  
  static getErrors() {
    return JSON.parse(localStorage.getItem('g4:errors') || '[]');
  }
  
  static clearErrors() {
    localStorage.removeItem('g4:errors');
  }
}
```

**Usage in Modules**:
```javascript
// In any module
import { Logger } from '../utils/logger.js';

try {
  // Critical operation
} catch (error) {
  Logger.log(Logger.ERROR, 'ExerciseLoader', 'Failed to parse XML', {
    error: error.message,
    stack: error.stack,
    file: fileName
  });
  
  this.emit('exercise:error', { error: error.message });
}
```

---

## 8. Performance Architecture

### 8.1 Latency Budget

**Target: Total audio input to visual feedback ≤ 80ms**

| Stage | Target Latency | Optimization Strategy |
|-------|---------------|----------------------|
| **Audio capture (Web Audio)** | 10-20ms | Use AudioWorklet, minimize buffer size |
| **Pitch detection (YIN)** | <30ms | Optimize inner loops, use typed arrays |
| **Event emission** | <5ms | Minimize event payload size |
| **Analysis (DTW)** | <50ms | Run asynchronously, use efficient algorithm |
| **Visual update (DOM)** | <20ms | Use CSS classes, minimize reflows |
| **Total** | **≤80ms** | Monitor with Performance API |

### 8.2 Memory Management

**Memory Budget**:
- Base application: 50MB
- OSMD instances: 20MB per exercise
- Magenta model: 150MB
- Audio buffers: 10MB
- Cached exercises: 10MB each
- **Total target**: <300MB

**Memory Optimization Techniques**:

**1. Object Pooling**:
```javascript
// Pool for pitch event objects
class PitchEventPool {
  constructor(size = 100) {
    this.pool = [];
    for (let i = 0; i < size; i++) {
      this.pool.push(this.createEvent());
    }
    this.nextIndex = 0;
  }
  
  createEvent() {
    return {
      type: '',
      timestamp: 0,
      frequency: 0,
      midi: 0,
      cents: 0,
      confidence: 0
    };
  }
  
  acquire() {
    if (this.pool.length === 0) {
      return this.createEvent();
    }
    return this.pool.pop();
  }
  
  release(event) {
    // Reset properties
    event.type = '';
    event.timestamp = 0;
    event.frequency = 0;
    event.midi = 0;
    event.cents = 0;
    event.confidence = 0;
    
    this.pool.push(event);
  }
}
```

**2. OSMD Instance Cleanup**:
```javascript
// In NotationRenderer
clear() {
  // Release OSMD instances
  if (this.osmdNotation) {
    this.osmdNotation.clear();
    this.osmdNotation = null;
  }
  
  if (this.osmdTab) {
    this.osmdTab.clear();
    this.osmdTab = null;
  }
  
  // Clear element map
  this.noteElementMap.clear();
  
  // Force garbage collection hint
  if (global.gc) {
    global.gc();
  }
}
```

**3. Audio Buffer Management**:
```javascript
// In PitchDetector
stop() {
  // Disconnect audio nodes
  if (this.analyserNode) {
    this.analyserNode.disconnect();
    this.analyserNode = null;
  }
  
  if (this.sourceNode) {
    this.sourceNode.disconnect();
    this.sourceNode = null;
  }
  
  // Release audio buffers
  this.audioBuffer = null;
  this.frequencyData = null;
}
```

**4. Performance History Pruning**:
```javascript
// In Storage module
const MAX_HISTORY_ENTRIES = 100;

addPerformanceResult(result) {
  let history = this.get(STORAGE_KEYS.PERFORMANCE_HISTORY, []);
  
  history.push(result);
  
  // Circular buffer: keep only recent entries
  if (history.length > MAX_HISTORY_ENTRIES) {
    history = history.slice(-MAX_HISTORY_ENTRIES);
  }
  
  this.set(STORAGE_KEYS.PERFORMANCE_HISTORY, history);
}
```

### 8.3 CPU Optimization

**Target CPU Usage**:
- Idle: <5%
- Pitch detection active: <25%
- Playback with synthesis: <15%
- Combined (playback + detection + analysis): <40%

**Optimization Techniques**:

**1. Audio Processing in Separate Thread**:
```javascript
// Use AudioWorklet for pitch detection
class PitchDetectorWorklet extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    
    const samples = input[0];
    
    // YIN algorithm runs in audio thread
    const frequency = this.detectPitch(samples);
    
    // Post result to main thread
    this.port.postMessage({ frequency, timestamp: currentTime });
    
    return true;
  }
  
  detectPitch(samples) {
    // Optimized YIN implementation
    // Use Float32Array for performance
    // Minimize allocations in hot path
  }
}
```

**2. Throttle Visual Updates**:
```javascript
// In UIManager
class UIManager {
  constructor() {
    this.lastRenderTime = 0;
    this.renderThrottle = 16;  // ~60fps
  }
  
  onPlaybackTick(tickData) {
    const now = performance.now();
    
    // Throttle to 60fps max
    if (now - this.lastRenderTime < this.renderThrottle) {
      return;
    }
    
    this.lastRenderTime = now;
    this.updateCursor(tickData.noteId);
  }
}
```

**3. Debounce Heavy Operations**:
```javascript
// In NotationRenderer
class NotationRenderer {
  constructor() {
    this.resizeTimeout = null;
  }
  
  onResize() {
    clearTimeout(this.resizeTimeout);
    
    this.resizeTimeout = setTimeout(() => {
      this.rerender();
    }, 250);  // Debounce by 250ms
  }
}
```

**4. Use RequestAnimationFrame**:
```javascript
// In Tuner
class Tuner {
  update(pitchData) {
    // Queue update for next animation frame
    if (!this.updatePending) {
      this.updatePending = true;
      requestAnimationFrame(() => {
        this.render(pitchData);
        this.updatePending = false;
      });
    }
  }
}
```

### 8.4 Rendering Optimization

**Progressive Rendering for Large Scores**:
```javascript
// In NotationRenderer
async renderProgressive(exercise) {
  const systemsPerBatch = 3;
  const systems = this.calculateSystems(exercise);
  
  for (let i = 0; i < systems.length; i += systemsPerBatch) {
    const batch = systems.slice(i, i + systemsPerBatch);
    
    // Render batch
    await this.renderSystems(batch);
    
    // Emit progress
    this.emit('render:progress', {
      percent: ((i + systemsPerBatch) / systems.length) * 100,
      systemNumber: i + systemsPerBatch
    });
    
    // Yield to main thread
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
```

**Virtual Scrolling**:
```javascript
// Render only visible systems
class NotationRenderer {
  updateVisibleSystems() {
    const viewportTop = this.container.scrollTop;
    const viewportBottom = viewportTop + this.container.clientHeight;
    
    this.systems.forEach((system, index) => {
      const systemTop = system.offsetTop;
      const systemBottom = systemTop + system.offsetHeight;
      
      const isVisible = systemBottom >= viewportTop && systemTop <= viewportBottom;
      
      if (isVisible && !system.rendered) {
        this.renderSystem(index);
        system.rendered = true;
      } else if (!isVisible && system.rendered) {
        // Optionally unrender to save memory
        this.unrenderSystem(index);
        system.rendered = false;
      }
    });
  }
}
```

**Minimize Layout Thrashing**:
```javascript
// Batch DOM reads and writes
class NotationRenderer {
  highlightNotes(noteIds) {
    // Read phase (batch all reads)
    const elements = noteIds.map(id => ({
      id,
      element: this.noteElementMap.get(id)
    }));
    
    // Write phase (batch all writes)
    requestAnimationFrame(() => {
      elements.forEach(({ element }) => {
        if (element) {
          element.classList.add('active');
        }
      });
    });
  }
}
```

### 8.5 Performance Monitoring

**Latency Measurement**:
```javascript
// src/utils/performanceMonitor.js
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      pitchDetectionLatency: [],
      analysisLatency: [],
      renderLatency: [],
      totalLatency: []
    };
  }
  
  startMeasurement(label) {
    performance.mark(`${label}-start`);
  }
  
  endMeasurement(label) {
    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);
    
    const measure = performance.getEntriesByName(label)[0];
    this.recordMetric(label, measure.duration);
    
    // Cleanup
    performance.clearMarks(`${label}-start`);
    performance.clearMarks(`${label}-end`);
    performance.clearMeasures(label);
    
    return measure.duration;
  }
  
  recordMetric(label, value) {
    if (!this.metrics[label]) {
      this.metrics[label] = [];
    }
    
    this.metrics[label].push(value);
    
    // Keep only last 100 measurements
    if (this.metrics[label].length > 100) {
      this.metrics[label].shift();
    }
  }
  
  getStats(label) {
    const values = this.metrics[label] || [];
    if (values.length === 0) {
      return { avg: 0, min: 0, max: 0, p95: 0 };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index];
    
    return { avg, min, max, p95 };
  }
  
  logStats() {
    console.group('Performance Statistics');
    Object.keys(this.metrics).forEach(label => {
      const stats = this.getStats(label);
      console.log(`${label}:`, stats);
    });
    console.groupEnd();
  }
}

export const performanceMonitor = new PerformanceMonitor();
```

**Usage in Modules**:
```javascript
// In PitchDetector
import { performanceMonitor } from '../utils/performanceMonitor.js';

onAudioProcess(audioData) {
  performanceMonitor.startMeasurement('pitchDetection');
  
  const frequency = this.yinAlgorithm(audioData);
  
  const latency = performanceMonitor.endMeasurement('pitchDetection');
  
  // Warn if exceeding target
  if (latency > 30) {
    console.warn(`Pitch detection latency high: ${latency.toFixed(2)}ms`);
  }
}
```

---

## 9. Testing Architecture

### 9.1 Test Pyramid Structure

```
         ╱╲
        ╱  ╲         E2E Tests (10%)
       ╱────╲        - Critical user workflows
      ╱      ╲       - Browser automation
     ╱────────╲      - Headful for audio/visual
    ╱          ╲     
   ╱────────────╲    Integration Tests (30%)
  ╱              ╲   - Module communication
 ╱────────────────╲  - Data flow pipelines
╱__________________╲ Unit Tests (60%)
                     - Pure functions
                     - Module APIs
                     - Edge cases
```

### 9.2 Unit Testing Strategy

**Test Framework**: Node.js built-in test runner

**File Structure**:
```
src/tests/unit/
├── exerciseLoader.test.js
├── playbackEngine.test.js
├── pitchDetector.test.js
├── analyzer.test.js
├── storage.test.js
├── tuner.test.js
└── utils.test.js
```

**Example Unit Test**:
```javascript
// src/tests/unit/exerciseLoader.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { ExerciseLoader } from '../../core/exerciseLoader.js';
import { readFileSync } from 'node:fs';

test('ExerciseLoader - parses Twinkle Twinkle XML', async () => {
  const loader = new ExerciseLoader();
  const xmlContent = readFileSync('assets/exercises/twinkle2.xml', 'utf8');
  
  const exercise = await loader.parseXML(xmlContent);
  
  // Validate structure
  assert.ok(exercise.id, 'Exercise has ID');
  assert.strictEqual(exercise.title, 'Twinkle Twinkle Little Star');
  assert.ok(exercise.timeline.length > 0, 'Timeline has notes');
  
  // Validate first note
  const firstNote = exercise.timeline[0];
  assert.strictEqual(firstNote.pitch.step, 'C');
  assert.strictEqual(firstNote.pitch.octave, 4);
  assert.strictEqual(firstNote.staff, 1);
  
  // Validate separation
  assert.ok(exercise.osmdNotation.includes('staff="1"'));
  assert.ok(!exercise.osmdNotation.includes('staff="2"'));
  assert.ok(exercise.osmdTab.includes('staff="2"'));
});

test('ExerciseLoader - handles malformed XML', async () => {
  const loader = new ExerciseLoader();
  const invalidXML = '<invalid>not musicxml</invalid>';
  
  await assert.rejects(
    async () => await loader.parseXML(invalidXML),
    { message: /Invalid MusicXML/ }
  );
});

test('ExerciseLoader - timeline sorted by timestamp', async () => {
  const loader = new ExerciseLoader();
  const xmlContent = readFileSync('assets/exercises/twinkle2.xml', 'utf8');
  
  const exercise = await loader.parseXML(xmlContent);
  
  // Verify chronological order
  for (let i = 1; i < exercise.timeline.length; i++) {
    assert.ok(
      exercise.timeline[i].timestamp >= exercise.timeline[i - 1].timestamp,
      'Timeline must be sorted by timestamp'
    );
  }
});
```

**Test Coverage Target**: ≥80% for core modules

**Coverage Command**:
```bash
npm test -- --experimental-test-coverage
```

### 9.3 Integration Testing Strategy

**Test Framework**: Node.js test runner with module mocking

**Example Integration Test**:
```javascript
// src/tests/integration/loadAndRender.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { ExerciseLoader } from '../../core/exerciseLoader.js';
import { NotationRenderer } from '../../core/notationRenderer.js';
import { JSDOM } from 'jsdom';

test('Integration - load exercise and render notation', async () => {
  // Setup DOM environment
  const dom = new JSDOM('<!DOCTYPE html><div id="notation"></div><div id="tab"></div>');
  global.document = dom.window.document;
  
  // Load exercise
  const loader = new ExerciseLoader();
  const xmlContent = readFileSync('assets/exercises/twinkle2.xml', 'utf8');
  const exercise = await loader.parseXML(xmlContent);
  
  // Render notation
  const notationContainer = document.getElementById('notation');
  const tabContainer = document.getElementById('tab');
  const renderer = new NotationRenderer(notationContainer, tabContainer);
  
  const renderResult = await renderer.render(exercise);
  
  // Validate rendering
  assert.ok(renderResult.success, 'Rendering succeeded');
  assert.strictEqual(renderResult.noteCount, exercise.timeline.length);
  
  // Validate DOM element mapping
  const firstNoteId = exercise.timeline[0].id;
  const noteElement = renderer.getNoteElement(firstNoteId);
  assert.ok(noteElement, 'Note element found in DOM');
  assert.strictEqual(noteElement.dataset.noteId, firstNoteId);
});

test('Integration - playback engine emits tick events', async (t) => {
  const { PlaybackEngine } = await import('../../core/playbackEngine.js');
  
  const mockTimeline = [
    { id: 'n1', timestamp: 0, duration: 500, midi: 60 },
    { id: 'n2', timestamp: 500, duration: 500, midi: 62 },
    { id: 'n3', timestamp: 1000, duration: 500, midi: 64 }
  ];
  
  const engine = new PlaybackEngine(mockTimeline, { bpm: 120 });
  
  const tickEvents = [];
  engine.on('playback:tick', (data) => {
    tickEvents.push(data);
  });
  
  await engine.play();
  
  // Wait for playback to complete
  await new Promise(resolve => {
    engine.on('playback:completed', resolve);
  });
  
  // Validate tick events emitted
  assert.strictEqual(tickEvents.length, 3, 'All notes triggered');
  assert.strictEqual(tickEvents[0].noteId, 'n1');
  assert.strictEqual(tickEvents[1].noteId, 'n2');
  assert.strictEqual(tickEvents[2].noteId, 'n3');
});
```

### 9.4 End-to-End Testing Strategy

**Test Framework**: Playwright

**Configuration**:
```javascript
// playwright.config.js
export default {
  testDir: './src/tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:8000',
    headless: false,  // Headful for audio/visual tests
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' }
    }
  ]
};
```

**Example E2E Test**:
```javascript
// src/tests/e2e/practice.test.js
import { test, expect } from '@playwright/test';

test.describe('Practice Workflow', () => {
  test('should load exercise and start playback', async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to initialize
    await page.waitForSelector('.app-ready');
    
    // Activate audio context
    await page.click('button[data-action="activate-audio"]');
    await expect(page.locator('.audio-context-status')).toHaveText('Active');
    
    // Load sample exercise
    await page.click('button[data-action="load-sample"]');
    await page.selectOption('select[name="exercise"]', 'twinkle2.xml');
    await page.click('button[data-action="confirm-load"]');
    
    // Wait for rendering to complete
    await page.waitForSelector('.osmd-instance', { timeout: 5000 });
    
    // Verify dual views present
    const osmdInstances = await page.locator('.osmd-instance').count();
    expect(osmdInstances).toBe(2);
    
    // Start playback
    await page.click('button[data-action="play"]');
    
    // Wait for playback to start
    await expect(page.locator('.playback-status')).toHaveText('Playing');
    
    // Verify cursor appears
    await page.waitForSelector('.active-note', { timeout: 2000 });
    const activeNote = await page.locator('.active-note').first();
    expect(activeNote).toBeVisible();
    
    // Verify tick events in console
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    await page.waitForTimeout(2000);  // Let some playback occur
    
    const tickMessages = consoleMessages.filter(msg => msg.includes('playback:tick'));
    expect(tickMessages.length).toBeGreaterThan(0);
  });
  
  test('should display notation with data-note-id attributes', async ({ page }) => {
    await page.goto('/');
    
    // Load exercise
    await page.click('button[data-action="load-sample"]');
    await page.selectOption('select[name="exercise"]', 'twinkle2.xml');
    await page.click('button[data-action="confirm-load"]');
    
    await page.waitForSelector('.osmd-instance');
    
    // Check for data-note-id attributes
    const notesWithIds = await page.locator('[data-note-id]').count();
    expect(notesWithIds).toBeGreaterThan(0);
    
    // Verify first few notes have IDs
    const firstNoteId = await page.locator('[data-note-id]').first().getAttribute('data-note-id');
    expect(firstNoteId).toMatch(/^n\d+$/);
  });
});

test.describe('Tuner Functionality', () => {
  test('should display tuner interface', async ({ page }) => {
    await page.goto('/');
    
    // Switch to tuner tab
    await page.click('button[data-tab="tuner"]');
    
    // Verify tuner elements present
    await expect(page.locator('.tuner-frequency')).toBeVisible();
    await expect(page.locator('.tuner-note-name')).toBeVisible();
    await expect(page.locator('.tuner-cents')).toBeVisible();
    await expect(page.locator('.tuner-needle')).toBeVisible();
  });
  
  // Note: Actual audio testing requires microphone permissions and real audio input
  // This would be a manual test in practice
});
```

**Running E2E Tests**:
```bash
# Run all E2E tests
npx playwright test

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test file
npx playwright test src/tests/e2e/notation.test.js

# Debug mode with Playwright Inspector
npx playwright test --debug
```

### 9.5 Test Data Management

**Sample Exercise Files**:
```
assets/exercises/test/
├── twinkle2.xml              # Simple melody (provided)
├── chord-progression.xml     # Polyphonic test
├── tempo-changes.xml         # Variable tempo
├── malformed.xml             # Invalid XML for error testing
└── large-score.xml           # 200 measures for performance testing
```

**Synthetic Audio Samples**:
```javascript
// src/tests/fixtures/audioSamples.js
export class AudioSampleGenerator {
  static generateSineWave(frequency, duration, sampleRate = 44100) {
    const numSamples = duration * sampleRate;
    const samples = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      samples[i] = Math.sin(2 * Math.PI * frequency * t);
    }
    
    return samples;
  }
  
  static generateChord(frequencies, duration, sampleRate = 44100) {
    const numSamples = duration * sampleRate;
    const samples = new Float32Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sum = 0;
      frequencies.forEach(freq => {
        sum += Math.sin(2 * Math.PI * freq * t);
      });
      samples[i] = sum / frequencies.length;
    }
    
    return samples;
  }
  
  static generateA4() {
    return this.generateSineWave(440, 1.0);  // 1 second A4
  }
}
```

**Mock Objects**:
```javascript
// src/tests/mocks/audioContext.mock.js
export class AudioContextMock {
  constructor() {
    this.state = 'suspended';
    this.sampleRate = 44100;
    this.currentTime = 0;
  }
  
  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      connect: () => {},
      disconnect: () => {},
      getFloatTimeDomainData: (array) => {
        // Fill with synthetic data
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.sin(i * 0.1);
        }
      }
    };
  }
  
  createMediaStreamSource(stream) {
    return {
      connect: () => {},
      disconnect: () => {}
    };
  }
  
  async resume() {
    this.state = 'running';
  }
  
  async suspend() {
    this.state = 'suspended';
  }
}
```

---

## 10. Governance Integration

### 10.1 Development Workflow with Governance

**Before Starting Development**:
1. Run `npm run lint:rules` to validate governance compliance
2. Update `.cline/CLINE_TODO.md` with current task details
3. Create feature branch following naming convention: `feature/milestone-X-module-name`

**During Development**:
1. Follow RULES.md coding standards (ES6+, JSDoc, vanilla JS)
2. Write unit tests alongside implementation (TDD encouraged)
3. Commit frequently with descriptive messages
4. Update documentation as features are added

**After Completing Task**:
1. Run `npm test` to ensure all tests pass
2. Append completion details to `CLINE_MEMORY.md` with timestamp
3. Update `.cline/CLINE_TODO.md` to mark task as complete
4. Create PR with governance checklist

### 10.2 Pre-Commit Hook

**File**: `.cline/governance/hooks/pre-commit`

```bash
#!/bin/bash

echo "🔍 Running pre-commit governance checks..."

# Check if CLINE_TODO.md exists and is accessible
if [ ! -f ".cline/CLINE_TODO.md" ]; then
  echo "❌ Error: .cline/CLINE_TODO.md not found"
  exit 1
fi

# Check if CLINE_MEMORY.md exists
if [ ! -f "CLINE_MEMORY.md" ]; then
  echo "❌ Error: CLINE_MEMORY.md not found"
  exit 1
fi

# Run lint:rules validation
npm run lint:rules --silent
if [ $? -ne 0 ]; then
  echo "❌ Error: Governance validation failed"
  exit 1
fi

# Check for JSDoc comments in new/modified JS files
staged_js_files=$(git diff --cached --name-only --diff-filter=ACM | grep '\.js)
if [ -n "$staged_js_files" ]; then
  for file in $staged_js_files; do
    if ! grep -q '@param\|@returns\|@description' "$file"; then
      echo "⚠️  Warning: $file may be missing JSDoc comments"
    fi
  done
fi

echo "✅ Pre-commit checks passed"
exit 0
```

**Installation**:
```bash
chmod +x .cline/governance/hooks/pre-commit
ln -s ../../.cline/governance/hooks/pre-commit .git/hooks/pre-commit
```

### 10.3 Governance Validation Script

**File**: `scripts/validate-governance.js`

```javascript
#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

class GovernanceValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }
  
  validate() {
    console.log('🔍 Validating RULES.md compliance...\n');
    
    this.checkGovernanceFiles();
    this.checkPreCommitHook();
    this.checkCodingStandards();
    
    this.printResults();
    
    return this.errors.length === 0;
  }
  
  checkGovernanceFiles() {
    const requiredFiles = [
      '.cline/CLINE_TODO.md',
      'CLINE_MEMORY.md',
      'RULES.md',
      'ARCHITECTURE.md'
    ];
    
    requiredFiles.forEach(file => {
      if (!existsSync(file)) {
        this.errors.push(`Missing required file: ${file}`);
      }
    });
    
    if (this.errors.length === 0) {
      console.log('✅ Governance files present');
    }
  }
  
  checkPreCommitHook() {
    const hookPath = '.git/hooks/pre-commit';
    
    if (!existsSync(hookPath)) {
      this.warnings.push('Pre-commit hook not installed');
      console.log('⚠️  Pre-commit hook not configured');
    } else {
      console.log('✅ Pre-commit hooks configured');
    }
  }
  
  checkCodingStandards() {
    // Check if core modules have JSDoc
    const coreModules = [
      'src/core/exerciseLoader.js',
      'src/core/notationRenderer.js',
      'src/core/playbackEngine.js',
      'src/core/pitchDetector.js',
      'src/core/polyphonicDetector.js',
      'src/core/analyzer.js',
      'src/core/tuner.js',
      'src/core/uiManager.js',
      'src/core/storage.js'
    ];
    
    coreModules.forEach(module => {
      if (existsSync(module)) {
        const content = readFileSync(module, 'utf8');
        
        if (!content.includes('@param') && !content.includes('@returns')) {
          this.warnings.push(`${module} may be missing JSDoc comments`);
        }
      }
    });
    
    if (this.warnings.length === 0) {
      console.log('✅ Coding standards appear compliant');
    }
  }
  
  printResults() {
    console.log('\n' + '='.repeat(50));
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('\n✅ All governance checks passed!');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
  }
}

const validator = new GovernanceValidator();
const success = validator.validate();

process.exit(success ? 0 : 1);
```

**Add to package.json**:
```json
{
  "scripts": {
    "lint:rules": "node scripts/validate-governance.js"
  }
}
```

### 10.4 CLINE_MEMORY.md Update Template

**After each milestone completion, append**:

```markdown
### [Milestone Name]
**Date:** YYYY-MM-DD HH:MM:SS UTC+Z
**Task:** [Brief description]
**Details:**
- [Specific work completed]
- [Modules modified/created]
- [Tests added/updated]
- [Challenges encountered and solutions]

**Impact:** [How this affects system architecture]

**Components Added/Modified:**
- [List of files changed]
- [New dependencies added]
- [Configuration changes]

**Testing:**
- [Test results summary]
- [Coverage metrics]
- [Performance measurements if applicable]

**Governance:**
- CLINE_TODO.md updated: [Yes/No]
- Tests passing: [Yes/No]
- Documentation updated: [Yes/No]

---
```

### 10.5 Milestone PR Checklist

**Pull Request Template**:
```markdown
## Milestone: [M1-M11]

### Description
[Brief description of what this milestone accomplishes]

### Changes
- [ ] Core module(s) implemented: [list]
- [ ] Unit tests added/updated
- [ ] Integration tests added (if applicable)
- [ ] E2E tests added (if applicable)
- [ ] Documentation updated

### Governance Compliance
- [ ] RULES.md standards followed (ES6+, JSDoc, vanilla JS)
- [ ] `.cline/CLINE_TODO.md` updated with task status
- [ ] `CLINE_MEMORY.md` appended with completion details
- [ ] Pre-commit hook passes
- [ ] `npm run lint:rules` passes
- [ ] Branch naming follows convention

### Testing
- [ ] `npm test` passes
- [ ] Test coverage ≥ 80% for new code
- [ ] Manual testing completed (if applicable)
- [ ] Performance targets met (latency, memory, CPU)

### Test Results
```
[Paste test output here]
```

### Acceptance Criteria Met
- [ ] [Criterion 1 from MASTER_PROMPT]
- [ ] [Criterion 2 from MASTER_PROMPT]
- [ ] [...]

### Notes
[Any additional context, decisions made, or issues encountered]
```

---

## 11. Browser Compatibility Layer

### 11.1 Feature Detection

**File**: `src/utils/featureDetection.js`

```javascript
export class FeatureDetection {
  static checkWebAudio() {
    return !!(window.AudioContext || window.webkitAudioContext);
  }
  
  static checkAudioWorklet() {
    if (!this.checkWebAudio()) return false;
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();
    const hasWorklet = 'audioWorklet' in context;
    context.close();
    
    return hasWorklet;
  }
  
  static checkLocalStorage() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  static checkFileAPI() {
    return !!(window.File && window.FileReader && window.FileList && window.Blob);
  }
  
  static checkES6Support() {
    try {
      eval('class Test {}');
      eval('const arrow = () => {}');
      eval('async function test() {}');
      return true;
    } catch (e) {
      return false;
    }
  }
  
  static generateCompatibilityReport() {
    return {
      webAudio: this.checkWebAudio(),
      audioWorklet: this.checkAudioWorklet(),
      localStorage: this.checkLocalStorage(),
      fileAPI: this.checkFileAPI(),
      es6: this.checkES6Support(),
      browser: this.detectBrowser()
    };
  }
  
  static detectBrowser() {
    const ua = navigator.userAgent;
    
    if (ua.includes('Chrome') && !ua.includes('Edg')) {
      return { name: 'Chrome', supported: true };
    } else if (ua.includes('Firefox')) {
      return { name: 'Firefox', supported: true };
    } else if (ua.includes('Edg')) {
      return { name: 'Edge', supported: true };
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
      return { name: 'Safari', supported: false, reason: 'Deferred to v2' };
    } else {
      return { name: 'Unknown', supported: false, reason: 'Unsupported browser' };
    }
  }
  
  static displayCompatibilityWarning() {
    const report = this.generateCompatibilityReport();
    const issues = [];
    
    if (!report.webAudio) issues.push('Web Audio API');
    if (!report.localStorage) issues.push('LocalStorage');
    if (!report.fileAPI) issues.push('File API');
    if (!report.es6) issues.push('ES6 JavaScript');
    
    if (issues.length > 0 || !report.browser.supported) {
      const message = `
        <div class="compatibility-warning">
          <h3>Browser Compatibility Warning</h3>
          <p>Your browser may not support all features of Guitar4:</p>
          <ul>
            ${issues.map(issue => `<li>${issue} not available</li>`).join('')}
            ${!report.browser.supported ? `<li>${report.browser.reason}</li>` : ''}
          </ul>
          <p>For the best experience, please use Chrome or Firefox on desktop.</p>
        </div>
      `;
      
      return message;
    }
    
    return null;
  }
}
```

### 11.2 Polyfills and Fallbacks

**AudioWorklet Fallback**:
```javascript
// src/utils/audioContext.js
export class AudioContextManager {
  constructor() {
    this.context = null;
    this.useWorklet = false;
  }
  
  async initialize() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContext();
    
    // Check for AudioWorklet support
    if ('audioWorklet' in this.context) {
      try {
        await this.context.audioWorklet.addModule('src/worklets/pitchDetector.worklet.js');
        this.useWorklet = true;
        console.log('Using AudioWorklet for pitch detection');
      } catch (error) {
        console.warn('AudioWorklet failed, falling back to ScriptProcessorNode');
        this.useWorklet = false;
      }
    } else {
      console.warn('AudioWorklet not supported, using ScriptProcessorNode');
      this.useWorklet = false;
    }
    
    return this.context;
  }
  
  createPitchDetectorNode(callback) {
    if (this.useWorklet) {
      return this.createWorkletNode(callback);
    } else {
      return this.createScriptProcessorNode(callback);
    }
  }
  
  createWorkletNode(callback) {
    const workletNode = new AudioWorkletNode(this.context, 'pitch-detector-worklet');
    
    workletNode.port.onmessage = (event) => {
      callback(event.data);
    };
    
    return workletNode;
  }
  
  createScriptProcessorNode(callback) {
    const bufferSize = 4096;
    const processor = this.context.createScriptProcessor(bufferSize, 1, 1);
    
    processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const outputData = event.outputBuffer.getChannelData(0);
      
      // Copy input to output (passthrough)
      outputData.set(inputData);
      
      // Process audio
      callback({ samples: inputData, timestamp: this.context.currentTime });
    };
    
    return processor;
  }
  
  async resume() {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }
  
  async close() {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }
}
```

### 11.3 Browser-Specific Workarounds

**Chrome/Chromium**:
- Full Web Audio API support
- AudioWorklet preferred
- No known issues

**Firefox**:
- Full Web Audio API support
- AudioWorklet supported (Firefox 76+)
- Potential latency slightly higher than Chrome (acceptable)

**Safari** (deferred to v2):
- AudioWorklet implementation differs
- Requires webkit prefixes in some cases
- May need additional polyfills

---

## 12. Security Architecture

### 12.1 Security Principles

**Principle 1: Client-Side Only**
- No backend services = no server-side vulnerabilities
- All data processing in browser
- No user data transmitted externally

**Principle 2: User Data Privacy**
- Microphone audio never leaves device
- LocalStorage contains only user's own data
- No tracking or analytics

**Principle 3: Input Validation**
- Validate all user-uploaded files
- Sanitize any data before rendering
- Reject oversized inputs

**Principle 4: Secure Dependencies**
- Use trusted libraries (OSMD, Tone.js, TensorFlow.js)
- Regular dependency updates
- No inline scripts or eval()

### 12.2 Content Security Policy

**Recommended CSP Header** (for production deployment):
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://cdnjs.cloudflare.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self';
  connect-src 'self';
  media-src 'self' blob:;
  worker-src 'self' blob:;
">
```

**Explanation**:
- `default-src 'self'`: Only load resources from same origin
- `script-src`: Allow scripts from self and CDN (for libraries)
- `style-src 'unsafe-inline'`: Allow inline styles (OSMD requires this)
- `worker-src blob:`: Allow Web Workers with blob URLs

### 12.3 Input Validation

**File Upload Validation**:
```javascript
// In ExerciseLoader
validateFile(file) {
  // Check file type
  const allowedTypes = ['text/xml', 'application/xml'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only MusicXML (.xml) files are allowed.');
  }
  
  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 5MB.');
  }
  
  // Check file name
  if (!file.name.match(/\.(xml|musicxml)$/i)) {
    throw new Error('Invalid file extension. Expected .xml or .musicxml');
  }
  
  return true;
}
```

**XML Content Validation**:
```javascript
// In ExerciseLoader
sanitizeXML(xmlContent) {
  // Remove any script tags (should never be in MusicXML, but defensive)
  xmlContent = xmlContent.replace(/<script[^>]*>.*?<\/script>/gi, '');
  
  // Remove any event handlers
  xmlContent = xmlContent.replace(/on\w+="[^"]*"/gi, '');
  
  // Validate XML structure
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');
  
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Malformed XML content');
  }
  
  return xmlContent;
}
```

### 12.4 Microphone Permissions

**Permission Request Flow**:
```javascript
// In UIManager
async requestMicrophonePermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Permission granted
    this.microphoneStream = stream;
    this.emit('microphone:granted');
    
    return stream;
    
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      this.showNotification(
        'Microphone access denied. Guitar4 needs microphone access for pitch detection.',
        'error'
      );
    } else if (error.name === 'NotFoundError') {
      this.showNotification(
        'No microphone found. Please connect a microphone and try again.',
        'error'
      );
    } else {
      this.showNotification(
        `Microphone error: ${error.message}`,
        'error'
      );
    }
    
    this.emit('microphone:denied', { error });
    throw error;
  }
}

stopMicrophone() {
  if (this.microphoneStream) {
    this.microphoneStream.getTracks().forEach(track => track.stop());
    this.microphoneStream = null;
    this.emit('microphone:stopped');
  }
}
```

**User Communication**:
```html
<div class="microphone-permission-prompt">
  <h3>Microphone Access Required</h3>
  <p>Guitar4 needs access to your microphone to analyze your playing.</p>
  <ul>
    <li>Audio is processed locally in your browser</li>
    <li>No audio is recorded or transmitted</li>
    <li>You can revoke permission at any time</li>
  </ul>
  <button onclick="requestMicrophone()">Allow Microphone Access</button>
</div>
```

### 12.5 Dependency Security

**Dependency Manifest**:
```json
{
  "dependencies": {
    "opensheetmusicdisplay": "^1.8.0",
    "tone": "^14.8.0",
    "@tensorflow/tfjs": "^4.11.0",
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "playwright": "^1.40.0"
  }
}
```

**Security Practices**:
1. Pin dependency versions (avoid wildcards in production)
2. Run `npm audit` regularly
3. Review dependency licenses for compatibility
4. Update dependencies for security patches
5. Use Dependabot or similar for automated updates

**Audit Script**:
```bash
#!/bin/bash
# scripts/security-audit.sh

echo "Running security audit..."

# Check for vulnerabilities
npm audit --audit-level=moderate

# Check for outdated packages
npm outdated

# Check licenses
npx license-checker --summary

echo "Security audit complete."
```

---

## 13. Deployment Architecture

### 13.1 Build Process (Future)

**Current**: Static files served directly (no build step)

**Future Build Pipeline**:
1. Transpile ES6+ to ES5 (if needed for broader compatibility)
2. Minify JavaScript and CSS
3. Bundle modules
4. Optimize assets (compress images, audio samples)
5. Generate source maps
6. Cache busting with file hashes

**Potential Build Tool**: Vite or Rollup

### 13.2 GitHub Pages Deployment

**Repository Structure for GitHub Pages**:
```
guitar4/
├── docs/                    # Optional: documentation site
├── dist/                    # Build output (if using build process)
├── index.html               # Entry point
├── src/                     # Source files
├── assets/                  # Static assets
└── package.json
```

**GitHub Pages Configuration**:
- Branch: `main` or `gh-pages`
- Folder: `/` (root) or `/docs`
- Custom domain: optional (e.g., guitar4.example.com)

**Deployment Script**:
```bash
#!/bin/bash
# scripts/deploy-gh-pages.sh

echo "Deploying to GitHub Pages..."

# Ensure we're on main branch
git checkout main

# Pull latest changes
git pull origin main

# If using build process:
# npm run build
# git add dist/
# git commit -m "Build for deployment"

# Push to GitHub
git push origin main

echo "Deployment complete. GitHub Pages will update automatically."
echo "Visit: https://[username].github.io/[repo-name]"
```

### 13.3 Asset Management for Deployment

**Large Assets (Magenta Models)**:

**Option 1: Git LFS**
```bash
# Install Git LFS
git lfs install

# Track model files
git lfs track "assets/models/magenta/*.bin"
git lfs track "assets/models/magenta/*.json"

# Add .gitattributes
git add .gitattributes

# Commit and push
git add assets/models/magenta/
git commit -m "Add Magenta models with LFS"
git push origin main
```

**Option 2: External CDN**
```javascript
// In polyphonicDetector.js
const MODEL_SOURCES = {
  local: 'assets/models/magenta/model.json',
  cdn: 'https://cdn.example.com/guitar4/magenta/model.json'
};

async loadModel() {
  // Try local first, fall back to CDN
  try {
    await tf.loadGraphModel(MODEL_SOURCES.local);
  } catch (error) {
    console.warn('Local model not found, loading from CDN');
    await tf.loadGraphModel(MODEL_SOURCES.cdn);
  }
}
```

**Option 3: Release Assets**
- Attach model files to GitHub Releases
- Download on first use
- Cache in browser

### 13.4 Performance Optimization for Production

**Asset Compression**:
```bash
# Compress audio samples
for file in assets/samples/**/*.wav; do
  ffmpeg -i "$file" -c:a libvorbis -q:a 4 "${file%.wav}.ogg"
done

# Compress images
for file in assets/images/**/*.png; do
  pngquant --quality=65-80 "$file" --output "${file%.png}-compressed.png"
done
```

**Caching Strategy**:
```html
<!-- index.html -->
<meta http-equiv="Cache-Control" content="max-age=31536000, public">
```

**Service Worker** (future enhancement):
```javascript
// service-worker.js
const CACHE_NAME = 'guitar4-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/src/core/exerciseLoader.js',
  // ... other assets
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

---

## 14. Architecture Decision Records (ADRs)

### ADR-001: Use Vanilla JavaScript Instead of Framework

**Status**: Accepted

**Context**: 
Need to choose between vanilla JavaScript or a framework (React, Vue, Svelte) for the UI.

**Decision**: 
Use vanilla JavaScript with ES6+ features.

**Rationale**:
- Maximum performance for audio processing (no framework overhead)
- Full control over rendering pipeline
- Smaller bundle size
- Direct Web Audio API integration
- Simpler debugging for audio-critical features

**Consequences**:
- More manual DOM manipulation
- No reactive data binding
- More boilerplate for state management
- Trade-off accepted for performance gains

---

### ADR-002: Event-Driven Architecture Between Modules

**Status**: Accepted

**Context**: 
Need to decide how core modules communicate.

**Decision**: 
Use EventEmitter pattern for inter-module communication.

**Rationale**:
- Loose coupling between modules
- Easy to add new listeners without modifying producers
- Simplifies testing (can mock event handlers)
- Aligns with Web Audio API event model

**Consequences**:
- Requires discipline to avoid event spaghetti
- Debugging can be harder (event flow less explicit)
- Must document events clearly

---

### ADR-003: LocalStorage for Client-Side Persistence

**Status**: Accepted

**Context**: 
Need to persist user settings and performance history.

**Decision**: 
Use LocalStorage as primary persistence mechanism.

**Rationale**:
- Synchronous API simplifies code
- Universally supported in target browsers
- No backend infrastructure required
- Sufficient for data volumes expected
- Prepares for future backend integration

**Consequences**:
- Storage quota limits (~5-10MB)
- Data not synced across devices
- No backup mechanism
- Acceptable for v1, will add cloud sync in v2

---

### ADR-004: Magenta Onsets & Frames for Polyphonic Detection

**Status**: Accepted

**Context**: 
Need to choose polyphonic pitch detection approach.

**Decision**: 
Use pre-trained Magenta Onsets & Frames model with TensorFlow.js.

**Rationale**:
- State-of-the-art accuracy for polyphonic transcription
- Pre-trained model available (no training required)
- TensorFlow.js runs in browser
- Fallback to monophonic if model unavailable

**Consequences**:
- Large model size (~150MB)
- Requires TensorFlow.js dependency
- Higher memory usage
- Inference latency higher than monophonic
- Acceptable trade-off for chord detection capability

---

### ADR-005: OpenSheetMusicDisplay for Notation Rendering

**Status**: Accepted

**Context**: 
Need to render MusicXML as visual notation.

**Decision**: 
Use OpenSheetMusicDisplay (OSMD) library.

**Rationale**:
- Mature MusicXML renderer with active maintenance
- Outputs SVG (easily stylable and accessible)
- Supports both standard notation and tablature
- Good documentation and examples
- MIT license (compatible with project)

**Consequences**:
- Dependency on third-party library
- Limited control over rendering internals
- Must work within OSMD's API constraints
- Acceptable for v1, provides solid foundation

---

### ADR-006: Tone.js for Audio Synthesis and Scheduling

**Status**: Accepted

**Context**: 
Need deterministic audio scheduling and synthesis.

**Decision**: 
Use Tone.js as Web Audio API abstraction layer.

**Rationale**:
- High-level API for audio scheduling
- Transport system for musical time
- Built-in synthesizers and samplers
- Handles audio context lifecycle
- Well-documented and maintained

**Consequences**:
- Additional dependency
- Abstraction adds small overhead
- Must learn Tone.js API
- Trade-off accepted for development speed and reliability

---

## 15. Future Architecture Considerations

### 15.1 Version 2 Enhancements

**Backend Integration**:
- User authentication (OAuth)
- Cloud storage for exercises and progress
- Exercise sharing and community library
- Real-time multiplayer practice sessions

**Architecture Changes**:
- Add API client module for backend communication
- Implement sync strategy (conflict resolution)
- Add authentication layer
- Modify storage module for hybrid local/cloud storage

**Mobile Support**:
- Responsive layout for touch devices
- Optimize for smaller screens
- Adjust controls for touch interaction
- Consider native app wrapper (Capacitor/Cordova)

### 15.2 Version 3 Considerations

**Advanced Features**:
- MIDI input device support
- Multi-track recording and overdubbing
- Video lessons with synchronized notation
- AI-powered practice recommendations

**Architecture Impact**:
- New MIDI input module
- Recording engine with multi-track support
- Video player integration
- Machine learning module for recommendations

### 15.3 Scalability Planning

**Performance at Scale**:
- Support for orchestral scores (100+ staves)
- Very long exercises (20+ minutes)
- High-resolution audio (96kHz sample rate)

**Optimizations Needed**:
- Streaming score rendering (load on demand)
- Audio chunking for long recordings
- Worker threads for heavy processing
- IndexedDB for larger datasets

---

## 16. Conclusion

This architecture document provides comprehensive guidance for the development of Guitar4. Key takeaways:

1. **Modular Design**: Clear separation of concerns with single-responsibility modules
2. **Event-Driven**: Loose coupling via EventEmitter pattern
3. **Performance-First**: Latency targets drive design decisions
4. **Progressive Enhancement**: Graceful degradation when features unavailable
5. **Testability**: Architecture designed for comprehensive testing
6. **Governance Integration**: Development workflow aligned with RULES.md

**Next Steps for Cline**:
1. Review this architecture alongside MASTER_PROMPT.md
2. Begin implementation with M1 (repository skeleton)
3. Follow milestone sequence, testing at each stage
4. Update CLINE_MEMORY.md after each milestone
5. Maintain compliance with governance standards

**Key References**:
- **PROJECT_SPEC.md**: Detailed functional requirements
- **MASTER_PROMPT.md**: Milestone-driven implementation plan
- **RULES.md**: Coding standards and governance rules
- **TESTING.md**: Test procedures and commands
- **DEV_NOTES.md**: Developer tips and decisions

This architecture serves as the foundation for all development decisions and should be consulted frequently during implementation.

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-01  
**Maintained By**: Guitar4 Development Team  
**Status**: Living Document (update as architecture evolves)
