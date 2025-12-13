# RULES.md - Guitar4 Project Governance & Coding Standards

**Version**: 1.0  
**Status**: Active  
**Last Updated**: 2025-01-XX  
**Purpose**: Define coding standards, governance requirements, and development practices for Guitar4

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Coding Standards](#coding-standards)
3. [Architecture Rules](#architecture-rules)
4. [Testing Requirements](#testing-requirements)
5. [Governance Requirements](#governance-requirements)
6. [Documentation Standards](#documentation-standards)
7. [Git Workflow](#git-workflow)
8. [Code Review Guidelines](#code-review-guidelines)
9. [Performance Requirements](#performance-requirements)
10. [Security Guidelines](#security-guidelines)

---

## 1. Core Principles

### 1.1 Fundamental Values

**Performance First**
- Audio processing requires minimal latency (≤80ms total pipeline)
- Every architectural decision prioritizes real-time performance
- Memory budget strictly enforced (<300MB total)

**Progressive Enhancement**
- Core features work without advanced capabilities
- Graceful degradation when features unavailable
- Clear user communication about limitations

**Client-Side Only (v1)**
- No backend services or external dependencies
- All processing occurs in browser
- User data never leaves device

**Event-Driven Architecture**
- Modules communicate via events, never direct calls
- Loose coupling enables independent testing
- Single responsibility per module

**Test-Driven Development**
- Write tests before implementation
- Maintain ≥80% code coverage
- Integration tests for all data pipelines

---

## 2. Coding Standards

### 2.1 Language and Syntax

**JavaScript Version**
```javascript
// ✅ Use ES6+ features
class ExerciseLoader extends EventEmitter {
  async parseXML(xmlContent) {
    const result = await this.processData();
    return result;
  }
}

// ✅ Arrow functions for callbacks
array.map(item => item.value);

// ✅ Template literals
const message = `Loaded ${count} exercises`;

// ✅ Destructuring
const { id, title, timeline } = exercise;

// ✅ Spread operator
const updated = { ...original, newField: value };

// ❌ Don't use var
var x = 5; // NO!

// ❌ Don't use old-style functions where arrow functions suffice
array.map(function(item) { return item.value; }); // NO!
```

**No Frameworks**
```javascript
// ❌ NO React, Vue, Angular, Svelte
// ❌ NO jQuery

// ✅ Vanilla JavaScript only
document.querySelector('.element').addEventListener('click', handler);

// ✅ Exception: Approved libraries only
import * as Tone from 'tone';  // Audio synthesis
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';  // Notation
import * as tf from '@tensorflow/tfjs';  // ML model
```

**Approved Libraries**
- **OpenSheetMusicDisplay**: Notation rendering
- **Tone.js**: Audio synthesis and scheduling
- **TensorFlow.js**: Polyphonic detection model
- **Playwright**: E2E testing only
- **No other dependencies without explicit approval**

---

### 2.2 Naming Conventions

**Classes**
```javascript
// PascalCase
class ExerciseLoader { }
class NotationRenderer { }
class PlaybackEngine { }
```

**Functions and Methods**
```javascript
// camelCase
function parseXML() { }
async loadFromFile() { }
getNoteElement(noteId) { }
```

**Constants**
```javascript
// UPPER_SNAKE_CASE
const MAX_BUFFER_SIZE = 4096;
const DEFAULT_BPM = 120;
const TOLERANCE_PRESETS = { ... };
```

**Private Methods**
```javascript
class MyClass {
  // Prefix with underscore
  _privateMethod() { }
  _internalHelper() { }
}
```

**Event Names**
```javascript
// namespace:action (lowercase, hyphenated)
this.emit('exercise:loaded');
this.emit('playback:tick');
this.emit('pitch:detected');
this.emit('analysis:complete');
```

**File Names**
```javascript
// camelCase for modules
exerciseLoader.js
notationRenderer.js
playbackEngine.js

// kebab-case for utilities
event-emitter.js
performance-monitor.js
```

---

### 2.3 Code Organization

**File Structure**
```javascript
// 1. Imports (external first, then internal)
import * as Tone from 'tone';
import { EventEmitter } from '../utils/eventEmitter.js';

// 2. Constants
const DEFAULT_CONFIG = {
  bpm: 120,
  instrument: 'guitar'
};

// 3. Class definition
class PlaybackEngine extends EventEmitter {
  // 3a. Constructor
  constructor(timeline, config) {
    super();
    this.timeline = timeline;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  // 3b. Public methods (alphabetically)
  pause() { }
  async play() { }
  stop() { }
  
  // 3c. Private methods (alphabetically)
  _scheduleNote(note) { }
  _updateState(newState) { }
  
  // 3d. Getters/Setters
  get currentPosition() { }
  set tempo(bpm) { }
}

// 4. Export
export { PlaybackEngine };
```

**Module Structure**
```
src/core/moduleName.js
├── Imports
├── Constants
├── Main Class
│   ├── Constructor
│   ├── Public Methods
│   ├── Private Methods
│   └── Getters/Setters
└── Export
```

---

### 2.4 JSDoc Requirements

**All Public Methods MUST Have JSDoc**

```javascript
/**
 * Parse MusicXML string into ExerciseJSON structure
 * 
 * @param {string} xmlContent - Raw MusicXML content
 * @returns {Promise<ExerciseJSON>} Parsed exercise data with timeline and metadata
 * @throws {ParseError} If XML is invalid or missing required elements
 * 
 * @example
 * const loader = new ExerciseLoader();
 * const exercise = await loader.parseXML(xmlString);
 * console.log(exercise.timeline.length); // Number of notes
 */
async parseXML(xmlContent) {
  // Implementation
}
```

**Required JSDoc Elements**
- `@param` - All parameters with types and descriptions
- `@returns` - Return value with type and description
- `@throws` - Exceptions that may be thrown
- `@example` - Usage example for complex methods

**Class Documentation**
```javascript
/**
 * Manages real-time audio playback with deterministic scheduling
 * 
 * Uses Tone.js Transport for musical time synchronization and emits
 * tick events for visual cursor updates. Handles tempo changes and
 * supports both synthesis and sample-based playback.
 * 
 * @extends EventEmitter
 * @fires PlaybackEngine#playback:started
 * @fires PlaybackEngine#playback:tick
 * @fires PlaybackEngine#playback:completed
 * 
 * @example
 * const engine = new PlaybackEngine(timeline, { bpm: 120 });
 * engine.on('playback:tick', (data) => {
 *   updateCursor(data.noteId);
 * });
 * await engine.play();
 */
class PlaybackEngine extends EventEmitter {
  // ...
}
```

---

### 2.5 Error Handling

**Always Use Try-Catch for Async Operations**
```javascript
// ✅ Correct pattern
async someMethod() {
  try {
    const result = await riskyOperation();
    return result;
  } catch (error) {
    console.error('ModuleName: someMethod failed:', error);
    
    // Emit error event (don't throw in most cases)
    this.emit('module:error', {
      error: error.message,
      method: 'someMethod',
      recoverable: true
    });
    
    // Return safe fallback
    return null;
  }
}

// ❌ Don't let errors crash the app
async badMethod() {
  const result = await riskyOperation(); // NO! Unhandled rejection
  return result;
}
```

**Error Event Structure**
```javascript
{
  error: string,        // Error message
  method: string,       // Method that failed
  module: string,       // Module name
  recoverable: boolean, // Can user recover?
  timestamp: number     // When it occurred
}
```

**User-Facing Error Messages**
```javascript
// ✅ Clear, actionable messages
"Could not load exercise. Please check that the file is valid MusicXML."
"Microphone access denied. Guitar4 needs microphone permission for pitch detection."

// ❌ Technical jargon
"XML parse error: Unexpected token at line 42"
"QuotaExceededError: DOM Exception 22"
```

---

### 2.6 Code Quality Standards

**No Console.log in Production Code**
```javascript
// ❌ Don't leave console.log
console.log('Debug info:', data);

// ✅ Use logger utility
import { Logger } from '../utils/logger.js';
Logger.log(Logger.INFO, 'ExerciseLoader', 'Parsed exercise', { noteCount });
```

**No Magic Numbers**
```javascript
// ❌ Magic numbers
if (buffer.length > 4096) { }
setTimeout(callback, 250);

// ✅ Named constants
const MAX_BUFFER_SIZE = 4096;
const DEBOUNCE_DELAY_MS = 250;

if (buffer.length > MAX_BUFFER_SIZE) { }
setTimeout(callback, DEBOUNCE_DELAY_MS);
```

**DRY Principle (Don't Repeat Yourself)**
```javascript
// ❌ Repeated code
function processNoteA(note) {
  const midi = calculateMidi(note.pitch, note.octave);
  const frequency = 440 * Math.pow(2, (midi - 69) / 12);
  return frequency;
}

function processNoteB(note) {
  const midi = calculateMidi(note.pitch, note.octave);
  const frequency = 440 * Math.pow(2, (midi - 69) / 12);
  return frequency;
}

// ✅ Extract common logic
function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function processNote(note) {
  const midi = calculateMidi(note.pitch, note.octave);
  return midiToFrequency(midi);
}
```

**Single Responsibility Principle**
```javascript
// ❌ Method doing too much
function loadAndRenderAndPlay(file) {
  const xml = readFile(file);
  const exercise = parseXML(xml);
  renderNotation(exercise);
  startPlayback(exercise);
}

// ✅ Separate concerns
async function loadExercise(file) {
  const xml = await readFile(file);
  return await parseXML(xml);
}

function renderExercise(exercise) {
  notationRenderer.render(exercise);
}

function startPlayback(exercise) {
  playbackEngine.play(exercise.timeline);
}
```

---

## 3. Architecture Rules

### 3.1 Module Communication

**Rule: Modules MUST Communicate via Events**
```javascript
// ✅ Correct: Event-based communication
class UIManager {
  constructor(playbackEngine) {
    playbackEngine.on('playback:tick', this.onTick.bind(this));
  }
  
  onTick(data) {
    this.updateCursor(data.noteId);
  }
}

// ❌ Wrong: Direct method calls between core modules
class UIManager {
  constructor(playbackEngine) {
    this.playbackEngine = playbackEngine;
  }
  
  update() {
    const position = this.playbackEngine.getCurrentPosition(); // NO!
  }
}
```

**Exception**: UIManager may call public methods on modules it orchestrates, but modules MUST NOT call each other directly.

---

### 3.2 Event Emitter Pattern

**All Core Modules MUST Extend EventEmitter**
```javascript
import { EventEmitter } from '../utils/eventEmitter.js';

class MyModule extends EventEmitter {
  constructor() {
    super(); // Required
  }
  
  someAction() {
    // Do work
    this.emit('module:actionComplete', { result: data });
  }
}
```

**Event Naming Convention**
```
namespace:action

Examples:
- exercise:loaded
- exercise:error
- playback:started
- playback:tick
- playback:completed
- pitch:detected
- analysis:complete
```

---

### 3.3 Data Contracts

**Follow Defined Data Structures**

All data structures defined in `architecture.md` §4 are **mandatory**:

- **ExerciseJSON** - Exercise loader output
- **PitchStream** - Pitch detector output  
- **AnalysisResult** - Analyzer output
- **PlaybackConfig** - Playback engine config
- **DetectorConfig** - Pitch detector config
- **ToleranceConfig** - Analyzer tolerance

**Do NOT modify structure without updating architecture.md**

```javascript
// ✅ Correct: Follow ExerciseJSON structure
const exercise = {
  id: 'unique-id',
  title: 'Exercise Title',
  timeline: [...],
  osmdNotation: 'xml string',
  osmdTab: 'xml string',
  // ... as defined in architecture.md §4.1
};

// ❌ Wrong: Adding undocumented fields
const exercise = {
  id: 'unique-id',
  customField: 'value', // NOT in spec!
  // ...
};
```

---

### 3.4 Single OSMD Instance Rule

**CRITICAL: Single OSMD instance renders BOTH staves**

```javascript
// ✅ Correct: One OSMD instance with both staves
const osmdInstance = new OpenSheetMusicDisplay(container);
await osmdInstance.load(exercise.osmdInput); // Contains BOTH staves
await osmdInstance.render();

// ❌ Wrong: Two separate OSMD instances
const osmdNotation = new OpenSheetMusicDisplay(notationContainer);
const osmdTab = new OpenSheetMusicDisplay(tabContainer);
// NO! This violates architecture
```

**Rationale**: MusicXML files contain both notation and tablature staves in a single score. OSMD renders both simultaneously.

---

## 4. Testing Requirements

### 4.1 Test Coverage

**Minimum Coverage: 80%**
```bash
# Must pass before PR merge
npm run test:coverage

# Coverage by module (target):
exerciseLoader.js      → 85%+
notationRenderer.js    → 75%+
playbackEngine.js      → 85%+
pitchDetector.js       → 90%+
analyzer.js            → 85%+
storage.js             → 85%+
```

### 4.2 Test-Driven Development

**Write Tests BEFORE Implementation**
```bash
# 1. Write failing test
vim src/tests/unit/myModule.test.js

# 2. Run test (should fail)
npm test

# 3. Implement feature
vim src/core/myModule.js

# 4. Run test (should pass)
npm test
```

### 4.3 Test File Organization

**Co-locate Tests with Source**
```
src/
├── core/
│   └── exerciseLoader.js
└── tests/
    ├── unit/
    │   └── exerciseLoader.test.js
    ├── integration/
    │   └── loadAndRender.test.js
    └── e2e/
        └── practice.test.js
```

### 4.4 Test Naming Convention

```javascript
// Pattern: "ModuleName - should [expected behavior]"
test('ExerciseLoader - should parse valid MusicXML', async () => { });
test('ExerciseLoader - should reject malformed XML', async () => { });
test('PlaybackEngine - should emit tick events at correct intervals', async () => { });
```

### 4.5 No Real Audio in Automated Tests

```javascript
// ✅ Use synthetic audio
import { AudioSampleGenerator } from '../fixtures/audioSamples.js';
const testAudio = AudioSampleGenerator.generateSineWave(440, 1.0);

// ❌ Never use real microphone
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
// NO! Tests become flaky
```

---

## 5. Governance Requirements

### 5.1 Required Files

**MUST Exist and Be Maintained**
```
.cline/
├── CLINE_TODO.md        # Current task tracking
└── governance/
    └── hooks/
        └── pre-commit   # Governance validation

CLINE_MEMORY.md          # Task completion history
RULES.md                 # This file
architecture.md          # Technical specifications
MASTER_PROMPT.md         # Milestone roadmap
TESTING.md               # Test procedures
DEV_NOTES.md             # Developer guide
```

### 5.2 Pre-Commit Requirements

**Pre-Commit Hook MUST Validate**
```bash
# Installed at: .git/hooks/pre-commit
# Checks:
✓ .cline/CLINE_TODO.md exists
✓ CLINE_MEMORY.md exists
✓ JSDoc present in modified .js files
✓ No console.log in modified files
✓ npm run lint:rules passes
```

**Install Hook**
```bash
chmod +x .cline/governance/hooks/pre-commit
ln -s ../../.cline/governance/hooks/pre-commit .git/hooks/pre-commit
```

### 5.3 Task Tracking

**Before Starting Work**
```markdown
# Update .cline/CLINE_TODO.md

## Current Task
**Milestone:** M2 - Exercise Loader
**Status:** In Progress
**Started:** 2025-01-15 10:30 UTC
**Estimated Completion:** 2025-01-16 EOD

### Objectives
- Implement MusicXML parsing
- Generate timeline structure
- Separate notation and tablature staves
- Write unit tests (target 85% coverage)

### Dependencies
- None

### Blockers
- None currently
```

**After Completing Work**
```markdown
# Append to CLINE_MEMORY.md

### Milestone 2: Exercise Loader
**Date:** 2025-01-16 18:45 UTC
**Task:** Implemented complete MusicXML parsing and timeline generation

**Details:**
- Created ExerciseLoader class with full API
- Implemented staff separation (notation/tablature)
- Generated timeline with 100% accuracy for sample files
- Handled malformed XML with graceful errors

**Testing:**
- Unit tests: 18 tests, all passing
- Coverage: 87% (exceeds 85% target)
- Tested with all 5 sample XML files

**Impact:** 
Core data structure (ExerciseJSON) now available for downstream modules

**Components Modified:**
- src/core/exerciseLoader.js (new)
- src/tests/unit/exerciseLoader.test.js (new)
- architecture.md (updated with implementation notes)

**Governance:**
- CLINE_TODO.md: Marked M2 complete, M3 queued
- Tests passing: Yes
- Documentation updated: Yes
- Pre-commit hook validated: Yes

---
```

### 5.4 Branch Naming

**Convention**
```bash
feature/milestone-X-feature-name
fix/issue-description
test/test-suite-name
docs/documentation-topic

# Examples:
git checkout -b feature/milestone-2-exercise-loader
git checkout -b fix/osmd-rendering-crash
git checkout -b test/integration-pipeline-tests
git checkout -b docs/update-architecture
```

---

## 6. Documentation Standards

### 6.1 Inline Comments

**When to Comment**
```javascript
// ✅ Explain WHY, not WHAT
// Use adaptive buffer sizing because low frequencies (E2, A2) 
// require longer analysis windows to detect fundamental accurately
if (frequency < 100) {
  bufferSize = 4096;
}

// ❌ Don't state the obvious
// Set buffer size to 4096
bufferSize = 4096;
```

**Complex Algorithms**
```javascript
// YIN Algorithm Step 2: Calculate cumulative mean normalized difference
// This normalizes the difference function to make threshold comparison reliable
// See: de Cheveigné & Kawahara (2002), equation 8
for (let tau = 1; tau < halfBufferSize; tau++) {
  let sum = 0;
  for (let j = 1; j <= tau; j++) {
    sum += normalizedDifference[j];
  }
  cumulativeMean[tau] = normalizedDifference[tau] / (sum / tau);
}
```

### 6.2 Architecture Documentation

**Update architecture.md When:**
- Adding new module
- Changing data structure
- Modifying event contracts
- Altering data flow pipeline
- Making architectural decisions (create ADR)

### 6.3 README Updates

**Keep README.md Current**
```markdown
# Must include:
- Setup instructions
- Quick start guide
- Feature list
- Browser compatibility
- Known issues
- Contributing guidelines
```

---

## 7. Git Workflow

### 7.1 Commit Message Format

**Use Conventional Commits**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**
```bash
feat(M2): Implement exercise loader with MusicXML parsing

- Created ExerciseLoader class
- Implemented staff separation algorithm
- Added timeline generation with millisecond timestamps
- Comprehensive error handling for malformed XML

Tests: 18 unit tests, 87% coverage
Closes #15

---

fix(playback): Correct timing drift in long exercises

Use Tone.Transport.schedule instead of setTimeout to eliminate
cumulative timing errors over 5+ minute exercises.

Fixes #23

---

docs(architecture): Add ADR-007 for storage strategy

Document decision to use LocalStorage in v1 with migration
path to cloud sync in v2.
```

### 7.2 Commit Frequency

**Commit Often, Push Daily**
```bash
# ✅ Small, focused commits
git commit -m "feat(loader): Add XML validation"
git commit -m "feat(loader): Implement staff separation"
git commit -m "test(loader): Add unit tests for timeline generation"

# ❌ Large, monolithic commits
git commit -m "Implemented entire exercise loader" # NO!
```

### 7.3 Pull Request Requirements

**Every PR MUST Include:**
```markdown
## Milestone: [M0-M15]

### Description
[Brief description of changes]

### Changes
- [ ] Core module(s) implemented: [list]
- [ ] Unit tests added/updated
- [ ] Integration tests added (if applicable)
- [ ] Documentation updated

### Governance Compliance
- [ ] RULES.md standards followed
- [ ] .cline/CLINE_TODO.md updated
- [ ] CLINE_MEMORY.md appended
- [ ] npm run lint:rules passes
- [ ] Pre-commit hook passes

### Testing
- [ ] npm test passes
- [ ] Coverage ≥80%
- [ ] Manual testing completed

### Acceptance Criteria Met
[List criteria from MASTER_PROMPT.md]
- [ ] Criterion 1
- [ ] Criterion 2

### Performance Metrics (if applicable)
- Latency: X ms
- Memory: Y MB
- Coverage: Z%
```

---

## 8. Code Review Guidelines

### 8.1 Review Checklist

**Reviewer MUST Verify:**
- [ ] Code follows RULES.md standards
- [ ] All tests pass (`npm test`)
- [ ] Coverage meets threshold (≥80%)
- [ ] JSDoc comments present on public methods
- [ ] No console.log statements
- [ ] Error handling implemented
- [ ] Performance targets met (if applicable)
- [ ] Documentation updated
- [ ] Governance files updated
- [ ] No security vulnerabilities

### 8.2 Review Focus Areas

**Architecture Compliance**
- Module communication via events only
- Data structures match architecture.md
- No framework dependencies
- Single responsibility maintained

**Code Quality**
- No code duplication
- Clear variable names
- Consistent formatting
- Appropriate abstraction level

**Testing**
- Tests actually test the behavior
- Edge cases covered
- No flaky tests
- Mocks used appropriately

---

## 9. Performance Requirements

### 9.1 Latency Budget (Strictly Enforced)

**Total Pipeline: ≤80ms**
```
Audio capture:        10-20ms
Pitch detection:      <30ms
Analysis:             <50ms
Visual update:        <20ms
────────────────────────────
TOTAL:                ≤80ms
```

**Validation**
```javascript
// Measure with performance monitor
import { performanceMonitor } from '../utils/performanceMonitor.js';

performanceMonitor.startMeasurement('fullPipeline');
// ... process audio through pipeline
const latency = performanceMonitor.endMeasurement('fullPipeline');

// Must not exceed target
if (latency > 80) {
  console.error(`Latency ${latency}ms exceeds 80ms target!`);
}
```

### 9.2 Memory Budget (Strictly Enforced)

**Total Application: <300MB**
```
Base application:     <50MB
OSMD instances:       <20MB each
Magenta model:        <150MB
Audio buffers:        <10MB
Cached exercises:     <10MB each
────────────────────────────
TOTAL:                <300MB
```

**Monitoring**
```javascript
// Check memory usage
if (performance.memory) {
  const used = performance.memory.usedJSHeapSize;
  const usedMB = used / 1024 / 1024;
  
  if (usedMB > 300) {
    console.warn(`Memory ${usedMB}MB exceeds 300MB budget!`);
  }
}
```

### 9.3 CPU Usage Targets

```
Idle:                 <5%
Pitch detection:      <25%
Playback + synthesis: <15%
Combined pipeline:    <40%
```

### 9.4 Rendering Performance

```
Initial render (50 measures):     <2s
Cursor update:                     60fps
Scrolling:                         60fps
Zoom/pan:                          60fps
```

---

## 10. Security Guidelines

### 10.1 Input Validation

**ALWAYS Validate User Input**
```javascript
// File uploads
function validateFile(file) {
  // Check type
  const allowedTypes = ['text/xml', 'application/xml'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type');
  }
  
  // Check size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File too large');
  }
  
  // Check extension
  if (!file.name.match(/\.(xml|musicxml)$/i)) {
    throw new Error('Invalid file extension');
  }
}
```

**Sanitize XML Content**
```javascript
function sanitizeXML(xmlContent) {
  // Remove script tags (defensive, should never be in MusicXML)
  xmlContent = xmlContent.replace(/<script[^>]*>.*?<\/script>/gi, '');
  
  // Remove event handlers
  xmlContent = xmlContent.replace(/on\w+="[^"]*"/gi, '');
  
  return xmlContent;
}
```

### 10.2 Audio Context Security

**Require User Gesture**
```javascript
// ✅ Always require user gesture
document.getElementById('activateAudio').addEventListener('click', async () => {
  await Tone.start(); // User gesture present
});

// ❌ Don't auto-start audio context
window.addEventListener('load', () => {
  Tone.start(); // NO! Violates browser policy
});
```

### 10.3 LocalStorage Security

**Namespace Keys to Prevent Collisions**
```javascript
// ✅ Prefix all keys
localStorage.setItem('g4:settings', JSON.stringify(settings));

// ❌ Generic keys
localStorage.setItem('settings', JSON.stringify(settings)); // Collision risk
```

**No Sensitive Data**
```javascript
// ✅ Store user preferences only
const settings = { instrument: 'guitar', tempo: 120 };

// ❌ Never store sensitive data
const data = { password: 'secret', apiKey: 'xyz' }; // NO!
```

### 10.4 Dependencies

**Regular Security Audits**
```bash
# Run before every release
npm audit

# Fix critical vulnerabilities immediately
npm audit fix

# Update dependencies quarterly
npm outdated
npm update
```

---

## 11. Enforcement

### 11.1 Automated Validation

**Pre-Commit Hook**
- Runs `npm run lint:rules`
- Validates governance files exist
- Checks for JSDoc in modified files
- Prevents commits that violate rules

**CI/CD Pipeline**
- Runs all tests
- Checks coverage threshold
- Validates performance benchmarks
- Blocks merge if quality gates fail

### 11.2 Manual Review

**Required for PR Merge:**
- Code review by at least one other developer (or documented self-review)
- All automated checks passing
- Governance files updated
- Documentation current

### 11.3 Exceptions

**Requesting Exception:**
1. Document reason in PR description
2. Get approval from project lead
3. Add comment in code explaining exception
4. Create follow-up issue to address properly

**Example:**
```javascript
// EXCEPTION: Using setTimeout instead of Tone.Transport
// Rationale: This is a UI debounce, not musical timing
// Issue: #47 - Refactor to use proper debounce utility
// Approved by: [Lead Developer Name]
setTimeout(() => this.handleResize(), 250);
```

---

## 12. Governance Validation Command

### 12.1 Running Validation

```bash
# Validate all governance requirements
npm run lint:rules

# Expected output:
🔍 Validating RULES.md compliance...
✅ Governance files present
✅ Pre-commit hooks configured
✅ Coding standards appear compliant
✅ All checks passed
```

### 12.2 What Gets Checked

1. **.cline/CLINE_TODO.md** exists and is accessible
2. **CLINE_MEMORY.md** exists and contains task history
3. **Pre-commit hook** installed at `.git/hooks/pre-commit`
4. **JSDoc** comments present in core modules
5. **No console.log** in production code
6. **Test coverage** meets threshold

---

## 13. Quick Reference

### Do's ✅

- Use ES6+ JavaScript
- Extend EventEmitter for core modules
- Write JSDoc for all public methods
- Write tests before implementation
- Use try-catch for async operations
- Emit events instead of throwing errors
- Update governance files (CLINE_TODO.md, CLINE_MEMORY.md)
- Follow naming conventions
- Keep functions small and focused
- Validate user input
- Use performance monitor for latency checks

### Don'ts ❌

- Use frameworks (React, Vue, Angular)
- Use jQuery or similar libraries
- Make direct calls between core modules
- Leave console.log in code
- Use magic numbers
- Skip writing tests
- Commit without updating governance files
- Modify data structures without updating architecture.md
- Use var keyword
- Ignore performance budgets
- Store sensitive data in LocalStorage
- Use real microphone in automated tests
- Create OSMD instances for each staff separately
- Use setTimeout/setInterval for musical timing
- Let errors crash the application

---

## 14. Common Violations and Fixes

### Violation 1: Missing JSDoc
```javascript
// ❌ Missing documentation
async parseXML(xmlContent) {
  // Implementation
}

// ✅ Proper JSDoc
/**
 * Parse MusicXML string into ExerciseJSON structure
 * @param {string} xmlContent - Raw MusicXML content
 * @returns {Promise<ExerciseJSON>} Parsed exercise data
 * @throws {ParseError} If XML is invalid
 */
async parseXML(xmlContent) {
  // Implementation
}
```

### Violation 2: Direct Module Calls
```javascript
// ❌ Direct method call between modules
class NotationRenderer {
  update() {
    const position = this.playbackEngine.getCurrentPosition();
    this.scrollToNote(position);
  }
}

// ✅ Event-based communication
class NotationRenderer {
  constructor(playbackEngine) {
    playbackEngine.on('playback:tick', (data) => {
      this.scrollToNote(data.noteId);
    });
  }
}
```

### Violation 3: Console.log in Production
```javascript
// ❌ Debug logging left in
function processData(data) {
  console.log('Processing:', data);
  return result;
}

// ✅ Use logger utility
import { Logger } from '../utils/logger.js';

function processData(data) {
  Logger.log(Logger.DEBUG, 'DataProcessor', 'Processing data', { data });
  return result;
}
```

### Violation 4: Missing Tests
```javascript
// ❌ Feature without tests
// src/core/newFeature.js implemented
// No corresponding test file

// ✅ Tests included
// src/core/newFeature.js
// src/tests/unit/newFeature.test.js (coverage ≥80%)
```

### Violation 5: Not Following Data Contracts
```javascript
// ❌ Custom data structure
const myExercise = {
  name: 'Exercise',  // Should be 'title'
  notes: [],         // Should be 'timeline'
  customField: 'x'   // Not in spec
};

// ✅ Follow ExerciseJSON structure
const exercise = {
  id: 'unique-id',
  title: 'Exercise',
  timeline: [],
  osmdNotation: 'xml',
  osmdTab: 'xml',
  // ... as defined in architecture.md §4.1
};
```

---

## 15. Version History

### Version 1.0 (2025-01-XX)
- Initial RULES.md creation
- Defined core principles and coding standards
- Established governance requirements
- Set performance budgets
- Created validation framework

---

## 16. Related Documents

- **MASTER_PROMPT.md** - Milestone implementation roadmap
- **architecture.md** - Technical architecture and specifications
- **TESTING.md** - Testing strategies and procedures
- **DEV_NOTES.md** - Developer quick reference guide
- **improved_project_spec.md** - Detailed functional requirements
- **style-guide.md** - UI/UX design system

---

## 17. Enforcement Levels

### Critical (Must Fix Before Merge)
- Test coverage below 80%
- Performance budget violations
- Security vulnerabilities
- Missing governance file updates
- Breaking architecture rules (e.g., direct module calls)

### High Priority (Must Fix Before Release)
- Missing JSDoc on public methods
- Console.log statements
- Code duplication
- Memory leaks

### Medium Priority (Should Fix)
- Non-critical naming convention violations
- Minor code style inconsistencies
- Insufficient inline comments

### Low Priority (Nice to Have)
- Refactoring opportunities
- Additional test cases
- Documentation improvements

---

## 18. Onboarding Checklist

### For New Developers

**Before First Commit:**
- [ ] Read RULES.md (this document) completely
- [ ] Review MASTER_PROMPT.md for project structure
- [ ] Read architecture.md sections relevant to your work
- [ ] Review DEV_NOTES.md for common gotchas
- [ ] Install and test pre-commit hook
- [ ] Run `npm run lint:rules` successfully
- [ ] Review existing code to understand patterns

**Before First PR:**
- [ ] All tests passing locally
- [ ] Coverage ≥80% for new code
- [ ] JSDoc on all public methods
- [ ] Governance files updated
- [ ] Documentation updated
- [ ] Manual testing completed
- [ ] Performance benchmarks met (if applicable)

---

## 19. Maintenance

### Updating This Document

**When to Update RULES.md:**
- New architectural patterns emerge
- Performance budgets change
- New tools or libraries approved
- Governance process changes
- Security requirements evolve

**Update Process:**
1. Create issue proposing change
2. Discuss with team
3. Update RULES.md
4. Update version history
5. Notify all developers
6. Update validation scripts if needed

---

## 20. Contact and Support

### Questions About Rules
- Open issue with label `governance`
- Reference specific section number
- Propose clarification or change

### Requesting Exception
- Open issue with label `exception-request`
- Provide detailed justification
- Suggest alternative approach
- Get approval before proceeding

### Reporting Violations
- Open issue with label `rules-violation`
- Reference section and commit/PR
- Suggest fix if possible

---

## Appendix A: Validation Script

### Implementation: `scripts/validate-governance.js`

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
      'MASTER_PROMPT.md',
      'architecture.md',
      'TESTING.md',
      'DEV_NOTES.md'
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
        
        // Check for console.log
        if (content.match(/console\.log\(/)) {
          this.warnings.push(`${module} contains console.log statements`);
        }
        
        // Check for JSDoc
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

### Add to package.json:
```json
{
  "scripts": {
    "lint:rules": "node scripts/validate-governance.js"
  }
}
```

---

## Appendix B: Pre-Commit Hook

### Implementation: `.cline/governance/hooks/pre-commit`

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

# Check for console.log in staged JS files
staged_js_files=$(git diff --cached --name-only --diff-filter=ACM | grep '\.js)
if [ -n "$staged_js_files" ]; then
  for file in $staged_js_files; do
    if grep -q "console\.log" "$file"; then
      echo "⚠️  Warning: $file contains console.log statements"
    fi
    
    # Check for JSDoc in core modules
    if [[ $file == src/core/* ]]; then
      if ! grep -q '@param\|@returns\|@description' "$file"; then
        echo "⚠️  Warning: $file may be missing JSDoc comments"
      fi
    fi
  done
fi

echo "✅ Pre-commit checks passed"
exit 0
```

### Installation:
```bash
chmod +x .cline/governance/hooks/pre-commit
ln -s ../../.cline/governance/hooks/pre-commit .git/hooks/pre-commit
```

---

## Appendix C: Example PR Template

### File: `.github/PULL_REQUEST_TEMPLATE.md`

```markdown
## Milestone: [M0-M15]

### Description
Brief description of what this PR accomplishes

### Changes
- [ ] Core module(s) implemented: [list modules]
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
- [ ] Manual testing completed (document in comments)
- [ ] Performance targets met (if applicable)

### Test Results
```
Paste output of `npm test` here
```

### Performance Metrics (if applicable)
- Latency: X ms (target: ≤80ms)
- Memory: Y MB (target: <300MB)
- CPU: Z% (target: <40%)
- Coverage: W%

### Acceptance Criteria Met
From MASTER_PROMPT.md SUB-PROMPT X:
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

### Breaking Changes
- [ ] No breaking changes
- [ ] Breaking changes (describe below):

### Additional Notes
Any additional context, decisions made, or issues encountered.

### Related Issues
Closes #[issue-number]
```

---

## Appendix D: Code Quality Checklist

### Self-Review Before Creating PR

**Code Quality**
- [ ] No code duplication (DRY principle)
- [ ] Functions are small and focused (<50 lines)
- [ ] Variable names are clear and descriptive
- [ ] No magic numbers (use named constants)
- [ ] Error handling implemented
- [ ] Edge cases considered

**Architecture Compliance**
- [ ] Modules communicate via events only
- [ ] Data structures match architecture.md
- [ ] No framework dependencies added
- [ ] Single responsibility maintained
- [ ] Follows event naming convention

**Testing**
- [ ] Tests written before implementation (TDD)
- [ ] All tests pass
- [ ] Coverage ≥80%
- [ ] Tests use synthetic data (no real audio/microphone)
- [ ] No flaky tests

**Documentation**
- [ ] JSDoc on all public methods
- [ ] Complex algorithms commented
- [ ] README.md updated (if needed)
- [ ] architecture.md updated (if structures changed)
- [ ] TESTING.md updated (if tests added)

**Performance**
- [ ] Latency measured and within budget
- [ ] Memory usage checked
- [ ] No obvious performance bottlenecks
- [ ] Async operations don't block UI

**Security**
- [ ] User input validated
- [ ] No sensitive data in LocalStorage
- [ ] Audio context requires user gesture
- [ ] Dependencies up to date (`npm audit`)

**Governance**
- [ ] CLINE_TODO.md updated
- [ ] CLINE_MEMORY.md appended
- [ ] Commit messages follow convention
- [ ] Branch name follows convention

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Status**: Active  
**Next Review**: Quarterly or when major changes needed  
**Maintained By**: Guitar4 Development Team

---

**For questions or clarifications about these rules, open an issue with the `governance` label.**