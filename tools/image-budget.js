import {canvas, toBlob, sleep} from './ui.js';
export async function fitImageBudget(source, type, bytes, maximumQuality=.92) {
  if(!Number.isFinite(bytes)||bytes<128) { throw new Error('Целевой размер должен быть не меньше 128 байт.'); }
  let current=source;
  for(let round=0;round<12;round+=1) {
    let blob;
    if(type==='image/png') { blob=await toBlob(current,type); if(blob.size<=bytes) { return blob; } }
    else {
      const smallest=await toBlob(current,type,.04); if(smallest.type!==type) { throw new Error('Этот кодек не поддерживается браузером.'); }
      if(smallest.size<=bytes) {
        let best=smallest;let low=.04;let high=maximumQuality;
        for(let i=0;i<9;i+=1) { const middle=(low+high)/2;const candidate=await toBlob(current,type,middle);if(candidate.size<=bytes) {best=candidate;low=middle;} else {high=middle;} }
        return best;
      }
      blob=smallest;
    }
    if(current.width===1&&current.height===1) { break; }
    const ratio=Math.min(.85,Math.sqrt(bytes/blob.size)*.9); const next=canvas(Math.max(1,Math.floor(current.width*ratio)),Math.max(1,Math.floor(current.height*ratio)));
    next.getContext('2d').drawImage(current,0,0,next.width,next.height);current=next;await sleep();
  }
  throw new Error('Не удалось уместить изображение в заданный размер. Увеличь лимит.');
}
