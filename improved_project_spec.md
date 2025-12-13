PROJECT_SPEC.md — Guitar4 MusicXML Guitar Training App
Version: 2.0
Author: Enhanced specification for Guitar4 project
Date: 2025-11-01
Status: Development Ready

1. Executive Summary
Guitar4 is a browser-based interactive guitar training application that provides real-time feedback on student performance. The system loads musical exercises in MusicXML format, displays synchronized standard notation and tablature, plays reference audio, captures student performance through microphone input, analyzes pitch and timing accuracy, and provides immediate visual and scored feedback.
Key Differentiators

Dual-view synchronized notation rendering (standard staff and tablature)
Real-time polyphonic pitch detection optimized for guitar
Deterministic playback with sub-100ms latency targets
Progressive web application with offline capability
Comprehensive error recovery and graceful degradation
Performance metrics collection for continuous improvement


2. Project Goals and Scope
Primary Goals (Version 1)

Accurate MusicXML rendering with synchronized notation and tablature views
Real-time audio input processing with monophonic and polyphonic detection
Low-latency playback engine with deterministic scheduling
Visual feedback system showing note correctness and timing accuracy
Functional tuner with visual needle display and pitch accuracy indicators
Multi-instrument playback supporting synthesized and sample-based audio
Client-side data persistence for user progress and settings
Comprehensive test coverage including unit and end-to-end tests
Browser compatibility for Chromium and Firefox on desktop platforms

Secondary Goals (Version 1)

Performance metrics dashboard showing latency measurements
Progressive rendering for large musical scores
Adaptive buffer sizing for pitch detection optimization
Graceful degradation when advanced features unavailable
Accessibility features including keyboard navigation
Developer documentation for module integration

Explicit Non-Goals (Version 1)

Mobile-first responsive design (desktop prioritized)
Backend services or user authentication systems
Cloud synchronization of user data
Safari browser compatibility (deferred to Version 2)
Social features or multi-user collaboration
Advanced music theory analysis beyond note detection
Video synchronization or instructor recording features

Future Considerations (Version 2+)

Mobile application with touch-optimized interface
MIDI input device support for electric guitars with MIDI pickups
Advanced chord recognition and voicing analysis
Rhythm pattern visualization and polyrhythm exercises
Export functionality for practice recordings
Progressive exercise difficulty adaptation
Safari browser support with AudioWorklet polyfills
Cloud backup and cross-device synchronization


3. Target Platform and Technical Constraints
Browser Support Matrix
Primary Targets (Version 1)

Chromium-based browsers: Chrome 90+, Edge 90+
Firefox 88+
Desktop operating systems: Windows 10+, macOS 10.14+, Linux (Ubuntu 20.04+)

Known Limitations

Safari deferred due to AudioWorklet implementation differences
Mobile browsers not optimized due to screen real estate constraints
Older browser versions lacking Web Audio API features will receive degraded experience

Hardware Requirements

Minimum: Dual-core processor, 4GB RAM, integrated audio
Recommended: Quad-core processor, 8GB RAM, dedicated audio interface
Microphone: Built-in acceptable, external USB microphone recommended
Display: 1280x720 minimum resolution, 1920x1080 recommended
Audio latency: System audio latency under 50ms preferred for best experience

Network Requirements

Initial load: Broadband connection for asset downloads (MusicXML, samples, ML models)
Offline mode: Full functionality available after initial asset caching
Progressive enhancement: Core features work with limited bandwidth


4. System Architecture Overview
High-Level Architecture Pattern
The application follows a modular event-driven architecture where core modules communicate through standardized event interfaces. Each module maintains single responsibility and exposes minimal public APIs for testability.
Core Module Responsibilities
Exercise Loader Module

Parses MusicXML files and validates structure
Extracts staff-specific data for notation and tablature rendering
Generates unified timeline representation with note events
Handles MIDI file import as secondary format
Provides error recovery for malformed input files

Notation Renderer Module

Manages dual OSMD instances for notation and tablature
Implements progressive rendering for large scores
Maintains stable element mapping between timeline and DOM
Handles dynamic layout adjustments and system breaks
Provides zoom and pan controls for user navigation

Playback Engine Module

Converts musical time to absolute millisecond timestamps
Implements deterministic scheduling using Tone.js Transport
Manages playback state machine (stopped, playing, paused)
Emits timing events for cursor synchronization
Coordinates audio synthesis and sample playback
Handles tempo changes and repeat structures

Pitch Detection Module (Monophonic)

Implements YIN algorithm for fundamental frequency detection
Uses adaptive buffer sizing based on pitch range
Applies noise gating to filter background interference
Provides confidence scoring for detected pitches
Implements harmonic product spectrum as fallback method
Outputs normalized pitch stream with frequency and MIDI number

Polyphonic Detection Module

Integrates TensorFlow Lite version of Onsets & Frames model
Handles model loading with progress indication
Processes audio in chunks suitable for browser constraints
Outputs array of simultaneous MIDI note numbers
Provides graceful fallback to monophonic detection on model load failure
Implements memory-efficient buffering for real-time processing

Analyzer Module

Implements Dynamic Time Warping for performance alignment
Calculates per-note accuracy metrics (pitch correctness, timing deviation)
Generates aggregate scoring (percentage correct, timing consistency)
Provides configurable tolerance thresholds for difficulty levels
Outputs structured results for visualization layer
Maintains performance history for progress tracking

Tuner Module

Implements real-time pitch display with visual needle
Applies exponential smoothing to reduce display jitter
Provides color-coded accuracy zones (green/orange/red)
Displays frequency with sub-Hertz precision
Shows cents deviation from nearest semitone
Supports reference pitch adjustment for alternate tunings

UI Manager Module

Orchestrates tab navigation (Practice, Tuner, Lessons, Settings)
Manages application state and view synchronization
Coordinates user input events with module actions
Implements responsive layout adjustments
Handles error presentation and user notifications
Manages audio context lifecycle (user gesture requirement)

Storage Module

Abstracts LocalStorage operations with structured API
Implements versioned data schemas for migration support
Provides transaction-like operations for atomic updates
Handles quota exceeded scenarios gracefully
Prepares interfaces for future backend integration
Stores user progress, settings, and exercise history

Data Flow Architecture
Loading Phase

User selects exercise file (MusicXML)
Exercise Loader parses and validates content
Loader generates ExerciseJSON with timeline and separated staves
Notation Renderer creates dual OSMD instances
Playback Engine receives timeline for scheduling preparation
Storage Module saves last-opened exercise reference

Playback Phase

User initiates playback via UI controls
UI Manager requests audio context activation (user gesture)
Playback Engine schedules note events on Tone.js Transport
Engine emits tick events at scheduled note times
Notation Renderer updates cursor position and highlights active notes
Synchronized scrolling maintains cursor visibility
Audio synthesis or sample playback produces reference sound

Performance Capture Phase

User enables microphone input via UI
Pitch Detection Module receives audio stream from Web Audio API
Monophonic detector analyzes for single-note passages
Polyphonic detector activates for chord passages (based on score complexity)
Detected pitch stream normalized to common format
Analyzer receives both reference timeline and detected events
DTW alignment produces per-note correctness results
UI displays real-time feedback overlay on notation

Tuner Mode Phase

User navigates to Tuner tab
Tuner Module activates dedicated pitch detection
Real-time frequency display updates with smoothing filter
Visual needle and color zones indicate tuning accuracy
Cents deviation calculated from nearest standard pitch


5. Data Contracts and Interfaces
ExerciseJSON Schema
The central data structure representing a parsed musical exercise. All modules operate on or reference this structure.
Structure Definition

Exercise identifier (unique string)
Title and composer metadata
Tempo (beats per minute) and time signature
Instrument tuning specification (array of pitch strings)
System layout information for pagination
Timeline array of note events with timing and pitch data
Separated OSMD input strings for notation and tablature rendering
Optional MIDI track data for enhanced playback

Timeline Event Structure

Absolute time in milliseconds from exercise start
Duration in milliseconds
MIDI note number for pitch
Unique note identifier for DOM element mapping
Staff number for notation/tablature differentiation
Optional articulation and dynamics information

Pitch Stream Event Structure
Normalized output from pitch detection modules consumed by analyzer.
Monophonic Event

Timestamp in milliseconds since capture start
Detected frequency in Hertz
Cents deviation from nearest semitone
MIDI note number (nearest match)
Confidence score (0-1 range)

Polyphonic Event

Timestamp in milliseconds since capture start
Array of MIDI note numbers (simultaneous detections)
Optional confidence scores per note
Onset flag indicating attack detection

Playback Event Types
Event-driven interface between Playback Engine and dependent modules.
Event Categories

Playback started (includes start offset time)
Tick event (timestamp, note identifier, system number)
System change event (new system number for scrolling)
Playback paused (current position)
Playback stopped (reset to beginning)
Playback completed (end of exercise reached)
Tempo changed (new BPM value)

Analysis Result Structure
Output from Analyzer Module consumed by UI for feedback visualization.
Per-Note Results

Note identifier referencing timeline event
Pitch correctness (correct, incorrect, missed)
Timing deviation in milliseconds (early/late)
Detected pitch if incorrect
Timestamp of detection

Aggregate Results

Overall correctness percentage
Timing consistency score
Notes played correctly count
Notes missed count
Early/late timing statistics


6. Functional Requirements
Exercise Loading and Parsing
MusicXML Support

Accept MusicXML 3.0+ format files via file input or drag-drop
Validate document structure and required elements
Parse part structure, measures, notes, and timing
Extract staff attributes including clef and key signature
Separate notation staff (staff 1) and tablature staff (staff 2)
Generate independent OSMD input strings for each staff type
Build unified timeline merging all note events with absolute timing
Handle multi-part scores by focusing on primary instrument part
Provide detailed error messages for malformed files

MIDI Support (Secondary)

Import Standard MIDI Files (SMF) Format 0 and 1
Convert MIDI events to simplified timeline representation
Map MIDI program changes to instrument selection
Handle tempo changes encoded in MIDI meta-events
Provide limited notation generation from MIDI (no tablature)

Asset Management

Store up to five sample exercise files in bundled assets directory
Support user-uploaded files with client-side storage
Implement file size limits to prevent memory exhaustion
Cache parsed ExerciseJSON in LocalStorage for quick reload
Provide exercise library UI for browsing available exercises

Error Handling

Validate file format before parsing
Display user-friendly error messages for parsing failures
Provide fallback to basic timeline view if rendering fails
Log detailed errors to console for developer troubleshooting
Maintain application stability when encountering corrupt files

Acceptance Criteria

Sample MusicXML files load without errors
Timeline contains expected note count and timing accuracy
Separated OSMD inputs render only appropriate staff types
User-uploaded files parse successfully or display clear error messages
Cached exercises load faster than initial parse


Notation and Tablature Rendering

Render an OSMD instance
Display standard notation (treble clef) and guitar tablature 
Support responsive layout adjustment based on viewport width

OSMD Configuration

Initialize OSMD 
Configure rendering options for optimal clarity
Enable cursor display for playback tracking
Disable interactive features not needed for display
Apply custom CSS for styling consistency with application theme

DOM Element Mapping

Assign unique data-note-id attributes to rendered note elements
Establish mapping between timeline note identifiers and SVG elements
Provide API for querying DOM elements by note identifier
Support highlighting of active notes during playback
Enable hover interactions for note inspection

Progressive Rendering

Prioritize rendering of visible measures for large scores
Implement lazy loading for systems outside viewport
Show loading indicator during initial render
Optimize SVG generation to reduce memory footprint
Cache rendered systems to improve panning performance

Accessibility Features

Provide alternative text descriptions for notation images
Support keyboard navigation through notation elements
Implement focus indicators for accessibility compliance
Ensure sufficient color contrast for visual elements
Provide screen reader descriptions for musical content

Acceptance Criteria

Two distinct OSMD container elements present in DOM
Each container shows only notation or tablature respectively
Rendered notes contain data-note-id attributes matching timeline
Large scores (200+ measures) render without browser freeze
Zooming and panning maintain synchronized view positions


Playback Engine and Timeline Synchronization
Scheduling System

Convert musical time (beats) to absolute milliseconds using tempo
Use Tone.js Transport for deterministic event scheduling
Pre-schedule all note events before playback begins
Maintain event queue for real-time event emission
Handle tempo changes mid-exercise with timing recalculation
Support playback offset for starting mid-exercise

Playback Controls

Play button initiates playback from current position
Pause button suspends playback retaining current position
Stop button resets position to exercise beginning
Seek functionality for jumping to specific measures
Tempo adjustment slider modifying playback speed
Metronome toggle for audible beat reference

Cursor Management

Initialize cursor at first musical note (skip clef and time signature)
Update cursor position on each tick event
Highlight active note elements using CSS class modification
Remove highlighting from previous notes
Handle chords by highlighting all simultaneous notes
Maintain cursor visibility through synchronized scrolling

Synchronized Scrolling

Calculate vertical offset to center cursor in viewport
Trigger scroll when cursor crosses lower viewport threshold
Apply same vertical offset to both notation and tablature views
Implement smooth scrolling with configurable easing
Prevent scroll jitter with hysteresis threshold
Handle rapid system changes gracefully

Audio Context Management

Require user gesture before audio context creation (browser policy)
Display "Start Audio Context" button prominently
Provide visual feedback for audio context state
Resume suspended audio contexts automatically
Handle audio context interruptions (system sleep, tab backgrounding)

Acceptance Criteria

Playback at 120 BPM produces tick events at mathematically correct intervals
Cursor starts on first musical note ignoring clef symbols
Cursor remains visible during playback of multi-system exercises
Both notation and tablature views scroll synchronously
Tempo changes mid-exercise maintain timing accuracy


Audio Synthesis and Sample Playback
Synthesis Mode

Use Tone.js synthesizers for immediate playback
Select appropriate synth type for instrument character
Configure envelope parameters for natural attack and decay
Apply velocity dynamics from note metadata
Handle note overlaps and sustain

Sample Mode

Load one-shot audio samples mapped to MIDI note numbers
Store samples in assets directory with standardized naming
Support multiple sample sets for different instruments
Implement sample caching to reduce load times
Provide fallback to synthesis if samples missing

Sample Management

Acoustic guitar samples covering typical fretboard range
Piano samples for alternate instrument playback
Sample naming convention: MIDI_NUMBER.wav (e.g., 60.wav for middle C)
Preload samples during initialization phase
Display loading progress for sample sets

Instrument Selection

UI dropdown for instrument selection (Guitar, Piano, Synth)
Switch between sample sets without stopping playback
Apply appropriate sample set for newly loaded exercises
Store instrument preference in LocalStorage

Audio Performance

Minimize latency between scheduled time and audio output
Use Web Audio API for lowest possible latency path
Monitor actual output timing for latency measurement
Adjust buffer sizes based on system capabilities
Provide audio settings panel for advanced users

Acceptance Criteria

Synthesis mode produces audible tones for all MIDI notes
Sample mode loads acoustic guitar samples and plays correctly
Instrument selection persists across sessions
Audio output synchronized with visual cursor within target latency
No audio glitches or pops during sample playback


Pitch Detection (Monophonic)
YIN Algorithm Implementation

Implement autocorrelation-based YIN algorithm for fundamental frequency detection
Use Web Audio API AnalyserNode for time-domain audio capture
Configure FFT size of 2048 samples for balance of resolution and latency
Calculate difference function and cumulative mean normalized difference
Apply absolute threshold for period detection
Perform parabolic interpolation for sub-sample accuracy

Adaptive Processing

Adjust buffer size based on detected pitch range (longer for bass notes)
Implement multi-resolution analysis for ambiguous pitches
Use harmonic product spectrum as fallback when YIN confidence low
Apply noise gate to ignore signals below threshold amplitude
Filter out DC offset and low-frequency rumble

Confidence Scoring

Calculate confidence based on clarity of autocorrelation peak
Consider harmonic-to-noise ratio in confidence metric
Reject detections below minimum confidence threshold
Output confidence value with each pitch detection event

Real-Time Performance

Process audio in non-blocking manner using AudioWorklet
Maintain processing latency under 30ms for detection phase
Output pitch stream at configurable update rate (default 50Hz)
Minimize CPU usage through efficient algorithm implementation

Frequency Conversion

Convert detected frequency to nearest MIDI note number
Calculate cents deviation from equal temperament
Handle pitch bending and vibrato appropriately
Support alternate tuning systems through reference pitch adjustment

Acceptance Criteria

Sustained A4 (440Hz) detected within ±2 Hz accuracy
Guitar open strings detected correctly across all six strings
Confidence scoring rejects background noise reliably
Processing latency measured under 30ms from input to output
Pitch stream updates consistently at target rate


Polyphonic Detection
Model Integration

Use TensorFlow Lite version of Onsets & Frames model
Load model files from local assets directory (avoid network dependency)
Display loading progress indicator during model initialization
Implement timeout handling for model load failures
Gracefully degrade to monophonic detection if model unavailable

Audio Processing Pipeline

Capture audio using Web Audio API AudioWorklet
Buffer audio into chunks suitable for model input (typically 8 seconds)
Perform resampling if needed for model's expected sample rate
Apply normalization to audio signal for consistent model input

Inference Execution

Run model inference in separate Web Worker to avoid UI blocking
Process audio chunks with overlap to avoid boundary artifacts
Parse model output for note onset detections
Convert model output to MIDI note number array
Associate timestamps with detected note events

Performance Optimization

Limit chunk size to prevent browser timeout issues
Implement memory-efficient buffer management
Monitor inference latency and adjust chunk size if needed
Provide real-time vs. post-processing modes based on capabilities

Error Handling

Detect model load failures and display user notification
Handle insufficient memory scenarios gracefully
Provide fallback to monophonic detection automatically
Log detailed errors for troubleshooting

Future Consideration

Support for MT3 model as optional advanced feature
User-selectable model for accuracy vs. performance trade-off
Downloadable model packs for different instruments

Acceptance Criteria

Onsets & Frames model loads from local assets within 10 seconds
Two-note guitar chord detected as two separate MIDI numbers
Memory usage remains stable during extended sessions
Graceful fallback occurs when model unavailable
Loading progress displayed to user during initialization


Performance Analysis and Alignment
Dynamic Time Warping (DTW)

Implement DTW algorithm for aligning detected events to reference timeline
Use configurable cost function for pitch and timing errors
Apply boundary constraints to prevent pathological alignments
Optimize algorithm for real-time performance constraints
Output alignment path mapping detected to reference events

Per-Note Evaluation

Compare detected pitch to reference MIDI note
Calculate pitch correctness within tolerance threshold (default ±50 cents)
Measure timing deviation between detected and reference timestamps
Classify timing as early, on-time, or late within tolerance (default ±100ms)
Flag notes as correct, incorrect pitch, or missed

Aggregate Scoring

Calculate percentage of notes played correctly
Compute average timing deviation and standard deviation
Generate timing consistency score
Provide breakdown of error categories
Track performance history for progress visualization

Difficulty Presets

Easy: 200ms timing tolerance, ±100 cents pitch tolerance
Normal: 100ms timing tolerance, ±50 cents pitch tolerance
Hard: 50ms timing tolerance, ±25 cents pitch tolerance
Custom: User-defined tolerance values

Real-Time Feedback

Generate analysis results with minimal delay after note detection
Update UI with per-note correctness indicators
Maintain running score during live performance
Provide visual cues for timing (early/late arrows)

Performance History

Store analysis results for each practice session
Track improvement over time for specific exercises
Generate progress reports and visualizations
Support export of performance data for external analysis

Acceptance Criteria

Synthetic test data with perfect performance yields 100% correctness
Intentionally mistimed notes flagged appropriately by difficulty level
Analysis completes within 100ms of receiving detection event
Historical performance data persists across sessions
Progress visualization shows meaningful trends


Tuner Functionality
Pitch Display

Show detected frequency with 0.1 Hz precision
Display nearest note name (e.g., E4, A3)
Indicate cents deviation from nearest equal temperament pitch
Update display at smooth rate (30-60 Hz)

Visual Needle Indicator

Render needle-style gauge showing pitch deviation
Center position indicates perfect tune
Needle deflection proportional to cents deviation (±50 cents range)
Apply exponential smoothing to reduce visual jitter

Color-Coded Accuracy Zones

Green zone: within ±5 cents (in tune)
Orange zone: within ±6 to ±20 cents (close)
Red zone: beyond ±20 cents (out of tune)
Apply color to needle, background, or both for clear feedback

Smoothing Filter

Implement exponential moving average for pitch values
Configurable smoothing factor balancing responsiveness and stability
Apply separate smoothing to frequency and cents deviation
Reduce rapid fluctuations while maintaining responsiveness to tuning changes

Reference Pitch Adjustment

Allow user to set reference A4 frequency (default 440 Hz)
Support common reference pitches (432 Hz, 442 Hz, etc.)
Recalculate all note frequencies based on adjusted reference
Store reference preference in LocalStorage

Acceptance Criteria

Sustained A4 tone displays 440.0 Hz (±0.1 Hz) with green indicator
Slightly flat note shows appropriate cents deviation with orange/red color
Needle movement smooth without excessive jitter
Reference pitch adjustment affects all calculations correctly
Tuner remains stable during background noise


User Interface and Experience
Tab Navigation Structure

Practice tab: main exercise view with notation, controls, and feedback
Tuner tab: dedicated tuner interface with large visual display
Lessons tab: exercise library and selection interface
Settings tab: user preferences and configuration options

Practice Tab Layout

Dual notation views (standard and tablature) occupy primary space
Playback controls (play, pause, stop) prominently positioned
Tempo slider and metronome toggle easily accessible
Real-time feedback overlay on notation indicating note correctness
Score display showing current performance metrics
Progress bar indicating position in exercise

Playback Controls

Large play/pause button with clear icon
Stop button to reset playback
Tempo control with numeric display and slider
Metronome toggle with visual beat indicator
Audio mode selector (synth vs. sample)
Volume controls for playback and metronome

Audio Context Activation

Display "Start Audio Context" button on initial page load
Provide clear explanation of browser audio policy requirement
Show activation status indicator
Enable playback controls only after activation
Remember activation state during session

Settings Panel

Instrument selection dropdown (Guitar, Piano, Synth)
Tuning presets for standard and alternate guitar tunings
Difficulty level selection for analysis tolerances
Audio settings: latency preference, buffer size
LocalStorage management: clear saved data, export progress
Accessibility options: keyboard shortcuts, contrast mode

Feedback Visualization

Highlight correct notes in green immediately after detection
Highlight incorrect notes in red showing detected vs. expected pitch
Display timing arrows (early/late) near notes
Show running score and note count in header
Provide end-of-exercise performance summary

Keyboard Shortcuts

Spacebar: play/pause toggle
Escape: stop playback
Arrow keys: seek forward/backward by measure
Plus/minus: tempo adjustment
M: metronome toggle
Tab: cycle through tabs

Responsive Considerations

Optimize layout for desktop viewport widths (1280px+)
Gracefully handle smaller windows with scrolling
Adjust notation view aspect ratio to fit available space
Provide collapsible panels for secondary controls

Acceptance Criteria

All tabs accessible and functional
Playback controls respond immediately to user input
Audio context button appears on first load and not thereafter
Settings persist across browser sessions
Keyboard shortcuts work as documented
Visual feedback displays in real-time during performance


Data Persistence and Storage
LocalStorage Integration

Store user settings (instrument, tuning, difficulty, tempo preference)
Cache parsed ExerciseJSON for quick reload
Save performance history (scores, timestamps, exercise identifiers)
Store last-opened exercise reference for session restoration
Maintain audio context activation state

Storage API Design

Prefix all keys with namespace (e.g., "g4:") to avoid collisions
Implement versioned data schemas for migration support
Provide get, set, delete, and clear operations
Handle quota exceeded errors gracefully
Support transactional updates for related data

Data Schema Versioning

Include schema version number in stored data
Implement migration functions for schema updates
Validate data structure on read
Provide fallback to defaults for incompatible versions

Performance History Structure

Array of performance objects with exercise ID, timestamp, score
Limit history size to prevent quota exhaustion
Implement circular buffer for automatic pruning of old entries
Support export to JSON for external backup

Settings Structure

Flat object with typed values
Include validation rules for each setting
Provide default values for all settings
Support reset to defaults function

Future Backend Integration Hooks

Design storage API to abstract underlying implementation
Prepare for backend sync by including device/session identifiers
Include timestamps for conflict resolution
Plan for incremental sync to minimize bandwidth

Error Handling

Detect quota exceeded scenarios
Notify user when storage limits reached
Provide option to clear old data
Continue operation with in-memory storage if persistent storage fails

Acceptance Criteria

Settings persist after browser restart
Last-opened exercise loads automatically on next session
Performance history accessible through UI
Storage quota errors handled without application crash
LocalStorage keys properly namespaced


7. Non-Functional Requirements
Performance Requirements
Latency Targets

Audio input to pitch detection output: ≤30ms
Pitch detection to analyzer input: ≤50ms
Total audio input to visual feedback: ≤80ms (primary target)
Playback tick event to cursor update: ≤20ms
User input to UI response: ≤100ms

Rendering Performance

Initial notation render for typical exercise (50 measures): ≤2 seconds
Cursor position update during playback: 60 fps
Synchronized scrolling: smooth at 60 fps
Notation zoom/pan interactions: responsive at 60 fps

Memory Constraints

Base application memory footprint: ≤50 MB
Magenta model loaded: additional ≤150 MB
Cached exercises: ≤10 MB per exercise
Total application memory: ≤300 MB target
Provide warnings when approaching memory limits

CPU Usage

Idle application: minimal CPU usage (<5%)
Active pitch detection: ≤25% of single core
Playback with synthesis: ≤15% of single core
Combined analysis and rendering: ≤40% of single core

Scalability

Support exercises up to 200 measures without degradation
Handle scores with up to 10 systems per page
Process exercises with duration up to 10 minutes
Maintain responsiveness with 100+ performance history entries


Reliability and Error Recovery
Graceful Degradation

Application remains functional if polyphonic detection fails
Fallback to monophonic detection if model unavailable
Notation view works independently if tablature rendering fails
Playback continues if visual cursor update fails
Core features available even if LocalStorage quota exceeded

Error Boundaries

Isolate rendering failures to individual OSMD instances
Prevent audio context errors from crashing entire application
Contain pitch detection errors to avoid UI freeze
Catch and log unexpected exceptions with context

User-Facing Error Messages

Display clear, actionable error messages for common failures
Avoid technical jargon in error dialogs
Provide recovery suggestions where applicable
Include "Report Issue" links for unexpected errors

Logging and Diagnostics

Console logging for developer troubleshooting
Performance metrics collection (latency measurements)
Error tracking with stack traces
User action logging for reproducing issues

Browser Compatibility Handling

Detect missing Web Audio API features
Warn user if AudioWorklet unavailable
Provide feature detection before attempting initialization
Display compatibility warnings for unsupported browsers


Accessibility Requirements
Keyboard Navigation

All interactive elements accessible via keyboard
Logical tab order through interface elements
Focus indicators visible and high-contrast
Keyboard shortcuts documented and customizable

Screen Reader Support

ARIA labels for all interactive controls
Meaningful alt text for visual elements
Announcements for dynamic content updates
Semantic HTML structure for navigation

Visual Accessibility

Sufficient color contrast ratios (WCAG AA minimum)
Text resizable without breaking layout
Color not sole means of conveying information
High-contrast mode support

Auditory Accessibility

Visual feedback accompanies all audio cues
Metronome includes visual beat indicator
Tuner displays numeric pitch values alongside visual needle
Captions or transcripts for any instructional audio


Testability Requirements
Unit Testing

All core modules expose testable public APIs
Pure functions for business logic where possible
Dependency injection for external dependencies
Achieve ≥80% code coverage for core modules

Integration Testing

Test module communication via event interfaces
Validate data flow through complete pipelines
Test error propagation and recovery

End-to-End Testing

Playwright tests for critical user workflows
Headful browser tests for audio and visual verification
Automated tests for notation rendering
Performance regression tests

Manual Testing Procedures

Document manual test cases for audio quality
Provide checklist for visual inspection
Include latency measurement procedures
Test across supported browser versions


Security and Privacy
Data Privacy

All audio processing occurs client-side
No microphone data transmitted to external servers
User performance data stored locally only
No tracking or analytics without explicit consent

Audio Permissions

Request microphone permission only when needed
Display clear explanation before permission request
Function without microphone for playback-only mode
Allow user to revoke permission at any time

Content Security

Serve application assets over HTTPS in production
Validate all user-uploaded file content
Sanitize any user input before rendering
Prevent cross-site scripting through proper escaping


8. Testing Strategy
Test Pyramid Structure
Unit Tests (Highest Volume)

Exercise loader parsing functions
Playback engine scheduling calculations
Pitch detection algorithms
Analyzer alignment and scoring logic
Storage module CRUD operations

Integration Tests (Medium Volume)

Exercise loader to notation renderer pipeline
Playback engine to audio synthesis coordination
Pitch detection to analyzer data flow
UI manager to module communication

End-to-End Tests (Lower Volume)

Complete practice workflow from load to feedback
Tuner activation and pitch display
Settings persistence across sessions
Exercise selection and playback

Testing Tools
Unit Testing Framework

Node.js test runner for core module tests
Minimal dependencies for fast execution
Mocking for Web Audio API and DOM dependencies

E2E Testing Framework

Playwright for browser automation
Headful mode for audio and visual tests
Screenshot comparison for rendering validation
Video recording for debugging failed tests

Performance Testing

Custom latency measurement utilities

Performance.now() for high-resolution timing
Web Audio API latency measurements
Memory profiling through Chrome DevTools
Automated performance regression detection

Test Data Management
Sample Exercise Files

Provide five representative MusicXML files covering:

Simple single-note melody (Twinkle Twinkle)
Exercise with chords (polyphonic detection test)
Multi-system long-form piece (scrolling test)
Exercise with tempo changes (scheduling test)
Alternate time signature example (4/4, 3/4, 6/8)



Synthetic Test Data

Pre-recorded audio samples for pitch detection validation
Known-good performance recordings for analyzer testing
Timing edge cases (early, late, missed notes)
Polyphonic chord samples for model validation

Mock Objects

Audio context mock for headless testing
OSMD renderer mock for isolated playback tests
Microphone input simulator for deterministic testing
LocalStorage mock for storage tests

Continuous Integration
Automated Test Execution

Run unit tests on every commit
Execute integration tests on pull requests
Schedule E2E tests on main branch merges
Generate coverage reports for all test runs

Test Environment

Use GitHub Actions for CI pipeline
Test on Ubuntu with Chromium and Firefox
Install Playwright browsers in CI environment
Cache dependencies for faster builds

Quality Gates

Require ≥80% code coverage for new code
Block merge if any tests fail
Enforce linting and code style checks
Validate that governance files updated (CLINE_TODO.md, CLINE_MEMORY.md)


9. Development Workflow and Milestones
Milestone Structure
M1: Repository Skeleton and Development Environment

Initialize Git repository with proper structure
Create directory hierarchy for modules and assets
Set up package.json with dependencies
Configure development server
Implement basic module stubs
Write initial unit test demonstrating test framework
Update governance files (CLINE_TODO.md, CLINE_MEMORY.md)

M2: Exercise Loader and MusicXML Parsing

Implement MusicXML file reading and validation
Parse score structure and extract metadata
Separate notation staff and tablature staff
Generate unified timeline with absolute timing
Build ExerciseJSON output structure
Write comprehensive unit tests for parser
Test with all five sample exercise files

M3: Notation and Tablature Rendering

Integrate OpenSheetMusicDisplay library
Create dual OSMD instances for notation and tablature
Implement DOM element mapping with data-note-id attributes
Add progressive rendering for large scores
Style rendered notation for application theme
Write E2E tests validating rendering output

M4: Playback Engine and Cursor Synchronization

Implement deterministic scheduling using Tone.js
Convert musical time to milliseconds
Emit tick events at scheduled note times
Update cursor position on notation and tablature
Implement synchronized scrolling
Handle playback state transitions (play, pause, stop)
Write unit tests for scheduling accuracy

M5: Audio Synthesis and Sample Playback

Integrate Tone.js synthesizers for basic playback
Implement sample loading and playback
Create instrument selection UI
Handle audio context lifecycle and user gesture requirement
Add metronome functionality
Test audio output across browser targets

M6: Monophonic Pitch Detection

Implement YIN algorithm for fundamental frequency
Configure Web Audio API audio capture
Apply adaptive buffer sizing
Implement noise gating and filtering
Output normalized pitch stream
Write tests with pre-recorded audio samples
Measure and validate latency targets

M7: Polyphonic Detection Integration

Download and bundle Onsets & Frames TensorFlow Lite model
Implement model loading with progress indication
Set up audio processing pipeline for model input
Run inference and parse output
Merge polyphonic detections with monophonic stream
Handle graceful degradation if model unavailable
Write smoke tests for model loading

M8: Performance Analysis and Feedback

Implement DTW alignment algorithm
Calculate per-note correctness and timing deviation
Generate aggregate scoring metrics
Create visual feedback overlay on notation
Display real-time performance results
Store performance history in LocalStorage
Write tests with synthetic performance data

M9: Tuner Implementation

Create tuner UI with needle indicator
Implement smoothing filter for display
Add color-coded accuracy zones
Support reference pitch adjustment
Integrate pitch detection for tuner mode
Test tuner accuracy with known frequencies

M10: Settings, Storage, and Polish

Implement LocalStorage persistence
Create settings panel UI
Add user preference controls
Implement data export functionality
Polish visual design and animations
Conduct cross-browser testing
Write comprehensive E2E test suite

M11: Documentation and Deployment

Complete README.md with setup instructions
Finalize TESTING.md with all test procedures
Update DEV_NOTES.md with architecture decisions
Prepare GitHub Pages deployment configuration
Create release notes and feature summary
Record demo video showcasing key features

Branch Strategy
Branch Naming Convention

feature/milestone-name for new feature work
fix/issue-description for bug fixes
test/test-suite-name for test additions
docs/documentation-topic for documentation updates

Pull Request Process

One PR per milestone with clear description
Include test results in PR description
Validate governance file updates (RULES.md compliance)
Require passing CI before merge
Request code review for significant changes

Commit Message Format

Use conventional commit format: type(scope): description
Include milestone reference in commit body
Reference related issues or specifications
Keep commits atomic and focused

Development Commands
Server and Build

npm start: Launch development server (Express on port 8000)
npm run build: Prepare production build (future)
npm run serve: Serve production build locally (future)

Testing

npm test: Run all unit tests
npm run test:unit: Run unit tests only
npm run test:e2e: Run Playwright E2E tests
npm run test:e2e:headed: Run E2E tests with visible browser
npm run test:coverage: Generate coverage report
npm run lint:rules: Validate RULES.md compliance

Development Tools

npm run format: Auto-format code (future with Prettier)
npm run lint: Run ESLint checks (future)
npm run type-check: Run TypeScript type checking (if added later)


10. Asset Management and Model Integration
Exercise Files
Bundled Samples

Store in assets/exercises/ directory
Include five representative MusicXML files:

twinkle2.xml (provided) - simple melody
chord-exercise.xml - polyphonic test case
long-form.xml - multi-system scrolling test
tempo-change.xml - variable tempo test
alternate-time.xml - 3/4 or 6/8 time signature



User Uploads

Support file input and drag-drop upload
Validate file size (max 5 MB per file)
Store uploaded files in LocalStorage as base64
Provide file management UI for deleting uploads

Audio Samples
Sample Library Structure

Store in assets/samples/ directory
Subdirectories per instrument: guitar/, piano/
File naming: MIDI_NUMBER.wav (e.g., 60.wav for middle C)

Guitar Samples

Cover MIDI range 40-84 (E2 to C6)
Record clean guitar tone without effects
Normalize amplitude for consistency
Format: WAV or OGG, mono, 44.1kHz sample rate
File size target: <100 KB per sample

Piano Samples

Cover MIDI range 21-108 (A0 to C8)
Use acoustic grand piano recordings
Apply minimal processing for natural sound
Same format specifications as guitar samples

Sample Acquisition

Consider open-source sample libraries (freesound.org, etc.)
Verify licensing for distribution
Document sample sources and licenses

Magenta Model Files
Model Storage

Store in assets/models/magenta/ directory
Include TensorFlow Lite version of Onsets & Frames
Typical files: model.json, weights binary files
Total size approximately 100-150 MB

Git LFS Consideration

Use Git Large File Storage for model files
Configure .gitattributes for binary tracking
Document LFS setup in README for contributors
Provide alternative download links if LFS unavailable

Model Loading

Implement loading with progress indication
Show estimated download/load time
Cache loaded model in memory for session
Provide retry mechanism for failed loads

Fallback Strategy

Detect model load failures gracefully
Automatically switch to monophonic-only mode
Display user-friendly notification explaining limitation
Offer manual retry option


11. Performance Monitoring and Optimization
Latency Measurement
Measurement Points

Audio input received (Web Audio API timestamp)
Pitch detection completed (algorithm output timestamp)
Analyzer received detection event (analyzer input timestamp)
Visual feedback displayed (DOM update timestamp)
Calculate deltas and log to console

Measurement Implementation

Use Performance.now() for high-resolution timestamps
Log measurements during development mode only
Aggregate statistics over multiple detections
Display average, min, max latency in debug panel

Target Validation

Alert developer if latency exceeds 80ms target
Include latency tests in automated test suite
Provide visualization of latency over time
Identify performance regressions through CI

Memory Profiling
Monitoring Strategy

Track heap size using performance.memory API
Monitor memory after model loading
Detect memory leaks during extended sessions
Provide memory usage display in debug panel

Optimization Techniques

Implement object pooling for frequently created objects
Release OSMD instances when switching exercises
Clear audio buffers after processing
Limit performance history size to prevent unbounded growth

Rendering Optimization
Progressive Rendering

Render only visible systems initially
Lazy-load off-screen systems on demand
Implement virtual scrolling for very large scores
Cache rendered SVG elements

SVG Optimization

Minimize DOM node count in rendered notation
Use CSS transforms for cursor positioning
Avoid layout thrashing during cursor updates
Debounce resize handlers

Audio Processing Optimization
Buffer Management

Use efficient buffer sizes (power of 2)
Minimize memory allocations in audio thread
Implement double-buffering for smooth processing
Release buffers promptly after use

Algorithm Efficiency

Optimize YIN algorithm inner loops
Use typed arrays for numerical operations
Consider WebAssembly for critical algorithms (future)
Profile hot code paths and optimize


12. Browser Compatibility and Degradation
Feature Detection
Required Features

Web Audio API (AudioContext, AnalyserNode, AudioWorklet)
ES6+ JavaScript features (modules, async/await, classes)
LocalStorage API
File API for file uploads
SVG rendering

Optional Features

AudioWorklet (fallback to ScriptProcessorNode)
TensorFlow.js and WebGL (graceful degradation)
Clipboard API for data export
Notifications API for background alerts

Detection Implementation

Check for feature availability before initialization
Display compatibility report on unsupported browsers
Provide degraded experience when possible
Link to supported browser download pages

Browser-Specific Considerations
Chromium Browsers (Chrome, Edge)

Primary target with full feature support
Optimize for V8 JavaScript engine
Test with latest stable releases

Firefox

Full Web Audio API support confirmed
Test AudioWorklet implementation
Validate performance parity with Chromium

Safari (Future Version 2)

AudioWorklet implementation differences
May require polyfills or workarounds
Test on macOS and iOS when prioritized

Fallback Strategies
AudioWorklet Unavailable

Fall back to ScriptProcessorNode for pitch detection
Accept higher latency as trade-off
Warn user about degraded performance

Polyphonic Detection Unavailable

Disable polyphonic features gracefully
Continue with monophonic detection only
Update UI to reflect limited functionality

LocalStorage Quota Exceeded

Switch to in-memory storage for session
Warn user that data won't persist
Offer data export before clearing


13. Licensing and Legal Considerations
Application License
Recommended License: MIT

Permissive open-source license
Allows commercial and private use
Requires attribution to original authors
Provides no warranty

License File

Include LICENSE.txt in repository root
Specify copyright holder and year
Follow standard MIT license template

Third-Party Dependencies
Required Attribution

OpenSheetMusicDisplay (BSD-3-Clause)
Tone.js (MIT)
TensorFlow.js (Apache 2.0)
Magenta models (Apache 2.0)

Dependency Documentation

Maintain THIRD_PARTY_LICENSES.md file
List all dependencies with license types
Include links to original repositories
Update file when adding new dependencies

Sample Audio Licensing
Sourcing Requirements

Use royalty-free or public domain samples
Verify licensing allows redistribution
Document sample sources and attributions
Consider recording original samples to avoid licensing issues

User-Generated Content
Uploaded Exercises

User retains copyright to uploaded files
Application does not claim ownership
No transmission to external servers
User responsible for legality of content


14. Accessibility and Internationalization
Accessibility Standards
Target Compliance

WCAG 2.1 Level AA minimum
Section 508 compliance where applicable
Support for assistive technologies

Implementation Requirements

Semantic HTML structure
ARIA labels and roles
Keyboard navigation support
Screen reader compatibility testing

Visual Accessibility

Color contrast ratios ≥4.5:1 for normal text
Color contrast ratios ≥3:1 for large text
Visual feedback not relying solely on color
Resizable text without layout breakage

Auditory Accessibility

Visual metronome alongside audio clicks
Visual beat indicator during playback
Tuner displays numeric values alongside visual needle
No information conveyed by audio alone

Internationalization Preparation (Future)
Text Externalization

Prepare string constants for translation
Use consistent key naming convention
Document context for translators

Locale-Specific Formatting

Use Intl API for number and date formatting
Support decimal separators based on locale
Handle right-to-left languages in layout

Musical Notation

Note naming conventions (C/Do, A/La systems)
Frequency standards (A=440Hz vs. alternatives)
Support for international notation preferences


15. Future Enhancements and Roadmap
Version 2 Features
Mobile Support

Responsive design for tablets and phones
Touch-optimized controls
Vertical layout for portrait orientation
Performance optimization for mobile processors

Safari Compatibility

Test and resolve AudioWorklet issues
Implement necessary polyfills
Validate performance on macOS and iOS
Document Safari-specific quirks

Enhanced MIDI Support

Real-time MIDI input from external devices
MIDI guitar pickup support
MIDI output for external synthesis
MIDI file export of performances

Version 3 Considerations
Advanced Analysis

Chord voicing recognition
Rhythm pattern detection
Dynamics and expression analysis
Style and interpretation feedback

Social Features

User accounts and cloud storage
Exercise sharing and community library
Leaderboards and achievements
Practice session sharing

Instructor Tools

Custom exercise creation
Student progress tracking
Assignment management
Video lesson integration

Advanced Audio

Multi-track recording
Audio effects processing
Backing track synchronization
Loop and layer functionality


16. Acceptance Criteria Summary
Milestone 1: Repository and Development Setup

 Repository created with documented directory structure
 package.json includes all core dependencies
 Development server runs and serves index.html
 Basic module stubs created for all core modules
 Initial unit test runs and passes
 README.md includes setup instructions
 Governance files (CLINE_TODO.md, CLINE_MEMORY.md) created and updated

Milestone 2: Exercise Loading

 MusicXML parser reads and validates twinkle2.xml
 Parser generates ExerciseJSON with expected structure
 Timeline contains correct note count and timing
 Notation staff and tablature staff separated correctly
 Unit tests cover parsing edge cases
 Error handling prevents crashes on malformed files

Milestone 3: Notation Rendering

 Two OSMD instances render side-by-side
 Standard notation appears in first view only
 Tablature appears in second view only
 Rendered notes include data-note-id attributes
 E2E test validates DOM structure and SVG content
 Large scores render without browser freeze

Milestone 4: Playback Engine

 Playback engine accepts timeline and BPM
 Tick events emit at mathematically correct intervals
 Cursor initializes on first musical note
 Cursor updates synchronously with tick events
 Playback state transitions work correctly
 Unit tests validate scheduling accuracy

Milestone 5: Audio Playback

 Synthesis mode produces audible tones
 Sample mode loads and plays guitar samples
 Instrument selection UI functions correctly
 Audio context starts only after user gesture
 Playback synchronized with visual cursor
 No audio artifacts or glitches occur

Milestone 6: Monophonic Pitch Detection

 YIN algorithm detects sustained A4 within ±2Hz
 Guitar open strings detected correctly
 Noise gating rejects background noise
 Processing latency measured under 30ms
 Pitch stream outputs at consistent rate
 Tests use pre-recorded audio samples

Milestone 7: Polyphonic Detection

 Onsets & Frames model loads from local assets
 Loading progress indicator displays
 Two-note chord detected as separate MIDI numbers
 Graceful fallback occurs if model unavailable
 Memory usage remains stable during inference
 Smoke test validates model integration

Milestone 8: Analysis and Feedback

 DTW alignment produces sensible note mappings
 Per-note correctness calculated correctly
 Timing deviation measured accurately
 Aggregate scoring generates percentage scores
 Visual feedback displays on notation in real-time
 Synthetic test data produces expected results

Milestone 9: Tuner

 Tuner displays frequency with 0.1Hz precision
 Visual needle responds to pitch changes
 Color zones indicate tuning accuracy
 Smoothing reduces visual jitter
 Reference pitch adjustment affects calculations
 Manual test with A4 confirms accuracy

Milestone 10: Settings and Storage

 LocalStorage persists user settings
 Last-opened exercise loads on session restore
 Performance history stores and retrieves correctly
 Settings panel UI functional and intuitive
 Data export functionality works
 Storage quota errors handled gracefully

Milestone 11: Documentation and Deployment

 README.md complete with all setup steps
 TESTING.md documents all test procedures
 DEV_NOTES.md updated with architecture decisions
 GitHub Pages deployment configured
 Demo video recorded and linked
 Release notes summarize all features

Overall Version 1 Release Criteria

 All milestone acceptance criteria met
 Unit test coverage ≥80% for core modules
 E2E tests pass on Chromium and Firefox
 Latency measurements meet ≤80ms target
 No critical bugs in issue tracker
 Documentation complete and accurate
 Demo deployed and accessible
 Governance files (RULES.md compliance) validated


17. Risk Assessment and Mitigation
Technical Risks
Risk: Magenta Model Too Large for Browser

Impact: High (core polyphonic feature unavailable)
Probability: Medium
Mitigation: Use TensorFlow Lite version, implement graceful degradation, measure memory usage during testing

Risk: Audio Latency Exceeds Target

Impact: High (user experience degraded)
Probability: Medium
Mitigation: Optimize algorithms, use AudioWorklet, implement latency measurement and tuning, accept degraded mode with higher latency if necessary

Risk: OSMD Rendering Performance Issues

Impact: Medium (slow initial load)
Probability: Low
Mitigation: Implement progressive rendering, optimize SVG, cache rendered systems, profile and optimize hot paths

Risk: Browser API Incompatibilities

Impact: Medium (features unavailable on some browsers)
Probability: Medium
Mitigation: Implement feature detection, provide fallbacks, test on target browsers early and often

Project Management Risks
Risk: Scope Creep

Impact: High (delayed delivery)
Probability: High
Mitigation: Strict adherence to milestone plan, defer enhancements to Version 2, maintain clear acceptance criteria

Risk: Insufficient Testing

Impact: High (bugs in production)
Probability: Medium
Mitigation: Write tests alongside implementation, enforce coverage thresholds, conduct manual testing before milestones

Risk: Dependency Vulnerabilities

Impact: Medium (security concerns)
Probability: Medium
Mitigation: Regular dependency updates, security scanning, minimize dependency count

User Experience Risks
Risk: Poor Audio Quality

Impact: Medium (reduced user satisfaction)
Probability: Low
Mitigation: Use high-quality samples, test audio output, provide audio settings for user adjustment

Risk: Confusing User Interface

Impact: Medium (user abandonment)
Probability: Medium
Mitigation: User testing during development, clear labeling, provide contextual help, iterative design refinement

Risk: Inconsistent Pitch Detection

Impact: High (incorrect feedback frustrates users)
Probability: Medium
Mitigation: Implement confidence thresholds, provide visual indicators of detection quality, allow user to adjust sensitivity


18. Definition of Done
A milestone or feature is considered complete when:

Implementation Complete: All planned functionality implemented according to specification
Tests Passing: Unit tests written and passing with ≥80% coverage for new code
E2E Tests: End-to-end tests written and passing for user-facing features
Code Review: Code reviewed by at least one other developer (or self-review documented)
Documentation Updated: README, TESTING.md, DEV_NOTES.md updated as applicable
Governance Updated: CLINE_TODO.md and CLINE_MEMORY.md updated with task completion
Manual Testing: Manual testing conducted and results documented
Performance Validated: Performance targets met or exceptions documented
Accessibility Checked: Basic accessibility requirements validated
No Regressions: Existing tests still passing, no new critical bugs introduced
Committed: Changes committed to version control with descriptive message
Deployed to Dev: Changes deployed to development environment and verified


19. Glossary of Terms
AudioWorklet: Modern Web Audio API interface for low-latency audio processing in separate thread
BPM: Beats Per Minute, tempo measurement
Cents: Logarithmic unit of musical interval, 100 cents = 1 semitone
DTW: Dynamic Time Warping, algorithm for measuring similarity between sequences varying in time
ExerciseJSON: Internal data structure representing parsed musical exercise
MIDI: Musical Instrument Digital Interface, protocol and file format for electronic instruments
MusicXML: XML-based format for representing Western musical notation
OSMD: OpenSheetMusicDisplay, JavaScript library for rendering MusicXML as SVG
Polyphonic: Multiple simultaneous pitches (e.g., chords)
Monophonic: Single pitch at a time (e.g., melody)
Tablature: Guitar notation showing finger positions on fretboard rather than standard pitches
Timeline: Chronological sequence of note events with absolute timestamps
Tone.js: JavaScript framework for audio synthesis and scheduling
YIN: Fundamental frequency estimation algorithm for pitch detection
Web Audio API: Browser API for processing and synthesizing audio

20. Document Change Log
Version 2.0 (2025-11-01)

Comprehensive expansion based on Version 1.1 feedback
Added detailed sections on error recovery, performance monitoring, risk assessment
Enhanced functional requirements with explicit acceptance criteria
Expanded non-functional requirements covering latency, accessibility, testability
Added future roadmap and version 2/3 considerations
Included detailed data contracts and module responsibilities
Added glossary, definition of done, and change log sections
Removed all code examples per requirement
Structured for use as base document for generating project prompts and implementation guides

Version 1.1 (2025-10-07)

Initial specification document
Defined core architecture and modules
Established milestone plan and acceptance criteria
Specified technology stack and browser targets