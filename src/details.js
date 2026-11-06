import { normalize } from './dates.js';

export async function findDetails(page, labels) {
  // Preferir el elemento interactivo: su texto puede incluir un icono además de Details.
  const buttons = page.getByRole('button', { name: /\bdetails\b/i })
    .or(page.getByRole('link', { name: /\bdetails\b/i }));
  const candidates = await buttons.count() ? buttons : page.getByText(/^\s*Details\s*$/i);
  const matches = [];
  for (const button of await candidates.all()) {
    if (!await button.isVisible()) continue;
    const texts = await button.evaluate(element => {
      const texts = [];
      const visible = el => !!(el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
      for (let row = element.parentElement; row && row !== document.body; row = row.parentElement) {
        // Contar un botón una sola vez aunque tenga spans anidados.
        const controls = [...row.querySelectorAll('button, a, [role="button"], [role="link"]')]
          .filter(el => visible(el) && /\bdetails\b/i.test(el.innerText || el.getAttribute('aria-label') || ''));
        const leaves = [...row.querySelectorAll('*')].filter(el => visible(el) &&
          /^\s*Details\s*$/i.test(el.textContent || '') &&
          ![...el.children].some(child => /^\s*Details\s*$/i.test(child.textContent || '')));
        if (controls.length > 1 || leaves.length > 1) break;
        texts.push(row.innerText || '');
      }
      return texts;
    });
    if (texts.some(text => labels.some(label => ` ${normalize(text)} `.includes(` ${label} `)))) {
      matches.push(button);
    }
  }
  return matches;
}
