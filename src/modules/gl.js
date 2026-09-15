/* ════════════════════════════════════════════════════════════
   CAMPO VOLUMÉTRICO — WebGL
   Um campo de ruído com domain warping que "desce" conforme o
   scroll. A paleta muda de temperatura com a profundidade:
   quente (superfície) → fria (núcleo) → quente (ressurgir).
   ════════════════════════════════════════════════════════════ */

/* Paradas da paleta — compartilhadas com o HUD (CSS custom props) */
export const PALETTE = [
  { base: [0.039, 0.031, 0.024], glow: [1.000, 0.420, 0.208], hex: '#FF6B35' }, // 00 superfície
  { base: [0.031, 0.039, 0.055], glow: [0.910, 0.894, 0.855], hex: '#E8E4DA' }, // 02 neutra
  { base: [0.024, 0.039, 0.078], glow: [0.302, 0.486, 1.000], hex: '#4D7CFF' }, // 04 fria
  { base: [0.016, 0.043, 0.067], glow: [0.071, 0.839, 0.769], hex: '#12D6C4' }, // 06 dados
  { base: [0.063, 0.031, 0.020], glow: [1.000, 0.478, 0.239], hex: '#FF7A3D' }, // 07 superfície
];

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform float uProg;
uniform vec2  uMouse;
uniform float uIntro;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i),            hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++){ v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

/* As paradas não são equidistantes: o frio precisa se sustentar
   por toda a travessia dos projetos e só ceder perto do fim. */
float stopT(float p){
  if (p < 0.16) return p / 0.16;
  if (p < 0.40) return 1.0 + (p - 0.16) / 0.24;
  if (p < 0.86) return 2.0 + (p - 0.40) / 0.46;
  if (p < 0.96) return 3.0 + (p - 0.86) / 0.10;
  return 4.0;
}

vec3 ramp(vec3 a, vec3 b, vec3 c, vec3 d, vec3 e, float t){
  vec3 r = mix(a, b, smoothstep(0.0, 1.0, t));
  r = mix(r, c, smoothstep(1.0, 2.0, t));
  r = mix(r, d, smoothstep(2.0, 3.0, t));
  r = mix(r, e, smoothstep(3.0, 4.0, t));
  return r;
}

void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes.xy) / uRes.y;
  float t = uTime * 0.042;

  /* camada próxima — desce rápido com o scroll */
  vec2 q = p * 1.55;
  q.y += uProg * 3.4;
  q += uMouse * 0.13;
  vec2 w = vec2(fbm(q + vec2(0.0, t)), fbm(q + vec2(5.2, 1.3) - vec2(t, 0.0)));
  float f = fbm(q + w * 1.75 + vec2(t * 0.5, -t * 0.3));

  /* camada distante — parallax lento, dá o senso de profundidade */
  vec2 q2 = p * 0.72;
  q2.y += uProg * 1.35;
  q2 += uMouse * 0.045;
  float f2 = fbm(q2 + vec2(t * 0.22, t * 0.11));

  vec3 base = ramp(vec3(0.039,0.031,0.024), vec3(0.031,0.039,0.055),
                   vec3(0.024,0.039,0.078), vec3(0.016,0.043,0.067),
                   vec3(0.063,0.031,0.020), stopT(uProg));
  vec3 glow = ramp(vec3(1.000,0.420,0.208), vec3(0.910,0.894,0.855),
                   vec3(0.302,0.486,1.000), vec3(0.071,0.839,0.769),
                   vec3(1.000,0.478,0.239), stopT(uProg));

  vec3 col = base;
  col = mix(col, base * 2.4, smoothstep(0.30, 0.88, f2) * 0.6);      /* massa distante */
  col += glow * pow(smoothstep(0.34, 0.92, f), 2.2) * 0.30;          /* névoa próxima  */
  col += glow * pow(smoothstep(0.58, 1.00, f), 6.0) * 0.45;          /* filamentos     */

  float rad = 1.0 - length(p * vec2(0.72, 1.08));
  col += glow * pow(max(rad, 0.0), 3.2) * 0.16;                      /* halo central   */

  float shaft = exp(-abs(p.x) * 4.2) * (1.0 - smoothstep(0.0, 0.22, uProg)) * 0.16;
  col += glow * shaft;                                               /* feixe do hero  */

  col *= uIntro;
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;       /* dither         */

  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl, type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('[gl] shader:', gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

export function initGL(canvas, state){
  const gl = canvas.getContext('webgl', {
    antialias: false, alpha: false, depth: false, stencil: false,
    powerPreference: 'high-performance', preserveDrawingBuffer: false,
  });
  if (!gl) { canvas.style.display = 'none'; return { ok: false, resize(){}, render(){} }; }

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.style.display = 'none'; return { ok: false, resize(){}, render(){} }; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[gl] link:', gl.getProgramInfoLog(prog));
    canvas.style.display = 'none';
    return { ok: false, resize(){}, render(){} };
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = {
    res:   gl.getUniformLocation(prog, 'uRes'),
    time:  gl.getUniformLocation(prog, 'uTime'),
    prog:  gl.getUniformLocation(prog, 'uProg'),
    mouse: gl.getUniformLocation(prog, 'uMouse'),
    intro: gl.getUniformLocation(prog, 'uIntro'),
  };

  let w = 0, h = 0;

  function resize(){
    /* O ruído fbm é caro: limitamos a resolução e deixamos o
       upscale do browser suavizar. Visualmente indistinguível. */
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const scale = window.innerWidth < 760 ? 0.5 : 0.62;
    w = Math.max(1, Math.round(window.innerWidth  * dpr * scale));
    h = Math.max(1, Math.round(window.innerHeight * dpr * scale));
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.res, w, h);
  }

  function render(time){
    gl.uniform1f(u.time,  time);
    gl.uniform1f(u.prog,  state.prog);
    gl.uniform2f(u.mouse, state.mx, state.my);
    gl.uniform1f(u.intro, state.intro);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  resize();
  return { ok: true, resize, render };
}
