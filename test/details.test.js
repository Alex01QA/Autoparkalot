import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { findDetails } from '../src/details.js';
import { dateLabels, normalize } from '../src/dates.js';
import { selectParking } from '../src/parking.js';
import { selectSpot } from '../src/spot.js';
import { reserveAtNoon } from '../src/reserve.js';

let browser;
before(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }); });
after(async () => { await browser?.close(); });
const labels = dateLabels(new Date('2026-11-09T12:00:00Z'), { includeTomorrow: false }).map(normalize);

test('espera la hora y la habilitación; pulsa solo Reserve de 132 una vez', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(`<section><div>Parqueo Norte 131</div><button onclick="window.wrong=true">Reserve</button></section>
      <section><div>Parqueo Norte 132</div><button id="target" disabled onclick="window.clicks=(window.clicks||0)+1;window.clickedAt=Date.now();const n=document.createElement('div');n.textContent='Successfully reserved';document.body.append(n)">Reserve</button></section>`);
    const releaseAt = Date.now() + 300;
    await page.evaluate(at => setTimeout(() => document.getElementById('target').disabled = false, Math.max(0, at - Date.now())), releaseAt + 200);
    const pending = reserveAtNoon(page, 'America/Costa_Rica', { releaseAt, graceMs: 3000 });
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(await page.evaluate(() => window.clicks || 0), 0);
    await pending;
    const state = await page.evaluate(() => ({ clicks: window.clicks, at: window.clickedAt, wrong: window.wrong }));
    assert.equal(state.clicks, 1);
    assert.ok(state.at >= releaseAt + 200);
    assert.equal(state.wrong, undefined);
  } finally { await page.close(); }
});

test('abre Parqueo Norte 132 y verifica Reserve sin pulsarlo', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <section><div onclick="window.spot='neighbor'">Parqueo Norte 131</div></section>
      <section style="margin-top:1000px"><div onclick="window.spot='132';this.nextElementSibling.hidden=false">Parqueo Norte 132</div>
        <button hidden onclick="window.reserved=true">Reserve</button></section>`);
    await selectSpot(page);
    assert.equal(await page.evaluate(() => window.spot), '132');
    assert.equal(await page.evaluate(() => window.reserved), undefined);
    assert.ok(await page.getByRole('button', { name: 'Reserve' }).isVisible());
  } finally { await page.close(); }
});

test('abre el combobox de MUI y selecciona Parqueo Norte en su listbox', async () => {
  const page = await browser.newPage();
  try {
    for (const initial of ['Parqueo Sur', 'Parqueo Norte']) {
      await page.setContent(`
        <div tabindex="0" role="combobox" aria-controls=":r2:" aria-expanded="false"
          aria-haspopup="listbox" onclick="document.getElementById(':r2:').hidden=false; this.setAttribute('aria-expanded','true')"><span>${initial}</span></div>
        <ul id=":r2:" role="listbox" hidden>
          <li role="option" onclick="window.selected='wrong'">Parqueo Norte Anexo</li>
          <li role="option" onclick="window.selected='Parqueo Norte'; document.querySelector('[role=combobox] span').textContent=window.selected; this.parentElement.hidden=true; document.querySelector('[role=combobox]').setAttribute('aria-expanded','false')">Parqueo Norte</li>
        </ul>`);
      await selectParking(page);
      assert.equal(await page.evaluate(() => window.selected), 'Parqueo Norte');
      assert.equal(await page.getByRole('combobox').getAttribute('aria-expanded'), 'false');
    }
  } finally { await page.close(); }
});

test('selecciona la opción del portal aunque aria-controls esté desactualizado y el clic solo enfoque', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <div id="root"><div tabindex="0" role="combobox" aria-controls="old-id" aria-expanded="false"
        onclick="document.getElementById('portal').hidden=false; this.setAttribute('aria-expanded','true'); document.getElementById('root').setAttribute('aria-hidden','true')">Parqueo Norte</div></div>
      <ul id="portal" role="listbox" hidden>
        <li tabindex="0" role="option" onclick="this.focus()"
          onkeydown="if(event.key==='Enter'){window.confirmed=true;this.parentElement.hidden=true;document.getElementById('root').removeAttribute('aria-hidden');document.querySelector('[role=combobox]').setAttribute('aria-expanded','false')}">Parqueo Norte</li>
      </ul>`);
    await selectParking(page);
    assert.equal(await page.evaluate(() => window.confirmed), true);
  } finally { await page.close(); }
});

test('pulsa únicamente Details del lunes con ordinal, icono y spans anidados', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <div>Saturday, November 7th <button onclick="window.clicked='saturday'">Details</button></div>
      <div><span>Monday,</span><span> November 09th, 2026</span>
        <button onclick="window.clicked='monday'"><span aria-hidden="true">ⓘ</span><span><span>Details</span></span></button>
      </div>`);
    const matches = await findDetails(page, labels);
    assert.equal(matches.length, 1);
    await matches[0].click();
    assert.equal(await page.evaluate(() => window.clicked), 'monday');
  } finally { await page.close(); }
});

test('reconoce fecha británica y enlace Details', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent('<article><h2>9th November</h2><a href="#details">Details</a></article>');
    const matches = await findDetails(page, labels);
    assert.equal(matches.length, 1);
    await matches[0].click();
    assert.equal(new URL(page.url()).hash, '#details');
  } finally { await page.close(); }
});

test('no asocia la fecha de otro día por compartir un contenedor', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent('<main><h2>November 9</h2><div>November 7<button>Details</button></div><div>November 8<button>Details</button></div></main>');
    assert.equal((await findDetails(page, labels)).length, 0);
  } finally { await page.close(); }
});

for (const scenario of ['fallback', 'network', 'timeout', 'disabled']) {
  test(`reservas con prioridad: ${scenario}`, async () => {
    const page = await browser.newPage();
    try {
      await page.setContent(`<div class="MuiFormControl-root"><label>Search</label><div><input type="text"></div></div>
        <main id="cards"></main>
        <script>
          window.attempts=[];
          const scenario=${JSON.stringify(scenario)};
          for (const n of [132,129,128]) {
            const section=document.createElement('section');
            const title=document.createElement('div'); title.textContent='Parqueo Norte '+n;
            const button=document.createElement('button');button.textContent='Reserve';
            button.hidden=n!==132;
            button.disabled=scenario==='disabled'&&n===132;
            title.onclick=()=>button.hidden=false;
            button.onclick=()=>{
              window.attempts.push(n);
              if(scenario==='timeout') return;
              const notice=document.createElement('div');
              notice.textContent=scenario==='network'?'Network error':
                ((scenario==='disabled'&&n===129)||n===128?'Successfully reserved':'Could not reserve');
              document.body.append(notice);
            };
            section.append(title,button);document.getElementById('cards').append(section);
          }
          document.querySelector('input').oninput=e=>{
            for(const section of document.querySelectorAll('section'))section.hidden=!section.firstChild.textContent.includes(e.target.value);
          };
        </script>`);
      const options={releaseAt:Date.now()-1,graceMs:10000,availabilityMs:100,outcomeMs:200};
      if (scenario==='network'||scenario==='timeout') {
        await assert.rejects(reserveAtNoon(page,'America/Costa_Rica',options),/incierto/);
        assert.deepEqual(await page.evaluate(()=>window.attempts),[132]);
      } else {
        const number=await reserveAtNoon(page,'America/Costa_Rica',options);
        assert.equal(number,scenario==='disabled'?129:128);
        assert.deepEqual(await page.evaluate(()=>window.attempts),scenario==='disabled'?[129]:[132,129,128]);
      }
    } finally {await page.close();}
  });
}
