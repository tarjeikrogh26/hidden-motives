/* Each factory entry owns one sound, a stable original riff seed and tempo. */
(function(root){'use strict';const genreOrder=['ebm','edm','house','disco','funk','motor','hiphop','acid'];let cache=null;
function entries(catalog){if(cache)return cache;let sampleIndex=0;const out=catalog.map((p,i)=>{let genre=p.genre;if(p.id.startsWith('sample:')){const n=sampleIndex++;genre=n<34?'house':n<67?'funk':n<84?'hiphop':'disco';}if(!genreOrder.includes(genre))throw Error('Missing factory genre: '+p.id);const [lo,hi]=BassPatterns.tempoRange(genre),seed=810001+i*7919;return{id:'factory6:'+p.id,name:p.name,genre,sound:p.id,seed,bpm:lo+(i*7)%(hi-lo+1),bars:i%3===0?16:8};});out.sort((a,b)=>genreOrder.indexOf(a.genre)-genreOrder.indexOf(b.genre));cache=out;return out;}
root.BassFactory={entries};
})(typeof globalThis!=='undefined'?globalThis:this);
