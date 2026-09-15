/* ════════════════════════════════════════════════════════════
   KEVIN CARVALHO VENANCIO — PORTFÓLIO
   Orquestração: scroll suave, camadas, revelações e HUD.
   ════════════════════════════════════════════════════════════ */

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { initGL, PALETTE } from './modules/gl.js';
import { initDust } from './modules/dust.js';
import { initArt } from './modules/art.js';
import { splitChars, splitWords } from './modules/split.js';

gsap.registerPlugin(ScrollTrigger);

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover: none)').matches;

/* ─── estado global compartilhado com as camadas de canvas ─── */
const state = {
  prog: 0,          // progresso 0..1 do documento
  scrollY: 0,
  vel: 0,           // velocidade de scroll normalizada
  mx: 0, my: 0,     // mouse normalizado -1..1 (suavizado)
  tmx: 0, tmy: 0,
  intro: 0,         // 0..1 revelação inicial
  glowRGB: [255, 107, 53],
};

/* ════════════════════════════════════════════════════════════
   GRÃO — textura gerada, sem arquivo externo
   ════════════════════════════════════════════════════════════ */
function makeGrain(){
  const size = 180;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4){
    /* metade escura, metade clara: grão de verdade escurece E clareia,
       então funciona com mistura normal (sem mix-blend-mode). */
    const up = Math.random() > 0.5;
    const v = up ? 200 + Math.random() * 55 : Math.random() * 42;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = Math.random() * (up ? 40 : 52);
  }
  ctx.putImageData(img, 0, 0);
  document.documentElement.style.setProperty('--grain-src', `url(${c.toDataURL('image/png')})`);
}

/* ════════════════════════════════════════════════════════════
   PALETA — interpolação idêntica à do shader
   ════════════════════════════════════════════════════════════ */
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/* Mesma curva do shader — o HUD e o campo precisam concordar. */
function stopT(p){
  if (p < 0.16) return p / 0.16;
  if (p < 0.40) return 1 + (p - 0.16) / 0.24;
  if (p < 0.86) return 2 + (p - 0.40) / 0.46;
  if (p < 0.96) return 3 + (p - 0.86) / 0.10;
  return 4;
}

function rampGlow(p){
  const t = stopT(Math.min(1, Math.max(0, p)));
  let r = PALETTE[0].glow.slice();
  for (let i = 1; i < PALETTE.length; i++){
    const k = smoothstep(i - 1, i, t);
    const g = PALETTE[i].glow;
    r = [r[0] + (g[0] - r[0]) * k, r[1] + (g[1] - r[1]) * k, r[2] + (g[2] - r[2]) * k];
  }
  return r.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
}

/* ════════════════════════════════════════════════════════════
   SCROLL SUAVE
   ════════════════════════════════════════════════════════════ */
let lenis = null;
function initSmooth(){
  if (REDUCED) { ScrollTrigger.defaults({ scroller: window }); return; }
  lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.6,
    lerp: null,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;   /* acesso para a suíte de verificação */
}

/* ════════════════════════════════════════════════════════════
   LOOP ÚNICO DE RENDER — um rAF para todas as camadas
   ════════════════════════════════════════════════════════════ */
function initRenderLoop(layers){
  let last = performance.now();
  let lastScroll = 0;
  let hidden = document.hidden;
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    last = performance.now();        /* evita um salto de dt ao voltar */
  });

  gsap.ticker.add(() => {
    if (hidden) return;              /* nada a desenhar numa aba oculta */
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const time = now / 1000;

    /* mouse suavizado */
    const k = 1 - Math.pow(0.001, dt);
    state.mx += (state.tmx - state.mx) * k;
    state.my += (state.tmy - state.my) * k;

    /* velocidade de scroll — alimenta o arraste dos letreiros */
    const raw = (state.scrollY - lastScroll) / Math.max(dt, 0.001);
    lastScroll = state.scrollY;
    state.vel += (raw / 1400 - state.vel) * 0.12;

    for (const l of layers) l.render(time);
  });
}

/* ════════════════════════════════════════════════════════════
   HUD — profundidade, paleta, marcas, navegação
   ════════════════════════════════════════════════════════════ */
function initHUD(){
  const depthM = document.getElementById('depthm');
  const depthFill = document.getElementById('depthfill');
  const depthLabel = document.getElementById('depthlabel');
  const ticks = [...document.querySelectorAll('.depth__notches i')];
  const navLinks = [...document.querySelectorAll('.nav a')];
  const sections = [...document.querySelectorAll('.sec')];
  const root = document.documentElement;

  const MAX_DEPTH = 5400;
  let shownDepth = 0;

  /* progresso global do documento */
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      state.prog = self.progress;
      state.scrollY = self.scroll();

      const glow = rampGlow(self.progress);
      state.glowRGB = glow;
      root.style.setProperty('--glow', `rgb(${glow[0]},${glow[1]},${glow[2]})`);
      root.style.setProperty('--glow-soft', `rgba(${glow[0]},${glow[1]},${glow[2]},.14)`);
      root.style.setProperty('--tone', `${glow[0]},${glow[1]},${glow[2]}`);

      if (depthFill) depthFill.style.width = (self.progress * 100).toFixed(2) + '%';
    },
  });

  /* contador de metros com amortecimento */
  gsap.ticker.add(() => {
    if (!depthM) return;
    const target = state.prog * MAX_DEPTH;
    shownDepth += (target - shownDepth) * 0.09;
    depthM.textContent = String(Math.round(shownDepth)).padStart(4, '0');
  });

  /* seção corrente → rótulo, marcas e navegação */
  sections.forEach((sec, i) => {
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => {
        if (!self.isActive) return;
        if (depthLabel) depthLabel.textContent = sec.dataset.label || '';
        ticks.forEach((t, j) => {
          t.classList.toggle('is-on', j === i);
          t.classList.toggle('is-past', j < i);
        });
        navLinks.forEach((a) => {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + sec.id);
        });
      },
    });
  });

  /* aplica a paleta da posição atual antes do primeiro scroll */
  const applyGlow = (p) => {
    const glow = rampGlow(p);
    state.glowRGB = glow;
    root.style.setProperty('--glow', `rgb(${glow[0]},${glow[1]},${glow[2]})`);
    root.style.setProperty('--glow-soft', `rgba(${glow[0]},${glow[1]},${glow[2]},.14)`);
    root.style.setProperty('--tone', `${glow[0]},${glow[1]},${glow[2]}`);
  };
  applyGlow(0);

  gsap.to(['.hud', '.hud__scrim', '.depth'], { opacity: 1, duration: 1.2, ease: 'power2.out', delay: 0.15 });
}

/* ════════════════════════════════════════════════════════════
   PARALLAX — profundidade por camada (data-par)
   ════════════════════════════════════════════════════════════ */
function initParallax(){
  if (REDUCED) return;
  document.querySelectorAll('[data-par]').forEach((el) => {
    const depth = parseFloat(el.dataset.par) || 0;
    if (el.closest('.rail__track')) return;      // o trilho tem parallax próprio
    const host = el.closest('.sec') || el;
    gsap.fromTo(el,
      { yPercent: -depth * 14 },
      {
        yPercent: depth * 14,
        ease: 'none',
        scrollTrigger: { trigger: host, start: 'top bottom', end: 'bottom top', scrub: 1 },
      });
  });
}

/* ════════════════════════════════════════════════════════════
   REVELAÇÕES
   ════════════════════════════════════════════════════════════ */
function initReveals(){
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    const kind = el.dataset.reveal;
    const st = { trigger: el, start: 'top 86%', once: true };

    if (kind === 'chars'){
      const chars = splitChars(el);
      gsap.set(chars, { yPercent: 125, opacity: 0 });
      gsap.to(chars, {
        yPercent: 0, opacity: 1, duration: 1.15, ease: 'expo.out',
        stagger: { each: 0.016, from: 'start' }, scrollTrigger: st,
      });
    } else if (kind === 'words'){
      const words = splitWords(el);
      gsap.set(words, { yPercent: 122, opacity: 0 });
      gsap.to(words, {
        yPercent: 0, opacity: 1, duration: 1.05, ease: 'expo.out',
        stagger: 0.035, scrollTrigger: st,
      });
    } else if (kind === 'stagger'){
      const kids = [...el.children];
      gsap.set(kids, { y: 28, opacity: 0 });
      gsap.to(kids, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.1, scrollTrigger: st });
    } else {
      gsap.set(el, { y: 18, opacity: 0 });
      gsap.to(el, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', scrollTrigger: st });
    }
  });

  /* filete dos cabeçalhos */
  document.querySelectorAll('.sechead__rule i').forEach((el) => {
    gsap.to(el, {
      scaleX: 1, duration: 1.4, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });

  /* fichas técnicas e listas do arsenal */
  document.querySelectorAll('.chips').forEach((ul) => {
    gsap.from(ul.children, {
      y: 14, opacity: 0, duration: .7, ease: 'power3.out', stagger: .03,
      scrollTrigger: { trigger: ul, start: 'top 92%', once: true },
    });
  });
  document.querySelectorAll('[data-ars]').forEach((el) => {
    gsap.from(el, {
      y: 34, opacity: 0, duration: 1, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
    gsap.from(el.querySelectorAll('.ars__l li'), {
      opacity: 0, y: 10, duration: .6, ease: 'power2.out', stagger: .022,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  /* glifos flutuantes do hero */
  gsap.to('.glyph', { opacity: 1, duration: 1.4, ease: 'power2.out', stagger: 0.12, delay: 1.6 });
  gsap.to('.hero__cue', { opacity: 1, duration: 1.2, delay: 2.1 });

  /* cartões de contato */
  document.querySelectorAll('.cto').forEach((el, i) => {
    gsap.from(el, {
      y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', delay: i * 0.06,
      scrollTrigger: { trigger: '.contato__grid', start: 'top 88%', once: true },
    });
  });
}

/* ════════════════════════════════════════════════════════════
   01 · MANIFESTO — três declarações encadeadas
   ════════════════════════════════════════════════════════════ */
function initManifesto(){
  const sec = document.querySelector('.sec--manifesto');
  if (!sec) return;
  const lines = [...sec.querySelectorAll('.manifesto__line')];

  /* envolve cada bloco num <i> para poder deslizar dentro da máscara */
  lines.forEach((line) => {
    line.querySelectorAll('span').forEach((s) => {
      const i = document.createElement('i');
      i.textContent = s.textContent;
      s.textContent = '';
      s.appendChild(i);
    });
  });

  const inners = lines.map((l) => [...l.querySelectorAll('span > i')]);
  gsap.set(inners.flat(), { yPercent: 135 });
  gsap.set(lines, { opacity: 1 });

  const tl = gsap.timeline({
    scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 0.8 },
  });

  /* Posições em fração do percurso da seção. Um tween vazio em 1.0
     normaliza a duração total, então estes números são literais. */
  const SEQ = [
    { in: 0.03, out: 0.27 },
    { in: 0.34, out: 0.58 },
    { in: 0.65, out: null },
  ];
  const D_IN = 0.11, D_OUT = 0.06;

  lines.forEach((line, i) => {
    const seq = SEQ[i];
    tl.to(inners[i], { yPercent: 0, duration: D_IN, ease: 'power3.out', stagger: 0.018 }, seq.in);
    if (seq.out !== null){
      tl.to(inners[i], { yPercent: -135, duration: D_OUT, ease: 'power2.in', stagger: 0.012 }, seq.out);
      tl.to(line, { opacity: 0, duration: D_OUT * 0.7 }, seq.out + D_OUT * 0.3);
    }
  });

  tl.to('.manifesto__rule i', { width: '100%', duration: 0.86, ease: 'none' }, 0.02);
  tl.to('.manifesto__sub', { opacity: 1, duration: 0.05, ease: 'power2.out' }, 0.80);
  tl.set({}, {}, 1);                       /* fixa a duração total em 1 */
}

/* ════════════════════════════════════════════════════════════
   03 · GATEWAY — o diagrama se constrói enquanto você lê
   ════════════════════════════════════════════════════════════ */
function initGateway(){
  const sec = document.querySelector('.sec--gateway');
  if (!sec) return;

  const items = [...sec.querySelectorAll('[data-g]')].sort(
    (a, b) => +a.dataset.g - +b.dataset.g
  );
  gsap.set(items, { y: 46, opacity: 0 });

  const paths = [...sec.querySelectorAll('.gw__link path')];
  paths.forEach((p) => {
    const len = p.getTotalLength();
    gsap.set(p, { strokeDasharray: len, strokeDashoffset: len, opacity: 0.5 });
  });
  const core = sec.querySelector('.gw__core');
  if (core){
    const len = core.getTotalLength ? core.getTotalLength() : 520;
    gsap.set(core, { strokeDasharray: len, strokeDashoffset: len });
  }
  gsap.set('.gw__node circle', { scale: 0, transformOrigin: 'center', svgOrigin: undefined });
  gsap.set('.gw__rings i', { scale: 0.75, opacity: 0 });
  gsap.set('.gw__pulse', { opacity: 0 });

  const tl = gsap.timeline({
    scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 0.7 },
  });

  tl.to('.gw__rings i', { scale: 1, opacity: 1, duration: 0.2, ease: 'power2.out', stagger: 0.03 }, 0)
    .to(items, { y: 0, opacity: 1, duration: 0.14, ease: 'power3.out', stagger: 0.035 }, 0.02)
    .to(paths, { strokeDashoffset: 0, duration: 0.3, ease: 'power2.inOut', stagger: 0.025 }, 0.1)
    .to('.gw__node circle', { scale: 1, duration: 0.12, ease: 'back.out(2)', stagger: 0.02 }, 0.24)
    .to(core, { strokeDashoffset: 0, duration: 0.2, ease: 'power2.inOut' }, 0.34)
    .to('.gw__coretext', { opacity: 1, duration: 0.1 }, 0.46)
    .to('.gw__pulse', { opacity: 1, duration: 0.05 }, 0.5)
    .to('.gw__pulse', { x: 660, duration: 0.42, ease: 'none' }, 0.5)
    .to('.gw__rings i', { rotate: 22, duration: 0.5, ease: 'none' }, 0.3);

  /* respiração contínua dos anéis */
  if (!REDUCED){
    gsap.to('.gw__rings', { rotate: 360, duration: 220, ease: 'none', repeat: -1 });
  }
}

/* ════════════════════════════════════════════════════════════
   04 · TRILHO HORIZONTAL DE PROJETOS
   ════════════════════════════════════════════════════════════ */
function initRail(){
  const sec = document.querySelector('.sec--dominio');
  const rail = document.getElementById('rail');
  const track = document.getElementById('railtrack');
  const fill = document.getElementById('railfill');
  if (!sec || !rail || !track) return;

  const mm = gsap.matchMedia();

  mm.add('(min-width: 761px)', () => {
    let distance = 0;

    const setHeight = () => {
      distance = Math.max(0, track.scrollWidth - window.innerWidth);
      /* a seção precisa de altura suficiente para "gastar" o deslocamento */
      sec.style.height = (rail.offsetHeight + distance) + 'px';
    };
    setHeight();

    const st = ScrollTrigger.create({
      trigger: rail,
      start: 'top top',
      end: () => '+=' + distance,
      scrub: 0.6,
      invalidateOnRefresh: true,
      onRefreshInit: setHeight,
      onUpdate: (self) => {
        gsap.set(track, { x: -distance * self.progress });
        if (fill) fill.style.width = (self.progress * 100).toFixed(2) + '%';
      },
    });

    /* parallax interno: fundo e numeral correm em velocidades distintas */
    const inner = [];
    track.querySelectorAll('.proj').forEach((proj) => {
      const bg = proj.querySelector('.proj__bg');
      const no = proj.querySelector('.proj__no');
      inner.push({ proj, bg, no });
    });

    const tick = () => {
      const vw = window.innerWidth;
      for (const it of inner){
        const r = it.proj.getBoundingClientRect();
        if (r.right < -200 || r.left > vw + 200) continue;
        /* -1 (entrando pela direita) .. 1 (saindo pela esquerda) */
        const c = (r.left + r.width / 2 - vw / 2) / vw;
        if (it.bg) gsap.set(it.bg, { x: c * 90 });
        if (it.no) gsap.set(it.no, { x: c * -150 });
      }
    };
    gsap.ticker.add(tick);

    /* entrada dos cartões */
    track.querySelectorAll('.proj__card').forEach((card) => {
      gsap.from(card.children, {
        y: 34, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.055,
        scrollTrigger: { trigger: card, containerAnimation: undefined, start: 'top 95%', once: true },
      });
    });

    return () => {
      gsap.ticker.remove(tick);
      st.kill();
      sec.style.height = '';
      gsap.set(track, { x: 0 });
    };
  });

  /* empilhamento vertical no mobile */
  mm.add('(max-width: 760px)', () => {
    sec.style.height = '';
    gsap.set(track, { x: 0, clearProps: 'transform' });
    const projs = [...track.querySelectorAll('.proj')];
    const trs = projs.map((p) => gsap.from(p, {
      y: 50, opacity: 0, duration: 1, ease: 'expo.out',
      scrollTrigger: { trigger: p, start: 'top 88%', once: true },
    }));
    return () => trs.forEach((t) => t.scrollTrigger && t.scrollTrigger.kill());
  });
}

/* ════════════════════════════════════════════════════════════
   05 · LETREIROS — laço infinito que acelera com o scroll
   ════════════════════════════════════════════════════════════ */
function initMarquees(){
  const rows = [...document.querySelectorAll('.mq')];
  if (!rows.length) return;

  const lanes = rows.map((row) => {
    const inner = row.querySelector('.mq__in');
    const wrap = document.createElement('div');
    wrap.className = 'mq__wrap';
    row.appendChild(wrap);
    wrap.appendChild(inner);
    return { row, wrap, inner, speed: parseFloat(row.dataset.speed) || 1, w: 0, x: 0 };
  });

  function measure(){
    for (const l of lanes){
      /* preenche com cópias até cobrir a tela mais uma folga */
      while (l.wrap.children.length > 1) l.wrap.lastElementChild.remove();
      l.w = l.inner.getBoundingClientRect().width;
      if (!l.w) continue;
      const copies = Math.ceil(window.innerWidth / l.w) + 1;
      for (let i = 1; i < copies; i++) l.wrap.appendChild(l.inner.cloneNode(true));
      /* começa deslocado para que a direção negativa não mostre vazio */
      l.x = l.speed < 0 ? 0 : -l.w;
    }
  }
  measure();

  let last = performance.now();
  gsap.ticker.add(() => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const boost = 1 + Math.min(4, Math.abs(state.vel) * 3.2);
    for (const l of lanes){
      if (!l.w) continue;
      l.x -= l.speed * 34 * dt * boost;
      if (l.x <= -l.w) l.x += l.w;
      if (l.x >= 0) l.x -= l.w;
      l.wrap.style.transform = `translate3d(${l.x.toFixed(2)}px,0,0)`;
    }
  });

  window.addEventListener('resize', () => setTimeout(measure, 160));
}

/* ════════════════════════════════════════════════════════════
   06 · CONTADORES
   ════════════════════════════════════════════════════════════ */
function initStats(){
  document.querySelectorAll('[data-stat]').forEach((el) => {
    const n = el.querySelector('.stat__n');
    if (!n) return;
    const text = n.dataset.text;
    const target = parseInt(n.dataset.count, 10) || 0;
    const suffix = n.dataset.suffix || '';

    gsap.from(el, {
      y: 40, opacity: 0, duration: 1.1, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });

    if (text){
      n.textContent = text;
      return;
    }
    const o = { v: 0 };
    gsap.to(o, {
      v: target, duration: 1.8, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      onUpdate(){ n.textContent = Math.round(o.v) + suffix; },
    });
  });
}

/* ════════════════════════════════════════════════════════════
   CURSOR
   ════════════════════════════════════════════════════════════ */
function initCursor(){
  const cur = document.getElementById('cursor');
  if (!cur || isTouch) return;
  const dot = cur.querySelector('.cursor__dot');
  const ring = cur.querySelector('.cursor__ring');
  const label = cur.querySelector('.cursor__label');

  const p = { x: innerWidth / 2, y: innerHeight / 2 };
  const r = { x: p.x, y: p.y };
  let shown = false;

  window.addEventListener('pointermove', (e) => {
    p.x = e.clientX; p.y = e.clientY;
    state.tmx = (e.clientX / innerWidth) * 2 - 1;
    state.tmy = (e.clientY / innerHeight) * 2 - 1;
    if (!shown){ shown = true; gsap.to(cur, { opacity: 1, duration: .5 }); }
  }, { passive: true });

  gsap.ticker.add(() => {
    r.x += (p.x - r.x) * 0.16;
    r.y += (p.y - r.y) * 0.16;
    dot.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;
    ring.style.transform = `translate(${r.x}px,${r.y}px) translate(-50%,-50%) scale(var(--s,1))`;
    label.style.transform = `translate(${r.x}px,${r.y}px) translate(-50%,-50%)`;
  });

  const LABELS = { ext: 'abrir', copy: 'copiar', link: '' };
  document.querySelectorAll('[data-cursor], a, button').forEach((el) => {
    const kind = el.dataset.cursor || 'link';
    el.addEventListener('pointerenter', () => {
      ring.style.setProperty('--s', kind === 'link' ? '1.7' : '2.2');
      ring.style.borderColor = 'var(--glow)';
      if (LABELS[kind]){ label.textContent = LABELS[kind]; gsap.to(label, { opacity: 1, duration: .3 }); }
    });
    el.addEventListener('pointerleave', () => {
      ring.style.setProperty('--s', '1');
      ring.style.borderColor = 'var(--bone-38)';
      gsap.to(label, { opacity: 0, duration: .2 });
    });
  });
  ring.style.transition = 'border-color .4s';
}

/* ════════════════════════════════════════════════════════════
   MISCELÂNEA — menu, relógio, copiar, âncoras
   ════════════════════════════════════════════════════════════ */
function initMisc(){
  /* menu mobile */
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');
  if (burger && menu){
    const items = menu.querySelectorAll('.menu__list a');
    const open = () => {
      document.body.classList.add('menu-open');
      menu.setAttribute('aria-hidden', 'false');
      burger.setAttribute('aria-expanded', 'true');
      lenis && lenis.stop();
      gsap.to('.menu__bg', { opacity: 1, duration: .5, ease: 'power2.out' });
      gsap.to(items, { opacity: 1, y: 0, duration: .8, ease: 'expo.out', stagger: .05 });
    };
    const close = () => {
      document.body.classList.remove('menu-open');
      menu.setAttribute('aria-hidden', 'true');
      burger.setAttribute('aria-expanded', 'false');
      lenis && lenis.start();
      gsap.to('.menu__bg', { opacity: 0, duration: .4 });
      gsap.to(items, { opacity: 0, y: 20, duration: .3 });
    };
    burger.addEventListener('click', () =>
      document.body.classList.contains('menu-open') ? close() : open());
    items.forEach((a) => a.addEventListener('click', close));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('menu-open')) close();
    });
  }

  /* âncoras internas */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(t, { offset: 0, duration: 1.6 });
      else t.scrollIntoView({ behavior: 'smooth' });
    });
  });

  const top = document.getElementById('toTop');
  if (top) top.addEventListener('click', () => {
    if (lenis) lenis.scrollTo(0, { duration: 2.2 });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* relógio de São Paulo */
  const clock = document.getElementById('clock');
  if (clock){
    const tick = () => {
      clock.textContent = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
        second: '2-digit', hour12: false,
      }).format(new Date());
    };
    tick(); setInterval(tick, 1000);
  }

  /* copiar e-mail / telefone */
  document.querySelectorAll('[data-copy]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (!navigator.clipboard) return;
      e.preventDefault();
      navigator.clipboard.writeText(el.dataset.copy).then(() => {
        const v = el.querySelector('.cto__v');
        if (!v) return;
        const old = v.textContent;
        v.textContent = 'copiado';
        setTimeout(() => { v.textContent = old; }, 1300);
      }).catch(() => { window.location.href = el.getAttribute('href'); });
    });
  });
}

/* ════════════════════════════════════════════════════════════
   PRÉ-CARREGADOR
   ════════════════════════════════════════════════════════════ */
function runPreloader(onDone){
  const pre = document.getElementById('preloader');
  const count = document.getElementById('pcount');
  const bar = document.getElementById('pbar');
  const layerTxt = document.getElementById('player');
  const words = document.querySelectorAll('.preloader__word');

  const NAMES = [
    'Camada 00 · Superfície', 'Camada 02 · Origem', 'Camada 03 · Confiança',
    'Camada 04 · Domínio', 'Camada 05 · Arsenal', 'Camada 07 · Contato',
  ];

  gsap.set(words, { yPercent: 106, opacity: 0 });
  gsap.set('.preloader__curtain', { yPercent: 100 });

  const o = { v: 0 };
  const tl = gsap.timeline({
    onComplete(){
      document.body.classList.remove('is-loading');
      document.body.classList.add('is-ready');
      ScrollTrigger.refresh();
      onDone && onDone();
    },
  });

  tl.to(words, { yPercent: 0, opacity: 1, duration: 1.05, ease: 'expo.out', stagger: 0.08 }, 0.05)
    .to(o, {
      v: 100, duration: 1.55, ease: 'power1.inOut',
      onUpdate(){
        const v = Math.round(o.v);
        if (count) count.textContent = String(v).padStart(3, '0');
        if (bar) bar.style.right = (100 - v) + '%';
        if (layerTxt) layerTxt.textContent = NAMES[Math.min(NAMES.length - 1, Math.floor(v / 100 * NAMES.length))];
      },
    }, 0.15)
    .to(state, { intro: 1, duration: 1.2, ease: 'power2.out' }, 0.5)
    .to('.preloader__inner', { opacity: 0, y: -26, duration: .7, ease: 'power3.in' }, '+=0.12')
    .to('.preloader__curtain', { yPercent: 0, duration: .7, ease: 'power3.inOut' }, '<')
    .set(pre, { display: 'none' })
    .add(() => { pre.style.display = 'none'; });

  return tl;
}

/* ════════════════════════════════════════════════════════════
   ENTRADA DO HERO
   ════════════════════════════════════════════════════════════ */
function heroIntro(){
  const chars = document.querySelectorAll('.hero__name .char');
  gsap.to(chars, {
    yPercent: 0, opacity: 1, duration: 1.5, ease: 'expo.out',
    stagger: { each: 0.022, from: 'start' },
  });
  gsap.to('.hero__base, .hero__meta, .eyebrow', {
    y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.09, delay: 0.25,
  });
  gsap.fromTo('.strata',
    { scaleX: 0, opacity: 0 },
    { scaleX: 1, opacity: 1, duration: 1.8, ease: 'expo.out', stagger: 0.12, delay: 0.3 });
}

/* ════════════════════════════════════════════════════════════
   BOOT
   ════════════════════════════════════════════════════════════ */
function boot(){
  makeGrain();
  initSmooth();

  const glCanvas = document.getElementById('gl');
  const dustCanvas = document.getElementById('dust');
  const gl = initGL(glCanvas, state);
  const dust = initDust(dustCanvas, state);
  const art = initArt(state);
  const layers = [gl, dust, art];
  initRenderLoop(layers);

  /* o hero é preparado antes do preloader terminar */
  const heroName = document.querySelector('.hero__name');
  if (heroName){
    const chars = splitChars(heroName);
    gsap.set(chars, { yPercent: 125, opacity: 0 });
  }
  gsap.set('.hero__base, .hero__meta, .sec--hero .eyebrow', { y: 26, opacity: 0 });

  initHUD();
  initParallax();
  initReveals();
  initManifesto();
  initGateway();
  initRail();
  initMarquees();
  initStats();
  initCursor();
  initMisc();

  let rt;
  const onResize = () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      gl.resize(); dust.resize(); art.resize();
      ScrollTrigger.refresh();
    }, 140);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  /* garante o dimensionamento dos canvases depois do layout final */
  requestAnimationFrame(() => { art.resize(); });

  runPreloader(() => {
    heroIntro();
    art.resize();
    ScrollTrigger.refresh();
  });

  /* sinal para os testes automatizados */
  window.__siteReady = true;
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => {
    document.fonts.ready.then(boot).catch(boot);
  });
} else {
  document.fonts.ready.then(boot).catch(boot);
}
