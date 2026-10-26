"""Extract the DELAYSY v0.6.3 audio engine verbatim from DELAYSY-v0.6.3.html into src/vendor/delaysy-engine.js.
Usage: python3 -I tools/extract-delaysy.py path/to/DELAYSY-v0.6.3.html src/vendor/delaysy-engine.js
Functions and data are copied character for character. Only the host wrapper at the bottom is new."""
import re, sys

src, dst = sys.argv[1], sys.argv[2]
html = open(src, encoding='utf-8').read()
js = html[html.index("<script>\n(()=>{'use strict';"):]

import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jsextract import function as _function, statement as _statement
function = lambda name: _function(js, name)
statement = lambda prefix: _statement(js, prefix)

static_parts = [
    statement('const defaults='),
    "let p={...defaults};const base={...defaults};function preset(name,cat,desc,changes){return {name,cat,desc,p:{...base,...changes}}}",
    statement('const presets='),
    statement('const rhythmNames='),
    statement('const rhythms='),
    statement('const toneDefs='),
    "const toneKeys=toneDefs.map(d=>d[0]);",
    statement('const toneRecipes='),
    statement('const creativeDefs='),
    statement('const tapPatterns='),
]
pure = ['randomSound', 'englishDescription', 'toneSettings', 'toneSample', 'toneGrain', 'toneProcess', 'randomTone', 'randomCreative',
        'creativeApplies', 'creativeProcess', 'tapSemitones', 'biquad', 'weightedEnergy', 'matchedGain', 'matchLevel', 'processSamples',
        'offsets', 'duration', 'position', 'repeatComp']
bound = ['toneBuffer', 'creativeBuffer', 'colored', 'routes', 'reversed', 'renderVoice', 'scheduleSpatial', 'note', 'initGraph', 'update']
for k in static_parts[2:3]:
    assert k.startswith('const presets=[') and k.endswith('))));'), 'presets statement shape changed'
body_static = '\n'.join(static_parts) + '\n' + '\n'.join(function(n) for n in pure) + '\nfor(const v of presets)v.desc=englishDescription(v);\n'
body_bound = '\n'.join(function(n) for n in bound)

out = f"""/* DELAYSY v0.6.3 — 3D delay by Tarjei Krogh. Audio engine and 777 factory presets extracted verbatim
   from DELAYSY-v0.6.3.html by tools/extract-delaysy.py. Only the host wrapper at the end is new: it binds
   one AudioContext (also an OfflineAudioContext), one preset and a BPM instead of the page's DOM. */
(function(root){{'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
{body_static}
function create(ctx,settings,{{bpm=120,destination=ctx.destination,dryLevel=1}}={{}}){{
 let p={{...defaults,...settings}},bypass=false,fileBuffer=null,fileBpm=120,previousTone=null;
 let master,dry,wet,fx,flDelay,flGain,lfo,lfoGain,output,monoGain,merge,autoGain,referenceAnalyser,mixAnalyser;
 const roomBuses=[],active=new Set(),spatial=new Set(),ids=new WeakMap(),toneMeta=new WeakMap(),toneCache=new Map(),effectCache=new Map(),reverseCache=new Map(),creativeCache=new Map();
 let idNext=0,toneCacheSamples=0,creativeSamples=0,audioPump=null;
 const tempo=()=>clamp(bpm,50,200),pumpAudio=()=>{{}},setInterval=()=>null,$=()=>({{value:1}});
 // Host: offline rendering has no look-ahead queue, every echo is built immediately.
 function voice(b,t,isDry,rate,bend,det,amp,sp=null,cutoff=6000,send=0){{renderVoice({{b,t,isDry,rate,bend,det,amp,sp,cutoff,send,settings:{{...p}}}});}}
{body_bound}
 initGraph();output.disconnect(ctx.destination);output.connect(destination);dry.gain.value=0;
 return {{
  note:(buffer,time)=>note(buffer,time),
  // DELAYSY's own dry/wet law; the host can turn the original down to hear only the echoes.
  settle(){{dry.gain.cancelScheduledValues(0);wet.gain.cancelScheduledValues(0);dry.gain.value=Math.cos(p.mix*Math.PI/2)*dryLevel;wet.gain.value=Math.sin(p.mix*Math.PI/2)*.68*repeatComp(p);master.gain.cancelScheduledValues(0);master.gain.value=1;flGain.gain.value=p.flange*.45;lfoGain.gain.value=p.flange*.002;}},
  settings:()=>({{...p}})
 }};
}}
const api={{create,presets,defaults,rhythmNames,randomSound,englishDescription,weightedEnergy}};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Delaysy=api;
}})(typeof globalThis!=='undefined'?globalThis:this);
"""
open(dst, 'w', encoding='utf-8').write(out)
print('wrote', dst, len(out), 'bytes')
