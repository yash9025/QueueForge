import test from 'node:test';
import assert from 'node:assert/strict';
import { createQueueSchema } from '../src/schemas/queue.schema';
import { createJobSchema } from '../src/schemas/job.schema';

test('Queue Schema Validation', async (t) => {
  await t.test('valid queue name passes', () => {
    const data = { name: 'email_queue-1' };
    const parsed = createQueueSchema.parse(data);
    assert.deepEqual(parsed, data);
  });

  await t.test('invalid queue name fails (spaces)', () => {
    const data = { name: 'email queue' };
    assert.throws(() => createQueueSchema.parse(data), /Queue name can only contain/);
  });

  await t.test('missing queue name fails', () => {
    assert.throws(() => createQueueSchema.parse({}), /expected string, received undefined/i);
  });
});

test('Job Schema Validation', async (t) => {
  await t.test('valid job passes with defaults', () => {
    const data = { type: 'send_email', payload: { to: 'test@example.com' } };
    const parsed = createJobSchema.parse(data);
    assert.equal(parsed.type, 'send_email');
    assert.equal(parsed.priority, 0); // Default priority
    assert.equal(parsed.max_attempts, 5); // Default max_attempts
    assert.deepEqual(parsed.payload, { to: 'test@example.com' });
  });

  await t.test('valid job passes with custom values', () => {
    const data = { 
      type: 'process_video', 
      payload: { id: 1 },
      priority: 10,
      max_attempts: 3,
      run_at: new Date().toISOString()
    };
    const parsed = createJobSchema.parse(data);
    assert.equal(parsed.priority, 10);
    assert.equal(parsed.max_attempts, 3);
  });

  await t.test('invalid priority fails', () => {
    const data = { type: 'send_email', priority: -1 };
    assert.throws(() => createJobSchema.parse(data), /Too small/i);
  });
});
