/**
 * @module logger
 * @description Centralized logging utility with level filtering and error storage
 * 
 * Provides structured logging with different levels, local storage for error
 * tracking, and color-coded console output for development.
 */

class Logger {
  /**
   * Log levels enum
   */
  static ERROR = 'error';
  static WARN = 'warn';
  static INFO = 'info';
  static DEBUG = 'debug';

  /**
   * Maximum number of errors to store in LocalStorage
   */
  static MAX_ERRORS = 50;

  /**
   * LocalStorage key for error storage
   */
  static ERROR_KEY = 'g4:errors';

  /**
   * Log a message with level, module, and optional data
   * 
   * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG)
   * @param {string} module - Module or component name
   * @param {string} message - Log message
   * @param {Object} data - Optional data object
   * 
   * @example
   * Logger.log(Logger.ERROR, 'AudioEngine', 'Failed to start', { error: e });
   * Logger.log(Logger.INFO, 'Player', 'Started playback');
   */
  static log(level, module, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data
    };

    // Console output with formatting
    this._outputToConsole(logEntry);

    // Store errors in LocalStorage
    if (level === this.ERROR) {
      this._storeError(logEntry);
    }
  }

  /**
   * Store error in LocalStorage with circular buffer
   * 
   * @param {Object} logEntry - Error log entry to store
   */
  static _storeError(logEntry) {
    try {
      const existing = this.getErrors();
      existing.push(logEntry);
      
      // Maintain circular buffer
      if (existing.length > this.MAX_ERRORS) {
        existing.splice(0, existing.length - this.MAX_ERRORS);
      }
      
      localStorage.setItem(this.ERROR_KEY, JSON.stringify(existing));
    } catch (error) {
      // Handle quota exceeded or other LocalStorage errors gracefully
      console.warn('Logger: Failed to store error in LocalStorage:', error);
    }
  }

  /**
   * Output formatted log to console
   * 
   * @param {Object} logEntry - Log entry to output
   */
  static _outputToConsole(logEntry) {
    const { timestamp, level, module, message, data } = logEntry;
    const time = new Date(timestamp).toLocaleTimeString();
    
    // Prefix based on level
    let prefix = '';
    let consoleMethod = 'log';
    
    switch (level) {
      case this.ERROR:
        prefix = '❌';
        consoleMethod = 'error';
        break;
      case this.WARN:
        prefix = '⚠️';
        consoleMethod = 'warn';
        break;
      case this.INFO:
        prefix = 'ℹ️';
        consoleMethod = 'info';
        break;
      case this.DEBUG:
        prefix = '🔍';
        consoleMethod = 'debug';
        break;
    }
    
    const formattedMessage = `${prefix} [${time}] ${module}: ${message}`;
    
    if (Object.keys(data).length > 0) {
      console[consoleMethod](formattedMessage, data);
    } else {
      console[consoleMethod](formattedMessage);
    }
  }

  /**
   * Get all stored errors from LocalStorage
   * 
   * @returns {Array} Array of error log entries
   * 
   * @example
   * const errors = Logger.getErrors();
   * console.log('Recent errors:', errors);
   */
  static getErrors() {
    try {
      const stored = localStorage.getItem(this.ERROR_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Logger: Failed to retrieve errors from LocalStorage:', error);
      return [];
    }
  }

  /**
   * Clear all stored errors from LocalStorage
   * 
   * @example
   * Logger.clearErrors();
   */
  static clearErrors() {
    try {
      localStorage.removeItem(this.ERROR_KEY);
    } catch (error) {
      console.warn('Logger: Failed to clear errors from LocalStorage:', error);
    }
  }

  /**
   * Convenience method for logging errors
   * 
   * @param {string} module - Module name
   * @param {string} message - Error message
   * @param {Object} data - Optional error data
   * 
   * @example
   * Logger.error('AudioEngine', 'Failed to load sample', { file: 'A4.wav' });
   */
  static error(module, message, data = {}) {
    this.log(this.ERROR, module, message, data);
  }

  /**
   * Convenience method for logging warnings
   * 
   * @param {string} module - Module name
   * @param {string} message - Warning message
   * @param {Object} data - Optional data
   * 
   * @example
   * Logger.warn('Player', 'Low memory detected');
   */
  static warn(module, message, data = {}) {
    this.log(this.WARN, module, message, data);
  }

  /**
   * Convenience method for logging info
   * 
   * @param {string} module - Module name
   * @param {string} message - Info message
   * @param {Object} data - Optional data
   * 
   * @example
   * Logger.info('Player', 'Playback started', { tempo: 120 });
   */
  static info(module, message, data = {}) {
    this.log(this.INFO, module, message, data);
  }

  /**
   * Convenience method for logging debug messages
   * 
   * @param {string} module - Module name
   * @param {string} message - Debug message
   * @param {Object} data - Optional data
   * 
   * @example
   * Logger.debug('Analyzer', 'Processing note', { midi: 69 });
   */
  static debug(module, message, data = {}) {
    this.log(this.DEBUG, module, message, data);
  }
}

export { Logger };
