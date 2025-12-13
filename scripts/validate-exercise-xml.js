#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { DOMParser } from '@xmldom/xmldom';

class ExerciseValidator {
  constructor(filepath) {
    this.filepath = filepath;
    this.errors = [];
    this.warnings = [];
  }

  validate() {
    console.log(`\n🔍 Validating: ${this.filepath}`);
    
    // Check file exists
    if (!existsSync(this.filepath)) {
      this.errors.push(`File not found: ${this.filepath}`);
      return this.reportResults();
    }

    const xmlContent = readFileSync(this.filepath, 'utf8');
    
    // Test 1: Valid XML structure
    this.validateXMLStructure(xmlContent);
    
    // Test 2: MusicXML elements present
    this.validateMusicXMLElements(xmlContent);
    
    // Test 3: Dual staff configuration
    this.validateDualStaff(xmlContent);
    
    // Test 4: Note/backup structure
    this.validateNoteStructure(xmlContent);
    
    // Test 5: Tab notation correctness
    this.validateTabNotation(xmlContent);
    
    // Test 6: Duration consistency
    this.validateDurations(xmlContent);
    
    // Test 7: Pitch to tab mapping
    this.validatePitchToTab(xmlContent);
    
    return this.reportResults();
  }

  validateXMLStructure(xmlContent) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Check for parser errors
      const parserErrors = doc.getElementsByTagName('parsererror');
      if (parserErrors.length > 0) {
        this.errors.push('XML parsing failed: ' + parserErrors[0].textContent);
        return;
      }

      // Validate XML declaration
      if (!xmlContent.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
        this.errors.push('Missing or incorrect XML declaration');
      }

      // Validate DOCTYPE
      if (!xmlContent.includes('<!DOCTYPE score-partwise')) {
        this.errors.push('Missing MusicXML DOCTYPE declaration');
      }

      // Validate root element
      const root = doc.documentElement;
      if (root.tagName !== 'score-partwise') {
        this.errors.push(`Invalid root element: ${root.tagName}, expected: score-partwise`);
      }

      console.log('  ✅ Valid XML structure');
    } catch (error) {
      this.errors.push(`XML structure error: ${error.message}`);
    }
  }

  validateMusicXMLElements(xmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    // Required elements
    const requiredElements = [
      'work',
      'work-title',
      'part-list',
      'score-part',
      'part',
      'measure',
      'attributes',
      'divisions',
      'key',
      'time',
      'clef'
    ];

    requiredElements.forEach(element => {
      if (doc.getElementsByTagName(element).length === 0) {
        this.errors.push(`Missing required element: <${element}>`);
      }
    });

    // Check work title includes difficulty level
    const workTitle = doc.getElementsByTagName('work-title')[0];
    if (workTitle) {
      const title = workTitle.textContent;
      if (!title.match(/^(Beginner|Intermediate-Beginner|Intermediate):/)) {
        this.warnings.push('Work title should start with difficulty level (Beginner:, Intermediate-Beginner:, or Intermediate:)');
      }
    }

    console.log('  ✅ Required MusicXML elements present');
  }

  validateDualStaff(xmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    // Check staves count
    const stavesElements = doc.getElementsByTagName('staves');
    if (stavesElements.length === 0) {
      this.errors.push('Missing <staves> element in attributes');
      return;
    }

    const stavesCount = parseInt(stavesElements[0].textContent);
    if (stavesCount !== 2) {
      this.errors.push(`Incorrect staves count: ${stavesCount}, expected: 2`);
    }

    // Check for two clef definitions
    const clefs = doc.getElementsByTagName('clef');
    if (clefs.length < 2) {
      this.errors.push(`Only ${clefs.length} clef(s) found, expected 2 (standard notation + tablature)`);
    }

    // Validate staff 1 is G clef with octave change
    let hasGClef = false;
    let hasOctaveChange = false;
    for (let i = 0; i < clefs.length; i++) {
      const clef = clefs[i];
      const staffNum = clef.getAttribute('number');
      if (staffNum === '1') {
        const sign = clef.getElementsByTagName('sign')[0];
        if (sign && sign.textContent === 'G') {
          hasGClef = true;
        }
        const octaveChange = clef.getElementsByTagName('clef-octave-change')[0];
        if (octaveChange && octaveChange.textContent === '-1') {
          hasOctaveChange = true;
        }
      }
    }

    if (!hasGClef) {
      this.errors.push('Staff 1 must have G clef (treble clef)');
    }
    if (!hasOctaveChange) {
      this.warnings.push('Staff 1 should have clef-octave-change=-1 for guitar');
    }

    // Validate staff 2 is TAB clef
    let hasTabClef = false;
    for (let i = 0; i < clefs.length; i++) {
      const clef = clefs[i];
      const staffNum = clef.getAttribute('number');
      if (staffNum === '2') {
        const sign = clef.getElementsByTagName('sign')[0];
        if (sign && sign.textContent === 'TAB') {
          hasTabClef = true;
        }
      }
    }

    if (!hasTabClef) {
      this.errors.push('Staff 2 must have TAB clef for tablature');
    }

    // Check staff-details for guitar tuning
    const staffDetails = doc.getElementsByTagName('staff-details');
    let hasTuning = false;
    for (let i = 0; i < staffDetails.length; i++) {
      const detail = staffDetails[i];
      if (detail.getAttribute('number') === '2') {
        const tunings = detail.getElementsByTagName('staff-tuning');
        if (tunings.length === 6) {
          hasTuning = true;
        }
      }
    }

    if (!hasTuning) {
      this.errors.push('Staff 2 must have 6 staff-tuning elements (standard guitar tuning)');
    }

    console.log('  ✅ Dual staff configuration valid');
  }

  validateNoteStructure(xmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    const notes = doc.getElementsByTagName('note');
    const backups = doc.getElementsByTagName('backup');

    if (notes.length === 0) {
      this.errors.push('No notes found in exercise');
      return;
    }

    // Count notes per staff
    let staff1Notes = 0;
    let staff2Notes = 0;

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const staff = note.getElementsByTagName('staff')[0];
      if (staff) {
        const staffNum = parseInt(staff.textContent);
        if (staffNum === 1) staff1Notes++;
        if (staffNum === 2) staff2Notes++;
      }
    }

    // Should have equal notes on both staves (or very close for rests)
    if (Math.abs(staff1Notes - staff2Notes) > 2) {
      this.warnings.push(`Unequal note count: Staff 1 has ${staff1Notes}, Staff 2 has ${staff2Notes}`);
    }

    // Each staff 1 note should be followed by backup (in most cases)
    if (staff1Notes > 0 && backups.length === 0) {
      this.errors.push('Notes present but no <backup> elements found - staff synchronization will fail');
    }

    // Validate voice numbers
    let hasVoice1 = false;
    let hasVoice5 = false;
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const voice = note.getElementsByTagName('voice')[0];
      if (voice) {
        const voiceNum = parseInt(voice.textContent);
        if (voiceNum === 1) hasVoice1 = true;
        if (voiceNum === 5) hasVoice5 = true;
      }
    }

    if (!hasVoice1) {
      this.warnings.push('No notes with voice=1 (staff 1 notation)');
    }
    if (!hasVoice5) {
      this.warnings.push('No notes with voice=5 (staff 2 tablature)');
    }

    console.log('  ✅ Note structure appears valid');
  }

  validateTabNotation(xmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    const notes = doc.getElementsByTagName('note');
    let tabNoteCount = 0;
    let tabNotesWithFret = 0;

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const staff = note.getElementsByTagName('staff')[0];
      
      if (staff && staff.textContent === '2') {
        tabNoteCount++;
        
        // Check for technical notation
        const notations = note.getElementsByTagName('notations')[0];
        if (notations) {
          const technical = notations.getElementsByTagName('technical')[0];
          if (technical) {
            const stringElem = technical.getElementsByTagName('string')[0];
            const fretElem = technical.getElementsByTagName('fret')[0];
            
            if (stringElem && fretElem) {
              tabNotesWithFret++;
              
              const stringNum = parseInt(stringElem.textContent);
              const fretNum = parseInt(fretElem.textContent);
              
              // Validate string number (1-6)
              if (stringNum < 1 || stringNum > 6) {
                this.errors.push(`Invalid string number: ${stringNum} (must be 1-6)`);
              }
              
              // Validate fret number (0-4 for these exercises)
              if (fretNum < 0 || fretNum > 4) {
                this.warnings.push(`Fret ${fretNum} outside recommended range 0-4`);
              }
            }
          }
        }
        
        // Check that tab notes have no stem
        const stem = note.getElementsByTagName('stem')[0];
        if (stem && stem.textContent !== 'none') {
          this.warnings.push('Tablature notes should have <stem>none</stem>');
        }
      }
    }

    if (tabNoteCount > 0 && tabNotesWithFret === 0) {
      this.errors.push('Tablature staff has notes but no string/fret information');
    }

    console.log('  ✅ Tablature notation valid');
  }

  validateDurations(xmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    const measures = doc.getElementsByTagName('measure');
    const divisions = doc.getElementsByTagName('divisions')[0];
    
    if (!divisions) {
      this.errors.push('Missing <divisions> element');
      return;
    }

    const divisionsValue = parseInt(divisions.textContent);
    
    for (let i = 0; i < measures.length; i++) {
      const measure = measures[i];
      const measureNum = measure.getAttribute('number');
      
      // Get time signature for this measure
      const attributes = measure.getElementsByTagName('attributes')[0];
      let expectedDuration = divisionsValue * 4; // Default 4/4
      
      if (attributes) {
        const time = attributes.getElementsByTagName('time')[0];
        if (time) {
          const beats = time.getElementsByTagName('beats')[0];
          const beatType = time.getElementsByTagName('beat-type')[0];
          if (beats && beatType) {
            const beatsValue = parseInt(beats.textContent);
            const beatTypeValue = parseInt(beatType.textContent);
            expectedDuration = divisionsValue * (4 / beatTypeValue) * beatsValue;
          }
        }
      }

      // Sum durations in measure (staff 1 only to avoid double-counting)
      let totalDuration = 0;
      const notes = measure.getElementsByTagName('note');
      
      for (let j = 0; j < notes.length; j++) {
        const note = notes[j];
        const staff = note.getElementsByTagName('staff')[0];
        
        if (staff && staff.textContent === '1') {
          const duration = note.getElementsByTagName('duration')[0];
          if (duration) {
            totalDuration += parseInt(duration.textContent);
          }
        }
      }

      if (totalDuration !== expectedDuration && totalDuration !== 0) {
        this.errors.push(`Measure ${measureNum}: duration mismatch (expected ${expectedDuration}, got ${totalDuration})`);
      }
    }

    console.log('  ✅ Duration consistency validated');
  }

  validatePitchToTab(xmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    // Read actual tuning from XML staff-tuning elements
    const tuning = {};
    const staffDetails = doc.getElementsByTagName('staff-details');
    
    for (let i = 0; i < staffDetails.length; i++) {
      const detail = staffDetails[i];
      if (detail.getAttribute('number') === '2') {
        const tunings = detail.getElementsByTagName('staff-tuning');
        for (let j = 0; j < tunings.length; j++) {
          const tuningElem = tunings[j];
          const line = tuningElem.getAttribute('line');
          const step = tuningElem.getElementsByTagName('tuning-step')[0];
          const octave = tuningElem.getElementsByTagName('tuning-octave')[0];
          
          if (step && octave) {
            const stepToSemitone = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
            const midiNote = (parseInt(octave.textContent) + 1) * 12 + stepToSemitone[step.textContent];
            tuning[parseInt(line)] = midiNote;
          }
        }
        break;
      }
    }
    
    // Debug: log the tuning map
    console.log('DEBUG: Tuning map:', tuning);

    const measures = doc.getElementsByTagName('measure');
    
    for (let i = 0; i < measures.length; i++) {
      const measure = measures[i];
      const notes = measure.getElementsByTagName('note');
      
      // Build map of staff 1 pitches by position
      const staff1Pitches = [];
      const staff2Tabs = [];
      
      for (let j = 0; j < notes.length; j++) {
        const note = notes[j];
        const staff = note.getElementsByTagName('staff')[0];
        
        if (!staff) continue;
        
        const staffNum = staff.textContent;
        const pitch = note.getElementsByTagName('pitch')[0];
        
        if (staffNum === '1' && pitch) {
          const step = pitch.getElementsByTagName('step')[0].textContent;
          const octave = parseInt(pitch.getElementsByTagName('octave')[0].textContent);
          const alter = pitch.getElementsByTagName('alter')[0];
          const alterValue = alter ? parseInt(alter.textContent) : 0;
          
          // Convert to MIDI note number
          const stepToSemitone = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
          const midiNote = (octave + 1) * 12 + stepToSemitone[step] + alterValue;
          
          staff1Pitches.push({ index: j, midiNote });
        }
        
        if (staffNum === '2') {
          const notations = note.getElementsByTagName('notations')[0];
          if (notations) {
            const technical = notations.getElementsByTagName('technical')[0];
            if (technical) {
              const stringElem = technical.getElementsByTagName('string')[0];
              const fretElem = technical.getElementsByTagName('fret')[0];
              
              if (stringElem && fretElem) {
                const stringNum = parseInt(stringElem.textContent);
                const fretNum = parseInt(fretElem.textContent);
                const calculatedMidi = tuning[stringNum] + fretNum;
                
                staff2Tabs.push({ index: j, stringNum, fretNum, midiNote: calculatedMidi });
              }
            }
          }
        }
      }

      // Compare (simplified - assumes same ordering)
      const minLength = Math.min(staff1Pitches.length, staff2Tabs.length);
      for (let k = 0; k < minLength; k++) {
        const pitch = staff1Pitches[k];
        const tab = staff2Tabs[k];
        
        if (pitch.midiNote !== tab.midiNote) {
          this.errors.push(
            `Measure ${measure.getAttribute('number')}: ` +
            `Pitch mismatch - Staff 1 MIDI=${pitch.midiNote}, ` +
            `Staff 2 (string ${tab.stringNum}, fret ${tab.fretNum}) MIDI=${tab.midiNote}`
          );
        }
      }
    }

    console.log('  ✅ Pitch-to-tab mapping validated');
  }

  reportResults() {
    console.log('\n' + '='.repeat(60));
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ VALIDATION PASSED - No errors or warnings\n');
      return true;
    }

    if (this.errors.length > 0) {
      console.log(`\n❌ ERRORS (${this.errors.length}):`);
      this.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${this.warnings.length}):`);
      this.warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. ${warning}`);
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');
    
    return this.errors.length === 0;
  }
}

// CLI usage
if (process.argv.length < 3) {
  console.error('Usage: node validate-exercise-xml.js <path-to-xml-file>');
  process.exit(1);
}

const validator = new ExerciseValidator(process.argv[2]);
const success = validator.validate();
process.exit(success ? 0 : 1);
