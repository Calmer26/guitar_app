MASTER_PROMPT v2.0 - Complete Outline for Individual Prompt Generation
Context & Approach
This master prompt serves as a blueprint for generating 15 detailed individual sub-prompts for building Guitar4, a browser-based guitar training application. Each sub-prompt will be created on-demand with full implementation details, test requirements, and governance checks.
Key Architectural Decision: Single OSMD instance renders both standard notation and tablature staves simultaneously (not two separate renderers).

SUB-PROMPT 0: Environment Setup & Verification
Objective: Establish complete development environment with all dependencies, governance structure, and validation tools.
Scope:

Node.js and npm installation verification (v18+)
Git repository initialization with proper .gitignore
Install core dependencies: OSMD, Tone.js, TensorFlow.js, Playwright, lodash, papaparse, Express
Create governance file structure (.cline/CLINE_TODO.md, CLINE_MEMORY.md, .cline/governance/hooks/)
Set up Express development server configuration
Install and configure pre-commit hooks
Create initial governance validation script (lint:rules)
Verify browser compatibility detection utilities
Configure package.json scripts (start, test, lint:rules)

Key Deliverables:

Working package.json with all dependencies and scripts
Development server configuration file
Pre-commit hook installed and functional
npm run lint:rules command working
Browser compatibility report generated
All governance files created and validated

Testing:

Manual: Start server with npm start, verify localhost:8000 accessible
Manual: Run npm run lint:rules, verify governance checks pass
Manual: Make test commit, verify pre-commit hook executes

Architecture Reference:

§11 (Browser Compatibility Layer)
§10 (Governance Integration)
§13 (Deployment Architecture)

Governance Requirements:

Create .cline/CLINE_TODO.md with M0 task
Initialize CLINE_MEMORY.md with project start entry
Verify RULES.md exists and is referenced

Acceptance Criteria:

npm start launches server successfully
Browser loads http://localhost:8000 without errors
npm run lint:rules passes all checks
Pre-commit hook prevents commits without governance files
All dependencies install without errors


SUB-PROMPT 1: Repository Skeleton & Core Utilities
Objective: Create complete directory structure with utility modules and empty core module stubs.
Scope:

Full directory structure per architecture.md §1.3
EventEmitter base class implementation in src/utils/eventEmitter.js
Logger utility with error storage in src/utils/logger.js
Performance monitor utility skeleton in src/utils/performanceMonitor.js
Feature detection utility in src/utils/featureDetection.js
Audio context manager utility skeleton in src/utils/audioContext.js
Constants file in src/utils/constants.js
Core module stubs with proper JSDoc comments:

exerciseLoader.js (empty class)
notationRenderer.js (empty class)
playbackEngine.js (empty class)
pitchDetector.js (empty class)
polyphonicDetector.js (empty class)
analyzer.js (empty class)
tuner.js (empty class)
uiManager.js (empty class)
storage.js (empty class)


Basic index.html with app structure (single OSMD container, tabs, controls)
Initial styles.css with layout
README.md with setup instructions
TESTING.md skeleton
DEV_NOTES.md skeleton

Key Deliverables:

All directories created per architecture
EventEmitter utility functional and tested
Logger utility functional with console output and storage
Feature detection reports browser capabilities
Core module stubs export classes with JSDoc
HTML serves without console errors
Basic CSS provides usable layout

Testing:

Unit test: EventEmitter on/off/emit functionality
Unit test: Logger log levels and storage
Unit test: Feature detection reports
Manual: Serve site, verify structure visible, no errors

Architecture Reference:

§1 (Architecture Overview)
§1.3 (Directory Structure)
§2 (Design Principles)
§5.1 (EventEmitter Pattern)
§11.1 (Feature Detection)

Governance Requirements:

Update CLINE_TODO.md to mark M0 complete, M1 in progress
Follow RULES.md coding standards (ES6+, JSDoc, vanilla JS)
Ensure all utility files have JSDoc comments

Acceptance Criteria:

Directory structure matches architecture.md §1.3
EventEmitter unit tests pass
Logger unit tests pass
Static site serves and displays basic structure
No console errors in browser
All stubs have proper JSDoc


SUB-PROMPT 2: Exercise Loader Module
Objective: Implement complete MusicXML parsing with staff identification, timeline generation, and validation.
Scope:

DOMParser integration for XML parsing
Metadata extraction (title, composer, tempo, time signature, tuning)
Staff identification in timeline (staff 1 = notation, staff 2 = tablature)
Timeline generation with absolute timestamps in milliseconds
MIDI note conversion from pitch data (step, octave, alter)
Tablature data extraction (string/fret) for staff 2 notes
Complete MusicXML preservation (both staves intact for OSMD)
Note ID assignment (unique identifiers like 'n1', 'n2')
System number tracking for pagination
Comprehensive validation rules per architecture.md §4.1
Error handling for malformed XML with user-friendly messages
ExerciseJSON structure generation with single osmdInput field
File upload validation (type, size limits)

Key Deliverables:

ExerciseLoader class with full API (parseXML, loadFromFile, validateExercise)
Parses all 5 sample XML files correctly (twinkle2.xml, etc.)
Timeline sorted chronologically with all note data
Complete MusicXML string preserved in osmdInput field
Timeline notes tagged with staff number (1 or 2)
Validation catches malformed XML gracefully
Error messages clear and actionable

Testing:

Unit test: Parse twinkle2.xml, validate structure
Unit test: Timeline has correct note count and ordering
Unit test: Staff identification correct (notes tagged 1 or 2)
Unit test: MIDI conversion accurate
Unit test: Tablature data extracted for staff 2
Unit test: Handle malformed XML without crashing
Unit test: File validation rejects invalid files
Unit test: Timeline chronologically sorted

Architecture Reference:

§3.1 (Exercise Loader Module)
§4.1 (ExerciseJSON Structure)
§6.1 (Exercise Loading Pipeline)
§7.2 (Error Handling - Exercise Loader)

Governance Requirements:

Update CLINE_TODO.md to mark M1 complete, M2 in progress
Append M1 completion to CLINE_MEMORY.md with timestamp
Ensure JSDoc on all public methods
Follow ES6+ standards

Acceptance Criteria:

node src/tests/unit/loader.test.js passes all tests
twinkle2.xml parses with timeline length > 0
osmdInput field contains complete MusicXML
Timeline notes have staff property (1 or 2)
Malformed XML produces clear error message
No crashes on invalid input


SUB-PROMPT 3: Notation Renderer Module
Objective: Implement single OSMD rendering displaying both standard notation and tablature staves with DOM element mapping and synchronized scrolling.
Scope:

Single OSMD instance creation and configuration
Render complete MusicXML (both staff 1 notation and staff 2 tablature simultaneously)
OSMD configuration for optimal display (backend: svg, auto-resize, cursor settings)
Post-processing: add data-note-id attributes to SVG elements for both staves
Build noteElementMap (noteId → SVGElement) mapping timeline to DOM
Element matching algorithm (match by pitch + timestamp + staff)
Handle chord grouping (multiple notes same timestamp)
Progressive rendering for large scores (load systems on demand - optional)
Highlight management API (add/remove CSS classes to notes)
Scroll calculation to keep active notes visible
Clear/reset functionality
Error handling for rendering failures

Key Deliverables:

NotationRenderer class with full API
Single OSMD container renders both staves vertically stacked
data-note-id attributes present on notes in both staves
Element mapping functional for both notation and tablature notes
Highlight API works (add/remove active classes)
Scrolling keeps cursor visible during playback
Rendering completes without errors for sample files

Testing:

E2E test: Verify OSMD container shows both staves
E2E test: Validate data-note-id attributes exist
E2E test: Count rendered systems and notes
E2E test: Check SVG structure contains staff 1 and staff 2 elements
Unit test: Element mapping correctness
Unit test: getNoteElement returns correct SVG element
Integration test: Highlight notes by ID
Integration test: Load exercise and render complete pipeline

Architecture Reference:

§3.2 (Notation Renderer Module)
§4.1 (ExerciseJSON - osmdInput field)
§6.2 (Notation Rendering Pipeline)
§8.4 (Rendering Optimization)

Governance Requirements:

Update CLINE_TODO.md to mark M2 complete, M3 in progress
Append M2 completion to CLINE_MEMORY.md
JSDoc all public methods
Follow RULES.md standards

Acceptance Criteria:

Single OSMD instance renders both staves
data-note-id attributes present on first 10 notes
getNoteElement(noteId) returns SVG element
highlightNotes([ids]) adds CSS class
DOM inspection shows two staff SVG groups
twinkle2.xml renders without errors


SUB-PROMPT 4: Playback Engine Core
Objective: Implement deterministic scheduling with Tone.js Transport, cursor management, and state machine.
Scope:

PlaybackEngine class extending EventEmitter
State machine implementation (STOPPED, PLAYING, PAUSED)
Timeline to Tone.Transport event scheduling conversion
Musical time to milliseconds conversion using BPM
Deterministic tick event emission at note onset times
Cursor initialization rule (first musical note, skip clef/time signature)
System change detection for scrolling triggers
Tempo management (get/set BPM, handle tempo changes)
Playback controls (play, pause, stop, seek)
Current position tracking
Event emission per architecture.md §5.2 (playback:started, tick, systemChange, etc.)
State transition validation
Audio context state checking (suspended/running)
Error handling for invalid states

Key Deliverables:

PlaybackEngine with complete API
State machine enforces valid transitions only
Tick events emitted at mathematically correct intervals (±10ms tolerance)
Cursor initializes on first musical note (not clef)
System change events emitted when crossing systems
Play/pause/stop/seek all functional
BPM changes recalculate timing correctly

Testing:

Unit test: Scheduling accuracy at 60, 120, 180 BPM
Unit test: State machine transitions validated
Unit test: Cursor initialization skips non-note elements
Unit test: Event timing within tolerance
Unit test: System change detection
Integration test: Tick events received by subscribers
Performance test: Timing drift over 2-minute playback < 100ms

Architecture Reference:

§3.3 (Playback Engine Module)
§4.4 (PlaybackConfig Structure)
§5.2 (Playback Engine Events)
§6.3 (Playback Pipeline)
§8.1 (Latency Budget - tick to cursor < 20ms)

Governance Requirements:

Update CLINE_TODO.md to mark M3 complete, M4 in progress
Append M3 completion to CLINE_MEMORY.md
JSDoc all methods
Include event emission documentation

Acceptance Criteria:

node src/tests/unit/playback.test.js passes
Tick events at 120 BPM occur every 500ms ±10ms
Cursor starts on first note (not clef)
State transitions enforced
System change events emitted correctly


SUB-PROMPT 5: Audio Synthesis & Sample Playback
Objective: Integrate Tone.js synthesis and sample-based playback with instrument selection and audio context management.
Scope:

Extend PlaybackEngine with audio output capabilities
Tone.js synthesizer configuration (PolySynth with AMSynth voice)
Sample loading infrastructure (Tone.Player, Tone.Sampler)
Sample naming convention (MIDI_NUMBER.wav in assets/samples/guitar/)
Sample caching and preloading strategy
Instrument mode switching (synth/sample)
Instrument selection UI and logic (guitar/piano)
Audio context lifecycle management (suspended → running on user gesture)
"Start Audio Context" button workflow
Volume controls (master volume, metronome volume)
Metronome implementation (click sound on beats)
Audio timing synchronized with visual events
Error handling for missing samples (fallback to synth)
Sample file validation

Key Deliverables:

Audio output works in synth mode (immediate playback)
Sample mode loads guitar samples and plays correctly
Instrument selection UI functional (dropdown or buttons)
Samples preload before playback starts
Metronome audible and synchronized with beats
Audio context requires user gesture (button click)
Audio context state indicator shows status
Fallback to synth when samples unavailable

Testing:

Manual: Click "Start Audio Context" button
Manual: Click Play, verify audible tones in synth mode
Manual: Switch to sample mode, verify guitar samples play
Manual: Toggle metronome, verify clicks audible on beats
Manual: Check audio synchronized with visual cursor
Integration test: Audio context activation workflow
Integration test: Audio output timing vs tick events

Architecture Reference:

§3.3 (Playback Engine - Audio Synthesis)
§6.3 (Playback Pipeline - Audio Output)
§7.2 (Error Handling - Audio)
§11.2 (Audio Context Manager)

Governance Requirements:

Update CLINE_TODO.md to mark M4 complete, M5 in progress
Append M4 completion to CLINE_MEMORY.md
Document audio context lifecycle
Follow RULES.md standards

Acceptance Criteria:

Audio plays in both synth and sample modes
Audio context button workflow functional
Metronome synchronized with tempo
Missing samples don't crash (fallback works)
Audio synchronized with visual cursor within 50ms


SUB-PROMPT 6: Monophonic Pitch Detection (YIN Algorithm)
Objective: Implement real-time monophonic pitch detection with YIN algorithm, noise gating, and confidence scoring.
Scope:

PitchDetector class extending EventEmitter
AudioWorklet implementation for low-latency processing
ScriptProcessorNode fallback for browser compatibility
YIN algorithm implementation:

Difference function calculation
Cumulative mean normalized difference (CMNDF)
Threshold-based period detection
Parabolic interpolation for sub-sample accuracy


Adaptive buffer sizing (1024/2048/4096 based on frequency range)
Noise gate with RMS amplitude threshold (-40dB default)
DC offset removal and high-pass filter (60Hz cutoff)
Confidence scoring algorithm (peak clarity + harmonic ratio)
Frequency to MIDI note conversion
Cents deviation calculation
PitchStream event emission per architecture.md §4.2
Microphone permission handling
Start/stop controls
Configuration API (buffer size, threshold, etc.)

Key Deliverables:

PitchDetector class with full API
Sustained A4 (440Hz) detected within ±2Hz
Guitar open strings (E2, A2, D3, G3, B3, E4) detected correctly
Confidence scoring rejects background noise
Processing latency < 30ms measured with Performance API
AudioWorklet used when available, fallback functional
Microphone permission request handled gracefully

Testing:

Unit test: YIN algorithm with synthetic 440Hz sine wave
Unit test: Noise gating rejects low-amplitude signals
Unit test: Frequency to MIDI conversion accuracy
Unit test: Cents deviation calculation
Integration test: Pre-recorded guitar note samples
Performance test: Measure latency (audio input → event emission)
Manual test: Guitar open strings detection accuracy

Architecture Reference:

§3.4 (Pitch Detector Module)
§4.2 (PitchStream Event Structure - Monophonic)
§6.4 (Pitch Detection Pipeline)
§8.1 (Latency Budget - detection < 30ms)
§11.2 (AudioWorklet Fallback)

Governance Requirements:

Update CLINE_TODO.md to mark M5 complete, M6 in progress
Append M5 completion to CLINE_MEMORY.md
JSDoc all methods including algorithm steps
Document AudioWorklet vs ScriptProcessor fallback

Acceptance Criteria:

Synthetic A4 440Hz detected as 440.0 ±2Hz
Real guitar E2 string detected correctly
Noise gate prevents false detections
Latency measured < 30ms
AudioWorklet used in Chrome/Firefox
Microphone permission errors handled gracefully


SUB-PROMPT 7: Polyphonic Detection (Magenta Model)
Objective: Integrate TensorFlow.js Onsets & Frames model with Web Worker inference and graceful degradation.
Scope:

PolyphonicDetector class extending EventEmitter
Model loading from local assets/models/magenta/ directory
Loading progress indicator (bytes loaded / total)
Timeout handling (30 seconds max)
Web Worker setup for inference thread (prevent UI blocking)
Audio buffering strategy (8-second chunks for model input)
Resampling to 16kHz if needed (model requirement)
Amplitude normalization to [-1, 1] range
Model inference execution using TensorFlow.js executeAsync
Output tensor parsing (onsets, frames, velocity)
Confidence threshold filtering (>0.5)
Duplicate detection removal
PitchStream event emission (polyphonic type per §4.2)
Graceful degradation to monophonic-only on model failure
User notification when polyphonic unavailable
Memory-efficient buffer management
Model ready state checking

Key Deliverables:

PolyphonicDetector class with full API
Model loads from local path within 10 seconds
Two-note guitar chord detected as two separate MIDI numbers
Loading progress displayed to user
Graceful fallback when model unavailable (clear message)
Memory usage stable during extended sessions
Web Worker prevents UI freezing during inference

Testing:

Smoke test: Model loads successfully from local path
Unit test: Two-note chord detection (synthetic audio)
Integration test: Real guitar chord recording detection
Memory test: Stable usage over 5-minute session
Fallback test: Model missing triggers monophonic mode
UI test: User notified when polyphonic unavailable
Performance test: Inference latency < 200ms per chunk

Architecture Reference:

§3.5 (Polyphonic Detector Module)
§4.2 (PitchStream - Polyphonic Event)
§6.5 (Polyphonic Detection Pipeline)
§7.2 (Error Handling - Graceful Degradation)
§8.2 (Memory Management)

Governance Requirements:

Update CLINE_TODO.md to mark M6 complete, M7 in progress
Append M6 completion to CLINE_MEMORY.md
Document model requirements and limitations
JSDoc all methods

Acceptance Criteria:

Model loads within 10 seconds
Two-note chord returns array of 2 MIDI numbers
Model failure displays user-friendly message
Fallback to monophonic mode works automatically
Memory stable (no leaks over 5 minutes)
No UI blocking during inference


SUB-PROMPT 8: Performance Analyzer (DTW & Scoring)
Objective: Implement Dynamic Time Warping alignment with per-note evaluation and aggregate scoring.
Scope:

Analyzer class extending EventEmitter
Dynamic Time Warping (DTW) algorithm implementation:

Cost matrix construction (reference × detected)
Cost function with weighted pitch and timing distances
Pitch weight α=0.6, timing weight β=0.4
Cumulative minimum path cost calculation
Backtracking to find optimal alignment


Per-note evaluation:

Pitch correctness (within tolerance in cents)
Timing deviation (milliseconds early/late)
Note classification (CORRECT, WRONG_PITCH, WRONG_TIMING, MISSED, EXTRA)


Aggregate scoring calculations:

Correctness percentage
Average timing deviation
Timing consistency score (based on std deviation)
Note count breakdowns


Tolerance configuration system:

Preset levels (EASY: 100¢/200ms, NORMAL: 50¢/100ms, HARD: 25¢/50ms)
Custom tolerance support


Performance history management (circular buffer, max 100 entries)
AnalysisResult structure per architecture.md §4.3
Real-time analysis capability (< 100ms for typical exercises)
Integration with pitch stream (monophonic + polyphonic)

Key Deliverables:

Analyzer class with full API
DTW produces sensible note correspondences
Per-note results accurate and detailed
Aggregate scoring calculated correctly
Tolerance presets functional
Performance history persists via storage module
Analysis completes within 100ms for 100-note exercise

Testing:

Unit test: Perfect synthetic performance yields 100% score
Unit test: Intentional pitch errors flagged as WRONG_PITCH
Unit test: Intentional timing errors flagged correctly
Unit test: DTW alignment accuracy with synthetic data
Unit test: Tolerance presets apply correctly
Integration test: Full pipeline (detection → analysis → result)
Performance test: 100-note analysis < 100ms

Architecture Reference:

§3.6 (Analyzer Module)
§4.2 (PitchStream structures)
§4.3 (AnalysisResult Structure)
§4.6 (ToleranceConfig Structure)
§6.6 (Performance Analysis Pipeline)
§8.1 (Performance Targets - analysis < 100ms)

Governance Requirements:

Update CLINE_TODO.md to mark M7 complete, M8 in progress
Append M7 completion to CLINE_MEMORY.md
Document DTW algorithm and cost function
JSDoc all methods with complexity notes

Acceptance Criteria:

Synthetic perfect performance scores 100%
Intentional errors classified correctly
DTW aligns notes sensibly
Analysis completes < 100ms for 100 notes
Tolerance presets change scoring appropriately
Performance history stores and retrieves correctly


SUB-PROMPT 9: Tuner Module
Objective: Implement real-time tuning display with visual needle, exponential smoothing, and color-coded accuracy.
Scope:

Tuner class extending EventEmitter
Exponential smoothing filter (α=0.2 default, configurable 0-0.99)
Separate smoothing for frequency and cents
Frequency display (0.1Hz precision, e.g., "440.0 Hz")
Note name calculation with accidentals (e.g., "E♭4", "A3")
Cents deviation from nearest equal temperament pitch
Needle angle calculation (map ±50 cents to ±45° rotation)
Color zone determination:

Green: ±5 cents (in tune)
Orange: ±6 to ±20 cents (close)
Red: >±20 cents (out of tune)


Reference pitch adjustment (A4 frequency, default 440Hz)
Update rate optimization (30-60Hz for smooth display)
Integration with PitchDetector (subscribe to pitch:detected events)
Tuner UI rendering and updates
Start/stop controls

Key Deliverables:

Tuner class with full API
Tuner UI renders with all elements (frequency, note name, cents, needle)
Sustained A4 displays "440.0 Hz" ±0.1Hz
Needle moves smoothly without excessive jitter
Color zones indicate tuning accuracy correctly
Reference pitch adjustment recalculates all frequencies
Smoothing factor adjustable for responsiveness vs stability trade-off

Testing:

Manual test: Sustain A4 tone (440Hz), verify display shows 440.0 ±0.1
Manual test: Slightly flat note shows negative cents with orange/red color
Manual test: Needle movement smooth and stable
Unit test: Cents calculation accuracy
Unit test: Smoothing filter behavior (test various α values)
Unit test: Needle angle calculation (±50¢ → ±45°)
Unit test: Reference pitch adjustment affects calculations

Architecture Reference:

§3.7 (Tuner Module)
§4.2 (PitchStream - integration)
§6.7 (Tuner Display Pipeline)

Governance Requirements:

Update CLINE_TODO.md to mark M8 complete, M9 in progress
Append M8 completion to CLINE_MEMORY.md
Document smoothing algorithm
JSDoc all methods

Acceptance Criteria:

A4 440Hz displays correctly
Flat note shows negative cents
Needle smooth (no jitter)
Color zones correct
Reference pitch adjustment works
Smoothing factor adjustable


SUB-PROMPT 10: Storage Module
Objective: Implement LocalStorage abstraction with schema versioning, quota management, and error recovery.
Scope:

Storage class with key-value API (get, set, delete, clear, keys, has)
Namespace prefixing (all keys prefixed with "g4:")
Data wrapping with metadata (version, timestamp)
Schema versioning system (current version: 1)
Migration function infrastructure for future schema changes
Quota exceeded detection and handling:

Catch QuotaExceededError
Attempt to free space (prune old history)
Notify user with actionable message


Circular buffer implementation for performance history (max 100 entries)
Data export functionality (JSON format)
Error handling and recovery strategies
Storage keys definition per architecture.md:

g4:settings
g4:lastExercise
g4:exerciseCache:{id}
g4:perfHistory
g4:audioContextState


Synchronous API (LocalStorage limitation)
In-memory fallback when LocalStorage unavailable

Key Deliverables:

Storage class with complete API
Settings persist across browser sessions
Performance history maintained with circular buffer
Quota errors handled gracefully (don't crash app)
Data export produces valid JSON
Namespace prevents collisions with other apps
Schema versioning prepares for future migrations

Testing:

Unit test: get/set/delete operations
Unit test: Namespace collision prevention (verify "g4:" prefix)
Unit test: Schema versioning (wrap/unwrap data)
Unit test: Quota exceeded handling (mock localStorage)
Unit test: Circular buffer for history (verify pruning at 100)
Integration test: Settings persistence across page reload
Integration test: Export data produces valid JSON

Architecture Reference:

§3.9 (Storage Module)
§7.2 (Error Handling - Storage)
§8.2 (Memory Management - History Pruning)

Governance Requirements:

Update CLINE_TODO.md to mark M9 complete, M10 in progress
Append M9 completion to CLINE_MEMORY.md
Document storage keys and schema
JSDoc all methods

Acceptance Criteria:

Settings persist after browser refresh
Performance history stored and retrieved
Quota errors don't crash app
Data export downloads valid JSON
Namespace prevents key collisions
History pruned at 100 entries


SUB-PROMPT 11: UI Manager & Integration
Objective: Orchestrate all modules with tab navigation, event subscriptions, keyboard shortcuts, and real-time feedback.
Scope:

UIManager class as main application orchestrator
Module initialization and dependency injection for all core modules
Tab navigation system (Practice, Tuner, Lessons, Settings)
Audio context activation workflow:

Display "Start Audio Context" button on page load
Handle user gesture requirement
Show audio context state indicator
Resume context if suspended


Event subscription setup for all modules:

Exercise loader events
Playback events (tick, systemChange, completed)
Pitch detection events
Analyzer events
Tuner events
Storage events


Playback control handlers (play, pause, stop, seek, tempo)
Real-time feedback display:

Notation highlighting based on analysis results
Score display updates
Progress indicators


Keyboard shortcuts implementation:

Space: play/pause toggle
Escape: stop
Arrow keys: seek
+/-: tempo adjustment
M: metronome toggle
Tab: cycle tabs


Notification system (info, success, warning, error)
Error presentation to user (user-friendly messages)
Settings panel UI (instrument, tuning, difficulty, audio settings)
Exercise loading workflow (file upload, sample selection)
Performance metrics display
Responsive layout management

Key Deliverables:

UIManager orchestrates all modules successfully
All tabs functional and switchable
Playback controls responsive to clicks and keyboard
Audio context button workflow correct
Keyboard shortcuts work as documented
Real-time feedback displays during playback
Settings panel functional and persists changes
Exercise loading complete (file upload + samples)
Notifications display for errors and status

Testing:

E2E test: Tab navigation functional
E2E test: Playback controls work (play/pause/stop)
E2E test: Audio context activation workflow
E2E test: Keyboard shortcuts respond correctly
E2E test: Load exercise and verify notation displays
Integration test: Event subscriptions correct
Integration test: Real-time feedback during playback
Integration test: Settings changes persist

Architecture Reference:

§3.8 (UI Manager Module)
§5 (Event-Driven Communication)
§5.2 (Event Catalog - all events)
§6 (Data Flow Pipelines - all pipelines)

Governance Requirements:

Update CLINE_TODO.md to mark M10 complete, M11 in progress
Append M10 completion to CLINE_MEMORY.md
Document event flow and subscriptions
JSDoc all methods and event handlers

Acceptance Criteria:

All tabs accessible and functional
Playback controls respond immediately
Audio context button required before playback
Keyboard shortcuts work
Real-time feedback displays correctly
Settings persist
Exercise loading works for all samples


SUB-PROMPT 12: Performance Monitoring & Optimization
Objective: Implement performance measurement tools, optimize critical paths, and validate latency targets.
Scope:

Enhance PerformanceMonitor utility with comprehensive metrics
Latency measurement at key pipeline stages:

Audio input capture (Web Audio timestamp)
Pitch detection completion
Analyzer processing
Visual feedback display
Total: audio → feedback ≤ 80ms target


Memory profiling integration:

Track heap size with performance.memory API
Monitor after model loading
Detect memory leaks during extended sessions
Target: < 300MB total


CPU usage monitoring:

Idle: < 5%
Active pitch detection: < 25%
Combined (playback + detection + analysis): < 40%


Rendering performance optimization:

Frame rate monitoring (maintain 60fps)
Layout thrashing prevention (batch reads/writes)
Throttle visual updates (requestAnimationFrame)


Audio processing optimization:

Object pooling for PitchEvent structures
Efficient buffer management
Typed arrays in YIN algorithm


Event throttling and debouncing:

Playback tick updates throttled to 60fps
Resize events debounced (250ms)
Tuner updates throttled to 30-60Hz


Performance statistics display (debug panel)
Automated performance regression tests
Performance budget enforcement

Key Deliverables:

PerformanceMonitor fully instrumented in all modules
Total latency audio → feedback measured and validated ≤ 80ms
Memory usage tracked and validated < 300MB
CPU usage monitored and within targets
Performance statistics displayed in debug panel
Optimization applied to critical paths (YIN algorithm, rendering)
Performance regression test suite functional
Performance report generated with metrics

Testing:

Performance test: Measure full pipeline latency (10 runs, average)
Performance test: Memory usage over 10-minute session
Performance test: CPU usage during active detection
Performance test: Rendering frame rate during playback
Performance test: YIN algorithm execution time
Automated: Performance regression suite (fail if targets exceeded)
Manual: Visual inspection of smooth playback and feedback

Architecture Reference:

§8 (Performance Architecture)
§8.1 (Latency Budget)
§8.2 (Memory Management)
§8.3 (CPU Optimization)
§8.4 (Rendering Optimization)
§8.5 (Performance Monitoring)

Governance Requirements:

Update CLINE_TODO.md to mark M11 complete, M12 in progress
Append M11 completion to CLINE_MEMORY.md
Document performance targets and measurements
Include performance metrics in test reports

Acceptance Criteria:

Total latency ≤ 80ms validated
Memory usage < 300MB validated
CPU usage within targets
60fps maintained during playback
Performance regression tests pass
Debug panel shows real-time metrics


SUB-PROMPT 13: Integration Testing & Data Flow Validation
Objective: Create comprehensive integration test suite validating complete data flow pipelines.
Scope:

Integration test framework setup (Node.js test runner with JSDOM)
Exercise loading → rendering pipeline test:

Load XML file
Parse to ExerciseJSON
Render notation
Verify DOM structure
Validate element mapping


Playback → cursor update pipeline test:

Initialize playback engine
Start playback
Verify tick events emitted
Confirm cursor highlights update
Validate synchronized scrolling


Pitch detection → analyzer pipeline test:

Feed synthetic audio to detector
Capture pitch events
Pass to analyzer with reference timeline
Verify analysis results
Check feedback display


Module communication via events test:

Verify event emissions from each module
Test event subscriptions functional
Validate event data structures
Test event error handling


Error propagation and recovery test:

Trigger errors in each module
Verify error events emitted
Test graceful degradation
Validate user notifications


State synchronization test:

Test playback state changes
Verify UI reflects state correctly
Test audio context state management


Performance history persistence test:

Generate analysis results
Store in storage module
Retrieve and verify data
Test circular buffer behavior


Mock object library creation:

AudioContext mock
OSMD mock
MediaStream mock
LocalStorage mock



Key Deliverables:

Integration test suite covering all major pipelines
All data flows validated end-to-end
Event communication tested comprehensively
Error handling verified in integration scenarios
Mock library available for testing
Test coverage ≥ 80% overall (unit + integration)

Testing:

Integration test: Load → render pipeline
Integration test: Playback → cursor pipeline
Integration test: Detection → analysis pipeline
Integration test: Module event communication
Integration test: Error propagation
Integration test: State synchronization
Coverage report: Verify ≥ 80% coverage

Architecture Reference:

§6 (Data Flow Pipelines - all sections)
§9 (Testing Architecture)
§9.3 (Integration Testing Strategy)

Governance Requirements:

Update CLINE_TODO.md to mark M12 complete, M13 in progress
Append M12 completion to CLINE_MEMORY.md
Document integration test scenarios
Ensure test coverage meets targets

Acceptance Criteria:

All integration tests pass
Data flow pipelines validated
Event communication tested
Error handling verified
Test coverage ≥ 80%
Mock library functional


SUB-PROMPT 14: E2E Tests, Accessibility & Documentation
Objective: Create Playwright E2E test suite, conduct accessibility audit, and complete all documentation.
Scope:

Playwright configuration and setup (chromium, firefox)
E2E test: Complete practice workflow

Load exercise
Activate audio context
Start playback
Verify notation displays
Verify cursor moves
Verify audio output
Stop playback


E2E test: Notation rendering validation

Load exercise
Verify OSMD container renders
Verify both staves visible
Verify data-note-id attributes
Verify element structure


E2E test: Tuner functionality

Switch to tuner tab
Verify tuner UI elements
Check frequency display
Check needle element
Verify color zones


E2E test: Settings persistence

Change settings (instrument, tempo, difficulty)
Reload page
Verify settings restored


E2E test: Keyboard navigation

Test all keyboard shortcuts
Verify tab navigation
Verify control focus


Accessibility audit (WCAG 2.1 AA compliance):

Keyboard navigation complete
Focus indicators visible
ARIA labels present
Color contrast ratios checked
Screen reader testing
Alt text for images
Semantic HTML structure


Browser compatibility testing:

Chrome/Chromium validation
Firefox validation
Feature detection warnings


Documentation completion:

README.md: Setup, usage, features
TESTING.md: All test procedures
DEV_NOTES.md: Architecture decisions
API documentation for each module
Troubleshooting guide
Known issues list


Manual test procedures documented

Key Deliverables:

Playwright test suite passes on Chrome and Firefox
Accessibility issues resolved (WCAG 2.1 AA compliant)
All documentation complete and accurate
Manual test procedures documented
Known issues documented
Browser compatibility validated

Testing:

E2E test: Practice workflow (load, play, feedback)
E2E test: Notation rendering
E2E test: Tuner functionality
E2E test: Settings persistence
E2E test: Keyboard navigation
Accessibility: Keyboard-only navigation test
Accessibility: Screen reader test
Accessibility: Color contrast audit
Manual: Cross-browser testing checklist

Architecture Reference:

§9.4 (E2E Testing Strategy)
§7.1 (Accessibility Requirements)
§11 (Browser Compatibility Layer)

Governance Requirements:

Update CLINE_TODO.md to mark M13 complete, M14 in progress
Append M13 completion to CLINE_MEMORY.md
Ensure documentation follows RULES.md standards
Complete final governance validation

Acceptance Criteria:

npx playwright test passes all E2E tests
WCAG 2.1 AA compliance validated
README.md complete with setup instructions
TESTING.md documents all test procedures
Keyboard navigation fully functional
Chrome and Firefox both pass all tests


SUB-PROMPT 15: Deployment & Demo
Objective: Prepare production deployment, optimize assets, deploy to GitHub Pages, and create demo materials.
Scope:

Asset optimization:

Compress audio samples (WAV to OGG conversion)
Optimize images (PNG compression)
Minify CSS (optional for v1)
Review file sizes


Git LFS setup for Magenta model files:

Configure .gitattributes
Track model/*.bin and model.json
Verify LFS installation
Alternative: Document model download instructions


GitHub Pages configuration:

Configure repository settings (Pages source)
Custom domain setup (optional)
HTTPS enforcement
Deploy to gh-pages branch or docs folder


Deployment script creation:

Automated deployment script
Build process (if needed)
Asset copying
Git commit and push


Browser compatibility final validation:

Test on Chrome stable
Test on Firefox stable
Verify feature detection warnings
Document browser requirements in README


Performance final check:

Run full performance test suite
Verify latency targets met
Check memory usage in production
Validate loading times


Security audit:

Run npm audit
Check for dependency vulnerabilities
Review Content Security Policy
Verify no sensitive data exposed


Demo video creation:

Script and storyboard
Record key features:

Exercise loading
Playback with cursor
Real-time pitch detection (if possible)
Tuner functionality
Settings panel


Edit and publish (YouTube, README)


Release notes writing:

Feature summary
Known limitations
Browser requirements
Installation instructions
Credits and licenses


Future roadmap documentation:

Version 2 features planned
Version 3 considerations
Community contribution guidelines


Issue templates creation:

Bug report template
Feature request template
Question template


Contributing guidelines:

Code style requirements
Testing requirements
Pull request process
Governance compliance



Key Deliverables:

Application deployed to GitHub Pages and accessible
All assets optimized for web delivery
Demo video published and linked in README
Release notes complete with features and limitations
Security audit clean (no critical vulnerabilities)
Browser compatibility documented
Contributing guidelines published
Issue templates available

Testing:

Manual: Production site loads correctly at GitHub Pages URL
Manual: All features functional in production environment
Manual: Test on different devices/browsers
Manual: Demo video validates key features
Security: npm audit shows no critical issues
Performance: Production site meets latency targets

Architecture Reference:

§13 (Deployment Architecture)
§12.5 (Dependency Security)
§11 (Browser Compatibility)

Governance Requirements:

Update CLINE_TODO.md to mark M14 complete, M15 in progress
Append M14 completion to CLINE_MEMORY.md
Final CLINE_MEMORY.md summary entry
Mark project milestone M15 complete
Final governance validation (npm run lint:rules)

Acceptance Criteria:

Site deployed and accessible at GitHub Pages URL
Demo video published and embedded in README
npm audit shows zero critical vulnerabilities
All features work in production
Browser requirements documented
Release notes published
Assets optimized (sample files compressed)


Governance Strategy Recommendation
Milestone Boundaries + Critical Checkpoints
Rationale: Balance rigor with development velocity by catching issues early without excessive overhead.
Implementation:
Every Sub-Prompt (M0-M15):

Start: Update .cline/CLINE_TODO.md with current task
During: Pre-commit hook validates governance files exist
End: Append completion to CLINE_MEMORY.md with timestamp

Milestone Boundaries (End of M0, M3, M6, M9, M12, M15):

Full npm run lint:rules execution
Governance file completeness check
Branch naming validation
PR checklist completion
Test coverage validation

Critical Checkpoints (Module completion, integration points):

Verify tests exist and pass
Check JSDoc coverage
Validate event emissions documented
Review error handling

This approach ensures compliance without blocking progress.

Summary Statistics
Total Sub-Prompts: 15 (M0-M15)
Module Breakdown:

Environment & Setup: 2 (M0-M1)
Core Modules: 9 (M2-M10)
Performance & Testing: 3 (M11-M13)
Documentation & Deployment: 2 (M14-M15)

Testing Coverage:

Unit tests: All modules (M1-M10, M12)
Integration tests: Pipelines (M13)
E2E tests: User workflows (M14)
Performance tests: Optimization validation (M12)

Key Architectural Decisions:

Single OSMD instance renders both staves (simplified from dual renderer)
Event-driven architecture with EventEmitter pattern
Graceful degradation for advanced features (polyphonic, AudioWorklet)
Client-side only (no backend services)
Performance-first design (≤80ms latency target)

Technology Stack:

Vanilla JavaScript (ES6+)
OpenSheetMusicDisplay (single instance, dual staves)
Tone.js (audio synthesis & scheduling)
TensorFlow.js (polyphonic detection)
Web Audio API (pitch detection)
LocalStorage (persistence)
Playwright (E2E testing)
Node.js test runner (unit/integration tests)