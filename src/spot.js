// Identificado en Parkalot: el círculo compartido abre Parqueo Norte 132.
export function reserveButton(page, number) {
  const title = page.getByText(`Parqueo Norte ${number}`, { exact: true }).filter({ visible: true });
  return title.locator('xpath=ancestor::*[.//button][1]').getByRole('button', { name: /^reserve$/i });
}

export function parkingSearch(page) {
  const muiSearch = page.locator('.MuiFormControl-root').filter({
    has: page.locator('label').filter({ hasText: /^Search$/i }),
  }).locator('input[type="text"]');
  return page.getByPlaceholder(/^search$/i).or(page.getByRole('textbox', { name: /^search$/i }))
    .or(muiSearch).filter({ visible: true });
}

export async function selectSpot(page, number = 132) {
  const title = page.getByText(`Parqueo Norte ${number}`, { exact: true }).filter({ visible: true });
  const search = parkingSearch(page);
  if (await search.count() === 1) {
    await search.fill(`Parqueo Norte ${number}`);
    await title.waitFor({ state: 'visible', timeout: 5000 });
  }
  if (!await title.count()) {
    if (number !== 132) throw new Error(`No se encontró Parqueo Norte ${number}.`);
    // La lista lateral es virtual: 132 no existe en el DOM hasta abrir su marcador.
    const handle = await page.waitForFunction(() => {
      const matches = [...document.querySelectorAll('svg')].filter(svg => {
        const width = parseFloat(svg.style.width);
        const height = parseFloat(svg.style.height);
        return svg.getClientRects().length && getComputedStyle(svg).visibility !== 'hidden' &&
          svg.style.position === 'absolute' &&
          Math.abs(parseFloat(svg.style.left) + width / 2 - 950.748) < 0.1 &&
          Math.abs(parseFloat(svg.style.top) + height / 2 - 1023.46) < 0.1 &&
          svg.querySelector('circle')?.getAttribute('fill')?.toLowerCase() === '#5a7996';
      });
      if (matches.length > 1) throw new Error('Marcador ambiguo; no se hizo clic.');
      return matches[0] || false;
    }, undefined, { timeout: 15000 });
    try {
      await handle.asElement().scrollIntoViewIfNeeded();
      await handle.asElement().click({ timeout: 10000 });
    } finally { await handle.dispose(); }
  } else {
    await title.scrollIntoViewIfNeeded();
    await title.click({ timeout: 10000 });
  }
  await title.waitFor({ state: 'visible', timeout: 10000 });
  // Buscar el control dentro de la tarjeta de este espacio, sin confirmar la reserva.
  const button = reserveButton(page, number);
  await button.waitFor({ state: 'visible', timeout: 5000 });
  return button;
}

export async function listOtherSpots(page) {
  const search = parkingSearch(page);
  if (await search.count() !== 1) throw new Error('No se encontró el buscador para recorrer los otros espacios.');
  await search.fill('Parqueo Norte');
  // El filtrado se aplica después de una pausa de escritura y desmonta tarjetas.
  await page.waitForTimeout(500);
  try {
    await page.getByText(/^Parqueo Norte \d+$/, { exact: true }).filter({ visible: true }).first()
      .waitFor({ state: 'visible', timeout: 5000 });
  } catch (error) {
    if (error.name !== 'TimeoutError') throw error;
    return [];
  }
  const names = new Set();
  // Recorrer la lista virtual para no limitarse a las primeras tarjetas visibles.
  for (let step = 0; step < 200; step++) {
    await page.waitForTimeout(100);
    const result = await page.evaluate(step => {
      const titles = [...document.querySelectorAll('*')].filter(el =>
        /^Parqueo Norte \d+$/.test(el.textContent?.trim() || '') &&
        ![...el.children].some(child => /^Parqueo Norte \d+$/.test(child.textContent?.trim() || '')) &&
        el.getClientRects().length);
      const numbers = titles.map(el => Number(el.textContent.trim().match(/\d+$/)[0]));
      let container = titles[0]?.parentElement;
      while (container && !(container.scrollHeight > container.clientHeight && /auto|scroll/.test(getComputedStyle(container).overflowY))) container = container.parentElement;
      if (!container) return { numbers, done: true };
      if (step === 0 && container.scrollTop > 0) {
        container.scrollTop = 0;
        return { numbers, done: false };
      }
      const before = container.scrollTop;
      container.scrollTop += Math.max(100, container.clientHeight * 0.8);
      return { numbers, done: container.scrollTop === before };
    }, step);
    result.numbers.forEach(n => names.add(n));
    if (result.done) break;
  }
  return [...names].filter(n => n !== 132 && n !== 129);
}
