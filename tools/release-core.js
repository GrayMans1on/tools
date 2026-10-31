export const hexRGB = rgb => `#${rgb.slice(0, 3).map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
export function perceptualRGB(rgb) {
  const [r,g,b] = rgb.slice(0,3).map(value => value / 255 <= .04045 ? value / 255 / 12.92 : ((value / 255 + .055) / 1.055) ** 2.4);
  const l = Math.cbrt(.4122214708*r + .5363325363*g + .0514459929*b);
  const m = Math.cbrt(.2119034982*r + .6806995451*g + .1073969566*b);
  const s = Math.cbrt(.0883024619*r + .2817188376*g + .6299787005*b);
  return [.2104542553*l+.793617785*m-.0040720468*s, 1.9779984951*l-2.428592205*m+.4505937099*s, .0259040371*l+.7827717662*m-.808675766*s];
}
const distance = (a,b) => a.reduce((sum,value,i) => sum + (value-b[i])**2,0);
export function paletteGroups(rgba, centers) {
  const frequencies = new Map();
  for (let i=0;i<rgba.length;i+=4) {
    if (rgba[i+3] <= 127) { continue; }
    const rgb = Array.from(rgba.slice(i,i+3)); const hex = hexRGB(rgb);
    if (!frequencies.has(hex)) { frequencies.set(hex,{hex,rgb,count:0,lab:perceptualRGB(rgb)}); }
    frequencies.get(hex).count += 1;
  }
  const source = [...frequencies.values()];
  if (!source.length) { return []; }
  let representatives;
  if (source.length <= centers.length) { representatives = source; }
  else {
    const used = new Set(); representatives = [];
    for (const center of centers) {
      const lab = perceptualRGB(center); let nearest;
      for (const item of source) { if (!used.has(item.hex) && (!nearest || distance(item.lab,lab)<distance(nearest.lab,lab))) { nearest=item; } }
      if (nearest) { representatives.push(nearest); used.add(nearest.hex); }
    }
  }
  const result = representatives.map(item => ({hex:item.hex,rgb:item.rgb,total:0,exact:0,sources:[]}));
  for (const item of source) {
    let index=0;
    for(let j=1;j<representatives.length;j+=1) { if(distance(item.lab,representatives[j].lab)<distance(item.lab,representatives[index].lab)) { index=j; } }
    const group=result[index]; group.total+=item.count; group.sources.push({hex:item.hex,count:item.count}); if(item.hex===group.hex) { group.exact=item.count; }
  }
  const total=source.reduce((sum,item)=>sum+item.count,0);
  return result.filter(item=>item.total).map(item=>({...item,percent:item.total/total*100,sources:item.sources.sort((a,b)=>(b.hex===item.hex)-(a.hex===item.hex)||b.count-a.count)})).sort((a,b)=>b.total-a.total);
}
export function levelAudio(channels, rate, strength) {
  if (!strength) { return channels; }
  const amount=Math.max(0,Math.min(1,strength/100)); const step=Math.max(1,Math.round(rate*.25)); const levels=[];
  for(let start=0;start<channels[0].length;start+=step) {
    let energy=0; const count=Math.min(step,channels[0].length-start);
    for(const channel of channels) { for(let i=start;i<start+count;i+=1) { energy+=channel[i]**2; } }
    levels.push(Math.sqrt(energy/(count*channels.length)));
  }
  const active=levels.filter(value=>value>.0018).sort((a,b)=>a-b);
  if (!active.length) { return channels; }
  const target=active[Math.floor(active.length/2)];
  const gains=levels.map(value=>value>.0018 ? Math.min(10,Math.max(.1,target/value))**amount : 1);
  let peak=0;
  const result=channels.map(channel=>Float32Array.from(channel,(value,i)=>{
    const position=i/step-.5; const left=Math.max(0,Math.floor(position)); const right=Math.min(gains.length-1,left+1); const mix=Math.max(0,Math.min(1,position-left));
    const next=value*(gains[left]*(1-mix)+gains[right]*mix); peak=Math.max(peak,Math.abs(next)); return next;
  }));
  if(peak>.99) { for(const channel of result) { for(let i=0;i<channel.length;i+=1) { channel[i]*=.99/peak; } } }
  return result;
}
export function crossfadeAudio(parts, rate, seconds) {
  if(!parts.length) { throw new Error('Добавь фрагменты.'); }
  if(parts.reduce((sum,part)=>sum+part[0].length,0)>80000000){throw new Error('Склейка превышает 80 млн отсчётов. Сократи фрагменты.');}
  const channels=Math.max(...parts.map(part=>part.length)); let result=parts[0].map(channel=>channel.slice());
  if(result.length<channels) { result=Array.from({length:channels},(_,i)=>result[i]||result[0].slice()); }
  for(const part of parts.slice(1)) {
    const overlap=Math.min(Math.round(seconds*rate),result[0].length,part[0].length);
    result=Array.from({length:channels},(_,channel)=>{
      const a=result[channel]; const b=part[channel]||part[0]; const out=new Float32Array(a.length+b.length-overlap); out.set(a);
      for(let i=0;i<overlap;i+=1) { const mix=(i+1)/(overlap+1); out[a.length-overlap+i]=a[a.length-overlap+i]*Math.cos(mix*Math.PI/2)+b[i]*Math.sin(mix*Math.PI/2); }
      out.set(b.subarray(overlap),a.length); return out;
    });
  }
  let peak=0; for(const channel of result) { for(const value of channel) { peak=Math.max(peak,Math.abs(value)); } }
  if(peak>.99) { for(const channel of result) { for(let i=0;i<channel.length;i+=1) { channel[i]*=.99/peak; } } }
  return result;
}
export function cleanTable(rows, columns, operation, fill='') {
  return rows.map((row,index)=>index===0 ? row.slice() : row.map((value,col)=>{
    if(!columns.includes(col)) { return value; }
    const text=String(value??'');
    if(operation==='trim') { return text.trim().replace(/[ \t]+/g,' '); }
    if(operation==='fill') { return text.trim() ? value : fill; }
    if(operation==='number') { const number=text.trim().replace(/[\s\u00a0]/g,'').replace(',','.'); return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(number) ? number : value; }
    const match=/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/.exec(text.trim());
    if(match) { const [day,month,year]=match.slice(1).map(Number); const date=new Date(Date.UTC(year,month-1,day)); if(date.getUTCFullYear()===year && date.getUTCMonth()===month-1 && date.getUTCDate()===day) { return date.toISOString().slice(0,10); } }
    return value;
  }));
}
export function workdaysBetween(start,end,weekdays,excluded=[]) {
  const sign=end>=start ? 1 : -1; let first=Math.min(start,end); const last=Math.max(start,end); const count=last-first;
  const weeks=Math.floor(count/7); let result=weeks*weekdays.length;
  first+=weeks*7;
  for(let day=first+1;day<=last;day+=1) { if(weekdays.includes(new Date(day*86400000).getUTCDay())) { result+=1; } }
  for(const day of new Set(excluded)) { if(day>Math.min(start,end) && day<=last && weekdays.includes(new Date(day*86400000).getUTCDay())) { result-=1; } }
  return result*sign;
}
export function constrainedGroups(names,count,together,apart,random=Math.random) {
  if(new Set(names).size!==names.length) { throw new Error('Для ограничений имена должны быть уникальны.'); }
  if(names.length>200) { throw new Error('С ограничениями — до 200 участников.'); }
  const parent=names.map((_,i)=>i); const find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
  const pair=line=>{ const parts=line.split('|').map(item=>item.trim()); if(parts.length!==2 || parts.some(item=>!names.includes(item))) { throw new Error(`Проверь пару: ${line}`); } return parts.map(item=>names.indexOf(item)); };
  for(const line of together.split('\n').map(x=>x.trim()).filter(Boolean)) { const [a,b]=pair(line); parent[find(a)]=find(b); }
  const forbidden=apart.split('\n').map(x=>x.trim()).filter(Boolean).map(pair);
  if(forbidden.some(([a,b])=>find(a)===find(b))) { throw new Error('Одна пара одновременно должна быть вместе и раздельно.'); }
  const units=new Map(); names.forEach((name,i)=>{ const root=find(i); if(!units.has(root)) { units.set(root,[]); } units.get(root).push(i); });
  const ordered=[...units.values()].map(unit=>({unit,tie:random()})).sort((a,b)=>b.unit.length-a.unit.length||a.tie-b.tie).map(x=>x.unit);
  const groups=Array.from({length:count},()=>[]); const capacity=Math.ceil(names.length/count); let attempts=0;
  function place(index) {
    if(++attempts>50000) { throw new Error('Поиск превысил лимит. Ослабь ограничения или повтори.'); }
    if(index===ordered.length) { return true; }
    const unit=ordered[index]; const choices=groups.map((group,i)=>({i,size:group.length,tie:random()})).sort((a,b)=>a.size-b.size||a.tie-b.tie); let emptyTried=false;
    for(const {i} of choices) {
      const group=groups[i]; if(!group.length && emptyTried) { continue; } if(!group.length) { emptyTried=true; }
      if(group.length+unit.length>capacity || forbidden.some(([a,b])=>unit.includes(a)&&group.includes(b)||unit.includes(b)&&group.includes(a))) { continue; }
      group.push(...unit); if(place(index+1)) { return true; } group.splice(group.length-unit.length);
    }
    return false;
  }
  if(!place(0)) { throw new Error('Равномерные группы с этими ограничениями не найдены.'); }
  return groups.map(group=>group.map(i=>names[i]));
}
