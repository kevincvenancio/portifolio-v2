/* ════════════════════════════════════════════════════════════
   ARTE PROCEDURAL
   Cada projeto ganha um diagrama técnico desenhado em código —
   o próprio sistema, visto de cima. Nada de imagem de banco.
   ════════════════════════════════════════════════════════════ */

const BONE = '234,229,219';
/* Ganho global de contraste dos traços: em telas grandes o diagrama
   precisa ser legível como textura, não sumir no fundo. */
const K = 1.75;

/* PRNG determinístico: o mesmo desenho a cada carregamento */
function rng(seed){
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function line(ctx, x1, y1, x2, y2, a = 0.18, w = 1){
  ctx.strokeStyle = `rgba(${BONE},${Math.min(1, a * K)})`;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function node(ctx, x, y, r, a = 0.35, fill = null){
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.strokeStyle = `rgba(${BONE},${Math.min(1, a * K)})`; ctx.lineWidth = 1; ctx.stroke();
}

/* ─── desenhos ─────────────────────────────────────────────── */

const ART = {
  /* malha de nós — identidade / origem */
  grid(ctx, W, H, t, glow){
    const r = rng(7);
    const cols = 7, rows = 9;
    const gx = W / (cols + 1), gy = H / (rows + 1);
    const pts = [];
    for (let i = 1; i <= cols; i++)
      for (let j = 1; j <= rows; j++)
        pts.push({ x: i * gx + (r() - 0.5) * gx * 0.35, y: j * gy + (r() - 0.5) * gy * 0.3, k: r() });

    for (const p of pts) for (const q of pts) {
      if (p === q) continue;
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < gx * 1.25) line(ctx, p.x, p.y, q.x, q.y, 0.05);
    }
    for (const p of pts) {
      const live = p.k > 0.88;
      const pulse = live ? 0.4 + 0.6 * Math.abs(Math.sin(t * 0.6 + p.k * 20)) : 1;
      node(ctx, p.x, p.y, live ? 2.6 : 1.3, live ? 0 : 0.22,
        live ? `rgba(${glow},${0.75 * pulse})` : `rgba(${BONE},0.2)`);
    }
  },

  /* fluxo de pagamento — checkout ramificado */
  flow(ctx, W, H, t, glow){
    const cy = H / 2, x0 = W * 0.12, x1 = W * 0.38, x2 = W * 0.62, x3 = W * 0.88;
    const branches = [cy - H * 0.2, cy, cy + H * 0.2];

    line(ctx, x0, cy, x1, cy, 0.2);
    for (const by of branches) {
      ctx.strokeStyle = `rgba(${BONE},0.24)`; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, cy); ctx.bezierCurveTo(x1 + (x2 - x1) * 0.45, cy, x2 - (x2 - x1) * 0.45, by, x2, by);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, by); ctx.bezierCurveTo(x2 + (x3 - x2) * 0.45, by, x3 - (x3 - x2) * 0.45, cy, x3, cy);
      ctx.stroke();
      node(ctx, x2, by, 4, 0.3);
    }
    node(ctx, x0, cy, 6, 0.4);
    node(ctx, x1, cy, 5, 0.3);
    node(ctx, x3, cy, 7, 0, `rgba(${glow},0.85)`);

    /* transação percorrendo o ramo do meio */
    const k = (t * 0.28) % 1;
    const bx = x1 + (x3 - x1) * k;
    node(ctx, bx, cy + Math.sin(k * Math.PI) * 0, 3, 0, `rgba(${glow},0.95)`);
  },

  /* camadas de arquitetura em perspectiva */
  layers(ctx, W, H, t, glow){
    const n = 6, cx = W / 2, cy = H / 2;
    const bw = W * 0.5, bh = H * 0.055, gap = H * 0.085;
    for (let i = 0; i < n; i++){
      const o = (i - (n - 1) / 2) * gap;
      const sk = bw * 0.22;
      const y = cy + o;
      const on = Math.floor((t * 0.5) % n) === i;
      ctx.strokeStyle = on ? `rgba(${glow},0.75)` : `rgba(${BONE},0.28)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - bw / 2, y);
      ctx.lineTo(cx - bw / 2 + sk, y - bh);
      ctx.lineTo(cx + bw / 2, y - bh);
      ctx.lineTo(cx + bw / 2 - sk, y);
      ctx.closePath();
      ctx.stroke();
      if (on) { ctx.fillStyle = `rgba(${glow},0.07)`; ctx.fill(); }
      line(ctx, cx - bw / 2 + sk * 0.5, y - bh, cx - bw / 2 + sk * 0.5, y + gap - bh, 0.07);
    }
  },

  /* órbitas de asteroides + grade do knapsack */
  orbit(ctx, W, H, t, glow){
    const cx = W * 0.5, cy = H * 0.5;
    const r = rng(23);
    for (let i = 1; i <= 5; i++){
      const rx = (W * 0.08) * i * 1.08, ry = (H * 0.07) * i * 1.08;
      ctx.strokeStyle = `rgba(${BONE},${0.24 - i * 0.02})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, -0.32, 0, Math.PI * 2); ctx.stroke();

      const count = 2 + i;
      for (let j = 0; j < count; j++){
        const seed = r();
        const ang = seed * Math.PI * 2 + t * (0.1 / i) * (seed > 0.5 ? 1 : -1);
        const a = -0.32;
        const px = cx + Math.cos(ang) * rx * Math.cos(a) - Math.sin(ang) * ry * Math.sin(a);
        const py = cy + Math.cos(ang) * rx * Math.sin(a) + Math.sin(ang) * ry * Math.cos(a);
        const hot = seed > 0.78;
        node(ctx, px, py, hot ? 3.2 : 1.8, hot ? 0 : 0.3, hot ? `rgba(${glow},0.8)` : null);
      }
    }
    node(ctx, cx, cy, 5, 0, `rgba(${glow},0.55)`);

    /* barra de capacidade da nave */
    const bx = W * 0.1, by = H * 0.9, bw = W * 0.8;
    line(ctx, bx, by, bx + bw, by, 0.14);
    const fill = 0.62 + 0.06 * Math.sin(t * 0.5);
    ctx.strokeStyle = `rgba(${glow},0.6)`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw * fill, by); ctx.stroke();
  },

  /* segmentos de um JWT atravessando a verificação */
  token(ctx, W, H, t, glow){
    const cy = H / 2, segs = 3;
    const pad = W * 0.1, tw = (W - pad * 2) / segs;
    for (let i = 0; i < segs; i++){
      const x = pad + i * tw;
      const on = Math.floor((t * 0.6) % segs) === i;
      ctx.strokeStyle = on ? `rgba(${glow},0.7)` : `rgba(${BONE},0.3)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 4, cy - H * 0.1, tw - 8, H * 0.2);
      if (on) { ctx.fillStyle = `rgba(${glow},0.06)`; ctx.fillRect(x + 4, cy - H * 0.1, tw - 8, H * 0.2); }
      /* bits */
      const r = rng(100 + i * 13);
      for (let j = 0; j < 22; j++){
        const bx = x + 12 + r() * (tw - 28);
        const by = cy - H * 0.1 + 10 + r() * (H * 0.2 - 20);
        ctx.fillStyle = `rgba(${BONE},${0.12 + r() * 0.22})`;
        ctx.fillRect(bx, by, 5 + r() * 12, 1.5);
      }
      if (i < segs - 1) line(ctx, x + tw - 2, cy - H * 0.04, x + tw - 2, cy + H * 0.04, 0.3);
    }
    line(ctx, pad, cy - H * 0.22, W - pad, cy - H * 0.22, 0.08);
    line(ctx, pad, cy + H * 0.22, W - pad, cy + H * 0.22, 0.08);
  },

  /* dispersão + reta de regressão */
  regression(ctx, W, H, t, glow){
    const r = rng(41);
    const pad = W * 0.1, ph = H * 0.14;
    line(ctx, pad, H - ph, W - pad, H - ph, 0.14);
    line(ctx, pad, ph, pad, H - ph, 0.14);

    const slope = -(H - ph * 2) / (W - pad * 2) * 0.82;
    for (let i = 0; i < 90; i++){
      const u = r();
      const x = pad + u * (W - pad * 2);
      const ideal = (H - ph) + slope * (x - pad);
      const noise = (r() - 0.5) * H * 0.26;
      const y = Math.max(ph, Math.min(H - ph, ideal + noise));
      const near = Math.abs(noise) < H * 0.05;
      ctx.beginPath(); ctx.arc(x, y, near ? 2.4 : 1.7, 0, Math.PI * 2);
      ctx.fillStyle = near ? `rgba(${glow},0.7)` : `rgba(${BONE},0.34)`;
      ctx.fill();
    }
    /* reta ajustada com varredura */
    const k = ((t * 0.25) % 1);
    ctx.strokeStyle = `rgba(${glow},0.75)`; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(pad, H - ph);
    ctx.lineTo(pad + (W - pad * 2) * Math.min(1, k * 1.6), (H - ph) + slope * ((W - pad * 2) * Math.min(1, k * 1.6)));
    ctx.stroke();
  },

  /* 1 origem → 25 destinos */
  fanout(ctx, W, H, t, glow){
    const ox = W * 0.14, oy = H * 0.5;
    const cols = 5, rows = 5;
    const gx0 = W * 0.56, gy0 = H * 0.2, gw = W * 0.32, gh = H * 0.6;
    node(ctx, ox, oy, 7, 0, `rgba(${glow},0.75)`);

    let idx = 0;
    const live = Math.floor((t * 3) % 25);
    for (let i = 0; i < cols; i++){
      for (let j = 0; j < rows; j++){
        const x = gx0 + (i / (cols - 1)) * gw;
        const y = gy0 + (j / (rows - 1)) * gh;
        const on = idx === live;
        ctx.strokeStyle = on ? `rgba(${glow},0.6)` : `rgba(${BONE},0.10)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.bezierCurveTo(ox + W * 0.2, oy, gx0 - W * 0.12, y, x, y);
        ctx.stroke();
        node(ctx, x, y, on ? 3.4 : 2.2, on ? 0 : 0.26, on ? `rgba(${glow},0.9)` : null);
        idx++;
      }
    }
  },
};

/* ─── controlador ──────────────────────────────────────────── */

export function initArt(state){
  const canvases = [...document.querySelectorAll('.artcanvas')];
  if (!canvases.length) return { resize(){}, render(){} };

  const items = canvases.map((c) => ({
    el: c,
    draw: ART[c.dataset.art] || ART.grid,
    ctx: c.getContext('2d'),
    w: 0, h: 0, visible: false,
  }));

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const it = items.find((i) => i.el === e.target);
      if (it) it.visible = e.isIntersecting;
    }
  }, { rootMargin: '25% 0px' });
  items.forEach((i) => io.observe(i.el));

  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    for (const it of items){
      const r = it.el.getBoundingClientRect();
      it.w = Math.max(1, Math.round(r.width));
      it.h = Math.max(1, Math.round(r.height));
      it.el.width = Math.round(it.w * dpr);
      it.el.height = Math.round(it.h * dpr);
      it.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function render(time){
    const glow = state.glowRGB.join(',');
    for (const it of items){
      if (!it.visible || !it.w) continue;
      it.ctx.clearRect(0, 0, it.w, it.h);
      it.draw(it.ctx, it.w, it.h, time, glow);
    }
  }

  return { resize, render };
}
