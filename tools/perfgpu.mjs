import { chromium } from 'playwright';
const b = await chromium.launch({ headless:false, args:['--use-angle=default','--enable-gpu-rasterization'] });
const p = await b.newPage({viewport:{width:1440,height:900}});
await p.goto('http://127.0.0.1:4178/',{waitUntil:'networkidle'});
await p.waitForTimeout(4500);
const gpu = await p.evaluate(()=>{const c=document.createElement('canvas');const g=c.getContext('webgl');
  const d=g&&g.getExtension('WEBGL_debug_renderer_info');return d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):'?'});
console.log('GPU:', gpu);
const r = await p.evaluate(async () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  const frames=[]; let last=performance.now(), done; const q=new Promise(r=>done=r); let y=0;
  function step(){ const n=performance.now(); frames.push(n-last); last=n;
    y += max/240; window.__lenis.scrollTo(y,{immediate:true,force:true});
    if(y<max) requestAnimationFrame(step); else done(); }
  requestAnimationFrame(step); await q; frames.shift();
  const s=[...frames].sort((a,b)=>a-b);
  return { quadros:frames.length,
    medio:+(frames.reduce((a,b)=>a+b,0)/frames.length).toFixed(2),
    p95:+s[Math.floor(s.length*.95)].toFixed(2),
    pior:+s[s.length-1].toFixed(2),
    acima20ms:frames.filter(f=>f>20).length };
});
console.log('DESEMPENHO COM GPU:', JSON.stringify(r));
console.log('FPS medio:', (1000/r.medio).toFixed(1));
await b.close();
