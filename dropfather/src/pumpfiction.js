/* PUMP FICTION as Dropfather's master chain (Tarjei Krogh's engine, src/vendor/pumpfiction-engine.js).
   Project settings: p.pf = {on, cfg: {…overrides of PUMP FICTION's defaults}, label}. The pump pattern is drawn
   on the song's own clock, from bar 1. */
(function(root){'use strict';
const PF=()=>root.PUMP_FICTION;
const copy=x=>JSON.parse(JSON.stringify(x));
function settings(p){return {...copy(PF().defaults),...(p.pf?.cfg||{}),bpm:p.bpm,bypass:false,matchScale:1};}
const patternSteps=i=>Array.from({length:16},(_,j)=>PF().patterns[i]?.[j]||0);
// PUMP FICTION's preset(i): its sound, envelope and pump pattern.
function preset(i){
 const pr=PF().presets[i],c={};[c.drive,c.body,c.glue,c.bite,c.mix,c.output,c.depth,c.release]=pr.slice(1,9);
 Object.assign(c,{env:['smooth','snap','gate'][pr[10]]||'smooth',enabled:true,pattern:pr[9],count:16,steps:patternSteps(pr[9]),eqLow:0,eqMud:0,eqPresence:0,eqAir:0,clipDb:0,autoThreshold:null,autoRatio:null});
 return {label:pr[0],cfg:c};
}
// PUMP FICTION's magic(which): one of the one-click moves on top of the current sound.
function macro(cfg,which){return {...cfg,...PF().macros[which],autoThreshold:null,autoRatio:null};}
// Its smart engine: the mix analysed, then CLEAN / FAT / WILD set up for it.
function analyse(p,buffer){const E=root.PumpFictionEngine(settings(p)),stats=E.analyzeBuffer(buffer);return {stats,variants:E.variantSet(stats)};}
const SMART_KEYS=['eqLow','eqMud','eqPresence','eqAir','autoThreshold','autoRatio','clipDb','clipMode','drive','body','glue','bite','mix','output','subDrive','midDrive','airDrive','punch','depth','enabled','release','env'];
function smart(cfg,variant){const c={...cfg};for(const k of SMART_KEYS)if(variant[k]!==undefined)c[k]=variant[k];if(c.depth>0&&!(c.steps||[]).some(x=>x))Object.assign(c,{pattern:0,count:16,steps:patternSteps(0)});return c;}
// The chain itself: input → PUMP FICTION → dest. opt {from (song s), t0 (ctx s), len (s)} draws the pump.
function chain(ctx,input,dest,p,opt){
 const cfg=settings(p),E=root.PumpFictionEngine(cfg),n=E.makeNodes(ctx,input,dest);
 if(opt&&cfg.enabled&&cfg.depth>0&&(cfg.steps||[]).some(x=>x>0)&&opt.len>0){const rate=200,N=Math.max(2,Math.ceil(opt.len*rate)),curve=new Float32Array(N);for(let i=0;i<N;i++)curve[i]=E.gainAt(opt.from+i/rate);n.pump.gain.setValueCurveAtTime(curve,opt.t0,opt.len);}
 return n;
}
const api={settings,preset,macro,analyse,smart,chain,patternSteps,presets:()=>PF().presets.map(p=>p[0]),patterns:()=>PF().patterns,MACROS:['fatter','punchier','warmer','tighter','louder']};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PumpFiction=api;
})(typeof globalThis!=='undefined'?globalThis:this);
