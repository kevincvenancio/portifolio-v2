import { chromium } from 'playwright';
async function run(label, css, args){
  const b = await chromium.launch({ args: args||[] });
  const p = await b.newPage({viewport:{width:1440,height:900}});
  await p.goto('http://127.0.0.1:4178/',{waitUntil:'networkidle'});
  await p.waitForTimeout(4200);
  if (css) await p.addStyleTag({content:css});
  await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const frames=[]; let last=performance.now(), done; const q=new Promise(r=>done=r); let y=0;
    function step(){ const n=performance.now(); frames.push(n-last); last=n;
      y += max/200; window.__lenis.scrollTo(y,{immediate:true,force:true});
      if(y<max) requestAnimationFrame(step); else done(); }
    requestAnimationFrame(step); await q; frames.shift();
    const s=[...frames].sort((a,b)=>a-b);
    return { medio:+(frames.reduce((a,b)=>a+b,0)/frames.length).toFixed(1), p95:+s[Math.floor(s.length*.95)].toFixed(1) };
  });
  const gpu = await p.evaluate(()=>{ const c=document.createElement('canvas'); const g=c.getContext('webgl');
    const d=g&&g.getExtension('WEBGL_debug_renderer_info'); return d? g.getParameter(d.UNMASKED_RENDERER_WEBGL):'?' });
  console.log(`${label.padEnd(28)} medio=${String(r.medio).padStart(6)}ms  p95=${String(r.p95).padStart(6)}ms   [${gpu}]`);
  await b.close();
}
await run('completo', null);
await run('sem shader webgl', '#gl{display:none!important}');
await run('sem poeira', '#dust{display:none!important}');
await run('sem grao/scanlines', '.grain,.scanlines{display:none!important}');
await run('sem arte procedural', '.artcanvas{display:none!important}');
await run('so DOM (sem canvas)', '#gl,#dust,.artcanvas,.grain,.scanlines{display:none!important}');
