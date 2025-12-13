/**
 * LocalStorage abstraction with versioning and quota management
 * 
 * Provides structured storage API with namespace collision prevention,
 * schema versioning for migrations, and graceful error handling.
 * 
 * All keys are prefixed with "g4:" to avoid conflicts.
 * Data is wrapped with version and timestamp metadata.
 * 
 * @example
 * const storage = new Storage();
 * storage.set('settings', { instrument: 'guitar' });
 * const settings = storage.get('settings', defaultSettings);
 * 
 * @module storage
 * @extends EventEmitter
 * @see Architecture.md §3.9 (Storage Module)
 * @see Architecture.md §7.2 (Error Handling - Storage)
 * @see Architecture.md §8.2 (Memory Management - History Pruning)
 */

import { EventEmitter } from '../utils/eventEmitter.js';

// Storage key constants
const STORAGE_KEYS = {
  SETTINGS: 'settings',
  LAST_EXERCISE: 'lastExercise',
  EXERCISE_CACHE: 'exerciseCache:',  // + exerciseId
  PERFORMANCE_HISTORY: 'perfHistory',
  AUDIO_CONTEXT_STATE: 'audioContextState'
};

/**
 * LocalStorage abstraction with schema versioning and quota management
 * 
 * Provides structured storage API with namespace collision prevention,
 * schema versioning for migrations, and graceful error handling.
 */
class Storage extends EventEmitter {
  /**
   * Initialize Storage
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    super();
    
    this.namespace = 'g4:';
    this.schemaVersion = 1;
    this.inMemoryFallback = new Map();
    this.usingFallback = false;
    
    // Test LocalStorage availability
    this._checkAvailability();
  }
  
  /**
   * Check if LocalStorage is available and working
   * Falls back to in-memory storage if not available
   * @private
   */
  _checkAvailability() {
    try {
      const testKey = this.namespace + '__test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      this.usingFallback = false;
    } catch (error) {
      console.warn('LocalStorage unavailable, using in-memory fallback');
      this.usingFallback = true;
    }
  }
  
  /**
   * Wrap data with metadata for versioning
   * @private
   * @param {any} value - Data to wrap
   * @returns {Object} Wrapped data with version and timestamp
   */
  _wrapData(value) {
    return {
      version: this.schemaVersion,
      timestamp: Date.now(),
      data: value
    };
  }
  
  /**
   * Unwrap data and handle migration if needed
   * @private
   * @param {string} wrapped - Serialized wrapped data
   * @returns {any} Unwrapped data (migrated if necessary)
   */
  _unwrapData(wrapped) {
    try {
      const parsed = JSON.parse(wrapped);
      
      // Handle legacy data without version
      if (!parsed.version) {
        return parsed;  // Assume v1 format
      }
      
      // Migrate if needed
      if (parsed.version !== this.schemaVersion) {
        return this._migrateData(parsed);
      }
      
      return parsed.data;
    } catch (error) {
      console.error('Storage: Failed to unwrap data:', error);
      return null;
    }
  }
  
  /**
   * Migrate data from old schema to current schema
   * @private
   * @param {Object} oldData - Data with old schema version
   * @returns {any} Migrated data
   */
  _migrateData(oldData) {
    // Future migrations go here
    // Example:
    // if (oldData.version === 0) {
    //   return this._migrateV0toV1(oldData.data);
    // }
    
    console.warn(`No migration path from v${oldData.version} to v${this.schemaVersion}`);
    return oldData.data;
  }
  
  /**
   * Get value by key
   * @param {string} key - Storage key (without namespace prefix)
   * @param {any} defaultValue - Fallback if key not found
   * @returns {any} Stored value or default
   */
  get(key, defaultValue = null) {
    try {
      const fullKey = this.namespace + key;
      
      if (this.usingFallback) {
        const value = this.inMemoryFallback.get(fullKey);
        return value !== undefined ? value : defaultValue;
      }
      
      const wrapped = localStorage.getItem(fullKey);
      
      if (wrapped === null) {
        return defaultValue;
      }
      
      const unwrapped = this._unwrapData(wrapped);
      return unwrapped !== null ? unwrapped : defaultValue;
      
    } catch (error) {
      console.error(`Storage: Failed to get "${key}":`, error);
      return defaultValue;
    }
  }
  
  /**
   * Set value by key
   * @param {string} key - Storage key (without namespace prefix)
   * @param {any} value - Value to store (will be JSON serialized)
   * @returns {boolean} Success status
   */
  set(key, value) {
    try {
      const fullKey = this.namespace + key;
      const wrapped = this._wrapData(value);
      const serialized = JSON.stringify(wrapped);
      
      // Check size before storing (5MB limit per key)
      if (serialized.length > 5 * 1024 * 1024) {
        console.error(`Storage: Data too large for key "${key}" (${(serialized.length / 1024 / 1024).toFixed(2)}MB)`);
        return false;
      }
      
      if (this.usingFallback) {
        this.inMemoryFallback.set(fullKey, value);
        return true;
      }
      
      localStorage.setItem(fullKey, serialized);
      return true;
      
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        return this._handleQuotaExceeded(key);
      } else {
        console.error(`Storage: Failed to set "${key}":`, error);
        return false;
      }
    }
  }
  
  /**
   * Delete value by key
   * @param {string} key - Storage key (without namespace prefix)
   * @returns {boolean} Success status
   */
  delete(key) {
    try {
      const fullKey = this.namespace + key;
      
      if (this.usingFallback) {
        return this.inMemoryFallback.delete(fullKey);
      }
      
      localStorage.removeItem(fullKey);
      return true;
      
    } catch (error) {
      console.error(`Storage: Failed to delete "${key}":`, error);
      return false;
    }
  }
  
  /**
   * Clear all namespaced keys
   * @returns {boolean} Success status
   */
  clear() {
    try {
      if (this.usingFallback) {
        this.inMemoryFallback.clear();
        return true;
      }
      
      const keys = this.keys();
      keys.forEach(key => this.delete(key));
      return true;
      
    } catch (error) {
      console.error('Storage: Failed to clear:', error);
      return false;
    }
  }
  
  /**
   * Get all keys with optional prefix filter
   * @param {string} prefix - Optional key prefix to filter (without namespace)
   * @returns {string[]} Array of keys (without namespace prefix)
   */
  keys(prefix = '') {
    try {
      if (this.usingFallback) {
        const allKeys = Array.from(this.inMemoryFallback.keys());
        return allKeys
          .filter(key => key.startsWith(this.namespace + prefix))
          .map(key => key.substring(this.namespace.length));
      }
      
      const allKeys = Object.keys(localStorage);
      return allKeys
        .filter(key => key.startsWith(this.namespace + prefix))
        .map(key => key.substring(this.namespace.length));
        
    } catch (error) {
      console.error('Storage: Failed to get keys:', error);
      return [];
    }
  }
  
  /**
   * Check if key exists
   * @param {string} key - Storage key (without namespace prefix)
   * @returns {boolean} Existence status
   */
  has(key) {
    try {
      const fullKey = this.namespace + key;
      
      if (this.usingFallback) {
        return this.inMemoryFallback.has(fullKey);
      }
      
      return localStorage.getItem(fullKey) !== null;
      
    } catch (error) {
      console.error(`Storage: Failed to check "${key}":`, error);
      return false;
    }
  }
  
  /**
   * Handle quota exceeded error
   * Attempts to free space by pruning old data
   * @private
   * @param {string} attemptedKey - Key that triggered quota error
   * @returns {boolean} Whether space was freed
   */
  _handleQuotaExceeded(attemptedKey) {
    console.warn('Storage: Quota exceeded, attempting to free space');
    
    // Try to prune performance history
    const historyKey = STORAGE_KEYS.PERFORMANCE_HISTORY;
    const history = this.get(historyKey, []);
    
    if (history.length > 10) {
      // Keep only 10 most recent entries
      const trimmed = history.slice(-10);
      
      try {
        // Direct write without wrapper to save space
        const serialized = JSON.stringify(this._wrapData(trimmed));
        localStorage.setItem(this.namespace + historyKey, serialized);
        
        console.log(`Storage: Trimmed history from ${history.length} to ${trimmed.length} entries`);
        
        // Try original operation again
        return this.set(attemptedKey, this.get(attemptedKey));
        
      } catch (error) {
        console.error('Storage: Failed to free space:', error);
        return false;
      }
    }
    
    // Emit event for UI notification
    this._emitQuotaEvent();
    return false;
  }
  
  /**
   * Emit quota exceeded event (if EventEmitter available)
   * @private
   */
  _emitQuotaEvent() {
    const usage = this.getStorageUsage();
    console.error('Storage quota exceeded', {
      usage: `${usage.usedMB.toFixed(2)}MB`,
      recommendation: 'Clear old performance history or cached exercises'
    });
  }
  
  /**
   * Calculate total storage usage for namespaced keys
   * @returns {Object} Usage statistics
   */
  getStorageUsage() {
    try {
      if (this.usingFallback) {
        let totalSize = 0;
        this.inMemoryFallback.forEach((value, key) => {
          if (key.startsWith(this.namespace)) {
            totalSize += JSON.stringify(value).length;
          }
        });
        
        return {
          usedBytes: totalSize,
          usedKB: totalSize / 1024,
          usedMB: totalSize / 1024 / 1024
        };
      }
      
      let totalSize = 0;
      const keys = this.keys();
      
      keys.forEach(key => {
        const fullKey = this.namespace + key;
        const value = localStorage.getItem(fullKey);
        if (value) {
          totalSize += value.length;
        }
      });
      
      return {
        usedBytes: totalSize,
        usedKB: totalSize / 1024,
        usedMB: totalSize / 1024 / 1024
      };
      
    } catch (error) {
      console.error('Storage: Failed to calculate usage:', error);
      return { usedBytes: 0, usedKB: 0, usedMB: 0 };
    }
  }
  
  /**
   * Add entry to performance history with circular buffer
   * @param {Object} result - AnalysisResult to store
   * @returns {boolean} Success status
   */
  addPerformanceResult(result) {
    try {
      const historyKey = STORAGE_KEYS.PERFORMANCE_HISTORY;
      let history = this.get(historyKey, []);
      
      // Add new entry
      history.push({
        exerciseId: result.exerciseId,
        timestamp: result.timestamp || Date.now(),
        score: result.aggregate,
        tolerances: result.tolerances,
        duration: result.duration
      });
      
      // Circular buffer: keep only last 100 entries
      if (history.length > 100) {
        history = history.slice(-100);
      }
      
      return this.set(historyKey, history);
      
    } catch (error) {
      console.error('Storage: Failed to add performance result:', error);
      return false;
    }
  }
  
  /**
   * Export all namespaced data to JSON
   * @returns {string} JSON string of all stored data
   */
  exportData() {
    try {
      const allData = {};
      const keys = this.keys();
      
      keys.forEach(key => {
        allData[key] = this.get(key);
      });
      
      return JSON.stringify(allData, null, 2);
      
    } catch (error) {
      console.error('Storage: Failed to export data:', error);
      return '{}';
    }
  }
  
  /**
   * Import data from JSON string
   * @param {string} jsonData - JSON string of exported data
   * @returns {boolean} Success status
   */
  importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      
      Object.keys(data).forEach(key => {
        this.set(key, data[key]);
      });
      
      console.log(`Imported ${Object.keys(data).length} keys`);
      return true;
      
    } catch (error) {
      console.error('Storage: Failed to import data:', error);
      return false;
    }
  }
  
  /**
   * Get usage statistics (alias for getStorageUsage)
   * @returns {Object} Usage statistics
   */
  getUsage() {
    return this.getStorageUsage();
  }
  
  /**
   * Clean up old data to free space
   * @param {number} targetSize - Target size in bytes
   * @returns {boolean} Success status
   */
  cleanup(targetSize) {
    try {
      const currentUsage = this.getStorageUsage();
      
      if (currentUsage.usedBytes <= targetSize) {
        return true;  // Already under target
      }
      
      // Prune performance history first
      const historyKey = STORAGE_KEYS.PERFORMANCE_HISTORY;
      const history = this.get(historyKey, []);
      
      if (history.length > 20) {
        const trimmed = history.slice(-20);  // Keep last 20
        this.set(historyKey, trimmed);
      }
      
      return this.getStorageUsage().usedBytes <= targetSize;
      
    } catch (error) {
      console.error('Storage: Failed to cleanup:', error);
      return false;
    }
  }
}

export { Storage, STORAGE_KEYS };
