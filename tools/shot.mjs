import { chromium } from 'playwright';
import fs from 'node:fs';
const W = +(process.argv[2]||1440), H = +(process.argv[3]||900);
const tag = process.argv[4]||`${W}`;
fs.mkdirSync('shots/iter',{recursive:true});
const b = await chromium.launch();
const ctx = await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:1});
const p = await ctx.newPage();
const errs=[];
p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.goto('http://127.0.0.1:5178/',{waitUntil:'networkidle',timeout:60000});
await p.waitForTimeout(4500);
// pontos de interesse: fração do scroll total
const STOPS = JSON.parse(process.env.STOPS || '[0,0.06,0.115,0.16,0.215,0.27,0.32,0.38,0.44,0.5,0.56,0.62,0.70,0.78,0.86,0.93,1]');
const max = await p.evaluate(()=>document.documentElement.scrollHeight-innerHeight);
for (let i=0;i<STOPS.length;i++){
  const y = Math.round(max*STOPS[i]);
  await p.evaluate(yy=>{ window.__lenis ? window.__lenis.scrollTo(yy,{immediate:true,force:true}) : scrollTo(0,yy); }, y);
  await p.waitForTimeout(1000);
  await p.screenshot({path:`shots/iter/${tag}-${String(i).padStart(2,'0')}-${Math.round(STOPS[i]*100)}.png`});
}
console.log('erros:', errs.length?errs.slice(0,6).join(' | '):'nenhum');
await b.close();
