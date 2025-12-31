/**
 * @module app
 * @description Main application controller
 *
 * Orchestrates all application modules, handles UI events,
 * and manages the overall application state.
 *
 * Updated for M5: Audio context activation and audio controls
 * Updated for M9: UIManager integration for tab navigation and tuner
 * Updated for M11: Settings persistence and keyboard shortcuts
 * Updated for M12: Practice mode integration with PitchDetector and Analyzer
 * Updated for M13: Audio latency calibration with synthetic tone measurement
 * Updated: CRITICAL FIX - Applies audio latency compensation at analysis stage, not detection (cleaner architecture)
 * Updated: ENHANCED - Pass user's instrument settings to CalibrationManager for accurate calibration
 */

import { ExerciseLoader } from './core/exerciseLoader.js';
import { NotationRenderer } from './core/notationRenderer.js';
import { PlaybackEngine } from './core/playbackEngine.js';
import UIManager from './core/uiManager.js';
import { SettingsManager } from './utils/settingsManager.js';
import { Storage } from './core/storage.js';
import { STORAGE_KEYS } from './utils/constants.js';
import { PitchDetector } from './core/pitchDetector.js';
import { Analyzer } from './core/analyzer.js';
import { CalibrationManager } from './core/calibrationManager.js';
import { DrumMachine } from './core/drumMachine.js';

class App {
  constructor() {
    this.loader = new ExerciseLoader();
    this.renderer = null;
    this.engine = null;
    this.uiManager = null;
    this.audioActivated = false;
    this.currentExercise = null;
    this.notificationTimeout = null;

    // Jamming mode components
    this.drumMachine = null;
    this.jammingModeActive = false;
    
    // Practice mode components
    this.pitchDetector = null;
    this.analyzer = null;
    this.practiceModeEnabled = false;
    this.pitchStream = [];
    this.currentAnalysis = null;
    
    // Session tracking for relative timestamps - FIXED: Use actual playback start time
    this.sessionStartTime = null;  // Will be set when PlaybackEngine actually starts
    this.playbackStartTime = null; // ACTUAL playback start time from PlaybackEngine
    this.isRecording = false;
    
    // NEW: Settings management
    this.settingsManager = new SettingsManager();
    this.settings = this.settingsManager.loadSettings();
    
    // NEW: Calibration system
    this.calibrationManager = null;
    
    console.log('🚀 App constructor - loaded settings:', this.settings);
    console.log('📊 Reference pitch value:', this.settings.referencePitch);
    console.log('🎛️  Smoothing value:', this.settings.tunerSmoothing);
    
    // FIXED: Initialize practice mode BEFORE UI to prevent null reference errors
    this.initializePracticeMode();
    this.initializeUIManager();
    this.initializeUI();
    
    // NEW: Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // NEW: Setup settings panel (after practice mode is initialized)
    this.setupSettingsPanel();
  }
  
  /**
   * Initialize UIManager for tab navigation and tuner
   */
  async initializeUIManager() {
    try {
      this.uiManager = new UIManager();
      await this.uiManager.init();
      
      // Apply settings AFTER UIManager is ready
      console.log('🎯 UIManager initialized, now applying settings...');
      this.applySettings();
      
      // Subscribe to UIManager events
      this.uiManager.on('tabChanged', (data) => {
        console.log(`UIManager: Switched to ${data.currentTab} tab`);
        // Note: The direct switchTab call in app.js will handle the actual tab switching
        // This event is just for logging/UIManager coordination
      });
      
      // Add error handling for exercise loading
      this.loader.on('exercise:error', (error) => {
        console.error('Exercise loading error:', error);
        this.showNotification(`Failed to load exercise: ${error.error}`, 'error');
      });
      
      // Subscribe to UI Manager events
      this.uiManager.on('ui:initialized', () => {
        console.log('UI Manager initialized successfully');
        this.showNotification('Application ready', 'success');
      });
      
      this.uiManager.on('ui:tabChanged', (data) => {
        console.log(`Switched to ${data.tab} tab`);
        this.handleTabChanged(data.tab);
      });
      
      this.uiManager.on('tuner:started', () => {
        console.log('Tuner started');
        this.showNotification('Tuner activated - microphone permission required', 'info');
      });
      
      this.uiManager.on('tuner:stopped', () => {
        console.log('Tuner stopped');
      });
      
      this.uiManager.on('tuner:error', (error) => {
        console.error('Tuner error:', error);
        this.showNotification('Tuner error: ' + error.message, 'error');
      });
      
      this.uiManager.on('tuner:settingChanged', (data) => {
        // Sync tuner changes back to SettingsManager
        this.saveSetting(data.settingKey, data.value);
        console.log(`Tuner setting changed: ${data.settingKey} = ${data.value}`);
        this.showNotification(`Tuner ${data.settingKey} updated to ${data.value}`, 'info');
      });
      
    } catch (error) {
      console.error('Failed to initialize UI Manager:', error);
      this.showNotification('Failed to initialize interface: ' + error.message, 'error');
    }
  }
  
  /**
   * Initialize practice mode components
   */
  async initializePracticeMode() {
    try {
      // Initialize Analyzer with current settings
      this.analyzer = new Analyzer({
        preset: this.settings.difficulty || 'NORMAL',
        pitchTolerance: this.settings.pitchTolerance || 50,
        timingTolerance: this.settings.timingTolerance || 100
      });
      
      // Subscribe to Analyzer events
      this.analyzer.on('analysis:complete', (data) => {
        this.handleAnalysisComplete(data.result);
      });
      
      this.analyzer.on('analysis:error', (data) => {
        console.error('Analysis error:', data.error);
        this.showNotification('Analysis error: ' + data.error, 'error');
      });
      
      // Initialize PitchDetector (will be started when user enables practice mode)
      this.pitchDetector = new PitchDetector(this.getAudioContext(), {
        confidenceThreshold: 0.8,  // Increased from 0.6 for better accuracy
        noiseThreshold: -45,       // More aggressive noise filtering
        minFrequency: 80,
        maxFrequency: 1000
      });
      
      // Initialize Calibration Manager with pitch detector and settings
      this.calibrationManager = new CalibrationManager(this.settingsManager, this.pitchDetector);
      
      // Subscribe to Calibration Manager events
      this.calibrationManager.on('calibration:started', () => {
        this.showNotification('Starting audio calibration...', 'info');
      });
      
      this.calibrationManager.on('calibration:tone_playing', (data) => {
        console.log('🎵 Calibration tone playing:', data);
      });
      
      this.calibrationManager.on('calibration:complete', (data) => {
        if (data.result.success) {
          this.showNotification(`Calibration complete! Latency: ${data.result.measuredLatency}ms`, 'success');
          this.updateCalibrationDisplay();
        } else {
          this.showNotification('Calibration failed: ' + data.result.error, 'error');
        }
      });
      
      this.calibrationManager.on('calibration:failed', (data) => {
        this.showNotification('Calibration failed: ' + data.result.error, 'error');
      });
      
      // Subscribe to PitchDetector events
      this.pitchDetector.on('pitch:detected', (data) => {
        this.handlePitchDetected(data);
      });
      
      this.pitchDetector.on('pitch:silence', (data) => {
        this.handlePitchSilence(data);
      });
      
      console.log('🎯 Practice mode components initialized successfully');
    } catch (error) {
      console.error('Failed to initialize practice mode components:', error);
      this.showNotification('Failed to initialize practice mode: ' + error.message, 'error');
    }
  }
  
  /**
   * Get AudioContext (create if needed)
   */
  getAudioContext() {
    if (!this._audioContext) {
      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this._audioContext;
  }
  
  /**
   * Start audio latency calibration - ENHANCED: Pass current instrument settings for accurate measurement
   */
  async startCalibration() {
    if (!this.calibrationManager) {
      this.showNotification('Calibration not available', 'error');
      return;
    }
    
    try {
      // ENHANCED: Get current instrument settings from user interface
      const currentInstrumentSelect = document.getElementById('instrumentSelect');
      const currentInstrumentMode = document.getElementById('instrumentMode');
      
      const currentInstrumentSettings = {
        instrument: currentInstrumentSelect ? currentInstrumentSelect.value : this.settings.instrument,
        mode: currentInstrumentMode ? currentInstrumentMode.value : this.settings.instrumentMode
      };
      
      console.log('🎯 Starting calibration with current user settings:', currentInstrumentSettings);
      
      // ENHANCED: Pass current instrument settings to CalibrationManager
      this.calibrationManager.setUserInstrumentSettings(currentInstrumentSettings);
      
      // Ensure audio context is available
      const audioContext = this.getAudioContext();
      this.calibrationManager.setAudioContext(audioContext);
      
      // Start calibration process
      const result = await this.calibrationManager.startCalibration();
      
      if (result.success) {
        console.log('✅ Calibration successful with user settings:', result);
        // Update practice mode if active
        if (this.practiceModeEnabled) {
          console.log('🔄 Applying new latency to practice mode');
        }
      }
      
    } catch (error) {
      console.error('Calibration error:', error);
      this.showNotification('Calibration failed: ' + error.message, 'error');
    }
  }
  
  /**
   * Reset calibration to defaults
   */
  resetCalibration() {
    if (!this.calibrationManager) {
      this.showNotification('Calibration not available', 'error');
      return;
    }
    
    this.calibrationManager.resetCalibration();
    this.updateCalibrationDisplay();
    this.showNotification('Calibration reset to defaults', 'info');
  }
  
  /**
   * Update calibration status display
   */
  updateCalibrationDisplay() {
    if (!this.calibrationManager) return;
    
    const status = this.calibrationManager.getCalibrationStatus();
    
    // Update practice tab calibration info
    const latencyDisplay = document.getElementById('calibration-latency-display');
    const calibrationStatus = document.getElementById('calibration-status');
    const calibrateBtn = document.getElementById('calibrate-latency-btn');
    const resetBtn = document.getElementById('reset-calibration-btn');
    
    if (latencyDisplay) {
      latencyDisplay.textContent = `${status.effectiveLatency}ms`;
    }
    
    if (calibrationStatus) {
      const statusText = status.hasCalibrated ? 'Calibrated' : 'Default';
      const className = status.hasCalibrated ? 'calibrated' : 'default';
      calibrationStatus.textContent = statusText;
      calibrationStatus.className = `calibration-status ${className}`;
    }
    
    if (calibrateBtn) {
      calibrateBtn.disabled = status.isCalibrating;
    }
    
    if (resetBtn) {
      resetBtn.disabled = !status.hasCalibrated;
    }
  }
  
  /**
   * Enable/disable practice mode
   */
  async togglePracticeMode() {
    // FIXED: Add null check for pitchDetector
    if (!this.pitchDetector) {
      console.error('Practice mode not initialized yet');
      const micToggle = document.getElementById('practice-microphone-toggle');
      const micStatus = document.getElementById('practice-mic-status');
      if (micToggle) micToggle.checked = false;
      if (micStatus) {
        micStatus.textContent = 'Practice mode initializing...';
        micStatus.className = 'mic-status error';
      }
      this.showNotification('Practice mode is still initializing, please try again', 'warning');
      return;
    }

    const micToggle = document.getElementById('practice-microphone-toggle');
    const micStatus = document.getElementById('practice-mic-status');
    
    if (!micToggle.checked) {
      // Disable practice mode
      this.practiceModeEnabled = false;
      this.pitchStream = [];
      if (this.pitchDetector && this.pitchDetector.getState().isRunning) {
        this.pitchDetector.stop();
      }
      micStatus.textContent = 'Microphone disabled';
      micStatus.className = 'mic-status disabled';
      this.showNotification('Practice mode disabled', 'info');
      return;
    }
    
    // Enable practice mode
    try {
      this.practiceModeEnabled = true;
      this.pitchStream = [];
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      // Start pitch detection
      await this.pitchDetector.start(stream);
      
      // Set audio context for calibration
      if (this.calibrationManager) {
        this.calibrationManager.setAudioContext(this.getAudioContext());
      }
      
      micStatus.textContent = 'Microphone enabled';
      micStatus.className = 'mic-status enabled';
      this.showNotification('Practice mode enabled - start playing!', 'success');
      
    } catch (error) {
      console.error('Failed to enable practice mode:', error);
      micToggle.checked = false;
      micStatus.textContent = 'Microphone access denied';
      micStatus.className = 'mic-status error';
      this.showNotification('Microphone access required for practice mode', 'error');
    }
  }
  
  /**
   * Enable/disable tuner mode
   */
  async toggleTunerMode() {
    // FIXED: Add null check for pitchDetector
    if (!this.pitchDetector) {
      console.error('Practice mode components not initialized yet');
      const micToggle = document.getElementById('tuner-microphone-toggle');
      const micStatus = document.getElementById('tuner-mic-status');
      if (micToggle) micToggle.checked = false;
      if (micStatus) {
        micStatus.textContent = 'Tuner initializing...';
        micStatus.className = 'mic-status error';
      }
      this.showNotification('Tuner is still initializing, please try again', 'warning');
      return;
    }

    const micToggle = document.getElementById('tuner-microphone-toggle');
    const micStatus = document.getElementById('tuner-mic-status');
    
    if (!micToggle.checked) {
      // Disable tuner mode
      if (this.pitchDetector && this.pitchDetector.getState().isRunning) {
        this.pitchDetector.stop();
      }
      micStatus.textContent = 'Microphone disabled';
      micStatus.className = 'mic-status disabled';
      this.showNotification('Tuner disabled', 'info');
      return;
    }
    
    // Enable tuner mode
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      // Start pitch detection
      await this.pitchDetector.start(stream);
      
      // Set audio context for calibration
      if (this.calibrationManager) {
        this.calibrationManager.setAudioContext(this.getAudioContext());
      }
      
      micStatus.textContent = 'Microphone enabled';
      micStatus.className = 'mic-status enabled';
      this.showNotification('Tuner enabled - start playing!', 'success');
      
    } catch (error) {
      console.error('Failed to enable tuner mode:', error);
      micToggle.checked = false;
      micStatus.textContent = 'Microphone access denied';
      micStatus.className = 'mic-status error';
      this.showNotification('Microphone access required for tuner', 'error');
    }
  }
  
  /**
   * Handle pitch detection events - FIXED: Single compensation point
   */
  handlePitchDetected(data) {
    // Update practice pitch indicator UI
    const noteElement = document.getElementById('practice-current-note');
    const freqElement = document.getElementById('practice-frequency');
    const centsElement = document.getElementById('practice-cents');

    if (noteElement) noteElement.textContent = data.noteName;
    if (freqElement) freqElement.textContent = `${data.frequency.toFixed(1)} Hz`;
    if (centsElement) {
      const cents = data.centsDeviation.toFixed(1);
      centsElement.textContent = `${cents > 0 ? '+' : ''}${cents} cents`;
      centsElement.className = Math.abs(data.centsDeviation) < 10 ? 'correct' : 'incorrect';
    }

    // Update tuner UI if tuner is active
    const tunerFreqElement = document.getElementById('tuner-freq-value');
    const tunerNoteElement = document.getElementById('tuner-note-name');
    const tunerCentsElement = document.getElementById('tuner-cents-value');
    const tunerNeedle = document.getElementById('tuner-needle');
    const tunerColorIndicator = document.getElementById('tuner-color-indicator');
    const tunerConfidenceFill = document.getElementById('tuner-confidence-fill');

    if (tunerFreqElement) {
      tunerFreqElement.textContent = data.frequency.toFixed(1);
    }

    if (tunerNoteElement) {
      tunerNoteElement.textContent = data.noteName;
    }

    if (tunerCentsElement) {
      const cents = Math.abs(data.centsDeviation).toFixed(1);
      tunerCentsElement.textContent = cents;
    }

    // Update needle position (-45 to +45 degrees based on cents deviation)
    if (tunerNeedle) {
      const angle = Math.max(-45, Math.min(45, data.centsDeviation));
      tunerNeedle.setAttribute('transform', `rotate(${angle} 150 125)`);
    }

    // Update color indicator and confidence
    if (tunerColorIndicator) {
      let color = '#EF4444'; // red for out of tune
      if (Math.abs(data.centsDeviation) < 5) {
        color = '#10B981'; // green for in tune
      } else if (Math.abs(data.centsDeviation) < 20) {
        color = '#F59E0B'; // orange for close
      }
      tunerColorIndicator.style.backgroundColor = color;
    }

    if (tunerConfidenceFill) {
      tunerConfidenceFill.style.width = `${(data.confidence * 100).toFixed(0)}%`;
    }

    // Store pitch event for analysis (practice mode only)
    if (this.practiceModeEnabled) {
      if (this.isRecording && this.sessionStartTime) {
        // Convert absolute to relative time (NO compensation here)
        const relativeTime = data.timestamp - this.sessionStartTime;

        // Get latency for reference (will be applied during analysis)
        const calibratedLatency = this.calibrationManager
          ? this.calibrationManager.getCalibrationStatus().effectiveLatency
          : (data.estimatedLatency || 0);

        console.log(`🎵 Pitch recorded: ${data.noteName} at relative time ${relativeTime}ms (raw, latency will be applied during analysis: ${calibratedLatency}ms)`);
        console.log(`   └─ Detection timestamp: ${data.timestamp}ms, Session start: ${this.sessionStartTime}ms, Playback start: ${this.playbackStartTime}ms`);

        // Store with RAW relative timestamp - analyzer will handle compensation
        this.pitchStream.push({
          type: 'monophonic',
          midi: data.midi,
          frequency: data.frequency,
          confidence: data.confidence,
          timestamp: relativeTime, // RAW relative time, no compensation
          sessionStartTime: this.sessionStartTime,
          playbackStartTime: this.playbackStartTime,
          detectionTimestamp: data.timestamp,
          isRecording: this.isRecording
        });
      }

      // Update real-time feedback
      this.updateRealTimeFeedback(data);
    }
  }
  
  /**
   * Handle pitch silence events
   */
  handlePitchSilence(data) {
    // Update pitch indicator to show silence
    const noteElement = document.getElementById('practice-current-note');
    const freqElement = document.getElementById('practice-frequency');
    const centsElement = document.getElementById('practice-cents');
    
    if (noteElement) noteElement.textContent = '--';
    if (freqElement) freqElement.textContent = '-- Hz';
    if (centsElement) {
      centsElement.textContent = '0 cents';
      centsElement.className = '';
    }
  }
  
  /**
   * Update real-time feedback display
   */
  updateRealTimeFeedback(pitchData) {
    const feedbackNote = document.getElementById('feedback-current-note');
    const feedbackStatus = document.getElementById('feedback-status');
    
    if (feedbackNote) {
      feedbackNote.textContent = pitchData.noteName;
    }
    
    if (feedbackStatus) {
      const cents = pitchData.centsDeviation;
      if (Math.abs(cents) < 5) {
        feedbackStatus.textContent = 'Perfect pitch!';
        feedbackStatus.className = 'feedback-status perfect';
      } else if (Math.abs(cents) < 20) {
        feedbackStatus.textContent = cents > 0 ? 'A bit sharp' : 'A bit flat';
        feedbackStatus.className = 'feedback-status close';
      } else {
        feedbackStatus.textContent = 'Need to adjust';
        feedbackStatus.className = 'feedback-status far';
      }
    }
  }
  
  /**
   * Handle analysis completion
   */
  handleAnalysisComplete(result) {
    console.log('✅ ANALYSIS COMPLETE - Detailed Results:');
    console.log('📊 Overall Results:', {
      accuracy: result.aggregate.correctPercentage + '%',
      timing: result.aggregate.timingConsistencyScore + '%',
      notes: `${result.aggregate.notesCorrect}/${result.aggregate.totalNotes}`,
      averageTimingDeviation: result.aggregate.averageTimingDeviation + 'ms'
    });
    
    // Generate enhanced detailed report
    this.generateDetailedAnalysisReport(result);
    
    this.currentAnalysis = result;
    
    // Update score display
    this.updateScoreDisplay(result.aggregate);
    
    // Show post-playback summary if playback just completed
    if (this.engine && this.engine.getState() === 'stopped') {
      this.showPlaybackSummary(result);
    }
  }
  
  /**
   * Generate enhanced detailed analysis report
   */
  generateDetailedAnalysisReport(result) {
    console.log('\n📊 DETAILED PRACTICE ANALYSIS:');
    
    // Create header
    const header = '┌─────────────────────────────────────────────────────────────────────────────────┐\n' +
                  '│ # │ Expected │ Time │ Detected │ Raw Time │ Adj Time │ Δ Timing │ Pitch │ Status │\n' +
                  '├───┼──────────┼──────┼──────────┼──────────┼──────────┼──────────┼───────┼────────┤';
    console.log(header);
    
    // Generate HTML report for UI display
    this.displayAnalysisReportOnScreen(result);
  }

  /**
   * Display analysis report in the practice tab
   * @private
   */
  displayAnalysisReportOnScreen(result) {
    // Get the analysis report card
    const reportCard = document.getElementById('analysis-report');
    if (!reportCard) {
      console.error('Analysis report card not found in DOM');
      return;
    }

    // Generate table rows and summary content
    const tableRows = this.generateAnalysisTableRows(result);
    const summaryContent = this.generateAnalysisSummaryContent(result);
    const recommendationsContent = this.generateAnalysisRecommendationsContent(result);
    const systemInfoContent = this.generateAnalysisSystemInfoContent(result);
    
    // Populate the table
    const tableBody = document.getElementById('analysis-table-body');
    if (tableBody) {
      tableBody.innerHTML = tableRows;
    }
    
    // Populate summary sections
    const summaryElement = document.getElementById('analysis-summary-content');
    if (summaryElement) {
      summaryElement.innerHTML = summaryContent;
    }
    
    const recommendationsElement = document.getElementById('analysis-recommendations');
    if (recommendationsElement) {
      recommendationsElement.innerHTML = recommendationsContent;
    }
    
    const systemInfoElement = document.getElementById('analysis-system-info');
    if (systemInfoElement) {
      systemInfoElement.innerHTML = systemInfoContent;
    }
    
    // Show the report card
    reportCard.style.display = 'block';
    
    // Scroll to the analysis report
    reportCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Generate analysis table rows for the new HTML table
   * @private
   */
  generateAnalysisTableRows(result) {
    let rows = '';
    
    // Process each note
    result.perNote.forEach((note, index) => {
      const noteNumber = (index + 1).toString().padStart(2);
      const expectedNote = this.midiToNoteName(note.expectedMidi);
      const expectedTime = note.expectedTimestamp.toString().padStart(4);
      const detectedNote = note.detectedMidi !== null ? this.midiToNoteName(note.detectedMidi) : '---';
      const detectedMidiStr = note.detectedMidi !== null ? note.detectedMidi.toString() : '---';
      const rawTime = note.detectedTimestampRaw !== null ? note.detectedTimestampRaw + 'ms' : '---';
      const adjTime = note.detectedTimestamp !== null ? note.detectedTimestamp + 'ms' : '---';
      
      let timingInfo = '---';
      let statusClass = 'status-missed';
      let statusText = 'Missed';
      let pitchClass = '';
      let pitchStatus = '---';
      
      if (note.detectedMidi !== null) {
        // Calculate timing details
        timingInfo = `${note.timingDeviation > 0 ? '+' : ''}${note.timingDeviation}ms`;
        
        // Determine status and CSS classes (UPDATED for continuous scoring)
      if (note.classification === 'PERFECT') {
        statusClass = 'status-perfect';
        statusText = '🎯 Perfect';
      } else if (note.classification === 'GREAT') {
        statusClass = 'status-great';
        statusText = '⭐ Great';
      } else if (note.classification === 'GOOD') {
        statusClass = 'status-good';
        statusText = '✅ Good';
      } else if (note.classification === 'OK') {
        statusClass = 'status-ok';
        statusText = '⚠️ OK';
      } else if (note.classification === 'POOR') {
        statusClass = 'status-poor';
        statusText = '❌ Poor';
      } else if (note.classification === 'MISSED') {
        statusClass = 'status-missed';
        statusText = '❌ Missed';
      }
        
        // Pitch accuracy
        pitchClass = note.pitchCorrect ? 'pitch-correct' : 'pitch-incorrect';
        if (note.pitchDeviation === 0) {
          pitchClass += ' pitch-perfect';
          pitchStatus = '<span class="check-indicator">✓</span>0¢';
        } else {
          pitchStatus = note.pitchCorrect ? `✅${note.pitchDeviation}¢` : `❌${note.pitchDeviation}¢`;
        }
      }
      
      // Build table row with proper CSS classes
      const row = `
        <tr>
          <td class="note-cell">${noteNumber}</td>
          <td class="note-cell">${expectedNote} (${note.expectedMidi})</td>
          <td class="time-cell">${expectedTime}ms</td>
          <td class="note-cell">${detectedNote} ${detectedMidiStr !== '---' ? `(${detectedMidiStr})` : ''}</td>
          <td class="time-cell">${rawTime}</td>
          <td class="time-cell">${adjTime}</td>
          <td class="timing-cell">${timingInfo}</td>
          <td class="pitch-cell ${pitchClass}">${pitchStatus}</td>
          <td class="status-cell ${statusClass}">${statusText}</td>
        </tr>
      `;
      rows += row;
    });
    
    return rows;
  }

  /**
   * Generate analysis summary content for the new card layout with continuous scoring
   * @private
   */
  generateAnalysisSummaryContent(result) {
    const analysisSummary = {
      notesPlayed: 0,
      perfect: 0,
      great: 0,
      good: 0,
      ok: 0,
      poor: 0,
      missed: 0,
      totalScore: 0,
      maxScore: 0
    };

    result.perNote.forEach((note) => {
      if (note.classification !== 'MISSED') {
        analysisSummary.notesPlayed++;

        // Count by new classification system
        switch (note.classification) {
          case 'PERFECT':
            analysisSummary.perfect++;
            break;
          case 'GREAT':
            analysisSummary.great++;
            break;
          case 'GOOD':
            analysisSummary.good++;
            break;
          case 'OK':
            analysisSummary.ok++;
            break;
          case 'POOR':
            analysisSummary.poor++;
            break;
        }

        // Accumulate continuous scores
        analysisSummary.totalScore += note.score || 0;
        analysisSummary.maxScore += 100;
      } else {
        analysisSummary.missed++;
      }
    });

    const overallAccuracy = analysisSummary.maxScore > 0 ?
      Math.round((analysisSummary.totalScore / analysisSummary.maxScore) * 100) : 0;

    let content = '';

    // Overall performance
    content += `
      <div class="metric-item">
        <span class="metric-label">Overall Score:</span>
        <span class="metric-value">${overallAccuracy}% (${result.aggregate.grade})</span>
      </div>
    `;

    content += `
      <div class="metric-item">
        <span class="metric-label">Notes Played:</span>
        <span class="metric-value">${analysisSummary.notesPlayed}/${result.aggregate.totalNotes}</span>
      </div>
    `;

    // Performance breakdown
    if (analysisSummary.perfect > 0) {
      content += `
        <div class="metric-item">
          <span class="metric-label">Perfect Notes:</span>
          <span class="metric-value">${analysisSummary.perfect} (95-100%)</span>
        </div>
      `;
    }

    if (analysisSummary.great > 0) {
      content += `
        <div class="metric-item">
          <span class="metric-label">Great Notes:</span>
          <span class="metric-value">${analysisSummary.great} (80-95%)</span>
        </div>
      `;
    }

    if (analysisSummary.good > 0) {
      content += `
        <div class="metric-item">
          <span class="metric-label">Good Notes:</span>
          <span class="metric-value">${analysisSummary.good} (60-80%)</span>
        </div>
      `;
    }

    if (analysisSummary.ok > 0) {
      content += `
        <div class="metric-item">
          <span class="metric-label">OK Notes:</span>
          <span class="metric-value">${analysisSummary.ok} (40-60%)</span>
        </div>
      `;
    }

    if (analysisSummary.poor > 0) {
      content += `
        <div class="metric-item">
          <span class="metric-label">Poor Notes:</span>
          <span class="metric-value">${analysisSummary.poor} (<40%)</span>
        </div>
      `;
    }

    if (analysisSummary.missed > 0) {
      content += `
        <div class="metric-item">
          <span class="metric-label">Missed Notes:</span>
          <span class="metric-value">${analysisSummary.missed}</span>
        </div>
      `;
    }

    // Timing consistency
    content += `
      <div class="metric-item">
        <span class="metric-label">Timing Consistency:</span>
        <span class="metric-value">${result.aggregate.timingConsistencyScore}%</span>
      </div>
    `;

    return content;
  }

  /**
   * Generate analysis recommendations content
   * @private
   */
  generateAnalysisRecommendationsContent(result) {
    const analysisSummary = {
      notesPlayed: 0,
      perfectTiming: 0,
      correctPitch: 0,
      totalTimingError: 0,
      timingErrors: [],
      missedNotes: [],
      lateNotes: [],
      earlyNotes: []
    };
    
    result.perNote.forEach((note) => {
      if (note.detectedMidi !== null) {
        analysisSummary.notesPlayed++;
        
        if (note.classification === 'CORRECT') {
          analysisSummary.perfectTiming++;
        } else if (note.classification === 'WRONG_TIMING') {
          analysisSummary.timingErrors.push(Math.abs(note.timingDeviation));
          if (note.timingDeviation > 0) {
            analysisSummary.lateNotes.push((analysisSummary.notesPlayed).toString());
          } else {
            analysisSummary.earlyNotes.push((analysisSummary.notesPlayed).toString());
          }
        }
        
        if (note.pitchCorrect) {
          analysisSummary.correctPitch++;
        }
      }
    });
    
    const avgTimingError = analysisSummary.notesPlayed > 0 ? 
      analysisSummary.totalTimingError / analysisSummary.notesPlayed : 0;
    
    let content = '';
    
    // Generate recommendations based on performance
    const recommendations = [];
    
    if (avgTimingError > 100) {
      recommendations.push('Work on timing consistency (reduce average timing error)');
    }
    
    if (analysisSummary.earlyNotes.length > result.aggregate.totalNotes * 0.3) {
      recommendations.push('Focus on not rushing - work on steady timing');
    }
    
    if (analysisSummary.lateNotes.length > result.aggregate.totalNotes * 0.3) {
      recommendations.push('Focus on not dragging - maintain consistent tempo');
    }
    
    if (analysisSummary.missedNotes.length > result.aggregate.totalNotes * 0.3) {
      recommendations.push('Focus on note consistency (too many missed notes)');
    }
    
    if (analysisSummary.correctPitch < analysisSummary.notesPlayed * 0.8) {
      recommendations.push('Work on pitch accuracy (intonation issues)');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Great job! Keep practicing to maintain consistency');
    }
    
    recommendations.push('Practice with metronome to improve timing');
    
    recommendations.forEach(rec => {
      content += `
        <div class="recommendation-item">
          <span class="recommendation-icon">💡</span>
          <span class="recommendation-text">${rec}</span>
        </div>
      `;
    });
    
    return content;
  }

  /**
   * Generate analysis system info content
   * @private
   */
  generateAnalysisSystemInfoContent(result) {
    let content = '';
    
    // Show latency compensation info
    const calibratedLatency = this.calibrationManager
      ? this.calibrationManager.getCalibrationStatus().effectiveLatency
      : 0;
    
    content += `
      <div class="system-item">
        <span class="system-label">Latency Compensation:</span>
        <span class="system-value">${calibratedLatency}ms applied</span>
      </div>
    `;
    
    content += `
      <div class="system-item">
        <span class="system-label">Analysis Method:</span>
        <span class="system-value">Dual DTW Alignment</span>
      </div>
    `;
    
    content += `
      <div class="system-item">
        <span class="system-label">Accuracy Score:</span>
        <span class="system-value">${result.aggregate.correctPercentage}%</span>
      </div>
    `;
    
    content += `
      <div class="system-item">
        <span class="system-label">Timing Score:</span>
        <span class="system-value">${result.aggregate.timingConsistencyScore}%</span>
      </div>
    `;
    
    // NEW: Add BPM and Song Title from tolerances object
    if (result.tolerances) {
      if (result.tolerances.tempoBpm) {
        content += `
          <div class="system-item">
            <span class="system-label">BPM:</span>
            <span class="system-value">${result.tolerances.tempoBpm} BPM</span>
          </div>
        `;
      }
      
      if (result.tolerances.songTitle) {
        content += `
          <div class="system-item">
            <span class="system-label">Song Title:</span>
            <span class="system-value">${result.tolerances.songTitle}</span>
          </div>
        `;
      }
    }
    
    return content;
  }



  
  /**
   * Convert MIDI number to note name
   */
  midiToNoteName(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const note = noteNames[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${note}${octave}`;
  }
  
  /**
   * Update score display with analysis results
   */
  updateScoreDisplay(aggregate) {
    const accuracyElement = document.getElementById('accuracyScore');
    const timingElement = document.getElementById('timingScore');
    const notesElement = document.getElementById('notesScore');
    
    if (accuracyElement) {
      accuracyElement.textContent = `${aggregate.correctPercentage}%`;
    }
    
    if (timingElement) {
      timingElement.textContent = `${aggregate.timingConsistencyScore}%`;
    }
    
    if (notesElement) {
      const totalNotes = aggregate.totalNotes;
      const correctNotes = aggregate.notesCorrect;
      notesElement.textContent = `${correctNotes}/${totalNotes}`;
    }
  }
  
  /**
   * Show post-playback summary
   */
  showPlaybackSummary(result) {
    const { aggregate } = result;
    
    const message = `Practice Session Complete!\n` +
                   `Accuracy: ${aggregate.correctPercentage}%\n` +
                   `Notes: ${aggregate.notesCorrect}/${aggregate.totalNotes}\n` +
                   `Timing: ${aggregate.timingConsistencyScore}%`;
    
    this.showNotification(message, 'success');
  }
  
  /**
   * Run analysis on current practice session - Enhanced with extensive logging
   */
  async runAnalysis() {
    if (!this.currentExercise || this.pitchStream.length === 0) {
      console.log('⚠️  Analysis skipped: No exercise loaded or no pitch data to analyze');
      return;
    }

    console.log('🔍 STARTING ANALYSIS - Enhanced Debug Output');
    console.log('📋 Analysis Parameters:');
    console.log('- Exercise loaded:', !!this.currentExercise);
    console.log('- Pitch stream length:', this.pitchStream.length);
    console.log('- Session start time:', this.sessionStartTime);
    console.log('- Recording state:', this.isRecording);

    // ✅ FIXED: Get filtered timeline from ExerciseLoader (moved outside try block)
    const referenceTimeline = this.loader.getAnalysisTimeline(this.currentExercise);

    try {

      console.log('📊 Reference Timeline (Filtered):');
      console.log('- Reference notes count:', referenceTimeline.length);
      console.log('- First reference note:', referenceTimeline[0]);
      console.log('- Last reference note:', referenceTimeline[referenceTimeline.length - 1]);

      console.log('🎵 Detected Pitch Stream:');
      console.log('- Detected events count:', this.pitchStream.length);
      console.log('- First detected event:', this.pitchStream[0]);
      console.log('- Last detected event:', this.pitchStream[this.pitchStream.length - 1]);

      // Get calibrated latency for analysis
      const calibratedLatency = this.calibrationManager
        ? this.calibrationManager.getCalibrationStatus().effectiveLatency
        : 0;

      console.log('🕐 Timing Analysis:');
      if (this.sessionStartTime) {
        const sessionDuration = Date.now() - this.sessionStartTime;
        console.log('- Session duration:', sessionDuration + 'ms');
        console.log('- Session start time:', this.sessionStartTime + 'ms');
        console.log('- Playback start time:', this.playbackStartTime + 'ms');
        console.log('- Using RAW relative timestamps with analysis-time compensation');
      } else {
        console.log('- No session start time - using raw timestamps directly');
      }

      // DIRECT MEDIAN OFFSET TIMING CORRECTION
      // Calculate median timing offset from all detected notes and apply it
      let dynamicLatencyOffset = calibratedLatency;
      const medianOffset = this._calculateMedianTimingOffset(referenceTimeline, this.pitchStream);

      if (medianOffset !== null) {
        // Apply median offset as additional latency compensation
        dynamicLatencyOffset = calibratedLatency + medianOffset;
        console.log(`📏 MEDIAN TIMING OFFSET CALCULATION:`);
        console.log(`   Median offset: ${medianOffset}ms`);
        console.log(`   Calibrated latency: ${calibratedLatency}ms`);
        console.log(`   Total applied: ${dynamicLatencyOffset}ms`);
      }

      console.log('🔧 Analysis Configuration:');
      console.log('- Applying latency offset:', dynamicLatencyOffset + 'ms');
      console.log('- This will shift detected timestamps FORWARD to account for speaker→mic delay');

      // Add detailed pitch stream timing analysis
      console.log('📊 Pitch Stream Timing Analysis:');
      this.pitchStream.forEach((event, index) => {
        const absoluteTime = this.sessionStartTime + event.timestamp;
        const timeFromPlaybackStart = absoluteTime - this.playbackStartTime;
        console.log(`  Event ${index + 1}: relative=${event.timestamp}ms, absolute=${absoluteTime}ms, fromPlaybackStart=${timeFromPlaybackStart}ms`);
      });

      // Run analysis with dynamic latency offset and tempo-aware tolerances
      await this.analyzer.analyze(referenceTimeline, this.pitchStream, {
        latencyOffset: dynamicLatencyOffset,
        tempo: this.currentExercise.tempo,
        difficulty: this.settings.difficulty
      });

    } catch (error) {
      console.error('❌ Analysis failed with error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        referenceTimelineLength: referenceTimeline?.length,
        pitchStreamLength: this.pitchStream.length
      });
      this.showNotification('Analysis failed: ' + error.message, 'error');
    }
  }

  /**
   * Detect if we're in speaker-to-microphone testing mode
   * @private
   * @param {Array} referenceTimeline - Expected notes
   * @param {Array} pitchStream - Detected pitches
   * @returns {boolean} True if speaker-to-mic testing detected
   */
  _detectSpeakerToMicTesting(referenceTimeline, pitchStream) {
    if (!referenceTimeline.length || !pitchStream.length) return false;

    // Check if pitch detection is nearly perfect (characteristic of speaker-to-mic)
    // FIXED: Use proper pitch deviation calculation - compare each detected pitch to its closest reference note
    const pitchDeviations = [];
    pitchStream.forEach(event => {
      const refNote = this._findClosestReferenceNote(event.timestamp, referenceTimeline);
      if (refNote) {
        const deviation = Math.abs(event.midi - refNote.midi);
        pitchDeviations.push(deviation);
      }
    });

    const avgPitchDeviation = pitchDeviations.length > 0
      ? pitchDeviations.reduce((a, b) => a + b, 0) / pitchDeviations.length
      : 0;

    // Speaker-to-mic typically has very low pitch deviation (< 0.5 semitone)
    const perfectPitch = avgPitchDeviation < 0.5;

    // Check if timing is consistently offset (not random like human playing)
    const timingDeviations = pitchStream.map(event => {
      const refNote = this._findClosestReferenceNote(event.timestamp, referenceTimeline);
      return refNote ? event.timestamp - refNote.timestamp : 0;
    }).filter(dev => dev !== 0);

    const avgTimingDeviation = timingDeviations.length > 0
      ? timingDeviations.reduce((a, b) => a + b, 0) / timingDeviations.length
      : 0;

    const timingStdDev = timingDeviations.length > 0 ? Math.sqrt(
      timingDeviations.reduce((sum, dev) => sum + Math.pow(dev - avgTimingDeviation, 2), 0) / timingDeviations.length
    ) : 0;

    // Speaker-to-mic has very consistent timing offset (low std deviation)
    const consistentTiming = timingStdDev < 100; // Less than 100ms variation (relaxed from 50ms)

    // ADDITIONAL CHECK: If we have very consistent perfect pitch (0.0-0.1 semitone), force speaker-to-mic detection
    const extremelyPerfectPitch = avgPitchDeviation < 0.1;

    console.log('🔍 Speaker-to-Mic Detection:', {
      avgPitchDeviation: avgPitchDeviation.toFixed(3) + ' semitones avg deviation',
      perfectPitch: perfectPitch,
      extremelyPerfectPitch: extremelyPerfectPitch,
      consistentTiming: consistentTiming + ` (${timingStdDev.toFixed(0)}ms std dev)`,
      sampleCount: pitchDeviations.length,
      isSpeakerToMic: (perfectPitch && consistentTiming) || extremelyPerfectPitch
    });

    // Force speaker-to-mic detection for extremely perfect pitch data
    return (perfectPitch && consistentTiming) || extremelyPerfectPitch;
  }

  /**
   * Calculate optimal latency offset for speaker-to-microphone testing
   * @private
   * @param {Array} referenceTimeline - Expected notes
   * @param {Array} pitchStream - Detected pitches
   * @returns {number} Optimal latency offset in milliseconds
   */
  _calculateSpeakerToMicOffset(referenceTimeline, pitchStream) {
    const timingOffsets = [];

    // Calculate timing offset for each detected note
    pitchStream.forEach(detected => {
      const refNote = this._findClosestReferenceNote(detected.timestamp, referenceTimeline);
      if (refNote) {
        const offset = detected.timestamp - refNote.timestamp;
        timingOffsets.push(offset);
      }
    });

    if (timingOffsets.length === 0) return 0;

    // Use median to avoid outliers
    timingOffsets.sort((a, b) => a - b);
    const medianOffset = timingOffsets[Math.floor(timingOffsets.length / 2)];

    // Apply some bounds checking
    const boundedOffset = Math.max(-500, Math.min(1000, medianOffset));

    console.log('📏 Speaker-to-Mic Offset Calculation:', {
      sampleCount: timingOffsets.length,
      medianOffset: Math.round(medianOffset) + 'ms',
      boundedOffset: Math.round(boundedOffset) + 'ms',
      range: `${Math.round(Math.min(...timingOffsets))}ms to ${Math.round(Math.max(...timingOffsets))}ms`
    });

    return Math.round(boundedOffset);
  }

  /**
   * Calculate median timing offset from all detected notes using sequential best-fit matching
   * @private
   * @param {Array} referenceTimeline - Expected notes
   * @param {Array} pitchStream - Detected pitches
   * @returns {number|null} Median timing offset in milliseconds, or null if insufficient data
   */
  _calculateMedianTimingOffset(referenceTimeline, pitchStream) {
    if (!referenceTimeline.length || !pitchStream.length) return null;

    const timingOffsets = [];
    const matchedPairs = [];
    const usedDetections = new Set(); // Track used detections to prevent double-matching

    // SEQUENTIAL BEST-FIT MATCHING: Process reference notes in chronological order
    referenceTimeline.forEach(refNote => {
      const noteStart = refNote.timestamp;
      const noteEnd = refNote.timestamp + refNote.duration;
      const timingTolerance = 300; // Increased tolerance for speaker-to-mic

      // Find available detected events that could match this reference note
      const candidates = pitchStream.filter(detected => {
        // Must not have been used for previous notes
        if (usedDetections.has(detected.timestamp)) return false;

        // Must be within temporal window (note duration + tolerance)
        const inTemporalWindow = detected.timestamp >= (noteStart - timingTolerance) &&
                                detected.timestamp <= (noteEnd + timingTolerance);
        // Must match pitch (same MIDI note)
        const pitchMatches = detected.midi === refNote.midi;

        return inTemporalWindow && pitchMatches;
      });

      if (candidates.length > 0) {
        // Find the best candidate (closest to note start, among available)
        const bestCandidate = candidates.reduce((best, current) => {
          const bestDistance = Math.abs(best.timestamp - noteStart);
          const currentDistance = Math.abs(current.timestamp - noteStart);
          return currentDistance < bestDistance ? current : best;
        });

        // Mark this detection as used
        usedDetections.add(bestCandidate.timestamp);

        // Calculate timing offset (detected - expected)
        const offset = bestCandidate.timestamp - refNote.timestamp;
        timingOffsets.push(offset);
        matchedPairs.push({
          refNote: refNote.id,
          detectedTime: bestCandidate.timestamp,
          expectedTime: refNote.timestamp,
          offset: offset,
          midi: refNote.midi
        });
      }
    });

    if (timingOffsets.length < 3) {
      console.log('⚠️ Insufficient timing data for median calculation:', timingOffsets.length, 'samples');
      console.log('   Matched pairs:', matchedPairs.length);
      return null;
    }

    // Sort offsets to find median
    timingOffsets.sort((a, b) => a - b);
    const medianIndex = Math.floor(timingOffsets.length / 2);
    const medianOffset = timingOffsets[medianIndex];

    console.log('📊 TIMING OFFSET ANALYSIS (SEQUENTIAL BEST-FIT):');
    console.log(`   Sample count: ${timingOffsets.length}`);
    console.log(`   Matched pairs: ${matchedPairs.length}`);
    console.log(`   Used detections: ${usedDetections.size}`);
    console.log(`   Range: ${Math.round(Math.min(...timingOffsets))}ms to ${Math.round(Math.max(...timingOffsets))}ms`);
    console.log(`   Median offset: ${Math.round(medianOffset)}ms`);
    console.log(`   Standard deviation: ${Math.round(this._calculateStdDev(timingOffsets))}ms`);

    // Debug: Show all matched pairs
    console.log('   All matches:');
    matchedPairs.forEach(pair => {
      console.log(`     ${pair.refNote}: expected ${pair.expectedTime}ms, detected ${pair.detectedTime}ms, offset ${Math.round(pair.offset)}ms`);
    });

    return Math.round(medianOffset);
  }

  /**
   * Calculate standard deviation of an array of numbers
   * @private
   * @param {Array} values - Array of numbers
   * @returns {number} Standard deviation
   */
  _calculateStdDev(values) {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;

    return Math.sqrt(variance);
  }

  /**
   * Find the closest reference note to a given timestamp
   * @private
   * @param {number} timestamp - Target timestamp
   * @param {Array} referenceTimeline - Reference notes
   * @returns {Object|null} Closest reference note or null
   */
  _findClosestReferenceNote(timestamp, referenceTimeline) {
    if (!referenceTimeline.length) return null;

    let closest = referenceTimeline[0];
    let minDiff = Math.abs(timestamp - closest.timestamp);

    for (const note of referenceTimeline) {
      const diff = Math.abs(timestamp - note.timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = note;
      }
    }

    return closest;
  }
  
  /**
   * Switch to a different tab (direct implementation to fix tab switching)
   */
  switchTab(tabId) {
    console.log('🔄 Switching to tab:', tabId);
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Remove active class from all tab content sections
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    // Add active class to target tab button
    const targetButton = document.querySelector(`[data-tab="${tabId}"]`);
    if (targetButton) {
      targetButton.classList.add('active');
    }
    
    // Show target tab content
    const targetContent = document.getElementById(`${tabId}-tab`);
    if (targetContent) {
      targetContent.classList.add('active');
    }
    
    // Handle tab-specific logic
    this.handleTabChanged(tabId);
    
    // Emit event if UIManager exists - use correct data structure
    if (this.uiManager) {
      this.uiManager.emit('tabChanged', {
        currentTab: tabId,
        previousTab: this.currentTab
      });
    }
  }
  
  /**
   * Handle tab changes
   */
  handleTabChanged(tabName) {
    // Enable/disable practice controls based on tab
    if (tabName === 'practice') {
      // Practice tab is active - update calibration display
      this.updateCalibrationDisplay();

      // Force notation container to redraw if exercise is loaded
      if (this.currentExercise && this.renderer) {
        const container = document.getElementById('notation-container');
        if (container) {
          // Trigger a layout recalculation to ensure SVG is visible
          container.style.display = 'block';
          container.offsetHeight; // Force reflow
          container.style.display = '';

          // If OSMD has a resize method, call it
          if (this.renderer.osmd && this.renderer.osmd.resize) {
            try {
              this.renderer.osmd.resize();
            } catch (error) {
              console.log('OSMD resize not available or failed:', error);
            }
          }

          // Additional force redraw by triggering a window resize event
          // This should trigger OSMD's internal resize handlers
          window.dispatchEvent(new Event('resize'));
        }
      }
    } else if (tabName === 'jamming') {
      // Jamming tab is active - initialize drum machine if needed
      this.initializeJammingMode();
    } else {
      // Other tabs are active - stop practice mode to save resources
      if (this.practiceModeEnabled) {
        const micToggle = document.getElementById('practice-microphone-toggle');
        if (micToggle) micToggle.checked = false;
        this.togglePracticeMode();
      }

      // Stop jamming mode if switching away
      if (this.jammingModeActive) {
        this.jammingModeActive = false;
        if (this.drumMachine) {
          this.drumMachine._clearScheduledDrums();
        }
      }
    }
  }

  /**
   * Initialize jamming mode components
   */
  async initializeJammingMode() {
    try {
      // Initialize drum machine if not already done
      if (!this.drumMachine) {
        this.drumMachine = new DrumMachine({
          drumVolume: 0.6,
          accentStrength: 1.2
        });
        await this.drumMachine.initialize();

        // Subscribe to drum events
        this.drumMachine.on('drum:beat', (data) => {
          this.updateBeatIndicator(data);
        });

        this.drumMachine.on('drum:styleChanged', (data) => {
          this.showNotification(`Drum style: ${data.style}`, 'info');
        });

        this.drumMachine.on('drum:volumeChanged', (data) => {
          const display = document.getElementById('drum-volume-display');
          if (display) {
            display.textContent = Math.round(data.volume * 100) + '%';
          }
        });
      }

      this.jammingModeActive = true;
      console.log('🎵 Jamming mode initialized');

    } catch (error) {
      console.error('Failed to initialize jamming mode:', error);
      this.showNotification('Failed to initialize jamming mode: ' + error.message, 'error');
    }
  }

  /**
   * Setup jamming mode with current exercise
   */
  _setupJammingMode() {
    if (!this.currentExercise || !this.drumMachine) return;

    try {
      // Set drum style
      const drumStyle = this._getSelectedDrumStyle();
      this.drumMachine.setStyle(drumStyle);

      // Connect drum machine to playback engine for synchronized playback
      if (this.engine) {
        this.engine.setDrumMachine(this.drumMachine);
        console.log('🥁 Drum machine connected to PlaybackEngine for synchronized jamming');
      }

      // Legacy: Schedule drums independently (kept for compatibility)
      this.drumMachine.scheduleDrums(
        this.currentExercise.timeline,
        this.currentExercise.tempo,
        this.currentExercise.timeSignature,
        this.currentExercise.upbeat  // NEW: Pass upbeat info for beat calculation
      );

      console.log('🥁 Drums scheduled for jamming mode');

    } catch (error) {
      console.error('Failed to setup jamming mode:', error);
      this.showNotification('Failed to setup drum accompaniment', 'error');
    }
  }

  /**
   * Get selected drum style from UI
   */
  _getSelectedDrumStyle() {
    const selector = document.getElementById('drum-style-select');
    return selector ? selector.value : 'rock';
  }

  /**
   * Update beat indicator visual feedback
   */
  updateBeatIndicator(data) {
    if (!this.jammingModeActive) return;

    // Update beat lights (1-4)
    const beatNumber = data.beatNumber || ((data.beat % 4) + 1);
    for (let i = 1; i <= 4; i++) {
      const light = document.querySelector(`.beat-light[data-beat="${i}"]`);
      if (light) {
        if (i === beatNumber) {
          light.classList.add('active');
          if (i === 1) light.classList.add('accent'); // Beat 1 gets accent
        } else {
          light.classList.remove('active', 'accent');
        }
      }
    }
  }

  /**
   * Handle jamming play button
   */
  async handleJamPlay() {
    if (!this.engine) {
      this.showNotification('Please load an exercise first', 'warning');
      return;
    }

    if (!this.drumMachine || !this.drumMachine.isReady()) {
      this.showNotification('Drum machine not ready', 'warning');
      return;
    }

    try {
      // Setup drums if not already done
      if (this.currentExercise) {
        this._setupJammingMode();
      }

      // Start countdown before playback
      await this._startJammingCountdown();

      // Start actual playback
      await this.engine.play();
      this.updateJammingButtonStates('playing');

    } catch (error) {
      console.error('Jamming play error:', error);
      this.showNotification('Failed to start jamming: ' + error.message, 'error');
    }
  }

  /**
   * Start countdown before jamming playback
   * @private
   */
  async _startJammingCountdown() {
    return new Promise((resolve) => {
      const countdownDisplay = document.getElementById('jam-countdown');
      const beatLights = document.querySelectorAll('.beat-light');

      // Show countdown display
      if (countdownDisplay) {
        countdownDisplay.style.display = 'block';
      }

      // Disable controls during countdown
      this.updateJammingButtonStates('countdown');

      let count = 2; // 2-beat countdown
      const countdownInterval = setInterval(() => {
        // Update countdown display
        if (countdownDisplay) {
          countdownDisplay.textContent = count.toString();
          countdownDisplay.className = 'countdown-number';
        }

        // Flash beat lights
        beatLights.forEach((light, index) => {
          if (index === (count - 1) % 4) {
            light.classList.add('countdown-flash');
            setTimeout(() => light.classList.remove('countdown-flash'), 200);
          }
        });

        // Play metronome click
        if (this.drumMachine) {
          // Use snare for countdown clicks
          this.drumMachine.snare.triggerAttackRelease('8n', Tone.now());
        }

        count--;

        if (count < 0) {
          clearInterval(countdownInterval);

          // Hide countdown display
          if (countdownDisplay) {
            countdownDisplay.style.display = 'none';
          }

          // Small delay before starting playback
          setTimeout(() => {
            resolve();
          }, 100);
        }
      }, 60000 / this.settings.tempo); // One beat duration
    });
  }

  /**
   * Handle jamming pause button
   */
  handleJamPause() {
    if (this.engine) {
      this.engine.pause();
      this.updateJammingButtonStates('paused');
    }
  }

  /**
   * Handle jamming stop button
   */
  handleJamStop() {
    if (this.engine) {
      this.engine.stop();
      this.updateJammingButtonStates('stopped');
    }
  }

  /**
   * Update jamming button states
   */
  updateJammingButtonStates(state) {
    const playBtn = document.getElementById('jam-play-btn');
    const pauseBtn = document.getElementById('jam-pause-btn');
    const stopBtn = document.getElementById('jam-stop-btn');

    switch (state) {
      case 'playing':
        if (playBtn) playBtn.disabled = true;
        if (pauseBtn) pauseBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = false;
        break;
      case 'paused':
        if (playBtn) playBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        break;
      case 'stopped':
        if (playBtn) playBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = true;
        break;
    }
  }

  /**
   * Handle drum style change
   */
  handleDrumStyleChange(event) {
    const style = event.target.value;
    if (this.drumMachine) {
      this.drumMachine.setStyle(style);

      // Re-schedule drums if currently playing
      if (this.engine && this.engine.getState() === 'playing' && this.currentExercise) {
        this._setupJammingMode();
      }
    }
  }

  /**
   * Handle drum volume change
   */
  handleDrumVolumeChange(event) {
    const volume = event.target.value / 100;
    if (this.drumMachine) {
      this.drumMachine.setVolume(volume);
    }
  }

  /**
   * Handle jamming tempo change
   */
  handleJamTempoChange(event) {
    const bpm = parseInt(event.target.value);
    const display = document.getElementById('jam-tempo-display');
    if (display) {
      display.textContent = bpm + ' BPM';
    }

    if (this.engine) {
      this.engine.setTempo(bpm);

      // Re-schedule drums with new tempo
      if (this.drumMachine && this.currentExercise) {
        this.drumMachine.scheduleDrums(
          this.currentExercise.timeline,
          bpm,
          this.currentExercise.timeSignature,
          this.currentExercise.upbeat  // NEW: Pass upbeat info for beat calculation
        );
      }
    }
  }

  /**
   * Handle jamming file upload
   */
  async handleJammingFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log('🎵 Jamming file upload triggered:', file.name, file.type);

    try {
      const xmlContent = await this.readFileAsText(file);
      console.log('📄 Jamming file read successfully, length:', xmlContent.length);

      // Load the exercise for jamming
      await this.loadJammingExercise(xmlContent, file.name);
      console.log('✅ Exercise loaded successfully for jamming');

    } catch (error) {
      console.error('❌ Jamming file load error:', error);
      this.showNotification('Failed to load jamming file: ' + error.message, 'error');
    }
  }

  /**
   * Load exercise for jamming mode
   */
  async loadJammingExercise(xmlContent, exerciseName = 'Unknown') {
    try {
      // Parse exercise
      const exercise = await this.loader.parseXML(xmlContent);
      this.currentExercise = exercise;

      // Determine which tempo to use based on user preference
      const xmlTempo = exercise.tempo;
      let playbackTempo = this.settings.tempo; // Default to user's tempo

      if (this.settings.useXmlTempo) {
        // Use XML tempo - update settings and UI
        playbackTempo = xmlTempo;
        this.settings.tempo = xmlTempo;
        this.settingsManager.saveSettings(this.settings);
        this.syncUIWithSettings();

        // Update jamming tab tempo controls if they exist
        const jamTempoSlider = document.getElementById('jam-tempo-slider');
        const jamTempoDisplay = document.getElementById('jam-tempo-display');
        if (jamTempoSlider) jamTempoSlider.value = xmlTempo;
        if (jamTempoDisplay) jamTempoDisplay.textContent = xmlTempo + ' BPM';

        this.showNotification(`Tempo set to ${xmlTempo} BPM from MusicXML`, 'info');
      } else {
        // Preserve user tempo - just notify about XML tempo
        this.showNotification(`MusicXML specifies ${xmlTempo} BPM, using your setting: ${this.settings.tempo} BPM`, 'info');
      }

      // Render notation in jamming container
      const container = document.getElementById('jam-notation');
      if (container) {
        // Clear previous content
        container.innerHTML = '';

        // Create a new div for OSMD
        const notationDiv = document.createElement('div');
        notationDiv.id = 'jamming-notation-renderer';
        container.appendChild(notationDiv);

        this.renderer = new NotationRenderer();
        this.renderer.init(notationDiv);
        await this.renderer.render(exercise);
      }

      // Create playback engine with appropriate tempo
      this.engine = new PlaybackEngine(exercise.timeline, {
        bpm: playbackTempo,
        timeSignature: exercise.timeSignature,
        instrument: document.getElementById('instrumentSelect').value,
        instrumentMode: document.getElementById('instrumentMode').value
      });

      // Subscribe to engine events for cursor highlighting (CRITICAL FIX)
      this.engine.on('playback:tick', (data) => {
        if (this.renderer) {
          this.renderer.clearHighlights();
          this.renderer.highlightNotes([data.noteId], 'active');
        }
      });

      this.engine.on('playback:completed', () => {
        this.updateJammingButtonStates('stopped');
        this.showNotification('Playback completed', 'success');
      });

      this.engine.on('playback:error', (data) => {
        this.showNotification('Playback error: ' + data.error, 'error');
      });

      // Setup jamming mode
      if (this.jammingModeActive) {
        console.log('🎵 Setting up jamming mode for loaded exercise');
        this._setupJammingMode();
      }

      console.log('🎵 Exercise loaded for jamming:', exercise.title || exerciseName);
      this.showNotification(`Loaded for jamming: ${exercise.title || exerciseName}`, 'success');

    } catch (error) {
      console.error('Jamming exercise load error:', error);
      this.showNotification('Failed to load exercise for jamming: ' + error.message, 'error');
      throw error;
    }
  }
  
  /**
   * NEW: Apply loaded settings to all modules
   */
  applySettings() {
    console.log('🔧 applySettings() called');
    console.log('📋 Loaded settings:', this.settings);
    console.log('📊 Reference pitch from settings:', this.settings.referencePitch);
    console.log('🎛️  Smoothing from settings:', this.settings.tunerSmoothing);
    
    // Apply to PlaybackEngine
    if (this.engine) {
      this.engine.setTempo(this.settings.tempo);
      this.engine.setVolume(this.settings.volume);
      this.engine.setMetronomeVolume(this.settings.metronomeVolume);
      this.engine.setInstrument(this.settings.instrument);
      
      // Metronome state
      if (this.settings.metronomeEnabled !== this.engine.config.metronomeEnabled) {
        this.engine.toggleMetronome();
      }
    }
    
    // Apply to Tuner (when available)
    if (this.uiManager && this.uiManager.tuner) {
      console.log('🎵 Applying settings to tuner module...');
      this.uiManager.tuner.setReferencePitch(this.settings.referencePitch);
      this.uiManager.tuner.setSmoothingFactor(this.settings.tunerSmoothing);
      console.log('✅ Tuner module settings applied');
    } else {
      console.log('⚠️  Tuner module not available yet');
    }
    
    // Apply to Analyzer
    if (this.analyzer) {
      this.analyzer.setTolerances({
        preset: this.settings.difficulty || 'NORMAL',
        pitch: this.settings.pitchTolerance || 50,
        timing: this.settings.timingTolerance || 100
      });
    }
    
    // Update UI to reflect settings
    console.log('🖥️  Syncing UI controls with settings...');
    this.syncUIWithSettings();
  }
  
  /**
   * NEW: Sync UI controls with current settings
   */
  syncUIWithSettings() {
    const tempoSlider = document.getElementById('tempoSlider');
    const tempoValue = document.getElementById('tempoValue');
    if (tempoSlider && tempoValue) {
      tempoSlider.value = this.settings.tempo;
      tempoValue.textContent = this.settings.tempo + ' BPM';
    }

    const volumeSlider = document.getElementById('volumeSlider');
    const volumeValue = document.getElementById('volumeValue');
    if (volumeSlider && volumeValue) {
      volumeSlider.value = Math.round(this.settings.volume * 100);
      volumeValue.textContent = Math.round(this.settings.volume * 100) + '%';
    }

    const metronomeToggle = document.getElementById('metronomeToggle');
    if (metronomeToggle) {
      metronomeToggle.checked = this.settings.metronomeEnabled;
    }

    const metronomeVolumeSlider = document.getElementById('metronomeVolumeSlider');
    const metronomeVolumeValue = document.getElementById('metronomeVolumeValue');
    if (metronomeVolumeSlider && metronomeVolumeValue) {
      metronomeVolumeSlider.value = Math.round(this.settings.metronomeVolume * 100);
      metronomeVolumeValue.textContent = Math.round(this.settings.metronomeVolume * 100) + '%';
    }

    const instrumentMode = document.getElementById('instrumentMode');
    if (instrumentMode) {
      instrumentMode.value = this.settings.instrumentMode;
    }

    const instrumentSelect = document.getElementById('instrumentSelect');
    if (instrumentSelect) {
      instrumentSelect.value = this.settings.instrument;
    }

    // Sync tuner tab controls
    console.log('🎛️  Looking for tuner DOM elements...');
    const tunerReferenceSelect = document.getElementById('tuner-reference-select');
    const tunerSmoothingSlider = document.getElementById('tuner-smoothing-slider');
    const tunerSmoothingValue = document.getElementById('tuner-smoothing-value');
    
    console.log('🎯 Found tuner elements:', {
      referenceSelect: !!tunerReferenceSelect,
      smoothingSlider: !!tunerSmoothingSlider,
      smoothingValue: !!tunerSmoothingValue
    });
    
    if (tunerReferenceSelect) {
      tunerReferenceSelect.value = this.settings.referencePitch.toString();
      console.log('🎯 Set tuner reference select to:', this.settings.referencePitch);
    } else {
      console.log('❌ tuner-reference-select element not found!');
    }

    if (tunerSmoothingSlider) {
      tunerSmoothingSlider.value = this.settings.tunerSmoothing * 100; // Convert 0.2 to 20
      console.log('🎯 Set tuner smoothing slider to:', this.settings.tunerSmoothing * 100);
    } else {
      console.log('❌ tuner-smoothing-slider element not found!');
    }
    
    if (tunerSmoothingValue) {
      tunerSmoothingValue.textContent = (this.settings.tunerSmoothing).toFixed(2); // Display as 0.20
      console.log('🎯 Set tuner smoothing display to:', (this.settings.tunerSmoothing).toFixed(2));
    } else {
      console.log('❌ tuner-smoothing-value element not found!');
    }
    
    // Sync analyzer smoothing
    const settingsAnalyzerSmoothing = document.getElementById('settings-analyzer-smoothing');
    const settingsAnalyzerSmoothingValue = document.getElementById('settings-analyzer-smoothing-value');
    if (settingsAnalyzerSmoothing) {
      settingsAnalyzerSmoothing.value = (this.settings.analyzerSmoothing || 0.5) * 100; // Convert 0.5 to 50
      console.log('🎯 Set analyzer smoothing slider to:', (this.settings.analyzerSmoothing || 0.5) * 100);
    }
    if (settingsAnalyzerSmoothingValue) {
      settingsAnalyzerSmoothingValue.textContent = (this.settings.analyzerSmoothing || 0.5).toFixed(2);
      console.log('🎯 Set analyzer smoothing display to:', (this.settings.analyzerSmoothing || 0.5).toFixed(2));
    }

    // Update calibration display
    this.updateCalibrationDisplay();
  }
  
  /**
   * NEW: Save setting and apply immediately
   */
  saveSetting(key, value) {
    this.settings[key] = value;
    this.settingsManager.saveSettings(this.settings);
  }
  
  /**
   * Initialize all UI event listeners
   */
  initializeUI() {
    // Audio context activation
    document.getElementById('activateAudio').addEventListener('click', 
      this.activateAudioContext.bind(this));
    
    // Playback controls
    document.getElementById('playBtn').addEventListener('click', 
      this.handlePlay.bind(this));
    document.getElementById('pauseBtn').addEventListener('click', 
      this.handlePause.bind(this));
    document.getElementById('stopBtn').addEventListener('click', 
      this.handleStop.bind(this));
    
    // Audio controls
    document.getElementById('metronomeToggle').addEventListener('change', 
      this.handleMetronomeToggle.bind(this));
    document.getElementById('instrumentMode').addEventListener('change', 
      this.handleModeChange.bind(this));
    document.getElementById('instrumentSelect').addEventListener('change', 
      this.handleInstrumentChange.bind(this));
    document.getElementById('volumeSlider').addEventListener('input', 
      this.handleVolumeChange.bind(this));
    document.getElementById('metronomeVolumeSlider').addEventListener('input', 
      this.handleMetronomeVolumeChange.bind(this));
    
    // Tempo control
    document.getElementById('tempoSlider').addEventListener('change', 
      this.handleTempoChange.bind(this));
      
    // Practice mode controls
    document.getElementById('practice-microphone-toggle').addEventListener('change', 
      this.togglePracticeMode.bind(this));
      
    // Tuner mode controls
    document.getElementById('tuner-microphone-toggle').addEventListener('change', 
      this.toggleTunerMode.bind(this));
      
    // NEW: Calibration controls
    document.getElementById('calibrate-latency-btn').addEventListener('click', 
      this.startCalibration.bind(this));
    document.getElementById('reset-calibration-btn').addEventListener('click', 
      this.resetCalibration.bind(this));
    
      
    // Tab navigation (direct event listeners to ensure they work)
    document.querySelectorAll('[data-tab]').forEach(tabButton => {
      tabButton.addEventListener('click', (event) => {
        const tabId = event.currentTarget.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });
      
    // File upload - Practice tab
    document.getElementById('exerciseFilePractice').addEventListener('change', 
      this.handleFileUpload.bind(this));
    
    // File upload - Lessons tab
    document.getElementById('exerciseFileLessons').addEventListener('change', 
      this.handleFileUpload.bind(this));
      
    // Sample exercise loading
    document.querySelectorAll('.exercise-item .btn').forEach(button => {
      button.addEventListener('click', this.handleSampleExerciseLoad.bind(this));
    });

    // Jamming tab controls
    document.getElementById('jam-play-btn')?.addEventListener('click',
      this.handleJamPlay.bind(this));
    document.getElementById('jam-pause-btn')?.addEventListener('click',
      this.handleJamPause.bind(this));
    document.getElementById('jam-stop-btn')?.addEventListener('click',
      this.handleJamStop.bind(this));
    document.getElementById('drum-style-select')?.addEventListener('change',
      this.handleDrumStyleChange.bind(this));
    document.getElementById('drum-volume')?.addEventListener('input',
      this.handleDrumVolumeChange.bind(this));
    document.getElementById('jam-tempo-slider')?.addEventListener('input',
      this.handleJamTempoChange.bind(this));

    // Jamming tab file upload
    document.getElementById('exerciseFileJamming')?.addEventListener('change',
      this.handleJammingFileUpload.bind(this));
  }
  
  /**
   * NEW: Setup global keyboard shortcuts
   */
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
        } else if (this.engine && (this.engine.getState() === 'paused' || this.engine.getState() === 'stopped')) {
          this.handlePlay();
        }
      }

      // Escape: Stop
      if (e.code === 'Escape') {
        e.preventDefault();
        this.handleStop();
      }

      // M: Toggle metronome
      if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (this.engine) {
          this.engine.toggleMetronome();
          const metronomeToggle = document.getElementById('metronomeToggle');
          if (metronomeToggle) {
            metronomeToggle.checked = this.engine.config.metronomeEnabled;
          }
          this.saveSetting('metronomeEnabled', this.engine.config.metronomeEnabled);
          this.showNotification(
            `Metronome ${this.engine.config.metronomeEnabled ? 'ON' : 'OFF'}`, 
            'info'
          );
        }
      }

      // Arrow Up: Increase tempo by 5
      if (e.code === 'ArrowUp' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const newTempo = Math.min(300, this.settings.tempo + 5);
        this.engine.setTempo(newTempo);
        this.saveSetting('tempo', newTempo);
        this.syncUIWithSettings();
        this.showNotification(`Tempo: ${newTempo} BPM`, 'info');
      }

      // Arrow Down: Decrease tempo by 5
      if (e.code === 'ArrowDown' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const newTempo = Math.max(40, this.settings.tempo - 5);
        this.engine.setTempo(newTempo);
        this.saveSetting('tempo', newTempo);
        this.syncUIWithSettings();
        this.showNotification(`Tempo: ${newTempo} BPM`, 'info');
      }

      // Tab: Cycle tabs (if not in input)
      if (e.code === 'Tab' && !e.shiftKey && !e.ctrlKey) {
        const currentTab = document.querySelector('.tab-btn.active');
        if (currentTab) {
          e.preventDefault();
          const allTabs = Array.from(document.querySelectorAll('.tab-btn'));
          const currentIndex = allTabs.indexOf(currentTab);
          const nextIndex = (currentIndex + 1) % allTabs.length;
          allTabs[nextIndex].click();
        }
      }
    });

    console.log('Keyboard shortcuts registered');
  }
  
  /**
   * NEW: Setup settings panel handlers
   */
  setupSettingsPanel() {
    // Sync with current settings on load
    const settingsInstrument = document.getElementById('settings-instrument');
    const settingsMode = document.getElementById('settings-mode');
    const settingsVolume = document.getElementById('settings-volume');
    const settingsVolumeValue = document.getElementById('settings-volume-value');
    const settingsMetronomeVol = document.getElementById('settings-metronome-vol');
    const settingsMetronomeVolValue = document.getElementById('settings-metronome-vol-value');
    const settingsReference = document.getElementById('settings-reference');
    const settingsSmoothing = document.getElementById('settings-smoothing');
    const settingsSmoothingValue = document.getElementById('settings-smoothing-value');
    const settingsAnalyzerSmoothing = document.getElementById('settings-analyzer-smoothing');
    const settingsAnalyzerSmoothingValue = document.getElementById('settings-analyzer-smoothing-value');
    const settingsDifficulty = document.getElementById('settings-difficulty');
    const settingsUseXmlTempo = document.getElementById('settings-use-xml-tempo');

    // Initialize values
    if (settingsInstrument) settingsInstrument.value = this.settings.instrument;
    if (settingsMode) settingsMode.value = this.settings.instrumentMode;
    if (settingsVolume) {
      settingsVolume.value = Math.round(this.settings.volume * 100);
      settingsVolumeValue.textContent = `${Math.round(this.settings.volume * 100)}%`;
    }
    if (settingsMetronomeVol) {
      settingsMetronomeVol.value = Math.round(this.settings.metronomeVolume * 100);
      settingsMetronomeVolValue.textContent = `${Math.round(this.settings.metronomeVolume * 100)}%`;
    }
    if (settingsReference) settingsReference.value = this.settings.referencePitch;
    if (settingsSmoothing) {
      settingsSmoothing.value = this.settings.tunerSmoothing * 100; // Convert 0.2 to 20
      settingsSmoothingValue.textContent = this.settings.tunerSmoothing.toFixed(2); // Display as 0.20
    }
    if (settingsDifficulty) settingsDifficulty.value = this.settings.difficulty;
    if (settingsUseXmlTempo) settingsUseXmlTempo.checked = this.settings.useXmlTempo;

    // Event handlers
    settingsInstrument?.addEventListener('change', (e) => {
      const newInstrument = e.target.value;
      if (this.engine) this.engine.setInstrument(newInstrument);
      this.saveSetting('instrument', newInstrument);
      // Sync with Practice tab instrument control
      const practiceInstrumentSelect = document.getElementById('instrumentSelect');
      if (practiceInstrumentSelect) {
        practiceInstrumentSelect.value = newInstrument;
      }
      // ENHANCED: Update CalibrationManager with new instrument settings
      this._updateCalibrationInstrumentSettings();
      this.showNotification(`Instrument changed to ${newInstrument}`, 'info');
    });

    settingsMode?.addEventListener('change', async (e) => {
      const newMode = e.target.value;
      try {
        if (this.engine) await this.engine.setInstrumentMode(newMode);
        this.saveSetting('instrumentMode', newMode);
        document.getElementById('instrumentMode').value = newMode;
        // ENHANCED: Update CalibrationManager with new mode settings
        this._updateCalibrationInstrumentSettings();
        this.showNotification(`Switched to ${newMode} mode`, 'success');
      } catch (error) {
        this.showNotification(`Failed to switch mode: ${error.message}`, 'error');
      }
    });

    settingsVolume?.addEventListener('input', (e) => {
      const volume = e.target.value / 100;
      if (this.engine) this.engine.setVolume(volume);
      this.saveSetting('volume', volume);
      settingsVolumeValue.textContent = `${Math.round(volume * 100)}%`;
      // Sync with Practice tab volume control
      const practiceVolumeSlider = document.getElementById('volumeSlider');
      const practiceVolumeValue = document.getElementById('volumeValue');
      if (practiceVolumeSlider) {
        practiceVolumeSlider.value = Math.round(volume * 100);
      }
      if (practiceVolumeValue) {
        practiceVolumeValue.textContent = `${Math.round(volume * 100)}%`;
      }
    });

    settingsMetronomeVol?.addEventListener('input', (e) => {
      const volume = e.target.value / 100;
      if (this.engine) this.engine.setMetronomeVolume(volume);
      this.saveSetting('metronomeVolume', volume);
      settingsMetronomeVolValue.textContent = `${Math.round(volume * 100)}%`;
      // Sync with Practice tab metronome volume control
      const practiceMetronomeSlider = document.getElementById('metronomeVolumeSlider');
      const practiceMetronomeValue = document.getElementById('metronomeVolumeValue');
      if (practiceMetronomeSlider) {
        practiceMetronomeSlider.value = Math.round(volume * 100);
      }
      if (practiceMetronomeValue) {
        practiceMetronomeValue.textContent = `${Math.round(volume * 100)}%`;
      }
    });

    settingsReference?.addEventListener('change', (e) => {
      const pitch = parseInt(e.target.value);
      if (this.uiManager && this.uiManager.tuner) {
        this.uiManager.tuner.setReferencePitch(pitch);
        // Sync with Tuner tab control
        const tunerReferenceSelect = document.getElementById('tuner-reference-select');
        if (tunerReferenceSelect) {
          tunerReferenceSelect.value = pitch.toString();
        }
      }
      this.saveSetting('referencePitch', pitch);
      this.showNotification(`Reference pitch: ${pitch} Hz`, 'info');
    });

    settingsSmoothing?.addEventListener('input', (e) => {
      const smoothing = parseFloat(e.target.value) / 100; // Convert 20 to 0.2
      if (this.uiManager && this.uiManager.tuner) {
        this.uiManager.tuner.setSmoothingFactor(smoothing);
        // Sync with Tuner tab control
        const tunerSmoothingSlider = document.getElementById('tuner-smoothing-slider');
        const tunerSmoothingValue = document.getElementById('tuner-smoothing-value');
        if (tunerSmoothingSlider) {
          tunerSmoothingSlider.value = smoothing * 100;
        }
        if (tunerSmoothingValue) {
          tunerSmoothingValue.textContent = smoothing.toFixed(2);
        }
      }
      this.saveSetting('tunerSmoothing', smoothing);
      settingsSmoothingValue.textContent = smoothing.toFixed(2);
    });

    settingsAnalyzerSmoothing?.addEventListener('input', (e) => {
      const smoothing = parseFloat(e.target.value) / 100; // Convert 50 to 0.5
      this.saveSetting('analyzerSmoothing', smoothing);
      settingsAnalyzerSmoothingValue.textContent = smoothing.toFixed(2);
      this.showNotification(`Analyzer smoothing: ${smoothing.toFixed(2)}`, 'info');
    });

    settingsDifficulty?.addEventListener('change', (e) => {
      this.saveSetting('difficulty', e.target.value);
      // Apply to analyzer
      if (this.analyzer) {
        this.analyzer.setTolerances({
          preset: e.target.value,
          pitch: this.settings.pitchTolerance || 50,
          timing: this.settings.timingTolerance || 100
        });
      }
      this.showNotification(`Difficulty: ${e.target.value}`, 'info');
    });

    settingsUseXmlTempo?.addEventListener('change', (e) => {
      this.saveSetting('useXmlTempo', e.target.checked);
      this.showNotification(`Use XML tempo: ${e.target.checked ? 'Enabled' : 'Disabled'}`, 'info');
    });

    // Manual latency controls
    const manualLatencyInput = document.getElementById('manual-latency');
    const resetManualLatencyBtn = document.getElementById('reset-manual-latency');

    manualLatencyInput?.addEventListener('change', (e) => {
      const value = parseInt(e.target.value);
      if (!isNaN(value) && value >= 0 && value <= 500) {
        this.settingsManager.setManualLatency(value);
        this.showNotification(`Manual latency set to ${value}ms`, 'info');
        // Update calibration display to reflect manual override
        this.updateCalibrationDisplay();
      } else {
        this.showNotification('Invalid latency value (0-500ms)', 'error');
        // Reset to current value
        const currentLatency = this.settingsManager.getEffectiveLatency();
        e.target.value = currentLatency;
      }
    });

    resetManualLatencyBtn?.addEventListener('click', () => {
      this.settingsManager.setManualLatency(null);
      manualLatencyInput.value = '';
      this.showNotification('Manual latency reset to calibrated value', 'info');
      this.updateCalibrationDisplay();
    });

    // Data management buttons
    document.getElementById('export-settings')?.addEventListener('click', () => {
      const data = this.settingsManager.storage.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `guitar4-settings-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showNotification('Settings exported', 'success');
    });

    document.getElementById('reset-settings')?.addEventListener('click', () => {
      if (confirm('Reset all settings to defaults?')) {
        this.settingsManager.resetToDefaults();
        this.settings = this.settingsManager.loadSettings();
        this.applySettings();
        this.setupSettingsPanel(); // Re-sync UI
        this.showNotification('Settings reset to defaults', 'info');
      }
    });

    document.getElementById('clear-history')?.addEventListener('click', () => {
      if (confirm('Clear all performance history?')) {
        this.settingsManager.storage.delete(STORAGE_KEYS.PERFORMANCE_HISTORY);
        this.showNotification('Performance history cleared', 'info');
      }
    });

    console.log('Settings panel initialized');
  }

  /**
   * ENHANCED: Update CalibrationManager with current instrument settings
   * @private
   */
  _updateCalibrationInstrumentSettings() {
    if (this.calibrationManager) {
      const currentInstrumentSelect = document.getElementById('instrumentSelect');
      const currentInstrumentMode = document.getElementById('instrumentMode');
      
      const currentInstrumentSettings = {
        instrument: currentInstrumentSelect ? currentInstrumentSelect.value : this.settings.instrument,
        mode: currentInstrumentMode ? currentInstrumentMode.value : this.settings.instrumentMode
      };
      
      this.calibrationManager.setUserInstrumentSettings(currentInstrumentSettings);
      console.log('🔧 Updated CalibrationManager with user instrument settings:', currentInstrumentSettings);
    }
  }
  
  /**
   * Activate audio context with user gesture
   */
  async activateAudioContext() {
    try {
      // First initialize Tone.js context
      if (window.Tone) {
        await window.Tone.start();
        await window.Tone.context.resume();
      }

      this.audioActivated = true;
      
      // Initialize engine audio if engine exists
      if (this.engine) {
        console.log('🔊 Audio context active - initializing PlaybackEngine audio components...');
        await this.engine.initializeAudio();

        // Check if we're using samples and need to wait for them to load
        // FIX: Check the engine's actual currentInstrumentMode instead of settings
        if (this.engine.currentInstrumentMode === 'sample' && !this.engine.samplesLoaded) {
          console.log('⏳ Samples mode detected - waiting for samples to load after audio activation');
          this.disablePlayControls('Loading audio samples...');

          // Wait for samples to load
          await this.waitForSamplesToLoad();
          this.enablePlayControls();
        }
      }

      // Reinitialize drum machine audio components if they exist
      if (this.drumMachine) {
        console.log('🥁 Audio context active - reinitializing DrumMachine audio components...');
        await this.drumMachine.reinitializeAudio();
      }

      // Update UI
      const statusIndicator = document.querySelector('.status-indicator');
      const statusText = document.querySelector('.status-text');
      const activateBtn = document.getElementById('activateAudio');
      
      statusIndicator.className = 'status-indicator status-active';
      statusText.textContent = 'Audio Active ✓';
      activateBtn.disabled = true;
      activateBtn.textContent = 'Audio Ready';
      
      // Enable playback controls
      const controlsToEnable = [
        'playBtn', 'pauseBtn', 'stopBtn', 'tempoSlider', 
        'instrumentMode', 'metronomeToggle'
      ];
      controlsToEnable.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.disabled = false;
      });
      
      console.log('Audio context activated successfully');
      this.showNotification('Audio context activated', 'success');
      
    } catch (error) {
      console.error('Failed to activate audio context:', error);
      this.showNotification('Failed to activate audio: ' + error.message, 'error');
    }
  }
  
  /**
   * Handle play button click - FIXED: Use actual playback start time
   */
  async handlePlay() {
    if (!this.engine) {
      this.showNotification('Please load an exercise first', 'warning');
      return;
    }
    
    try {
      // Start recording and clear previous pitch data for new session
      this.isRecording = true;
      this.pitchStream = [];

      const calibratedLatency = this.calibrationManager
        ? this.calibrationManager.getCalibrationStatus().effectiveLatency
        : 0;

      console.log('🎯 SESSION STARTED:');
      console.log('- Recording state:', this.isRecording);
      console.log('- Calibrated latency:', calibratedLatency + 'ms (will be applied during analysis)');
      console.log('- Will use ACTUAL playback start time from PlaybackEngine for synchronization');
      
      await this.engine.play();
      
      // Update button states
      this.updatePlaybackButtonStates('playing');
      
    } catch (error) {
      console.error('Playback error:', error);
      this.showNotification('Playback error: ' + error.message, 'error');
      // Reset session state on error
      this.isRecording = false;
      this.sessionStartTime = null;
    }
  }
  
  /**
   * Handle pause button click
   */
  handlePause() {
    if (this.engine) {
      this.engine.pause();
      this.updatePlaybackButtonStates('paused');
      // Pause recording but keep session time
      this.isRecording = false;
      console.log('⏸️  Session paused - recording stopped, session time preserved');
    }
  }
  
  /**
   * Handle stop button click - Enhanced with session cleanup
   */
  handleStop() {
    if (this.engine) {
      this.engine.stop();
      this.updatePlaybackButtonStates('stopped');
      
      // End recording session
      if (this.isRecording) {
        console.log('⏹️  SESSION ENDED:');
        console.log('- Final session duration:', Date.now() - this.sessionStartTime + 'ms');
      }
      this.isRecording = false;
      
      // Run analysis if we have pitch data and exercise loaded
      if (this.pitchStream.length > 0 && this.currentExercise) {
        this.runAnalysis();
      } else {
        console.log('⚠️  Analysis skipped - no pitch data or exercise');
      }
      
      // Clear session data after a short delay
      setTimeout(() => {
        this.sessionStartTime = null;
        console.log('🧹 Session data cleared');
      }, 1000);
    }
  }
  
  /**
   * Update playback button states based on current state
   */
  updatePlaybackButtonStates(state) {
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    switch (state) {
      case 'playing':
        playBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        break;
      case 'paused':
        playBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = false;
        break;
      case 'stopped':
        playBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        break;
    }
  }
  
  /**
   * Handle metronome toggle (ENHANCED with persistence)
   */
  handleMetronomeToggle(event) {
    if (this.engine) {
      this.engine.toggleMetronome();
      this.saveSetting('metronomeEnabled', event.target.checked);
    }
  }
  
  /**
   * Handle instrument mode change (ENHANCED with persistence and calibration update)
   */
  async handleModeChange(event) {
    const mode = event.target.value;
    
    if (this.engine) {
      try {
        await this.engine.setInstrumentMode(mode);
        this.saveSetting('instrumentMode', mode);
        // ENHANCED: Update CalibrationManager with new mode settings
        this._updateCalibrationInstrumentSettings();
        console.log(`Switched to ${mode} mode`);
        this.showNotification(`Switched to ${mode} mode`, 'info');
      } catch (error) {
        console.error('Mode switch error:', error);
        this.showNotification('Failed to switch mode: ' + error.message, 'error');
      }
    }
  }
  
  /**
   * Handle instrument type change (ENHANCED with persistence and calibration update)
   */
  handleInstrumentChange(event) {
    const instrument = event.target.value;
    
    if (this.engine) {
      this.engine.setInstrument(instrument);
      this.saveSetting('instrument', instrument);
      // ENHANCED: Update CalibrationManager with new instrument settings
      this._updateCalibrationInstrumentSettings();
      console.log(`Switched instrument to ${instrument}`);
    }
  }
  
  /**
   * Handle volume change (ENHANCED with persistence)
   */
  handleVolumeChange(event) {
    const volume = event.target.value / 100;
    const volumeValue = document.getElementById('volumeValue');
    if (volumeValue) {
      volumeValue.textContent = event.target.value + '%';
    }
    
    if (this.engine) {
      this.engine.setVolume(volume);
      this.saveSetting('volume', volume);
    }
  }
  
  /**
   * Handle metronome volume change (ENHANCED with persistence)
   */
  handleMetronomeVolumeChange(event) {
    const volume = event.target.value / 100;
    const metronomeVolumeValue = document.getElementById('metronomeVolumeValue');
    if (metronomeVolumeValue) {
      metronomeVolumeValue.textContent = event.target.value + '%';
    }
    
    if (this.engine) {
      this.engine.setMetronomeVolume(volume);
      this.saveSetting('metronomeVolume', volume);
    }
  }
  
  /**
   * Handle tempo change (ENHANCED with timeline recalculation)
   */
  handleTempoChange(event) {
    const bpm = parseInt(event.target.value);
    const tempoValue = document.getElementById('tempoValue');
    if (tempoValue) {
      tempoValue.textContent = bpm + ' BPM';
    }
    
    if (this.engine) {
      // Check if playback hasn't started yet (engine is stopped)
      const isStopped = this.engine.getState() === 'stopped';
      
      if (isStopped && this.currentExercise) {
        // Check if we're using samples - if so, disable controls during tempo change
        if (this.settings.instrumentMode === 'sample') {
          this.disablePlayControls('Preparing audio samples...');
          console.log('⏸️ Tempo change detected in sample mode - disabling controls');
        }
        
        // Recalculate timeline and refresh engine for stopped state
        this.recalculateTimelineForTempo(bpm);
      } else {
        // Use existing logic for during playback
        this.engine.setTempo(bpm);
      }
      
      this.saveSetting('tempo', bpm);
    }
  }
  
  /**
   * Disable play controls during tempo changes or sample loading
   */
  disablePlayControls(message = 'Loading...') {
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const tempoSlider = document.getElementById('tempoSlider');
    
    if (playBtn) {
      playBtn.disabled = true;
      playBtn.textContent = message;
    }
    if (pauseBtn) pauseBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = true;
    if (tempoSlider) tempoSlider.disabled = true;
    
    console.log('⏸️ Controls disabled:', message);
  }
  
  /**
   * Enable play controls when ready
   */
  enablePlayControls() {
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const tempoSlider = document.getElementById('tempoSlider');
    
    // Only enable if we have an engine and exercise loaded
    if (this.engine && this.currentExercise) {
      this.updatePlaybackButtonStates(this.engine.getState());
      if (tempoSlider) tempoSlider.disabled = false;
      console.log('▶️ Controls enabled - ready for playback');
    } else {
      // Keep disabled if no engine or exercise
      if (playBtn) playBtn.disabled = true;
      if (pauseBtn) pauseBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = true;
      if (tempoSlider) tempoSlider.disabled = true;
      console.log('⏸️ Controls kept disabled - no engine or exercise loaded');
    }
  }

  /**
   * Wait for samples to load with timeout
   * @private
   */
  async waitForSamplesToLoad() {
    return new Promise((resolve) => {
      const checkLoaded = setInterval(() => {
        if (this.engine.samplesLoaded) {
          clearInterval(checkLoaded);
          console.log('✅ Samples are now ready for playback');
          resolve();
        }
      }, 50); // Check every 50ms
      
      // Timeout after 10 seconds to prevent infinite waiting
      setTimeout(() => {
        if (!this.engine.samplesLoaded) {
          clearInterval(checkLoaded);
          console.log('⚠️ Sample loading timeout, proceeding with synth mode');
        }
        resolve();
      }, 10000);
    });
  }

  /**
   * Recalculate timeline for tempo change when engine is stopped
   * 
   * @param {number} newTempo - New tempo in BPM
   * @private
   */
  recalculateTimelineForTempo(newTempo) {
    if (!this.currentExercise) return;
    
    const oldTempo = this.engine.config.bpm;
    
    console.log(`🔄 Timeline recalculation requested: ${oldTempo} → ${newTempo} BPM`);
    
    try {
      // Recalculate timeline using ExerciseLoader method
      const recalculatedTimeline = this.loader.recalculateTimeline(
        this.currentExercise.timeline, 
        oldTempo, 
        newTempo
      );
      
      // Create new exercise data with recalculated timeline
      const newExercise = {
        ...this.currentExercise,
        tempo: newTempo,
        timeline: recalculatedTimeline
      };
      
      // Update current exercise with recalculated timeline
      this.currentExercise = newExercise;
      
      // Recreate playback engine with new timeline
      this.recreatePlaybackEngine(newExercise);
      
      console.log(`✅ Timeline recalculation successful: ${oldTempo} → ${newTempo} BPM`);
      this.showNotification(`Tempo updated to ${newTempo} BPM`, 'info');
      
    } catch (error) {
      console.error('❌ Timeline recalculation failed:', error);
      this.showNotification('Failed to update tempo. Try again.', 'error');
    }
  }

  /**
   * Recreate playback engine with new exercise data
   * 
   * @param {Object} newExercise - Exercise data with recalculated timeline
   * @private
   */
  async recreatePlaybackEngine(newExercise) {
    const newTempo = newExercise.tempo;
    
    // Store current engine state for reference
    const oldEngine = this.engine;
    
    // Get current instrument settings from DOM
    const currentInstrument = document.getElementById('instrumentSelect').value;
    const currentInstrumentMode = document.getElementById('instrumentMode').value;
    
    console.log(`🔄 Creating new PlaybackEngine with tempo: ${newTempo} BPM`);
    console.log(`🎸 Instrument settings: ${currentInstrument} (${currentInstrumentMode})`);
    
    // Create new playback engine with recalculated timeline
    this.engine = new PlaybackEngine(newExercise.timeline, {
      bpm: newTempo,
      timeSignature: newExercise.timeSignature,
      instrument: currentInstrument,
      instrumentMode: currentInstrumentMode
    });
    
    // Set tempo to ensure consistency
    this.engine.setTempo(newTempo);
    
    // Re-subscribe to engine events
    this.setupEngineEventListeners();
    
    // CRITICAL FIX: Initialize audio components for the new engine
    if (this.audioActivated) {
      try {
        console.log('🔊 Initializing audio components for new PlaybackEngine...');
        await this.engine.initializeAudio();
        
    // EXTRA: If in sample mode, wait for samples to load before considering initialization complete
    if (this.engine.currentInstrumentMode === 'sample' && !this.engine.samplesLoaded) {
      console.log('⏳ Waiting for samples to load...');
      try {
        await this.engine.preloadSamples();
        console.log('✅ Samples loaded successfully');
      } catch (error) {
        console.log('⚠️ Sample loading failed, will use synth mode:', error.message);
        // Engine will automatically fall back to synth mode
      }
    }

    // CRITICAL: Wait for samples to be fully loaded before proceeding
    if (this.engine.currentInstrumentMode === 'sample' && !this.engine.samplesLoaded) {
      console.log('⏳ Waiting for samples to be marked as loaded...');
      await new Promise((resolve) => {
        const checkLoaded = setInterval(() => {
          if (this.engine.samplesLoaded) {
            clearInterval(checkLoaded);
            console.log('✅ Samples are now ready for playback');
            resolve();
          }
        }, 50); // Check every 50ms
        
        // Timeout after 5 seconds to prevent infinite waiting
        setTimeout(() => {
          if (!this.engine.samplesLoaded) {
            clearInterval(checkLoaded);
            console.log('⚠️ Sample loading timeout, proceeding with synth mode');
          }
          resolve();
        }, 5000);
      });
    }
        
        console.log('✅ New PlaybackEngine audio initialized successfully');
      } catch (error) {
        console.error('❌ Audio initialization failed for new engine:', error);
        // Fallback: mark as initialized anyway to prevent complete failure
        console.log('🔄 Continuing without full audio initialization');
      }
    } else {
      console.log('🔇 Audio not yet activated, will initialize on first play');
    }
    
    console.log(`🔄 Playback engine recreated with new tempo: ${newTempo} BPM`);
    console.log(`🎸 Instrument preserved: ${currentInstrument} (${currentInstrumentMode})`);
  }

  /**
   * Set up engine event listeners
   * 
   * @private
   */
  setupEngineEventListeners() {
    if (!this.engine) return;
    
    // Subscribe to engine events
    this.engine.on('playback:started', (data) => {
      // CRITICAL FIX: Capture ACTUAL playback start time for timing synchronization
      this.sessionStartTime = data.startTime;
      this.playbackStartTime = data.startTime;
      console.log('✅ PLAYBACK ACTUALLY STARTED - Timing Synchronization Fixed:');
      console.log('- Actual playback start time:', this.sessionStartTime);
      console.log('- From now on, pitch timestamps will be calculated from this time');
      console.log('- This eliminates the session vs playback start time gap');
    });
    
    this.engine.on('playback:tick', (data) => {
      if (this.renderer) {
        this.renderer.clearHighlights();
        this.renderer.highlightNotes([data.noteId], 'active');
      }
    });
    
    this.engine.on('playback:completed', () => {
      this.updatePlaybackButtonStates('stopped');
      this.showNotification('Playback completed', 'success');
      
      // Run analysis if we have pitch data
      if (this.pitchStream.length > 0) {
        this.runAnalysis();
      }
    });
    
    this.engine.on('playback:error', (data) => {
      this.showNotification('Playback error: ' + data.error, 'error');
    });
    
    // Subscribe to audio events
    this.engine.on('audio:samplesLoaded', (data) => {
      this.enablePlayControls();
      this.showNotification(`${data.instrument} samples loaded`, 'success');
    });
    
    this.engine.on('audio:samplesError', (data) => {
      this.enablePlayControls();
      this.showNotification('Sample loading failed, using synth mode', 'warning');
    });
    
    console.log('🎧 Engine event listeners set up');
  }
  
  /**
   * Handle file upload
   */
  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('📁 File upload triggered:', file.name, file.type);
    
    try {
      const xmlContent = await this.readFileAsText(file);
      console.log('📄 File read successfully, length:', xmlContent.length);
      
      // Load the exercise - this includes parsing, rendering, and engine setup
      await this.loadExercise(xmlContent, file.name);
      console.log('✅ Exercise loaded successfully from file upload');
      
    } catch (error) {
      console.error('❌ File load error:', error);
      this.showNotification('Failed to load file: ' + error.message, 'error');
    }
  }
  
  /**
   * Handle sample exercise loading
   */
  async handleSampleExerciseLoad(event) {
    const exerciseItem = event.target.closest('.exercise-item');
    const fileName = exerciseItem.dataset.file;
    
    try {
      const response = await fetch(fileName);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${fileName}`);
      }
      const xmlContent = await response.text();
      await this.loadExercise(xmlContent, fileName);
    } catch (error) {
      console.error('Sample exercise load error:', error);
      this.showNotification('Failed to load exercise: ' + error.message, 'error');
    }
  }
  
  /**
   * Load and display an exercise
   */
  async loadExercise(xmlContent, exerciseName = 'Unknown') {
    try {
      // Parse exercise
      const exercise = await this.loader.parseXML(xmlContent);
      this.currentExercise = exercise;
      
      // Determine which tempo to use based on user preference
      const xmlTempo = exercise.tempo;
      let playbackTempo = this.settings.tempo; // Default to user's tempo
      
      if (this.settings.useXmlTempo) {
        // Use XML tempo - update settings and UI
        playbackTempo = xmlTempo;
        this.settings.tempo = xmlTempo;
        this.settingsManager.saveSettings(this.settings);
        this.syncUIWithSettings();
        this.showNotification(`Tempo set to ${xmlTempo} BPM from MusicXML`, 'info');
      } else {
        // Preserve user tempo - just notify about XML tempo
        this.showNotification(`MusicXML specifies ${xmlTempo} BPM, using your setting: ${this.settings.tempo} BPM`, 'info');
      }
      
      // Render notation - this is the critical async operation that takes time
      const container = document.getElementById('notation-container');
      this.renderer = new NotationRenderer();
      this.renderer.init(container);
      await this.renderer.render(exercise);
      
      // Create playback engine with appropriate tempo
      this.engine = new PlaybackEngine(exercise.timeline, {
        bpm: playbackTempo,
        timeSignature: exercise.timeSignature,
        instrument: document.getElementById('instrumentSelect').value,
        instrumentMode: document.getElementById('instrumentMode').value
      });
      
      // Subscribe to engine events
      this.engine.on('playback:started', (data) => {
        // CRITICAL FIX: Capture ACTUAL playback start time for timing synchronization
        this.sessionStartTime = data.startTime;
        this.playbackStartTime = data.startTime;
        console.log('✅ PLAYBACK ACTUALLY STARTED - Timing Synchronization Fixed:');
        console.log('- Actual playback start time:', this.sessionStartTime);
        console.log('- From now on, pitch timestamps will be calculated from this time');
        console.log('- This eliminates the session vs playback start time gap');
      });
      
      this.engine.on('playback:tick', (data) => {
        if (this.renderer) {
          this.renderer.clearHighlights();
          this.renderer.highlightNotes([data.noteId], 'active');
        }
      });
      
      this.engine.on('playback:completed', () => {
        this.updatePlaybackButtonStates('stopped');
        this.showNotification('Playback completed', 'success');
        
        // Run analysis if we have pitch data
        if (this.pitchStream.length > 0) {
          this.runAnalysis();
        }
      });
      
      this.engine.on('playback:error', (data) => {
        this.showNotification('Playback error: ' + data.error, 'error');
      });
      
      // Subscribe to audio events
      this.engine.on('audio:samplesLoaded', (data) => {
        this.showNotification(`${data.instrument} samples loaded`, 'success');
      });
      
      this.engine.on('audio:samplesError', (data) => {
        this.showNotification('Sample loading failed: ' + data.error, 'warning');
      });
      
      // CRITICAL FIX: Connect CalibrationManager to PlaybackEngine for consistent audio routing
      if (this.calibrationManager) {
        this.calibrationManager.setPlaybackEngine(this.engine);
        console.log('🔗 CalibrationManager connected to PlaybackEngine for consistent audio routing');
        // ENHANCED: Update with current instrument settings after PlaybackEngine is created
        this._updateCalibrationInstrumentSettings();
      }
      
      // IMPORTANT: Wait for any pending operations to complete before resolving
      // This ensures the exercise is fully loaded before the promise resolves
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log('Exercise loaded:', exercise.title || exerciseName);
      this.showNotification(`Loaded: ${exercise.title || exerciseName}`, 'success');
      
      // CRITICAL: Wait for the notification to be processed before resolving
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error('Exercise load error:', error);
      this.showNotification('Failed to load exercise: ' + error.message, 'error');
      throw error;
    }
  }
  
  /**
   * Read file content as text
   */
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
  
  /**
   * Show notification using UIManager for auto-hide functionality
   */
  showNotification(message, type = 'info') {
    if (this.uiManager) {
      // Use UIManager's notification system with 5-second auto-hide
      this.uiManager.showNotification(message, type, 5000);
    } else {
      // Fallback to direct DOM manipulation if UIManager not available
      const notification = document.getElementById('notification');
      if (!notification) return;

      // Set message
      notification.textContent = message;

      // Reset classes
      notification.className = 'notification';

      // Add type class
      notification.classList.add(`notification-${type}`);
      
      // Show notification
      notification.classList.remove('hidden');

      // Auto-hide after 5 seconds
      clearTimeout(this.notificationTimeout);
      this.notificationTimeout = setTimeout(() => {
        notification.classList.add('hidden');
      }, 5000);
    }
  }
  
  /**
   * Get current UI Manager instance
   */
  getUIManager() {
    return this.uiManager;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const app = new App();
    
    // Expose app to window for debugging
    window.app = app;
    
    console.log('Guitar4 app initialized with practice mode integration and audio calibration');
  } catch (error) {
    console.error('Failed to initialize Guitar4 app:', error);
  }
});
