/* ════════════════════════════════════════════════════════════
   SUÍTE DE VERIFICAÇÃO VISUAL
   Percorre o site em vários viewports, mede transbordo
   horizontal, texto cortado, erros de console — e captura.
   uso: node tools/verify.mjs [url]
   ════════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.argv[2] || 'http://127.0.0.1:5178/';
const OUT = path.resolve('shots');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop-1920', w: 1920, h: 1080 },
  { name: 'laptop-1440',  w: 1440, h: 900  },
  { name: 'laptop-1280',  w: 1280, h: 800  },
  { name: 'tablet-768',   w: 768,  h: 1024 },
  { name: 'phone-390',    w: 390,  h: 844  },
];

/* fatias do documento onde queremos olhar (fração do scroll total) */
const STOPS = [0, 0.055, 0.11, 0.17, 0.235, 0.30, 0.37, 0.44, 0.51,
               0.58, 0.65, 0.72, 0.79, 0.86, 0.93, 1];

/* ─── auditoria executada dentro da página ─────────────────── */
const AUDIT = () => {
  const vw = window.innerWidth;
  const problems = [];

  const clipsX = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (['hidden', 'clip', 'auto', 'scroll'].includes(cs.overflowX)) return true;
      if (cs.clipPath && cs.clipPath !== 'none') return true;
      n = n.parentElement;
    }
    return false;
  };

  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    if (cs.position === 'fixed') continue;                 // camadas de fundo
    if (el.closest('[aria-hidden="true"]')) continue;      // decorativo

    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    /* transbordo horizontal real (sem ancestral que corte) */
    if ((r.right > vw + 2 || r.left < -2) && !clipsX(el.parentElement)) {
      problems.push({
        type: 'overflow-x',
        sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
        left: Math.round(r.left), right: Math.round(r.right), vw,
      });
    }

    /* Texto realmente cortado: um descendente com texto, SEM transform
       próprio, cujo retângulo escapa da caixa que o corta. Isso evita
       falsos positivos de máscaras de revelação e painéis deslizantes. */
    if (['hidden', 'clip'].includes(cs.overflowY) || ['hidden', 'clip'].includes(cs.overflowX)) {
      for (const kid of el.querySelectorAll('*')) {
        const ks = getComputedStyle(kid);
        if (ks.transform !== 'none' || ks.position === 'absolute' || ks.position === 'fixed') continue;
        if (!kid.textContent.trim() || kid.children.length) continue;
        if (kid.closest('[aria-hidden="true"]')) continue;
        let anc = kid.parentElement, moved = false;
        while (anc && anc !== el) {
          if (getComputedStyle(anc).transform !== 'none') { moved = true; break; }
          anc = anc.parentElement;
        }
        if (moved) continue;
        const kr = kid.getBoundingClientRect();
        if (kr.height === 0) continue;
        if (kr.bottom > r.bottom + 2 || kr.top < r.top - 2 ||
            kr.right > r.right + 2 || kr.left < r.left - 2) {
          problems.push({
            type: 'texto-cortado',
            sel: el.tagName.toLowerCase() + '.' + String(el.className).trim().split(/\s+/)[0],
            kid: kid.tagName.toLowerCase() + '.' + String(kid.className).trim().split(/\s+/)[0],
            txt: kid.textContent.trim().slice(0, 34),
          });
          break;
        }
      }
    }
  }

  /* Tela vazia: nenhum texto do conteúdo visível no viewport.
     Pega seções que somem por completo (ex.: trilho cortado). */
  let visibleText = 0;
  for (const el of document.querySelectorAll('.stage p, .stage h1, .stage h2, .stage h3, .stage li, .stage a, .stage b')) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    if (!el.textContent.trim()) continue;
    const q = el.getBoundingClientRect();
    if (q.bottom > 4 && q.top < window.innerHeight - 4 &&
        q.right > 4 && q.left < vw - 4 && q.width > 0) visibleText++;
  }
  if (visibleText === 0) problems.push({ type: 'tela-vazia', sel: '(nenhum texto no viewport)' });

  return {
    visibleText,
    docScrollW: document.documentElement.scrollWidth,
    bodyScrollW: document.body.scrollWidth,
    vw,
    hasHScroll: document.documentElement.scrollWidth > vw + 1,
    problems: problems.slice(0, 40),
  };
};

/* ─── execução ─────────────────────────────────────────────── */
const browser = await chromium.launch();
const report = { url: URL, when: new Date().toISOString(), viewports: [] };

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: vp.w > 1000 ? 1 : 2,
    reducedMotion: 'no-preference',
    isMobile: vp.w < 800,
    hasTouch: vp.w < 800,
  });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.__siteReady === true, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4200);                        // preloader + intro

  const vpReport = { name: vp.name, size: `${vp.w}x${vp.h}`, stops: [], consoleErrors };
  const dir = path.join(OUT, vp.name);
  fs.mkdirSync(dir, { recursive: true });

  const maxScroll = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight);

  for (let i = 0; i < STOPS.length; i++) {
    const y = Math.round(maxScroll * STOPS[i]);
    await page.evaluate((yy) => {
      if (window.__lenis) window.__lenis.scrollTo(yy, { immediate: true, force: true });
      else window.scrollTo(0, yy);
    }, y);
    await page.waitForTimeout(1100);                      // scrub alcança o alvo

    const audit = await page.evaluate(AUDIT);
    vpReport.stops.push({ i, pct: STOPS[i], y, ...audit });

    const file = path.join(dir, `${String(i).padStart(2, '0')}-${Math.round(STOPS[i] * 100)}pct.png`);
    await page.screenshot({ path: file });
  }

  report.viewports.push(vpReport);
  await ctx.close();
  console.log(`✓ ${vp.name}`);
}

await browser.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

/* ─── resumo ───────────────────────────────────────────────── */
let totalProblems = 0, totalErrors = 0;
console.log('\n══════════ RESUMO ══════════');
for (const v of report.viewports) {
  const hs = v.stops.filter((s) => s.hasHScroll);
  const probs = v.stops.flatMap((s) => s.problems);
  const byType = {};
  for (const p of probs) {
    const k = `${p.type} :: ${p.sel}`;
    byType[k] = (byType[k] || 0) + 1;
  }
  totalProblems += probs.length;
  totalErrors += v.consoleErrors.length;

  console.log(`\n${v.name} (${v.size})`);
  console.log(`  scroll horizontal: ${hs.length ? '✗ em ' + hs.length + ' pontos' : '✓ nenhum'}`);
  if (hs.length) hs.slice(0, 3).forEach((s) =>
    console.log(`     ${Math.round(s.pct * 100)}%: scrollW=${s.docScrollW} vw=${s.vw}`));
  console.log(`  problemas de layout: ${probs.length ? '✗ ' + probs.length : '✓ 0'}`);
  Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .forEach(([k, n]) => console.log(`     ${n}x  ${k}`));
  console.log(`  erros de console: ${v.consoleErrors.length ? '✗ ' + v.consoleErrors.length : '✓ 0'}`);
  v.consoleErrors.slice(0, 5).forEach((e) => console.log(`     ${e.slice(0, 160)}`));
}
console.log(`\nTOTAL: ${totalProblems} problemas de layout · ${totalErrors} erros de console`);
console.log(`Capturas em ${OUT}`);
process.exit(totalProblems === 0 && totalErrors === 0 ? 0 : 1);
