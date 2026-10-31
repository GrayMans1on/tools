export const newBoard = () => ({format: 'GrayMansion Board', version: 1, objects: [], assets: {}, view: {x: 0, y: 0, zoom: 1}, background: '#ffffff'});
export function bounds(object) {
  if(object.type==='arrow'&&object.arrowStyle==='elbow'){const points=arrowPoints(object);const xs=points.map(point=>point[0]);const ys=points.map(point=>point[1]);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(1,Math.max(...xs)-Math.min(...xs)),h:Math.max(1,Math.max(...ys)-Math.min(...ys))};}
  if (object.points?.length) {
    const xs = object.points.map(point => point[0]); const ys = object.points.map(point => point[1]);
    return {x: Math.min(...xs), y: Math.min(...ys), w: Math.max(1, Math.max(...xs) - Math.min(...xs)), h: Math.max(1, Math.max(...ys) - Math.min(...ys))};
  }
  return {x: Math.min(object.x, object.x + object.w), y: Math.min(object.y, object.y + object.h), w: Math.max(1, Math.abs(object.w)), h: Math.max(1, Math.abs(object.h))};
}
export function boardBounds(objects) {
  if (!objects.length) { return {x: 0, y: 0, w: 1200, h: 800}; }
  const boxes = objects.map(bounds);
  const x = Math.min(...boxes.map(box => box.x)) - 30; const y = Math.min(...boxes.map(box => box.y)) - 30;
  return {x, y, w: Math.max(...boxes.map(box => box.x + box.w)) - x + 30, h: Math.max(...boxes.map(box => box.y + box.h)) - y + 30};
}
export function validateBoard(value) {
  if (!value || value.format !== 'GrayMansion Board' || value.version !== 1 || !Array.isArray(value.objects) || value.objects.length > 10000 || !value.assets || typeof value.assets !== 'object') { throw new Error('Неподдерживаемый файл доски.'); }
  const types = ['pen','highlight','rect','ellipse','arrow','text','table','image'];
  const finite = number => typeof number === 'number' && Number.isFinite(number) && Math.abs(number) < 1e8;
  const color = text => typeof text === 'string' && /^#[0-9a-f]{6}$/i.test(text);
  for (const [key, data] of Object.entries(value.assets)) {
    if (!/^[\w-]{1,100}$/.test(key) || typeof data !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(data)) { throw new Error('Некорректное вложение доски.'); }
  }
  for (const object of value.objects) {
    if (!types.includes(object.type) || !['x','y','w','h','width','size'].every(key => finite(object[key])) || !color(object.color) || !(color(object.fill) || object.fill === 'none') || typeof object.text !== 'string' || object.text.length > 100000 || typeof object.id !== 'string' || object.id.length > 100 || object.width < 1 || object.width > 80 || object.size < 1 || object.size > 5000) { throw new Error('Некорректный объект доски.'); }
    if (object.points && (!Array.isArray(object.points) || object.points.length > 50000 || !object.points.every(point => Array.isArray(point) && point.length === 2 && point.every(finite)))) { throw new Error('Некорректный штрих.'); }
    for(const key of ['startBinding','endBinding']){const binding=object[key];if(binding && (typeof binding.id!=='string'||!['left','right','top','bottom'].includes(binding.side)||!finite(binding.t)||binding.t<0||binding.t>1)){throw new Error('Некорректная привязка стрелки.');}}
    if(object.bendOffset!==undefined&&!finite(object.bendOffset)){throw new Error('Некорректный изгиб стрелки.');}
    if (object.type === 'image' && !Object.hasOwn(value.assets, object.asset)) { throw new Error('Изображение отсутствует в файле.'); }
  }
  value.view = value.view && ['x','y','zoom'].every(key => finite(value.view[key])) && value.view.zoom >= .05 && value.view.zoom <= 8 ? value.view : {x: 0, y: 0, zoom: 1};
  value.background = color(value.background) ? value.background : '#ffffff';
  return value;
}
export function moveObject(object, dx, dy) {
  object.x += dx; object.y += dy;
  if (object.points) { object.points = object.points.map(([x, y]) => [x + dx, y + dy]); }
}
export function scaleObject(object, box, factorX, factorY) {
  object.x = box.x + (object.x - box.x) * factorX; object.y = box.y + (object.y - box.y) * factorY;
  if(object.type==='arrow'&&object.bendOffset){object.bendOffset*=factorX;}
  object.w *= factorX; object.h *= factorY;
  if (object.points) { object.points = object.points.map(([x, y]) => [box.x + (x - box.x) * factorX, box.y + (y - box.y) * factorY]); }
  if (object.type === 'text' || object.type === 'table') { object.size = Math.max(1, Math.min(5000, object.size * Math.min(factorX, factorY))); }
}
export function attachment(object, point) {
  const box=bounds(object); const choices=[['left',Math.abs(point.x-box.x)],['right',Math.abs(point.x-box.x-box.w)],['top',Math.abs(point.y-box.y)],['bottom',Math.abs(point.y-box.y-box.h)]];
  const side=choices.sort((a,b)=>a[1]-b[1])[0][0];
  return {id:object.id,side,t:Math.max(0,Math.min(1,['left','right'].includes(side)?(point.y-box.y)/box.h:(point.x-box.x)/box.w))};
}
export function bindingPoint(binding, objects) {
  const object=objects.find(item=>item.id===binding.id && !['arrow','pen','highlight'].includes(item.type));if(!object) {return null;}
  const box=bounds(object);const t=Math.max(0,Math.min(1,binding.t));
  return {x:box.x+(binding.side==='left'?0:binding.side==='right'?box.w:box.w*t),y:box.y+(binding.side==='top'?0:binding.side==='bottom'?box.h:box.h*t)};
}
export function resolveBindings(objects) {
  for(const arrow of objects.filter(item=>item.type==='arrow')) {
    let start={x:arrow.x,y:arrow.y};let end={x:arrow.x+arrow.w,y:arrow.y+arrow.h};
    if(arrow.startBinding) {const next=bindingPoint(arrow.startBinding,objects);if(next) {start=next;}else {delete arrow.startBinding;}}
    if(arrow.endBinding) {const next=bindingPoint(arrow.endBinding,objects);if(next) {end=next;}else {delete arrow.endBinding;}}
    arrow.x=start.x;arrow.y=start.y;arrow.w=end.x-start.x;arrow.h=end.y-start.y;
  }
}
export function arrowPoints(arrow) {
  const start=[arrow.x,arrow.y];const end=[arrow.x+arrow.w,arrow.y+arrow.h];
  if(arrow.arrowStyle!=='elbow') {return [start,end];}
  const middle=arrow.x+arrow.w/2+(arrow.bendOffset||0);return [start,[middle,arrow.y],[middle,end[1]],end];
}
