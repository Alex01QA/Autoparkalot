// Textos comprobados en el JavaScript de Parkalot. Solo cuenta avisos nuevos.
export async function watchReservation(page) {
  await page.evaluate(() => {
    const state = window.__autoparkalotReservation = { status: 'pending' };
    const check = node => {
      if (state.status !== 'pending') return;
      const text = node.textContent?.trim();
      if (text === 'Successfully reserved') state.status = 'success';
      if (text === 'Could not reserve') state.status = 'rejected';
      if (text === 'Network error') state.status = 'unknown';
    };
    state.observer = new MutationObserver(records => {
      for (const record of records) {
        const nodes = record.type === 'characterData' ? [record.target] : [...record.addedNodes];
        for (const node of nodes) {
          check(node);
          node.querySelectorAll?.('*').forEach(check);
        }
      }
    });
    state.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
}

export async function reservationOutcome(page, timeout = 15000) {
  try {
    await page.waitForFunction(() => window.__autoparkalotReservation?.status !== 'pending', undefined, { polling: 20, timeout });
    return await page.evaluate(() => window.__autoparkalotReservation.status);
  } catch (error) {
    if (error.name !== 'TimeoutError') throw error;
    return 'unknown';
  } finally {
    await page.evaluate(() => window.__autoparkalotReservation?.observer.disconnect()).catch(() => {});
  }
}
