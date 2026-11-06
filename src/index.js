import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { tomorrow, targetDate, dateLabels, normalize } from './dates.js';
import { createLoginHandler } from './login.js';
import { findDetails } from './details.js';
import { selectParking } from './parking.js';
import { selectSpot } from './spot.js';
import { reserveAtNoon } from './reserve.js';

try {
  loadEnvFile(resolve('.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw new Error('No se pudo cargar el archivo .env.');
}
const handleLogin = createLoginHandler(process.env.PARKALOT_EMAIL, process.env.PARKALOT_PASSWORD);
const headless = process.env.PARKALOT_HEADLESS === 'true' || process.env.CI === 'true';
if (headless && (!process.env.PARKALOT_EMAIL || !process.env.PARKALOT_PASSWORD)) {
  throw new Error('La ejecución automática requiere PARKALOT_EMAIL y PARKALOT_PASSWORD.');
}

const timeZone = process.env.PARKALOT_TIMEZONE || 'America/Costa_Rica';
const now = new Date();
const date = targetDate(timeZone, now);
const labels = dateLabels(date, {
  includeTomorrow: date.getTime() === tomorrow(timeZone, now).getTime(),
}).map(normalize);
const timeout = Number(process.env.PARKALOT_TIMEOUT_MS || 300000);
if (!Number.isFinite(timeout) || timeout <= 0) throw new Error('PARKALOT_TIMEOUT_MS debe ser positivo.');
const profile = resolve('.browser-profile');
const context = await chromium.launchPersistentContext(profile, {
  headless,
  ...(process.env.PARKALOT_BROWSER === 'chromium' ? {} : { channel: 'chrome' }),
  viewport: headless ? { width: 1616, height: 860 } : null,
});
const page = context.pages()[0] || await context.newPage();

try {
  console.log(`Buscando ${date.toISOString().slice(0, 10)} (${timeZone}).`);
  console.log(process.env.PARKALOT_EMAIL
    ? 'Inicio de sesión automático configurado. Si el acceso falla, revisa la ventana del navegador.'
    : 'Si aparece el inicio de sesión, ingresa en la ventana del navegador.');
  await page.goto('https://app.parkalot.io/#/client', { waitUntil: 'domcontentloaded' });
  const deadline = Date.now() + timeout;
  let clicked = false;
  while (Date.now() < deadline && !page.isClosed()) {
    await handleLogin(page);
    const matches = await findDetails(page, labels);
    if (matches.length > 1) throw new Error('Hay varios Details para la fecha objetivo; no se hizo clic para evitar elegir uno incorrecto.');
    if (matches.length === 1) {
      console.log(`Fecha localizada: ${date.toISOString().slice(0, 10)}. Pulsando Details…`);
      await matches[0].scrollIntoViewIfNeeded();
      await matches[0].click({ timeout: 10000 });
      clicked = true;
      console.log(`Se hizo clic en Details para ${date.toISOString().slice(0, 10)}. El navegador queda abierto.`);
      break;
    }
    await page.waitForTimeout(1000);
  }
  if (!clicked) throw new Error('No se encontró una fila única con la fecha objetivo y Details dentro del tiempo disponible.');
  await selectParking(page);
  console.log('Parqueo Norte confirmado y menú cerrado. Abriendo Parqueo Norte 132…');
  try {
    await selectSpot(page);
    console.log('Parqueo Norte 132 abierto; botón Reserve visible. El navegador queda abierto.');
  } catch (error) {
    if (error.name !== 'TimeoutError') throw error;
    console.log('132 no está disponible ahora. Se evaluarán las alternativas a mediodía.');
  }
  await reserveAtNoon(page, timeZone);
} catch (error) {
  if (!page.isClosed()) {
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/error.png', fullPage: true }).catch(() => {});
  }
  console.error(error.message);
  console.error('Revisa la ventana. Si existe, artifacts/error.png contiene una captura privada de tu sesión.');
  process.exitCode = 1;
}
// Conservar la ventana para que el usuario pueda revisar el resultado.
if (headless) {
  await context.close();
} else if (context.pages().length) {
  await new Promise(resolve => context.once('close', resolve));
}
