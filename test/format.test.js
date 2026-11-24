import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatCountdown,
  formatRelativeTime,
  maskKey,
} from '../lib/format.js';

test('maskKey hides the middle of long keys', () => {
  assert.equal(maskKey('sk-ant-oat01-abcdefgh'), 'sk-ant...efgh');
  assert.equal(maskKey('short'), 'sho...');
});

test('formatRelativeTime renders both directions', () => {
  assert.equal(formatRelativeTime(new Date(Date.now() + 90 * 1000)), 'in 1m');
  assert.equal(formatRelativeTime(new Date(Date.now() - 2 * 60 * 60 * 1000 - 5 * 60 * 1000)), '2h 5m ago');
  assert.equal(formatRelativeTime(new Date(Date.now() + 500)), 'now');
  assert.equal(formatRelativeTime(new Date('bogus')), 'unknown');
});

test('formatCountdown shows seconds under an hour and stays coarse above', () => {
  const now = Date.parse('2026-07-14T00:00:00Z');
  const realNow = Date.now;
  Date.now = () => now;

  try {
    assert.equal(formatCountdown(new Date(now + 45 * 60 * 1000 + 12 * 1000)), 'in 45m 12s');
    assert.equal(formatCountdown(new Date(now + 9 * 1000)), 'in 9s');
    assert.equal(formatCountdown(new Date(now - 3 * 60 * 1000 - 5 * 1000)), '3m 5s ago');
    assert.equal(formatCountdown(new Date(now + 2 * 60 * 60 * 1000)), 'in 2h'); // >= 1h stays coarse
    assert.equal(formatCountdown(new Date(now + 500)), 'now');
    assert.equal(formatCountdown(new Date('bogus')), 'unknown');
  } finally {
    Date.now = realNow;
  }
});
