import { selectSpot, reserveButton, listOtherSpots } from './spot.js';
import { watchReservation, reservationOutcome } from './outcome.js';

export function noonToday(timeZone, now = new Date()) {
  const fields = date => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]));
  const local = fields(now);
  const desired = Date.UTC(+local.year, +local.month - 1, +local.day, 12);
  let instant = desired;
  for (let i = 0; i < 3; i++) {
    const p = fields(new Date(instant));
    instant += desired - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  }
  return instant;
}

export async function reserveAtNoon(page, timeZone, {
  releaseAt = noonToday(timeZone), graceMs = 300000,
  availabilityMs = 3000, outcomeMs = 15000,
} = {}) {
  console.log(`Esperando mediodía (${timeZone}). Prioridad: 132 → 129 → otros de Parqueo Norte.`);
  const deadline = Math.max(Date.now(), releaseAt) + graceMs;
  while (Date.now() < releaseAt) {
    if (page.isClosed()) throw new Error('Se cerró el navegador antes de la hora de reserva.');
    await new Promise(resolve => setTimeout(resolve, Math.min(30000, releaseAt - Date.now())));
  }
  const queue = [132, 129];
  let othersLoaded = false;
  for (let index = 0; Date.now() < deadline; index++) {
    if (index >= queue.length) {
      if (othersLoaded) break;
      queue.push(...await listOtherSpots(page));
      othersLoaded = true;
      if (index >= queue.length) break;
    }
    const number = queue[index];
    let button;
    try {
      // 132 ya está abierto antes de mediodía: evitar plegarlo al primer intento.
      button = reserveButton(page, number);
      if (!await button.isVisible()) button = await selectSpot(page, number);
      await button.scrollIntoViewIfNeeded();
      await button.evaluate(el => { el.dataset.autoparkalotReserve = 'target'; });
      await page.waitForFunction(() => {
        const el = document.querySelector('[data-autoparkalot-reserve="target"]');
        return el && !el.matches(':disabled') && el.getAttribute('aria-disabled') !== 'true';
      }, undefined, { polling: 20, timeout: Math.min(availabilityMs, Math.max(1, deadline - Date.now())) });
    } catch (error) {
      if (error.name !== 'TimeoutError') throw error;
      console.log(`Parqueo Norte ${number} no tiene Reserve disponible; probando el siguiente.`);
      continue;
    } finally {
      await page.locator('[data-autoparkalot-reserve]').evaluateAll(es => es.forEach(el => el.removeAttribute('data-autoparkalot-reserve')));
    }
    await watchReservation(page);
    try {
      await button.click({ timeout: Math.max(1, Math.min(5000, deadline - Date.now())) });
    } catch (error) {
      await reservationOutcome(page, 1);
      throw new Error(`Resultado incierto del clic en ${number}; se detiene para evitar duplicados.`, { cause: error });
    }
    const outcome = await reservationOutcome(page, outcomeMs);
    if (outcome === 'success') {
      console.log(`Reserva confirmada por Parkalot: Parqueo Norte ${number}.`);
      return number;
    }
    if (outcome !== 'rejected') throw new Error(`Resultado incierto de la reserva de ${number}; revisa Parkalot antes de volver a ejecutar.`);
    console.log(`Parkalot rechazó la reserva de ${number}; probando el siguiente.`);
  }
  throw new Error('No se logró reservar ningún espacio disponible de Parqueo Norte dentro del tiempo permitido.');
}
