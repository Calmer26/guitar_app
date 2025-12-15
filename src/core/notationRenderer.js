/**
 * @module notationRenderer
 * @description OSMD-based notation rendering and visual feedback
 * 
 * Uses a single OpenSheetMusicDisplay instance to render both standard
 * notation and tablature staves simultaneously. Provides DOM element mapping
 * and visual feedback capabilities.
 * 
 * @see Architecture.md §3.2 (Notation Renderer Module)
 * @see Architecture.md §4.1 (ExerciseJSON Structure)
 */

import { EventEmitter } from '../utils/eventEmitter.js';
import { Logger } from '../utils/logger.js';

/**
 * NotationRenderer - Render MusicXML with OSMD and provide visual feedback
 * 
 * Responsibilities:
 * - Render MusicXML using single OSMD instance
 * - Map note IDs to DOM elements for visual highlighting
 * - Scroll notation to keep current note visible
 * - Provide clear/reset functionality
 */
class NotationRenderer extends EventEmitter {
  /**
   * Initialize NotationRenderer
   * 
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    super();
    
    this.config = {
      // OSMD configuration
      drawTitle: false,
      drawComposer: false,
      drawCredits: false,
      backend: 'svg',
      autoResize: true,
      renderSingleHorizontalStaffline: false,
      followCursor: false,  // Manual cursor control
      ...config
    };
    
    // OSMD instance
    this.osmd = null;
    
    // DOM element mapping
    this.noteElementMap = new Map();
    this.containerElement = null;
    
    // Render state
    this.isRendering = false;
    this.currentExercise = null;
    this.lastHighlightedNotes = [];

    // Cursor state
    this.cursorEnabled = false;
    this.totalCursorSteps = 0;
    this.currentCursorStep = 0;

    // Timeline → cursor step mapping
    this.timelineToStepMap = new Map(); // noteId → cursor step index
    this.stepToTimelineMap = new Map(); // cursor step → array of noteIds

    // Performance monitoring
    this.renderStartTime = null;
  }

  /**
   * Initialize renderer with container element
   * 
   * @param {HTMLElement} containerElement - Container div for OSMD SVG
   */
  init(containerElement) {
    if (!containerElement) {
      throw new Error('Container element is required');
    }
    
    this.containerElement = containerElement;
    
    // Create OSMD instance
    this.osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(containerElement, this.config);
    
    Logger.log(Logger.INFO, 'NotationRenderer', 'Initialized', {
      containerElement: containerElement.id || 'unnamed'
    });
  }

  /**
   * Render exercise notation using OSMD
   * 
   * @param {ExerciseJSON} exercise - Exercise data to render
   * @returns {Promise<Object>} Render result with success status and metrics
   * @throws {Error} If rendering fails
   */
  async render(exercise) {
    if (!this.osmd) {
      throw new Error('OSMD not initialized. Call init() first.');
    }
    
    if (!exercise || !exercise.osmdInput) {
      throw new Error('Invalid exercise: missing osmdInput');
    }
    
    this.renderStartTime = Date.now();
    this.currentExercise = exercise;
    this.isRendering = true;
    
    try {
      this.emit('render:start', { exerciseId: exercise.id });
      Logger.log(Logger.INFO, 'NotationRenderer', 'Starting render', { 
        exerciseId: exercise.id 
      });
      
      // Load and render MusicXML
      await this.osmd.load(exercise.osmdInput);
      await this.osmd.render();
      
      this.emit('render:progress', {
        percent: 60,
        stage: 'Initializing cursor mapping'
      });

      // Initialize cursor and build timeline → cursor step mapping
      await this._initializeCursorMapping(exercise);
      
      this.emit('render:progress', { 
        percent: 90, 
        stage: 'Finalizing' 
      });
      
      const renderTime = Date.now() - this.renderStartTime;
      const noteCount = exercise.timeline.length;
      const systemCount = exercise.systemCount;
      
      this.emit('render:complete', {
        noteCount,
        systemCount,
        renderTime
      });
      
      this.isRendering = false;
      
      Logger.log(Logger.INFO, 'NotationRenderer', 'Render complete', {
        exerciseId: exercise.id,
        noteCount,
        renderTime
      });
      
      return {
        success: true,
        noteCount,
        systemCount,
        renderTime
      };
      
    } catch (error) {
      this.isRendering = false;
      
      Logger.log(Logger.ERROR, 'NotationRenderer', 'Render failed', {
        exerciseId: exercise.id,
        error: error.message,
        stack: error.stack
      });
      
      this.emit('render:error', {
        error: error.message,
        stage: 'render',
        exerciseId: exercise.id
      });
      
      throw error;
    }
  }

  /**
   * Initialize cursor and build timeline → cursor step mapping
   *
   * Based on osmd-audio-player's countAndSetIterationSteps() pattern
   * https://cdn.jsdelivr.net/gh/ivine/osmd-audio-player@master/src/OSMDCursor.ts
   *
   * @private
   */
  async _initializeCursorMapping(exercise) {
    try {
      // Create and initialize cursor
      if (!this.osmd.cursor) {
        this.osmd.cursor = new opensheetmusicdisplay.Cursor(
          this.osmd.container,
          this.osmd
        );
      }

      this.osmd.cursor.show();
      this.osmd.cursor.reset();

      Logger.log(Logger.INFO, 'NotationRenderer', 'Counting cursor steps...');

      // Count total cursor steps (following osmd-audio-player pattern)
      let stepCount = 0;
      const stepToNotesMap = new Map();

      // Iterate through all cursor positions
      while (!this.osmd.cursor.iterator.EndReached) {
        // Get current voice entries at this cursor position
        const voiceEntries = this.osmd.cursor.iterator.CurrentVoiceEntries;

        if (voiceEntries && voiceEntries.length > 0) {
          const noteIds = [];

          // Extract note information from voice entries
          for (const voiceEntry of voiceEntries) {
            if (voiceEntry && voiceEntry.Notes && voiceEntry.Notes.length > 0) {
              // Match notes to timeline by timestamp and pitch
              for (const graphicalNote of voiceEntry.Notes) {
                const sourceNote = graphicalNote.sourceNote;

                if (sourceNote && !sourceNote.IsRest) {
                  // Find matching timeline note(s) by timestamp and pitch
                  const matchingNotes = this._findTimelineNotesByVoiceEntry(
                    exercise.timeline,
                    sourceNote,
                    voiceEntry
                  );

                  noteIds.push(...matchingNotes);
                }
              }
            }
          }

          // Store mapping for this cursor step
          if (noteIds.length > 0) {
            stepToNotesMap.set(stepCount, noteIds);

            // Build reverse mapping (noteId → step)
            for (const noteId of noteIds) {
              if (!this.timelineToStepMap.has(noteId)) {
                this.timelineToStepMap.set(noteId, stepCount);
              }
            }
          }
        }

        stepCount++;
        this.osmd.cursor.next();
      }

      this.totalCursorSteps = stepCount;
      this.stepToTimelineMap = stepToNotesMap;
      this.cursorEnabled = true;

      // Reset cursor to beginning
      this.osmd.cursor.reset();
      this.currentCursorStep = 0;

      Logger.log(Logger.INFO, 'NotationRenderer', 'Cursor mapping complete', {
        totalSteps: this.totalCursorSteps,
        mappedNotes: this.timelineToStepMap.size,
        timelineLength: exercise.timeline.length
      });

      // Warn if mapping coverage is low
      if (this.timelineToStepMap.size < exercise.timeline.length * 0.8) {
        Logger.log(Logger.WARN, 'NotationRenderer',
          'Less than 80% of timeline notes mapped to cursor steps', {
            mapped: this.timelineToStepMap.size,
            total: exercise.timeline.length,
            ratio: (this.timelineToStepMap.size / exercise.timeline.length * 100).toFixed(1) + '%'
          });
      }

    } catch (error) {
      Logger.log(Logger.ERROR, 'NotationRenderer', 'Cursor initialization failed', {
        error: error.message,
        stack: error.stack
      });

      // Fallback to DOM mapping
      this.cursorEnabled = false;
      this._buildElementMapFallback(exercise);
    }
  }

  /**
   * Find timeline notes matching an OSMD voice entry
   *
   * Matches by:
   * 1. Timestamp (within tolerance)
   * 2. MIDI pitch
   * 3. Staff number
   *
   * @private
   */
  _findTimelineNotesByVoiceEntry(timeline, sourceNote, voiceEntry) {
    const matchingIds = [];

    // Calculate timestamp from OSMD's Timestamp object
    // Timestamp.RealValue is in quarter notes
    const timestampQuarters = sourceNote.Timestamp.RealValue;

    // Get tempo from exercise (or use default)
    const tempo = this.currentExercise?.tempo || 120;
    const msPerQuarter = 60000 / tempo;
    const expectedTimestampMs = timestampQuarters * msPerQuarter;

    // Tolerance: 50ms for timestamp matching
    const timeToleranceMs = 50;

    // Get MIDI pitch
    const pitch = sourceNote.Pitch;
    if (!pitch) return matchingIds;

    const expectedMidi = pitch.getHalfTone();

    // Get staff index (1-based in MusicXML, 0-based in OSMD)
    const voiceStaffIndex = voiceEntry.ParentStaff?.idInMusicSheet;
    const expectedStaff = voiceStaffIndex !== undefined ? voiceStaffIndex + 1 : null;

    // Search timeline for matches
    for (const note of timeline) {
      // Skip rests
      if (note.isRest) continue;

      // Check timestamp match
      const timeDiff = Math.abs(note.timestamp - expectedTimestampMs);
      if (timeDiff > timeToleranceMs) continue;

      // Check MIDI pitch match
      if (note.midi !== expectedMidi) continue;

      // Check staff match (if available)
      if (expectedStaff !== null && note.staff !== expectedStaff) continue;

      matchingIds.push(note.id);
    }

    return matchingIds;
  }

  /**
   * Fallback element mapping using DOM traversal
   * 
   * @param {ExerciseJSON} exercise - Exercise data
   * @private
   */
  _buildElementMapFallback(exercise) {
    this.noteElementMap.clear();
    
    const svg = this.containerElement.querySelector('svg');
    if (!svg) {
      Logger.log(Logger.WARN, 'NotationRenderer', 'No SVG found for fallback mapping');
      return;
    }
    
    // Find all note-like elements (OSMD uses various classes)
    const noteElements = svg.querySelectorAll(
      '.vf-notehead, .vf-note, [class*="note"]'
    );
    
    Logger.log(Logger.INFO, 'NotationRenderer', 'Fallback mapping found elements', {
      count: noteElements.length
    });
    
    // Map elements to timeline notes sequentially
    const timeline = exercise.timeline;
    const maxElements = Math.min(noteElements.length, timeline.length);
    
    for (let i = 0; i < maxElements; i++) {
      const element = noteElements[i];
      const note = timeline[i];
      
      // Add data attribute
      element.setAttribute('data-note-id', note.id);
      
      // Store in map
      this.noteElementMap.set(note.id, element);
    }
    
    Logger.log(Logger.INFO, 'NotationRenderer', 'Fallback mapping complete', {
      mappedNotes: this.noteElementMap.size
    });
  }

  /**
   * Find SVG element for a specific note
   * 
   * @param {SVGElement} svg - Root SVG element
   * @param {Object} note - Note data from timeline
   * @returns {Element|null} Found element or null
   * @private
   */
  _findNoteElement(svg, note) {
    // Strategy: Find note elements by pitch and approximate position
    // This is a simplified approach - OSMD's internal structure may vary
    
    // Get all note group elements
    const noteGroups = svg.querySelectorAll('g[data-note]');
    
    // Find the closest match based on pitch
    let bestMatch = null;
    let bestScore = Infinity;
    
    for (const group of noteGroups) {
      try {
        const groupNote = this._parseNoteElement(group);
        if (groupNote) {
          const score = this._calculateNoteDistance(note, groupNote);
          if (score < bestScore) {
            bestScore = score;
            bestMatch = group;
          }
        }
      } catch (e) {
        // Skip unparseable elements
      }
    }
    
    return bestScore < 1000 ? bestMatch : null; // Threshold for match
  }

  /**
   * Parse pitch information from a note group element
   * 
   * @param {Element} group - Note group element
   * @returns {Object|null} Parsed note data or null
   * @private
   */
  _parseNoteElement(group) {
    try {
      // This is implementation-specific and may need adjustment
      // based on OSMD's actual SVG structure
      
      const noteheads = group.querySelectorAll('ellipse, path[data-name^="notehead"]');
      if (noteheads.length === 0) return null;
      
      // Extract approximate pitch from y-position
      // This is a heuristic approach
      const yPos = parseFloat(noteheads[0].getAttribute('cy') || '0');
      
      // Map y-position to pitch (simplified)
      // In practice, this would need to be more sophisticated
      const stepMap = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
      
      return {
        y: yPos,
        // Additional parsing logic would go here
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate distance between two notes for matching
   * 
   * @param {Object} note1 - First note
   * @param {Object} note2 - Second note
   * @returns {number} Distance score
   * @private
   */
  _calculateNoteDistance(note1, note2) {
    let distance = 0;
    
    // Pitch distance
    if (note1.pitch && note2.pitch) {
      const pitchDistance = Math.abs(
        this._pitchToMIDI(note1.pitch) - this._pitchToMIDI(note2.pitch)
      ) * 100;
      distance += pitchDistance;
    }
    
    // Position distance
    if (note1.timestamp !== undefined && note2.y !== undefined) {
      const timeDistance = Math.abs(note1.timestamp - note2.y) * 0.01;
      distance += timeDistance;
    }
    
    return distance;
  }

  /**
   * Convert pitch object to MIDI number
   * 
   * @param {Object} pitch - Pitch object
   * @returns {number} MIDI number
   * @private
   */
  _pitchToMIDI(pitch) {
    const stepOffsets = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
    const stepOffset = stepOffsets[pitch.step] || 0;
    return (pitch.octave + 1) * 12 + stepOffset + (pitch.alter || 0);
  }

  /**
   * Highlight specific notes in the notation using OSMD cursor
   *
   * @param {Array} noteIds - Array of note IDs to highlight
   * @param {string} className - CSS class name for highlighting
   */
  highlightNotes(noteIds, className = 'highlighted') {
    if (!Array.isArray(noteIds)) {
      noteIds = [noteIds];
    }

    // Always clear previous highlights
    this.clearHighlights();

    // Use cursor if available
    if (this.cursorEnabled && this.osmd.cursor) {
      const noteId = noteIds[0]; // Primary note to highlight

      // Get cursor step for this note
      const targetStep = this.timelineToStepMap.get(noteId);

      if (targetStep === undefined) {
        Logger.log(Logger.WARN, 'NotationRenderer',
          'Note not mapped to cursor step', { noteId });

        // Fallback to manual highlighting
        this._manualHighlight(noteIds, className);
        return;
      }

      // Jump to cursor step
      this._jumpToCursorStep(targetStep);

      Logger.log(Logger.DEBUG, 'NotationRenderer', 'Cursor moved to step', {
        noteId,
        targetStep,
        totalSteps: this.totalCursorSteps,
        progress: (targetStep / this.totalCursorSteps * 100).toFixed(1) + '%'
      });

      return;
    }

    // Fallback to manual highlighting
    this._manualHighlight(noteIds, className);
  }

  /**
   * Jump cursor to specific step index
   *
   * Based on osmd-audio-player's jumpToStep():
   * https://cdn.jsdelivr.net/gh/ivine/osmd-audio-player@master/src/OSMDCursor.ts
   *
   * Strategy: reset if moving backward, then advance to target
   *
   * @private
   */
  _jumpToCursorStep(targetStep) {
    if (!this.osmd.cursor) return;

    try {
      // Reset if moving backward
      if (targetStep < this.currentCursorStep) {
        this.osmd.cursor.reset();
        this.currentCursorStep = 0;
      }

      // Advance to target step
      while (this.currentCursorStep < targetStep &&
             !this.osmd.cursor.iterator.EndReached) {
        this.osmd.cursor.next();
        this.currentCursorStep++;
      }

      // Ensure cursor is visible
      this.osmd.cursor.show();

    } catch (error) {
      Logger.log(Logger.ERROR, 'NotationRenderer',
        'Cursor jump failed', {
          error: error.message,
          targetStep,
          currentStep: this.currentCursorStep
        });
    }
  }

  /**
   * Manual highlighting fallback using DOM element mapping
   * 
   * @param {Array} noteIds - Array of note IDs to highlight
   * @param {string} className - CSS class name for highlighting
   * @private
   */
  _manualHighlight(noteIds, className) {
    Logger.log(Logger.DEBUG, 'NotationRenderer', 'Using manual highlighting fallback');
    
    for (const noteId of noteIds) {
      const element = this.noteElementMap.get(noteId);
      if (element) {
        element.classList.add(className);
        this.lastHighlightedNotes.push({ noteId, element, className });
      }
    }
  }

  /**
   * Clear highlights by class name
   * 
   * @param {string} className - CSS class name to remove
   * @private
   */
  _clearHighlightsByClass(className) {
    this.lastHighlightedNotes = this.lastHighlightedNotes.filter(({ noteId, element, className: existingClass }) => {
      if (existingClass === className && element.parentNode) {
        element.classList.remove(className);
        return false; // Remove from tracking
      }
      return true; // Keep in tracking
    });
  }

  /**
   * Clear all note highlights
   * 
   * @param {string} className - CSS class name to remove
   */
  clearHighlights(className = 'highlighted') {
    // If using cursor, just hide it
    if (this.cursorEnabled && this.osmd.cursor) {
      // Don't hide cursor during playback, just let it move
      // This method is called before each new highlight
      return;
    }
    
    // Fallback: Find all elements with this class
    const elements = this.containerElement?.querySelectorAll(`.${className}`) || [];
    
    elements.forEach(element => {
      element.classList.remove(className);
    });
    
    // Clear tracking
    this.lastHighlightedNotes = this.lastHighlightedNotes.filter(({ className: existingClass }) => {
      return existingClass !== className;
    });
  }

  /**
   * Scroll notation to keep specified note visible
   * 
   * @param {string} noteId - Note ID to scroll to
   * @param {Object} options - Scroll behavior options
   */
  scrollToNote(noteId, options = {}) {
    const element = this.getNoteElement(noteId);
    
    if (!element || !this.containerElement) {
      return false;
    }
    
    const {
      behavior = 'smooth',
      block = 'center',
      inline = 'nearest'
    } = options;
    
    try {
      element.scrollIntoView({ behavior, block, inline });
      return true;
    } catch (error) {
      Logger.log(Logger.WARN, 'NotationRenderer', 'Scroll failed', {
        noteId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get DOM element for a specific note
   * 
   * @param {string} noteId - Note identifier
   * @returns {Element|null} DOM element or null if not found
   */
  getNoteElement(noteId) {
    return this.noteElementMap.get(noteId) || null;
  }

  /**
   * Update OSMD configuration
   * 
   * @param {Object} config - OSMD configuration options
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
    
    if (this.osmd) {
      // Re-render with new config if an exercise is loaded
      if (this.currentExercise) {
        Logger.log(Logger.INFO, 'NotationRenderer', 'Re-rendering with new config');
        this.render(this.currentExercise);
      }
    }
  }

  /**
   * Clear current notation
   */
  clear() {
    // Hide cursor if active
    if (this.osmd && this.osmd.cursor) {
      try {
        this.osmd.cursor.hide();
      } catch (e) {
        // Ignore cursor hide errors
      }
    }

    if (this.containerElement) {
      this.containerElement.innerHTML = '';
    }

    this.osmd = null;
    this.noteElementMap.clear();
    this.timelineToStepMap.clear();      // NEW
    this.stepToTimelineMap.clear();      // NEW
    this.currentExercise = null;
    this.isRendering = false;
    this.lastHighlightedNotes = [];
    this.cursorEnabled = false;
    this.totalCursorSteps = 0;           // NEW
    this.currentCursorStep = 0;          // NEW

    Logger.log(Logger.INFO, 'NotationRenderer', 'Cleared');
  }
}

export { NotationRenderer };
