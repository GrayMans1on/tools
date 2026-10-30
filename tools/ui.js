export const $ = id => document.getElementById(id);
export const esc = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
export const sleep = () => new Promise(resolve => setTimeout(resolve, 0));
export const number = (id, fallback = 0) => Number.isFinite(Number($(id).value)) ? Number($(id).value) : fallback;
export const field = (id, title, type = 'text', value = '', extra = '') => `<label>${title}<input id="${id}" type="${type}" value="${esc(value)}" ${extra}></label>`;
export const select = (id, title, options) => `<label>${title}<select id="${id}">${options.map(item => `<option value="${esc(Array.isArray(item) ? item[0] : item)}">${esc(Array.isArray(item) ? item[1] : item)}</option>`).join('')}</select></label>`;
export const files = (id, accept = '', multiple = true) => `<label class="drop">Выбери файлы<input id="${id}" type="file" accept="${accept}" ${multiple ? 'multiple' : ''}></label>`;
export function status(message, error = false, id = 'status') {
  const target = $(id);
  if (target) {
    target.textContent = String(message);
    target.classList.toggle('error', error);
  }
}
export function action(id, callback) {
  $(id).addEventListener('click', async () => {
    const button = $(id);
    button.disabled = true;
    try {
      await callback();
    } catch (error) {
      status(error.message || error, true);
    } finally {
      button.disabled = false;
    }
  });
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  let target = document.getElementById('downloads');
  if (!target) {
    target = document.createElement('div');
    target.id = 'downloads';
    target.className = 'actions';
    document.querySelector('main').append(target);
  }
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.className = 'button';
  anchor.textContent = `Скачать ${name}`;
  target.append(anchor);
  anchor.click();
  // Keep a visible link for browsers that block an asynchronous automatic download.
  window.addEventListener('pagehide', () => URL.revokeObjectURL(url), {once: true});
}
export const baseName = name => name.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'result';
export function canvas(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 16384 || height > 16384 || width * height > 40000000) {
    throw new Error('Размер должен быть от 1 до 16384 px, не более 40 млн пикселей.');
  }
  const result = document.createElement('canvas');
  result.width = width;
  result.height = height;
  return result;
}
export const toBlob = (element, type = 'image/png', quality = .92) => new Promise((resolve, reject) => {
  element.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось сохранить изображение.')), type, quality);
});
export async function readImage(file) {
  if (/\.ico$/i.test(file.name)) {
    const {decodeIco} = await import('./vendor/vendor.js');
    const images = await decodeIco(await file.arrayBuffer());
    if (!images.length) {
      throw new Error('ICO не содержит изображений.');
    }
    const best = images.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    return createImageBitmap(new Blob([best.buffer], {type: 'image/png'}));
  }
  return createImageBitmap(file);
}
export async function bundle(items, name = 'results.zip') {
  if (items.length === 1) {
    download(items[0].blob, items[0].name);
    return;
  }
  const {JSZip} = await import('./vendor/vendor.js');
  const zip = new JSZip();
  const seen = new Set();
  for (const item of items) {
    let candidate = item.name;
    let index = 2;
    while (seen.has(candidate.toLowerCase())) {
      const dot = item.name.lastIndexOf('.');
      candidate = dot >= 0 ? `${item.name.slice(0, dot)}_${index}${item.name.slice(dot)}` : `${item.name}_${index}`;
      index += 1;
    }
    seen.add(candidate.toLowerCase());
    zip.file(candidate, item.blob);
  }
  download(await zip.generateAsync({type: 'blob'}), name);
}
export async function copy(text) {
  await navigator.clipboard.writeText(text);
  status('Скопировано.');
}
export function previewTable(rows, target) {
  target.replaceChildren();
  const table = document.createElement('table');
  for (const [index, row] of rows.slice(0, 101).entries()) {
    const tr = document.createElement('tr');
    for (const cell of row) {
      const td = document.createElement(index === 0 ? 'th' : 'td');
      td.textContent = cell == null ? '' : String(cell);
      tr.append(td);
    }
    table.append(tr);
  }
  target.append(table);
}
export function persist(key, data) {
  try {
    localStorage.setItem(`gm-tools-${key}`, JSON.stringify(data));
  } catch (error) {
    status('Не удалось сохранить настройки в браузере.', true);
  }
}
export function restore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(`gm-tools-${key}`)) ?? fallback;
  } catch (error) {
    return fallback;
  }
}
export function teardown(callback) {
  window.addEventListener('pagehide', callback, {once: true});
}
