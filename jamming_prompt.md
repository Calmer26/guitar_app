Cline AI Implementation Prompt: Jamming Tab with Drum Accompaniment
Overview
Add a new "Jamming" tab to Guitar4 that displays the musical score and provides synchronized drum accompaniment in various styles. Users can play along with professional-sounding drum tracks that match the song's tempo and time signature, all generated using Tone.js.

Feature Requirements
Core Features (Must Have)

New "Jamming" Tab

Tab navigation button with icon (drum/percussion symbol)
Displays standard notation (same as Practice tab)
No microphone recording or analysis
Simpler UI focused on playback + drums


Drum Track Playback

Multiple drum style presets (Rock, Jazz, Latin, Ballad, Funk)
Synchronized with song tempo (BPM)
Respects time signature (4/4, 3/4, 6/8, etc.)
Volume control independent from melody
Start/stop with main playback controls


Drum Style Selector

Dropdown menu to choose drum pattern
Visual preview of pattern (optional: show drum notation or grid)
Ability to switch styles mid-playback (if practical)


Playback Controls

Reuse existing PlaybackEngine
Play/Pause/Stop buttons
Tempo adjustment (affects both melody and drums)
Loop section feature (optional enhancement)



Enhanced Features (Nice to Have)

Drum Customization

Accent strength slider (adjust first beat emphasis)
Fill frequency (how often drum fills occur)
Complexity level (simple/medium/complex patterns)


Visual Feedback

Beat indicator lights (pulse on each beat)
Measure counter display
Drummer avatar animation (fun, low priority)


Practice Aids

Count-in metronome (2-bar count before start)
Section markers (verse/chorus/bridge)
Speed trainer (gradually increase tempo)




Technical Architecture
New Module: src/core/drumMachine.js
javascript/**
 * DrumMachine - Generate and play drum patterns synchronized with playback
 * 
 * Responsibilities:
 * - Create Tone.js drum synthesizers (kick, snare, hi-hat, etc.)
 * - Generate drum patterns for various styles
 * - Schedule drum hits on Tone.Transport
 * - Sync with PlaybackEngine tempo and time signature
 * - Provide volume/mix controls
 */
class DrumMachine extends EventEmitter {
  constructor(config = {}) {
    // Drum voices (Tone.js synthesizers)
    this.kick = null;
    this.snare = null;
    this.hihat = null;
    this.crash = null;
    this.tom = null;
    
    // Pattern data
    this.currentStyle = 'rock';
    this.patterns = {}; // Loaded from pattern definitions
    this.scheduledDrumEvents = [];
    
    // Config
    this.volume = config.drumVolume || 0.6;
    this.accentStrength = config.accentStrength || 1.2;
  }
  
  async initialize() {
    // Create drum synths
    this._createDrumSynths();
  }
  
  _createDrumSynths() {
    // Kick drum (bass drum)
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
    }).toDestination();
    
    // Snare drum
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
    }).toDestination();
    
    // Hi-hat (closed)
    this.hihat = new Tone.MetalSynth({
      frequency: 200,
      envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5
    }).toDestination();
    
    // Crash cymbal
    this.crash = new Tone.MetalSynth({
      frequency: 250,
      envelope: { attack: 0.001, decay: 1, release: 2 },
      harmonicity: 3.1,
      modulationIndex: 16,
      resonance: 3000,
      octaves: 1.5
    }).toDestination();
    
    // Tom (optional)
    this.tom = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.5, sustain: 0.1, release: 1 }
    }).toDestination();
  }
  
  setStyle(styleName) {
    // Change drum pattern style
    this.currentStyle = styleName;
    this.emit('drum:styleChanged', { style: styleName });
  }
  
  scheduleDrums(timeline, tempo, timeSignature) {
    // Clear previous schedule
    this._clearScheduledDrums();
    
    // Get pattern for current style
    const pattern = this.patterns[this.currentStyle];
    
    // Calculate measure duration
    const beatDuration = 60000 / tempo; // ms per beat
    const measureDuration = beatDuration * timeSignature.beats;
    
    // Schedule drum hits throughout the timeline
    const exerciseDuration = timeline[timeline.length - 1].timestamp;
    let currentTime = 0;
    let measureNumber = 0;
    
    while (currentTime < exerciseDuration) {
      this._schedulePatternForMeasure(pattern, currentTime, beatDuration, measureNumber);
      currentTime += measureDuration;
      measureNumber++;
    }
  }
  
  _schedulePatternForMeasure(pattern, startTime, beatDuration, measureNumber) {
    // Schedule each hit in the pattern
    pattern.forEach((hit, index) => {
      const hitTime = startTime + (index * beatDuration / pattern.subdivisions);
      const timeSeconds = hitTime / 1000;
      
      const eventId = Tone.Transport.schedule((time) => {
        if (hit.kick) this.kick.triggerAttackRelease('C1', '8n', time);
        if (hit.snare) this.snare.triggerAttackRelease('8n', time);
        if (hit.hihat) this.hihat.triggerAttackRelease('16n', time);
        if (hit.crash && measureNumber % 8 === 0) this.crash.triggerAttackRelease('2n', time);
      }, timeSeconds);
      
      this.scheduledDrumEvents.push(eventId);
    });
  }
  
  _clearScheduledDrums() {
    this.scheduledDrumEvents.forEach(id => Tone.Transport.clear(id));
    this.scheduledDrumEvents = [];
  }
  
  setVolume(volume) {
    // Update volume for all drum voices
    const volumeDb = this._volumeToDecibels(volume);
    this.kick.volume.value = volumeDb;
    this.snare.volume.value = volumeDb;
    this.hihat.volume.value = volumeDb;
    this.crash.volume.value = volumeDb;
    this.tom.volume.value = volumeDb;
  }
  
  _volumeToDecibels(volume) {
    if (volume <= 0) return -Infinity;
    if (volume >= 1) return 0;
    return 20 * Math.log10(volume) * 3;
  }
}
Drum Pattern Definitions: src/data/drumPatterns.js
javascript/**
 * Drum pattern library
 * Each pattern defines hits per beat subdivision
 */
export const DRUM_PATTERNS = {
  rock: {
    name: 'Rock',
    description: 'Standard rock beat with 8th note hi-hats',
    timeSignatures: ['4/4'],
    subdivisions: 8, // 8th notes per measure in 4/4
    pattern: [
      { kick: true, snare: false, hihat: true },   // Beat 1
      { kick: false, snare: false, hihat: true },  // &
      { kick: false, snare: true, hihat: true },   // Beat 2
      { kick: false, snare: false, hihat: true },  // &
      { kick: true, snare: false, hihat: true },   // Beat 3
      { kick: false, snare: false, hihat: true },  // &
      { kick: false, snare: true, hihat: true },   // Beat 4
      { kick: false, snare: false, hihat: true }   // &
    ]
  },
  
  jazz: {
    name: 'Jazz (Swing)',
    description: 'Swing feel on ride cymbal',
    timeSignatures: ['4/4'],
    subdivisions: 12, // Triplet feel
    pattern: [
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: false, hihat: false },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: false, hihat: false },
      { kick: false, snare: true, hihat: true },
      { kick: false, snare: false, hihat: false },
      // ... (continue for full measure)
    ]
  },
  
  latin: {
    name: 'Latin',
    description: 'Bossa nova or samba pattern',
    timeSignatures: ['4/4'],
    subdivisions: 16, // 16th notes
    pattern: [
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: false, hihat: false },
      { kick: false, snare: false, hihat: true },
      { kick: true, snare: false, hihat: false },
      // ... (syncopated Latin rhythm)
    ]
  },
  
  ballad: {
    name: 'Ballad',
    description: 'Slow, simple pattern with brushes feel',
    timeSignatures: ['4/4'],
    subdivisions: 4, // Quarter notes
    pattern: [
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: true, hihat: true },
      { kick: false, snare: false, hihat: true }
    ]
  },
  
  funk: {
    name: 'Funk',
    description: 'Syncopated groove with ghost notes',
    timeSignatures: ['4/4'],
    subdivisions: 16,
    pattern: [
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: true, snare: false, hihat: false },
      { kick: false, snare: true, hihat: true },
      // ... (complex syncopation)
    ]
  },
  
  waltz: {
    name: 'Waltz',
    description: '3/4 time signature pattern',
    timeSignatures: ['3/4'],
    subdivisions: 3,
    pattern: [
      { kick: true, snare: false, hihat: true },
      { kick: false, snare: false, hihat: true },
      { kick: false, snare: true, hihat: true }
    ]
  }
};
UI Integration: Update src/app.js
javascript// In App constructor, add:
this.drumMachine = null;
this.jamModeActive = false;

// In initializeUI(), add tab handler:
const jamTab = document.querySelector('[data-tab="jamming"]');
if (jamTab) {
  jamTab.addEventListener('click', () => this.switchToJamTab());
}

// New methods:
async switchToJamTab() {
  this.uiManager.switchTab('jamming');
  
  // Initialize drum machine if needed
  if (!this.drumMachine) {
    this.drumMachine = new DrumMachine({
      drumVolume: 0.6,
      accentStrength: 1.2
    });
    await this.drumMachine.initialize();
  }
  
  this.jamModeActive = true;
  
  // Load current exercise if available
  if (this.currentExercise && this.engine) {
    this._setupJammingMode();
  }
}

_setupJammingMode() {
  // Schedule drums with current exercise
  this.drumMachine.setStyle(this._getSelectedDrumStyle());
  this.drumMachine.scheduleDrums(
    this.currentExercise.timeline,
    this.config.bpm,
    this.currentExercise.timeSignature
  );
  
  // Subscribe to playback events (same as practice mode)
  this.engine.on('playback:tick', (tickData) => {
    this.renderer.highlightNotes([tickData.noteId], 'active');
  });
}

_getSelectedDrumStyle() {
  const selector = document.getElementById('drum-style-select');
  return selector ? selector.value : 'rock';
}
HTML: Add Jamming Tab in index.html
html<!-- Add to tab navigation -->
<button class="tab-button" data-tab="jamming">
  <i class="icon-drum"></i>
  <span>Jamming</span>
</button>

<!-- Add tab panel -->
<div class="tab-panel" data-panel="jamming">
  <div class="jam-header">
    <h2>Jam Along</h2>
    <p>Play along with drum accompaniment</p>
  </div>
  
  <div class="jam-controls">
    <!-- Drum Style Selector -->
    <div class="control-group">
      <label for="drum-style-select">Drum Style</label>
      <select id="drum-style-select">
        <option value="rock">Rock</option>
        <option value="jazz">Jazz (Swing)</option>
        <option value="latin">Latin</option>
        <option value="ballad">Ballad</option>
        <option value="funk">Funk</option>
        <option value="waltz">Waltz (3/4)</option>
      </select>
    </div>
    
    <!-- Drum Volume -->
    <div class="control-group">
      <label for="drum-volume">Drum Volume</label>
      <input type="range" id="drum-volume" min="0" max="100" value="60">
      <span id="drum-volume-display">60%</span>
    </div>
    
    <!-- Playback Controls (reuse existing) -->
    <div class="playback-controls">
      <button id="jam-play-btn" class="btn btn-primary">
        <i class="icon-play"></i> Play
      </button>
      <button id="jam-pause-btn" class="btn">
        <i class="icon-pause"></i> Pause
      </button>
      <button id="jam-stop-btn" class="btn">
        <i class="icon-stop"></i> Stop
      </button>
    </div>
    
    <!-- Beat Indicator (visual metronome) -->
    <div class="beat-indicator">
      <div class="beat-light" data-beat="1"></div>
      <div class="beat-light" data-beat="2"></div>
      <div class="beat-light" data-beat="3"></div>
      <div class="beat-light" data-beat="4"></div>
    </div>
  </div>
  
  <!-- Notation Display (reuse renderer) -->
  <div class="notation-container" id="jam-notation">
    <!-- OSMD renders here -->
  </div>
</div>
CSS: Add Jamming Tab Styles in styles.css
css/* Jamming Tab Styles */
.tab-panel[data-panel="jamming"] {
  display: none;
}

.tab-panel[data-panel="jamming"].active {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.jam-header {
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-align: center;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.jam-header h2 {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
}

.jam-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  padding: 1.5rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.control-group label {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

#drum-style-select {
  padding: 0.75rem;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  background: white;
  font-size: 1rem;
  cursor: pointer;
  transition: border-color 0.2s;
}

#drum-style-select:hover {
  border-color: var(--primary-color);
}

#drum-volume {
  width: 100%;
}

/* Beat Indicator */
.beat-indicator {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  align-items: center;
  padding: 1rem;
}

.beat-light {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 3px solid var(--border-color);
  transition: all 0.1s ease;
}

.beat-light.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  box-shadow: 0 0 20px var(--primary-color);
  transform: scale(1.1);
}

.beat-light.accent {
  background: var(--accent-color);
  border-color: var(--accent-color);
  box-shadow: 0 0 25px var(--accent-color);
}

/* Notation container for jamming */
#jam-notation {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  border: 2px solid var(--border-color);
}

Implementation Steps (Cline Task Breakdown)
Task 1: Create DrumMachine Module
File: src/core/drumMachine.js

 Implement DrumMachine class extending EventEmitter
 Create drum synthesizers (kick, snare, hi-hat, crash, tom)
 Implement pattern scheduling algorithm
 Add volume control methods
 Handle tempo and time signature changes
 Test with synthetic timeline data

Acceptance:

npm test src/tests/unit/drumMachine.test.js passes
DrumMachine can schedule and play basic rock pattern
Volume controls work correctly


Task 2: Define Drum Patterns
File: src/data/drumPatterns.js

 Create DRUM_PATTERNS export with 5+ styles
 Define rock pattern (8th note hi-hats, backbeat snare)
 Define jazz pattern (swing feel)
 Define latin pattern (syncopated)
 Define ballad pattern (simple, slow)
 Define funk pattern (16th note groove)
 Add waltz pattern (3/4 time)
 Document pattern structure

Acceptance:

All patterns have correct subdivisions and time signatures
Patterns sound musically appropriate when played
Pattern structure is consistent and documented


Task 3: UI - Add Jamming Tab HTML
File: index.html

 Add "Jamming" tab button in navigation
 Create .tab-panel[data-panel="jamming"] section
 Add drum style selector dropdown
 Add drum volume slider with live display
 Add playback controls (reuse existing button markup)
 Add beat indicator lights (4 divs with .beat-light)
 Add notation container for OSMD rendering
 Use semantic HTML and ARIA labels

Acceptance:

Tab appears in navigation bar
All controls are keyboard accessible
Markup validates (no errors in browser console)


Task 4: UI - Style Jamming Tab
File: styles.css

 Add jamming tab panel styles (flexbox layout)
 Style jam header (gradient background)
 Style control groups (grid layout)
 Style drum style selector
 Style beat indicator lights (pulse animation)
 Add active state animations
 Ensure responsive design (mobile-friendly)
 Match existing app design system

Acceptance:

Tab UI matches style guide colors and spacing
Beat lights pulse smoothly on active state
Mobile layout adjusts gracefully (test at 375px width)


Task 5: Integrate DrumMachine into App
File: src/app.js

 Import DrumMachine class
 Add this.drumMachine = null property
 Add this.jamModeActive = false flag
 Create switchToJamTab() method
 Initialize DrumMachine on first jam tab activation
 Create _setupJammingMode() method
 Schedule drums when exercise loaded
 Wire drum style selector change event
 Wire drum volume slider
 Wire playback controls (reuse engine)
 Sync beat indicator with playback

Acceptance:

Clicking Jamming tab initializes drum machine
Drum style dropdown changes pattern
Volume slider adjusts drum volume
Play button starts both melody and drums
Beat indicator pulses on each beat


Task 6: Beat Indicator Visual Feedback
File: src/app.js (or create src/ui/beatIndicator.js)

 Subscribe to playback tick events
 Calculate current beat from timestamp
 Add .active class to corresponding beat light
 Add .accent class to downbeat (beat 1)
 Remove classes after beat duration
 Handle different time signatures (4/4, 3/4, 6/8)

Acceptance:

Beat 1 pulses with accent (stronger color)
Beat lights activate in sequence
Timing is accurate (±50ms tolerance)
Works with different time signatures


Task 7: Enhanced Features (Optional)
Files: src/app.js, src/core/drumMachine.js

 Add count-in feature (2-bar metronome before start)
 Add fill randomization (occasional drum fills)
 Add complexity slider (adjust pattern density)
 Add mute button for drums
 Add solo button for drums only (mute melody)
 Add drum pattern preview (play 2 bars)

Acceptance:

Each feature works independently
No impact on existing functionality
UI controls are intuitive


Task 8: Testing
Files: src/tests/unit/drumMachine.test.js, src/tests/e2e/jamming.test.js

 Unit tests for DrumMachine pattern scheduling
 Unit tests for volume controls
 Unit tests for time signature handling
 E2E test: Load exercise → switch to Jam tab → play
 E2E test: Change drum style during playback
 E2E test: Adjust drum volume slider
 Manual test: Audio quality of drum sounds

Acceptance:

All unit tests pass (npm test)
E2E tests pass in Chromium and Firefox
Manual audio quality check confirms drums sound good


Task 9: Documentation
Files: docs/JAMMING_TAB.md, update README.md

 Create JAMMING_TAB.md with feature overview
 Document drum pattern structure
 Document how to add new drum styles
 Add screenshots of jamming tab UI
 Update README.md with jamming tab description
 Add keyboard shortcuts for jamming mode (if any)

Acceptance:

Documentation is clear and complete
Screenshots show all UI states
README mentions jamming feature


Suggested Extra Features (For Future Iterations)

Custom Pattern Builder

Visual grid editor (like a step sequencer)
Users can create and save custom drum patterns
Export/import patterns as JSON


Drum Fills

Automatic fills at measure 4, 8, 16
User-triggered fill button
Fill intensity slider


Percussion Additions

Shaker/tambourine on off-beats
Cowbell (more cowbell!)
Conga/bongo for Latin styles


Drum Kit Selection

Acoustic vs electronic sounds
Different samples per style
Reverb/room ambience controls


Loop Section

Select measures to loop
Useful for practicing specific sections
Visual loop markers on notation


Chord Display

Show chord symbols above notation
Useful for improvisation
Auto-detect from timeline


Practice Analytics

Track time spent jamming
Record favorite drum styles
Session history log


Export/Share

Export jam session as audio file
Share jam settings (style, tempo, etc.)
Generate shareable link




Technical Notes & Considerations
Performance

Drum scheduling uses same Tone.Transport as PlaybackEngine
Clear drum events when switching tabs (avoid memory leaks)
Test with long exercises (100+ measures) to ensure no lag

Audio Quality

Use Tone.js MembraneSynth for kick/tom (realistic membrane sound)
Use NoiseSynth for snare (white noise burst)
Use MetalSynth for cymbals (metallic resonance)
Tune drum pitches appropriately (kick: C1, snare: C4, hi-hat: 200Hz)

Time Signature Support

Handle 4/4, 3/4, 6/8, 5/4, 7/8 (common signatures)
Adjust pattern subdivisions dynamically
Warn user if no pattern available for current time signature

Tempo Changes

Re-schedule drums if tempo slider adjusted
Keep drum pattern synchronized with melody
Test edge cases (very fast/slow tempos)

Browser Compatibility

Verify Tone.js synths work in Chrome, Firefox, Edge
Test audio latency (drum hits should align with beats)
Safari support deferred (as per main app policy)

Storage

Save user's preferred drum style in LocalStorage
Save drum volume preference
Save last-used complexity settings (if implemented)


Example Usage Flow (User Perspective)

User loads "Twinkle Twinkle" exercise
Clicks Jamming tab
Selects Rock drum style from dropdown
Adjusts drum volume to 70%
Clicks Play button
Notation scrolls, beat indicator pulses, drums play synchronized rock pattern
User jams along on their guitar, following the notation
User switches to Latin style mid-playback (drums change to bossa nova)
User adjusts tempo slider to 90 BPM (both melody and drums slow down)
User clicks Stop, resets to beginning


Success Criteria
Functional

✅ Jamming tab accessible from main navigation
✅ Drum machine plays synchronized patterns
✅ 5+ drum styles available
✅ Volume control works independently
✅ Beat indicator provides visual feedback
✅ Notation displays correctly (same as practice tab)
✅ Tempo changes affect both melody and drums

Quality

✅ Drums sound realistic and musical
✅ No audio glitches or pops
✅ Beat timing is accurate (human can feel the groove)
✅ UI is intuitive and visually appealing
✅ No performance degradation with long exercises
✅ Code follows existing architecture patterns
✅ All tests pass (unit + E2E)

User Experience

✅ Tab loads quickly (<1 second)
✅ Controls are self-explanatory
✅ Visual feedback is satisfying (beat lights, cursor movement)
✅ Playing along feels like jamming with a real drummer
✅ No awkward silences or timing issues


Final Notes for Cline

Reuse existing modules wherever possible (PlaybackEngine, NotationRenderer)
Follow architecture patterns from architecture.md (EventEmitter, single responsibility)
Maintain code quality (JSDoc comments, error handling, logging)
Test incrementally after each task
Update governance files (CLINE_TODO.md, CLINE_MEMORY.md)
Commit frequently with descriptive messages

When implementing, prioritize Tasks 1-6 for MVP, then add Task 7 (enhanced features) as time permits. Tasks 8-9 (testing and docs) should be completed before considering the feature "done."

End of Prompt