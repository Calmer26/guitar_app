# TESTING.md

This document explains manual and automated testing procedures for Guitar4.

## Rule Compliance Checks

Run `npm run lint:rules` to validate governance file existence and hook configuration.

```bash
npm run lint:rules
```

This validates:
- Required governance files exist
- Pre-commit hooks are configured
- Coding standards are followed

## Unit Tests (Node.js)

Unit tests are run using Node.js built-in test runner.

### Running Tests

```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test src/tests/unit/eventEmitter.test.js
```

### Test Structure

Unit tests are located in `src/tests/unit/` and follow the pattern:
- `moduleName.test.js` - Test file for corresponding module
- Uses Node.js `node:test` framework
- Tests cover:
  - Public API methods
  - Error handling
  - Edge cases
  - Mocked dependencies

### Coverage Requirements

- **Overall Coverage**: ≥ 80%
- **Core Modules**: ≥ 85% for critical modules
- **Utility Modules**: ≥ 90%

## Manual Testing

### Development Server

Start the development server:
```bash
npm start
```

Access at: `http://localhost:8000`

### Manual Test Checklist

#### Basic Functionality
- [ ] Page loads without console errors
- [ ] Tab navigation works
- [ ] Audio context activation button present
- [ ] Settings panel accessible
- [ ] File upload interface present

#### UI Components
- [ ] Buttons have hover states
- [ ] Forms accept input
- [ ] Notifications display correctly
- [ ] Responsive design works on mobile
- [ ] Accessibility features functional

#### Audio Features
- [ ] Audio context activates (after user gesture)
- [ ] Controls become enabled after activation
- [ ] Microphone permission prompt appears (when implemented)

## Integration Tests

Integration tests verify module interactions and data flow.

### Running Integration Tests

```bash
# Run all integration tests
npm test -- src/tests/integration/

# Run specific integration test
npm test -- src/tests/integration/playbackPipeline.test.js
```

### Integration Test Scenarios

1. **Exercise Loading Pipeline**
   - File upload → Parse XML → Generate ExerciseJSON
   - Verify data structure integrity

2. **Event Communication**
   - Module A emits event → Module B receives event
   - Verify event data structures

3. **Playback Pipeline**
   - Timeline → PlaybackEngine → Visual updates
   - Verify timing accuracy

4. **System Change Validation**
   - Verify system change events match timeline structure
   - Validate system numbering consistency
   - Test multi-system exercise handling

5. **Concurrent Operations**
   - Seek during playback
   - Tempo changes during playback
   - Multiple operations without race conditions

6. **Timing Accuracy Across BPM Ranges**
   - Validate ±10ms tolerance at 60, 120, 180 BPM
   - Test Transport scheduling precision
   - Verify event emission timing

## Playback Validation

### Timeline Integrity Tests

**Rest Duration Handling**
- Verify rests advance timeline position (not rewind)
- Test with various rest durations (quarter, half, whole notes)
- Confirm chronological timestamp ordering after rests

**Note Deduplication**
- Test dual-staff MusicXML files (notation + tablature)
- Verify identical notes (same timestamp + MIDI) appear only once
- Check 2ms tolerance window for near-simultaneous notes

**Timeline Validation Checks**
- Timestamps always increase monotonically
- Each (timestamp, MIDI) pair appears exactly once
- No duplicate note IDs after deduplication

### Playback Quality Tests

**Dual-Staff Exercise Testing**
- Load MusicXML with both notation and tablature staves
- Verify single clean playback voice (no overlapping notes)
- Confirm visual cursor shows single note progression

**Rest Behavior Verification**
- Play exercise with rests
- Verify playback pauses correctly during rest durations
- Check timeline progression resumes after rests

**Performance Impact Validation**
- Measure parsing time before/after deduplication
- Verify no regression in timeline building speed
- Test with large exercises (100+ notes)

## Playwright / E2E Tests

End-to-end tests verify complete user workflows.

### Setup

```bash
# Install Playwright
npx playwright install

# Run E2E tests
npx playwright test
```

### E2E Test Scenarios

1. **Complete Practice Workflow**
   - Load exercise → Start playback → Verify notation displays
   - Check cursor movement synchronization
   - Test playback controls

2. **Tuner Functionality**
   - Switch to tuner tab
   - Verify tuner UI elements present
   - Test reference pitch adjustment

3. **Settings Persistence**
   - Change settings → Reload page → Verify persistence
   - Test data export/import

4. **Keyboard Navigation**
   - Test all keyboard shortcuts
   - Verify tab order
   - Check focus management

## Performance Testing

### Latency Measurement

Tools and methods for measuring performance targets:

```javascript
// Using Performance Monitor
import { performanceMonitor } from '../utils/performanceMonitor.js';

performanceMonitor.startMeasurement('fullPipeline');
// ... perform operation
const latency = performanceMonitor.endMeasurement('fullPipeline');
console.log(`Latency: ${latency}ms (target: ≤80ms)`);
```

### Memory Monitoring

```javascript
// Check memory usage
if (performance.memory) {
  const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024;
  console.log(`Memory: ${usedMB}MB (target: <300MB)`);
}
```

### Performance Test Suite

```bash
# Run performance tests
npm run test:performance
```

Validates:
- Audio → Visual feedback latency ≤ 80ms
- Memory usage < 300MB
- CPU usage within targets
- No memory leaks over time

## Accessibility Testing

### Manual Accessibility Checks

- [ ] Keyboard navigation works without mouse
- [ ] All interactive elements have focus indicators
- [ ] Color contrast meets WCAG 2.1 AA standards
- [ ] Screen reader compatibility
- [ ] Alt text for all images
- [ ] Semantic HTML structure

### Automated Tools

```bash
# Install axe-cli for accessibility testing
npm install -g axe-cli

# Run accessibility audit
axe http://localhost:8000
```

## Browser Compatibility Testing

### Supported Browsers

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

### Testing Matrix

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Basic UI | ✅ | ✅ | ✅ | ✅ |
| Audio Context | ✅ | ✅ | ✅ | ✅ |
| File API | ✅ | ✅ | ✅ | ✅ |
| Local Storage | ✅ | ✅ | ✅ | ✅ |
| Web Audio API | ✅ | ✅ | ✅ | ✅ |
| Audio Worklet | ✅ | ✅ | ⚠️ | ✅ |

✅ = Full Support  
⚠️ = Partial Support (graceful degradation)

## CI/CD Pipeline

### GitHub Actions Configuration

Tests are run automatically on:
- Pull requests
- Push to main branch
- Nightly builds

### Quality Gates

All quality gates must pass before merge:
- [ ] All unit tests pass
- [ ] Coverage ≥ 80%
- [ ] Lint rules pass
- [ ] E2E tests pass
- [ ] Performance benchmarks met
- [ ] Accessibility standards met

## Troubleshooting

### Common Test Issues

**Tests fail with "Cannot find module"**
- Check import paths use `.js` extension
- Verify file exists
- Run from project root

**LocalStorage mock not working in tests**
```javascript
// Ensure mock is set up before importing
global.localStorage = { /* mock implementation */ };
import Logger from '../utils/logger.js';
```

**Audio tests timing out**
- Audio tests should use synthetic data
- Never test with real audio in automated tests
- Mock Web Audio API

### Debug Mode

Run tests with verbose output:
```bash
NODE_OPTIONS="--test-reporter=spec" npm test
```

## Test Data

### Sample Files

- `examples/twinkle2.xml` - Simple melody
- `examples/ode-to-joy.xml` - Classical piece
- `examples/chord-exercise.xml` - Chord progressions

### Synthetic Audio

Generate synthetic test audio:
```javascript
// Sine wave generator for testing
function generateSineWave(frequency, duration, sampleRate = 44100) {
  const samples = duration * sampleRate;
  const audioBuffer = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    audioBuffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
  }
  
  return audioBuffer;
}
```

## Performance Benchmarks

### Target Metrics

- **Pitch Detection Latency**: ≤ 30ms
- **Total Pipeline Latency**: ≤ 80ms
- **Memory Usage**: < 300MB
- **CPU Usage**: < 40% (combined)

### Measurement Tools

1. **Performance API**
   - `performance.now()` for timing
   - `performance.memory` for memory

2. **Chrome DevTools**
   - Performance tab
   - Memory profiler
   - CPU profiler

3. **Lighthouse**
   - Performance audits
   - Accessibility checks

## Security Testing

### Input Validation

- Test file upload with malicious files
- Verify XML parsing is safe
- Check LocalStorage data sanitization

### Dependencies

```bash
# Security audit
npm audit

# Update dependencies
npm update
```

## Test Reporting

### Coverage Reports

Generate HTML coverage report:
```bash
npm run test:coverage -- --reporter=html
```

### JUnit XML

For CI integration:
```bash
npm test -- --reporter=junit --outputFile=test-results.xml
```

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm test` | Run unit tests |
| `npm run test:coverage` | Run with coverage |
| `npm run lint:rules` | Validate governance |
| `npx playwright test` | Run E2E tests |
| `npm start` | Start dev server |

For more information, see:
- [RULES.md](RULES.md) - Coding standards
- [architecture.md](architecture.md) - Technical architecture
- [DEV_NOTES.md](DEV_NOTES.md) - Development guide
