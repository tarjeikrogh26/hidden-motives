/* Extracted from Norwegian Beats · Creative Bars, live Site version 42.
   Original DSP/patch functions retained; small independent host adapter below. */
(function(root){'use strict';
const window=root;let S={bpm:120,root:0};

const BASS_PRESETS={
  w303:{n:'303 Warm',w1:'saw',w2:null,det:0,sub:.12,cut:.17,res:.58,env:.18,dec:.25,drive:.18,slope:12,amp:0,glide:.2,g:1},
  acid:{n:'Acid',w1:'saw',w2:null,det:0,sub:0,cut:.32,res:.62,env:.55,dec:.35,drive:.35,slope:12,amp:0,g:1.04},
  daf:{n:'DAF',fam:'ms20',w1:'sq',w2:'saw',det:.4,sub:.15,cut:.4,res:.38,env:.5,dec:.22,drive:.55,slope:12,amp:.25,g:0.94},
  ebm:{n:'EBM Punch',fam:'ms20',w1:'saw',w2:'sq',det:.3,sub:.35,cut:.36,res:.25,env:.6,dec:.14,drive:.6,slope:24,amp:.35,g:1.01},
  indu:{n:'Industri',fam:'ms20',w1:'saw',w2:'saw',det:.55,sub:.35,cut:.3,res:.42,env:.42,dec:.25,drive:.85,slope:24,amp:.15,g:0.9},
  pluck:{n:'Prog Pluck',fam:'nord',w1:'saw',w2:'saw',det:.45,sub:.5,cut:.28,res:.2,env:.7,dec:.3,drive:.2,slope:24,amp:.55,g:1.4},
  reese:{n:'Reese',fam:'nord',w1:'saw',w2:'saw',det:.85,sub:.45,cut:.42,res:.15,env:.05,dec:.5,drive:.3,slope:24,amp:0,g:0.9},
  rund:{n:'Rund',w1:'saw',w2:'sq',oct2:-12,det:.15,sub:.2,cut:.27,res:.12,env:.35,dec:.32,drive:.15,slope:24,amp:0,g:0.97},
  lead:{n:'Saw Lead',fam:'nord',w1:'saw',w2:'saw',det:.35,sub:0,cut:.62,res:.2,env:.3,dec:.4,drive:.2,slope:12,amp:.1,g:1.53},
  sqlead:{n:'Square Lead',fam:'nord',w1:'sq',w2:'sq',det:.2,sub:0,cut:.55,res:.15,env:.3,dec:.3,drive:.1,slope:12,amp:.2,g:1.65},
  sub:{n:'Sub',w1:'tri',w2:'sine',det:.12,sub:.6,cut:.35,res:0,env:.05,dec:.3,drive:.1,slope:12,amp:0,g:0.9},
  mini:{n:'Mini Bass',w1:'saw',w2:'saw',w3:'sq',oct3:-12,l1:.5,l2:.45,l3:.4,det:.22,sub:0,cut:.3,res:.3,env:.5,dec:.28,drive:.4,slope:24,amp:.2,drift:.45,g:1},
  taurus:{n:'Taurus',fam:'modular',w1:'saw',w2:'saw',w3:'sq',oct3:-12,l3:.5,det:.35,sub:.25,cut:.25,res:.35,env:.45,dec:.45,drive:.5,slope:24,amp:0,drift:.5,g:0.83},
  moogsub:{n:'Moog Sub',w1:'tri',w2:'sq',oct2:-12,w3:'saw',l2:.35,l3:.15,det:.08,sub:.3,cut:.2,res:.15,env:.3,dec:.3,drive:.3,slope:24,amp:.1,drift:.3,g:0.99},
  minilead:{n:'Mini Lead',w1:'saw',w2:'saw',w3:'sq',oct3:12,l3:.22,det:.3,sub:0,cut:.45,res:.32,env:.42,dec:.5,drive:.3,slope:24,amp:.1,drift:.4,rev:.22,g:1.56},
  dafsour:{n:'DAF Sour',eng:'mod',w1:'saw',w2:'saw',sour:.75,det:.1,xm:.1,hp:.25,cut:.32,res:.45,env:.55,dec:.18,drive:.6,slope:12,amp:.3,adec:.25,drift:.5,g:1.11},
  plank:{n:'Plank Bass',eng:'mod',w1:'sq',w2:'saw',oct2:-12,sour:.4,det:.05,xm:.3,hp:.1,cut:.28,res:.35,env:.6,dec:.22,drive:.5,slope:24,amp:.2,drift:.5,g:0.92},
  msgrowl:{n:'MS Growl',eng:'mod',w1:'saw',w2:'sq',sour:.3,ring:.5,xm:.2,hp:.3,cut:.3,res:.55,env:.5,dec:.25,drive:.7,slope:12,amp:.1,lfo:.15,lfoR:3,drift:.4,g:0.93},
  garden:{n:'Garden Bass',eng:'mod',w1:'sq',w2:'sq',oct2:-12,sour:.55,det:0,hp:.05,cut:.3,res:.25,env:.45,dec:.2,drive:.3,slope:24,amp:.5,adec:.3,drift:.5,g:1.18},
  upright:{n:'Upright Bass',smp:'b:upright',cut:.75,res:0,env:.1,dec:.3,amp:.2,adec:.5,g:1},
  fingered:{n:'Fingered Bass',smp:'b:finger',cut:.8,res:.05,env:.15,dec:.25,amp:.15,adec:.6,g:1},
  mutedbass:{n:'Muted Bass',smp:'b:muted',cut:.7,res:.05,env:.2,dec:.2,amp:.3,adec:.25,g:1},
  /* the house organ bass (the M1 kind): a sine with its octave and a short click */
  organbass:{n:'Organ Bass',w1:'sine',w2:'sine',oct2:12,l2:.45,w3:'sq',oct3:24,l3:.12,det:0,sub:.2,cut:.55,res:0,env:.25,dec:.06,drive:.12,slope:24,amp:.35,adec:.35,g:1.1},
  lately:{n:'Lately Bass',eng:'fm',rc:1,r1:1,m1w:'sine',i1:2.3,i1s:.38,d1:.13,r2:1,i2:.55,i2s:.08,d2:.05,alg:'par',det:.045,cut:.55,res:.05,env:.22,dec:.2,drive:.17,slope:24,amp:.38,adec:.38,sub:.72,g:1.17},
  latelyx:{n:'Lately Bass (bright)',eng:'fm',rc:1,r1:1,m1w:'sine',i1:2.9,i1s:.5,d1:.16,r2:1,i2:.8,i2s:.1,d2:.05,alg:'par',det:.05,cut:.7,res:.05,env:.25,dec:.2,drive:.2,slope:24,amp:.35,adec:.38,sub:.45,g:1.1},
  odybass:{n:'Odyssey Bass',w1:'saw',w2:'pulse',pw:.3,det:.1,sub:.3,cut:.32,res:.5,env:.6,dec:.18,drive:.3,slope:12,amp:.25,adec:.2,g:1},
  bitbass:{n:'Bit 99 Bass',w1:'saw',w2:'pulse',oct2:-12,pw:.38,det:.05,sub:.3,cut:.3,res:.2,env:.45,dec:.25,drive:.18,slope:24,amp:.2,adec:.3,g:1},
  tb303:{n:'TB-303',w1:'saw',w2:null,det:0,sub:0,cut:.3,res:.7,env:.65,dec:.25,drive:.4,slope:12,amp:0,glide:.18,legato:true,g:1.04},
  jupbass:{n:'Jupiter Bass',w1:'saw',w2:'saw',oct2:-12,det:.3,sub:.3,cut:.32,res:.15,env:.4,dec:.3,drive:.15,slope:24,amp:.15,adec:.35,g:.95},
  p5bass:{n:'Prophet Bass',eng:'mod',w1:'saw',w2:'pulse',oct2:-12,pw:.3,xm:.08,det:.15,sub:.25,cut:.3,res:.25,env:.55,dec:.22,drive:.25,slope:24,amp:.2,adec:.3,g:1},
  sourcebass:{n:'Source Bass',w1:'saw',w2:'pulse',oct2:-12,pw:.28,det:.12,sub:.25,cut:.28,res:.4,env:.65,dec:.2,drive:.4,slope:24,amp:.25,adec:.25,drift:.3,g:1},
  prodigy:{n:'Prodigy Bass',w1:'saw',w2:'sync',syncR:2.2,det:.1,sub:.25,cut:.3,res:.35,env:.6,dec:.2,drive:.35,slope:24,amp:.2,adec:.22,g:1},
  rogue:{n:'Rogue Bass',w1:'saw',w2:'pulse',oct2:-12,pw:.35,det:.06,sub:.3,cut:.27,res:.25,env:.45,dec:.22,drive:.3,slope:24,amp:.2,adec:.25,g:1},
  voyager:{n:'Voyager Bass',w1:'saw',w2:'sq',w3:'tri',oct3:-12,l3:.4,det:.15,sub:.3,cut:.28,res:.3,env:.55,dec:.25,drive:.45,slope:24,amp:.15,adec:.3,g:.95},
  phatty:{n:'Phatty Bass',w1:'saw',w2:'sq',oct2:-12,det:.1,sub:.35,cut:.27,res:.3,env:.55,dec:.22,drive:.65,slope:24,amp:.2,adec:.25,g:.92},
  m32:{n:'Mother-32 Bass',w1:'saw',w2:null,det:0,sub:0,cut:.26,res:.55,env:.65,dec:.2,drive:.45,slope:24,amp:.25,adec:.2,glide:.08,g:1.02},
  sub37:{n:'Sub 37 Bass',w1:'saw',w2:'sq',w3:'sq',oct3:-12,l3:.45,det:.1,sub:.35,cut:.26,res:.3,env:.5,dec:.25,drive:.5,slope:24,amp:.15,adec:.3,g:.95},
  fmslap:{n:'FM Slap',eng:'fm',rc:1,r1:1,i1:4,i1s:.3,d1:.08,r2:7,i2:.8,i2s:0,d2:.03,alg:'par',det:.05,cut:.95,res:0,env:0,dec:.3,drive:.2,slope:24,amp:.7,adec:.25,g:1.34},
  fmsour:{n:'FM Sour',eng:'fm',rc:1,r1:1,i1:2,i1s:.9,d1:.25,r2:.5,i2:1,i2s:.5,d2:.2,alg:'stack',det:.15,sour:.6,cut:.85,res:.1,env:.1,dec:.3,drive:.25,slope:24,amp:.3,adec:.4,drift:.3,g:0.98},
  dxpluck:{n:'DX Pluck',eng:'fm',rc:1,r1:3,i1:2.5,i1s:.2,d1:.15,r2:1,i2:.6,i2s:.2,d2:.4,alg:'par',det:.2,cut:1,res:0,env:0,dec:.3,drive:.05,slope:24,amp:.85,adec:.45,rev:.25,g:1.94},
  soft:{n:'Soft Round',w1:'tri',w2:'sine',det:.08,sub:.45,cut:.24,res:.06,env:.15,dec:.35,drive:.05,slope:24,amp:.15,g:1.9},
  softlead:{n:'Soft Lead',w1:'tri',w2:'sine',oct2:12,det:.12,sub:0,cut:.5,res:.08,env:.18,dec:.45,drive:.04,slope:24,amp:.25,g:2.2},
  modvbass:{n:'Modular V Bass',fam:'modular',w1:'saw',w2:'pulse',pw:.3,w3:'saw',oct3:-12,l3:.4,det:.25,sub:.15,cut:.27,res:.4,env:.5,dec:.3,drive:.4,slope:24,amp:.15,drift:.5,fbank:'warm',lfo:.05,lfoR:.2,g:0.79},
  modvlead:{n:'Modular V Lead',fam:'modular',w1:'saw',w2:'saw',w3:'pulse',oct3:12,l3:.25,pw:.25,det:.3,cut:.45,res:.35,env:.4,dec:.45,drive:.3,slope:24,amp:.1,drift:.5,fbank:'nasal',lfo:.1,lfoR:.35,rev:.25,glide:.15,g:0.91},
  f914:{n:'914 Formant',fam:'modular',w1:'saw',w2:'pulse',pw:.2,det:.3,cut:.5,res:.2,env:.3,dec:.35,drive:.25,slope:24,amp:.2,fbank:'vowel a',lfo:.12,lfoR:.25,drift:.4,rev:.2,g:1},
  srcbass:{n:'Source Bass',fam:'source',w1:'saw',w2:'pulse',pw:.25,oct2:-12,det:.1,cut:.27,res:.42,env:.62,dec:.18,drive:.4,slope:24,amp:.25,adec:.25,drift:.35,g:1.4},
  srcsync:{n:'Source Sync',fam:'source',w1:'sync',syncR:2.4,w2:'saw',det:.15,cut:.48,res:.3,env:.55,dec:.3,drive:.3,slope:24,amp:.15,drift:.35,rev:.2,glide:.12,g:1.69},
  bongo:{n:'Buchla Bongo',eng:'wc',fam:'buchla',w1:'sine',r1:1,i1:1.2,i1s:.1,d1:.08,fold:.3,fenv:.75,fdec:.12,det:0,cut:.35,res:.1,env:.75,dec:.12,drive:.1,slope:12,amp:.85,adec:.2,sub:.2,drift:.25,g:2},
  wcbass:{n:'West Coast Bass',eng:'wc',fam:'buchla',w1:'tri',r1:2,i1:.5,i1s:.15,d1:.15,fold:.35,fenv:.4,fdec:.25,det:.05,cut:.3,res:.15,env:.5,dec:.25,drive:.25,slope:12,amp:.2,adec:.3,sub:.3,drift:.3,g:0.96},
  foldlead:{n:'Folded Lead',eng:'wc',fam:'buchla',w1:'sine',r1:2,i1:.8,i1s:.4,d1:.3,fold:.5,fenv:.3,fdec:.3,det:.1,cut:.55,res:.15,env:.3,dec:.4,drive:.2,slope:12,amp:.1,lfo:.12,lfoR:.3,drift:.35,rev:.28,glide:.12,g:1.07},
  nordpluck:{n:'Nord Pluck',fam:'nord',w1:'saw',w2:'saw',det:.45,cut:.35,res:.2,env:.6,dec:.2,drive:.15,slope:24,amp:.6,adec:.25,sub:.2,g:1.65},
  nordsync:{n:'Nord Sync Lead',fam:'nord',w1:'saw',w2:'sync',syncR:2.8,det:.2,cut:.55,res:.2,env:.45,dec:.35,drive:.2,slope:24,amp:.15,rev:.25,glide:.1,g:1.72},
  sh101bass:{n:'SH-101 Bass',fam:'sh101',w1:'saw',w2:'pulse',pw:.3,w3:'sq',oct3:-12,l3:.45,det:0,cut:.28,res:.35,env:.6,dec:.2,drive:.25,slope:24,amp:.2,adec:.2,drift:.2,g:1.07},
  sergevocal:{n:'Serge Vocal',eng:'wc',fam:'serge',w1:'tri',r1:2,i1:.6,i1s:.2,d1:.2,fold:.35,fenv:.5,fdec:.2,ft:'bp',det:0,cut:.3,res:.55,env:.7,dec:.25,drive:.2,slope:12,amp:.4,adec:.3,sub:.55,drift:.3,g:2.6},
  sergebass:{n:'Serge Bass',eng:'mod',fam:'serge',w1:'tri',w2:'saw',xm:.3,det:0,cut:.3,res:.5,env:.6,dec:.22,drive:.35,slope:12,amp:.35,adec:.25,sub:.2,drift:.3,g:1.06},
  ringsbass:{n:'Rings Bass',eng:'add',fam:'rings',mtype:'string',bright:.4,mdec:.45,damp:.6,msus:0,inh:.1,noise:.2,noiseC:.6,det:0,cut:.7,res:.05,env:.1,dec:.3,drive:.15,slope:24,amp:0,sub:.25,drift:.2,g:1.11},
  mallet:{n:'Modal Mallet',eng:'add',fam:'rings',mtype:'mallet',bright:.6,mdec:.5,damp:.5,inh:0,noise:.3,noiseC:.8,det:0,cut:.85,res:0,env:0,dec:.3,drive:.05,slope:24,amp:0,rev:.3,drift:.2,g:1.66},
  harmosc:{n:'Harmonic Osc',eng:'add',fam:'rings',mtype:'harmonic',hA:[1,.6,.4,.5,.2,.3],bright:.6,mdec:.6,msus:.8,damp:.3,det:0,cut:.6,res:.15,env:.3,dec:.4,drive:.2,slope:24,amp:.1,lfo:.08,lfoR:.3,rev:.2,drift:.3,g:1.43},
  wtbass:{n:'Wavetable Bass',eng:'wt',fam:'wtab',wa:2,wb:4,wmix:.1,wenv:.7,wdec:.25,det:.1,cut:.32,res:.3,env:.5,dec:.25,drive:.3,slope:24,amp:.2,adec:.25,sub:.3,drift:.3,g:1.23},
  ppglead:{n:'PPG Lead',eng:'wt',fam:'wtab',wa:6,wb:9,wmix:.3,wenv:.6,wdec:.4,det:.2,cut:.55,res:.2,env:.3,dec:.4,drive:.2,slope:24,amp:.1,lfo:.08,lfoR:.4,rev:.3,glide:.1,drift:.3,g:1.92},
  bodebass:{n:'Bode Shift Bass',fam:'modular',w1:'saw',w2:'sq',oct2:-12,det:.1,fsh:.18,cut:.3,res:.35,env:.5,dec:.25,drive:.35,slope:24,amp:.2,drift:.4,g:1.54},
  emubass:{n:'Emulator Bass',eng:'wt',fam:'emu',wa:2,wb:5,wmix:.2,wenv:.4,wdec:.2,lofi:.6,det:.1,cut:.3,res:.35,env:.55,dec:.25,drive:.35,slope:24,amp:.25,adec:.25,sub:.25,drift:.2,g:1.18},
  sidlead:{n:'SID Lead',fam:'emu',w1:'pulse',pw:.25,w2:'pulse',oct2:12,lofi:.7,det:0,cut:.6,res:.25,env:.3,dec:.3,drive:.2,slope:24,amp:.15,glide:.15,rev:.2,g:1.58},
  czbass:{n:'CZ Bass',eng:'wt',fam:'cz',wa:0,wb:2,wmix:.05,wenv:.9,wdec:.2,det:.05,cut:.8,res:0,env:0,dec:.3,drive:.15,slope:24,amp:.3,adec:.3,sub:.3,g:1.05},
  czreso:{n:'CZ Reso Lead',eng:'wt',fam:'cz',wa:0,wb:9,wmix:.15,wenv:1,wdec:.35,det:.1,cut:.85,res:0,env:0,dec:.3,drive:.1,slope:24,amp:.2,adec:.4,rev:.25,glide:.1,g:1.53},
  cs80bass:{n:'CS-80 Bass',fam:'cs80',w1:'saw',w2:'pulse',pw:.4,det:.3,sour:.08,fatk:.03,cut:.25,res:.2,env:.6,dec:.35,drive:.25,slope:24,amp:.1,sub:.3,drift:.4,g:1.27},
  dafclean:{n:'DAF Clean Sour',eng:'mod',fam:'ms20',w1:'saw',w2:'sq',sour:.35,msour:.75,ksour:.5,xm:0,hp:.2,det:0,cut:.42,res:.2,env:.35,dec:.2,drive:.2,slope:12,amp:.35,adec:.22,drift:.3,g:1.11},
  arpbass:{n:'ARP Bass',eng:'mod',fam:'arp',w1:'saw',w2:'pulse',pw:.3,w3:'tri',oct3:-12,l3:.35,xm:.08,hp:.05,det:.15,cut:.3,res:.45,env:.55,dec:.22,drive:.35,slope:24,amp:.2,adec:.25,drift:.35,sh:.2,g:1.21},
  arpsh:{n:'ARP S&H Lead',eng:'mod',fam:'arp',w1:'saw',w2:'sq',oct2:12,xm:.15,ring:.25,hp:.1,det:.1,cut:.4,res:.65,env:.4,dec:.25,drive:.3,slope:24,amp:.2,adec:.3,sh:.8,rev:.3,drift:.3,g:1.43},
  sourpair:{n:'Sour Pairs',eng:'an',fam:'modular',w1:'saw',w2:'saw',w3:'sq',oct3:-12,w4:'sq',oct4:-12,l3:.3,l4:.3,sour:.4,sour2:.5,msour:.4,up:.25,det:0,cut:.32,res:.3,env:.45,dec:.25,drive:.35,slope:24,amp:.2,drift:.6,g:1.01},
  eurogrowl:{n:'Euro Growl',eng:'mod',fam:'euro',w1:'sync',syncR:2.2,w2:'pulse',pw:.3,oct2:-12,xm:.15,ring:.35,hp:.15,noise:.25,noiseC:.5,cut:.3,res:.5,env:.55,dec:.22,drive:.7,slope:12,amp:.2,lfo:.15,lfoR:1.5,sour:.2,drift:.4,g:0.97}
};

function presetSnd(k){const{n,...p}=BASS_PRESETS[k];return Object.assign({preset:k,w2:null,oct2:0,g:1},p);}

const POWER303_BANK=[
 ['Plastic drive','mini','an',{w1:'saw',w2:'pulse',w3:'tri',oct3:-12,pw:.34,res:.33,cut:.48}],
 ['Rubber pulse','ms20','mod',{w1:'pulse',w2:'tri',pw:.24,xm:.035,res:.37,cut:.44}],
 ['Liquid 2600','arp','an',{w1:'saw',w2:'sq',w3:'tri',oct3:0,res:.29,cut:.46}],
 ['Satin diode','serge','mod',{w1:'tri',w2:'pulse',pw:.3,xm:.018,res:.35,cut:.53}],
 ['Soft sync','source','an',{w1:'sync',w2:'tri',syncR:1.72,res:.26,cut:.42}],
 ['Modular stretch','modular','mod',{w1:'saw',w2:'pulse',w3:'tri',pw:.39,xm:.025,res:.31,cut:.43}],
 ['Round square','sh101','an',{w1:'sq',w2:'tri',w3:'sine',oct3:12,res:.36,cut:.51}],
 ['Elastic fold','buchla','wc',{w1:'tri',r1:2,i1:.65,i1s:.16,d1:.19,fold:.28,fenv:.33,fdec:.2,res:.2,cut:.57}],
 ['Hollow rubber','odyssey','an',{w1:'pulse',w2:'sq',pw:.17,res:.34,cut:.5,fbank:'hollow'}],
 ['Silicone glide','matriarch','an',{w1:'tri',w2:'saw',w3:'pulse',pw:.32,res:.28,cut:.55}],
 ['West coast silk','serge','wc',{w1:'tri',r1:1,i1:.85,i1s:.21,d1:.25,fold:.36,fenv:.27,fdec:.26,res:.22,cut:.53}],
 ['Liquid ladder','sub37','an',{w1:'saw',w2:'saw',w3:'tri',oct3:-12,res:.41,cut:.43}]
].map(([name,family,engine,shape],i)=>({id:String(i),name,family,engine,shape}));

const POWER303_SOURCES=[
 ['mini','an',{w1:'saw',w2:'sq',w3:'tri',oct3:-12,l3:.12}],
 ['modular','mod',{w1:'pulse',w2:'saw',w3:'tri',pw:.19,xm:.11}],
 ['source','an',{w1:'sync',w2:'saw',syncR:2.6,l2:.2}],
 ['arp','mod',{w1:'saw',w2:'pulse',pw:.38,xm:.055}],
 ['sh101','an',{w1:'sq',w2:null,w3:'tri',l1:.8,l3:.2}],
 ['ms20','mod',{w1:'pulse',w2:'sq',pw:.14,hp:.36,xm:.08}],
 ['buchla','wc',{w1:'tri',r1:2,i1:1.4,i1s:.13,d1:.08,fold:.42,fenv:.58}],
 ['serge','wc',{w1:'sine',r1:3,i1:.9,i1s:.09,d1:.18,fold:.24,fenv:.36}],
 ['rings','add',{w1:'sine',mtype:'harmonic',hA:[1,.68,.34,.16,.1,.06],bright:.44,mdec:.15,msus:.28,damp:.65}],
 ['wtab','wt',{w1:'saw',wa:1,wb:7,wmix:.28,wenv:.62,wdec:.12}],
 ['vec','vec',{w1:'tri',va:0,vb:3,vc:7,vd:9,vx:.18,vy:.63,vseq:false}],
 ['fm','fm',{w1:'sine',r1:1,r2:2,i1:2.2,i1s:.13,d1:.07,i2:.6,i2s:.04,d2:.18,alg:'parallel'}],
 ['nord','an',{w1:'sync',w2:'pulse',syncR:1.35,pw:.28,det:.2}],
 ['jup8','an',{w1:'pulse',w2:'saw',pw:.42,l1:.65,l2:.27,det:.28}],
 ['p5','an',{w1:'saw',w2:'tri',w3:'pulse',pw:.09,oct3:12,l3:.09}],
 ['odyssey','mod',{w1:'pulse',w2:'saw',pw:.11,xm:.16,ring:.025}],
 ['tb303','an',{w1:'sq',w2:null,w3:null,l1:.9,det:0,sour:0,msour:0}],
 ['mbrute','mod',{w1:'saw',w2:'pulse',pw:.23,xm:.14,slope:12}],
 ['sub37','an',{w1:'saw',w2:'sq',w3:'sine',oct3:-12,l3:.13,det:.14}],
 ['matriarch','an',{w1:'tri',w2:'saw',w3:'pulse',w4:'tri',oct4:12,l4:.08,pw:.32}],
 ['cs80','an',{w1:'pulse',w2:'saw',pw:.39,fatk:.035,det:.16}],
 ['euro','fm',{w1:'sine',r1:2,r2:3,i1:1.6,i1s:.2,d1:.1,i2:.85,i2s:.06,d2:.06,alg:'stack'}]
];

const POWER303_TONE_PROFILES=[
 ['Bubble',{cut:.24,res:.66,env:.82,dec:.075,amp:.9,adec:.1,rel:.055,slope:24,p303:{plastic:.3,stretch:.22,round:.57,body:.25,stereo:.5,glide:.28,motion:.55}}],
 ['Liquid',{cut:.35,res:.43,env:.46,dec:.48,amp:.18,adec:.5,rel:.22,slope:24,p303:{plastic:.5,stretch:.82,round:.76,body:.5,stereo:.72,glide:.76,motion:.4}}],
 ['Vowel',{cut:.52,res:.31,env:.24,dec:.21,amp:.44,adec:.3,rel:.1,slope:12,ft:'bp',p303:{plastic:.9,stretch:.58,round:.54,body:.32,stereo:.76,glide:.5,motion:.87}}],
 ['Suction',{cut:.28,res:.55,env:.68,dec:.16,amp:.56,adec:.19,rel:.08,slope:24,p303:{plastic:.68,stretch:.95,round:.67,body:.38,stereo:.58,glide:.68,motion:.7}}]
];

const POWER303_MACROS={plastic:.6,stretch:.62,round:.68,body:.58,stereo:.65,glide:.52,motion:.55};

function power303Patch(index=0,seed=30301,variation=.2){
 const P=POWER303_BANK[(+index+POWER303_BANK.length)%POWER303_BANK.length],R=mul32(seed>>>0),r=(a,b)=>a+R()*(b-a),a=clamp(variation,0,1);
 // A bounded palette: harmonic oscillators, smooth filter drive, no noise/crush/ring path.
 const sn={eng:P.engine,w1:'saw',w2:'tri',w3:null,w4:null,w5:null,oct2:0,oct3:0,l1:.58,l2:.32,l3:.18,det:.09,sour:.025,msour:.05,ksour:0,sub:0,up:0,
  cut:.48,res:.3,env:.38,dec:.24,drive:.18,dist:0,amp:.33,adec:.3,atk:.004,rel:.16,slope:24,g:1,glide:.52,legato:false,
  lfo:.022,lfoR:.24,drift:0,noise:0,tr:0,ring:0,fsh:0,lofi:0,hp:0,lowcut:0,sh:0,
  ...P.shape,preset:'p303:'+P.id,name:P.name,powerPatch:P.id,powerSeed:seed,p303:{...POWER303_MACROS,...P.shape.p303}};
 sn.cut=clamp(sn.cut+r(-.1,.1)*a,.26,.68);sn.res=clamp(sn.res+r(-.15,.15)*a,.12,.76);sn.env=clamp(sn.env+r(-.15,.25)*a,.2,.7);
 sn.dec=clamp(sn.dec+r(-.13,.2)*a,.09,.48);sn.det=clamp(sn.det+r(-.06,.16)*a,.015,.22);sn.drive=clamp(sn.drive+r(-.07,.2)*a,.06,.4);
 if(sn.pw)sn.pw=clamp(sn.pw+r(-.12,.12)*a,.12,.46);if(sn.syncR)sn.syncR=clamp(sn.syncR+r(-.5,.6)*a,1.2,2.6);
 if(P.engine==='wc'){sn.i1*=r(.88,1.14);sn.fold=clamp(sn.fold+r(-.1,.1)*a,.15,.46);}
 for(const k of ['plastic','stretch','body','motion'])sn.p303[k]=clamp(sn.p303[k]+r(-.24,.24)*a,.2,.9);
 sn.p303.round=clamp(sn.p303.round+r(-.15,.18)*a,.35,.9);sn.p303.stereo=clamp(sn.p303.stereo+r(-.2,.2)*a,.2,.9);
 return sn;
}

function mul32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function power303Build(E,t,time){
 const raw=E.c,sn=t.snd,key='p303|'+voiceSig(sn,raw,false)+'|'+sn.powerPatch;let old=E.voices[t.id];if(old?.sig===key)return old;
 if(old){
  old.vca.gain.cancelScheduledValues(time);old.vca.gain.setTargetAtTime(0,time,.006);(E.powerRetired||(E.powerRetired=[])).push(old);
  const end=()=>{for(const node of old.nodes||[])try{node.disconnect();}catch(e){}const i=E.powerRetired.indexOf(old);if(i>=0)E.powerRetired.splice(i,1);};
  if(old.oscs?.[0])old.oscs[0].addEventListener('ended',end,{once:true});for(const o of old.oscs||[])try{o.stop(time+.045);}catch(e){}
 }
 const nodes=new Set(),methods=new Map(),c=new Proxy(raw,{get(target,k){if(k==='_powerRaw')return raw;const v=Reflect.get(target,k,target);if(typeof v!=='function')return v;if(!methods.has(k))methods.set(k,(...args)=>{const n=v.apply(target,args);if(String(k).startsWith('create')&&n&&typeof n.disconnect==='function')nodes.add(n);return n;});return methods.get(k);}});
 const out=c.createGain();out.gain.value=1;const pre=c.createGain(),soft=c.createWaveShaper(),post=c.createGain();pre.gain.value=.25;post.gain.value=4;const cv=new Float32Array(4097);for(let i=0;i<cv.length;i++){const x=i/(cv.length-1)*2-1;cv[i]=.225*Math.tanh(x/.225);}soft.curve=cv;soft.oversample='2x';out.connect(pre);pre.connect(soft);soft.connect(post);post.connect(E.bus[t.id]);const bend=c.createConstantSource();bend.offset.value=0;
 const channels=[];const clean={...sn,sub:0,noise:0,tr:0,ring:0,fsh:0,lofi:0,dist:0,legato:false};
 for(const side of [-1,1]){
  const input=c.createGain(),vowel=c.createBiquadFilter(),form=c.createBiquadFilter(),hp=c.createBiquadFilter(),smooth=c.createBiquadFilter(),sat=c.createWaveShaper(),trim=c.createGain(),pan=c.createStereoPanner();
  hp.type='highpass';hp.frequency.value=145;hp.Q.value=.65;vowel.type=form.type='peaking';vowel.frequency.value=600;form.frequency.value=1800;
  smooth.type='lowpass';smooth.frequency.value=6500;smooth.Q.value=.58;sat.curve=dcurve(.18);sat.oversample='2x';trim.gain.value=.76;
  input.connect(hp);hp.connect(vowel);vowel.connect(form);form.connect(sat);sat.connect(smooth);smooth.connect(trim);trim.connect(pan);pan.connect(out);
  const voice=buildVoice(c,clean,input,false);for(const n of Object.values(voice))if(n&&typeof n.disconnect==='function')nodes.add(n);for(const o of voice.oscs)if(o.detune)bend.connect(o.detune);
  channels.push({side,voice,vowel,form,smooth,sat,trim,pan});
 }
 const bodyFilter=c.createBiquadFilter();bodyFilter.type='lowpass';bodyFilter.frequency.value=165;bodyFilter.Q.value=.62;bodyFilter.connect(out);
 const body=[1,.5].map((ratio,i)=>{const o=c.createOscillator(),g=c.createGain();o.type='sine';g.gain.value=0;o.connect(g);g.connect(bodyFilter);bend.connect(o.detune);return{o,g,ratio};});
 const oscs=[...channels.flatMap(x=>x.voice.oscs),...body.map(x=>x.o),bend];for(const o of oscs)o.start(Math.max(0,time-.003));
 const v={eng:'p303',sig:key,nodes,oscs,vca:out,channels,body,bodyFilter,bend,on:false,cutP:channels.flatMap(x=>x.voice.cutP)};E.voices[t.id]=v;return v;
}

const voiceSig=(sn,c,poly)=>{const ws=[sn.w1,sn.w2,sn.w3,sn.w4,sn.w5];return[ENG(sn),...ws.map(w=>w||''),sn.m1w||'',sn.alg||'',sn.slope,!poly&&c&&c._lad?'L':'B',
  ws.includes('pulse')?Math.round((sn.pw||.5)*40):'',ws.includes('sync')?Math.round((sn.syncR||2)*20):'',sn.noise>0?'N'+Math.round((sn.noiseC==null?.6:sn.noiseC)*20):'',sn.fbank||'',ENG(sn)==='mod'||sn.lfo>0?'F':'',sn.dist>0?'D':'',sn.foldPost?'FP':'',sn.up>0?'U':'',sn.ft||'',sn.fsh?'B':'',sn.lofi>0?'C'+(poly?Math.round(sn.lofi*10):''):'',sn.tr>0?'T':'',sn.vib>0?'V':'',ENG(sn)==='vec'?'v'+[sn.va,sn.vb,sn.vc,sn.vd].join('.')+'x'+Math.round((sn.vx||0)*20)+'y'+Math.round((sn.vy||0)*20)+(sn.vseq?'q':''):'',ENG(sn)==='wt'?'w'+(sn.wa|0)+'.'+(sn.wb|0):'',poly&&sn.lowcut>0?'S':''].join('|');};

const ENG=sn=>sn.eng||'an';

const dcurve=k=>{const q=Math.round(k*50)/50;return DCURVE[q]||(DCURVE[q]=driveCurve(q));};

const DCURVE={};

function driveCurve(k){const n=1024,c=new Float32Array(n),a=1+k*12,nm=Math.tanh(a);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;c[i]=Math.tanh(a*x)/nm;}return c;}

function buildVoice(c,sn,dest,poly){
 const v=buildVoiceBeforeRuntime(c,sn,dest,poly),owner=c._audioPolyOwner,E=owner?.engine;
 if(poly&&E?.live&&owner){const entry={id:owner.id,start:owner.time,end:owner.end,v};(E.polyLive||(E.polyLive=new Set())).add(entry);
  v.oscs[0].addEventListener('ended',()=>{E.polyLive.delete(entry);audioDisposeObject(v);},{once:true});
 }return v;
}

function buildVoiceBeforeRuntime(c,sn,dest,poly){
  const eng=ENG(sn),mix=c.createGain(),oscs=[],v={eng,oscs,poly};
  const mk=(w,to)=>{const o=c.createOscillator();if(w==='pulse'||w==='sync')o.setPeriodicWave(waveFor(c,w,sn));else o.type=WT[w]||'sawtooth';const g=c.createGain();o.connect(g);if(to)g.connect(to);oscs.push(o);return[o,g];};
  if(eng==='fm'){
    [v.c1,v.gc1]=mk('sine',mix);[v.c2,v.gc2]=mk('sine',mix);
    [v.m1,v.gm1]=mk(sn.m1w||'sine');v.gm1.gain.value=0;v.gm1.connect(v.c1.frequency);v.gm1.connect(v.c2.frequency);
    [v.m2,v.gm2]=mk('sine');v.gm2.gain.value=0;if(sn.alg==='stack')v.gm2.connect(v.m1.frequency);else{v.gm2.connect(v.c1.frequency);v.gm2.connect(v.c2.frequency);}
  }else if(eng==='vec'){
    /* vector synthesis (Prophet VS, Wavestation): four waves, two slow LFOs move the mix around like a joystick; Wave sequence steps between them in 8ths */
    const W=[sn.va|0,sn.vb!=null?sn.vb:4,sn.vc!=null?sn.vc:6,sn.vd!=null?sn.vd:8];
    v.vo=W.map(w=>{const o=c.createOscillator();o.setPeriodicWave(wtWave(c,w));const g=c.createGain();g.gain.value=.22;o.connect(g);g.connect(mix);oscs.push(o);return[o,g];});
    const lx=c.createOscillator(),ly=c.createOscillator();lx.type=sn.vseq?'square':'sine';ly.type='triangle';lx.frequency.value=sn.vseq?S.bpm/30:.03+(sn.vx!=null?sn.vx:.3)*.6;ly.frequency.value=.02+(sn.vy!=null?sn.vy:.2)*.45;oscs.push(lx,ly);
    const sg=[[1,1],[-1,1],[1,-1],[-1,-1]];v.vo.forEach(([o,g],i)=>{const ax=c.createGain(),ay=c.createGain();ax.gain.value=.2*sg[i][0];ay.gain.value=.2*sg[i][1];lx.connect(ax);ax.connect(g.gain);ly.connect(ay);ay.connect(g.gain);});
  }else if(eng==='wt'){
    const mkw=(i,to)=>{const o=c.createOscillator();o.setPeriodicWave(wtWave(c,i));const g=c.createGain();o.connect(g);g.connect(to);oscs.push(o);return[o,g];};
    [v.wa,v.ga]=mkw(sn.wa||0,mix);[v.wb,v.gb]=mkw(sn.wb!=null?sn.wb:4,mix);[v.wa2,v.ga2]=mkw(sn.wa||0,mix);v.ga2.gain.value=0;
  }else if(eng==='add'){
    /* modal / additive: the partials ring out on their own, the high ones die first */
    v.parts=[];for(let i=0;i<6;i++){const[o,g]=mk('sine',mix);g.gain.value=0;v.parts.push([o,g]);}
  }else if(eng==='wc'){
    /* West Coast (Buchla): a sine or triangle, frequency-modulated, through a wave folder */
    v.fpre=c.createGain();v.fpre.gain.value=.2;const cw=sn.w1==='tri'?'tri':'sine';
    [v.c1,v.gc1]=mk(cw,v.fpre);[v.c2,v.gc2]=mk(cw,v.fpre);
    [v.m1,v.gm1]=mk('sine');v.gm1.gain.value=0;v.gm1.connect(v.c1.frequency);v.gm1.connect(v.c2.frequency);
    v.fold=c.createWaveShaper();v.fold.curve=foldCurve();v.fold.oversample='2x';v.fpre.connect(v.fold);const fo=c.createGain();fo.gain.value=.7;v.fold.connect(fo);fo.connect(mix);
  }else{
    [v.o1,v.g1]=mk(sn.w1,mix);if(sn.w2)[v.o2,v.g2]=mk(sn.w2,mix);if(sn.w3)[v.o3,v.g3]=mk(sn.w3,mix);if(sn.w4)[v.o4,v.g4]=mk(sn.w4,mix);if(sn.w5)[v.o5,v.g5]=mk(sn.w5,mix);
    [v.u1,v.gu1]=mk(sn.w1,mix);[v.u2,v.gu2]=mk(sn.w1,mix);v.gu1.gain.value=0;v.gu2.gain.value=0;
    {v.xm=c.createGain();v.xm.gain.value=0;(v.o2||v.o1).connect(v.xm);v.xm.connect(v.o1.frequency);
      if(v.o2){const rg=c.createGain();rg.gain.value=0;v.o1.connect(rg);v.o2.connect(rg.gain);v.rl=c.createGain();v.rl.gain.value=0;rg.connect(v.rl);v.rl.connect(mix);}}
  }
  [v.so,v.gs]=mk('sine',mix);v.gs.gain.value=0;
  if(sn.up>0&&(eng==='an'||eng==='mod')){[v.oup,v.gup]=mk(sn.w1==='sync'?'saw':sn.w1,mix);v.gup.gain.value=0;}
  if(sn.noise>0){const nb=c._nzB||(c._nzB=(()=>{const n=c.sampleRate*2,bf=c.createBuffer(1,n,c.sampleRate),d=bf.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return bf;})());
    const ns=c.createBufferSource();ns.buffer=nb;ns.loop=true;const nf=c.createBiquadFilter();nf.type='lowpass';nf.frequency.value=600*Math.pow(2,(sn.noiseC==null?.6:sn.noiseC)*5);
    v.gnz=c.createGain();v.gnz.gain.value=0;ns.connect(nf);nf.connect(v.gnz);v.gnz.connect(mix);oscs.push(ns);}
  let src=mix,last;
  /* Lo-fi (Emulator II, SQ-80, Fairlight): the oscillators come out at fewer bits and a lower sample rate, then the analog filter cleans up */
  if(sn.lofi>0){if(!poly&&c._lad){try{v.cr=new AudioWorkletNode(c,'nb-crush',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});src.connect(v.cr);src=v.cr;}catch(e){v.cr=null;}}
    if(!v.cr){const w=c.createWaveShaper(),L=Math.pow(2,15-Math.round(sn.lofi*10)),n=4096,cv=new Float32Array(n);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;cv[i]=Math.round(x*L)/L;}w.curve=cv;src.connect(w);src=w;}}
  if(eng==='mod'){v.hp=c.createBiquadFilter();v.hp.type='highpass';v.hp.Q.value=.7;src.connect(v.hp);src=v.hp;}
  if(!poly&&c._lad&&sn.ft!=='bp'){try{v.lad=new AudioWorkletNode(c._powerRaw||c,'nb-ladder',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});}catch(e){v.lad=null;}}
  if(v.lad){src.connect(v.lad);const lg=c.createGain();lg.gain.value=LADDER_GAIN;v.lad.connect(lg);last=lg;v.cutP=[v.lad.parameters.get('cutoff')];}
  else{v.f1=c.createBiquadFilter();v.f1.type=sn.ft==='bp'?'bandpass':'lowpass';src.connect(v.f1);last=v.f1;
    if(sn.ft==='bp'){v.bg=c.createGain();v.bg.gain.value=4;v.f1.connect(v.bg);last=v.bg;}
    if(sn.slope===24){v.f2=c.createBiquadFilter();v.f2.type='lowpass';v.f2.Q.value=.6;v.f1.connect(v.f2);last=v.f2;}
    v.cutP=[v.f1.frequency].concat(v.f2?[v.f2.frequency]:[]);}
  /* delayed vibrato for leads: it fades in after the note starts, like a singer or a violin */
  if(sn.vib>0){const P=oscs.filter(o=>o.detune&&o.constructor===OscillatorNode);v.vibO=c.createOscillator();v.vibO.frequency.value=5.3;v.vibG=c.createGain();v.vibG.gain.value=0;v.vibO.connect(v.vibG);for(const o of P)v.vibG.connect(o.detune);oscs.push(v.vibO);}
  if(eng==='mod'||sn.lfo>0){v.lfo=c.createOscillator();v.lfo.type='triangle';v.lfoG=c.createGain();v.lfoG.gain.value=0;v.lfo.connect(v.lfoG);for(const p of v.cutP)v.lfoG.connect(p);oscs.push(v.lfo);
    if(v.fpre){v.lfoF=c.createGain();v.lfoF.gain.value=0;v.lfo.connect(v.lfoF);v.lfoF.connect(v.fpre.gain);}}
  if(sn.foldPost>0){v.foldPre=c.createGain();v.foldPre.gain.value=.12+sn.foldPost*.3;const folder=c.createWaveShaper();folder.curve=foldCurve();folder.oversample='2x';const trim=c.createGain();trim.gain.value=.55;last.connect(v.foldPre);v.foldPre.connect(folder);folder.connect(trim);last=trim;}v.sh=c.createWaveShaper();v.drive=sn.drive;v.sh.curve=dcurve(v.lad?sn.drive*.4:sn.drive);last.connect(v.sh);
  v.vca=c.createGain();v.vca.gain.value=0;let fx=v.sh;
  /* Bode frequency shifter (Moog 1630): every partial moves the same number of Hz, so the sound turns metallic or beats against itself */
  if(sn.fsh&&!poly&&c._lad){try{v.fs=new AudioWorkletNode(c,'nb-fshift',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});fx.connect(v.fs);fx=v.fs;}catch(e){v.fs=null;}}
  if(sn.dist>0){const F2=fuzz(sn.dist);v.ds=c.createWaveShaper();v.ds.curve=F2.c;v.ds.oversample='2x';v.dg=c.createGain();v.dg.gain.value=F2.g;v.dist=sn.dist;
    const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=8000;lp.Q.value=.5;fx.connect(v.ds);v.ds.connect(lp);lp.connect(v.dg);fx=v.dg;}
  if(!poly||sn.lowcut>0){v.ls=c.createBiquadFilter();v.ls.type='lowshelf';v.ls.frequency.value=170;v.ls.gain.value=0;fx.connect(v.ls);fx=v.ls;}
  if(sn.fbank&&FBANK[sn.fbank])FBANK[sn.fbank].forEach((db,i)=>{if(!db)return;const b=c.createBiquadFilter();b.type='peaking';b.frequency.value=FB_F[i];b.Q.value=1.3;b.gain.value=db;fx.connect(b);fx=b;});
  fx.connect(v.vca);v.vca.connect(dest);
  /* attack transient (Roland D-50): a short burst on top of the note, chiff, bow, breath or mallet, outside the filter */
  if(sn.tr>0){const ns=c.createBufferSource();ns.buffer=nzBuf(c);ns.loop=true;v.trF=c.createBiquadFilter();v.trG=c.createGain();v.trG.gain.value=0;ns.connect(v.trF);v.trF.connect(v.trG);v.trG.connect(dest);oscs.push(ns);}
  return v;
}

function waveFor(c,w,sn){
  const pw=Math.round(clamp(sn.pw||.5,.05,.5)*40)/40,sr=Math.round(clamp(sn.syncR||2,1.05,5)*20)/20,key=w==='pulse'?'p'+pw:'s'+sr,M=c._pw||(c._pw={});
  if(M[key])return M[key];
  const N=96,re=new Float32Array(N+1),im=new Float32Array(N+1);
  if(w==='pulse')for(let h=1;h<=N;h++)re[h]=4/(h*Math.PI)*Math.sin(h*Math.PI*pw);
  else{const L=4096,x=new Float32Array(L);for(let i=0;i<L;i++){const ph=(i/L*sr)%1;x[i]=2*ph-1;}
    for(let h=1;h<=N;h++){let a=0,b=0;for(let i=0;i<L;i++){const w2=2*Math.PI*h*i/L;a+=x[i]*Math.cos(w2);b+=x[i]*Math.sin(w2);}re[h]=2*a/L;im[h]=2*b/L;}}
  return M[key]=c.createPeriodicWave(re,im);
}

const WT={saw:'sawtooth',sq:'square',tri:'triangle',sine:'sine'};

function wtWave(c,i){const M=c._wt||(c._wt={});if(M[i])return M[i];i=clamp(i|0,0,WTAB.length-1);
  if(!WTAB[i][1])return M[i]=waveFor(c,'sync',{syncR:3.4});
  const N=96,re=new Float32Array(N+1),im=new Float32Array(N+1);for(let h=1;h<=N;h++)im[h]=WTAB[i][1](h);return M[i]=c.createPeriodicWave(re,im);}

const WTAB=[['Sine',h=>h===1?1:0],['Soft',h=>h%2?1/(h*h):0],['Saw',h=>1/h],['Square',h=>h%2?1/h:0],['Formant A',h=>(h===1?.4:0)+Math.exp(-((h-6)**2)/6)/Math.sqrt(h)],
  ['Formant O',h=>(h===1?.5:0)+Math.exp(-((h-3)**2)/3)/Math.sqrt(h)],['Digital',h=>[1,5,9,13,17,21].includes(h)?1/Math.sqrt(h):0],['Hollow',h=>Math.abs(Math.sin(h*Math.PI*.12))/h],
  ['Organ',h=>[1,2,3,4,6,8,16].includes(h)?.8/Math.sqrt(h):0],['Sync bright',null]];

const foldCurve=()=>FOLD_C||(FOLD_C=(()=>{const n=4096,a=new Float32Array(n);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;a[i]=Math.sin(x*Math.PI/2/.2);}return a;})());

let FOLD_C=null;

const LADDER_GAIN=1.25;

function fuzz(d){const q=Math.round(d*50)/50;if(FUZZ[q])return FUZZ[q];
  const k=1+q*28,b=.12*q,f=x=>Math.tanh(k*(x+b))-Math.tanh(k*b),n=2048,c=new Float32Array(n);let mx=0;
  for(let i=0;i<n;i++){c[i]=f(i/(n-1)*2-1);mx=Math.max(mx,Math.abs(c[i]));}for(let i=0;i<n;i++)c[i]/=mx;
  let si=0,so=0;const N=512;for(let i=0;i<N;i++){const x=.9*Math.tanh(2.5*(2*(i/N)-1))/Math.tanh(2.5),y=c[Math.round((x+1)/2*(n-1))];si+=x*x;so+=y*y;}
  return FUZZ[q]={c,g:Math.sqrt(si/so)};}

const FUZZ={};

const FBANK={warm:[4,3,1,0,-2,-4,-6,-8],hollow:[2,0,-8,-10,-6,2,3,0],nasal:[-4,-2,2,8,9,4,0,-4],'vowel a':[-4,-2,6,9,4,-2,-4,-6],'vowel o':[0,6,9,2,-4,-6,-8,-9],telephone:[-14,-10,-2,4,5,2,-8,-14]};

const FB_F=[125,250,500,1000,1800,2800,4000,5600];

const nzBuf=c=>c._nzB||(c._nzB=(()=>{const n=c.sampleRate*2,bf=c.createBuffer(1,n,c.sampleRate),d=bf.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return bf;})());

function audioDisposeObject(value,at,seen=new Set()){
 if(!value||typeof value!=='object'||seen.has(value)||ArrayBuffer.isView(value)||value.getChannelData||value.createGain)return;
 seen.add(value);if(value.connect&&value.disconnect){try{value.port?.postMessage({type:'dispose'});}catch{}try{value.stop?.(at);}catch{}try{value.disconnect();}catch{}return;}
 if(value instanceof Map||value instanceof Set){for(const item of value.values())audioDisposeObject(item,at,seen);}else for(const item of Object.values(value))audioDisposeObject(item,at,seen);
}

function power303NoteBeforeAcid(E,t,time,f,dur,acc,gin,gout,w){
 power303Defaults(t);const q=power303Macros(t),v=power303Build(E,t,time);if(!v.on)gin=0;const sn0=wheelCut(t.snd,w),gesture=humF(t.snd.powerSeed+'p',Math.round(time*1000)),motion=q.motion*(.45+gesture*.55),stretch=q.stretch;
 const sn={...sn0,sub:0,noise:0,tr:0,dist:0,ring:0,fsh:0,lofi:0,legato:false,glide:gin?q.glide:0,
  cut:clamp(sn0.cut+(gesture-.5)*motion*.11,.15,.78),drive:clamp(sn0.drive+q.plastic*.09,0,.46)};
 const end=time+Math.max(.035,dur*.94),gain=sn.g||1;
 v.vca.gain.cancelScheduledValues(time);v.vca.gain.setTargetAtTime(1,time,.003);
 const pull=(gin?0:(gesture<.5?-1:1)*(12+stretch*66)*(acc?1:.7));v.bend.offset.cancelScheduledValues(time);v.bend.offset.setValueAtTime(pull,time);v.bend.offset.setTargetAtTime(0,time+.004,.015+stretch*.068);
 for(const ch of v.channels){
  const hz=f*2**(ch.side*q.stereo*5.5/1200);voiceOn(ch.voice,sn,time,hz,{acc,gin,lvl:.55*BASS_LVL*.62,ref:mtof(bassB(S.root)+12)});
  if(!gout)voiceOff(ch.voice,sn,end);
  const vowel=(340+q.plastic*720)*(1+(gesture-.5)*motion*.4)*Math.pow(clamp(f/100,.5,4),.14),f2=1100+q.plastic*1500+motion*gesture*650;
  for(const [node,base,db,Q]of [[ch.vowel,vowel,1.8+q.plastic*5,1.2+q.plastic*.8],[ch.form,f2,1.2+q.plastic*2.8,.9+q.plastic*.6]]){
   const p=node.frequency,target=clamp(base*(1+ch.side*q.stereo*.018),180,4600);node.gain.setValueAtTime(db,time);node.Q.setValueAtTime(Q,time);p.cancelScheduledValues(time);
   if(!gin){p.setValueAtTime(target*(.72+.13*(1-stretch)),time);p.exponentialRampToValueAtTime(target*(1.03+stretch*.15),time+Math.min(.11+stretch*.09,Math.max(.025,dur*.5)));}
   p.setTargetAtTime(target,time+Math.min(.12+stretch*.1,Math.max(.03,dur*.55)),.07);
  }
  ch.smooth.frequency.setTargetAtTime(7800-q.round*3700,time,.02);ch.pan.pan.setTargetAtTime(ch.side*q.stereo*.92,time,.025);
  ch.trim.gain.setTargetAtTime(.78/(1+q.plastic*.2),time,.025);
 }
 for(const {o,g,ratio}of v.body){const p=o.frequency;p.cancelScheduledValues(time);if(gin&&v.on)p.setTargetAtTime(f*ratio,time,.012+q.glide*q.glide*.22);else p.setValueAtTime(f*ratio,time);
  const peak=q.body*(ratio===1?.115:.055)*gain*(acc?1.12:1);g.gain.cancelScheduledValues(time);g.gain.setTargetAtTime(peak,time,.004);if(!gout)g.gain.setTargetAtTime(0,end,.018+(sn.rel||.1)*.2);
 }
 v.on=true;
}

function power303Defaults(t){
 const defaults={rhythm:'mixed',playing:'auto',source:'all',register:'auto',auto:true,seed:30301,recent:[]};if(!t.power)t.power={};for(const k in defaults)if(t.power[k]==null)t.power[k]=commonCopy(defaults[k]);
 if(!t.snd?.p303){const previous=t.snd;t.snd=power303Patch();if(previous?.powerPatch!=null)t.snd={...previous,p303:{...POWER303_MACROS,...previous.p303}};}
 return t.power;
}

const commonCopy=x=>JSON.parse(JSON.stringify(x));

function power303Macros(t){return{...POWER303_MACROS,...t.snd?.p303};}

const wheelCut=(sn,w)=>w?Object.assign({},sn,{cut:clamp((sn.cut??.4)+w*.38,0,1)}):sn;

const humF=(id,s)=>{let h=2166136261;const k=id+':'+s;for(let i=0;i<k.length;i++){h^=k.charCodeAt(i);h=Math.imul(h,16777619);}return((h>>>0)%1000)/1000;};

function voiceOn(v,sn0,time,f,o){
  const sn=Object.assign({det:0,cut:.5,res:0,env:0,dec:.3,drive:0,amp:0,sub:0,slope:24},sn0);
  if(v.foldPre&&!o.gin){v.foldPre.gain.cancelScheduledValues(time);v.foldPre.gain.setValueAtTime(.15+(sn.foldPost||0)*.45,time);v.foldPre.gain.setTargetAtTime(.1+(sn.foldPost||0)*.22,time+.002,.05+(sn.dec||.2)*.2);}const acc=o.acc,gin=o.gin,so=sn.sour||0,dw=(sn.drift||0)+so*.5,dr=()=>dw?(rnd()-.5)*dw*10:0;
  if(v.drive!==sn.drive){v.sh.curve=dcurve(v.lad?sn.drive*.4:sn.drive);v.drive=sn.drive;}
  const gl=sn.glide?.01+sn.glide*sn.glide*.3:0;
  const setF=(p,fr)=>{p.cancelScheduledValues(time);if(gin===1||(gl&&!v.poly&&v.on))p.setTargetAtTime(fr,time,gin===1?Math.max(.028,gl):gl);else p.setValueAtTime(fr,time);};
  /* Sour when moving: like a modular where one oscillator's pitch CV runs through a slew: it lags behind on every new note,
     so the line goes sour for a moment each time it moves (DAF, Conny Plank). Fresh chord notes scoop up from a little below. */
  const ms=sn.msour||0,lag=ms>0?.006+ms*ms*.15:0;
  const setFL=(p,fr,amt)=>{if(!lag||gin===1){setF(p,fr);return;}p.cancelScheduledValues(time);if(v.poly||!v.on)p.setValueAtTime(fr*Math.pow(2,-ms*amt*.7/12),time);
    p.setTargetAtTime(fr,time,Math.max(lag*amt,gl&&!v.poly&&v.on?gl:0));};
  /* Sour up high: oscillators that don't track the same, so notes above the line's root get sourer (and below a little too) */
  const ks=sn.ksour&&o.ref?sn.ksour*clamp(12*Math.log2(f/o.ref),-12,24)*3:0;
  if(v.eng==='an'||v.eng==='mod'){
    const dc=sn.det*22,multi=!!(sn.w2||sn.w3),ul=sn.det>.05?Math.min(.4,sn.det*.45):0;
    v.o1.detune.setValueAtTime((sn.oct1||0)*100+(sn.cents1||0)-dc+dr(),time);
    const sc=Math.pow(so,1.3)*95;
    if(v.o2)v.o2.detune.setValueAtTime(dc+(sn.oct2||0)*100+(sn.cents2||0)+sc+ks+dr(),time);
    const s2=sn.sour2>0?Math.pow(sn.sour2,1.3)*95:0;
    if(v.o3)v.o3.detune.setValueAtTime((sn.oct3||0)*100+(sn.cents3||0)+(sn.det3||0)-dc*.5+(s2?-s2*.5:-sc*.65)+dr(),time);
    if(v.o4)v.o4.detune.setValueAtTime((sn.oct4||0)*100+dc*.7+(s2?s2*.5:sc*.4)-ks*.7+dr(),time);
    if(v.oup){v.oup.detune.setValueAtTime(sc*.5+ks*.5+dr(),time);setFL(v.oup.frequency,f*2,.8);v.gup.gain.setValueAtTime((sn.up||0)*.4,time);}
    if(v.o5)v.o5.detune.setValueAtTime((sn.oct5||0)*100-dc*.7-sc*.3+dr(),time);
    v.u1.detune.setValueAtTime((sn.oct1||0)*100+(sn.cents1||0)-sn.det*30-sc*.2+dr(),time);v.u2.detune.setValueAtTime((sn.oct1||0)*100+(sn.cents1||0)+sn.det*30+sc*.3+dr(),time);
    v.gu1.gain.setValueAtTime(ul,time);v.gu2.gain.setValueAtTime(ul,time);
    const k=ul?.8:1;
    v.g1.gain.setValueAtTime((sn.l1!=null?sn.l1:multi?.45:.7)*k,time);
    if(v.g2)v.g2.gain.setValueAtTime((sn.l2!=null?sn.l2:.45)*k,time);
    if(v.g3)v.g3.gain.setValueAtTime((sn.l3!=null?sn.l3:.45)*k,time);
    if(v.g4)v.g4.gain.setValueAtTime((sn.l4!=null?sn.l4:.35)*k,time);if(v.g5)v.g5.gain.setValueAtTime((sn.l5!=null?sn.l5:.35)*k,time);
    for(const x of[v.o1,v.o5,v.u1,v.u2])if(x)setF(x.frequency,f);
    if(v.o2)setFL(v.o2.frequency,f,1);if(v.o3)setFL(v.o3.frequency,f,.35);if(v.o4)setFL(v.o4.frequency,f,.65);
    if(v.xm){v.xm.gain.setValueAtTime((sn.xm||0)*f*1.5,time);if(v.rl)v.rl.gain.setValueAtTime(sn.ring||0,time);}
    if(v.hp)v.hp.frequency.setValueAtTime(20*Math.pow(2,(sn.hp||0)*5.3),time);
  }else if(v.eng==='vec'){const sc=Math.pow(so,1.3)*60;
    v.vo.forEach(([o],i)=>{if(i===1)setFL(o.frequency,f,1);else setF(o.frequency,f);o.detune.setValueAtTime((i%2?1:-1)*(sn.det*14+sc*(i<2?.5:1))+(i===1?ks:0)+dr(),time);});
  }else if(v.eng==='wt'){
    const sc=Math.pow(so,1.3)*95,m=clamp(sn.wmix||0,0,1),k=acc?1.3:1;
    setF(v.wa.frequency,f);setFL(v.wb.frequency,f,1);setFL(v.wa2.frequency,f,.6);
    v.wa.detune.setValueAtTime(-sn.det*15+dr(),time);v.wb.detune.setValueAtTime(sn.det*15+sc+ks+dr(),time);v.wa2.detune.setValueAtTime(sn.det*30-sc*.5+dr(),time);
    v.ga2.gain.setValueAtTime(sn.det>.05?Math.min(.4,sn.det*.5):0,time);
    if(!gin){const pk=clamp(m+(sn.wenv||0)*k,0,1),tc=.02+(sn.wdec!=null?sn.wdec:.3)*.6;
      v.gb.gain.cancelScheduledValues(time);v.gb.gain.setValueAtTime(pk*.7,time);v.gb.gain.setTargetAtTime(m*.7,time+.003,tc);
      v.ga.gain.cancelScheduledValues(time);v.ga.gain.setValueAtTime((1-pk)*.7,time);v.ga.gain.setTargetAtTime((1-m)*.7,time+.003,tc);}
  }else if(v.eng==='add'){
    const M=MODES[sn.mtype]||MODES.string,R=M.r,A=sn.mtype==='harmonic'&&sn.hA?sn.hA:M.a,tl=.3+(sn.bright!=null?sn.bright:.5)*.9,inh=sn.inh||0,sc=Math.pow(so,1.3)*40;
    let sum=0;const am=A.map((a,i)=>{const x=a*Math.pow(tl,i);sum+=x;return x;});
    const tau=.05+Math.pow(sn.mdec!=null?sn.mdec:.5,2)*3,dmp=sn.damp!=null?sn.damp:.5,sus=sn.msus||0,k=acc?1.3:1;
    v.parts.forEach(([o,g],i)=>{const r=R[i]*Math.pow(R[i],inh*.04);
      if(i===1)setFL(o.frequency,f*r,1);else if(i===3)setFL(o.frequency,f*r,.6);else setF(o.frequency,f*r);
      o.detune.setValueAtTime((i%2?sc:-sc*.6)+(i===1?ks:0)+dr(),time);
      if(!gin){const a=am[i]/Math.max(.01,sum)*.9*k;g.gain.cancelScheduledValues(time);g.gain.setValueAtTime(a,time);g.gain.setTargetAtTime(a*sus,time+.003,Math.max(.01,tau/(1+i*dmp*1.5)));}});
    if(v.gnz&&!gin){const ng=v.gnz.gain;ng.cancelScheduledValues(time);ng.setValueAtTime((sn.noise||0)*.7*k,time);ng.setTargetAtTime(0,time+.002,.005+(sn.noiseC!=null?sn.noiseC:.5)*.012);}
  }else if(v.eng==='wc'){
    /* the fold opens on every hit and closes again (the Buchla bongo); FM index has its own envelope */
    const r1=sn.r1||1,two=sn.det>.05||so>.05,fb=.2+(sn.fold||0)*.75;
    const two2=two||ms>0||ks!==0;
    setF(v.c1.frequency,f);setFL(v.c2.frequency,f,1);setF(v.m1.frequency,f*r1);
    v.c1.detune.setValueAtTime(-sn.det*12+dr(),time);v.c2.detune.setValueAtTime(sn.det*12+Math.pow(so,1.3)*80+ks+dr(),time);
    v.gc1.gain.setValueAtTime(two2?.5:1,time);v.gc2.gain.setValueAtTime(two2?.5:0,time);
    if(!gin){const k=acc?1.3:1,gm=v.gm1.gain,fp=v.fpre.gain;
      gm.cancelScheduledValues(time);gm.setValueAtTime((sn.i1||0)*f*r1*k,time);gm.setTargetAtTime((sn.i1s||0)*f*r1,time+.002,Math.max(.01,sn.d1||.15));
      fp.cancelScheduledValues(time);fp.setValueAtTime(Math.min(1,fb+(sn.fenv||0)*.6*k),time);fp.setTargetAtTime(fb,time+.002,.02+(sn.fdec!=null?sn.fdec:.2)*.5);}
    if(v.lfoF)v.lfoF.gain.setValueAtTime((sn.lfo||0)*.35,time);
  }else{
    const r1=sn.r1||1,r2=sn.r2||1,rc=sn.rc||1,two=sn.det>.05||so>.05||ms>0||ks!==0;
    setF(v.c1.frequency,f*rc);setFL(v.c2.frequency,f*rc,1);setF(v.m1.frequency,f*r1);setF(v.m2.frequency,f*r2);
    v.c1.detune.setValueAtTime(-sn.det*12+dr(),time);v.c2.detune.setValueAtTime(sn.det*12+Math.pow(so,1.3)*70+dr()+ks,time);v.m1.detune.setValueAtTime(Math.pow(so,1.3)*35,time);
    v.gc1.gain.setValueAtTime(two?.5:.75,time);v.gc2.gain.setValueAtTime(two?.5:0,time);
    if(!gin){const k=acc?1.3:1,env=(g,i,is,d,fr)=>{g.gain.cancelScheduledValues(time);g.gain.setValueAtTime(i*fr*k,time);g.gain.setTargetAtTime(is*fr,time+.002,Math.max(.01,d));};
      env(v.gm1,sn.i1||0,sn.i1s||0,sn.d1||.2,f*r1);env(v.gm2,sn.i2||0,sn.i2s||0,sn.d2||.1,f*r2);}
  }
  v.gs.gain.setValueAtTime((sn.sub||0)*.55,time);setF(v.so.frequency,f/2);
  if(v.gnz&&v.eng!=='add')v.gnz.gain.setValueAtTime((sn.noise||0)*.3,time);
  if(v.ds&&v.dist!==sn.dist&&sn.dist>0){const F2=fuzz(sn.dist);v.ds.curve=F2.c;v.dg.gain.setValueAtTime(F2.g,time);v.dist=sn.dist;}
  if(v.ls)v.ls.gain.setValueAtTime(-(sn.lowcut||0)*10,time);
  if(v.vibG&&!gin){const g=v.vibG.gain;g.cancelScheduledValues(time);g.setValueAtTime(0,time);g.setTargetAtTime((sn.vib||0)*28,time+.22,.25);}
  if(v.cr){const P=v.cr.parameters,l=sn.lofi||0;P.get('bits').setValueAtTime(16-l*12,time);P.get('down').setValueAtTime(1+l*l*10,time);}
  if(v.fs){const P=v.fs.parameters,x=sn.fsh||0;P.get('shift').setValueAtTime(Math.sign(x)*x*x*300,time);P.get('mix').setValueAtTime(x?.5:0,time);}if(v.lfo)v.lfo.frequency.setValueAtTime(sn.lfoR||1.5,time);
  /* S&H (ARP 2600): a new random filter setting on every note, like sample and hold clocked by the sequencer */
  const base=60*Math.pow(2,sn.cut*7.5)*(sn.sh>0&&!gin?Math.pow(2,(rnd()-.5)*sn.sh*3.5):1);
  if(v.lad){const P=v.lad.parameters;P.get('res').setValueAtTime(Math.min(.97,sn.res*1.05),time);P.get('poles').setValueAtTime(sn.slope===12?2:4,time);P.get('drive').setValueAtTime(1+sn.drive*3,time);}
  else{const Q=.7+sn.res*(sn.slope===24?14:20);v.f1.Q.setValueAtTime(Q,time);if(v.bg)v.bg.gain.setValueAtTime(1.8*Math.sqrt(Q),time);}
  if(v.lfoG)v.lfoG.gain.setValueAtTime((sn.lfo||0)*base*.7,time);
  if(!gin){
    const pk=Math.min(16000,base*(1+sn.env*10*(acc?1.7:1))),tc=.03+sn.dec*.4*(acc?.6:1);
    /* Filter swell (CS-80, Xpander brass): the filter opens over fatk seconds before it falls back */
    if(sn.fatk>0)for(const p of v.cutP){p.cancelScheduledValues(time);p.setValueAtTime(base,time);p.linearRampToValueAtTime(pk,time+sn.fatk);p.setTargetAtTime(base,time+sn.fatk,tc);}
    else for(const p of v.cutP){p.cancelScheduledValues(time);p.setValueAtTime(pk,time);p.setTargetAtTime(base,time+.002,tc);}
    if(v.trG){const T=TRT[sn.trT]||TRT.chiff,g=v.trG.gain,pk2=sn.tr*T.pk*o.lvl*(sn.g||1)*2.2;v.trF.type=T.t;v.trF.frequency.setValueAtTime(T.f,time);v.trF.Q.setValueAtTime(T.q,time);
      g.cancelScheduledValues(time);g.setValueAtTime(0,time);g.linearRampToValueAtTime(pk2,time+T.a);g.setTargetAtTime(0,time+T.a,T.d);}
    const g=v.vca.gain,peak=o.lvl*(acc?1.55:1)*(sn.g||1),at=sn.atk||0;g.cancelScheduledValues(time);g.setTargetAtTime(peak,time,Math.max(.002,at/3));
    if(sn.amp>0)g.setTargetAtTime(peak*(1-sn.amp*.85),time+.012+at,.05+(sn.adec!=null?sn.adec:sn.dec)*.35);
  }
  v.on=true;
}

const rnd=Math.random;

const MODES={string:{r:[1,2,3,4,5,6],a:[1,.5,.33,.25,.2,.17]},mallet:{r:[1,3.99,9.14,2,6.3,13.1],a:[1,.35,.12,.15,.08,.04]},
  bell:{r:[1,2.76,5.4,8.93,1.5,4.07],a:[1,.6,.4,.22,.3,.2]},glass:{r:[1,2.32,4.25,6.63,9.38,12.1],a:[1,.5,.35,.25,.15,.1]},harmonic:{r:[1,2,3,4,5,6],a:[1,.6,.4,.3,.2,.15]}};

const TRT={chiff:{t:'bandpass',f:3000,q:2,pk:.5,a:.002,d:.015},bow:{t:'bandpass',f:1400,q:1.5,pk:.35,a:.04,d:.06},breath:{t:'highpass',f:5000,q:.7,pk:.25,a:.08,d:.15},mallet:{t:'bandpass',f:2400,q:4,pk:.9,a:.001,d:.006}};

const BASS_LVL=.5;

const mtof=m=>440*Math.pow(2,(m-69)/12);

const bassB=r=>36+r-(r>=5?12:0);

function voiceOff(v,sn,time){v.vca.gain.setTargetAtTime(0,time,.012+(sn.rel||0)/3);}

function loadLadder(c){
  if(c._ladP)return c._ladP;
  if(!c.audioWorklet||window.NB_NO_LADDER)return c._ladP=Promise.resolve(false);
  if(!LADDER_URL)try{LADDER_URL=URL.createObjectURL(new Blob([LADDER_SRC],{type:'text/javascript'}));}catch(e){}
  const add=u=>c.audioWorklet.addModule(u);
  return c._ladP=(LADDER_URL?add(LADDER_URL):Promise.reject()).catch(()=>add('data:text/javascript;base64,'+btoa(LADDER_SRC))).then(()=>{c._lad=true;return true;},()=>false);
}

let LADDER_URL=null;

const LADDER_SRC=`class L extends AudioWorkletProcessor{
static get parameterDescriptors(){return[{name:'cutoff',defaultValue:1000,minValue:10,maxValue:22000},{name:'res',defaultValue:0,minValue:0,maxValue:1,automationRate:'k-rate'},{name:'drive',defaultValue:1,minValue:.1,maxValue:8,automationRate:'k-rate'},{name:'poles',defaultValue:4,minValue:2,maxValue:4,automationRate:'k-rate'}];}
constructor(){super();this.s=new Float64Array(4);this.disposed=false;this.port.onmessage=e=>{if(e.data?.type==='dispose')this.disposed=true;};}
process(I,O,P){if(this.disposed)return false;const o=O[0]&&O[0][0];if(!o)return true;const x=I[0]&&I[0][0],n=o.length,c=P.cutoff,k=P.res[0]*3.9,dr=P.drive[0],two=P.poles[0]<3,s=this.s,sr=sampleRate,comp=(1+k*.35)/Math.max(1,dr*.6);
let fc=-1,G=0,G2=0,G3=0,G4=0,b=0;
for(let i=0;i<n;i++){const f=Math.min(c.length>1?c[i]:c[0],sr*.45);if(f!==fc){fc=f;const g=Math.tan(Math.PI*f/sr);G=g/(1+g);b=1/(1+g);G2=G*G;G3=G2*G;G4=G3*G;}
const xin=x?x[i]*dr:0,S=b*(G3*s[0]+G2*s[1]+G*s[2]+s[3]),y4=(G4*xin+S)/(1+k*G4);let u=Math.tanh(xin-k*y4),y=0,y2=0;
for(let j=0;j<4;j++){const v=(u-s[j])*G;y=v+s[j];s[j]=y+v;u=y;if(j===1)y2=y;}
o[i]=(two?y2:y)*comp;}
return true;}}
registerProcessor('nb-ladder',L);
class FS extends AudioWorkletProcessor{static get parameterDescriptors(){return[{name:'shift',defaultValue:0,minValue:-3000,maxValue:3000,automationRate:'k-rate'},{name:'mix',defaultValue:.5,minValue:0,maxValue:1,automationRate:'k-rate'}];}
constructor(){super();this.ca=[.6923878,.9360654322959,.988229522686,.9987488452737].map(x=>x*x);this.cb=[.4021921162426,.856171088242,.9722909545651,.9952884791278].map(x=>x*x);
this.sa=new Float64Array(16);this.sb=new Float64Array(16);this.ph=0;this.pb=0;}
process(I,O,P){const x=I[0]&&I[0][0],o=O[0][0];if(!x){o.fill(0);return true;}const w=2*Math.PI*P.shift[0]/sampleRate,mx=P.mix[0],A=this.sa,B=this.sb,ca=this.ca,cb=this.cb;
for(let i=0;i<o.length;i++){let ya=x[i],yb=x[i];
for(let k=0;k<4;k++){const j=k*4;let y=ca[k]*(ya+A[j+3])-A[j+1];A[j+1]=A[j];A[j]=ya;A[j+3]=A[j+2];A[j+2]=y;ya=y;
y=cb[k]*(yb+B[j+3])-B[j+1];B[j+1]=B[j];B[j]=yb;B[j+3]=B[j+2];B[j+2]=y;yb=y;}
const ybd=this.pb;this.pb=yb;const sh=ya*Math.cos(this.ph)-ybd*Math.sin(this.ph);this.ph+=w;if(this.ph>6.283185307)this.ph-=6.283185307;else if(this.ph<0)this.ph+=6.283185307;
o[i]=x[i]*(1-mx)+sh*mx;}return true;}}
registerProcessor('nb-fshift',FS);
class CR extends AudioWorkletProcessor{static get parameterDescriptors(){return[{name:'bits',defaultValue:16,minValue:2,maxValue:16,automationRate:'k-rate'},{name:'down',defaultValue:1,minValue:1,maxValue:40,automationRate:'k-rate'}];}
constructor(){super();this.ph=0;this.h=0;}
process(I,O,P){const x=I[0]&&I[0][0],o=O[0][0];if(!x){o.fill(0);return true;}const L=Math.pow(2,P.bits[0]-1),d=P.down[0];
for(let i=0;i<o.length;i++){this.ph+=1;if(this.ph>=d){this.ph-=d;this.h=Math.round(x[i]*L)/L;}o[i]=this.h;}return true;}}
registerProcessor('nb-crush',CR);`;

const FAMS={mini:'Minimoog',modular:'Moog Modular',source:'Moog Source',arp:'ARP 2600',sh101:'SH-101 / Atlantis',ms20:'MS-20 / DAF',buchla:'Buchla',serge:'Serge',rings:'Rings / Harmonic',wtab:'Wavetable (Piston Honda / PPG)',vec:'Prophet VS / Wavestation',emu:'Emulator II / SQ-80 (8-bit)',cz:'Casio CZ',d50:'Roland D-50',cs80:'CS-80 / Xpander',lyra:'Lyra-8 drone',euro:'Eurorack',nord:'Nord Lead',fm:'FM',jup8:'Jupiter-8',p5:'Prophet-5',odyssey:'ARP Odyssey',bit99:'Bit 99',tb303:'TB-303',mbrute:'MatrixBrute',sub37:'Moog Subsequent 37',ssaw:'Supersaw',prodigy:'Moog Prodigy',rogue:'Moog Rogue',taurus:'Moog Taurus',memory:'Memorymoog',voyager:'Minimoog Voyager',phatty:'Moog Little / Sub Phatty',grandma:'Moog Grandmother',matriarch:'Moog Matriarch',moogone:'Moog One',muse:'Moog Muse',m32:'Moog Mother-32'};

for(const [family,engine,source] of POWER303_SOURCES)for(const [label,profile] of POWER303_TONE_PROFILES){
 const shape={...source,...profile,p303:{...profile.p303}};
 // Each family/profile has its own timbre relationship, not a renamed knob seed.
 if(label==='Bubble'&&engine==='an'&&family!=='tb303')shape.w1=source.w1==='sync'?'sync':'pulse';
 if(label==='Suction'&&source.w1==='sync')shape.syncR=(source.syncR||2)+.75;
 if(label==='Vowel'&&engine==='wt'){shape.wa=5;shape.wb=8;shape.wmix=.7;}
 if(label==='Suction'&&engine==='fm'){shape.r1=3;shape.i1=3.2;shape.i1s=.06;}
 if(label==='Bubble'&&engine==='wc'){shape.fold=.18;shape.i1=.45;shape.fenv=.6;}
 if(label==='Liquid'&&engine==='add'){shape.mdec=.46;shape.msus=.6;}
 POWER303_BANK.push({id:String(POWER303_BANK.length),name:(FAMS[family]||family).split(' / ')[0]+' · '+label,family,engine,shape});
}

// New adapter. Owns its Web Audio voices; no song sequencer or sample assets required.
const STARTERS={
 'acid-303':['303 / acid',['w303','acid','tb303']],
 'moog':['Moog / deep',['mini','taurus','moogsub','sourcebass','prodigy','rogue','voyager','phatty','m32','sub37']],
 'industrial':['DAF / EBM',['daf','ebm','indu','dafsour','plank','msgrowl','garden','dafclean','eurogrowl']],
 'sub':['Sub / round',['sub','rund','soft','organbass']],
 'reese':['Reese / pluck',['reese','pluck','nordpluck','sh101bass']],
 'fm':['FM',['lately','latelyx','fmslap','fmsour','dxpluck']],
 'modular':['Modular / west coast',['modvbass','srcbass','wcbass','sergebass','arpbass']],
 'digital':['Digital / harmonic',['wtbass','emubass','czbass','ringsbass','cs80bass','bitbass','odybass','jupbass','p5bass']]
};
function catalog(){const out=[];for(const [category,[group,ids]]of Object.entries(STARTERS))for(const id of ids){const p=BASS_PRESETS[id];if(p&&!p.smp)out.push({id,name:p.n,category,group,engine:ENG(p)});}for(const p of POWER303_BANK)out.push({id:'p303:'+p.id,name:p.name,category:'liquid-acid',group:'Liquid / dual-layer acid',engine:p.engine,family:p.family});return out;}
function patch(id,seed=30301,variation=.2){if(id.startsWith('p303:')){const n=Number(id.slice(5));if(!Number.isInteger(n)||n<0||n>=POWER303_BANK.length)throw Error('Unknown acid patch');return power303Patch(n,seed,variation);}const p=BASS_PRESETS[id];if(!p||p.smp)throw Error('Unknown synthesised bass patch');return structuredClone(presetSnd(id));}
function create(context,destination=context.destination,{id='bass',preset='mini',bpm=120,root=0,initialPatch=null}={}){
 if(!context?.createGain)throw Error('A Web Audio context is required');
 const bus=context.createGain();bus.gain.value=1;bus.connect(destination);
 const E={c:context,bus:{[id]:bus},voices:{},powerRetired:[],retired:new Set()};let currentId=preset,snd=initialPatch?structuredClone(initialPatch):patch(preset),disposed=false;const host={bpm,root};
 const inHost=fn=>{const previous=S;S=host;try{return fn();}finally{S=previous;}};
 function releaseAll(at=context.currentTime){for(const v of Object.values(E.voices)){if(v.channels){for(const ch of v.channels)voiceOff(ch.voice,snd,at);for(const b of v.body)b.g.gain.setTargetAtTime(0,at,.02);}else voiceOff(v,snd,at);v.on=false;}}
 function dispose(){if(disposed)return;releaseAll();for(const v of E.retired)audioDisposeObject(v);E.retired.clear();for(const v of Object.values(E.voices))audioDisposeObject(v);for(const v of E.powerRetired)audioDisposeObject(v);bus.disconnect();E.voices={};E.powerRetired=[];disposed=true;}
 return {
  ready:()=>loadLadder(context),
  select(next,seed=30301,variation=.2){if(disposed)throw Error('Bass engine disposed');const p=patch(next,seed,variation);releaseAll();for(const v of Object.values(E.voices))audioDisposeObject(v);for(const v of E.powerRetired)audioDisposeObject(v);E.voices={};E.powerRetired=[];currentId=next;snd=p;return structuredClone(snd);},
  getPatch:()=>structuredClone(snd),
  replace(values){if(disposed)throw Error('Bass engine disposed');releaseAll();for(const v of Object.values(E.voices))audioDisposeObject(v);E.voices={};snd=structuredClone(values);return structuredClone(snd);},
  set(values){if(disposed)throw Error('Bass engine disposed');for(const [key,value]of Object.entries(values)){if(key==='p303')snd.p303={...snd.p303,...value};else snd[key]=value;}},
  setHost({bpm,root}={}){if(Number.isFinite(bpm)&&bpm>0)host.bpm=bpm;if(Number.isFinite(root))host.root=root;},
  play({midi=36,time=context.currentTime+.01,duration=.25,velocity=100,accent=false,slideIn=false,slideOut=false,wheel=0}={}){
   if(disposed)throw Error('Bass engine disposed');if(![midi,time,duration,velocity].every(Number.isFinite)||midi<0||midi>127||duration<=0)throw Error('Invalid bass note');if(velocity<=0)return;
   return inHost(()=>{const level=clamp(velocity/127,0,1),sn={...snd,g:(snd.g||1)*level},t={id,snd:sn},f=mtof(midi);if(currentId.startsWith('p303:')){power303NoteBeforeAcid(E,t,time,f,duration,accent,slideIn?1:0,slideOut,wheel);return;}
    const sig=voiceSig(sn,context,false);let v=E.voices[id];if(!v||v.sig!==sig){if(v){const old=v;E.retired.add(old);for(const gain of [old.vca?.gain,old.trG?.gain])if(gain){if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(time);else gain.cancelScheduledValues(time);gain.setTargetAtTime(0,time,.004);}old.oscs[0]?.addEventListener('ended',()=>{audioDisposeObject(old);E.retired.delete(old);},{once:true});for(const osc of old.oscs)try{osc.stop(time+.04);}catch{}}v=buildVoice(context,sn,bus,false);v.sig=sig;v.oscs.forEach(o=>o.start(Math.max(context.currentTime,time-.003)));E.voices[id]=v;}
    voiceOn(v,wheelCut(sn,wheel),time,f,{acc:accent,gin:slideIn&&v.on?1:0,lvl:.55*BASS_LVL,ref:mtof(bassB(host.root))});if(!slideOut)voiceOff(v,sn,time+Math.max(.03,duration*.88));
   });
  },noteOff:releaseAll,dispose
 };
}
const api={catalog,patch,create,acidMacros:{...POWER303_MACROS},source:{url:'https://norwegian-beats-creative-krogh.glossyrobin6.chatgpt.site',siteVersion:42},_verification:{ladderSource:LADDER_SRC}};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KroghBass=api;
})(typeof globalThis!=='undefined'?globalThis:this);
