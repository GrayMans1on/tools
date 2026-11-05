const familyPattern = /^[A-Za-z0-9][A-Za-z0-9 -]{0,99}$/;
const dataPattern = /^data:[a-z0-9.+/-]*;base64,[A-Za-z0-9+/=]+$/i;

export function validateGoogleFonts(groups) {
  if (!Array.isArray(groups) || groups.length > 12) { throw new Error('В проекте допускается до 12 Google Fonts.'); }
  let size = 0;
  const names = new Set();
  for (const group of groups) {
    if (!group || typeof group.family !== 'string' || !familyPattern.test(group.family) || names.has(group.family)
      || !Array.isArray(group.faces) || !group.faces.length || group.faces.length > 256) {
      throw new Error('Неверные данные Google Fonts.');
    }
    names.add(group.family);
    for (const face of group.faces) {
      if (!face || typeof face.data !== 'string' || !dataPattern.test(face.data)
        || typeof face.range !== 'string' || face.range.length > 5000 || !/^[Uu+0-9A-Fa-f?, \-]+$/.test(face.range)) {
        throw new Error('Повреждён шрифт Google Fonts.');
      }
      size += face.data.length;
    }
  }
  if (size > 10e6) { throw new Error('Встроенные Google Fonts превышают 10 МБ.'); }
  return groups;
}

export async function fetchGoogleFont(family, signal) {
  if (!familyPattern.test(family)) { throw new Error('Укажи название семейства, например Dela Gothic One.'); }
  const response = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap`, {signal});
  if (!response.ok) { throw new Error('Шрифт не найден. Проверь название Google Fonts.'); }
  const css = await response.text();
  const entries = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)];
  if (!entries.length || entries.length > 256) { throw new Error('Google Fonts не вернул файлы шрифта.'); }
  const faces = await Promise.all(entries.map(async ([, body]) => {
    const address = body.match(/url\(\s*['"]?(https:\/\/fonts\.gstatic\.com\/[^)'"\s]+)/)?.[1];
    if (!address) { throw new Error('Неверный адрес файла Google Fonts.'); }
    const result = await fetch(address, {signal});
    if (!result.ok) { throw new Error('Не удалось скачать файл Google Fonts.'); }
    const blob = await result.blob();
    if (blob.size > 5e6) { throw new Error('Файл шрифта превышает 5 МБ.'); }
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Не удалось сохранить файл шрифта.')); reader.readAsDataURL(blob);
    });
    return {data, range: body.match(/unicode-range:\s*([^;]+)/)?.[1].trim() || 'U+0-10FFFF'};
  }));
  return validateGoogleFonts([{family, faces}])[0];
}
