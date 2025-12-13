/**
 * @module settingsManager
 * @description Centralized settings management with persistence
 * 
 * Handles all application settings with automatic persistence to Storage.
 * Provides defaults, validation, and migration support.
 * 
 * @see RULES.md - Coding Standards (Client-Side Only v1)
 */

import { Storage } from '../core/storage.js';
import { STORAGE_KEYS } from './constants.js';
import { Logger } from './logger.js';

/**
 * Centralized settings management with persistence
 */
export class SettingsManager {
  constructor() {
    this.storage = new Storage();
    this.defaults = {
      instrument: 'acoustic',
      instrumentMode: 'synth',
      tempo: 120,
      volume: 0.7,
      metronomeEnabled: false,
      metronomeVolume: 0.5,
      difficulty: 'NORMAL',
      referencePitch: 440,
      tunerSmoothing: 0.2,
      analyzerSmoothing: 0.5,       // NEW: Temporal smoothing for analyzer (0-1, maps to 50-200ms window)
      lastExercise: null,
      // Tempo behavior settings
      useXmlTempo: true,            // Use tempo from MusicXML files by default
      // Audio latency calibration settings
      calibratedLatency: null,      // Measured latency from synthetic tone test
      hasCalibrated: false,         // Whether user has completed calibration
      fallbackLatency: 200,         // Default fallback latency (milliseconds)
      manualLatency: null           // Manual latency override (null = use calibrated)
    };
  }

  /**
   * Load all settings from storage
   * @returns {Object} Settings object with defaults for missing values
   */
  loadSettings() {
    const stored = this.storage.get(STORAGE_KEYS.SETTINGS, {});
    const settings = { ...this.defaults, ...stored };
    
    Logger.log(Logger.INFO, 'SettingsManager', 'Settings loaded', { settings });
    return settings;
  }

  /**
   * Save settings to storage
   * @param {Object} settings - Settings object to save
   */
  saveSettings(settings) {
    this.storage.set(STORAGE_KEYS.SETTINGS, settings);
    Logger.log(Logger.DEBUG, 'SettingsManager', 'Settings saved');
  }

  /**
   * Update specific setting
   * @param {string} key - Setting key
   * @param {*} value - New value
   */
  updateSetting(key, value) {
    const settings = this.loadSettings();
    settings[key] = value;
    this.saveSettings(settings);
  }

  /**
   * Get specific setting
   * @param {string} key - Setting key
   * @returns {*} Setting value or default
   */
  getSetting(key) {
    const settings = this.loadSettings();
    return settings[key];
  }

  /**
   * Get current effective latency (manual > calibrated > fallback)
   * @returns {number} Latency in milliseconds
   */
  getEffectiveLatency() {
    const settings = this.loadSettings();
    return settings.manualLatency ?? settings.calibratedLatency ?? settings.fallbackLatency;
  }

  /**
   * Save calibrated latency measurement
   * @param {number} latencyMs - Measured latency in milliseconds
   */
  saveCalibratedLatency(latencyMs) {
    const settings = this.loadSettings();
    settings.calibratedLatency = latencyMs;
    settings.hasCalibrated = true;
    this.saveSettings(settings);
    
    Logger.log(Logger.INFO, 'SettingsManager', 'Calibrated latency saved', { 
      latency: latencyMs 
    });
  }

  /**
   * Check if user has completed calibration
   * @returns {boolean} True if calibrated
   */
  isCalibrated() {
    return this.loadSettings().hasCalibrated;
  }

  /**
   * Reset calibration status
   */
  resetCalibration() {
    const settings = this.loadSettings();
    settings.calibratedLatency = null;
    settings.hasCalibrated = false;
    this.saveSettings(settings);

    Logger.log(Logger.INFO, 'SettingsManager', 'Calibration reset');
  }

  /**
   * Set manual latency override
   * @param {number|null} latencyMs - Manual latency in milliseconds, or null to use calibrated
   * @returns {boolean} True if value was valid and saved
   */
  setManualLatency(latencyMs) {
    if (latencyMs === null || (typeof latencyMs === 'number' && latencyMs >= 0 && latencyMs <= 500)) {
      this.updateSetting('manualLatency', latencyMs);
      Logger.log(Logger.INFO, 'SettingsManager', 'Manual latency set', { latency: latencyMs });
      return true;
    }
    Logger.log(Logger.WARN, 'SettingsManager', 'Invalid manual latency value', { latency: latencyMs });
    return false;
  }

  /**
   * Reset to defaults
   */
  resetToDefaults() {
    this.storage.delete(STORAGE_KEYS.SETTINGS);
    Logger.log(Logger.INFO, 'SettingsManager', 'Settings reset to defaults');
  }
}
