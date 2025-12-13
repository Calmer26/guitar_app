/**
 * Unit tests for ExerciseLoader module
 * Tests MusicXML parsing, timeline generation, staff separation, and validation
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { ExerciseLoader } from '../../core/exerciseLoader.js';

// Test data
const twinkleXmlPath = 'assets/exercises/twinkle2.xml';
let twinkleXmlContent;

test.before(() => {
  // Load test XML file
  twinkleXmlContent = readFileSync(twinkleXmlPath, 'utf8');
});

test('ExerciseLoader - parses twinkle2.xml successfully', async () => {
  const loader = new ExerciseLoader();
  const exercise = await loader.parseXML(twinkleXmlContent);
  
  assert.ok(exercise.id, 'Exercise has ID');
  assert.strictEqual(exercise.title, 'Twinkle Twinkle Little Star');
  assert.ok(exercise.timeline.length > 0, 'Timeline has notes');
  assert.strictEqual(exercise.timeline[0].pitch.step, 'C', 'First note is C');
  assert.ok(exercise.timeline[0].timestamp >= 0, 'First timestamp is non-negative');
});

test('ExerciseLoader - timeline has correct structure', async () => {
  const loader = new ExerciseLoader();
  const exercise = await loader.parseXML(twinkleXmlContent);
  
  exercise.timeline.forEach((note, index) => {
    assert.ok(note.id, `Note ${index} has ID`);
    assert.strictEqual(typeof note.timestamp, 'number', `Note ${index} has numeric timestamp`);
    assert.strictEqual(typeof note.duration, 'number', `Note ${index} has numeric duration`);
    assert.strictEqual(typeof note.midi, 'number', `Note ${index} has numeric MIDI`);
    assert.ok(note.pitch, `Note ${index} has pitch object`);
    assert.strictEqual(typeof note.staff, 'number', `Note ${index} has staff number`);
  });
  
  // Check uniqueness of IDs
  const ids = new Set();
  exercise.timeline.forEach(note => {
    assert.ok(!ids.has(note.id), `Note ID ${note.id} is unique`);
    ids.add(note.id);
  });
  
  // Check MIDI range
  exercise.timeline.forEach(note => {
    assert.ok(note.midi >= 0 && note.midi <= 127, `Note MIDI ${note.midi} is in valid range`);
  });
});

test('ExerciseLoader - staff identification correct', async () => {
  const loader = new ExerciseLoader();
  const exercise = await loader.parseXML(twinkleXmlContent);
  
  const staff1Notes = exercise.timeline.filter(n => n.staff === 1);
  const staff2Notes = exercise.timeline.filter(n => n.staff === 2);
  
  assert.ok(staff1Notes.length > 0, 'Has notation staff (staff 1) notes');
  assert.ok(staff2Notes.length > 0, 'Has tablature staff (staff 2) notes');
  
  // All staff 1 notes should not have tab data
  staff1Notes.forEach(note => {
    assert.strictEqual(note.tab, null, 'Staff 1 notes should not have tab data');
  });
  
  // Staff 2 notes should have tab data for twinkle2.xml
  assert.ok(staff2Notes.every(note => note.tab !== null), 'Staff 2 notes have tab data');
});

test('ExerciseLoader - tablature data extracted', async () => {
  const loader = new ExerciseLoader();
  const exercise = await loader.parseXML(twinkleXmlContent);
  
  const staff2Notes = exercise.timeline.filter(n => n.staff === 2);
  
  assert.ok(staff2Notes.length > 0, 'Has staff 2 notes to test');
  
  staff2Notes.forEach(note => {
    assert.ok(note.tab, 'Staff 2 note has tab data');
    assert.strictEqual(typeof note.tab.string, 'number', 'Tab data has string number');
    assert.strictEqual(typeof note.tab.fret, 'number', 'Tab data has fret number');
    assert.ok(note.tab.string >= 1 && note.tab.string <= 6, `Tab string ${note.tab.string} is valid`);
    assert.ok(note.tab.fret >= 0 && note.tab.fret <= 24, `Tab fret ${note.tab.fret} is valid`);
  });
});

test('ExerciseLoader - MIDI conversion accurate', async () => {
  const loader = new ExerciseLoader();
  
  // Test known MIDI values
  const testCases = [
    { pitch: { step: 'A', octave: 4, alter: 0 }, expected: 69 }, // A4 = 69
    { pitch: { step: 'C', octave: 4, alter: 0 }, expected: 60 }, // C4 = 60
    { pitch: { step: 'C', octave: 5, alter: 0 }, expected: 72 }, // C5 = 72
    { pitch: { step: 'E', octave: 2, alter: 0 }, expected: 40 }, // E2 = 40
  ];
  
  testCases.forEach(testCase => {
    const midi = loader._convertPitchToMIDI(testCase.pitch);
    assert.strictEqual(midi, testCase.expected, `MIDI conversion for ${testCase.pitch.step}${testCase.pitch.octave}`);
  });
  
  // Test with twinkle2.xml
  const exercise = await loader.parseXML(twinkleXmlContent);
  const c4Notes = exercise.timeline.filter(n => 
    n.pitch.step === 'C' && n.pitch.octave === 4 && n.pitch.alter === 0
  );
  
  assert.ok(c4Notes.length > 0, 'Has C4 notes to validate');
  c4Notes.forEach(note => {
    assert.strictEqual(note.midi, 60, 'C4 notes have correct MIDI value');
  });
});

test('ExerciseLoader - timeline chronologically sorted', async () => {
  const loader = new ExerciseLoader();
  const exercise = await loader.parseXML(twinkleXmlContent);
  
  for (let i = 1; i < exercise.timeline.length; i++) {
    assert.ok(
      exercise.timeline[i].timestamp >= exercise.timeline[i - 1].timestamp,
      `Timeline note ${i} is chronologically sorted`
    );
  }
});

test('ExerciseLoader - handles malformed XML', async () => {
  const loader = new ExerciseLoader();
  
  // Test with invalid XML
  const invalidXml = '<invalid>not musicxml</invalid>';
  
  await assert.rejects(
    async () => await loader.parseXML(invalidXml),
    (error) => {
      assert.ok(error.message.includes('Invalid MusicXML') || error.message.includes('parse error'));
      return true;
    },
    'Should throw error for malformed XML'
  );
  
  // Test with empty string
  await assert.rejects(
    async () => await loader.parseXML(''),
    (error) => {
      assert.ok(error.message.includes('Invalid XML content'));
      return true;
    },
    'Should throw error for empty XML'
  );
  
  // Test with null
  await assert.rejects(
    async () => await loader.parseXML(null),
    (error) => {
      assert.ok(error.message.includes('Invalid XML content'));
      return true;
    },
    'Should throw error for null XML'
  );
});

test('ExerciseLoader - file validation rejects invalid files', async () => {
  const loader = new ExerciseLoader();
  
  // Test invalid file type
  const invalidTypeFile = {
    type: 'text/plain',
    size: 1000,
    name: 'test.txt'
  };
  
  assert.throws(() => {
    loader._validateFile(invalidTypeFile);
  }, (error) => {
    assert.ok(error.message.includes('file type'));
    return true;
  }, 'Should reject non-XML file type');
  
  // Test oversized file
  const oversizedFile = {
    type: 'text/xml',
    size: 10 * 1024 * 1024, // 10MB
    name: 'test.xml'
  };
  
  assert.throws(() => {
    loader._validateFile(oversizedFile);
  }, (error) => {
    assert.ok(error.message.includes('too large'));
    return true;
  }, 'Should reject oversized file');
  
  // Test invalid extension
  const invalidExtFile = {
    type: 'text/xml',
    size: 1000,
    name: 'test.txt'
  };
  
  assert.throws(() => {
    loader._validateFile(invalidExtFile);
  }, (error) => {
    assert.ok(error.message.includes('extension'));
    return true;
  }, 'Should reject invalid extension');
});

test('ExerciseLoader - validates ExerciseJSON structure', async () => {
  const loader = new ExerciseLoader();
  const exercise = await loader.parseXML(twinkleXmlContent);
  
  // Valid exercise should pass
  const validResult = loader.validateExercise(exercise);
  assert.strictEqual(validResult.valid, true, 'Valid exercise should pass validation');
  assert.strictEqual(validResult.errors.length, 0, 'Valid exercise should have no errors');
  
  // Test invalid exercises
  const invalidExercises = [
    { ...exercise, id: '' }, // Empty ID
    { ...exercise, title: '' }, // Empty title
    { ...exercise, tempo: 0 }, // Invalid tempo
    { ...exercise, timeline: [] }, // Empty timeline
    { ...exercise, osmdInput: '' }, // Empty osmdInput
  ];
  
  invalidExercises.forEach((invalidExercise, index) => {
    const result = loader.validateExercise(invalidExercise);
    assert.strictEqual(result.valid, false, `Invalid exercise ${index} should fail validation`);
    assert.ok(result.errors.length > 0, `Invalid exercise ${index} should have errors`);
  });
});

test('ExerciseLoader - emits exercise:loaded event', async () => {
  const loader = new ExerciseLoader();
  
  return new Promise((resolve, reject) => {
    loader.once('exercise:loaded', (data) => {
      try {
        assert.ok(data.exerciseJSON, 'Event contains exerciseJSON');
        assert.strictEqual(data.source, 'string', 'Event contains source');
        assert.ok(data.parseTime >= 0, 'Event contains parseTime');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    
    loader.parseXML(twinkleXmlContent).catch(reject);
  });
});

test('ExerciseLoader - osmdInput field preserves complete XML', async () => {
  const loader = new ExerciseLoader();
  const exercise = await loader.parseXML(twinkleXmlContent);
  
  assert.strictEqual(exercise.osmdInput, twinkleXmlContent, 'osmdInput matches original XML');
  assert.ok(exercise.osmdInput.includes('score-partwise'), 'osmdInput contains MusicXML structure');
  assert.ok(exercise.osmdInput.includes('work-title'), 'osmdInput contains title');
});

test('ExerciseLoader - metadata extraction correct', async () => {
  const loader = new ExerciseLoader();
  const exercise = await loader.parseXML(twinkleXmlContent);
  
  assert.strictEqual(exercise.title, 'Twinkle Twinkle Little Star', 'Title extracted correctly');
  assert.strictEqual(exercise.composer, 'Unknown', 'Composer defaults to Unknown when not specified');
  assert.strictEqual(exercise.tempo, 120, 'Tempo defaults to 120 when not specified');
  assert.deepStrictEqual(exercise.timeSignature, { beats: 4, beatType: 4 }, 'Time signature extracted correctly');
  
  // Test tuning extraction
  assert.ok(Array.isArray(exercise.tuning), 'Tuning is an array');
  assert.strictEqual(exercise.tuning.length, 6, 'Tuning has 6 strings');
  assert.strictEqual(exercise.tuning[0], 'E2', 'First string is E2');
  assert.strictEqual(exercise.tuning[5], 'E4', 'Last string is E4');
});

test('ExerciseLoader - parse progress events emitted', async () => {
  const loader = new ExerciseLoader();
  
  const progressEvents = [];
  
  return new Promise((resolve, reject) => {
    loader.on('parse:progress', (data) => {
      progressEvents.push(data);
    });
    
    loader.once('exercise:loaded', () => {
      try {
        assert.ok(progressEvents.length > 0, 'Progress events were emitted');
        
        // Check event structure
        progressEvents.forEach((event, index) => {
          assert.strictEqual(typeof event.percent, 'number', `Event ${index} has numeric percent`);
          assert.ok(event.percent >= 0 && event.percent <= 100, `Event ${index} percent is in valid range`);
          assert.strictEqual(typeof event.stage, 'string', `Event ${index} has stage string`);
        });
        
        // Check that progress goes from 0 to 100
        const percents = progressEvents.map(e => e.percent);
        assert.strictEqual(percents[0], 0, 'First event has 0% progress');
        assert.strictEqual(percents[percents.length - 1], 100, 'Last event has 100% progress');
        
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    
    loader.parseXML(twinkleXmlContent).catch(reject);
  });
});

test('ExerciseLoader - handles XML with tempo changes', async () => {
  const xmlWithTempo = `<?xml version="1.0"?>
    <score-partwise version="3.1">
      <work><work-title>Test</work-title></work>
      <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
      <part id="P1">
        <measure number="1">
          <attributes>
            <divisions>1</divisions>
            <time><beats>4</beats><beat-type>4</beat-type></time>
            <staves>2</staves>
            <clef number="1"><sign>G</sign><line>2</line></clef>
            <clef number="2"><sign>TAB</sign><line>5</line></clef>
            <staff-details number="2">
              <staff-lines>6</staff-lines>
              <staff-tuning line="1"><tuning-step>E</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
              <staff-tuning line="2"><tuning-step>A</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
              <staff-tuning line="3"><tuning-step>D</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
              <staff-tuning line="4"><tuning-step>G</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
              <staff-tuning line="5"><tuning-step>B</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
              <staff-tuning line="6"><tuning-step>E</tuning-step><tuning-octave>4</tuning-octave></staff-tuning>
            </staff-details>
          </attributes>
          <sound tempo="100"/>
          <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>1</duration>
            <voice>1</voice>
            <type>quarter</type>
            <staff>1</staff>
          </note>
        </measure>
      </part>
    </score-partwise>`;
  
  const loader = new ExerciseLoader();
  const exercise = await loader.parseXML(xmlWithTempo);
  
  assert.strictEqual(exercise.tempo, 100, 'Tempo extracted from sound element');
  assert.ok(exercise.timeline.length > 0, 'Timeline generated with tempo');
});

test('ExerciseLoader - handles rests correctly', async () => {
  const xmlWithRests = `<?xml version="1.0"?>
    <score-partwise version="3.1">
      <work><work-title>Test</work-title></work>
      <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
      <part id="P1">
        <measure number="1">
          <attributes>
            <divisions>1</divisions>
            <time><beats>4</beats><beat-type>4</beat-type></time>
            <staves>2</staves>
            <clef number="1"><sign>G</sign><line>2</line></clef>
            <clef number="2"><sign>TAB</sign><line>5</line></clef>
            <staff-details number="2">
              <staff-lines>6</staff-lines>
              <staff-tuning line="1"><tuning-step>E</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
              <staff-tuning line="2"><tuning-step>A</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
              <staff-tuning line="3"><tuning-step>D</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
              <staff-tuning line="4"><tuning-step>G</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
              <staff-tuning line="5"><tuning-step>B</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
              <staff-tuning line="6"><tuning-step>E</tuning-step><tuning-octave>4</tuning-octave></staff-tuning>
            </staff-details>
          </attributes>
          <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>1</duration>
            <voice>1</voice>
            <type>quarter</type>
            <staff>1</staff>
          </note>
          <note>
            <rest/>
            <duration>1</duration>
            <voice>1</voice>
            <type>quarter</type>
            <staff>1</staff>
          </note>
          <note>
            <pitch><step>D</step><octave>4</octave></pitch>
            <duration>1</duration>
            <voice>1</voice>
            <type>quarter</type>
            <staff>1</staff>
          </note>
        </measure>
      </part>
    </score-partwise>`;
  
  const loader = new ExerciseLoader();
  const exercise = await loader.parseXML(xmlWithRests);
  
  // Should have 2 notes (rest should be skipped)
  assert.strictEqual(exercise.timeline.length, 2, 'Rests should be skipped in timeline');
  assert.strictEqual(exercise.timeline[0].pitch.step, 'C', 'First note is C');
  assert.strictEqual(exercise.timeline[1].pitch.step, 'D', 'Second note is D');
});

test('ExerciseLoader - loadFromFile method works', async () => {
  const loader = new ExerciseLoader();
  
  // Create a mock file object
  const mockFile = {
    type: 'text/xml',
    size: twinkleXmlContent.length,
    name: 'twinkle2.xml'
  };
  
  // Mock FileReader
  const originalFileReader = global.FileReader;
  global.FileReader = class MockFileReader {
    constructor() {
      this.result = twinkleXmlContent;
    }
    
    readAsText() {
      setTimeout(() => {
        this.onload({ target: this });
      }, 0);
    }
  };
  
  try {
    const exercise = await loader.loadFromFile(mockFile);
    
    assert.ok(exercise.id, 'Exercise has ID');
    assert.strictEqual(exercise.title, 'Twinkle Twinkle Little Star');
    assert.strictEqual(exercise.filename, 'twinkle2.xml', 'Filename preserved');
    assert.ok(exercise.timeline.length > 0, 'Timeline parsed from file');
  } finally {
    // Restore original FileReader
    global.FileReader = originalFileReader;
  }
});

test('ExerciseLoader - system and measure counting', async () => {
  const loader = new ExerciseLoader();
  const exercise = await loader.parseXML(twinkleXmlContent);
  
  assert.ok(exercise.systemCount > 0, 'System count is positive');
  assert.ok(exercise.measureCount > 0, 'Measure count is positive');
  assert.strictEqual(exercise.measureCount, 4, 'twinkle2.xml has 4 measures');
  
  // Check that all timeline notes have system numbers
  exercise.timeline.forEach(note => {
    assert.ok(note.system > 0, 'Note has valid system number');
  });
});
