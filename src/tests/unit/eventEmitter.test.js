import { test } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from '../../utils/eventEmitter.js';

test('EventEmitter - on() registers listener', () => {
  const emitter = new EventEmitter();
  let called = false;
  
  emitter.on('test', () => {
    called = true;
  });
  
  emitter.emit('test', { data: 'value' });
  
  assert.strictEqual(called, true);
});

test('EventEmitter - emit() calls listener with data', () => {
  const emitter = new EventEmitter();
  let receivedData = null;
  
  emitter.on('test', (data) => {
    receivedData = data;
  });
  
  emitter.emit('test', { test: 'data' });
  
  assert.deepStrictEqual(receivedData, { test: 'data' });
});

test('EventEmitter - off() removes listener', () => {
  const emitter = new EventEmitter();
  let callCount = 0;
  
  const listener = () => {
    callCount++;
  };
  
  emitter.on('test', listener);
  emitter.emit('test');
  emitter.off('test', listener);
  emitter.emit('test');
  
  assert.strictEqual(callCount, 1);
});

test('EventEmitter - once() calls listener only once', () => {
  const emitter = new EventEmitter();
  let callCount = 0;
  
  emitter.once('test', () => {
    callCount++;
  });
  
  emitter.emit('test');
  emitter.emit('test');
  
  assert.strictEqual(callCount, 1);
});

test('EventEmitter - multiple listeners for same event', () => {
  const emitter = new EventEmitter();
  let count1 = 0;
  let count2 = 0;
  
  emitter.on('test', () => count1++);
  emitter.on('test', () => count2++);
  
  emitter.emit('test');
  
  assert.strictEqual(count1, 1);
  assert.strictEqual(count2, 1);
});

test('EventEmitter - on() returns unsubscribe function', () => {
  const emitter = new EventEmitter();
  let callCount = 0;
  
  const unsubscribe = emitter.on('test', () => {
    callCount++;
  });
  
  emitter.emit('test');
  unsubscribe();
  emitter.emit('test');
  
  assert.strictEqual(callCount, 1);
});

test('EventEmitter - error in listener doesn\'t crash other listeners', () => {
  const emitter = new EventEmitter();
  let errorListenerCalled = false;
  let normalListenerCalled = false;
  
  emitter.on('test', () => {
    throw new Error('Test error');
  });
  
  emitter.on('test', () => {
    normalListenerCalled = true;
  });
  
  // Should not throw
  emitter.emit('test');
  
  assert.strictEqual(normalListenerCalled, true);
});

test('EventEmitter - emitting with no listeners', () => {
  const emitter = new EventEmitter();
  
  // Should not throw
  emitter.emit('nonexistent');
  
  assert.ok(true); // If we reach here, test passed
});
