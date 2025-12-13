import { test } from 'node:test';
import assert from 'node:assert';
import { Logger } from '../../utils/logger.js';

// Mock localStorage for Node.js environment
global.localStorage = {
  data: {},
  getItem(key) { 
    return this.data[key] || null; 
  },
  setItem(key, value) { 
    this.data[key] = value; 
  },
  removeItem(key) { 
    delete this.data[key]; 
  },
  clear() {
    this.data = {};
  }
};

test('Logger - log() outputs to console', () => {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleInfo = console.info;
  const originalConsoleDebug = console.debug;
  
  let errorCalled = false;
  let warnCalled = false;
  let infoCalled = false;
  let debugCalled = false;
  
  console.error = () => { errorCalled = true; };
  console.warn = () => { warnCalled = true; };
  console.info = () => { infoCalled = true; };
  console.debug = () => { debugCalled = true; };
  
  Logger.log(Logger.ERROR, 'TestModule', 'Error message');
  assert.strictEqual(errorCalled, true);
  
  Logger.log(Logger.WARN, 'TestModule', 'Warning message');
  assert.strictEqual(warnCalled, true);
  
  Logger.log(Logger.INFO, 'TestModule', 'Info message');
  assert.strictEqual(infoCalled, true);
  
  Logger.log(Logger.DEBUG, 'TestModule', 'Debug message');
  assert.strictEqual(debugCalled, true);
  
  // Restore
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.info = originalConsoleInfo;
  console.debug = originalConsoleDebug;
});

test('Logger - ERROR level stored in LocalStorage', () => {
  Logger.clearErrors();
  
  Logger.log(Logger.ERROR, 'TestModule', 'Test error');
  
  const errors = Logger.getErrors();
  assert.strictEqual(errors.length, 1);
  assert.strictEqual(errors[0].level, Logger.ERROR);
  assert.strictEqual(errors[0].module, 'TestModule');
  assert.strictEqual(errors[0].message, 'Test error');
});

test('Logger - getErrors() retrieves stored errors', () => {
  Logger.clearErrors();
  
  Logger.log(Logger.ERROR, 'Module1', 'Error 1');
  Logger.log(Logger.ERROR, 'Module2', 'Error 2');
  
  const errors = Logger.getErrors();
  assert.strictEqual(errors.length, 2);
  assert.strictEqual(errors[0].message, 'Error 1');
  assert.strictEqual(errors[1].message, 'Error 2');
});

test('Logger - clearErrors() removes errors', () => {
  Logger.clearErrors();
  
  Logger.log(Logger.ERROR, 'TestModule', 'Test error');
  assert.strictEqual(Logger.getErrors().length, 1);
  
  Logger.clearErrors();
  assert.strictEqual(Logger.getErrors().length, 0);
});

test('Logger - circular buffer keeps 50 errors', () => {
  Logger.clearErrors();
  
  // Add 55 errors
  for (let i = 0; i < 55; i++) {
    Logger.log(Logger.ERROR, 'TestModule', `Error ${i}`);
  }
  
  const errors = Logger.getErrors();
  assert.strictEqual(errors.length, Logger.MAX_ERRORS);
  assert.strictEqual(errors.length, 50);
  
  // Should keep the last 50 errors
  assert.strictEqual(errors[0].message, 'Error 5');
  assert.strictEqual(errors[49].message, 'Error 54');
});

test('Logger - log entry structure correct', () => {
  Logger.clearErrors();
  
  const timestamp = new Date().toISOString();
  Logger.log(Logger.ERROR, 'TestModule', 'Test message', { extra: 'data' });
  
  const errors = Logger.getErrors();
  assert.strictEqual(errors.length, 1);
  
  const error = errors[0];
  assert.ok(error.timestamp);
  assert.strictEqual(error.level, Logger.ERROR);
  assert.strictEqual(error.module, 'TestModule');
  assert.strictEqual(error.message, 'Test message');
  assert.deepStrictEqual(error.data, { extra: 'data' });
});

test('Logger - convenience methods work', () => {
  Logger.clearErrors();
  
  Logger.error('TestModule', 'Error message');
  Logger.warn('TestModule', 'Warning message');
  Logger.info('TestModule', 'Info message');
  Logger.debug('TestModule', 'Debug message');
  
  const errors = Logger.getErrors();
  // Only ERROR should be stored
  assert.strictEqual(errors.length, 1);
  assert.strictEqual(errors[0].level, Logger.ERROR);
});

test('Logger - handles localStorage errors gracefully', () => {
  const originalSetItem = global.localStorage.setItem;
  global.localStorage.setItem = () => {
    throw new Error('Quota exceeded');
  };
  
  // Should not throw
  Logger.log(Logger.ERROR, 'TestModule', 'Test error');
  
  // Restore
  global.localStorage.setItem = originalSetItem;
});
