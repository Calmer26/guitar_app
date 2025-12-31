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

    // Cursor state tracking
    this.cursorEnabled = false;
    this.cursorTimeline = null;
    this.cursorIndex = 0;
    this.lastRenderedNoteIndex = -1;  // Track which timeline note we last rendered

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
        stage: 'Building element map' 
      });
      
      // Build DOM element mapping
      await this._buildElementMap(exercise);
      
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
   * Build mapping of note IDs to DOM elements using OSMD cursor
   * 
   * @param {ExerciseJSON} exercise - Exercise data
   * @private
   */
  async _buildElementMap(exercise) {
    this.noteElementMap.clear();
    
    // Wait for SVG to be fully rendered
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      // Store timeline for cursor control
      this.cursorTimeline = exercise.timeline;
      this.cursorIndex = 0;
      this.lastRenderedNoteIndex = -1;  // ✅ ADD: Reset cursor state

      // Initialize OSMD cursor
      if (!this.osmd.cursor) {
        this.osmd.cursor = new opensheetmusicdisplay.Cursor(
          this.osmd.container,
          this.osmd
        );
      }
      
      this.osmd.cursor.show();
      this.osmd.cursor.reset();
      
      // Store cursor reference for highlighting
      this.cursorEnabled = true;
      
      Logger.log(Logger.INFO, 'NotationRenderer', 'Using OSMD cursor for highlighting', {
        timelineLength: exercise.timeline.length
      });
      
    } catch (error) {
      Logger.log(Logger.ERROR, 'NotationRenderer', 'Cursor initialization failed', {
        error: error.message,
        stack: error.stack
      });
      
      // Fallback to simple approach
      this.cursorEnabled = false;
      this._buildElementMapFallback(exercise);
    }
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
    
    // Always clear previous highlights first
    this.clearHighlights();
    
    // Use OSMD cursor if enabled
    if (this.cursorEnabled && this.osmd.cursor && this.cursorTimeline) {
      const noteId = noteIds[0]; // Handle first note
      const noteIndex = this._findNoteInTimeline(noteId);
      
      if (noteIndex === -1) {
        Logger.log(Logger.WARN, 'NotationRenderer', 'Note not found in timeline', { noteId });
        // Fallback to manual highlighting
        this._manualHighlight(noteIds, className);
        return;
      }
      
      // Skip cursor movement for rests - keep cursor on last note
      const note = this.cursorTimeline[noteIndex];
      if (note && note.isRest) {
        Logger.log(Logger.DEBUG, 'NotationRenderer', 'Skipping cursor for rest', { noteId });
        return;
      }
      
      // Move cursor to this position
      this._advanceCursorToNote(noteIndex);
      
      Logger.log(Logger.DEBUG, 'NotationRenderer', 'Cursor moved to note', {
        noteId,
        noteIndex,
        cursorIndex: this.cursorIndex
      });
      
      return;
    }
    
    // Fallback to manual highlighting
    this._manualHighlight(noteIds, className);
  }

  /**
   * Find note in timeline by ID
   * 
   * @param {string} noteId - Note identifier to find
   * @returns {number} Index of note in timeline, or -1 if not found
   * @private
   */
  _findNoteInTimeline(noteId) {
    if (!this.cursorTimeline || !Array.isArray(this.cursorTimeline)) {
      Logger.log(Logger.WARN, 'NotationRenderer', 'Timeline not available for search');
      return -1;
    }
    
    return this.cursorTimeline.findIndex(note => note.id === noteId);
  }



  /**
   * Advance OSMD cursor to specific timeline note index
   * Handles both single-staff and dual-staff files using visual note positions
   *
   * @param {number} noteIndex - Target note index in full timeline
   * @private
   */
  _advanceCursorToNote(noteIndex) {
    try {
      const targetNote = this.cursorTimeline[noteIndex];
      if (!targetNote || targetNote.isRest) {
        // Skip rests - don't move cursor for rest notes
        return;
      }

      // Determine if this is a dual-staff file (timeline length suggests 2:1 ratio)
      const isDualStaff = this._isDualStaffFile();

      // Convert timeline indices to visual note positions
      // For dual-staff: each musical note appears twice, so use floor division
      // For single-staff: timeline index equals visual position
      const currentVisualPosition = isDualStaff ?
        Math.floor(this.lastRenderedNoteIndex / 2) : this.lastRenderedNoteIndex;
      const targetVisualPosition = isDualStaff ?
        Math.floor(noteIndex / 2) : noteIndex;

      Logger.log(Logger.DEBUG, 'NotationRenderer', 'Cursor advancement calculation', {
        noteId: targetNote.id,
        noteIndex,
        lastRenderedNoteIndex: this.lastRenderedNoteIndex,
        isDualStaff,
        currentVisualPosition,
        targetVisualPosition,
        // Show timeline context around target note
        timelineContext: this.cursorTimeline.slice(Math.max(0, noteIndex - 2), noteIndex + 3).map((note, i) => ({
          relativeIndex: i - 2,
          index: noteIndex - 2 + i,
          id: note?.id,
          isRest: note?.isRest,
          pitch: note?.pitch ? `${note.pitch.step}${note.pitch.octave}` : null
        }))
      });

      // Check if we need to move backward (e.g., after seeking)
      if (targetVisualPosition < currentVisualPosition) {
        Logger.log(Logger.DEBUG, 'NotationRenderer', 'Resetting cursor for backward seek', {
          from: this.lastRenderedNoteIndex,
          to: noteIndex,
          currentVisual: currentVisualPosition,
          targetVisual: targetVisualPosition,
          isDualStaff
        });
        this.osmd.cursor.reset();
        this.lastRenderedNoteIndex = -1;
      }

      // Calculate how many visual steps to advance
      const visualStepsToAdvance = targetVisualPosition - Math.max(0, currentVisualPosition);

      Logger.log(Logger.DEBUG, 'NotationRenderer', 'Visual steps calculation', {
        currentVisualPosition: Math.max(0, currentVisualPosition),
        targetVisualPosition,
        visualStepsToAdvance,
        isDualStaff
      });

      if (visualStepsToAdvance === 0) {
        // Already at correct position
        return;
      }

      // Advance cursor the calculated number of visual steps
      let steps = 0;
      const maxIterations = visualStepsToAdvance + 10; // Safety margin
      let iterations = 0;

      while (steps < visualStepsToAdvance &&
             !this.osmd.cursor.iterator.EndReached &&
             iterations < maxIterations) {

        this.osmd.cursor.next();
        steps++;
        iterations++;
      }

      // Update tracking
      this.lastRenderedNoteIndex = noteIndex;
      this.osmd.cursor.show();

      Logger.log(Logger.DEBUG, 'NotationRenderer', 'Cursor advanced', {
        noteId: targetNote.id,
        noteIndex,
        visualPosition: targetVisualPosition,
        stepsAdvanced: steps,
        iterations,
        isDualStaff
      });

    } catch (error) {
      Logger.log(Logger.ERROR, 'NotationRenderer', 'Cursor advancement failed', {
        error: error.message,
        noteIndex,
        lastRenderedNoteIndex: this.lastRenderedNoteIndex
      });
    }
  }

  /**
   * Determine if the current file is dual-staff based on timeline pattern
   * Dual-staff files have each musical note appearing twice (staff 1 + staff 2)
   *
   * @returns {boolean} True if dual-staff file detected
   * @private
   */
  _isDualStaffFile() {
    if (!this.cursorTimeline || this.cursorTimeline.length < 4) {
      return false; // Too small to determine pattern
    }

    // Method 1: Check for perfect alternating staff pattern (1,2,1,2,1,2...)
    // This is more reliable than ratio-based detection
    const isAlternatingPattern = this._hasAlternatingStaffPattern();

    // Method 2: Check ratio of timeline length to unique musical notes
    // Count unique note positions (accounting for dual-staff duplication)
    const uniqueNotes = new Set();
    this.cursorTimeline.forEach(note => {
      if (note && !note.isRest && note.pitch) {
        // Create a unique key for each musical note (ignoring staff)
        const key = `${note.pitch.step}${note.pitch.octave}`;
        uniqueNotes.add(key);
      }
    });

    const ratio = this.cursorTimeline.length / uniqueNotes.size;
    const isDualStaffByRatio = ratio >= 1.8 && ratio <= 2.2;

    // Use alternating pattern as primary detection, ratio as backup
    const isDualStaff = isAlternatingPattern || isDualStaffByRatio;

    Logger.log(Logger.DEBUG, 'NotationRenderer', 'Dual-staff detection', {
      timelineLength: this.cursorTimeline.length,
      uniqueNotes: uniqueNotes.size,
      ratio: ratio.toFixed(2),
      isAlternatingPattern,
      isDualStaffByRatio,
      isDualStaff,
      // Add detailed timeline analysis
      first10Notes: this.cursorTimeline.slice(0, 10).map((note, i) => ({
        index: i,
        id: note?.id,
        isRest: note?.isRest,
        pitch: note?.pitch ? `${note.pitch.step}${note.pitch.octave}` : null
      }))
    });

    return isDualStaff;
  }

  /**
   * Check if timeline follows alternating staff pattern (1,2,1,2,1,2...)
   *
   * @returns {boolean} True if alternating staff pattern detected
   * @private
   */
  _hasAlternatingStaffPattern() {
    if (!this.cursorTimeline || this.cursorTimeline.length < 4) {
      return false;
    }

    // Check first 10 notes for alternating pattern
    const checkLength = Math.min(10, this.cursorTimeline.length);
    let alternatingCount = 0;

    for (let i = 0; i < checkLength - 1; i++) {
      const currentNote = this.cursorTimeline[i];
      const nextNote = this.cursorTimeline[i + 1];

      if (currentNote && nextNote && !currentNote.isRest && !nextNote.isRest) {
        // Check if staffs alternate (1->2 or 2->1)
        const currentStaff = currentNote.staff;
        const nextStaff = nextNote.staff;

        if ((currentStaff === 1 && nextStaff === 2) ||
            (currentStaff === 2 && nextStaff === 1)) {
          alternatingCount++;
        }
      }
    }

    // Consider it alternating if at least 80% of consecutive pairs alternate
    const alternatingRatio = alternatingCount / (checkLength - 1);
    return alternatingRatio >= 0.8;
  }

  /**
   * Count non-rest notes in timeline between two indices
   * Used to calculate cursor advancement steps
   *
   * @param {number} startIndex - Start index (exclusive)
   * @param {number} endIndex - End index (inclusive)
   * @returns {number} Count of non-rest notes
   * @private
   */
  _countNonRestNotes(startIndex, endIndex) {
    if (!this.cursorTimeline) return 0;

    let count = 0;
    const start = Math.max(0, startIndex);
    const end = Math.min(this.cursorTimeline.length - 1, endIndex);

    for (let i = start; i <= end; i++) {
      const note = this.cursorTimeline[i];
      if (note && !note.isRest) {
        count++;
      }
    }

    return count;
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
    this.currentExercise = null;
    this.isRendering = false;
    this.lastHighlightedNotes = [];
    this.cursorEnabled = false;
    this.cursorTimeline = null;
    this.cursorIndex = 0;
    this.lastRenderedNoteIndex = -1;  // ✅ ADD: Reset cursor state

    Logger.log(Logger.INFO, 'NotationRenderer', 'Cleared');
  }
}

export { NotationRenderer };
