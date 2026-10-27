/* Note Lab voicings built from the actual Norwegian Beats v46 synthesis presets. */
(function(root){'use strict';
const raw=root.NB46Native,clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const specs=[
 ['velvet','Velvet Voltage','modvlead','soft',{cut:.35,res:.14,det:.24,drive:.16,env:.52,fbank:'warm',sour:.035}],
 ['silk','Silk Current','softlead','soft',{cut:.42,det:.18,env:.3,drive:.08}],
 ['amber','Amber Circuits','polyan','soft',{w1:'saw',w2:'pulse',pw:.38,cut:.32,env:.65,det:.3,res:.13,drive:.14}],
 ['mother','Mother of Mist','modvlead','modular',{eng:'mod',xm:.06,hp:.08,cut:.36,env:.58,det:.19,drive:.18,lfo:.08,lfoR:.23}],
 ['914','914 Velvet','f914','modular',{cut:.45,res:.12,det:.23,fbank:'warm',env:.36,drive:.1}],
 ['serge','Serge Soft Cells','sergevocal','modular',{cut:.46,fold:.3,i1:.7,i1s:.15,res:.12,drive:.08}],
 ['buchla','Buchla Glasswater','foldlead','modular',{fold:.34,i1:.6,i1s:.08,cut:.55,det:.1,res:.09,drive:.08}],
 ['bongo','Rubber Garden','bongo','modular',{fold:.38,i1:.85,i1s:.1,cut:.48,res:.1,drive:.1}],
 ['fold','Folded Mercury','foldpad','modular',{fold:.45,i1:1.1,i1s:.13,cut:.5,det:.13,env:.34}],
 ['ping','Serge Lanterns','sergeping','modular',{fold:.26,i1:.75,cut:.58,res:.08,drive:.08}],
 ['ppg','PPG Nightwater','ppgpad','wide',{cut:.43,wmix:.35,wenv:.35,det:.24,res:.16,env:.28,drive:.1}],
 ['honda','Piston Bloom','ppglead','modular',{cut:.43,wmix:.48,wenv:.42,det:.18,res:.12,drive:.12}],
 ['vs','Vector Aurora','vschoir','wide',{cut:.5,det:.23,vx:.32,vy:.23,res:.1,env:.25,drive:.08}],
 ['seq','Moving Glass','waveseq','wide',{cut:.48,det:.16,vseq:false,vx:.4,vy:.3,drive:.1}],
 ['d50','Breath on Glass','d50pad','soft',{cut:.54,det:.19,noise:0,tr:.04,res:.08,env:.25}],
 ['rings','Rings in Rain','harmosc','soft',{mtype:'harmonic',bright:.55,cut:.65,noise:0,drive:.07}],
 ['modal','Modal Lantern','mallet','modular',{bright:.48,cut:.7,drive:.06,mdec:.4}],
 ['harmonic','Harmonic Tide','harmpad','wide',{mtype:'harmonic',bright:.58,cut:.55,drive:.06}],
 ['fmkeys','Velvet FM Keys','fmep','soft',{i1:1.2,i1s:.13,det:.07,cut:.7,drive:.04}],
 ['fmbell','Glass Satellites','fmbell','wide',{i1:1.7,i1s:.08,i2:.16,cut:.7,det:.08,drive:.05}],
 ['fmcloud','Liquid Operators','fmpad','wide',{i1:1.5,i1s:.18,cut:.64,det:.15,drive:.08}],
 ['nord','Nordic Afterlight','nordpluck','wide',{cut:.35,res:.18,env:.8,det:.3,drive:.13}],
 ['source','Source Sweep','srcsync','modular',{syncR:1.6,cut:.39,res:.16,env:.6,drive:.12,det:.16}],
 ['mini','Mini Warmth','minilead','soft',{cut:.38,res:.2,env:.48,det:.21,drive:.18,sub:0}],
 ['brass','Soft Copper','moogbrass','soft',{cut:.34,env:.65,det:.23,res:.12,drive:.13}],
 ['cs80','CS80 Twilight','cs80brass','wide',{cut:.31,env:.72,det:.27,res:.1,drive:.1}],
 ['xpander','Xpander Air','xppad','wide',{cut:.42,env:.38,det:.32,res:.12,drive:.08}],
 ['daf','Dark Modular Silk','plankchord','modular',{cut:.4,xm:.09,det:.17,sour:.07,drive:.25,res:.18}],
 ['acid','Liquid Acid','w303','modular',{cut:.24,res:.56,env:.45,det:0,sub:0,drive:.22}],
 ['pulse','Pulse Linen','sqlead','soft',{w1:'pulse',pw:.36,w2:'tri',cut:.35,det:.12,env:.6,res:.13,drive:.1}]
];
const heritage=specs.map(([id,name,source,group,overrides],i)=>{const patch={...raw[source],...overrides,atk:.002,rel:.13,amp:.5,adec:.22,lofi:0,sub:0,noise:0};return {id:'v46-'+id,name,source,group,engine:patch.eng||'an',patch,fx:{delayMix:group==='wide'?23:18,delayTime:.75,feedback:32,reverbMix:group==='wide'?24:15,room:55,chorus:group==='soft'?24:18,tone:62,fxDrive:12}};});
function random(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
// Seven engines, 111 factory patches per engine. Every recipe changes synthesis,
// articulation and effect routing; no MIDI, transposition or bit reduction is added.
const ENGINES=['an','mod','wc','fm','wt','vec','add'];
const profiles=[
 ['Needle',.008,.055,.92,.06,.12,.75],['Velvet',.002,.22,.3,.25,.28,.32],
 ['Wood',.004,.13,.78,.12,.08,.46],['Bloom',.022,.44,.18,.36,.4,.25],
 ['Rubber',.001,.1,.82,.08,.18,.9],['Glass',.002,.33,.64,.42,.33,.2],
 ['Silhouette',.006,.25,.52,.2,.15,.5],['Current',.003,.18,.4,.3,.27,.68],
 ['Lantern',.012,.36,.32,.4,.35,.38]
];
const materials=['Silver','Ivory','Amber','Opal','Mercury','Linen','Copper','Pearl','Quartz','Velour','Cobalt','Porcelain','Satin'];
const places=['Circuit','Orbit','Garden','Prism','Tide','Signal','Halo','Thread','Room','Satellite','Fountain','Echo'];
const modelNames={an:'Analogue',mod:'Modular',wc:'Fold',fm:'Operator',wt:'Table',vec:'Vector',add:'Resonator'};
function design(seed,engine,profileIndex){
 const r=random(seed),range=(a,b)=>a+(b-a)*r(),pick=a=>a[Math.floor(r()*a.length)],
 bases=heritage.filter(p=>p.engine===engine),base=pick(bases),p={...base.patch},
 [art,atk,rel,amp,verb,chorus,env]=profiles[profileIndex%profiles.length];
 Object.assign(p,{eng:engine,cut:range(.2,.73),res:range(.05,profileIndex===4?.58:.36),
 env:env*range(.65,1.15),dec:range(.07,.65),det:range(.015,.38),drive:range(.035,.27),
 sour:range(0,.075),msour:profileIndex===7?range(.04,.17):0,ksour:0,
 atk:atk*range(.65,1.3),rel:rel*range(.7,1.2),amp,adec:range(.06,.85),
 sub:profileIndex===2?range(.025,.11):0,noise:0,lofi:0,tr:0,foldPost:profileIndex===7?range(.08,.32):0,fsh:0,dist:0,up:0,glide:profileIndex===7?range(.03,.18):0,
 drift:range(.02,.2),lfo:range(0,.18),lfoR:pick([.08,.17,.31,.6,1.2,2.4]),
 fbank:pick(['','warm','hollow','vowel a','vowel o']),slope:pick([12,24]),ft:profileIndex===6?'bp':'lp',
 slowMovement:profileIndex===3||profileIndex===8?range(.1,.65):0,ampDecay:undefined,postFilter:pick(['lowpass','highpass','bandpass','notch']),postCut:range(.58,1),postRes:range(.04,.2),postMix:profileIndex===6?.38:range(0,.2)});
 delete p.ampDecay;delete p.pad;delete p.w4;delete p.w5;delete p.oct4;delete p.oct5;
 if(engine==='an'||engine==='mod'){
  p.w1=pick(['saw','pulse','tri','sq','sine','sync']);p.w2=pick(['saw','pulse','tri','sine',null]);p.w3=pick(['tri','sine','saw',null]);
  p.l1=range(.48,.7);p.l2=range(.1,.38);p.l3=range(.06,.22);p.oct1=0;p.oct2=pick([0,0,12]);p.oct3=pick([0,12]);p.det3=range(-5,5);
  p.pw=range(.15,.48);p.syncR=pick([1.3,1.5,2,2.5,3]);p.unison=range(0,.24);
  p.xm=engine==='mod'?range(.005,.19):0;p.ring=engine==='mod'&&profileIndex===6?range(.05,.23):0;p.hp=range(.01,.17);
 }else if(engine==='wc'){
  p.w1=pick(['sine','tri']);p.r1=pick([.5,1,1.5,2,3,4]);p.i1=range(.25,1.65);p.i1s=range(.02,.32);p.d1=range(.035,.4);p.fold=range(.15,.7);p.fenv=range(.05,.6);p.fdec=range(.03,.7);
 }else if(engine==='fm'){
  p.rc=1;p.r1=pick([.5,1,1.5,2,3,4,5]);p.r2=pick([1,2,3,5,7]);p.i1=range(.3,3.2);p.i1s=range(.02,.55);p.d1=range(.025,.6);p.i2=range(.03,.7);p.i2s=range(0,.13);p.d2=range(.03,.6);p.alg=pick(['par','stack']);p.m1w=pick(['sine','tri']);
 }else if(engine==='wt'){
  p.wa=pick([0,1,2,3,4,5,7,8]);p.wb=pick([1,2,3,4,5,6,7,8,9]);p.wmix=range(.08,.9);p.wenv=range(.02,.65);p.wdec=range(.04,.8);
 }else if(engine==='vec'){
  p.va=pick([0,1,2,3]);p.vb=pick([1,4,5,7]);p.vc=pick([2,3,6,8]);p.vd=pick([0,5,7,8,9]);p.vx=range(.05,.8);p.vy=range(.05,.8);p.vseq=false;
 }else{
  p.mtype=pick(['string','mallet','bell','glass','harmonic']);p.bright=range(.3,.78);p.mdec=range(.15,.8);p.damp=range(.15,.85);p.inh=profileIndex===5?range(.01,.15):0;p.msus=profileIndex===3?.25:0;
 }
 const fxStyle=profileIndex%6,fx={delayMix:fxStyle===0?0:Math.round(range(10,fxStyle===5?36:27)),delayTime:pick([.25,.5,.75,1,1.5]),feedback:Math.round(range(12,fxStyle===5?49:38)),reverbMix:Math.round(verb*100*range(.65,1.15)),room:Math.round(range(15,85)),chorus:Math.round(chorus*100*range(.5,1.2)),tone:Math.round(range(38,85)),fxDrive:Math.round(range(0,22))};
 return {...base,engine,patch:p,fx,articulation:art,group:engine==='an'?'soft':engine==='mod'||engine==='wc'?'modular':'wide',seed};
}
const factory=[...heritage];
for(let e=0;e<ENGINES.length;e++){
 const engine=ENGINES[e],needed=111-factory.filter(p=>p.engine===engine).length;
 for(let i=0;i<needed;i++){
  const seed=(0xa73d91+e*1000003+i*7919)>>>0,profile=i%profiles.length,entry=design(seed,engine,profile);
  entry.id='aga-'+engine+'-'+String(i+1).padStart(3,'0');
  entry.name=materials[(i+e*3)%materials.length]+' '+places[Math.floor(i/materials.length)%places.length]+' · '+profiles[profile][0]+' '+modelNames[engine];
  factory.push(entry);
 }
}
// Factory sounds use the same concise, named FX choices as the performance strip.
if(root.FXRecipes)factory.forEach((p,i)=>{const d=root.FXRecipes.delays[1+i%(root.FXRecipes.delays.length-1)],v=root.FXRecipes.reverbs[1+i%(root.FXRecipes.reverbs.length-1)];p.fx={...p.fx,...d.values,...v.values};});
function randomize(seed,group='all'){
 const r=random(seed),engines=group==='soft'?['an','wt','fm']:group==='modular'?['mod','wc']:group==='wide'?['wt','vec','add','fm']:ENGINES;
 const engine=engines[Math.floor(r()*engines.length)],profile=Math.floor(r()*profiles.length),entry=design(seed^0x51cba7,engine,profile);
 // A fresh second synthesis source, never another selected factory preset.
 const secondEngine=ENGINES[(ENGINES.indexOf(engine)+1+Math.floor(r()*(ENGINES.length-1)))%ENGINES.length];
 const second=design((seed^0x4b37d019)>>>0,secondEngine,Math.floor(r()*profiles.length));
 entry.patch.layer=second.patch;entry.patch.blend=Math.round(18+r()*32);
 const shape=Math.floor(r()*4);
 entry.patch.atk=[.003,.02,.065,.14][shape]*(.7+r()*.6);
 entry.patch.rel=[.15,.35,.75,1.35][shape]*(.75+r()*.5);
 entry.patch.sustain=[.35,.6,.75,.85][shape];entry.patch.adec=.1+r()*.8;
 if(root.FXRecipes){const d=root.FXRecipes.delays[1+Math.floor(r()*(root.FXRecipes.delays.length-1))],v=root.FXRecipes.reverbs[1+Math.floor(r()*(root.FXRecipes.reverbs.length-1))];entry.fx={...entry.fx,...d.values,...v.values};}
 entry.recipe={seed:seed>>>0,sources:[engine,secondEngine],blend:entry.patch.blend,shape};
 if(group!=='all')entry.group=group;entry.id='random-'+(seed>>>0);entry.name=materials[Math.floor(r()*materials.length)]+' '+places[Math.floor(r()*places.length)]+' · '+profiles[profile][0]+' '+modelNames[engine];return entry;
}
function knobs(p){const eng=p.eng||'an',pct=v=>Math.round(clamp(v,0,1)*100);return {
 cutoff:pct(p.cut??.4),resonance:pct(p.res??.15),detune:pct(p.det??.2),drive:pct(p.drive??.12),sour:pct(p.sour||0),filterEnv:Math.round((p.env??.5)*50),decay:pct(p.dec??.25),attack:pct(Math.sqrt(Math.max(0,((p.atk??.002)-.002)/1.44))),release:pct(Math.sqrt(Math.max(0,((p.rel??.13)-.006)/4))),glide:pct(p.glide||0),tuning:0,legato:false,
 timbre:pct(eng==='wc'?(p.fold??.35):eng==='fm'?(p.i1??1)/5:eng==='wt'?(p.wmix??.4):eng==='add'?(p.bright??.5):eng==='vec'?((p.vx??.4)-.1)/.65:((p.pw??.29)-.08)/.42),movement:pct(eng==='vec'?((p.vy??.3)-.11)/.5:(p.slowMovement||0)),subLevel:pct(p.sub||0),
 envelopeVersion:2,sustain:pct((p.sustain??(1-(p.amp??.5)*.85))**1.4),sourceBlend:p.blend||0,ampDecay:pct(Math.sqrt(Math.max(0,((.05+(p.adec??.22)*.35)-.015)/2.52))),pluck:pct(p.amp??.5),unison:pct(p.unison??Math.min(.4,(p.det||0)*.45)),drift:pct(p.drift||0),fold:pct(p.foldPost||0),filterMotion:pct(p.lfo||0),motionRate:pct(Math.log2((p.lfoR||.2)/.05)/7),
 postCut:pct(p.postCut??1),postRes:pct(p.postRes??.1),postMix:pct(p.postMix||0),crossMod:pct(p.xm||0),ring:pct(p.ring||0),
 osc1Level:pct(p.l1??.6),osc2Level:pct(p.w2?(p.l2??.4):0),osc3Level:pct(p.w3?(p.l3??.25):0),osc1Tune:p.oct1||0,osc2Tune:p.oct2||0,osc3Tune:p.oct3||0,
 ratio1:Math.round((p.r1||1)*10),ratio2:Math.round((p.r2||1)*10),fm2:pct((p.i2||0)/2),modDecay:pct(p.d1??.2),tableEnv:pct(p.wenv||0),modalDecay:pct(p.mdec??.5),damping:pct(p.damp??.5)
 };}
root.NB46Bank={factory,heritage,randomize,knobs,random,engines:ENGINES};
})(typeof window!=='undefined'?window:globalThis);
