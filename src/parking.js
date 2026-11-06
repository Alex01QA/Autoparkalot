import { errors } from 'playwright';

export async function selectParking(page) {
  const name = 'Parqueo Norte';
  // El portal de MUI aplica aria-hidden al fondo mientras el menú está abierto.
  const dropdowns = page.getByRole('combobox', { includeHidden: true }).filter({ visible: true });
  await dropdowns.first().waitFor({ state: 'visible', timeout: 15000 });
  const north = dropdowns.filter({ hasText: /^\s*Parqueo Norte\s*$/ });
  // Si aún muestra otro parqueo, solo se elige automáticamente si hay un único selector.
  const dropdown = await north.count() ? north : dropdowns;
  if (await dropdown.count() !== 1) {
    throw new Error('No se pudo identificar un único dropdown de parqueo.');
  }
  if (await dropdown.getAttribute('aria-expanded') !== 'true') {
    await dropdown.click({ timeout: 10000 });
  }
  // MUI monta el menú en un portal; aria-controls puede cambiar durante la apertura.
  const option = page.getByRole('option', { name, exact: true }).filter({ visible: true });
  await option.waitFor({ state: 'visible', timeout: 10000 });
  await option.click({ timeout: 10000 });
  const waitClosed = () => page.waitForFunction(() =>
    ![...document.querySelectorAll('[role="option"]')].some(el =>
      el.textContent?.trim() === 'Parqueo Norte' && el.getClientRects().length &&
      getComputedStyle(el).visibility !== 'hidden'), undefined, { timeout: 2000 });
  try {
    await waitClosed();
  } catch (error) {
    if (!(error instanceof errors.TimeoutError)) throw error;
    // Si el menú solo enfocó la opción, confirmar esa misma opción con Enter.
    await option.focus();
    await option.press('Enter', { timeout: 5000 });
    await waitClosed();
  }
  await dropdown.filter({ hasText: /^\s*Parqueo Norte\s*$/ }).waitFor({ timeout: 10000 });
  await page.waitForFunction(() =>
    ![...document.querySelectorAll('[role="combobox"]')].some(el =>
      el.textContent?.trim() === 'Parqueo Norte' && el.getAttribute('aria-expanded') === 'true'),
  undefined, { timeout: 5000 });
}
