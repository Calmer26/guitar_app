/**
 * @module exerciseLoader
 * @description MusicXML parsing and exercise data structure generation
 * 
 * Responsible for parsing MusicXML files, extracting note data, generating
 * timelines with millisecond timestamps, and creating ExerciseJSON structures
 * for use by other modules.
 * 
 * @see Architecture.md §3.1 (Exercise Loader Module)
 * @see Architecture.md §4.1 (ExerciseJSON Structure)
 */

import { EventEmitter } from '../utils/eventEmitter.js';
import { Logger } from '../utils/logger.js';

/**
 * ExerciseLoader - Parse MusicXML and generate exercise data
 * 
 * Responsibilities:
 * - Parse MusicXML files into structured data
 * - Generate timeline with note data and millisecond timestamps
 * - Identify notation vs tablature staves
 * - Validate exercise data and handle errors gracefully
 * - Support file upload and sample exercise loading
 */
class ExerciseLoader extends EventEmitter {
  /**
   * Parse MusicXML string into ExerciseJSON structure
   * 
   * @param {string} xmlContent - Raw MusicXML content
   * @returns {Promise<ExerciseJSON>} Parsed exercise data with timeline and metadata
   * @throws {Error} If XML is invalid or missing required elements
   */
  async parseXML(xmlContent) {
    const parseStartTime = Date.now();
    
    try {
      // Validate input
      if (!xmlContent || typeof xmlContent !== 'string') {
        throw new Error('Invalid XML content: must be non-empty string');
      }
      
      this.emit('parse:progress', { percent: 0, stage: 'Validating input' });
      
      // Parse XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Check for parsing errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error(`XML parse error: ${parserError.textContent}`);
      }
      
      // Validate root element
      const scorePartwise = xmlDoc.querySelector('score-partwise');
      if (!scorePartwise) {
        throw new Error('Invalid MusicXML: missing score-partwise element');
      }
      
      this.emit('parse:progress', { percent: 10, stage: 'Parsing XML structure' });
      
      // Extract metadata
      const metadata = this._extractMetadata(xmlDoc);
      this.emit('parse:progress', { percent: 20, stage: 'Extracting metadata' });
      
      // Parse time signature
      const timeSignature = this._parseTimeSignature(xmlDoc);
      
      // Get divisions from first measure
      const firstMeasure = xmlDoc.querySelector('measure[number="1"]');
      const divisionsElement = firstMeasure?.querySelector('attributes > divisions');
      const divisions = divisionsElement ? parseInt(divisionsElement.textContent, 10) : 1;
      
      // Detect upbeat (anacrusis)
      const upbeatInfo = this._detectUpbeat(xmlDoc, divisions, timeSignature);
      
      // Extract tuning
      const tuning = this._extractTuning(xmlDoc);
      
      this.emit('parse:progress', { percent: 30, stage: 'Extracting instrument data' });
      
      // Build timeline
      const timeline = this._buildTimeline(xmlDoc, metadata.tempo, timeSignature);
      this.emit('parse:progress', { percent: 80, stage: 'Building timeline' });
      
      // Sort and validate timeline
      timeline.sort((a, b) => a.timestamp - b.timestamp);
      this._assignNoteIds(timeline);
      
      // Count systems and measures
      const systemCount = this._detectSystems(xmlDoc);
      const measureCount = xmlDoc.querySelectorAll('measure').length;
      
      // Generate exercise ID
      const id = this._generateId(metadata.title);
      
      // Create ExerciseJSON structure
      const exerciseJSON = {
        id,
        title: metadata.title,
        composer: metadata.composer,
        tempo: metadata.tempo,
        timeSignature,
        upbeat: upbeatInfo, // NEW: Upbeat information
        tuning,
        timeline,
        osmdInput: xmlContent, // Preserve complete MusicXML
        systemCount,
        measureCount
      };
      
      this.emit('parse:progress', { percent: 90, stage: 'Validating result' });
      
      // Validate result
      const validation = this.validateExercise(exerciseJSON);
      if (!validation.valid) {
        throw new Error(`Exercise validation failed: ${validation.errors.join(', ')}`);
      }
      
      const parseTime = Date.now() - parseStartTime;
      
      this.emit('parse:progress', { percent: 100, stage: 'Complete' });
      this.emit('exercise:loaded', {
        exerciseJSON,
        source: 'string',
        parseTime
      });
      
      return exerciseJSON;
      
    } catch (error) {
      Logger.log(Logger.ERROR, 'ExerciseLoader', 'Failed to parse XML', {
        error: error.message,
        stack: error.stack
      });
      
      this.emit('exercise:error', {
        error: error.message,
        lineNumber: null
      });
      
      throw error;
    }
  }

  /**
   * Load exercise from file upload
   * 
   * @param {File} file - Uploaded MusicXML file
   * @returns {Promise<ExerciseJSON>} Parsed exercise data
   * @throws {Error} If file is invalid or parse fails
   */
  async loadFromFile(file) {
    try {
      // Validate file
      this._validateFile(file);
      
      // Read file content
      const xmlContent = await this._readFile(file);
      
      // Parse content
      const exercise = await this.parseXML(xmlContent);
      
      // Add filename to result (optional)
      exercise.filename = file.name;
      
      return exercise;
      
    } catch (error) {
      Logger.log(Logger.ERROR, 'ExerciseLoader', 'Failed to load file', {
        error: error.message,
        fileName: file.name
      });
      
      this.emit('exercise:error', {
        error: error.message,
        file: file.name,
        lineNumber: null
      });
      
      throw error;
    }
  }

  /**
   * Validate exercise data structure
   * 
   * @param {ExerciseJSON} exercise - Exercise data to validate
   * @returns {Object} Validation result with valid boolean and errors array
   */
  validateExercise(exercise) {
    const errors = [];
    
    // Validate required fields
    if (!exercise.id || typeof exercise.id !== 'string') {
      errors.push('id must be non-empty string');
    }
    
    if (!exercise.title || typeof exercise.title !== 'string') {
      errors.push('title must be non-empty string');
    }
    
    if (!exercise.tempo || exercise.tempo <= 0 || exercise.tempo >= 500) {
      errors.push('tempo must be > 0 and < 500');
    }
    
    if (!exercise.timeSignature || 
        !exercise.timeSignature.beats || 
        !exercise.timeSignature.beatType) {
      errors.push('timeSignature must have beats and beatType');
    } else {
      const validBeatTypes = [2, 4, 8, 16];
      if (!validBeatTypes.includes(exercise.timeSignature.beatType)) {
        errors.push('timeSignature.beatType must be power of 2 (2, 4, 8, 16)');
      }
    }
    
    if (!Array.isArray(exercise.timeline) || exercise.timeline.length === 0) {
      errors.push('timeline must be array with length > 0');
    }
    
    // Validate timeline
    if (Array.isArray(exercise.timeline)) {
      // Check chronological order
      for (let i = 1; i < exercise.timeline.length; i++) {
        if (exercise.timeline[i].timestamp < exercise.timeline[i - 1].timestamp) {
          errors.push('timeline must be sorted by timestamp (ascending)');
          break;
        }
      }
      
      // Check unique IDs
      const ids = new Set();
      for (const note of exercise.timeline) {
        if (!note.id) {
          errors.push('Each note must have unique id');
          break;
        }
        if (ids.has(note.id)) {
          errors.push(`Duplicate note id: ${note.id}`);
          break;
        }
        ids.add(note.id);
        
        // Validate note fields
        if (note.staff !== 1 && note.staff !== 2) {
          errors.push('note.staff must be 1 or 2');
        }
        
        if (!note.isRest && (note.midi < 0 || note.midi > 127)) {
          errors.push('note.midi must be 0-127');
        }
        
        // Validate tablature data
        if (note.staff === 2 && note.tab) {
          if (note.tab.string < 1 || note.tab.string > 6) {
            errors.push('tab.string must be 1-6');
          }
          if (note.tab.fret < 0 || note.tab.fret > 24) {
            errors.push('tab.fret must be 0-24');
          }
        }
      }
    }
    
    // Validate osmdInput
    if (!exercise.osmdInput || typeof exercise.osmdInput !== 'string') {
      errors.push('osmdInput must be non-empty string');
    }
    
    // Validate system and measure counts
    if (!exercise.systemCount || exercise.systemCount < 1) {
      errors.push('systemCount must be > 0');
    }
    
    if (!exercise.measureCount || exercise.measureCount < 1) {
      errors.push('measureCount must be > 0');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate file before loading
   * 
   * @param {File} file - File to validate
   * @throws {Error} If file is invalid
   * @private
   */
  _validateFile(file) {
    // Check file type
    if (!this.config.allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only MusicXML (.xml) files are allowed.');
    }
    
    // Check file size
    if (file.size > this.config.maxFileSize) {
      throw new Error('File too large. Maximum size is 5MB.');
    }
    
    // Check file extension
    if (!file.name.match(/\.(xml|musicxml)$/i)) {
      throw new Error('Invalid file extension. Expected .xml or .musicxml');
    }
  }

  /**
   * Read file content as text
   * 
   * @param {File} file - File to read
   * @returns {Promise<string>} File content
   * @private
   */
  _readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        resolve(event.target.result);
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsText(file);
    });
  }

  /**
   * Extract metadata from MusicXML
   * 
   * @param {Document} xmlDoc - Parsed XML document
   * @returns {Object} Metadata object
   * @private
   */
  _extractMetadata(xmlDoc) {
    // Extract title
    const workTitleElement = xmlDoc.querySelector('work-title');
    const title = workTitleElement ? workTitleElement.textContent : 'Untitled';
    
    // Extract composer
    const composerElement = xmlDoc.querySelector('creator[type="composer"]');
    const composer = composerElement ? composerElement.textContent : 'Unknown';
    
    // Extract tempo (default to 120)
    let tempo = 120;
    const soundElement = xmlDoc.querySelector('sound[tempo]');
    if (soundElement) {
      const tempoValue = parseInt(soundElement.getAttribute('tempo'), 10);
      if (!isNaN(tempoValue) && tempoValue > 0 && tempoValue < 500) {
        tempo = tempoValue;
      }
    }
    
    return { title, composer, tempo };
  }

  /**
   * Detect if first measure is an upbeat (anacrusis)
   * 
   * @param {Document} xmlDoc - Parsed XML document
   * @param {number} divisions - Divisions per quarter note
   * @param {Object} timeSignature - Time signature object
   * @returns {Object} Upbeat info: { hasUpbeat: boolean, upbeatBeats: number, startBeat: number }
   * @private
   */
  _detectUpbeat(xmlDoc, divisions, timeSignature) {
    const firstMeasure = xmlDoc.querySelector('measure[number="1"]');
    if (!firstMeasure) {
      return { hasUpbeat: false, upbeatBeats: 0, startBeat: 1 };
    }
    
    // Calculate total duration of notes in first measure
    let totalDuration = 0;
    const notes = firstMeasure.querySelectorAll('note');
    
    notes.forEach(noteElement => {
      // Only count notes from staff 1 (notation staff)
      const staffElement = noteElement.querySelector('staff');
      const staff = staffElement ? parseInt(staffElement.textContent, 10) : 1;
      
      if (staff === 1) {
        const durationElement = noteElement.querySelector('duration');
        if (durationElement) {
          totalDuration += parseInt(durationElement.textContent, 10);
        }
      }
    });
    
    // Calculate expected full measure duration
    const fullMeasureDuration = divisions * timeSignature.beats;
    
    Logger.log(Logger.DEBUG, 'ExerciseLoader', 'Upbeat detection', {
      totalDuration,
      fullMeasureDuration,
      divisions,
      timeSignatureBeats: timeSignature.beats
    });
    
    // If first measure is incomplete, it's an upbeat
    if (totalDuration < fullMeasureDuration && totalDuration > 0) {
      const upbeatDuration = totalDuration;
      const upbeatBeats = upbeatDuration / divisions;
      const startBeat = timeSignature.beats - upbeatBeats + 1; // e.g., 4 - 2 + 1 = 3
      
      Logger.log(Logger.INFO, 'ExerciseLoader', 'Upbeat detected', {
        upbeatDuration,
        upbeatBeats,
        startBeat: Math.ceil(startBeat),
        fullMeasureDuration
      });
      
      return {
        hasUpbeat: true,
        upbeatBeats,
        startBeat: Math.ceil(startBeat),
        upbeatDuration,
        fullMeasureDuration
      };
    }
    
    Logger.log(Logger.DEBUG, 'ExerciseLoader', 'No upbeat detected');
    
    return { hasUpbeat: false, upbeatBeats: 0, startBeat: 1 };
  }

  /**
   * Parse time signature from first measure attributes
   * 
   * @param {Document} xmlDoc - Parsed XML document
   * @returns {Object} Time signature object
   * @private
   */
  _parseTimeSignature(xmlDoc) {
    const timeElement = xmlDoc.querySelector('attributes > time');
    
    if (timeElement) {
      const beatsElement = timeElement.querySelector('beats');
      const beatTypeElement = timeElement.querySelector('beat-type');
      
      const beats = beatsElement ? parseInt(beatsElement.textContent, 10) : 4;
      const beatType = beatTypeElement ? parseInt(beatTypeElement.textContent, 10) : 4;
      
      return { beats, beatType };
    }
    
    // Default to 4/4
    return { beats: 4, beatType: 4 };
  }

  /**
   * Extract guitar tuning from staff 2 details
   * 
   * @param {Document} xmlDoc - Parsed XML document
   * @returns {Array} Array of pitch strings
   * @private
   */
  _extractTuning(xmlDoc) {
    const tuningElements = xmlDoc.querySelectorAll('staff-details[number="2"] > staff-tuning');
    
    if (tuningElements.length === 6) {
      const tuning = [];
      tuningElements.forEach((elem) => {
        const stepElement = elem.querySelector('tuning-step');
        const octaveElement = elem.querySelector('tuning-octave');
        
        if (stepElement && octaveElement) {
          const step = stepElement.textContent;
          const octave = parseInt(octaveElement.textContent, 10);
          tuning.push(`${step}${octave}`);
        }
      });
      
      if (tuning.length === 6) {
        return tuning;
      }
    }
    
    // Default to standard guitar tuning
    return ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
  }

  /**
   * Build chronological timeline of all notes
   * 
   * @param {Document} xmlDoc - Parsed XML document
   * @param {number} tempo - Beats per minute
   * @param {Object} timeSignature - Time signature object
   * @returns {Array} Timeline array
   * @private
   */
  _buildTimeline(xmlDoc, tempo, timeSignature) {
    const timeline = [];
    let currentTime = 0; // in milliseconds
    let systemNumber = 1;
    let divisions = 1;
    
    // Get all measures
    const measures = xmlDoc.querySelectorAll('measure');
    
    measures.forEach((measure) => {
      // Check for new system
      const printElement = measure.querySelector('print[new-system="yes"]');
      if (printElement) {
        systemNumber++;
      }
      
      // Check for divisions change
      const divisionsElement = measure.querySelector('attributes > divisions');
      if (divisionsElement) {
        divisions = parseInt(divisionsElement.textContent, 10) || 1;
      }
      
      // Process all child elements in order
      const elements = Array.from(measure.children);
      
      for (const element of elements) {
        if (element.tagName === 'note') {
          // Handle rest notes - add to timeline with isRest flag
          if (element.querySelector('rest')) {
            const durationElement = element.querySelector('duration');
            if (durationElement) {
              const duration = parseInt(durationElement.textContent, 10);
              const timing = this._calculateTimestamp(divisions, duration, currentTime, tempo);
              
              const staffElement = element.querySelector('staff');
              const staff = staffElement ? parseInt(staffElement.textContent, 10) : 1;
              
              timeline.push({
                timestamp: timing.timestamp,
                duration: timing.duration,
                isRest: true,
                staff,
                system: systemNumber
              });
              
              currentTime = timing.timestamp + timing.duration;
            }
            continue;
          }
          
          // Extract pitch
          const pitch = this._extractPitch(element);
          if (!pitch) continue;
          
          // Calculate MIDI
          const midi = this._convertPitchToMIDI(pitch);
          
          // Extract duration and calculate timestamp
          const durationElement = element.querySelector('duration');
          if (!durationElement) continue;
          
          const duration = parseInt(durationElement.textContent, 10);
          const timing = this._calculateTimestamp(divisions, duration, currentTime, tempo);
          
          // Extract staff
          const staffElement = element.querySelector('staff');
          const staff = staffElement ? parseInt(staffElement.textContent, 10) : 1;
          
          // Extract voice
          const voiceElement = element.querySelector('voice');
          const voice = voiceElement ? parseInt(voiceElement.textContent, 10) : 1;
          
          // Extract tablature data if staff 2
          const tab = staff === 2 ? this._extractTabData(element) : null;
          
          // Create timeline note
          const note = {
            timestamp: timing.timestamp,
            duration: timing.duration,
            midi,
            pitch,
            staff,
            voice,
            tab,
            system: systemNumber
          };
          
          timeline.push(note);
          
          // Advance current time
          currentTime = timing.timestamp + timing.duration;
          
        } else if (element.tagName === 'backup') {
          // Rewind time
          const durationElement = element.querySelector('duration');
          if (durationElement) {
            const duration = parseInt(durationElement.textContent, 10);
            const backupTime = this._calculateTimestamp(divisions, duration, currentTime, tempo).duration;
            currentTime -= backupTime;
          }
          
        } else if (element.tagName === 'forward') {
          // Advance time without notes
          const durationElement = element.querySelector('duration');
          if (durationElement) {
            const duration = parseInt(durationElement.textContent, 10);
            const forwardTime = this._calculateTimestamp(divisions, duration, currentTime, tempo).duration;
            currentTime += forwardTime;
          }
        }
      }
    });
    
    return timeline;
  }

  /**
   * Extract pitch data from note element
   * 
   * @param {Element} noteElement - Note element
   * @returns {Object} Pitch object or null
   * @private
   */
  _extractPitch(noteElement) {
    const pitchElement = noteElement.querySelector('pitch');
    if (!pitchElement) return null;
    
    const stepElement = pitchElement.querySelector('step');
    const octaveElement = pitchElement.querySelector('octave');
    const alterElement = pitchElement.querySelector('alter');
    
    if (!stepElement || !octaveElement) return null;
    
    const step = stepElement.textContent;
    const octave = parseInt(octaveElement.textContent, 10);
    const alter = alterElement ? parseInt(alterElement.textContent, 10) : 0;
    
    return { step, octave, alter };
  }

  /**
   * Convert pitch object to MIDI note number
   * 
   * @param {Object} pitch - Pitch object with step, octave, alter
   * @returns {number} MIDI note number (0-127)
   * @private
   */
  _convertPitchToMIDI(pitch) {
    // Step to MIDI offset (C=0, D=2, E=4, F=5, G=7, A=9, B=11)
    const stepOffsets = {
      'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
    };
    
    const stepOffset = stepOffsets[pitch.step] || 0;
    const baseMidi = (pitch.octave + 1) * 12 + stepOffset;
    const midi = baseMidi + pitch.alter;
    
    // Clamp to valid MIDI range
    return Math.max(0, Math.min(127, midi));
  }

  /**
   * Calculate timestamp and duration from musical divisions
   * 
   * @param {number} divisions - Divisions per quarter note
   * @param {number} duration - Duration in divisions
   * @param {number} currentTime - Current time in milliseconds
   * @param {number} tempo - Beats per minute
   * @returns {Object} Object with timestamp and duration in milliseconds
   * @private
   */
  _calculateTimestamp(divisions, duration, currentTime, tempo) {
    // Convert divisions to quarter note equivalents
    const quarterNoteUnits = duration / divisions;
    
    // Convert to milliseconds: (quarter notes) * (milliseconds per quarter note)
    const millisecondsPerQuarter = 60000 / tempo; // 60000 ms per minute
    const durationMs = quarterNoteUnits * millisecondsPerQuarter;
    
    return {
      timestamp: currentTime,
      duration: durationMs
    };
  }

  /**
   * Extract tablature information (string and fret)
   * 
   * @param {Element} noteElement - Note element
   * @returns {Object|null} Tab data object or null
   * @private
   */
  _extractTabData(noteElement) {
    const notations = noteElement.querySelector('notations');
    if (!notations) return null;
    
    const technical = notations.querySelector('technical');
    if (!technical) return null;
    
    const stringElement = technical.querySelector('string');
    const fretElement = technical.querySelector('fret');
    
    if (stringElement && fretElement) {
      const string = parseInt(stringElement.textContent, 10);
      const fret = parseInt(fretElement.textContent, 10);
      
      // Validate the extracted values
      if (!isNaN(string) && !isNaN(fret) && 
          string >= 1 && string <= 6 && 
          fret >= 0 && fret <= 24) {
        return { string, fret };
      }
    }
    
    return null;
  }

  /**
   * Assign unique IDs to all notes in timeline
   * 
   * @param {Array} timeline - Timeline array to modify
   * @private
   */
  _assignNoteIds(timeline) {
    timeline.forEach((note, index) => {
      note.id = `n${index + 1}`;
    });
  }

  /**
   * Detect system breaks and count total systems
   * 
   * @param {Document} xmlDoc - Parsed XML document
   * @returns {number} Total system count
   * @private
   */
  _detectSystems(xmlDoc) {
    const systemBreaks = xmlDoc.querySelectorAll('print[new-system="yes"]');
    return systemBreaks.length + 1; // +1 for first system
  }

  /**
   * Generate unique exercise ID
   * 
   * @param {string} title - Exercise title
   * @returns {string} Unique ID
   * @private
   */
  _generateId(title) {
    const timestamp = Date.now();
    const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${sanitizedTitle}-${timestamp}`;
  }

  /**
   * Get filtered timeline for analysis (staff 1 only)
   * 
   * @param {ExerciseJSON} exercise - Exercise to get analysis timeline for
   * @returns {Array} Filtered timeline with only staff 1 notes
   */
  getAnalysisTimeline(exercise) {
    if (!exercise || !exercise.timeline) {
      return [];
    }
    
    // Filter to only staff 1 (notation) notes, excluding rests
    return exercise.timeline
      .filter(note => note.staff === 1 && !note.isRest)
      .map(note => ({
        id: note.id,
        midi: note.midi,
        timestamp: note.timestamp,
        duration: note.duration,
        pitch: note.pitch
      }));
  }

  /**
   * Recalculate timeline timestamps for a new tempo
   * 
   * @param {Array} originalTimeline - Original timeline with old tempo
   * @param {number} oldTempo - Original tempo in BPM
   * @param {number} newTempo - New tempo in BPM
   * @returns {Array} New timeline with recalculated timestamps
   * @public
   */
  recalculateTimeline(originalTimeline, oldTempo, newTempo) {
    if (!originalTimeline || !Array.isArray(originalTimeline)) {
      throw new Error('Invalid timeline provided for recalculation');
    }
    
    if (oldTempo <= 0 || newTempo <= 0) {
      throw new Error('Invalid tempo values provided for recalculation');
    }
    
    // Calculate tempo ratio (inverse relationship: higher tempo = shorter durations)
    const tempoRatio = oldTempo / newTempo;
    
    console.log(`🔄 Recalculating timeline: tempo ${oldTempo} → ${newTempo} BPM (ratio: ${tempoRatio})`);
    
    // Recalculate all timestamps and durations
    const recalculatedTimeline = originalTimeline.map(note => ({
      ...note,
      timestamp: Math.round(note.timestamp * tempoRatio),
      duration: Math.round(note.duration * tempoRatio)
    }));
    
    console.log(`✅ Timeline recalculation complete: ${originalTimeline.length} notes processed`);
    
    return recalculatedTimeline;
  }
}

export { ExerciseLoader };
