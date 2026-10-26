/* Norwegian Beats family generator, adapted for a dark, melodic bass-only palette.
   Source famSnd/latelySnd retained. Labels indicate software recipes, not hardware emulation accuracy. */
(function(root){'use strict';const base=root.KroghBass;const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function familySettings(family,genre,seed){const rnd=rng(seed),pick=a=>a[Math.floor(rnd()*a.length)];const TRT={chiff:1,bow:1,breath:1,mallet:1};
function latelySnd(r){r=r||((a,b)=>(a+b)/2);return{eng:'fm',rc:1,r1:1,m1w:'sine',i1:r(1.9,2.6),i1s:r(.3,.45),d1:r(.1,.16),r2:1,i2:r(.4,.7),i2s:.08,d2:.05,alg:'par',det:r(.03,.06),
  cut:r(.5,.6),res:.05,env:r(.15,.3),dec:r(.15,.25),drive:r(.12,.22),slope:24,amp:r(.3,.45),adec:r(.3,.45),sub:r(.6,.75)};}
function famSnd(fam,g,role){
  const r=(a,b)=>a+rnd()*(b-a),B=role==='bass',L=role==='lead';
  let s;
  switch(fam){
  case 'fm':if(B){s=latelySnd(r);break;}s={eng:'fm',rc:B&&rnd()<.25?.5:1,r1:pick(B?[1,1,1,2,.5]:[1,2,3,4,14]),m1w:pick(['sine','sine','tri','saw']),i1:r(1,4),i1s:r(0,1),d1:r(.05,.35),
    r2:pick([1,2,3,4,7,.5]),i2:r(0,2),i2s:r(0,.4),d2:r(.02,.2),alg:pick(['par','par','stack']),det:r(0,.25),cut:r(.7,1),res:r(0,.15),env:r(0,.15),dec:r(.2,.4),drive:r(.05,.3),slope:24,amp:r(.3,.8),adec:r(.2,.6),sub:B?r(0,.3):0};break;
  /* Jupiter-8: two oscillators, wide and smooth 24 dB filter, the big lush poly. Prophet-5: brassy, a little poly-mod.
     ARP Odyssey: sharp 12 dB filter that bites. Bit 99: stable digital oscillators, warm and round. TB-303: one saw or square, resonant sweep, slides.
     MatrixBrute: three oscillators and heavy drive. Subsequent 37: two oscillators, sub oscillator and ladder drive. */
  case 'jup8':s={w1:'saw',w2:pick(['saw','pulse']),pw:r(.25,.45),oct2:B?pick([0,-12]):pick([0,0,12]),det:r(.2,.45),cut:r(.3,.55),res:r(.05,.3),env:r(.2,.5),dec:r(.2,.5),drive:r(.08,.22),slope:24,amp:r(0,.3),adec:r(.2,.5),sub:B?r(.15,.35):0,lfo:r(.02,.07),lfoR:r(.1,.4)};break;
  case 'p5':s={eng:'mod',w1:'saw',w2:pick(['pulse','saw']),pw:r(.2,.45),oct2:B?pick([0,-12]):pick([0,12,-12]),xm:r(0,.14),det:r(.1,.3),cut:r(.28,.5),res:r(.1,.4),env:r(.35,.7),dec:r(.15,.45),drive:r(.15,.32),slope:24,amp:r(0,.35),adec:r(.15,.45),sub:B?r(.1,.3):0};break;
  case 'odyssey':s={w1:'saw',w2:pick(['pulse','saw','sync']),syncR:r(1.5,3),pw:r(.15,.4),det:r(.05,.2),cut:r(.25,.5),res:r(.3,.68),env:r(.4,.8),dec:r(.08,.28),drive:r(.2,.45),slope:12,amp:r(.1,.4),adec:r(.1,.3),sub:B?r(.15,.35):0};break;
  case 'bit99':s={w1:'saw',w2:pick(['pulse','saw']),oct2:B?-12:pick([0,12]),pw:r(.3,.45),det:r(.02,.1),cut:r(.25,.42),res:r(.1,.35),env:r(.3,.6),dec:r(.12,.35),drive:r(.1,.25),slope:24,amp:r(.1,.35),adec:r(.15,.4),sub:B?r(.2,.4):0,drift:r(0,.1)};break;
  case 'tb303':s={w1:pick(['saw','saw','sq']),w2:null,det:0,cut:r(.22,.38),res:r(.55,.8),env:r(.45,.8),dec:r(.15,.35),drive:r(.25,.5),slope:12,amp:0,sub:0,glide:r(.12,.25),legato:true};break;
  case 'mbrute':s={eng:'mod',w1:'saw',w2:pick(['pulse','saw']),w3:'sq',oct3:-12,l3:r(.25,.45),pw:r(.15,.4),xm:r(0,.2),det:r(.08,.3),cut:r(.22,.45),res:r(.2,.6),env:r(.35,.7),dec:r(.1,.35),drive:r(.35,.65),slope:pick([12,24]),amp:r(.05,.35),adec:r(.12,.35),sub:B?r(.15,.35):0};break;
  case 'sub37':s={w1:'saw',w2:pick(['saw','sq']),w3:'sq',oct3:-12,l3:r(.3,.5),det:r(.05,.2),cut:r(.2,.4),res:r(.1,.45),env:r(.35,.7),dec:r(.12,.35),drive:r(.3,.65),slope:24,amp:r(.1,.3),adec:r(.15,.35),sub:B?r(.2,.4):0};break;
  /* the Moog family: one ladder filter, different bodies. Prodigy thin and sharp with sync, Rogue plain and solid, Taurus deep pedals,
     Memorymoog and Moog One big three-oscillator polys, Voyager rich and smooth, the Phattys driven, Grandmother semi-modular with spring,
     Matriarch wide and soft, Muse with its modulation oscillator, Mother-32 one oscillator straight into the ladder */
  /* Supersaw: seven saws spread wide (the JP-8000 kind), for trance and big room leads and chords */
  case 'ssaw':s={w1:'saw',w2:'saw',w3:'saw',oct3:0,l3:r(.45,.6),w4:'saw',oct4:0,l4:r(.4,.55),w5:'saw',oct5:L?12:0,l5:r(.15,.3),det:r(.6,.85),cut:r(.45,.65),res:r(0,.15),env:r(.1,.3),dec:r(.2,.45),drive:r(.05,.15),slope:24,amp:r(0,.25),adec:r(.2,.45),sub:B?r(.2,.35):0};break;
  case 'prodigy':s={w1:pick(['saw','pulse']),w2:pick(['sync','saw','pulse']),syncR:r(1.5,3),pw:r(.15,.45),det:r(.05,.18),cut:r(.22,.42),res:r(.15,.5),env:r(.4,.75),dec:r(.1,.3),drive:r(.25,.5),slope:24,amp:r(.1,.35),adec:r(.12,.3),sub:B?r(.1,.3):0};break;
  case 'rogue':s={w1:'saw',w2:pick(['saw','pulse']),oct2:B?-12:0,pw:r(.2,.45),det:r(.03,.12),cut:r(.2,.38),res:r(.1,.4),env:r(.3,.6),dec:r(.12,.3),drive:r(.2,.4),slope:24,amp:r(.1,.3),adec:r(.15,.3),sub:B?r(.15,.35):0};break;
  case 'taurus':s={w1:'saw',w2:'saw',w3:'sq',oct3:-12,l3:r(.4,.6),det:r(.2,.4),cut:r(.18,.32),res:r(.2,.45),env:r(.3,.55),dec:r(.3,.6),drive:r(.35,.6),slope:24,amp:0,adec:.3,sub:B?r(.25,.45):.1,drift:r(.3,.5)};break;
  case 'memory':s={w1:'saw',w2:'saw',w3:pick(['saw','pulse']),oct3:B?-12:pick([0,12,-12]),l3:r(.25,.4),pw:r(.25,.45),det:r(.25,.45),cut:r(.28,.5),res:r(.1,.35),env:r(.25,.55),dec:r(.2,.5),drive:r(.2,.4),slope:24,amp:r(0,.3),adec:r(.2,.5),sub:B?r(.15,.3):0};break;
  case 'voyager':s={w1:'saw',w2:pick(['saw','sq']),w3:pick(['tri','saw','sq']),oct3:B?-12:pick([12,-12,0]),l3:r(.25,.45),det:r(.1,.28),cut:r(.22,.45),res:r(.15,.5),env:r(.35,.7),dec:r(.15,.4),drive:r(.3,.6),slope:24,amp:r(.05,.3),adec:r(.15,.4),sub:B?r(.15,.35):0,glide:L?r(.05,.15):0};break;
  case 'phatty':s={w1:pick(['saw','sq']),w2:pick(['saw','sq','pulse']),oct2:B?-12:0,pw:r(.2,.45),det:r(.05,.2),cut:r(.2,.4),res:r(.15,.5),env:r(.35,.7),dec:r(.12,.35),drive:r(.45,.8),slope:24,amp:r(.1,.3),adec:r(.12,.3),sub:B?r(.2,.4):0};break;
  case 'grandma':s={eng:'mod',w1:pick(['saw','sq','tri']),w2:pick(['sq','saw','pulse']),pw:r(.2,.45),xm:r(0,.15),det:r(.05,.25),cut:r(.22,.45),res:r(.2,.55),env:r(.3,.65),dec:r(.12,.35),drive:r(.2,.45),slope:24,amp:r(.1,.35),adec:r(.15,.35),sub:B?r(.1,.3):0,rev:r(.15,.3)};break;
  case 'matriarch':s={w1:'saw',w2:'saw',w3:pick(['sq','saw']),oct3:pick([0,12,-12]),l3:r(.2,.4),det:r(.2,.45),cut:r(.25,.5),res:r(.1,.4),env:r(.25,.6),dec:r(.2,.5),drive:r(.2,.4),slope:24,amp:r(0,.3),adec:r(.2,.5),sub:B?r(.15,.3):0,lfo:r(.03,.1),lfoR:r(.1,.5)};break;
  case 'moogone':s={w1:'saw',w2:pick(['saw','pulse']),w3:pick(['saw','sq']),oct3:B?-12:pick([0,12]),l3:r(.25,.4),w4:rnd()<.4?'saw':null,oct4:pick([-12,7,12]),l4:r(.12,.25),pw:r(.25,.45),det:r(.3,.5),cut:r(.3,.52),res:r(.1,.35),env:r(.25,.55),dec:r(.2,.5),drive:r(.2,.4),slope:24,amp:r(0,.3),adec:r(.2,.5),sub:B?r(.15,.3):0,lfo:r(.02,.08),lfoR:r(.1,.4)};break;
  case 'muse':s={eng:'mod',w1:'saw',w2:pick(['pulse','saw']),pw:r(.2,.45),xm:r(.02,.2),det:r(.15,.35),cut:r(.3,.5),res:r(.1,.4),env:r(.25,.6),dec:r(.15,.45),drive:r(.15,.35),slope:24,amp:r(0,.3),adec:r(.2,.45),sub:B?r(.15,.3):0,lfo:r(.04,.12),lfoR:r(.1,.6)};break;
  case 'm32':s={w1:pick(['saw','pulse']),w2:null,pw:r(.15,.45),det:0,cut:r(.18,.38),res:r(.3,.7),env:r(.4,.8),dec:r(.1,.3),drive:r(.3,.6),slope:24,amp:r(.1,.4),adec:r(.1,.3),sub:0,glide:r(0,.15)};break;
  case 'mini':s={w1:pick(['saw','saw','sq','pulse']),pw:r(.25,.45),w2:pick(['saw','saw','sq','tri']),w3:rnd()<.7?pick(['sq','saw','tri']):null,oct3:B?pick([-12,-12,-24]):pick([-12,12]),l3:r(.25,.5),
    det:r(.08,.3),cut:r(.2,.4),res:r(.1,.45),env:r(.3,.65),dec:r(.15,.45),drive:r(.3,.6),slope:24,amp:r(0,.3),adec:r(.15,.4),sub:B?r(0,.25):0,noise:rnd()<.2?r(.08,.25):0,noiseC:r(.3,.8)};break;
  case 'modular':s={w1:pick(['saw','pulse','saw']),pw:r(.15,.4),w2:pick(['saw','pulse','sq']),w3:pick(['saw','sq','tri']),oct3:B?-12:pick([-12,12,0]),l3:r(.25,.45),
    w4:rnd()<.45?pick(['saw','tri','pulse']):null,oct4:B?pick([-12,0]):pick([7,12,-12]),l4:r(.15,.3),
    det:r(.12,.4),cut:r(.22,.45),res:r(.2,.55),env:r(.25,.6),dec:r(.2,.55),drive:r(.2,.5),slope:24,amp:r(0,.25),adec:r(.2,.5),sub:B?r(0,.2):0,
    fbank:rnd()<.45?pick(['warm','hollow','nasal','vowel a','vowel o']):null,lfo:rnd()<.6?r(.04,.15):0,lfoR:r(.06,.4)};break;
  case 'source':{const sy=rnd()<(L?.6:.35);s={w1:sy?'sync':pick(['saw','pulse']),syncR:r(1.6,3.2),w2:pick(['saw','pulse','sq']),oct2:B?pick([-12,0]):pick([0,12,-12]),pw:r(.12,.42),
    det:r(.05,.22),cut:r(.25,.48),res:r(.2,.55),env:r(.4,.75),dec:r(.1,.32),drive:r(.25,.5),slope:24,amp:r(.1,.4),adec:r(.12,.35),sub:B?r(0,.2):0};break;}
  case 'arp':s={eng:'mod',w1:pick(['saw','saw','pulse']),pw:r(.15,.45),w2:pick(['pulse','sq','saw']),w3:rnd()<.6?pick(['tri','sq','saw']):null,oct3:B?-12:pick([-12,12]),l3:r(.25,.45),
    xm:r(0,.3),ring:rnd()<.25?r(.2,.5):0,hp:r(0,.15),det:r(.05,.3),cut:r(.22,.45),res:r(.2,.7),env:r(.3,.7),dec:r(.1,.4),drive:r(.2,.5),slope:24,amp:r(.05,.4),adec:r(.15,.4),
    sub:B?r(0,.2):0,noise:rnd()<.25?r(.08,.25):0,noiseC:r(.3,1),sh:rnd()<(L?.5:.3)?r(.2,.7):0};break;
  case 'sh101':s={w1:pick(['saw','pulse']),w2:pick(['pulse','saw']),pw:r(.12,.45),w3:'sq',oct3:pick([-12,-12,-24]),l3:r(.25,.5),det:r(0,.06),cut:r(.2,.45),res:r(.15,.65),env:r(.35,.8),dec:r(.1,.35),
    drive:r(.15,.4),slope:24,amp:r(.1,.4),adec:r(.12,.3),sub:0,noise:rnd()<.2?r(.08,.2):0,noiseC:r(.5,1),glide:rnd()<.3?r(.1,.25):0,legato:rnd()<.3};break;
  case 'serge':{const bp=rnd()<(B?.35:.65);
    s=rnd()<.6?{eng:'wc',w1:'tri',r1:pick([1,2,.5,1.5,3]),i1:r(.2,1.8),i1s:r(0,.6),d1:r(.05,.3),fold:r(.2,.65),fenv:r(.2,.7),fdec:r(.06,.3)}
      :{eng:'mod',w1:pick(['saw','tri','pulse']),w2:pick(['tri','sq','saw']),pw:r(.2,.45),xm:r(.05,.4),ring:rnd()<.3?r(.2,.5):0,hp:r(0,.2)};
    Object.assign(s,{ft:bp?'bp':null,det:r(0,.15),cut:r(.3,.6),res:bp?r(.35,.75):r(.2,.6),env:r(.4,.85),dec:r(.08,.35),drive:r(.1,.4),slope:12,amp:r(.2,.7),adec:r(.15,.4),sub:B?r(bp?.25:.1,.45):0});break;}
  case 'rings':{const mt=pick(B?['string','string','mallet','harmonic']:['string','mallet','bell','glass','harmonic']);
    s={eng:'add',mtype:mt,bright:r(.2,.8),mdec:B?r(.25,.6):r(.3,.85),damp:r(.2,.8),msus:mt==='harmonic'?r(.4,1):rnd()<.3?r(.1,.5):0,inh:r(0,.4),hA:[1,r(0,1),r(0,.8),r(0,.6),r(0,.5),r(0,.4)],
      noise:rnd()<.6?r(.1,.4):0,noiseC:r(.4,1),det:r(0,.15),cut:r(.55,.9),res:r(0,.2),env:r(0,.3),dec:r(.2,.5),drive:r(0,.25),slope:24,amp:0,sub:B?r(0,.3):0};break;}
  case 'wtab':{const wa=pick([0,1,2,3,5,7,8]);s={eng:'wt',wa,wb:pick([2,3,4,5,6,7,9].filter(x=>x!==wa)),wmix:r(0,.5),wenv:r(.1,.9),wdec:r(.05,.5),det:r(0,.3),cut:r(.3,.65),res:r(.1,.5),env:r(.2,.6),dec:r(.15,.45),
    drive:r(.1,.4),slope:24,amp:r(0,.4),adec:r(.15,.4),sub:B?r(.1,.4):0};break;}
  case 'vec':{const P=[0,1,2,3,4,5,6,7,8,9].sort(()=>rnd()-.5);s={eng:'vec',va:P[0],vb:P[1],vc:P[2],vd:P[3],vx:r(.05,.6),vy:r(.05,.5),vseq:!B&&rnd()<.2,det:r(.1,.4),cut:r(.3,.6),res:r(.1,.4),env:r(.2,.5),dec:r(.2,.5),
    drive:r(.05,.3),slope:24,amp:r(0,.3),adec:r(.2,.5),sub:B?r(.15,.4):0};break;}
  case 'emu':s=rnd()<.6?{eng:'wt',wa:pick([2,3,4,5,6,7]),wb:pick([3,4,5,6,8,9]),wmix:r(0,.5),wenv:r(0,.6),wdec:r(.05,.4)}:{w1:pick(['pulse','saw','sq']),pw:r(.1,.45),w2:rnd()<.6?pick(['pulse','sq']):null,oct2:pick([0,12,-12])};
    Object.assign(s,{lofi:r(.35,.8),det:r(0,.25),cut:r(.25,.5),res:r(.2,.6),env:r(.3,.7),dec:r(.1,.4),drive:r(.2,.5),slope:24,amp:r(.1,.5),adec:r(.12,.4),sub:B?r(.1,.35):0});break;
  case 'cz':s={eng:'wt',wa:pick([0,0,1]),wb:pick([2,3,7,9,6]),wmix:r(0,.25),wenv:r(.5,1),wdec:r(.05,.4),det:r(0,.3),cut:r(.6,.9),res:r(0,.1),env:r(0,.15),dec:r(.2,.4),drive:r(.05,.2),slope:24,amp:r(.1,.6),adec:r(.15,.5),sub:B?r(.1,.35):0};break;
  case 'd50':s=rnd()<.6?{eng:'wt',wa:pick([5,8,1,7]),wb:pick([4,6,9,8]),wmix:r(.1,.5),wenv:r(.1,.5),wdec:r(.2,.8)}:{w1:'saw',w2:pick(['pulse','saw']),pw:r(.2,.45)};
    Object.assign(s,{tr:r(.35,.85),trT:pick(Object.keys(TRT)),det:r(.15,.5),cut:r(.3,.6),res:r(.05,.3),env:r(.1,.4),dec:r(.3,.6),drive:r(.05,.2),slope:24,amp:r(0,.3),adec:r(.3,.7),sub:B?r(.1,.3):0,rev:r(.15,.35)});break;
  case 'cs80':s={w1:'saw',w2:pick(['pulse','saw']),pw:r(.3,.45),det:r(.25,.55),sour:r(.05,.2),fatk:B?r(0,.05):r(.05,.4),cut:r(.2,.4),res:r(.1,.35),env:r(.4,.8),dec:r(.3,.7),drive:r(.1,.3),slope:24,amp:r(0,.2),adec:r(.3,.6),sub:B?r(.1,.3):0,lfo:r(.03,.1),lfoR:r(.2,.6)};break;
  case 'lyra':s={eng:'mod',w1:pick(['sine','tri']),w2:'sine',oct2:pick([0,12,-12]),w3:'tri',oct3:pick([12,-12,7]),l3:r(.2,.4),w4:'sine',oct4:0,l4:r(.2,.35),xm:r(.3,.8),ring:r(.1,.5),hp:0,lfo:r(.1,.3),lfoR:r(.05,.5),
    det:r(.2,.5),cut:r(.3,.6),res:r(.1,.4),env:r(.1,.3),dec:r(.4,.8),drive:r(.2,.5),slope:24,amp:B?r(.1,.4):0,adec:r(.3,.6),sub:B?r(.1,.3):0,rev:r(.2,.45)};break;
  case 'ms20':s={eng:'mod',w1:pick(['saw','pulse','saw']),w2:pick(['sq','pulse','saw']),pw:r(.15,.45),oct2:pick([0,0,-12,B?0:12]),xm:r(.08,g==='daf'||g==='ebm'?.5:.3),ring:rnd()<.3?r(.2,.55):0,hp:r(.08,.45),
    det:r(0,.2),cut:r(.22,.42),res:r(.3,.68),env:r(.35,.7),dec:r(.1,.35),drive:r(.45,.85),slope:12,amp:r(.1,.45),adec:r(.15,.35),sub:B?r(0,.2):0,noise:rnd()<.3?r(.1,.35):0,noiseC:r(.2,.8),lfo:rnd()<.35?r(.05,.3):0,lfoR:r(.3,6)};break;
  case 'buchla':s={eng:'wc',w1:pick(['sine','sine','tri']),r1:pick(B?[1,1,2,.5]:[1,2,2,3,1.5,4]),i1:r(.2,B?1.2:2.2),i1s:r(0,.5),d1:r(.06,.3),fold:r(.1,B?.45:.7),fenv:r(.25,.8),fdec:r(.06,.35),
    det:r(0,.15),cut:r(.28,.55),res:r(0,.3),env:r(.45,.9),dec:r(.08,.35),drive:r(.05,.3),slope:12,amp:r(.35,.85),adec:r(.12,.5),sub:B?r(.1,.4):0};break;
  case 'euro':
    if(rnd()<.5)s={eng:'wc',w1:pick(['sine','tri']),r1:pick([1,2,3,.5,1.5]),i1:r(.5,2.8),i1s:r(.1,.8),d1:r(.05,.4),fold:r(.35,.9),fenv:r(.2,.6),fdec:r(.05,.25),
      det:r(0,.2),cut:r(.3,.6),res:r(.1,.45),env:r(.3,.8),dec:r(.1,.4),drive:r(.3,.7),slope:pick([12,24]),amp:r(.1,.6),adec:r(.15,.4),sub:B?r(.15,.4):0,noise:rnd()<.3?r(.1,.3):0,noiseC:r(0,1)};
    else s={eng:'mod',w1:pick(['sync','saw','pulse']),syncR:r(1.5,4),w2:pick(['pulse','sq','saw']),pw:r(.1,.4),oct2:pick([0,-12,12]),xm:r(0,.35),ring:rnd()<.45?r(.25,.6):0,hp:r(.05,.35),
      det:r(0,.25),cut:r(.25,.5),res:r(.25,.65),env:r(.3,.7),dec:r(.1,.35),drive:r(.4,.8),slope:pick([12,24]),amp:r(.1,.5),adec:r(.15,.35),sub:B?r(0,.3):0,noise:rnd()<.4?r(.1,.35):0,noiseC:r(0,1),fbank:rnd()<.2?pick(['nasal','telephone','hollow']):null};
    s.lfo=r(.08,.25);s.lfoR=r(.2,3);break;
  default:{const sy=rnd()<(L?.5:.25);s={w1:pick(['saw','saw','pulse']),w2:sy?'sync':pick(['saw','saw','pulse']),syncR:r(1.8,3.5),pw:r(.2,.45),oct2:sy?0:pick([0,0,12,-12]),
    det:r(.25,.6),cut:r(.32,.6),res:r(.08,.35),env:r(.3,.6),dec:r(.15,.4),drive:r(.1,.3),slope:pick([24,24,12]),amp:r(.15,.55),adec:r(.15,.4),sub:B?r(0,.3):0};}
  }
  if(!s.eng)s.eng='an';s.fam=fam;return s;
}
return famSnd(family,genre,'bass');}

const familyNames={arp:'ARP 2600',moogone:'Moog One',source:'Moog Source',modular:'Moog Modular',mini:'Minimoog',sh101:'SH-101',ms20:'MS-20',buchla:'Buchla',serge:'Serge',rings:'Rings',wtab:'Wavetable',fm:'FM',jup8:'Jupiter',p5:'Prophet',odyssey:'Odyssey',bit99:'Bit 99',tb303:'303',sub37:'Sub 37',prodigy:'Prodigy',rogue:'Rogue',taurus:'Taurus',memory:'Memorymoog',voyager:'Voyager',phatty:'Phatty',grandma:'Grandmother',matriarch:'Matriarch',muse:'Muse',m32:'Mother-32',euro:'Eurorack',cs80:'CS-80',cz:'Phase distortion',d50:'Digital hybrid',vec:'Vector',emu:'Sampler wave',ssaw:'Supersaw',lyra:'Cross modulation',mbrute:'Three oscillator drive'};
const plans={
 ebm:{label:'EBM',families:['source','ms20','modular','moogone','arp','sh101','muse','prodigy','serge','euro'],color:'Machine'},
 edm:{label:'EDM',families:['sub37','moogone','mini','voyager','jup8','memory','bit99','wtab'],color:'Pressure'},
 house:{label:'House',families:['moogone','mini','source','sh101','fm','bit99','p5','voyager','grandma','matriarch'],color:'Pocket'},
 disco:{label:'Disco',families:['jup8','mini','source','bit99','fm','p5','rogue','moogone'],color:'Bounce'},
 funk:{label:'Funky riff',families:['mini','sh101','fm','source','jup8','bit99','rings','voyager'],color:'Round'},
 motor:{label:'80s Motor',families:['source','sh101','prodigy','moogone','jup8','p5','bit99','modular'],color:'Octave'},
 acid:{label:'Acid / Electro',families:['tb303','source','ms20','modular','buchla','serge','euro','m32'],color:'Rubber'},
 hiphop:{label:'Hiphop',families:['mini','taurus','rogue','fm','rings','moogone','sub37','voyager'],color:'Low pocket'}
};
const articulations=['Tight','Body','Velvet','Pulse'];
function recipe(family,genre,seed,articulation=0){const s=familySettings(family,genre,seed),R=rng(seed+999),r=(a,b)=>a+R()*(b-a),acid=genre==='acid',machine=genre==='ebm',soft=['house','disco','funk','hiphop'].includes(genre);
 // Dark enough to sit, enough upper harmonics for the melody to remain audible.
 Object.assign(s,{g:.95,noise:0,noiseC:0,tr:0,lofi:0,dist:0,fsh:0,ring:0,up:0,glide:0,legato:false,atk:.002,rel:.085,drift:.015,
  cut:clamp(s.cut,.29,acid?.55:.48),res:clamp(s.res,0,acid?.58:machine?.33:.2),drive:clamp((s.drive||0)*.55,.035,acid?.32:machine?.22:.15),
  env:clamp(s.env||.3,.14,acid?.65:.48),det:clamp(s.det||0,0,machine?.18:.12),sour:machine?r(.12,.42):r(0,.025),msour:machine?r(.06,.18):0,ksour:0,
  dec:clamp(s.dec||.24,.08,.4),amp:clamp(s.amp||.15,.05,.55),lfo:Math.min(s.lfo||0,.025),lfoR:.15});
 s.w4=null;s.w5=null;s.l1=.58;s.l2=s.w2?.28:0;s.l3=s.w3?.17:0;
 if(soft){s.xm=Math.min(s.xm||0,.035);s.hp=Math.min(s.hp||0,.08);s.sub=clamp(s.sub||.12,.08,.28);s.fbank=null;s.slope=24;}
 if(machine){s.xm=clamp(s.xm||0,0,.09);s.hp=Math.min(s.hp||0,.14);s.sub=clamp(s.sub||.08,.03,.18);}
 if(s.eng==='wc'){s.i1=clamp(s.i1||.4,.15,.8);s.i1s=Math.min(s.i1s||0,.16);s.fold=clamp(s.fold||.2,.1,.28);s.fenv=Math.min(s.fenv||0,.3);s.sub=Math.max(s.sub||0,.12);}
 if(s.eng==='fm'){s.i1=clamp(s.i1||2,.7,2.1);s.i1s=clamp(s.i1s||.2,.08,.4);s.i2=Math.min(s.i2||0,.5);s.sub=Math.min(s.sub||.25,.35);s.cut=clamp(s.cut,.4,.53);}
 if(s.eng==='add'){s.noise=0;s.inh=0;s.mtype='harmonic';s.hA=[1,.5,.25,.12,.06,.025];s.bright=.36;s.mdec=.28;s.msus=.16;s.sub=.16;}
 if(s.eng==='wt'){s.wa=[0,1,3,7][articulation%4];s.wb=[3,2,8,1][articulation%4];s.wmix=.18;s.wenv=.24;s.sub=.16;}
 // Articulations change the oscillator/envelope relationship, not simply the display name.
 if(articulation===0){s.dec=.1+r(0,.09);s.amp=.48;s.adec=.14;s.env=Math.min(.5,s.env+.1);s.rel=.065;}
 if(articulation===1){s.sub=Math.min(.38,(s.sub||0)+.12);s.dec=.3;s.amp=.13;if(['an','mod'].includes(s.eng)&&s.w3){s.w3='tri';s.oct3=-12;s.l3=.24;}}
 if(articulation===2){s.cut=Math.max(.29,s.cut-.045);s.env=.2;s.dec=.32;s.amp=.2;s.drive=.06;s.res=Math.min(s.res,.15);if(['an','mod'].includes(s.eng)){s.w1='tri';if(s.w2)s.w2='pulse';s.pw=.38;}}
 if(articulation===3){if(['an','mod'].includes(s.eng)){s.w1='pulse';s.pw=r(.22,.38);s.w2='tri';s.oct2=0;s.l2=.28;}s.dec=.18;s.env=.36;s.amp=.32;}
 if(genre==='hiphop'){s.dec=Math.max(s.dec,.25);s.cut=Math.min(s.cut,.38);s.res=Math.min(s.res,.13);s.drive=Math.min(s.drive,.12);s.sub=Math.max(s.sub||0,.22);s.rel=.12;}
 s.fam=family;s.name=plans[genre].label+' · '+(familyNames[family]||family)+' '+articulations[articulation];return s;
}
const presets=[];let serial=0;
for(const [genre,plan]of Object.entries(plans))for(let i=0;i<plan.families.length;i++)for(let a=0;a<2;a++){const family=plan.families[i],art=(i+a*2)%4,id='pal:'+genre+':'+i+':'+a,settings=recipe(family,genre,42001+serial++*7919,art);presets.push({id,name:settings.name,genre,family,category:'factory-'+genre,group:'Factory · '+plan.label,engine:settings.eng,settings});}

// A complete architecture reset avoids inheriting the adapter's initial Minimoog oscillators.
function complete(p){return{eng:'an',w1:'saw',w2:null,w3:null,w4:null,w5:null,l1:.7,l2:0,l3:0,l4:0,l5:0,oct1:0,oct2:0,oct3:0,oct4:0,oct5:0,cents1:0,cents2:0,cents3:0,pw:.5,syncR:2,det:0,det3:0,sour:0,sour2:0,msour:0,ksour:0,noise:0,noiseC:.5,sub:0,up:0,xm:0,ring:0,hp:0,fbank:null,ft:null,foldPost:0,lofi:0,fsh:0,tr:0,dist:0,vib:0,sh:0,lfo:0,lfoR:.2,drift:0,fatk:0,lowcut:0,atk:.002,rel:.08,glide:0,legato:false,rc:1,r1:1,r2:1,i1:0,i1s:0,i2:0,i2s:0,d1:.1,d2:.1,m1w:'sine',alg:'par',wa:0,wb:1,wmix:0,wenv:0,wdec:.2,fold:.1,fenv:0,fdec:.2,mtype:'harmonic',bright:.4,mdec:.3,msus:0,damp:.5,inh:0,...p};}
const toneShapes=['Single saw','Round triangle','Narrow pulse','Hollow square','Twin body','Octave duet','Three roots','Soft sync','Fifth shadow','Triangle sub','Wide pulse','Low chorus'];
const contours=['Needle','Short reply','Pocket','Held body','Round decay','Dry gate','Slow bloom','Elastic'];
const finishes=['Clean','Warm','Dark','Open','Soft edge','Chest','Muted','Gentle bite'];
function expandedRecipe(family,genre,seed,shapeIndex,contourIndex,finishIndex){const R=rng(seed),r=(a,b)=>a+R()*(b-a),pick=a=>a[Math.floor(R()*a.length)],raw=familySettings(family,genre,seed),s=complete(raw),acid=genre==='acid',ebm=genre==='ebm',soft=['house','disco','funk','hiphop'].includes(genre);s.g=.9;s.noise=0;s.tr=0;s.lofi=0;s.dist=0;s.fsh=0;s.ring=0;s.vib=0;s.glide=0;s.legato=false;s.fbank=R()<.12?'warm':null;s.sour=ebm?r(.03,.3):0;s.msour=ebm?r(0,.12):0;s.ksour=0;s.drift=.008;
 const cutBands=[[.3,.39],[.36,.46],[.27,.34],[.45,.6],[.33,.43],[.31,.41],[.25,.33],[.39,.51]],cut=cutBands[finishIndex];s.cut=r(...cut);s.res=acid?r(.2,.55):r(.025,ebm?.3:.2);s.drive=finishIndex===0?0:r(.025,acid?.3:ebm?.24:.15);s.env=r(.12,acid?.65:.48);s.slope=finishIndex%3===0?12:24;s.det=r(0,soft?.14:.24);s.xm=Math.min(s.xm||0,ebm?.13:.04);s.hp=Math.min(s.hp||0,.1);s.sub=r(.04,.24);s.up=0;s.lfo=0;
 const envelopes=[{dec:.055,env:.6,amp:.7,adec:.07,rel:.035},{dec:.11,env:.45,amp:.5,adec:.15,rel:.06},{dec:.22,env:.32,amp:.3,adec:.28,rel:.09},{dec:.42,env:.15,amp:.05,adec:.4,rel:.16},{dec:.32,env:.28,amp:.4,adec:.35,rel:.13},{dec:.08,env:.18,amp:.15,adec:.1,rel:.025},{dec:.4,env:.44,amp:.1,adec:.35,atk:.025,fatk:.035,rel:.18},{dec:.16,env:.5,amp:.42,adec:.2,rel:.09}];Object.assign(s,envelopes[contourIndex]);s.dec*=r(.82,1.2);s.env*=r(.8,1.15);s.atk=s.atk||.002;
 if(['an','mod'].includes(s.eng)){const single=['m32','tb303'].includes(family);s.w1=raw.w1||'saw';s.w2=null;s.w3=null;s.w4=null;s.w5=null;s.l1=.72;s.l2=0;s.l3=0;s.l4=0;s.l5=0;s.oct2=0;s.oct3=0;s.oct4=0;s.oct5=0;s.pw=r(.15,.45);s.syncR=r(1.25,2.4);
 const shapes=[{w1:'saw',w2:null},{w1:'tri',w2:'sine',l2:.25},{w1:'pulse',pw:r(.12,.22),w2:null},{w1:'sq',w2:'tri',l2:.15},{w1:raw.w1||'saw',w2:raw.w2||'sq',l2:.31},{w1:'saw',w2:'pulse',oct2:-12,l2:.38},{w1:'saw',w2:'tri',w3:'sq',l2:.2,l3:.17},{w1:'sync',syncR:r(1.15,1.85),w2:'tri',l2:.24},{w1:'tri',w2:'pulse',oct2:7,l2:.08},{w1:'tri',w2:'sine',oct2:-12,l2:.35},{w1:'pulse',pw:r(.35,.48),w2:'saw',l2:.22},{w1:'saw',w2:'saw',l2:.32,det:r(.18,.35)}];Object.assign(s,shapes[shapeIndex]);if(single){s.w2=null;s.w3=null;s.l2=0;s.l3=0;s.sub=family==='tb303'?0:s.sub*.4;}if(['moogone','modular','memory','voyager','matriarch'].includes(family)&&[4,6,9,11].includes(shapeIndex)){s.w3=pick(['tri','saw','pulse']);s.oct3=pick([0,-12]);s.l3=r(.1,.24);if(family==='modular'&&shapeIndex===6){s.w4='tri';s.oct4=-12;s.l4=.11;}}if(s.w2===null)s.det=0;s.l1=clamp(.68-(s.l2+s.l3+s.l4)*.22,.38,.7);
 }else if(s.eng==='fm'){const ratios=[.5,1,1,2,3,1.5,2,4,.5,1,3,2];s.rc=1;s.r1=ratios[shapeIndex];s.r2=[1,2,.5,1,3,2,4,1,.5,3,2,1][shapeIndex];s.m1w=shapeIndex%5===0?'tri':'sine';s.alg=shapeIndex%3===0?'stack':'par';s.i1=r(.45,2.6)*(shapeIndex%2?.6:1);s.i1s=r(.02,.45);s.i2=r(.05,.85);s.i2s=r(0,.12);s.d1=[.035,.08,.15,.3][contourIndex%4];s.d2=.04+s.d1*.5;s.sub=r(.15,.3);s.det=r(0,.055);s.cut=Math.max(s.cut,.38);
 }else if(s.eng==='wt'){const pairs=[[0,3],[1,2],[3,8],[7,1],[0,8],[1,7],[2,3],[5,0],[7,3],[8,1],[3,5],[1,9]];[s.wa,s.wb]=pairs[shapeIndex];s.wmix=r(.08,.65);s.wenv=[0,.15,.35,.6][contourIndex%4];s.wdec=[.05,.13,.25,.45][contourIndex%4];s.det=r(0,.18);s.sub=r(.08,.22);
 }else if(s.eng==='wc'){s.w1=shapeIndex%3?'tri':'sine';s.r1=[.5,1,2,3,1.5,1,.5,2,1,3,2,1][shapeIndex];s.i1=r(.12,1.6);s.i1s=r(.01,.25);s.d1=[.04,.1,.22,.4][contourIndex%4];s.fold=[.1,.16,.24,.34][shapeIndex%4];s.fenv=[.05,.2,.35,.5][contourIndex%4];s.fdec=[.08,.17,.3,.4][contourIndex%4];s.det=r(0,.09);s.sub=r(.1,.28);
 }else if(s.eng==='add'){const partials=[[1,.5,.25,.12,.06,.03],[1,.05,.4,.03,.15,.02],[1,.7,.08,.25,.03,.1],[1,.2,.06,.03,.01,0],[1,.8,.6,.4,.2,.1],[1,0,.33,0,.2,0]];s.mtype='harmonic';s.hA=partials[shapeIndex%6].map((v,i)=>i?v*r(.8,1.15):1);s.bright=[.25,.4,.55,.7][finishIndex%4];s.mdec=[.08,.18,.32,.55][contourIndex%4];s.msus=[0,.08,.2,.4][contourIndex%4];s.damp=r(.3,.8);s.inh=0;s.noise=0;s.sub=r(.06,.2);}
 if(genre==='hiphop'){s.cut=Math.min(s.cut,.47);s.res=Math.min(s.res,.18);s.drive=Math.min(s.drive,.13);s.sub=Math.max(s.sub,.18);}const shapeNames={fm:['Half ratio','Root pair','Soft parallel','Double mod','Triple mod','Three halves','Coupled pair','Fourth ratio','Low stack','Root growl','Third pair','Tight pair'],wt:['Sine square','Soft saw','Square organ','Hollow soft','Sine organ','Soft hollow','Saw square','Formant sine','Hollow square','Organ soft','Square formant','Soft sync'],wc:['Low folded sine','Triangle root','Double fold','Triple fold','Three halves fold','Soft fold','Low fold','Coupled fold','Round fold','Third fold','Elastic fold','Root fold'],add:['Harmonic stack','Odd body','Second body','Fundamental body','Dense partials','Odd partials','Harmonic pulse','Odd pulse','Second pulse','Fundamental pulse','Dense body','Odd reply']};const shapeLabel=shapeNames[s.eng]?.[shapeIndex]||toneShapes[shapeIndex];s.name=plans[genre].label+' · '+(familyNames[family]||family)+' · '+shapeLabel+' / '+contours[contourIndex]+' / '+finishes[finishIndex];s.fam=family;return s;}
const extraFamilies={ebm:['lyra','mbrute','odyssey','vec'],edm:['ssaw','cz','mbrute','emu'],house:['cs80','vec','emu','cz'],disco:['cs80','d50','vec','matriarch'],funk:['cz','d50','grandma','serge'],motor:['cs80','cz','d50','odyssey'],acid:['mbrute','odyssey','lyra','wtab'],hiphop:['emu','cs80','d50','serge']};
const genreTargets={ebm:238,edm:238,house:238,disco:238,funk:237,motor:237,acid:237,hiphop:237};
for(const [genre,target]of Object.entries(genreTargets)){const plan=plans[genre],existing=presets.filter(p=>p.genre===genre).length;for(let j=0;j<target-existing;j++){const familyPool=[...plan.families,...extraFamilies[genre]],family=familyPool[j%familyPool.length],cycle=Math.floor(j/familyPool.length),shape=(cycle*5+j%plan.families.length)%12,contour=(cycle+j%3)%8,finish=(cycle*3+j%5)%8,seed=171119+Object.keys(plans).indexOf(genre)*100000+j*104729,settings=expandedRecipe(family,genre,seed,shape,contour,finish),id='pal2:'+genre+':'+j;presets.push({id,name:settings.name,genre,family,category:'factory-'+genre,group:'Factory · '+plan.label,engine:settings.eng,settings});}}


// Revoice the bank by audible source, contour and treatment. A preset is a sound,
// independent of the riff browser. All coarse pitch layers remain root/octaves.
const voices=[
 ['Rubber pluck',.37,.62,.09,.62,.12],['Round finger',.32,.26,.24,.34,.08],
 ['Dry pulse',.44,.15,.06,.12,.025],['Hollow body',.39,.3,.22,.18,.09],
 ['Open growl',.58,.23,.28,.22,.12],['Soft triangle',.48,.12,.36,.14,.14],
 ['Deep ladder',.27,.47,.3,.16,.13],['Narrow bite',.51,.42,.12,.54,.06],
 ['Octave weight',.35,.32,.32,.22,.12],['Short machine',.43,.54,.075,.72,.035],
 ['Long pocket',.4,.2,.45,.08,.16],['Muted knock',.28,.34,.1,.64,.05],
 ['Warm reed',.46,.27,.24,.25,.1],['Liquid edge',.39,.68,.19,.36,.085],
 ['Soft sync',.55,.28,.18,.4,.075],['Dark drone',.31,.12,.4,.06,.16],
 ['Woody bloom',.43,.25,.23,.4,.1],['Clean chest',.55,.1,.27,.1,.1],
 ['Velvet double',.36,.22,.32,.18,.13],['Firm gate',.49,.18,.075,.08,.025],
 ['Folded rubber',.48,.4,.14,.5,.07],['Dusty round',.42,.16,.29,.3,.1],
 ['Vowel movement',.51,.3,.22,.28,.09],['Solid fundamental',.36,.21,.35,.09,.14]
];
function voiceRecipe(entry,index){
 const s=complete(entry.settings),R=rng(583927+index*7919),r=(a,b)=>a+R()*(b-a),pick=a=>a[Math.floor(R()*a.length)],v=index%voices.length,[role,cut,env,dec,amp,rel]=voices[v],soft=['house','funk','disco','hiphop'].includes(entry.genre),an=['an','mod'].includes(s.eng);
 s.cut=clamp(cut+r(-.035,.035),.25,.65);s.env=env*r(.88,1.1);s.dec=dec*r(.85,1.18);s.amp=amp;s.adec=dec*r(.85,1.3);s.rel=[5,11,18,23].includes(v)?r(.17,.24):rel;s.up=an&&[1,8,13,18,22].includes(v)?r(.08,.3):0;s.atk=v===16?.009:.0015+r(0,.0035);s.fatk=v===16?.016:0;
 s.sour=an?r(.005,entry.genre==='ebm'?.14:.07):r(0,.04);s.sour2=0;s.msour=an&&[0,13,20].includes(v)?r(.025,.07):0;s.ksour=0;s.drift=r(.002,.025);s.det=an?r(.01,[8,18].includes(v)?.23:.14):Math.min(s.det||0,.08);s.cents1=0;s.cents2=an?r(-3,3):0;s.cents3=an?r(-4,4):0;
 for(let j=1;j<=5;j++)s['oct'+j]=j===1?0:clamp(Math.round((s['oct'+j]||0)/12)*12,-12,12);
 s.res=[7,13].includes(v)?r(.34,.56):[3,12,22].includes(v)?r(.16,.3):r(.015,.2);s.drive=[4,7,9,14,20].includes(v)?r(.16,soft?.24:.34):[5,17,23].includes(v)?0:r(.025,.13);s.slope=[3,7,12,14,22].includes(v)?12:24;s.sub=[6,8,15,23].includes(v)?r(.22,.38):r(.035,.18);
 s.noise=0;s.tr=0;s.fsh=0;s.vib=0;s.lofi=v===21?r(.2,.4):0;s.foldPost=v===20?r(.12,.28):0;s.dist=v===4&&!soft?r(.025,.09):0;s.fbank=[3,12,16,22].includes(v)?pick(['hollow','warm','nasal','vowel a','vowel o']):null;s.lfo=[13,18,22].includes(v)?r(.012,.055):0;s.lfoR=r(.13,.85);s.sh=v===9&&!soft?.045:0;s.glide=[0,7,13,19].includes(v)?r(.07,.26):0;
 if(an){
  const family=entry.family;
  if(['taurus','rogue','phatty','sub37'].includes(family)){s.oct2=-12;s.w2=family==='taurus'?'saw':'sq';s.l2=r(.22,.37);s.sub=Math.max(s.sub,.17);}
  if(['jup8','memory','moogone','matriarch','cs80','ssaw'].includes(family)){s.w2=pick(['saw','pulse']);s.l2=r(.21,.32);s.w3=pick(['tri','saw']);s.oct3=pick([-12,0]);s.l3=r(.1,.2);s.pw=r(.27,.46);s.det=r(.1,.23);}
  if(['source','odyssey','prodigy'].includes(family)&&[4,7,14,20].includes(v)){s.w1='sync';s.syncR=r(1.15,2.75);s.w2='tri';s.l2=.22;}
  if(['m32','tb303'].includes(family)){s.w1=v%3===0?'sq':'saw';s.w2=null;s.w3=null;s.l2=0;s.l3=0;s.det=0;s.sub=family==='tb303'?0:s.sub*.5;}
  if(v===5||v===23){s.w1='sine';s.w2=v===5?'tri':null;s.l2=v===5?.22:0;s.w3=null;s.l3=0;s.sub=Math.min(s.sub,.12);}
  if(v===2||v===7){s.w1='pulse';s.pw=v===2?r(.12,.22):r(.23,.35);}
  if(v===3){s.w1='sq';s.w2='tri';s.l2=.2;}
  if(s.eng==='mod'){s.xm=['ms20','lyra','arp','euro'].includes(family)?r(.025,soft?.08:.18):r(.005,.065);s.ring=!soft&&v===4?r(.015,.065):0;s.hp=r(.015,.09);}else{s.xm=0;s.ring=0;}
 }else if(s.eng==='fm'){s.i1*=r(.65,1.4);s.i1s*=r(.65,1.25);s.d1=[.025,.065,.15,.3][v%4];s.i2=Math.min(s.i2||0,1.2);s.cut=Math.max(s.cut,.39);}
 else if(s.eng==='wt'){s.wmix=r(.02,.7);s.wenv=[0,.15,.4,.7][v%4];s.wdec=[.04,.12,.26,.45][v%4];s.cut=Math.max(s.cut,.37);}
 else if(s.eng==='wc'){s.fold=[.08,.17,.3,.43][v%4];s.fenv=[.04,.2,.4,.55][v%4];s.i1=Math.min(s.i1||.3,1.35);s.cut=Math.max(s.cut,.38);}
 else if(s.eng==='vec'){s.va=pick([0,1,2,3]);s.vb=pick([3,5,7,8]);s.vc=pick([0,2,6,9]);s.vd=pick([1,3,7,8]);s.vx=r(.08,.5);s.vy=r(.08,.4);s.vseq=false;s.cut=Math.max(s.cut,.38);}
 if(entry.genre==='hiphop'){s.res=Math.min(s.res,.24);s.drive=Math.min(s.drive,.15);s.sub=Math.max(s.sub,.16);}
 s.g=.86;s.post={f2cut:[51,67,81,94][v%4],f2res:[0,8,16,22][v%4],f2mix:[0,0,12,23][v%4],filterType:v===3?'bandpass':'lowpass',echo:[10,13,18,22].includes(v)?r(5,15):0,echoTone:r(10,48)};
 s.fam=entry.family;s.name=entry.name+' · '+role;entry.settings=s;entry.name=s.name;entry.engine=s.eng;entry.character=role;
}
presets.forEach(voiceRecipe);

/* Native engine voicing: oscillator topology and modulation differ, not just filter trim. */
function deepenVoice(entry,index){
 const s=entry.settings,R=rng(907451+index*104729),r=(a,b)=>a+R()*(b-a),pick=a=>a[Math.floor(R()*a.length)],soft=['funk','house','disco','hiphop'].includes(entry.genre),an=['an','mod'].includes(s.eng);
 s.cut=r(soft?.28:.24,soft?.65:.76);s.res=pick([r(.01,.08),r(.1,.26),r(.3,soft?.4:.55)]);s.env=r(.1,.85);s.dec=r(.055,.48);s.amp=pick([0,r(.12,.35),r(.4,.76)]);s.rel=r(.055,.24);s.atk=r(.001,.006);
 s.drift=an?r(.015,.28):r(.005,.06);s.sour=an?r(.005,.14):r(0,.035);s.sub=r(.04,.3);s.noise=R()<.15?r(.005,.035):0;s.noiseC=r(.1,.65);s.lfo=R()<.48?r(.015,.1):0;s.lfoR=r(.08,2.2);s.foldPost=R()<.18?r(.06,.28):0;
 let design='';
 if(an){
  const mode=Math.floor(R()*10);design=['Round pair','Narrow pulse','Three-oscillator stack','Hard-sync body','Octave weight','Open saw pair','Hollow square','Unison cloud','Cross-mod bite','Ring-mod body'][mode];
  if(mode===0)Object.assign(s,{w1:'sine',w2:'tri',w3:null,l1:.68,l2:.29,l3:0,oct2:0});
  if(mode===1)Object.assign(s,{w1:'pulse',w2:'tri',w3:null,l1:.62,l2:.2,l3:0,pw:r(.08,.25)});
  if(mode===2)Object.assign(s,{w1:'saw',w2:pick(['sq','pulse','saw']),w3:pick(['tri','saw']),l1:.48,l2:.3,l3:.18,oct2:0,oct3:pick([-12,0,12])});
  if(mode===3)Object.assign(s,{w1:'sync',w2:'tri',w3:null,l1:.55,l2:.26,l3:0,syncR:r(1.1,4.4)});
  if(mode===4)Object.assign(s,{w1:pick(['saw','sq','pulse']),w2:'sine',w3:'tri',l1:.52,l2:.24,l3:.15,oct2:-12,oct3:0});
  if(mode===5)Object.assign(s,{w1:'saw',w2:'saw',w3:null,l1:.5,l2:.4,l3:0,oct2:0});
  if(mode===6)Object.assign(s,{w1:'sq',w2:'pulse',w3:null,l1:.58,l2:.23,l3:0,pw:r(.15,.4)});
  if(mode===7)Object.assign(s,{w1:pick(['saw','pulse']),w2:'tri',w3:null,l1:.55,l2:.25,l3:0,det:r(.3,.58)});
  if(mode===8)Object.assign(s,{w1:'sine',w2:pick(['sine','tri']),w3:null,l1:.64,l2:.22,l3:0,xm:r(.08,soft?.18:.32),oct2:pick([-12,0,12])});
  if(mode===9)Object.assign(s,{w1:pick(['sq','tri']),w2:'sine',w3:null,l1:.57,l2:.24,l3:0,ring:r(.06,soft?.15:.3),oct2:pick([-12,0,12])});
  if(mode!==7)s.det=pick([0,r(.06,.16),r(.18,.38)]);s.pw=s.pw||r(.13,.48);s.up=R()<.25?r(.08,.3):0;
 }else if(s.eng==='fm'){
  s.rc=1;s.r1=pick([.5,1,1.5,2,3,4]);s.r2=pick([.5,1,2,3,4]);s.i1=pick([r(.08,.45),r(.6,1.6),r(2,5)]);s.i1s=s.i1*r(.015,.2);s.i2=r(0,soft?.7:1.8);s.i2s=s.i2*.08;s.d1=pick([.025,.065,.18,.36]);s.d2=r(.02,.2);s.alg=pick(['par','stack']);s.m1w=pick(['sine','sine','tri']);design=s.alg==='stack'?'Stacked FM':'Parallel FM';
 }else if(s.eng==='wc'){
  s.w1=pick(['sine','tri']);s.r1=pick([.5,1,1.5,2,3]);s.i1=pick([0,.15,.45,1.1,2.2]);s.i1s=s.i1*.08;s.d1=r(.025,.22);s.fold=pick([.025,.1,.22,.38,.55,.7]);s.fenv=r(.015,.6);s.fdec=r(.04,.46);s.det=r(0,.16);design='Folded '+(s.w1==='tri'?'triangle':'sine');
 }else if(s.eng==='wt'){
  s.wa=Math.floor(R()*10);s.wb=(s.wa+1+Math.floor(R()*9))%10;s.wmix=R();s.wenv=pick([0,r(.1,.35),r(.5,.85)]);s.wdec=r(.035,.4);s.det=r(0,.2);design='Wave '+s.wa+' / '+s.wb+' morph';
 }else if(s.eng==='vec'){
  s.va=Math.floor(R()*10);s.vb=(s.va+3)%10;s.vc=(s.va+5)%10;s.vd=(s.va+8)%10;s.vx=r(.04,.9);s.vy=r(.04,.9);s.vseq=R()<.35;s.det=r(.025,.18);design=s.vseq?'Clocked vector':'Free vector';
 }else if(s.eng==='add'){
  s.mtype='harmonic';s.hA=[1,...Array.from({length:5},()=>r(.03,1))];s.bright=r(.04,.85);s.mdec=r(.07,.65);s.msus=pick([0,.08,.2,.35]);s.damp=r(.05,.95);s.inh=0;design='Sculpted partials';
 }
 if(s.ft==='bp'){s.cut=Math.min(s.cut,.4);s.res=Math.min(s.res,.3);}if(entry.genre==='hiphop'){s.cut=Math.min(s.cut,.52);s.drive=Math.min(s.drive,.15);s.res=Math.min(s.res,.35);}s.voiceDesign=design;entry.character=entry.character+' / '+design;s.name=entry.name+' / '+design;entry.name=s.name;
}
presets.forEach(deepenVoice);

const byId=new Map(presets.map(p=>[p.id,p]));
function patch(id){const p=byId.get(id);if(!p)throw Error('Unknown factory bass preset');return structuredClone(p.settings);}
function random(genre='house',seed=Date.now(),options={}){if(!plans[genre])genre='house';const R=rng(seed),eligible=presets.filter(p=>p.genre===genre&&p.id!==options.lastId&&(!options.lastFamily||p.family!==options.lastFamily));let pool=eligible.filter(p=>(!options.lastCharacter||p.character!==options.lastCharacter)&&(!options.lastEngine||p.engine!==options.lastEngine));if(!pool.length)pool=eligible;if(!pool.length)pool=presets.filter(p=>p.genre===genre);const selected=pool[Math.floor(R()*pool.length)],settings=patch(selected.id);return {id:selected.id,name:selected.name,genre,family:selected.family,engine:selected.engine,character:selected.character,settings};}
function catalog(){return[...presets.map(({settings,...p})=>p),...base.catalog()];}
function create(c,dest,opts={}){const p=byId.get(opts.preset);if(!p)return base.create(c,dest,opts);const v=base.create(c,dest,{...opts,preset:'mini',initialPatch:patch(opts.preset)});const select=v.select.bind(v);v.select=(id,...rest)=>{if(byId.has(id)){const next=patch(id);return v.replace(next);}return select(id,...rest);};return v;}
root.BassPalette={presets:presets.map(p=>({...p,settings:structuredClone(p.settings)})),random,recipe,expandedRecipe,source:'Norwegian Beats v42 famSnd/latelySnd; bass-only range and articulation curation'};
root.KroghBass={...base,catalog,patch:(id,...rest)=>byId.has(id)?patch(id):base.patch(id,...rest),create};
})(typeof globalThis!=='undefined'?globalThis:this);
