/* Constant per-preset gain after synthesis. No envelope follower or automatic gain pumping. */
(function(root){
'use strict';
const base=root.KroghBass;
function gainFor(id,ladder){const data=root.BassLevelData,bank=ladder?data?.ladder:data?.fallback;return bank?.[id]??data?.fallback?.[id]??1;}
function create(context,destination,options={}){
 if(options.levelCalibration)return base.create(context,destination,options);
 const trim=context.createGain();trim.connect(destination);let id=options.preset||'mini',disposed=false,prepared=false;
 const voice=base.create(context,trim,options),ready=voice.ready.bind(voice),select=voice.select.bind(voice),dispose=voice.dispose.bind(voice);
 const update=()=>{const now=context.currentTime;trim.gain.cancelScheduledValues(now);trim.gain.setValueAtTime(gainFor(id,!!context._lad),now);};update();
 voice.setLevel=gain=>{if(!disposed&&Number.isFinite(gain)&&gain>0){trim.gain.cancelScheduledValues(context.currentTime);if(trim.gain.setTargetAtTime)trim.gain.setTargetAtTime(gain,context.currentTime,.06);else trim.gain.setValueAtTime(gain,context.currentTime);}};
 voice.ready=async()=>{const result=await ready();if(!disposed&&!prepared){update();prepared=true;}return result;};
 voice.select=(next,...rest)=>{const result=select(next,...rest);id=next;prepared=false;update();return result;};
 voice.dispose=()=>{if(disposed)return;disposed=true;dispose();trim.disconnect();};
 return voice;
}
root.BassLevels={gainFor};root.KroghBass={...base,create};
})(typeof globalThis!=='undefined'?globalThis:this);
