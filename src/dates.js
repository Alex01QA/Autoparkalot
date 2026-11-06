export function tomorrow(timeZone, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now).map(p => [p.type, p.value]));
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day + 1, 12));
}

export function targetDate(timeZone, now = new Date()) {
  const date = tomorrow(timeZone, now);
  // Si mañana es sábado, hoy es viernes en la zona horaria elegida.
  if (date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 2);
  return date;
}

export function dateLabels(date, { includeTomorrow = true } = {}) {
  const labels = new Set(includeTomorrow ? ['tomorrow', 'mañana'] : []);
  for (const locale of ['en-US', 'en-GB', 'es-CR', 'es-ES']) {
    for (const month of ['long', 'short']) {
      for (const year of [undefined, 'numeric']) {
        labels.add(new Intl.DateTimeFormat(locale, {
          timeZone: 'UTC', day: 'numeric', month, ...(year && { year }),
        }).format(date));
      }
    }
  }
  labels.add(date.toISOString().slice(0, 10));
  return [...labels];
}

export function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/g, '$1')
    .replace(/\b0([1-9])\b/g, '$1')
    .replace(/\b(?:de|of)\b/g, ' ').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}
