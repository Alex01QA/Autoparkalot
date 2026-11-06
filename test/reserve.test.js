import test from 'node:test';
import assert from 'node:assert/strict';
import { noonToday } from '../src/reserve.js';

test('mediodía de Costa Rica corresponde a 18:00 UTC del día local', () => {
  for (const instant of ['2026-11-06T15:00:00Z', '2026-11-07T03:00:00Z']) {
    assert.equal(new Date(noonToday('America/Costa_Rica', new Date(instant))).toISOString(), '2026-11-06T18:00:00.000Z');
  }
});
test('respeta la zona configurada incluso con horario de verano', () => {
  assert.equal(new Date(noonToday('America/New_York', new Date('2026-07-01T12:00:00Z'))).toISOString(), '2026-07-01T16:00:00.000Z');
});
