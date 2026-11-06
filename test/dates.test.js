import test from 'node:test';
import assert from 'node:assert/strict';
import { tomorrow, targetDate, dateLabels, normalize } from '../src/dates.js';

test('el viernes busca lunes según la fecha local, incluso si UTC ya es sábado', () => {
  for (const instant of ['2026-11-06T18:00:00Z', '2026-11-07T03:00:00Z']) {
    assert.equal(targetDate('America/Costa_Rica', new Date(instant)).toISOString().slice(0, 10), '2026-11-09');
  }
});
test('los demás días busca mañana, incluidos sábado y domingo', () => {
  for (const [today, expected] of [
    ['2026-11-05', '2026-11-06'],
    ['2026-11-07', '2026-11-08'],
    ['2026-11-08', '2026-11-09'],
  ]) {
    assert.equal(targetDate('America/Costa_Rica', new Date(`${today}T18:00:00Z`)).toISOString().slice(0, 10), expected);
  }
});
test('el salto de viernes a lunes resuelve cambios de año', () => {
  assert.equal(targetDate('UTC', new Date('2027-12-31T12:00:00Z')).toISOString().slice(0, 10), '2028-01-03');
});
test('al buscar lunes desde viernes no acepta la etiqueta Tomorrow del sábado', () => {
  const labels = dateLabels(new Date('2026-11-09T12:00:00Z'), { includeTomorrow: false }).map(normalize);
  assert.ok(labels.includes('november 9'));
  assert.ok(!labels.includes('tomorrow'));
  assert.ok(!labels.includes('manana'));
});

test('calcula mañana en Costa Rica aunque UTC ya esté en el día siguiente', () => {
  assert.equal(tomorrow('America/Costa_Rica', new Date('2026-11-06T03:00:00Z')).toISOString().slice(0, 10), '2026-11-06');
});
test('resuelve cambios de año y años bisiestos', () => {
  assert.equal(tomorrow('UTC', new Date('2026-12-31T12:00:00Z')).getUTCFullYear(), 2027);
  assert.equal(tomorrow('UTC', new Date('2028-02-28T12:00:00Z')).getUTCDate(), 29);
});
test('incluye fechas de Parkalot en inglés y español', () => {
  const labels = dateLabels(new Date('2026-11-06T12:00:00Z')).map(normalize);
  for (const label of ['November 6', '6 November', '6 de noviembre', '2026-11-06', 'Tomorrow']) {
    assert.ok(labels.includes(normalize(label)), label);
  }
});
