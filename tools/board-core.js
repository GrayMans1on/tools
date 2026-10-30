export const newBoard = () => ({format: 'GrayMansion Board', version: 1, objects: [], assets: {}, view: {x: 0, y: 0, zoom: 1}, background: '#ffffff'});
export function bounds(object) {
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
  object.w *= factorX; object.h *= factorY;
  if (object.points) { object.points = object.points.map(([x, y]) => [box.x + (x - box.x) * factorX, box.y + (y - box.y) * factorY]); }
  if (object.type === 'text' || object.type === 'table') { object.size = Math.max(1, Math.min(5000, object.size * Math.min(factorX, factorY))); }
}
