"""Extract the Bass Invaders v0.10.8 sound host (state defaults, loadPreset, applySound, makeGraph) verbatim
from source/dist/app.js into src/vendor/bass-invaders/bass-host.js.
Usage: python3 tools/extract-bass-host.py path/to/source/dist/app.js src/vendor/bass-invaders/bass-host.js"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jsextract import function, statement

src, dst = sys.argv[1], sys.argv[2]
js = open(src, encoding='utf-8').read()
parts = [statement(js, 'const phraseSpec='), statement(js, 'const soundSpec='), statement(js, 'let state={')]
funcs = [function(js, n) for n in ['loadPreset', 'applySound', 'makeGraph']]
out = """/* Bass Invaders v0.10.8 by Tarjei Krogh: the app's sound host, copied verbatim from source/dist/app.js
   by tools/extract-bass-host.py (phraseSpec, soundSpec, initial state, loadPreset, applySound, makeGraph).
   Only the small wrapper at the end is new. bass-balance.js calls makeGraph/applySound as globals. */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),window=root;
let engine=null,audioGraph=null,ctx=null;
""" + '\n'.join(parts) + """
// Same start-up defaults as the app's slider loops.
for(const [k,,v] of phraseSpec)state.knobs[k]=v;
for(const list of Object.values(soundSpec))for(const [k,,v] of list)state.sound[k]=v;
for(let i=0;i<3;i++)state.osc[i]={wave:i===0?'sq':i===1?'saw':'off',level:i===0?65:i===1?40:0,tune:50,detune:50};
""" + '\n'.join(funcs) + """
const initial=structuredClone(state);
// Full app settings for one factory sound, exactly as choosing it in Bass Invaders would set them.
function settingsFor(id,{bpm=120,root:key=0,octave=36}={}){state=structuredClone(initial);loadPreset(id);Object.assign(state,{bpm,root:key,octave});return structuredClone(state);}
root.makeGraph=makeGraph;root.applySound=applySound;
root.BassInvadersHost={settingsFor,makeGraph,applySound,phraseKnobs:()=>({...initial.knobs})};
})(typeof globalThis!=='undefined'?globalThis:this);
"""
open(dst, 'w', encoding='utf-8').write(out)
print('wrote', dst, len(out), 'bytes')
