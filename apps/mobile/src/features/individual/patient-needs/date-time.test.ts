import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isRequiredByInFuture,
  hasRequiredDateTime,
  serializeRequiredBy,
} from './date-time.ts';

test('native picker date serializes to the existing ISO timestamp contract', () => {
  const selected = new Date(2027, 4, 12, 14, 30, 0, 0);
  const serialized = serializeRequiredBy(selected);
  assert.equal(serialized, selected.toISOString());
  assert.equal(new Date(serialized!).getTime(), selected.getTime());
});

test('empty, invalid, and past required-by values are rejected', () => {
  assert.equal(serializeRequiredBy(null), null);
  assert.equal(serializeRequiredBy(new Date(Number.NaN)), null);
  assert.equal(isRequiredByInFuture(new Date(1_000), 1_000), false);
  assert.equal(isRequiredByInFuture(new Date(1_001), 1_000), true);
  assert.equal(hasRequiredDateTime(false, false), false);
  assert.equal(hasRequiredDateTime(true, false), false);
  assert.equal(hasRequiredDateTime(false, true), false);
  assert.equal(hasRequiredDateTime(true, true), true);
});
