# IMPLEMENTATION_REALITY

## Phase 1 — Deep Module Analysis: `src/core/exerciseLoader.js`

File: [src/core/exerciseLoader.js](src/core/exerciseLoader.js)

### 1. CLASS STRUCTURE
- Class name and inheritance
  - Class: `ExerciseLoader`
  - Extends: `EventEmitter` (imported from `../utils/eventEmitter.js`)

- Constructor signature and parameters
  - `constructor()` — no required parameters in usage; instance created via `new ExerciseLoader()` in tests and app code.

- Observed class properties
  - `this.currentExercise` — holds the most recently loaded exercise object
  - internal temp variables created in methods (parser, xmlDoc, timeline)

- Methods (observed by name/signature)
  - `async parseXML(xmlContent)`
  - `async loadFromFile(file)`
  - `validateExercise(exercise)`
  - `_validateFile(file)`
  - `_readFile(file)`
  - `_extractMetadata(xmlDoc)`
  - `_parseTimeSignature(xmlDoc)`
  - `_extractTuning(xmlDoc)`
  - `_buildTimeline(xmlDoc, tempo, timeSignature)`
  - `_calculateTimestamp(divisions, duration, currentTime, tempo)`
  - `_extractPitch(noteElement)`
  - `_convertPitchToMIDI(pitch)`
  - `_extractTabData(noteElement)`
  - `_assignNoteIds(timeline)`
  - `_detectSystems(xmlDoc)`
  - `_generateId(title)`
  - `getAnalysisTimeline(exercise)`
  - `recalculateTimeline(originalTimeline, oldTempo, newTempo)`

> See `src/core/exerciseLoader.js` for exact method bodies and locations.

### 2. ACTUAL EXPORTS
```javascript
// from end of file
export { ExerciseLoader };
```

### 3. ACTUAL IMPORTS
- `import { EventEmitter } from '../utils/eventEmitter.js';`
- `import { Logger } from '../utils/logger.js';`

These imports are workspace-local utilities (not spec-provided libs).

### 4. IMPLEMENTATION DETAILS
- XML parsing
  - Uses the browser `DOMParser`:
    - `const parser = new DOMParser();`
    - `const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');`
    - Detects parse errors via `xmlDoc.querySelector('parsererror')`.

- Staff / note identification logic
  - Finds `staff` via `element.querySelector('staff')` and parses it to integer (defaults to `1` when absent).
  - Notes in the timeline carry a numeric `staff` field (1, 2, ...).

- OSMD-related fields
  - Loader stores the original MusicXML string as `exerciseJSON.osmdInput` (single string).
  - There is *no* evidence the loader creates separate `osmdNotation` and `osmdTab` output fields — only `osmdInput` is kept.

- Timeline structure (actual shape)
  - Timeline elements built by `_buildTimeline` include keys similar to:
    ```javascript
    {
      timestamp: 0,       // milliseconds
      duration: 500,      // milliseconds
      midi: 60,           // MIDI note number
      pitch: { step: 'C', octave: 4, alter: 0 },
      staff: 1,
      voice: 1,
      tab: { string: 1, fret: 0 } | null,
      system: 1,
      id: 'n1'
    }
    ```
  - `getAnalysisTimeline(exercise)` returns filtered objects for playback/analysis, typically `{ id, midi, timestamp, duration, pitch }`.

### 5. EVENT EMISSIONS
- Observed `.emit()` calls in the loader
  - `this.emit('parse:progress', { percent, stage })` — emitted during parsing stages (progress updates).
    - Example payload: `{ percent: 10, stage: 'Parsing XML structure' }`.
  - `this.emit('exercise:loaded', { exerciseJSON, source, parseTime })` — emitted on successful parse.
    - Example payload:
      ```javascript
      {
        exerciseJSON: { id, title, tempo, timeline, osmdInput, ... },
        source: 'string',
        parseTime: 123
      }
      ```
  - `this.emit('exercise:error', { error: error.message, file: fileName?, lineNumber: null })` — emitted on parse or load failure.

These event names match entries in the architecture event catalog (see `architecture.md`), though the loader does not provide line numbers.

### 6. ERROR HANDLING
- `parseXML` and `loadFromFile` wrap parsing in `try/catch` blocks.
- On error the loader:
  - Logs error via `Logger.log(Logger.ERROR, 'ExerciseLoader', ...)`.
  - Emits `exercise:error` with `{ error: message, file: fileName?, lineNumber: null }`.
  - Re-throws the error after emission.
- Specific thrown errors include:
  - `new Error('Invalid XML content: must be non-empty string')`
  - `new Error('Invalid MusicXML: missing score-partwise element')`
  - `new Error('XML parse error: ...')` when `parsererror` detected
  - `new Error('Exercise validation failed: ...')` for validation failures

### 7. DEVIATIONS FROM SPEC
- Spec claim (example, architecture.md §3.2/ADR-005):
  > "Create two OSMD inputs: `osmdNotation` (standard notation) and `osmdTab` (tablature) and return both from the loader."

- Code does:
  - Stores a single `osmdInput` string in `exerciseJSON` containing the full MusicXML.
  - Does not create `osmdNotation` or `osmdTab` variants.

- Difference / impact:
  - Downstream modules (renderers) must split/filter the MusicXML themselves. Loader does not pre-split staves for OSMD.
  - Tests and other modules expect `osmdInput` to exist; no consumer currently requires `osmdNotation`/`osmdTab` fields.

- Spec claim: precise parse error line numbers included in error payloads.
  - Code: `lineNumber` is always `null` in error emissions — no line number extraction implemented.

---

> Next: Phase 2 (Exercise Loading Flow tracing). See next sections to be added.

## Phase 2 — Exercise Loading Flow (AS IMPLEMENTED)

This section traces the actual flow from user file upload or sample selection to notation rendering, based on `index.html`, `src/app.js`, `src/core/exerciseLoader.js`, and `src/core/notationRenderer.js`.

### 1. ENTRY POINTS (what can trigger exercise loading)
- File input in Practice tab: `<input id="exerciseFilePractice" accept=".xml,.musicxml">` in [index.html](index.html).
- File input in Lessons tab: `<input id="exerciseFileLessons" accept=".xml,.musicxml">` in [index.html](index.html).
- Sample exercise list buttons in Lessons tab: elements with `data-file="assets/exercises/..."` and a `.btn` to "Load" in [index.html](index.html).

### 2. Observed wiring in `src/app.js`
- `App` constructs an `ExerciseLoader` instance: `this.loader = new ExerciseLoader();`.
- `App` subscribes to loader error events:
  - `this.loader.on('exercise:error', (error) => { ... this.showNotification(...) })` — loader errors surface to UI via notifications.

### 3. Actual handlers (DOM → code)
- `index.html` exposes inputs and sample buttons, and `src/app.js` wires them during UI initialization. The app reads selected files with `FileReader` and calls `this.loader.loadFromFile(file)`; sample loads fetch the asset and call `this.loader.parseXML(xmlContent)`.

### 4. Step-by-step flow (actual calls)
1. User selects file or clicks a sample load button.
  - Element: `#exerciseFilePractice`, `#exerciseFileLessons`, or sample item button (index.html).
  - Handler: App reads file (FileReader) and calls `this.loader.loadFromFile(file)` or fetches sample and calls `this.loader.parseXML(xml)`.

2. `ExerciseLoader.loadFromFile(file)` ([src/core/exerciseLoader.js](src/core/exerciseLoader.js))
  - Validates file via `_validateFile`
  - Reads file text via `_readFile` (FileReader)
  - Calls `parseXML(xmlContent)` to build `exerciseJSON`
  - Attaches `exercise.filename = file.name` and returns `exerciseJSON`

3. `ExerciseLoader.parseXML(xmlContent)`
  - Parses via `DOMParser` and checks for `parsererror`
  - Extracts metadata (`_extractMetadata`), time signature (`_parseTimeSignature`), tuning (`_extractTuning`)
  - Builds timeline via `_buildTimeline(xmlDoc, tempo, timeSignature)` → array of notes `{ timestamp, duration, midi, pitch, staff, system, ... }`
  - `_assignNoteIds(timeline)` assigns `id` fields (`n1`, `n2`, ...)
  - Validates structure via `validateExercise`
  - Emits `exercise:loaded` with `{ exerciseJSON, source: 'string', parseTime }`

4. App reacts to `exercise:loaded` (UI wiring in `src/app.js`)
  - Creates/initializes `NotationRenderer` if needed
  - Calls `await renderer.render(exerciseJSON)`
  - Enables playback and analysis controls and sets `this.currentExercise`

5. `NotationRenderer.render(exerciseJSON)` ([src/core/notationRenderer.js](src/core/notationRenderer.js))
  - Validates `exercise.osmdInput`
  - `await this.osmd.load(exercise.osmdInput)`
  - `await this.osmd.render()`
  - Builds element map via `_buildElementMap(exerciseJSON)` which uses `osmd.cursor` when available or falls back to DOM traversal assigning `data-note-id` attributes and populating `this.noteElementMap`
  - Emits `render:complete` with `{ noteCount, systemCount, renderTime }`

### 5. Data structures at key steps
- Input to `parseXML`: raw MusicXML string (full document)
- Output `exerciseJSON` (example shape):
```javascript
{
  id: 'twinkle-1600000000000',
  title: 'Twinkle Twinkle',
  composer: 'Unknown',
  tempo: 120,
  timeSignature: { beats: 4, beatType: 4 },
  tuning: ['E2','A2','D3','G3','B3','E4'],
  timeline: [ { id:'n1', timestamp:0, duration:500, midi:60, pitch:{step:'C',octave:4}, staff:1, system:1 }, ... ],
  osmdInput: '...full MusicXML string...',
  systemCount: 3,
  measureCount: 12,
  filename: 'twinkle2.xml'
}
```

### 6. OSMD rendering specifics in the flow
- `NotationRenderer.init(container)` constructs OSMD with:
  - `this.osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, this.config);`
- `render()` performs `await this.osmd.load(exercise.osmdInput); await this.osmd.render();`
- Element mapping: cursor-based when available; fallback traverses SVG and sets `data-note-id` sequentially to match timeline order.

### 7. Gaps / mismatches observed
- `ExerciseLoader` preserves single `osmdInput` only — loader does not provide pre-split notation/tab inputs.
- `exercise:error` emissions do not include line number information (`lineNumber: null`).

---

### Exact code locations (as implemented)
- File input listeners (UI wiring): [src/app.js](src/app.js#L1674) (`#exerciseFilePractice`) and [src/app.js](src/app.js#L1678) (`#exerciseFileLessons`).
- File upload handler: `handleFileUpload` at [src/app.js](src/app.js#L2533) — reads file and calls `await this.loadExercise(xmlContent, file.name)` ([src/app.js](src.app.js#L2544)).
- Sample exercise button handler: `handleSampleExerciseLoad` at [src/app.js](src/app.js#L2556) — fetches sample and calls `await this.loadExercise(xmlContent, fileName)` ([src/app.js](src/app.js#L2566)).
- Loader parsing entry: `ExerciseLoader.parseXML(xmlContent)` at [src/core/exerciseLoader.js](src/core/exerciseLoader.js#L34).
- App render/engine setup after parse: `loadExercise` defines rendering and engine creation at [src/app.js](src/app.js#L2576-L2610):
  - `this.renderer = new NotationRenderer();` ([src/app.js](src/app.js#L2600))
  - `this.renderer.init(container);` ([src/app.js](src/app.js#L2601))
  - `await this.renderer.render(exercise);` ([src/app.js](src.app.js#L2602))
- NotationRenderer OSMD constructor: [src/core/notationRenderer.js](src/core/notationRenderer.js#L75) (`new OpenSheetMusicDisplay(container, config)`).
- Notation load/render calls: `await this.osmd.load(exercise.osmdInput);` at [src/core/notationRenderer.js](src/core/notationRenderer.js#L109) and `await this.osmd.render();` immediately after.

These exact locations confirm the implemented flow: UI → `handleFileUpload`/`handleSampleExerciseLoad` → `loadExercise` → `ExerciseLoader.parseXML` → `NotationRenderer.render` → OSMD load/render → element mapping.

## Phase 3 — Event System Reality (catalog — initial)

This section lists observed `.emit()` calls (events emitted) and primary `.on()` listeners across core modules. It focuses on the authoritative, implemented events and their actual payload shapes.

### ExerciseLoader
- **Emitted at**: [src/core/exerciseLoader.js](src/core/exerciseLoader.js#L34-L115)
- **Events**:
  - `parse:progress` — payload: `{ percent: Number, stage: String }` (multiple stages: 0,10,20,30,80,90,100)
  - `exercise:loaded` — payload: `{ exerciseJSON, source: 'string', parseTime: Number }`
  - `exercise:error` — payload: `{ error: String, lineNumber: null }`

### NotationRenderer
- **Emitted at**: [src/core/notationRenderer.js](src/core/notationRenderer.js#L103-L129)
- **Events**:
  - `render:start` — payload: `{ exerciseId }`
  - `render:progress` — payload: `{ percent: Number, stage: String }` (progress stages during mapping)
  - `render:complete` — payload: `{ noteCount, systemCount, renderTime }`
  - `render:error` — payload: `{ error, stage, exerciseId }`

### PlaybackEngine
- **Emitted at**: [src/core/playbackEngine.js](src/core/playbackEngine.js#L171-L560)
- **Events** (key ones):
  - `playback:started` — payload: `{ startTime, offsetMs, bpm }` ([src/core/playbackEngine.js](src/core/playbackEngine.js#L239))
  - `playback:paused` — payload: `{ currentPosition, noteId }`
  - `playback:stopped` — payload: `{ timestamp }`
  - `playback:error` — payload: `{ error: String, ... }`
  - `playback:tick` — payload: `{ noteId, timestamp, systemNumber, midi, audioContextTime }` ([src/core/playbackEngine.js](src/core/playbackEngine.js#L549))
  - `playback:systemChange` — payload: `{ systemNumber, timestamp }`
  - `playback:completed` — payload: `{ ... }` (completion event)
  - `audio:samplesLoaded` — payload: `{ instrument }`
  - `audio:samplesError` — payload: `{ error }`
  - `audio:modeChanged` / `audio:metronomeToggled` — payloads present where toggles occur

### PitchDetector
- **Emitted at**: [src/core/pitchDetector.js](src/core/pitchDetector.js#L600-L700)
- **Events**:
  - `pitch:detected` — payload: `{ frequency, confidence, midi, noteName, centsDeviation, timestamp, estimatedLatency }`
  - `pitch:onset` — payload: `{ frequency, midi, noteName, timestamp, confidence, estimatedLatency }` (when onsets detected)
  - `pitch:silence` — payloads emitted in several branches when silence is detected

### Analyzer
- **Emitted at**: [src/core/analyzer.js](src/core/analyzer.js#L120-L440)
- **Events**:
  - `analysis:started` — payload: `{ referenceNotes: Number, detectedEvents: Number, latencyOffset }`
  - `analysis:complete` — payload: `{ result }` (full analysis result object)
  - `analysis:error` — payload: `{ error: String }`
  - `analysis:calibrationRecommendation`, `analysis:adaptiveCalibration` — additional analytical recommendations emitted in some flows

### CalibrationManager
- **Emitted at**: [src/core/calibrationManager.js](src/core/calibrationManager.js#L119-L181)
- **Events**:
  - `calibration:started` — payload: none
  - `calibration:tone_playing` — payload: `{ frequency, duration }` or similar
  - `calibration:complete` — payload: `{ result }` where `result` includes `success` and `measuredLatency`
  - `calibration:failed` — payload: `{ result }`

### Tuner / UIManager
- **Emitted at**: [src/core/tuner.js](src/core/tuner.js#L128-L223) and [src/core/uiManager.js](src/core/uiManager.js#L142)
- **Events**:
  - `tuner:started` / `tuner:stopped` — payload: `{}` or `{ data }`
  - `tuner:update` — payload: `{ currentState }` (state includes frequency, note, cents, confidence)
  - `tabChanged` (UIManager) — payload: `{ currentTab, previousTab }`

### PolyphonicDetector
- **Emitted at**: [src/core/polyphonicDetector.js](src/core/polyphonicDetector.js#L200-L900)
- **Events**:
  - `poly:modelLoading`, `poly:modelLoaded`, `poly:modelError` — model lifecycle
  - `poly:detected` — payload: detection result(s)
  - `poly:fallback`, `poly:notReady`, `poly:started`, `poly:stopped`, `poly:error`, `poly:workerError`, `poly:inferenceError` — various operational events

### Observed listeners (examples)
- `this.loader.on('exercise:error', ...)` — in [src/app.js](src/app.js#L93)
- `this.engine.on('playback:tick', ...)` — in [src/app.js](src/app.js#L2495 and src/app.js#L2613)
- `this.pitchDetector.on('pitch:detected', ...)` — in [src/app.js](src/app.js#L192)
- `renderer.on('render:complete', ...)` — used in tests and integration harnesses (see [src/tests/unit/notationRenderer.test.js](src/tests/unit/notationRenderer.test.js#L404))

### Notes about coverage and mismatches
- Many tests subscribe to events to verify behavior (see `src/tests/**`) — test suite heavily relies on event-driven interactions.
- `rules.md` documents expected events (e.g., `exercise:loaded`, `playback:tick`, `pitch:detected`, `analysis:complete`) — most of these appear in code and are implemented, though payload shapes sometimes differ (line number omission in `exercise:error`, for example).

---

Next: expand the event catalog into a per-event detailed section (emitters, payload examples, listeners) and mark Phase 3 as in-progress in the TODO list. I will update the TODOs now and can continue expanding the catalog if you want.

### Phase 3 — Event Catalog (detailed)

Below are focused, per-event entries with exact emitter locations, example payloads taken from code patterns, known listeners, and a quick spec-match verdict.

Event catalog (per-event table)

The table below lists every significant event discovered in the codebase, with emitter location, example payload, known listeners, and a short spec-match verdict.

- Event: `parse:progress`
  - Emitted by: `ExerciseLoader.parseXML` — [src/core/exerciseLoader.js](src/core/exerciseLoader.js#L43-L114)
  - Example payload: `{ percent: 20, stage: 'Extracting metadata' }`
  - Known listeners: loader unit tests (`src/tests/unit/loader.test.js`)
  - Spec match: YES — progress updates implemented.

- Event: `exercise:loaded`
  - Emitted by: `ExerciseLoader.parseXML` — [src/core/exerciseLoader.js](src/core/exerciseLoader.js#L115)
  - Example payload:
    ```javascript
    {
      exerciseJSON: { id, title, tempo, timeSignature, tuning, timeline, osmdInput, systemCount, measureCount, filename? },
      source: 'string',
      parseTime: 123
    }
    ```
  - Known listeners: tests (`src/tests/unit/loader.test.js`); app code typically uses returned promise instead of event-driven flow.
  - Spec match: PARTIAL — present, but app often doesn't rely on the event for control flow.

- Event: `exercise:error`
  - Emitted by: `ExerciseLoader` — [src/core/exerciseLoader.js](src/core/exerciseLoader.js#L129, L167)
  - Example payload: `{ error: 'XML parse error: ...', file?: 'name.xml', lineNumber: null }`
  - Known listeners: `App` (`this.loader.on('exercise:error', ...)` at [src/app.js](src/app.js#L93)); tests
  - Spec match: PARTIAL — emitted and handled, but lacks precise error location.

- Event: `render:start`
  - Emitted by: `NotationRenderer.render` — [src/core/notationRenderer.js](src/core/notationRenderer.js#L103)
  - Example payload: `{ exerciseId: 'twinkle-1600...' }`
  - Known listeners: tests and integration harnesses
  - Spec match: YES

- Event: `render:progress`
  - Emitted by: `NotationRenderer.render` — [src/core/notationRenderer.js](src/core/notationRenderer.js#L112-L120)
  - Example payload: `{ percent: 60, stage: 'Building element map' }`
  - Known listeners: tests
  - Spec match: YES

- Event: `render:complete`
  - Emitted by: `NotationRenderer.render` — [src/core/notationRenderer.js](src/core/notationRenderer.js#L129)
  - Example payload: `{ noteCount: 48, systemCount: 3, renderTime: 342 }`
  - Known listeners: tests; app awaits render and proceeds
  - Spec match: YES

- Event: `render:error`
  - Emitted by: `NotationRenderer.render` — [src/core/notationRenderer.js](src/core/notationRenderer.js#L159)
  - Example payload: `{ error: 'Error message', stage: 'render', exerciseId }`
  - Known listeners: tests
  - Spec match: YES

- Event: `playback:stateChanged`
  - Emitted by: `PlaybackEngine` — [src/core/playbackEngine.js](src/core/playbackEngine.js#L171)
  - Example payload: `{ state: 'playing' }`
  - Known listeners: tests and some modules
  - Spec match: YES

- Event: `playback:started`
  - Emitted by: `PlaybackEngine` — [src/core/playbackEngine.js](src/core/playbackEngine.js#L239)
  - Example payload: `{ startTime: 1600000000000, offsetMs: 0, bpm: 120 }`
  - Known listeners: `App` (captures `startTime` for sync) ([src/app.js](src/app.js#L2613))
  - Spec match: YES

- Event: `playback:tick`
  - Emitted by: `PlaybackEngine._emitTick` — [src/core/playbackEngine.js](src/core/playbackEngine.js#L549)
  - Example payload: `{ noteId, timestamp, systemNumber, midi, audioContextTime }`
  - Known listeners: `App.renderer` highlight (`src/app.js` L2623/L2495), tests
  - Spec match: YES

- Event: `playback:systemChange`
  - Emitted by: `PlaybackEngine._emitTick` when system changes — [src/core/playbackEngine.js](src/core/playbackEngine.js#L559)
  - Example payload: `{ systemNumber, timestamp }`
  - Known listeners: tests
  - Spec match: YES

- Event: `playback:paused`, `playback:stopped`, `playback:completed`, `playback:error`
  - Emitted by: `PlaybackEngine` — [src/core/playbackEngine.js](src/core/playbackEngine.js#L282,L333,L493,L673)
  - Example payloads: `{ currentPosition, noteId }`, `{ timestamp }`, `{ error }`
  - Known listeners: `App` handles completion to trigger analysis, update UI
  - Spec match: YES

- Event: `audio:samplesLoaded`, `audio:samplesError`, `audio:modeChanged`, `audio:metronomeToggled`
  - Emitted by: `PlaybackEngine` (sample loading and mode toggles) — e.g. [src/core/playbackEngine.js](src/core/playbackEngine.js#L804,L808,L1256,L1346)
  - Example payloads: `{ instrument }`, `{ error }`, `{ mode }`, `{ enabled: true/false }`
  - Known listeners: `App` (enables controls, notifies user), tests
  - Spec match: YES

- Event: `pitch:detected`
  - Emitted by: `PitchDetector` — [src/core/pitchDetector.js](src/core/pitchDetector.js#L631,L668)
  - Example payload:
    ```javascript
    { frequency: 440.0, confidence: 0.95, midi: 69, noteName: 'A4', centsDeviation: 0, timestamp: 1600000000123, estimatedLatency: 200 }
    ```
  - Known listeners: `App` (practice/tuner), `CalibrationManager`, `Tuner`, tests
  - Spec match: YES

- Event: `pitch:onset`
  - Emitted by: `PitchDetector._handleDualDetection` when onsets detected — [src/core/pitchDetector.js](src/core/pitchDetector.js#L672)
  - Example payload: `{ frequency, midi, noteName, timestamp, confidence, estimatedLatency }`
  - Known listeners: Analyzer, tests
  - Spec match: YES

- Event: `pitch:silence`
  - Emitted by: `PitchDetector` in silence branches — [src/core/pitchDetector.js](src/core/pitchDetector.js#L557-L595)
  - Example payload: `{ timestamp }` or `{}` depending on branch
  - Known listeners: UI modules (tuner/practice) and tests
  - Spec match: YES

- Event: `analysis:started`, `analysis:complete`, `analysis:error`
  - Emitted by: `Analyzer` — [src/core/analyzer.js](src/core/analyzer.js#L120-L440)
  - Example payloads: `{ referenceNotes, detectedEvents, latencyOffset }`, `{ result }`, `{ error }`
  - Known listeners: `App` (analysis:complete handler), tests
  - Spec match: YES

- Event: `analysis:calibrationRecommendation`, `analysis:adaptiveCalibration`
  - Emitted by: `Analyzer` in specialized flows — [src/core/analyzer.js](src/core/analyzer.js#L206,L253)
  - Example payloads: recommendation objects
  - Known listeners: CalibrationManager/UI
  - Spec match: YES (specialized features)

- Event: `calibration:started`, `calibration:tone_playing`, `calibration:complete`, `calibration:failed`
  - Emitted by: `CalibrationManager` — [src/core/calibrationManager.js](src/core/calibrationManager.js#L119-L181)
  - Example payloads: `{}`, `{ frequency, duration }`, `{ result: { success, measuredLatency } }`
  - Known listeners: `App` (shows notifications and applies latency), tests
  - Spec match: YES

- Event: `tuner:started`, `tuner:stopped`, `tuner:update`, `tuner:referencePitchChanged`
  - Emitted/listened by: `Tuner` and `UIManager` — [src/core/tuner.js](src/core/tuner.js#L128-L223), [src/core/uiManager.js](src/core/uiManager.js#L385)
  - Example payloads: `{}` and `{ currentState }`
  - Known listeners: UIManager, App
  - Spec match: YES

- Event: `tabChanged`, `settingsChanged`, `escapePressed`
  - Emitted by: `UIManager` — [src/core/uiManager.js](src/core/uiManager.js#L142,L347,L365)
  - Example payloads: `{ currentTab, previousTab }`, `{ setting, value }`, `{}`
  - Known listeners: `App`, other UI components
  - Spec match: YES

- Event: `poly:modelLoading`, `poly:modelLoaded`, `poly:modelError`, `poly:detected`, `poly:fallback`, `poly:notReady`, `poly:started`, `poly:stopped`, `poly:error`, `poly:workerError`, `poly:inferenceError`
  - Emitted by: `PolyphonicDetector` — [src/core/polyphonicDetector.js](src/core/polyphonicDetector.js#L200-L900)
  - Example payloads: model lifecycle and detection payloads (arrays of pitch/time objects)
  - Known listeners: `App`, tests
  - Spec match: YES

-----

Below is a compact table summarizing the implemented events, their primary emitter (file:line), an example payload, known listeners, and whether the implementation matches the spec.

| Event | Emitter (file:line) | Example payload | Known listeners | Spec match |
|---|---|---|---|---|
| `parse:progress` | [src/core/exerciseLoader.js](src/core/exerciseLoader.js#L43) | `{ percent: 20, stage: 'Extracting metadata' }` | Loader tests | YES |
| `exercise:loaded` | [src/core/exerciseLoader.js](src/core/exerciseLoader.js#L115) | `{ exerciseJSON, source: 'string', parseTime: 123 }` | App (occasionally), tests | PARTIAL |
| `exercise:error` | [src/core/exerciseLoader.js](src/core/exerciseLoader.js#L129) | `{ error: 'XML parse error', file?: 'name.xml', lineNumber: null }` | App UI, tests | PARTIAL |
| `render:start` | [src/core/notationRenderer.js](src/core/notationRenderer.js#L103) | `{ exerciseId }` | Tests, integration | YES |
| `render:progress` | [src/core/notationRenderer.js](src/core/notationRenderer.js#L112) | `{ percent: 60, stage: 'Building element map' }` | Tests | YES |
| `render:complete` | [src/core/notationRenderer.js](src/core/notationRenderer.js#L129) | `{ noteCount: 48, systemCount: 3, renderTime: 342 }` | App, tests | YES |
| `render:error` | [src/core/notationRenderer.js](src/core/notationRenderer.js#L159) | `{ error: 'message', stage: 'render', exerciseId }` | Tests | YES |
| `playback:started` | [src/core/playbackEngine.js](src/core/playbackEngine.js#L239) | `{ startTime, offsetMs, bpm }` | App (sync), tests | YES |
| `playback:tick` | [src/core/playbackEngine.js](src/core/playbackEngine.js#L549) | `{ noteId, timestamp, systemNumber, midi, audioContextTime }` | Renderer highlight, App, tests | YES |
| `playback:systemChange` | [src/core/playbackEngine.js](src/core/playbackEngine.js#L559) | `{ systemNumber, timestamp }` | App, tests | YES |
| `playback:paused` | [src/core/playbackEngine.js](src/core/playbackEngine.js#L282) | `{ currentPosition, noteId }` | App, tests | YES |
| `playback:stopped` | [src/core/playbackEngine.js](src/core/playbackEngine.js#L333) | `{ timestamp }` | App, tests | YES |
| `pitch:detected` | [src/core/pitchDetector.js](src/core/pitchDetector.js#L631) | `{ frequency, confidence, midi, noteName, centsDeviation, timestamp }` | App (tuner/practice), Analyzer, tests | YES |
| `pitch:onset` | [src/core/pitchDetector.js](src/core/pitchDetector.js#L672) | `{ frequency, midi, noteName, timestamp, confidence }` | Analyzer, tests | YES |
| `pitch:silence` | [src/core/pitchDetector.js](src/core/pitchDetector.js#L557) | `{ timestamp }` | UI modules, tests | YES |
| `analysis:started` | [src/core/analyzer.js](src/core/analyzer.js#L120) | `{ referenceNotes, detectedEvents, latencyOffset }` | App, tests | YES |
| `analysis:complete` | [src/core/analyzer.js](src/core/analyzer.js#L220) | `{ result }` | App, tests | YES |
| `analysis:error` | [src/core/analyzer.js](src/core/analyzer.js#L320) | `{ error }` | App, tests | YES |
| `calibration:started` | [src/core/calibrationManager.js](src/core/calibrationManager.js#L119) | `{}` | App, tests | YES |
| `calibration:complete` | [src/core/calibrationManager.js](src/core/calibrationManager.js#L150) | `{ result: { success, measuredLatency } }` | App, tests | YES |
| `tuner:update` | [src/core/tuner.js](src/core/tuner.js#L128) | `{ frequency, note, cents, confidence }` | UIManager, App | YES |
| `poly:modelLoaded` | [src/core/polyphonicDetector.js](src/core/polyphonicDetector.js#L220) | `{ modelName }` | App, tests | YES |
| `poly:detected` | [src/core/polyphonicDetector.js](src/core/polyphonicDetector.js#L420) | `[{ midi, confidence, timestamp }, ...]` | App, Analyzer, tests | YES |

> Note: many tests rely on these events and sometimes set `data-note-id` expectations directly in mocks; where the app awaits promises (e.g., `parseXML`) it may not consume the corresponding event.

## Phase 4 — OSMD Implementation Deep Dive

Summary: The codebase uses a single OpenSheetMusicDisplay (OSMD) instance for rendering notation and builds element mappings for highlighting. Evidence below shows where the instance is created, how load/render are called, how the OSMD cursor is used if available, and the fallback DOM mapping that assigns `data-note-id` attributes.

1) OSMD library inclusion
- `index.html` loads OSMD from CDN:
  - [index.html](index.html#L11-L12): `https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.9.2/build/opensheetmusicdisplay.min.js`

2) Instance creation (actual code)
- Single OSMD instance created in `NotationRenderer.init`:
  - [src/core/notationRenderer.js](src/core/notationRenderer.js#L75):
    - `this.osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(containerElement, this.config);`
- Search results show this is the only runtime instantiation in the codebase (no `new OpenSheetMusicDisplay` elsewhere in `src/`).

3) Load and render calls
- `NotationRenderer.render` calls OSMD load and render:
  - [src/core/notationRenderer.js](src/core/notationRenderer.js#L109-L110):
    - `await this.osmd.load(exercise.osmdInput);`
    - `await this.osmd.render();`

4) Cursor usage and element mapping
- The renderer attempts to use OSMD's `Cursor` when available:
  - Cursor initialization: [src/core/notationRenderer.js](src/core/notationRenderer.js#L188-L196)
    - Creates `this.osmd.cursor = new opensheetmusicdisplay.Cursor(this.osmd.container, this.osmd);`
    - Calls `this.osmd.cursor.show()` and `this.osmd.cursor.reset()`.
- If the cursor approach fails, the renderer falls back to DOM traversal and assigns `data-note-id` attributes sequentially to SVG note elements:
  - Fallback mapping sets attributes at [src/core/notationRenderer.js](src/core/notationRenderer.js#L251): `element.setAttribute('data-note-id', note.id);`

5) Tests & mocks
- Tests provide a mock OSMD for unit tests:
  - [src/tests/setup.js](src/tests/setup.js#L151-L155) defines `global.opensheetmusicdisplay` with `OpenSheetMusicDisplay` mock class.
  - `src/tests/unit/notationRenderer.test.js` sets `global.OpenSheetMusicDisplay = MockOSMD` for renderer tests.
- Unit tests also assert that `data-note-id` attributes are set on mock note elements (multiple assertions in `notationRenderer.test.js`).

6) Styling and runtime usage of `data-note-id`
- CSS uses attribute selectors for highlighting: [styles.css](styles.css#L2001-L2014) contains `[data-note-id].highlighted`, `.active`, `.correct`, `.incorrect` rules.
- Playback and UI use `data-note-id` for DOM highlighting when cursor is not available (fallback mapping).

7) Instance count conclusion
- Code creates a single OSMD instance per `NotationRenderer` instance.
- In the main app flow, `App.loadExercise` constructs one `NotationRenderer` and calls `init(container)` once before calling `render`, so in practice there is only one OSMD instance active for the primary notation container.

8) Spec vs reality
- Specification (architecture.md / RULES) recommends a single OSMD instance rendering both staves; the implementation matches this: single instance in `NotationRenderer`.
- Some documentation examples (e.g., snippets in `rules.md` or `.github/agents` files) show two-instance patterns as examples or historical notes, but those are not used at runtime.

9) Recommendations / notes
- The implementation follows the single-OSMD-instance approach and includes a robust fallback mapping when OSMD cursor features aren't available. No immediate code change required here.

## Phase 5 — State Management Audit

Scope: inventory module-level state, persistence (LocalStorage via `Storage`), globals, and synchronization points.

1) Storage abstraction
- Primary abstraction: `Storage` class at [src/core/storage.js](src/core/storage.js#L1-L30). Key facts:
  - Namespacing: `Storage` prefixes keys with `this.namespace = 'g4:'` internally (see [src/core/storage.js](src/core/storage.js#L22-L30)).
  - Schema/versioning: stored values are wrapped with `{ version, timestamp, data }` and migrated by `_migrateData` when needed.
  - In-memory fallback: when `localStorage` is unavailable, `Storage` uses `this.inMemoryFallback` and sets `this.usingFallback = true` (see [src/core/storage.js](src/core/storage.js#L56-L70)).
  - Quota handling: `_handleQuotaExceeded` attempts to prune performance history and emits a quota event (see [src/core/storage.js](src/core/storage.js#L190-L240)).

2) Centralized keys and inconsistency
- There are two sources of key definitions:
  - `STORAGE_KEYS` inside `Storage` (local constant) uses unprefixed keys, e.g. `PERFORMANCE_HISTORY: 'perfHistory'` ([src/core/storage.js](src/core/storage.js#L25-L30)).
  - `STORAGE_KEYS` exported from `src/utils/constants.js` contains already-prefixed keys, e.g. `PERFORMANCE_HISTORY: 'g4:perfHistory'` ([src/utils/constants.js](src/utils/constants.js#L24-L30)).

- Mismatch impact (observed): some modules pass already-prefixed keys into `Storage.get/set`, causing double prefixing. Examples:
  - `Analyzer` calls `this.storage.get('g4:perfHistory', [])` (see [src/core/analyzer.js](src/core/analyzer.js#L496-L523)). This will be stored as `g4:g4:perfHistory` by `Storage` (because `Storage` prepends `g4:`).
  - `SettingsManager` imports `STORAGE_KEYS` from `src/utils/constants.js` and calls `this.storage.set(STORAGE_KEYS.SETTINGS, settings)` where `STORAGE_KEYS.SETTINGS === 'g4:settings'` (see [src/utils/settingsManager.js](src/utils/settingsManager.js#L1-L10) and [src/utils/constants.js](src/utils/constants.js#L22-L28)). This also produces `g4:g4:settings` keys at runtime.

3) Mixed usage patterns
- Some modules use the `Storage` abstraction (e.g., `SettingsManager`, `Analyzer`, `Storage` tests), while others interact with `localStorage` directly (e.g., `UIManager` uses `localStorage.setItem('g4:ui-settings', ...)` — [src/core/uiManager.js](src/core/uiManager.js#L420-L436)).
- Direct `localStorage` use bypasses `Storage`'s schema/versioning and quota handling.

4) Logger and error storage
- `Logger` writes error arrays directly to `localStorage` under `g4:errors` ([src/utils/logger.js](src/utils/logger.js#L44-L76)). This duplicates responsibility with `Storage`'s error key handling and can diverge from `Storage`'s versioned format.

5) Tests and in-memory mocks
- Tests mock `localStorage` globally (e.g., `src/tests/setup.js`, `src/tests/unit/storage.test.js`) so code paths exercising `Storage`'s fallback and quota logic are covered. The test suite expects namespaced keys like `'g4:perfHistory'` in some tests and uses `Storage`-constructed keys in others.

6) Observed risks and bugs
- Double-prefixing: Passing already-namespaced constants into `Storage` leads to `g4:g4:...` keys in runtime LocalStorage, creating effectively two separate stores and possible data loss/duplication.
- Bypass of schema/versioning: `UIManager` and `Logger` storing JSON directly in `localStorage` mean data written there will not be wrapped/unwrapped by `Storage` and may break migration expectations.
- Sync vs async expectations: `localStorage` is synchronous; `Storage` is also synchronous but `Storage` exposes additional runtime behaviors (wrapping, pruning) that direct usage doesn't get.

7) Concrete examples (evidence)
- `Storage` namespace prefix: [src/core/storage.js](src/core/storage.js#L34-L40) (`this.namespace = 'g4:'`).
- `constants` keys already prefixed: [src/utils/constants.js](src/utils/constants.js#L22-L28) (`PERFORMANCE_HISTORY: 'g4:perfHistory'`).
- Analyzer using a prefixed key: [src/core/analyzer.js](src/core/analyzer.js#L499-L523) (`const history = this.storage.get('g4:perfHistory', []);`).
- UIManager using direct localStorage: [src/core/uiManager.js](src/core/uiManager.js#L420-L436) (`localStorage.setItem('g4:ui-settings', JSON.stringify(settingsObj));`).

8) Recommendations (actionable)
- Immediate (low-effort):
  - Standardize `STORAGE_KEYS` to use unprefixed keys in `src/utils/constants.js` (remove `g4:` prefix there) OR update `Storage` to not auto-prefix when given already-prefixed keys (prefer the former for clarity).
  - Migrate all code to use the `Storage` abstraction for application data (settings, history, exercises) and reserve direct `localStorage` use for debug/test-only code.
  - Update `Logger` to use `Storage.set(STORAGE_KEYS.ERRORS, errors)` so errors are subject to wrapping and quota handling.

- Medium: Add unit tests verifying that `Storage` + `STORAGE_KEYS` produce the expected single-prefixed keys (no double-prefix) and that direct `localStorage` writes are detected by a linter rule.

- Long-term: Provide a migration helper that scans `localStorage` for both `g4:foo` and `g4:g4:foo` and reconciles duplicates on startup.

9) Phase 5 status
- Findings recorded. Next: expand tests audit (Phase 6) to confirm test assumptions about namespaced keys and to identify failing/fragile tests caused by the prefix mismatch.

## Phase 6 — Testing Reality Audit

Scope: Verify test assumptions, mocks, and identify fragile tests caused by storage/key inconsistencies.

1) Test environment setup
- `src/tests/setup.js` provides Node.js browser API mocks including `localStorage` (simple object), `DOMParser`, `FileReader`, `Tone`, and a `MockOpenSheetMusicDisplay`. Tests rely on these mocks to run synchronously in Node (`jsdom` based for XML parsing).

2) Storage tests expectations
- `src/tests/unit/storage.test.js` imports `Storage` and `STORAGE_KEYS` from `src/core/storage.js` (not `src/utils/constants.js`) and asserts that `STORAGE_KEYS` values are unprefixed (e.g., `STORAGE_KEYS.SETTINGS === 'settings'`) — see [src/tests/unit/storage.test.js](src/tests/unit/storage.test.js#L305-L313).
- Storage unit tests also assert that `Storage` prefixes keys in `localStorage` with `g4:` when writing (they examine `localStorage.getItem('g4:testKey')`) — see [src/tests/unit/storage.test.js](src/tests/unit/storage.test.js#L36-L40).

3) Logger tests
- `src/tests/unit/logger.test.js` mocks `localStorage` directly and asserts that `Logger` writes error arrays to `g4:errors`. Logger tests do not use the `Storage` abstraction and assume direct `localStorage` usage is acceptable.

4) Higher-level tests and mocks
- Many analyzer tests set `analyzer.storage = new MockStorage()` to avoid touching real LocalStorage and to control behavior. Integration tests also use `MockStorage` in multiple places ([src/tests/unit/analyzer.test.js], [src/tests/integration/analyzer.test.js]).

5) Fragile/contradictory assumptions discovered
- Tests for `Storage` expect `STORAGE_KEYS` exported by `src/core/storage.js` to be unprefixed. Meanwhile, application code often imports `STORAGE_KEYS` from `src/utils/constants.js` which contains already-prefixed values (`g4:settings`). This divergence means:
  - Tests assert `STORAGE_KEYS.PERFORMANCE_HISTORY === 'perfHistory'` (unprefixed), but application code sometimes uses `'g4:perfHistory'` against `Storage`, causing double-prefixing at runtime.
  - Some tests directly check `localStorage` for keys like `'g4:testKey'` (good), while other modules write `'g4:settings'` via constants into `Storage`, resulting in `g4:g4:settings` in LocalStorage — tests won't catch that because unit tests isolate `Storage` and assert on `Storage`'s internal `STORAGE_KEYS`.

6) Test coverage observations
- Storage unit tests cover wrapping/unwrapping, quota handling, in-memory fallback, export/import, and cleanup behavior — good coverage for `Storage` logic.
- Many modules have unit tests that stub `Storage` (MockStorage) instead of using the real `Storage` object; this reduces risk during tests but masks integration issues caused by key mismatches.
- Tests assert styling/DOM behaviors with `MockOpenSheetMusicDisplay` that differ from runtime OSMD behavior; those tests are valuable but should be validated with a small integration test that runs against a real OSMD in headless browser if possible.

## Phase 7 — Dependencies & CDN audit

Summary: I inspected `package.json` and `index.html` to determine which libraries are declared as npm dependencies and which are loaded at runtime via CDN. This section lists declared packages, runtime CDN includes, version comparisons, and actionable recommendations.

- `package.json` (declared dependencies):
  - `@tensorflow/tfjs` : ^3.18.0
  - `express` : ^4.18.2
  - `jsdom` : ^27.1.0
  - `lodash` : ^4.17.21
  - `papaparse` : ^5.4.1
  - `tone` : ^14.7.77

- `index.html` (runtime / CDN includes):
  - Tone.js (CDN): `https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.js` ([index.html](index.html#L9-L11))
  - OpenSheetMusicDisplay (CDN): `https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.9.2/build/opensheetmusicdisplay.min.js` ([index.html](index.html#L11-L12))

- Observations & reconciliation:
  - `tone` appears both in `package.json` and is loaded via CDN at runtime. The CDN version used in `index.html` (14.7.77) matches the `package.json` constraint (`^14.7.77`). This is safe but redundant — the app currently expects the global `Tone` from the CDN rather than importing the npm package in modules.
  - `opensheetmusicdisplay` is only loaded via CDN (`1.9.2`) and is not listed in `package.json` dependencies. Tests mock `opensheetmusicdisplay` for Node, but runtime uses the CDN global `opensheetmusicdisplay`/`OpenSheetMusicDisplay` available on `window`.
  - `@tensorflow/tfjs` is declared in `package.json` (v^3.18.0). It is not loaded via CDN in `index.html`; code that uses TensorFlow (polyphonic detector) likely imports it via module resolution in Node builds or expects it to be bundled for production.
  - `jsdom`, `@xmldom/xmldom` and other DOM/test helpers are dev/test dependencies used for Node tests; they are not runtime browser libraries.

- Risk & maintenance notes:
  - Having core runtime libraries available both as npm packages and as CDN globals can cause confusion about which is authoritative for local development, tests, and CI. Tests currently rely on mocks rather than the real browser bundles, which hides integration issues.
  - `opensheetmusicdisplay` missing from `package.json` means local installs won't provide a local copy to bundle via a build pipeline; the app relies on the CDN for that library being available at runtime.
  - If you ever build a distributable or use bundlers (Rollup/Webpack/Vite), you should choose either CDN globals or npm packages consistently and update `server.js` (which currently can serve Tone from node_modules) and any bundler config accordingly.

- Recommendations (concrete):
  1. Standardize on package sources:
     - Option A (CDN globals): keep loading OSMD & Tone.js from CDN but document that they're required globals and pin exact versions. Remove `tone` from `package.json` to avoid duplication, or keep it only for dev/test tooling if used from Node.
     - Option B (npm + bundler): add `opensheetmusicdisplay` to `package.json`, import `tone` and `opensheetmusicdisplay` in modules, and bundle for production. This simplifies version control and offline builds.
  2. Add a short `docs/DEPLOYMENT.md` note that explains the runtime dependency model (CDN vs bundle) and exact versions required.
  3. Update tests: add at least one Playwright e2e test that loads the real page (CDN includes) to validate OSMD rendering and Tone.js audio context startup end-to-end. Current `src/tests/setup.js` mocks are fine for unit tests, but integration coverage is needed.
  4. Audit `server.js` and any dev scripts to ensure they don't accidentally serve an out-of-sync local copy of a library (for example, serving `tone` from node_modules while `index.html` loads a CDN copy). Prefer consistent source across environments.

Phase 7 completed: dependencies and CDN audit recorded. Next: Phase 8 (UI & integration points) — document initialization order, UI handlers, audio activation flow, and map UI elements to events.

## Phase 8 — UI & integration points

Summary: I traced the app initialization sequence, mapped UI element handlers to implementation methods, and documented the audio activation flow (user gesture → Tone.js → PlaybackEngine). This section references where handlers are registered and highlights integration responsibilities that are split between `App` and `UIManager`.

- App initialization order (high-level):
  - `App` constructor creates foundational modules in this order: `ExerciseLoader` → `initializePracticeMode()` (creates `PitchDetector`, `Analyzer`, and partially the `CalibrationManager`) → `initializeUIManager()` (creates `UIManager` and calls `uiManager.init()`) → `initializeUI()` (registers DOM event listeners) → `setupKeyboardShortcuts()` → `setupSettingsPanel()` ([src/app.js](src/app.js#L1-L120)).
  - `PlaybackEngine` and `NotationRenderer` are created on-demand when an exercise is loaded: `this.renderer = new NotationRenderer()` ([src/app.js](src/app.js#L2600)) and `this.engine = new PlaybackEngine(exercise.timeline, {...})` ([src/app.js](src/app.js#L2605), [src/app.js](src/app.js#L2408)).

- UI element → handler mapping (key elements):
  - `#activateAudio` → `activateAudioContext()` ([src/app.js](src/app.js#L1623-L1624), implementation at [src/app.js](src/app.js#L2003-L2018)).
  - `#playBtn` → `handlePlay()` ([src/app.js](src/app.js#L1627-L1627), button state updates at [src/app.js](src/app.js#L2143-L2156)).
  - `#pauseBtn` → `handlePause()` ([src/app.js](src/app.js#L1629-L1629)).
  - `#stopBtn` → `handleStop()` ([src/app.js](src/app.js#L1631-L1631)).
  - `#instrumentSelect` → instrument change handler and settings sync ([src/app.js](src/app.js#L1639-L1640), [src/app.js](src/app.js#L1991)).
  - `#tempoSlider` → `handleTempoChange()` ([src/app.js](src/app.js#L1647-L1647), UI sync at [src/app.js](src/app.js#L1525-L1528)).
  - `#practice-microphone-toggle` → `togglePracticeMode()` ([src/app.js](src/app.js#L1651-L1651)).
  - `#calibrate-latency-btn` → `startCalibration()` ([src/app.js](src/app.js#L1659-L1659); calibration details in [src/core/calibrationManager.js](src/core/calibrationManager.js#L1-L40)).
  - `#exerciseFilePractice` / `#exerciseFileLessons` → `handleFileUpload()` ([src/app.js](src/app.js#L1674-L1678)).
  - Tab buttons (`[data-tab]`) → `switchTab()` (registered in `initializeUI()` and mirrored by `UIManager`) — `UIManager` caches tab elements and panels ([src/core/uiManager.js](src/core/uiManager.js#L1-L40)).

- Audio activation flow (detailed):
  1. User clicks `#activateAudio` → `App.activateAudioContext()` invoked ([src/app.js](src/app.js#L1623-L1624)).
  2. `activateAudioContext()` calls `await window.Tone.start()` and resumes the audio context (`window.Tone.context.resume()`), then sets `this.audioActivated = true` ([src/app.js](src/app.js#L2003-L2018)).
  3. If `this.engine` exists, `activateAudioContext()` calls `await this.engine.initializeAudio()` to initialize synthesizers/samplers/metronome in `PlaybackEngine` (see [src/core/playbackEngine.js](src/core/playbackEngine.js#L1-L40)).
  4. If sample mode is active and samples are not yet loaded, `activateAudioContext()` disables controls and waits for `this.waitForSamplesToLoad()` before enabling the UI.
  5. UI state and indicators are updated on success and a notification is shown ([src/app.js](src/app.js#L2033-L2050)).

- Integration responsibilities and coupling notes:
  - `App` directly registers most DOM handlers in `initializeUI()`, while `UIManager` handles tabbing/tuner and higher-level UI concerns. This split can create duplicated responsibilities and coordination complexity ([src/app.js](src/app.js#L1590-L1610), [src/core/uiManager.js](src/core/uiManager.js#L1-L40)).
  - `CalibrationManager` is designed to use `PlaybackEngine` audio routing when available, aligning calibration audio with practice playback and reducing measurement mismatch ([src/core/calibrationManager.js](src/core/calibrationManager.js#L1-L40)).
  - Consider centralizing UI state updates through `UIManager` (e.g., `uiManager.setPlaybackState('playing')`) to avoid scattered DOM mutations and inconsistent state.

- Recommendations (concrete):
  1. Move direct DOM enable/disable/state updates out of `App` and into `UIManager`; expose small methods for playback state, audio activation, and calibration status.
  2. Add a Playwright e2e that performs `page.click('#activateAudio')`, loads an exercise, then `page.click('#playBtn')` to validate the full activation → load → play path with real OSMD/Tone.js bundles.
  3. Add defensive null-checks around all `document.getElementById(...)` calls in `initializeUI()` to avoid errors when DOM changes or elements are missing in alternate pages.
  4. Create `docs/UI_LIFECYCLE.md` with a concise mapping: DOM action → `App` method → emitted module events → listeners. This will help integrators and test authors.

Phase 8 completed: UI wiring and audio activation flow documented. Next: assemble the Executive Summary (critical discrepancies and prioritized remediation plan).

7) Recommendations for tests
- Short-term:
  - Update unit/integration tests that import `STORAGE_KEYS` from `src/utils/constants.js` (if any) to either: import from `src/core/storage.js` (unprefixed), or better, always call `Storage` methods with unprefixed keys in tests.
  - Add an integration test that boots `App` with the real `Storage` and verifies no `g4:g4:` keys are produced when using `STORAGE_KEYS` defined in `src/utils/constants.js` (this will catch double-prefixing regressions).

- Medium-term:
  - Add a test that scans `localStorage` after a standard app flow and asserts there are no keys starting with `g4:g4:`.
  - Add linter rule or test hook to fail CI if any module uses already-prefixed constants with `Storage.set/get`.

8) Phase 6 status
- Tests audit completed at a high level. Several fragile assumptions flagged (double-prefix risk, mixed direct `localStorage` usage). Next: document dependency/CDN reality (Phase 7) or implement the recommended standardization fix.




-----

If you want, I'll now continue to:
1. Expand Phase 3 into a full table of every event found (including file:line emitters and all known listeners), or
2. Proceed to Phase 4 (OSMD deep dive) and map all `new OpenSheetMusicDisplay` occurrences and element-mapping code.


## **Executive Summary**

- **Purpose:** Record of implemented behavior, key discrepancies vs. spec, risks, and prioritized remediation.

- **Critical discrepancies**
  - **Storage key mismatch:** `Storage` auto-prefixes keys with `g4:` while `src/utils/constants.js` exports already-prefixed `g4:...` keys, producing `g4:g4:...` keys at runtime. Impact: silent duplication and inconsistent reads/writes. See [src/core/storage.js](src/core/storage.js#L1) and [src/utils/constants.js](src/utils/constants.js#L1).
  - **Mixed persistence usage:** Some modules (e.g., `UIManager`, `Logger`) write directly to `localStorage`, bypassing `Storage`'s wrapping/versioning and quota handling. See [src/core/uiManager.js](src/core/uiManager.js#L420) and [src/utils/logger.js](src/utils/logger.js#L44).
  - **Dependency sourcing ambiguity:** `opensheetmusicdisplay` is loaded only via CDN while `tone` exists in both `package.json` and CDN. This complicates bundling and CI reproducibility. See [index.html](index.html#L9-L12) and [package.json](package.json#L1-L40).
  - **UI coupling & duplication:** `App` and `UIManager` both perform DOM state updates, causing duplication and potential race conditions. See [src/app.js](src/app.js#L1590) and [src/core/uiManager.js](src/core/uiManager.js#L1).
  - **Tests mask integration faults:** Many unit tests use mocks for OSMD, Tone, and `localStorage`; integration tests with real browser bundles are needed.

- **Prioritized remediation plan**
  1. **P0 — Storage fix (urgent, 1–3 hrs):** Standardize `STORAGE_KEYS` to unprefixed values (update `src/utils/constants.js`), migrate call-sites to pass unprefixed keys to `Storage`, and update `UIManager` and `Logger` to use `Storage`. Add a unit test that fails on `g4:g4:` keys.
  2. **P1 — Dependency model & deploy docs (1 day):** Choose CDN vs npm/bundler. If bundling, add `opensheetmusicdisplay` to `package.json` and import it; otherwise document CDN globals in `docs/DEPLOYMENT.md` and remove duplicate `tone` npm entry if appropriate.
  3. **P2 — Integration tests (1–2 days):** Add Playwright e2e tests exercising `#activateAudio` → load exercise → `#playBtn` using real OSMD/Tone bundles.
  4. **P3 — UI refactor (2–3 days):** Centralize DOM state updates into `UIManager`, expose small methods (e.g., `setPlaybackState`), and update tests to use these APIs.

- **Quick wins**
  - Add a CI test scanning for `g4:g4:` keys after a standard app flow.
  - Add a Playwright smoke test verifying `#activateAudio` toggles the audio status indicator.

- **Recommended immediate next step:** Implement **P0** now to eliminate the most likely source of silent data corruption.

Phase 9 (Executive Summary) added.

```



