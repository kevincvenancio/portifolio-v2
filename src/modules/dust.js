/* ════════════════════════════════════════════════════════════
   POEIRA — três planos de partículas com parallax independente.
   É o que dá a leitura de "estou atravessando um volume", e não
   apenas rolando uma página.
   ════════════════════════════════════════════════════════════ */

const PLANES = [
  { n: 46, r: [1.5, 2.6], a: [0.26, 0.50], par: 260, drift: 0.16, blur: 0 },   // perto
  { n: 70, r: [0.9, 1.6], a: [0.14, 0.30], par: 130, drift: 0.09, blur: 0 },   // médio
  { n: 96, r: [0.5, 1.0], a: [0.07, 0.17], par:  52, drift: 0.05, blur: 0 },   // longe
];

export function initDust(canvas, state){
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return { resize(){}, render(){} };

  let W = 0, H = 0, dpr = 1;
  let planes = [];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function build(){
    const dense = W < 760 ? 0.45 : 1;
    planes = PLANES.map((cfg) => {
      const pts = [];
      const count = Math.round(cfg.n * dense);
      for (let i = 0; i < count; i++){
        pts.push({
          x: Math.random(),
          y: Math.random() * 1.6 - 0.3,           // margem fora da tela
          r: cfg.r[0] + Math.random() * (cfg.r[1] - cfg.r[0]),
          a: cfg.a[0] + Math.random() * (cfg.a[1] - cfg.a[0]),
          ph: Math.random() * Math.PI * 2,
          sp: 0.4 + Math.random() * 0.8,
        });
      }
      return { cfg, pts };
    });
  }

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function render(time){
    ctx.clearRect(0, 0, W, H);
    const glow = state.glowRGB;
    const scroll = state.scrollY;

    for (let pi = 0; pi < planes.length; pi++){
      const { cfg, pts } = planes[pi];
      const mouseShift = state.mx * cfg.par * 0.22;
      const mouseShiftY = state.my * cfg.par * 0.14;

      for (let i = 0; i < pts.length; i++){
        const p = pts[i];
        const drift = reduced ? 0 : Math.sin(time * cfg.drift * p.sp + p.ph) * (14 + pi * -4);

        let x = p.x * W + drift + mouseShift;
        /* parallax: planos próximos correm mais que os distantes */
        let y = (p.y * H - (scroll * cfg.par) / 1000) % (H * 1.6);
        if (y < -H * 0.3) y += H * 1.6;
        y += mouseShiftY;

        if (y < -20 || y > H + 20) continue;

        /* cintilação sutil sincronizada com o relógio global */
        const tw = reduced ? 1 : 0.72 + 0.28 * Math.sin(time * 0.6 * p.sp + p.ph * 2.1);
        const alpha = p.a * tw * state.intro;

        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        /* o plano da frente recebe a cor de acento da camada atual */
        ctx.fillStyle = pi === 0
          ? `rgba(${glow[0]},${glow[1]},${glow[2]},${alpha * 0.9})`
          : `rgba(234,229,219,${alpha})`;
        ctx.fill();
      }
    }
  }

  resize();
  return { resize, render };
}
