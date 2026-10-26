/* Portable note engine. No browser or Ableton dependencies. */
(function(root){
  'use strict';
  const TYPES={maj:[0,4,7],min:[0,3,7],sus2:[0,2,7],sus4:[0,5,7],dim:[0,3,6],aug:[0,4,8],'6':[0,4,7,9],m6:[0,3,7,9],m7b5:[0,3,6,10], '7':[0,4,7,10],m7:[0,3,7,10],maj7:[0,4,7,11]};
  const mod=(a,b)=>(a%b+b)%b;
  const random=(seed,a,b)=>{let x=(seed^Math.imul(a+1,374761393)^Math.imul(b+1,668265263))>>>0;x=Math.imul(x^(x>>>13),1274126177);return ((x^(x>>>16))>>>0)/4294967296;};
  function segmentAt(segments,beat){let lo=0,hi=segments.length-1;while(lo<=hi){const m=(lo+hi)>>1;if(beat<segments[m].start)hi=m-1;else if(beat>=segments[m].end)lo=m+1;else return segments[m];}return null;}
  function nearestChord(pitch,root,quality){const pcs=TYPES[quality]||TYPES.min;let result=pitch,best=Infinity;for(let d=-6;d<=6;d++){const n=pitch+d;if(pcs.includes(mod(n-root,12))&&Math.abs(d)<best){best=Math.abs(d);result=n;}}return result;}
  function passingNote(pitch,root,quality,beat){if(Math.abs(beat-Math.round(beat))<.02)return nearestChord(pitch,root,quality);const scale=['min','m7','m6','m7b5','dim'].includes(quality)?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];for(let d=0;d<=6;d++)for(const sign of [1,-1]){const n=pitch+d*sign;if(scale.includes(mod(n-root,12)))return n;}return pitch;}
  const SPAS={ '3 over 4':[1,4,7,10,13,16,19,22,25,28,31], '5s':[1,6,11,16,21,26,31],late:[1,7,10,13,17,23,26,29],skip:[5,6,14,21,22,30],stutter:[14,15,30,31,6,7],scatter:[1,3,5,6,9,11,13,15,18,19,21,25,27,29,31]};
  // Small musical phrases, expressed as chord degrees rather than fixed major/minor pitches.
  const SIMPLE_PATTERNS=[
    ['ren-sekstendel','Ren arp · 1/16',Array.from({length:16},(_,i)=>[i/4,[0,1,2,3,2,1,0,2][i%8]]),.23],
    ['rolig-puls','Rolig puls',[[0,0],[2,0],[4,0],[6,0]],.5],
    ['luftig-aatte','Luftig åttendel',[[0,0],[.5,0],[2.5,0],[4,0],[4.5,0],[6.5,0]],.25],
    ['offbeat','Offbeat · én tone',[[.5,0],[1.5,0],[2.5,0],[3.5,0],[4.5,0],[5.5,0],[6.5,0],[7.5,0]],.25],
    ['rot-oktav','Rot og oktav',[[0,0],[1.5,3],[3,0],[4,0],[5.5,3],[7,0]],.35],
    ['rot-kvint','Rot og kvint',[[0,0],[1.5,2],[3,0],[4,0],[5.5,2],[7,0]],.4],
    ['tre-opp','Tre toner opp · med pause',[[0,0],[.5,1],[1,2],[4,0],[4.5,1],[5,2]],.3],
    ['tre-bue','Tre toner · opp og tilbake',[[0,0],[.5,1],[1,2],[1.5,1],[4,0],[4.5,1],[5,2],[5.5,1]],.3],
    ['house-luft','House · korte svar',[[0,0],[1.5,0],[2.5,2],[4,0],[5.5,1],[6.5,2]],.25],
    ['progressiv-enkel','Progressiv · liten bevegelse',[[0,0],[1,2],[2.5,1],[4,0],[5,2],[6.5,3]],.5]
  ].map(([id,name,steps,gate])=>({id:'simple-'+id,name,source:'Enkle mønstre',simple:true,root:0,mode:'minor',beats:id==='ren-sekstendel'?4:8,count:steps.length,low:48,high:60,degrees:steps.map(s=>s[1]),notes:steps.map(([beat,degree],i)=>[beat,gate,48+[0,3,7,12][degree],i%3?78:94])}));
  function makeArp(pattern){
    if(!pattern||pattern.simple||pattern.arpReady)return pattern;
    // A MIDI file may be a complete multi-track arrangement. Select ONE non-drum
    // track/channel before deriving a short melodic phrase. Retain source metadata.
    const groups=new Map();
    for(const n of pattern.notes){if(n[5]===9)continue;const key=`${n[4]??0}:${n[5]??0}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n);}
    const score=notes=>{const starts=new Set(notes.map(n=>Math.round(n[0]*8))),median=notes.map(n=>n[2]).sort((a,b)=>a-b)[Math.floor(notes.length/2)];return starts.size/notes.length*2+Math.min(starts.size,32)/32+(median>=48&&median<=84?1:0);};
    const ranked=[...groups.values()].sort((a,b)=>score(b)-score(a)),source=ranked[0]||[];
    if(!source.length)return {...pattern,notes:[],count:0,arpReady:true,sourceCount:pattern.count};
    const start=Math.floor(Math.min(...source.map(n=>n[0]))/4)*4,beats=Math.min(16,Math.max(4,pattern.beats-start)),slots=new Map();
    let stacked=false;for(const n of source){const beat=n[0]-start;if(beat<0||beat>=beats)continue;const slot=Math.round(beat*8);if(!slots.has(slot))slots.set(slot,[]);else stacked=true;slots.get(slot).push(n);}
    const selected=[];let previous=72;
    for(const [slot,notes] of [...slots].sort((a,b)=>a[0]-b[0])){
      // Follow one melodic contour; do not alternate bass, chords and top blips.
      const folded=p=>60+mod(p-60,12);
      const chosen=[...notes].sort((a,b)=>Math.abs(folded(a[2])-previous)-Math.abs(folded(b[2])-previous)||b[3]-a[3])[0];
      previous=folded(chosen[2]);selected.push([slot/8,Math.min(.25,chosen[1]),previous,chosen[3]]);
    }
    return {...pattern,arpReady:true,notes:selected,beats,count:selected.length,low:60,high:71,sourceCount:pattern.count,sourceTracks:groups.size,sourceBeats:pattern.beats,sourceStacked:stacked};
  }
  function simpleVoicing(events,segments,options){
    const base=Math.max(12,Math.min(96,60+(options.transpose||0))),seconds=60/options.bpm,result=[];
    for(const e of events){
      const seg=segmentAt(segments,e.beat);if(options.follow!=='original'&&(!seg||seg.silent))continue;
      const target=options.follow==='bass'?seg?.bass:seg?.root;
      const low=base+(options.follow!=='original'?(target||0):0),high=low+12;
      const adjusted=e.pitch+(e.harmonyRoot!=null&&target!=null?mod(target-e.harmonyRoot+6,12)-6:0);
      let pitch=low+mod(adjusted-low,12);
      if(options.follow!=='original'){
        const pcs=options.follow==='bass'?[0]:TYPES[seg.quality]||TYPES.min;
        const allowed=Array.from({length:13},(_,i)=>low+i).filter(p=>pcs.includes(mod(p-target,12)));
        // Keep an explicit octave jump when it fits inside the chosen register.
        if(mod(adjusted-low,12)===0&&adjusted>low)pitch=high;
        pitch=allowed.reduce((best,p)=>Math.abs(p-pitch)<Math.abs(best-pitch)?p:best,allowed[0]);
      }
      const n={...e,pitch,duration:Math.min(e.duration,4/(options.grid||16)*seconds*(options.gate??78)/100)};
      delete n.glideFrom;
      // A held note may never leak across a different harmony or a marked pause.
      if(options.follow!=='original')for(const next of segments){if(next.start<=e.beat)continue;if(next.silent||next.root!==seg.root||next.quality!==seg.quality||(options.follow==='bass'&&next.bass!==seg.bass)){n.duration=Math.min(n.duration,options.offset+next.start*seconds-e.time);break;}}
      if(n.duration<.006)continue;
      const last=result[result.length-1];
      if(last&&Math.abs(last.time-n.time)<.0001){
        // Select one source voice, rather than squeezing a whole chord into an arp.
        if(n.velocity>last.velocity)result[result.length-1]=n;
        continue;
      }
      if(last)last.duration=Math.min(last.duration,n.time-last.time);
      result.push(n);
    }
    return result;
  }
  function sectionFor(options,beat){const parts=options.parts||[],n=options.partCount||8,total=(options.duration-options.offset)*options.bpm/60;const i=Math.min(n-1,Math.max(0,Math.floor(beat/Math.max(.01,total)*n)));return {index:i,config:parts[i]||{}};}
  function shape(events,segments,options){
    const {bpm,offset,duration,seed=1}=options;const beatDuration=60/bpm,shaped=[];
    const get=(beat)=>sectionFor(options,beat);
    for(let i=0;i<events.length;i++){
      const e=events[i],{index,config:c}=get(e.beat),slot=Math.round(mod(e.beat,4)*4);
      // Air removes the same off-grid positions within a part, protecting downbeats.
      const space=Math.max(c.space||0,(c.spunk||0)*.55);
      if(space>0&&slot!==0&&random(seed+411,index,slot)<space/100*.8)continue;
      let n={...e};
      const length=Math.max(c.length||0,(c.spunk||0)*.7);
      if(length>0&&random(seed+31,index,slot)<length/100){const factor=random(seed+32,index,slot)>.5?1.5:.5;n.duration=Math.max(.025,Math.min(duration-n.time,n.duration*factor));}
      if(c.moves>0&&slot!==0&&random(seed+733,Math.floor(e.beat/16),e.source)<c.moves/100*.45){
        const move=[-2,-1,1,2][Math.floor(random(seed+734,index,e.source)*4)]*.25;
        n.beat=Math.max(Math.floor(e.beat/4)*4,e.beat+move);n.time=offset+n.beat*beatDuration;
        const target=segmentAt(segments,n.beat);if(options.follow!=='original'){if(!target||target.silent)continue;n.pitch=nearestChord(n.pitch,target.root,target.quality);}
      }
      const groups=c.reverse>0&&random(seed+61,index,Math.floor(e.beat/4))<c.reverse/100;
      if(groups){const bar=Math.floor(e.beat/4)*4,old=mod(e.beat,4);n.beat=bar+Math.max(0,4-old-Math.min(n.duration/beatDuration,4-old));n.time=offset+n.beat*beatDuration;const target=segmentAt(segments,n.beat);if(options.follow!=='original'&&target){if(target.silent)continue;n.pitch=nearestChord(n.pitch,target.root,target.quality);}}
      if(c.fxd>0&&random(seed+912,Math.floor(e.beat/8),e.source)<c.fxd/100*.3){n.fx=['crush','echo','ring','wobble','phone'][Math.floor(random(seed+913,index,Math.floor(e.beat))*5)];}
      if(n.time<0||n.time>=duration)continue;
      n.duration=Math.min(n.duration,duration-n.time);
      shaped.push(n);
    }
    const source=events;
    for(let base=0;base<(duration-offset)/beatDuration;base+=8){
      const {index,config:c}=get(base);const mode=c.spasMode||'3 over 4';const types=[['rhythmic',c.rhythmic||0,[3,7,11,15,19,23,27,31]],['spastic',c.spastic||0,SPAS[mode]||SPAS['3 over 4']]];
      for(const [kind,amount,positions] of types){if(amount<=0)continue;for(const slot of positions){const beat=base+slot/4,region=get(beat);if(region.index!==index||random(seed+(kind==='spastic'?200:300),Math.floor(base/8),slot)>amount/100)continue;const at=offset+beat*beatDuration;if(at>=duration||shaped.some(n=>Math.abs(n.beat-beat)<.04))continue;let previous=null;for(const n of source){if(n.beat<=beat)previous=n;else break;}if(!previous)continue;const seg=segmentAt(segments,beat);if(options.follow!=='original'&&(!seg||seg.silent))continue;let pitch=previous.pitch;if(kind==='spastic'&&random(seed+22,Math.floor(base/8),slot)<.25)pitch+=12;if(options.follow==='chord'&&seg)pitch=nearestChord(pitch,seg.root,seg.quality);for(const held of shaped){if(held.pitch===previous.pitch&&held.time<at&&held.time+held.duration>at)held.duration=Math.max(.02,at-held.time);}
        shaped.push({time:at,beat,duration:Math.min(.19,beatDuration*.23,duration-at),pitch:Math.max(0,Math.min(127,pitch)),velocity:Math.round(previous.velocity*.75),source:-1,gesture:kind});}}
      if(c.dust>0&&random(seed+543,index,Math.floor(base/8))<c.dust/100){const start=base+5.25,previous=source.find(n=>n.beat>=base&&n.beat<base+8);if(previous){const path=[[0,4,7],[7,4,0],[0,12,0],[0,3,0]][Math.floor(random(seed+544,index,Math.floor(base/8))*4)];for(let i=0;i<3;i++){const beat=start+i*.25;if(get(beat).index!==index)continue;const at=offset+beat*beatDuration,seg=segmentAt(segments,beat);if(at>=duration||(options.follow!=='original'&&(!seg||seg.silent)))continue;let pitch=previous.pitch+path[i];if(options.follow==='chord'&&seg)pitch=nearestChord(pitch,seg.root,seg.quality);shaped.push({time:at,beat,duration:Math.min(.12,duration-at),pitch:Math.max(0,Math.min(127,pitch)),velocity:Math.round(previous.velocity*.8),source:-1,gesture:'dust'});}}}
      if(c.snote>0&&random(seed+1011,index,Math.floor(base/8))<c.snote/100){const beat=base+3.75,at=offset+beat*beatDuration,seg=segmentAt(segments,beat),previous=source.find(n=>n.beat>=base&&n.beat<base+8);if(previous&&at<duration&&(options.follow==='original'||(seg&&!seg.silent))){let pitch=previous.pitch+[3,7,12,-5][Math.floor(random(seed+1012,index,Math.floor(base/8))*4)];if(options.follow==='chord')pitch=nearestChord(pitch,seg.root,seg.quality);shaped.push({time:at,beat,duration:Math.min(beatDuration*.2,duration-at),pitch:Math.max(0,Math.min(127,pitch)),velocity:Math.round(previous.velocity*.8),source:-1,gesture:'snote'});}}
    }
    shaped.sort((a,b)=>a.time-b.time||a.pitch-b.pitch);
    for(let i=1;i<shaped.length;i++){
      const n=shaped[i],previous=shaped[i-1],{index,config:c}=get(n.beat);if(n.time-previous.time<.02)continue;
      const chance=(key,salt)=>c[key]>0&&random(seed+salt,Math.floor(n.beat/8),n.source+i%17)<c[key]/100*.3;
      if(chance('slup',623)){n.pitch=Math.min(127,n.pitch+12);n.glideFrom=previous.pitch;previous.duration=Math.max(previous.duration,n.time-previous.time+.015);n.gesture='slide-up';}
      else if(chance('spsl',624)){n.pitch=Math.max(0,Math.min(127,n.pitch+[-5,-3,3,5][Math.floor(random(seed+626,index,i)*4)]));if(options.follow==='chord'){const seg=segmentAt(segments,n.beat);if(seg)n.pitch=nearestChord(n.pitch,seg.root,seg.quality);}n.glideFrom=previous.pitch;previous.duration=Math.max(previous.duration,n.time-previous.time+.015);n.gesture='spastic-slide';}
      else if(chance('slide',625)){n.glideFrom=previous.pitch;previous.duration=Math.max(previous.duration,n.time-previous.time+.015);n.gesture='slide';}
      previous.duration=Math.min(previous.duration,duration-previous.time);
    }
    // Final timing pass: all attacks, including gestures, share the requested straight grid.
    const grid=4/(options.grid||16),gate=(options.gate??78)/100;
    for(const n of shaped){n.beat=Math.max(0,Math.round(n.beat/grid)*grid);n.time=offset+n.beat*beatDuration;n.duration=Math.min(duration-n.time,grid*beatDuration*gate,n.duration*gate);}
    shaped.sort((a,b)=>a.time-b.time||a.pitch-b.pitch);
    // A repeated MIDI pitch must release before its next attack on the same channel.
    const clean=[],previousByPitch=new Map();
    for(const n of shaped){if(n.time<0||n.time>=duration||n.duration<=0)continue;const previous=previousByPitch.get(n.pitch);if(previous&&Math.abs(previous.time-n.time)<.0001){previous.velocity=Math.max(previous.velocity,n.velocity);previous.duration=Math.max(previous.duration,n.duration);continue;}if(previous&&previous.time+previous.duration>n.time)previous.duration=Math.max(.001,n.time-previous.time);previousByPitch.set(n.pitch,n);clean.push(n);}
    return simpleVoicing(clean,segments,options);
  }
  function generate(pattern,segments,options){
    pattern=makeArp(pattern);
    const {bpm,offset,duration,seed=1,variation=0,density=100,swing=0,transpose=0,follow='chord',style='faithful'}=options;
    if(!pattern||!pattern.notes.length||!bpm||pattern.beats<=0)return [];
    const length=Math.max(0,(duration-offset)*bpm/60),events=[];
    const direction=options.direction||'original',pitchMap=pattern.notes.map(n=>n[2]);
    if(direction!=='original'){
      const bars=new Map();pattern.notes.forEach((n,i)=>{const bar=Math.floor(n[0]/4);if(!bars.has(bar))bars.set(bar,[]);bars.get(bar).push(i);});
      for(const ids of bars.values()){const pitches=ids.map(i=>pattern.notes[i][2]).sort((a,b)=>a-b);if(direction==='down')pitches.reverse();if(direction==='updown'){const path=[];for(let j=0;j<ids.length;j++){const x=ids.length<2?0:j/(ids.length-1);path.push(pitches[Math.min(pitches.length-1,Math.round((1-Math.abs(2*x-1))*(pitches.length-1)))]);}ids.forEach((i,j)=>pitchMap[i]=path[j]);}else ids.forEach((i,j)=>pitchMap[i]=pitches[j]);}
    }
    const cycles=Math.ceil(length/pattern.beats),v=variation/100;
    for(let cycle=0;cycle<cycles;cycle++){
      const phrase=Math.floor(cycle*pattern.beats/32);
      const phraseShift=style==='progressive'&&random(seed,phrase,771)<v*.35?12:0;
      for(let i=0;i<pattern.notes.length;i++){
        const original=pattern.notes[i];let [start,dur,pitch,velocity]=original;
        pitch=pitchMap[i];
        if(start>=pattern.beats)continue;
        const beat=cycle*pattern.beats+start;
        if(beat>=length)continue;
        if(density<100&&mod(beat,4)>.02&&random(seed+125,Math.floor(beat/32),i)>density/100)continue;
        if(style!=='faithful'&&v>0&&random(seed+24,cycle,i)<v*.10)continue;
        const seg=segmentAt(segments,beat);
        if(follow!=='original'&&(!seg||seg.silent))continue;
        if(follow!=='original'){
          const target=follow==='bass'?seg.bass:seg.root;
          let delta=mod(target-pattern.root+6,12)-6;
          pitch+=delta;
          if(follow==='chord')pitch=passingNote(pitch,seg.root,seg.quality,beat);
          if(pattern.degrees){const degree=pattern.degrees[pattern.notes.findIndex(n=>n[2]===pitchMap[i])],triad=TYPES[seg.quality]||TYPES.min;pitch=60+target+(follow==='bass'?0:triad[degree%3])+Math.floor(degree/3)*12;}
        }
        pitch+=transpose+phraseShift;
        if(style==='evolve'&&random(seed+17,cycle,i)<v*.12)pitch+=random(seed+3,cycle,i)>.5?12:-12;
        // Swing is additional to, rather than a replacement for, source microtiming.
        const offbeat=mod(start,1)>=.49&&mod(start,1)<.76;
        const shift=offbeat?swing/100*.22:0;
        const time=offset+(beat+shift)*60/bpm;
        let noteDuration=Math.max(.006,Math.min(dur,4/(options.grid||16))*60/bpm);
        noteDuration=Math.min(noteDuration,duration-time);
        if(time<0||time>=duration||noteDuration<=0)continue;
        velocity=Math.max(1,Math.min(127,Math.round(velocity*(1+(random(seed+88,cycle,i)-.5)*v*.35))));
        events.push({time,duration:noteDuration,pitch:Math.max(0,Math.min(127,Math.round(pitch))),velocity,beat:beat+shift,source:i,harmonyRoot:follow==='original'?null:follow==='bass'?seg.bass:seg.root});
        if(events.length>120000)throw Error('This pattern produces too many notes. Choose a shorter range.');
      }
    }
    events.sort((a,b)=>a.time-b.time||a.pitch-b.pitch);
    return shape(events,segments,options);
  }
  function vlq(n){n=Math.max(0,Math.round(n));let a=[n&127];while((n>>=7)>0)a.unshift((n&127)|128);return a;}
  const bytes=(n,k)=>Array.from({length:k},(_,i)=>(n>>>(8*(k-i-1)))&255);
  function midi(events,bpm){
    const ppq=480,tempo=Math.round(60000000/bpm),list=[];
    for(const n of events){list.push({tick:Math.round(n.time*bpm/60*ppq),off:false,n});list.push({tick:Math.round((n.time+n.duration)*bpm/60*ppq),off:true,n});}
    list.sort((a,b)=>a.tick-b.tick||(a.off?-1:1));
    const data=[0,255,81,3,...bytes(tempo,3),0,255,88,4,4,2,24,8];let prev=0;
    for(const e of list){data.push(...vlq(e.tick-prev),e.off?128:144,e.n.pitch,e.off?0:e.n.velocity);prev=e.tick;}
    data.push(0,255,47,0);
    return new Uint8Array([77,84,104,100,0,0,0,6,0,0,0,1,...bytes(ppq,2),77,84,114,107,...bytes(data.length,4),...data]);
  }
  const API={TYPES,SPAS,SIMPLE_PATTERNS,makeArp,arpeggiate:simpleVoicing,generate,midi,segmentAt,random,mod,sectionFor};
  if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.NoteEngine=API;
})(typeof globalThis!=='undefined'?globalThis:this);
