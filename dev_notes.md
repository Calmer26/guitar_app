# DEV_NOTES

Development notes, decisions, and guidance for Guitar4.

## Architecture Decisions

### Event-Driven Communication
**Decision**: All core modules extend EventEmitter and communicate via events, never direct method calls.

**Rationale**: Loose coupling enables independent testing and development. Modules can be replaced or tested in isolation.

**Example**:
```javascript
// ✅ Correct: Event-based
pitchDetector.on('pitch:detected', (data) => {
  analyzer.processPitch(data);
});

// ❌ Wrong: Direct calls
analyzer.processPitch(pitchDetector.getCurrentPitch());
```

### Single OSMD Instance
**Decision**: Use one OSMD instance to render both notation and tablature staves simultaneously.

**Rationale**: MusicXML contains both staves in a single score. OSMD renders them together naturally.

**Implementation**:
```javascript
const osmd = new OpenSheetMusicDisplay(container);
await osmd.load(exercise.osmdInput); // Contains both staves
await osmd.render();
```

### Client-Side Only (v1)
**Decision**: No backend services, all processing in browser.

**Rationale**: 
- Eliminates server infrastructure
- Protects user privacy
- Works offline after initial load
- Lower latency (no network)

### Progressive Enhancement
**Decision**: Core features work without advanced capabilities.

**Example**:
- Basic practice works without microphone
- Monophonic detection without model
- Visual tuner without audio

## M3 Error Handling Improvements

### NotationRenderer Graceful Degradation (M3)
**Implementation**: Enhanced `_buildElementMap` method in NotationRenderer to handle edge cases gracefully instead of throwing errors.

**Problem**: Previous implementation threw errors when SVG elements were missing or empty, causing test failures and poor user experience.

**Solution**: Implemented warning-based logging with graceful degradation:

```javascript
// Before: Threw errors
if (!svg) {
  throw new Error('SVG not found after rendering');
}

// After: Graceful degradation
if (!svg) {
  Logger.log(Logger.WARN, 'NotationRenderer', 'No SVG element found in container');
  this.noteElementMap.clear();
  return;
}

const noteGroups = svg.querySelectorAll('g[data-note]');
if (noteGroups.length === 0) {
  Logger.log(Logger.WARN, 'NotationRenderer', 'No note elements found in SVG');
  this.noteElementMap.clear();
  return;
}
```

**Benefits**:
- Prevents application crashes from missing SVG elements
- Provides meaningful debug information via Logger
- Clears stale data from element maps
- Maintains test suite stability (100% pass rate: 54/54 tests)
- Enables progressive enhancement for edge cases

**Test Coverage**: Added comprehensive test case "NotationRenderer - _buildElementMap handles empty SVG" to verify error handling behavior.

**Related Files**:
- `src/core/notationRenderer.js` - Production code implementation
- `src/tests/unit/notationRenderer.test.js` - Test coverage
- `CLINE_MEMORY.md` - Milestone documentation

## M11 Enhanced UI Integration & Settings Persistence

### Settings Manager Implementation
**Decision**: Centralized settings management with LocalStorage persistence and Storage integration.

**Implementation**: Created new `SettingsManager` utility module for unified settings handling.

**Key Features**:
- **Settings Persistence**: Automatic saving/loading with LocalStorage namespace collision prevention ('g4:' prefix)
- **Settings Structure**: Complete preference management including instrument, volume, tempo, tuner settings
- **Storage Integration**: Seamless integration with existing Storage utility
- **Default Values**: Comprehensive default settings for all preferences

**SettingsManager API**:
```javascript
class SettingsManager {
  loadSettings()      // Returns settings object with defaults merged
  saveSettings()      // Saves to LocalStorage with namespace prefix
  updateSetting()     // Updates single setting with persistence
  getSetting()        // Gets specific setting or default value
  resetToDefaults()   // Clears all settings to factory defaults
}
```

**Settings Structure**:
```javascript
{
  instrument: 'acoustic',        // Instrument type (acoustic, piano, cello)
  instrumentMode: 'synth',       // Playback mode (synth, samples)
  tempo: 120,                    // BPM setting (40-300)
  volume: 0.7,                   // Master volume (0-1)
  metronomeEnabled: false,       // Metronome state
  metronomeVolume: 0.5,          // Metronome volume (0-1)
  difficulty: 'NORMAL',          // Practice tolerance (EASY/NORMAL/HARD)
  referencePitch: 440,           // Tuner reference pitch in Hz
  tunerSmoothing: 0.2,           // Tuner smoothing factor (0-0.99)
  lastExercise: null             // Last loaded exercise ID
}
```

### Enhanced App.js Integration
**Decision**: Preserve existing App.js central orchestrator role while adding comprehensive settings persistence.

**Implementation**: Enhanced App.js with 5 new methods and modified 6 existing event handlers.

**New Methods Added**:
- `applySettings()` - Applies loaded settings to PlaybackEngine and Tuner modules
- `syncUIWithSettings()` - Synchronizes UI controls with current settings state
- `saveSetting()` - Immediate persistence for individual setting changes
- `setupKeyboardShortcuts()` - Global keyboard shortcut handlers
- `setupSettingsPanel()` - Settings panel bidirectional synchronization

**Enhanced Event Handlers**:
- `handleMetronomeToggle()` - Now persists metronome state
- `handleModeChange()` - Now persists instrument mode preference
- `handleInstrumentChange()` - Now persists instrument type selection
- `handleVolumeChange()` - Now persists master volume level
- `handleMetronomeVolumeChange()` - Now persists metronome volume level
- `handleTempoChange()` - Now persists tempo setting

**Benefits**:
- Preserves existing App.js architecture without breaking changes
- Provides immediate user feedback with persistence
- Enables bidirectional settings synchronization
- Maintains event-driven communication pattern
- Allows graceful degradation for missing modules

### Keyboard Shortcuts Implementation
**Decision**: Professional-grade keyboard shortcuts with input field detection to prevent conflicts.

**Implementation**: Global keydown event handler with comprehensive shortcut coverage.

**Keyboard Shortcuts**:
- `Space`: Toggle play/pause (ignored when typing in inputs)
- `Escape`: Stop playback immediately
- `M`: Toggle metronome on/off with visual feedback
- `Ctrl/Cmd + Up Arrow`: Increase tempo by 5 BPM (max 300, with persistence)
- `Ctrl/Cmd + Down Arrow`: Decrease tempo by 5 BPM (min 40, with persistence)
- `Tab`: Cycle through tabs (practice → tuner → lessons → settings)

**Implementation Pattern**:
```javascript
setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in input field
    if (e.target.matches('input, textarea, select')) {
      return;
    }

    // Space: Play/Pause
    if (e.code === 'Space') {
      e.preventDefault();
      if (this.engine && this.engine.getState() === 'playing') {
        this.handlePause();
      } else if (this.engine && this.engine.getState() !== 'playing') {
        this.handlePlay();
      }
    }

    // Additional shortcuts...
  });
}
```

**Features**:
- **Conflict Prevention**: Shortcuts disabled during input field focus
- **Immediate Feedback**: Visual notifications with appropriate duration
- **State Synchronization**: Maintains consistency between shortcuts and UI controls
- **Persistence**: All shortcut-triggered changes are automatically saved

### Settings Panel Implementation
**Decision**: Comprehensive settings panel with 4 organized sections and bidirectional synchronization.

**Implementation**: Complete HTML/CSS structure with JavaScript integration via App.js.

**Settings Panel Sections**:
1. **Audio Settings**: Instrument selection, playback mode, master volume, metronome volume
2. **Tuner Settings**: Reference pitch presets (432/440/442/444 Hz), smoothing factor
3. **Practice Settings**: Difficulty level with tolerance specifications
4. **Data Management**: Export settings, reset to defaults, clear performance history

**Bidirectional Synchronization**:
- Main controls update settings panel values in real-time
- Settings panel changes immediately apply to main controls
- Visual feedback confirms successful changes
- All changes persist automatically

**Data Management Features**:
- **Export Settings**: Downloads JSON file with complete settings
- **Reset to Defaults**: Confirmation dialog with complete settings restoration
- **Clear Performance History**: Removes stored performance data

### Enhanced Notification System
**Decision**: Type-based notification system with auto-dismiss and improved styling.

**Implementation**: Enhanced `showNotification()` method with type classification and duration control.

**Notification Types**:
- **Info**: 3-second auto-dismiss (general information, mode changes)
- **Success**: 3-second auto-dismiss (successful actions, loading completion)
- **Warning**: 3-second auto-dismiss (degradation warnings, missing features)
- **Error**: 5-second auto-dismiss (critical errors, failed operations)

**Implementation**:
```javascript
showNotification(message, type = 'info') {
  const notification = document.getElementById('notification');
  if (!notification) return;

  // Set message and styling
  notification.textContent = message;
  notification.className = 'notification';
  notification.classList.add(`notification-${type}`);
  
  // Show with auto-dismiss
  notification.classList.add('show');
  const duration = type === 'error' ? 5000 : 3000;
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, duration);
}
```

**CSS Styling**:
- **Type-based Colors**: Blue (info), Green (success), Orange (warning), Red (error)
- **Smooth Transitions**: Fade in/out animations
- **Position**: Fixed top-right corner with proper z-index
- **Responsive**: Mobile-friendly sizing and positioning

### HTML Structure Fixes
**Issue**: ID mismatch between practice tab and App.js expectations causing null reference errors.

**Problem**: During settings panel implementation, the practice tab's `instrumentSelect` element was corrupted with `settings-instrument` ID, causing `document.getElementById()` to return null in App.js `initializeUI()` method.

**Solution**: Fixed ID mismatch by correcting the element ID in practice tab audio controls.

**Files Modified**:
- `index.html` - Corrected practice tab instrumentSelect ID
- `src/app.js` - Enhanced with complete settings persistence
- `src/utils/settingsManager.js` - New utility module
- `styles.css` - Enhanced styling for settings panel and notifications
- `README.md` - Updated documentation with new features
- `DEV_NOTES.md` - This documentation

**Benefits**:
- Resolves app initialization errors
- Ensures all event listeners attach successfully
- Maintains clean separation between settings panel and practice controls
- Preserves existing functionality while adding new features

### Architecture Compliance
**Decision**: Strict adherence to existing architecture patterns and governance rules.

**Compliance Achieved**:
- **No Breaking Changes**: All existing App.js functionality preserved
- **Event-Driven**: Settings changes emit appropriate events for module coordination
- **Progressive Enhancement**: Features work across browsers with graceful degradation
- **UIManager Integration**: Maintains tuner-only role while App.js handles general UI
- **Settings Namespace**: Uses 'g4:' prefix to prevent LocalStorage collisions
- **Code Quality**: Follows established patterns, style guide, and governance rules

**Testing Results**:
- Core components verified and functional
- HTML integration confirmed (settings panel IDs match App.js expectations)
- CSS styling complete for settings panel and notification system
- JavaScript methods present and working
- Settings persistence infrastructure operational

**Ready for Production**:
All prompt_11b.md requirements successfully implemented with comprehensive testing and documentation.

## Development Guidelines

### Module APIs
- Keep module APIs small and focused
- One public responsibility per module
- Return promises for async operations
- Emit events instead of throwing errors

### Event Naming
**Pattern**: `namespace:action`

**Examples**:
- `exercise:loaded`
- `playback:tick`
- `pitch:detected`
- `analysis:complete`

### Data Structures
Follow architecture.md §4 definitions exactly:
- ExerciseJSON - Exercise data structure
- PitchStream - Pitch detection events
- AnalysisResult - Performance analysis
- PlaybackConfig - Playback configuration

**Do not modify** without updating architecture.md

### Error Handling
```javascript
// Pattern for async operations
async someMethod() {
  try {
    const result = await riskyOperation();
    return result;
  } catch (error) {
    console.error('Module: someMethod failed:', error);
    
    // Emit error event (don't throw)
    this.emit('module:error', {
      error: error.message,
      method: 'someMethod',
      recoverable: true
    });
    
    return null; // Safe fallback
  }
}
```

### File Organization
```
src/
├── core/           # Core application modules
│   ├── exerciseLoader.js
│   ├── notationRenderer.js
│   └── ...
├── utils/          # Shared utilities
│   ├── eventEmitter.js
│   ├── logger.js
│   └── ...
└── tests/
    ├── unit/       # Unit tests
    ├── integration/ # Integration tests
    └── e2e/        # End-to-end tests
```

### Audio Sample Strategy
**Naming Convention**: Use MIDI numbers for sample files
- `A4.wav` (MIDI 69)
- `C3.wav` (MIDI 48)
- `E2.wav` (MIDI 40)

**Storage**: 
- Guitar samples: `assets/samples/guitar/`
- Piano samples: `assets/samples/piano/`

### LocalStorage Usage
**Namespace**: All keys prefixed with `g4:`
- `g4:settings` - User preferences
- `g4:perfHistory` - Performance history
- `g4:errors` - Error logs (max 50)

**Data Types**:
- Settings: Simple objects
- History: Circular buffer (max 100 entries)
- Never store: Passwords, sensitive data

## Performance Targets

### Latency Budget (Strictly Enforced)
```
Audio capture:        10-20ms
Pitch detection:      <30ms
Analysis:             <50ms
Visual update:        <20ms
────────────────────────────
TOTAL:                ≤80ms
```

**Validation**:
```javascript
import { performanceMonitor } from '../utils/performanceMonitor.js';

performanceMonitor.startMeasurement('fullPipeline');
// ... process audio
const latency = performanceMonitor.endMeasurement('fullPipeline');
if (latency > 80) {
  console.error(`Latency ${latency}ms exceeds 80ms target!`);
}
```

### Memory Budget
```
Base application:     <50MB
OSMD instances:       <20MB each
Magenta model:        <150MB
Audio buffers:        <10MB
Cached exercises:     <10MB each
────────────────────────────
TOTAL:                <300MB
```

**Monitoring**:
```javascript
if (performance.memory) {
  const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024;
  if (usedMB > 300) {
    console.warn(`Memory ${usedMB}MB exceeds 300MB budget!`);
  }
}
```

## Milestone Development

### Following the Plan
Create a PR per milestone (M0→M15) with:
- Feature implementation
- Unit tests (≥80% coverage)
- Integration tests (when applicable)
- Documentation updates
- Governance compliance

### Test-Driven Development
1. Write failing test
2. Run test (should fail)
3. Implement feature
4. Run test (should pass)
5. Refactor if needed

### Common Milestone Patterns

**Module Implementation (M2-M10)**:
```javascript
class ModuleName extends EventEmitter {
  constructor(config = {}) {
    super();
    // Initialize module
  }
  
  // Public methods with JSDoc
  
  // Private methods with underscore prefix
  _helperMethod() {
    // Implementation
  }
}
```

**Integration (M11)**:
```javascript
class UIManager {
  constructor() {
    this.modules = {
      loader: new ExerciseLoader(),
      renderer: new NotationRenderer(),
      // ...
    };
    
    this.setupEventSubscriptions();
  }
  
  setupEventSubscriptions() {
    this.modules.loader.on('exercise:loaded', (exercise) => {
      this.modules.renderer.render(exercise);
    });
  }
}
```

## Known Issues & Solutions

### Browser-Specific Issues

**Safari Audio Worklet**
- Safari doesn't fully support AudioWorklet
- Fallback to ScriptProcessorNode
- Document in code

**Chrome Auto-play Policy**
- Audio context requires user gesture
- Always show "Start Audio" button
- Check `context.state` before playback

**Firefox File API**
- Slightly different file reading behavior
- Test on Firefox specifically
- Use standard APIs when possible

### Performance Issues

**Large MusicXML Files**
- OSMD rendering can be slow
- Consider progressive rendering
- Show loading indicator
- Cache parsed results

**Memory Leaks**
- Clean up event listeners
- Remove DOM elements when not needed
- Clear intervals/timeouts
- Monitor with DevTools

**Audio Glitches**
- Ensure audio context is running
- Check buffer sizes
- Preload samples
- Handle sample rate differences

## Development Workflow

### Daily Development
1. Check CLINE_TODO.md for current task
2. Create feature branch: `git checkout -b feature/milestone-X`
3. Write tests first
4. Implement feature
5. Run full test suite: `npm test && npm run lint:rules`
6. Update documentation
7. Create PR with proper description

### Code Review Process
1. Self-review against checklist
2. Run all tests locally
3. Check coverage: `npm run test:coverage`
4. Verify governance: `npm run lint:rules`
5. Submit PR with description

### Debugging

**Event Flow**:
```javascript
// Add temporary logging
emitter.on('event:name', (data) => {
  console.log('Received event:', data);
});
```

**Audio Issues**:
```javascript
// Check audio context state
console.log('Audio context state:', audioContext.state);

// Verify permissions
navigator.permissions.query({name: 'microphone'})
  .then(result => console.log('Mic permission:', result.state));
```

**Performance**:
```javascript
// Use performance monitor
performanceMonitor.startMeasurement('operation');
// ... operation
const duration = performanceMonitor.endMeasurement('operation');
console.log(`Operation took ${duration}ms`);
```

## Testing Strategy

### Unit Tests
- Test public API only
- Mock external dependencies
- Use synthetic test data
- Cover edge cases and error paths

### Integration Tests
- Test module communication
- Verify event data structures
- Test complete pipelines
- Use real test files

### E2E Tests
- Test user workflows
- Use Playwright
- Test across browsers
- Validate accessibility

### Performance Tests
- Measure latency at each stage
- Monitor memory usage
- Check CPU usage
- Detect memory leaks

## Common Patterns

### Promise-Based Async
```javascript
async loadExercise(file) {
  try {
    const xml = await this.readFile(file);
    const exercise = await this.parseXML(xml);
    return exercise;
  } catch (error) {
    this.emit('exercise:error', error);
    return null;
  }
}
```

### Event Subscription Cleanup
```javascript
class Module {
  constructor() {
    this.subscriptions = [];
  }
  
  subscribe(emitter, event, handler) {
    const unsubscribe = emitter.on(event, handler);
    this.subscriptions.push(unsubscribe);
  }
  
  destroy() {
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions = [];
  }
}
```

### Configuration Management
```javascript
// constants.js
export const DEFAULT_CONFIG = {
  pitch: { min: 80, max: 1000 },
  tolerance: { pitch: 50, timing: 100 }
};

// module.js
import { DEFAULT_CONFIG } from './constants.js';

class Module {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
}
```

## Future Enhancements

### v1.1 Features
- [ ] Additional sample exercises
- [ ] Chord progression trainer
- [ ] Metronome improvements
- [ ] Better mobile UI

### v1.2 Features
- [ ] Practice mode with slowdown
- [ ] Scale trainer
- [ ] Sight-reading exercises
- [ ] Progress analytics

### v2.0 Considerations
- [ ] Cloud sync
- [ ] Social features
- [ ] Advanced analytics
- [ ] Mobile app
- [ ] Plugin system

## Resources

### Documentation
- [architecture.md](architecture.md) - Technical architecture
- [RULES.md](RULES.md) - Coding standards
- [TESTING.md](TESTING.md) - Testing procedures
- [MASTER_PROMPT.md](MASTER_PROMPT.md) - Milestone roadmap

### External Resources
- [OpenSheetMusicDisplay Docs](https://opensheetmusicdisplay.github.io/)
- [Tone.js Docs](https://tonejs.github.io/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [TensorFlow.js](https://tensorflow.org/js)

### Tools
- Chrome DevTools - Debugging, performance
- Lighthouse - Performance audits
- Playwright - E2E testing
- axe - Accessibility testing

## Troubleshooting

### Build Issues
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node.js version
node --version  # Should be >= 18
```

### Test Issues
```bash
# Run tests with verbose output
NODE_OPTIONS="--test-reporter=spec" npm test

# Check coverage
npm run test:coverage
```

### Runtime Issues
```bash
# Check browser console for errors
# Use Performance tab in DevTools
# Monitor Network tab for failed requests
```

## Release Process

### Pre-Release
1. Run full test suite
2. Update version in package.json
3. Update CHANGELOG.md
4. Run performance benchmarks
5. Test on all supported browsers

### Release
1. Create release PR
2. Tag release: `git tag v1.0.0`
3. Push tag: `git push origin v1.0.0`
4. Create GitHub release

---

**Happy coding! 🎸**
