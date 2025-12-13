/**
 * @module uiManager
 * @description Main user interface controller
 * 
 * Manages UI state, handles user interactions, coordinates between
 * different views and application modules.
 * 
 * @extends EventEmitter
 * 
 * @fires UIManager#tabChanged
 * @fires UIManager#modeChanged
 * @fires UIManager#settingsChanged
 * 
 * @example
 * const uiManager = new UIManager();
 * uiManager.on('tabChanged', (tab) => {
 *   console.log('Switched to tab:', tab);
 * });
 */

import { EventEmitter } from '../utils/eventEmitter.js';
import { Logger } from '../utils/logger.js';
import { Tuner } from './tuner.js';

/**
 * UIManager - Controls application UI state and user interactions
 * 
 * Responsibilities:
 * - Manage tab navigation and view switching
 * - Handle keyboard shortcuts and user input
 * - Coordinate with other modules for UI updates
 * - Store and restore UI state
 * - Manage application settings and preferences
 */
export default class UIManager extends EventEmitter {
  /**
   * Initialize UIManager
   * 
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    super();
    
    this.config = {
      enableShortcuts: true,
      autoSave: true,
      ...config
    };
    
    // Current state
    this.currentTab = 'practice';
    this.currentMode = 'practice';
    this.isInitialized = false;
    
    // DOM elements cache
    this.elements = new Map();
    
    // Settings
    this.settings = new Map();
    
    // Keyboard shortcuts
    this.shortcuts = new Map();
    
    // Module references
    this.tuner = null;
    
    Logger.log(Logger.INFO, 'UIManager', 'UIManager initialized', {
      enableShortcuts: this.config.enableShortcuts
    });
  }

  /**
   * Initialize UI manager and setup event listeners
   * 
   * @param {Object} modules - References to other application modules
   * @returns {Promise<void>}
   */
  async init(modules = {}) {
    if (this.isInitialized) {
      Logger.log(Logger.WARN, 'UIManager', 'Already initialized');
      return;
    }
    
    try {
      // Store module references
      this.modules = modules;
      
      // Setup DOM element cache
      await this._cacheElements();
      
      // Setup event listeners
      this._setupEventListeners();
      
      // Setup keyboard shortcuts
      if (this.config.enableShortcuts) {
        this._setupKeyboardShortcuts();
      }
      
      // Initialize tuner if available
      if (modules.tuner) {
        this.tuner = new Tuner();
        await this._setupTunerIntegration();
      }
      
      // Restore saved state
      await this._restoreState();
      
      // Set initial tab
      this._setActiveTab(this.currentTab);
      
      this.isInitialized = true;
      
      Logger.log(Logger.INFO, 'UIManager', 'UIManager initialization complete');
      
    } catch (error) {
      Logger.log(Logger.ERROR, 'UIManager', 'Initialization failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Switch to a different tab
   * 
   * @param {string} tabId - Tab identifier ('practice', 'tuner', 'settings')
   * @returns {void}
   */
  switchTab(tabId) {
    if (!['practice', 'tuner', 'lessons', 'settings'].includes(tabId)) {
      Logger.log(Logger.WARN, 'UIManager', 'Invalid tab ID', { tabId });
      return;
    }
    
    const previousTab = this.currentTab;
    this.currentTab = tabId;
    
    // Update UI
    this._setActiveTab(tabId);
    
    // Emit event
    this.emit('tabChanged', {
      currentTab: tabId,
      previousTab: previousTab
    });
    
    Logger.log(Logger.DEBUG, 'UIManager', 'Tab switched', {
      from: previousTab,
      to: tabId
    });
  }

  /**
   * Get current tab
   * 
   * @returns {string} Current tab identifier
   */
  getCurrentTab() {
    return this.currentTab;
  }

  /**
   * Set active tab in UI
   * 
   * @param {string} tabId - Tab to activate
   * @private
   */
  _setActiveTab(tabId) {
    // Remove active class from all tabs
    const allTabs = this.elements.get('tabs');
    if (allTabs) {
      allTabs.forEach(tab => tab.classList.remove('active'));
    }
    
    // Add active class to target tab
    const targetTab = this.elements.get(`tab-${tabId}`);
    if (targetTab) {
      targetTab.classList.add('active');
    }
    
    // Show/hide tab content
    this._updateTabContent(tabId);
  }

  /**
   * Update tab content visibility
   * 
   * @param {string} activeTabId - Currently active tab
   * @private
   */
  _updateTabContent(activeTabId) {
    // Hide all tab panels using visibility instead of display to preserve SVG content
    const tabPanels = this.elements.get('tab-panels');
    if (tabPanels) {
      tabPanels.forEach((panel, id) => {
        if (id === activeTabId) {
          panel.style.visibility = 'visible';
          panel.style.position = 'relative';
        } else {
          panel.style.visibility = 'hidden';
          panel.style.position = 'absolute';
        }
      });
    }
    
    // Alternative fallback for direct DOM manipulation
    if (!tabPanels) {
      const allPanels = document.querySelectorAll('.tab-content');
      allPanels.forEach(panel => {
        if (panel.id && panel.id.replace('-tab', '') === activeTabId) {
          panel.style.visibility = 'visible';
          panel.style.position = 'relative';
        } else {
          panel.style.visibility = 'hidden';
          panel.style.position = 'absolute';
        }
      });
    }
  }

  /**
   * Cache frequently used DOM elements
   * 
   * @private
   */
  async _cacheElements() {
    // Cache tab buttons
    const tabButtons = document.querySelectorAll('[data-tab]');
    const tabsMap = new Map();
    tabButtons.forEach(button => {
      const tabId = button.getAttribute('data-tab');
      tabsMap.set(tabId, button);
    });
    this.elements.set('tabs', tabsMap);
    
    // Cache tab panels using IDs instead of data-panel
    const tabPanels = document.querySelectorAll('.tab-content');
    const panelsMap = new Map();
    tabPanels.forEach(panel => {
      if (panel.id) {
        const panelId = panel.id.replace('-tab', ''); // Remove '-tab' suffix
        panelsMap.set(panelId, panel);
      }
    });
    this.elements.set('tab-panels', panelsMap);
    
    // Cache individual elements
    this.elements.set('tab-practice', document.querySelector('[data-tab="practice"]'));
    this.elements.set('tab-tuner', document.querySelector('[data-tab="tuner"]'));
    this.elements.set('tab-lessons', document.querySelector('[data-tab="lessons"]'));
    this.elements.set('tab-settings', document.querySelector('[data-tab="settings"]'));
    this.elements.set('panel-practice', document.getElementById('practice-tab'));
    this.elements.set('panel-tuner', document.getElementById('tuner-tab'));
    this.elements.set('panel-lessons', document.getElementById('lessons-tab'));
    this.elements.set('panel-settings', document.getElementById('settings-tab'));
  }

  /**
   * Setup event listeners for UI interactions
   * 
   * @private
   */
  _setupEventListeners() {
    // Tab click handlers
    const tabButtons = this.elements.get('tabs');
    if (tabButtons) {
      tabButtons.forEach((button, tabId) => {
        button.addEventListener('click', () => {
          this.switchTab(tabId);
        });
      });
    }
    
    // Settings change handlers
    const settingsInputs = document.querySelectorAll('[data-setting]');
    settingsInputs.forEach(input => {
      input.addEventListener('change', (event) => {
        this._handleSettingChange(event);
      });
    });
  }

  /**
   * Setup keyboard shortcuts
   * 
   * @private
   */
  _setupKeyboardShortcuts() {
    // Common shortcuts
    this.shortcuts.set('space', () => this._handlePlayPause());
    this.shortcuts.set('escape', () => this._handleEscape());
    this.shortcuts.set('t', () => this.switchTab('tuner'));
    this.shortcuts.set('p', () => this.switchTab('practice'));
    this.shortcuts.set('l', () => this.switchTab('lessons'));
    this.shortcuts.set('s', () => this.switchTab('settings'));
    
    // Global keydown listener
    document.addEventListener('keydown', (event) => {
      this._handleKeydown(event);
    });
  }

  /**
   * Handle keyboard events
   * 
   * @param {KeyboardEvent} event - Keyboard event
   * @private
   */
  _handleKeydown(event) {
    // Ignore if user is typing in an input field
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return;
    }
    
    const key = event.key.toLowerCase();
    const shortcut = this.shortcuts.get(key);
    
    if (shortcut && event.ctrlKey === false && event.metaKey === false) {
      event.preventDefault();
      shortcut();
    }
  }

  /**
   * Handle play/pause shortcut
   * 
   * @private
   */
  _handlePlayPause() {
    if (this.modules.playbackEngine) {
      this.modules.playbackEngine.togglePlayPause();
    }
  }

  /**
   * Handle escape key
   * 
   * @private
   */
  _handleEscape() {
    // Stop any active playback
    if (this.modules.playbackEngine) {
      this.modules.playbackEngine.stop();
    }
    
    // Clear any active selections
    this.emit('escapePressed');
  }

  /**
   * Handle settings change
   * 
   * @param {Event} event - Change event
   * @private
   */
  _handleSettingChange(event) {
    const settingName = event.target.getAttribute('data-setting');
    const settingValue = event.target.type === 'checkbox' 
      ? event.target.checked 
      : event.target.value;
    
    this.settings.set(settingName, settingValue);
    
    // Emit settings changed event
    this.emit('settingsChanged', {
      setting: settingName,
      value: settingValue
    });
    
    // Auto-save if enabled
    if (this.config.autoSave) {
      this._saveSettings();
    }
  }

  /**
   * Setup tuner integration
   * 
   * @private
   */
  async _setupTunerIntegration() {
    if (!this.tuner) return;
    
    // Listen to tuner events
    this.tuner.on('pitchDetected', (data) => {
      this._updateTunerDisplay(data);
    });
    
    this.tuner.on('noteDetected', (data) => {
      this._updateNoteDisplay(data);
    });
  }

  /**
   * Update tuner display
   * 
   * @param {Object} pitchData - Pitch detection data
   * @private
   */
  _updateTunerDisplay(pitchData) {
    const frequency = pitchData.frequency;
    const cents = pitchData.cents;
    
    // Update frequency display
    const freqElement = this.elements.get('tuner-frequency');
    if (freqElement) {
      freqElement.textContent = `${frequency.toFixed(2)} Hz`;
    }
    
    // Update cents display
    const centsElement = this.elements.get('tuner-cents');
    if (centsElement) {
      const isInTune = Math.abs(cents) < 5;
      centsElement.textContent = `${cents > 0 ? '+' : ''}${cents.toFixed(1)} cents`;
      centsElement.className = isInTune ? 'in-tune' : 'out-of-tune';
    }
    
    // Update needle position (visual tuning indicator)
    const needleElement = this.elements.get('tuner-needle');
    if (needleElement) {
      const clampedCents = Math.max(-50, Math.min(50, cents));
      const percentage = (clampedCents + 50) / 100;
      needleElement.style.transform = `rotate(${percentage * 180 - 90}deg)`;
    }
  }

  /**
   * Update note display
   * 
   * @param {Object} noteData - Note detection data
   * @private
   */
  _updateNoteDisplay(noteData) {
    const note = noteData.note;
    const octave = noteData.octave;
    
    // Update note display
    const noteElement = this.elements.get('tuner-note');
    if (noteElement) {
      noteElement.textContent = `${note}${octave}`;
    }
  }

  /**
   * Save settings to storage
   * 
   * @private
   */
  _saveSettings() {
    try {
      const settingsObj = Object.fromEntries(this.settings);
      localStorage.setItem('g4:ui-settings', JSON.stringify(settingsObj));
    } catch (error) {
      Logger.log(Logger.WARN, 'UIManager', 'Failed to save settings', {
        error: error.message
      });
    }
  }

  /**
   * Restore settings from storage
   * 
   * @private
   */
  async _restoreState() {
    try {
      // Restore settings
      const savedSettings = localStorage.getItem('g4:ui-settings');
      if (savedSettings) {
        const settingsObj = JSON.parse(savedSettings);
        Object.entries(settingsObj).forEach(([key, value]) => {
          this.settings.set(key, value);
          
          // Update UI elements
          const element = document.querySelector(`[data-setting="${key}"]`);
          if (element) {
            if (element.type === 'checkbox') {
              element.checked = value;
            } else {
              element.value = value;
            }
          }
        });
      }
      
      // Restore current tab
      const savedTab = localStorage.getItem('g4:ui-current-tab');
      if (savedTab && ['practice', 'tuner', 'lessons', 'settings'].includes(savedTab)) {
        this.currentTab = savedTab;
      }
      
    } catch (error) {
      Logger.log(Logger.WARN, 'UIManager', 'Failed to restore state', {
        error: error.message
      });
    }
  }

  /**
   * Get current settings
   * 
   * @returns {Object} Current settings object
   */
  getSettings() {
    return Object.fromEntries(this.settings);
  }

  /**
   * Set a specific setting
   * 
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   */
  setSetting(key, value) {
    this.settings.set(key, value);
    
    // Update UI element if exists
    const element = document.querySelector(`[data-setting="${key}"]`);
    if (element) {
      if (element.type === 'checkbox') {
        element.checked = value;
      } else {
        element.value = value;
      }
    }
    
    // Emit settings changed event
    this.emit('settingsChanged', { setting: key, value });
    
    // Save if auto-save is enabled
    if (this.config.autoSave) {
      this._saveSettings();
    }
  }

  /**
   * Show notification (for app.js compatibility)
   * 
   * @param {string} message - Notification message
   * @param {string} type - Message type ('info', 'success', 'warning', 'error')
   * @param {number} duration - Auto-hide duration in milliseconds
   */
  showNotification(message, type = 'info', duration = 5000) {
    this.showStatus(message, type);
    
    // Additional notification logic if needed
    Logger.log(Logger.INFO, 'UIManager', 'Notification shown', { message, type, duration });
  }

  /**
   * Update status message
   * 
   * @param {string} message - Status message
   * @param {string} type - Message type ('info', 'success', 'warning', 'error')
   */
  showStatus(message, type = 'info') {
    // Use the notification element from index.html
    const notificationElement = document.getElementById('notification');
    const messageElement = notificationElement?.querySelector('.notification-message');
    
    if (notificationElement && messageElement) {
      // Set message
      messageElement.textContent = message;
      
      // Reset classes
      notificationElement.className = 'notification';
      
      // Add type class
      notificationElement.classList.add(`notification-${type}`);
      
      // Show notification
      notificationElement.classList.remove('hidden');
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        notificationElement.classList.add('hidden');
      }, 5000);
    } else {
      // Fallback: try status-message element if notification doesn't exist
      const statusElement = document.getElementById('status-message');
      if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status ${type}`;
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
          statusElement.textContent = '';
          statusElement.className = 'status';
        }, 5000);
      }
    }
    
    Logger.log(Logger.INFO, 'UIManager', 'Status updated', { message, type });
  }

  /**
   * Show/hide loading indicator
   * 
   * @param {boolean} show - Whether to show loading indicator
   * @param {string} message - Optional loading message
   */
  setLoading(show, message = 'Loading...') {
    const loadingElement = document.getElementById('loading-indicator');
    if (loadingElement) {
      if (show) {
        loadingElement.style.display = 'flex';
        loadingElement.querySelector('.loading-message').textContent = message;
      } else {
        loadingElement.style.display = 'none';
      }
    }
  }

  /**
   * Destroy UIManager and cleanup
   */
  destroy() {
    // Save current state
    localStorage.setItem('g4:ui-current-tab', this.currentTab);
    this._saveSettings();
    
    // Remove event listeners
    document.removeEventListener('keydown', this._handleKeydown);
    
    // Clear references
    this.elements.clear();
    this.settings.clear();
    this.shortcuts.clear();
    
    this.removeAllListeners();
    this.shortcuts.clear();
    
    Logger.log(Logger.DEBUG, 'UIManager', 'UIManager destroyed');
  }
}
