import { $, esc, field, select, files, action, status, canvas, toBlob, download, bundle, readImage, baseName, number, sleep, copy } from '../ui.js';

export async function palette(root) {
  const {quantize, applyPalette} = await import('../vendor/vendor.js');
  root.innerHTML = `<section class="panel">${files('files', 'image/*,.ico')}<div class="row">${field('colors', 'Количество цветов', 'number', 8, 'min="2" max="64"')}${select('mode', 'Несколько изображений', [['combined', 'Общая палитра'], ['separate', 'Отдельные палитры']])}</div><div class="actions"><button id="extract" class="primary">Извлечь палитру</button><button id="save">Скачать палитры</button></div><p class="muted">Прозрачные пиксели исключаются. Анализируется уменьшенная копия; исходники сохраняются без изменений.</p></section><div id="palettes"></div>`;
  let results = [];
  async function samples(file) {
    const bitmap = await readImage(file);
    const ratio = Math.min(1, 240 / Math.max(bitmap.width, bitmap.height));
    const c = canvas(Math.max(1, Math.round(bitmap.width * ratio)), Math.max(1, Math.round(bitmap.height * ratio)));
    c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
    bitmap.close();
    const pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const opaque = [];
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] > 127) { opaque.push(pixels[i], pixels[i + 1], pixels[i + 2], 255); }
    }
    return opaque;
  }
  action('extract', async () => {
    const chosen = [...$('files').files];
    if (!chosen.length) { throw new Error('Выбери изображения.'); }
    const count = Math.max(2, Math.min(64, Math.round(number('colors', 8))));
    results = [];
    $('palettes').replaceChildren();
    const groups = [];
    let combined = [];
    for (const [i, file] of chosen.entries()) {
      status(`Чтение ${i + 1}/${chosen.length}: ${file.name}`);
      const data = await samples(file);
      if ($('mode').value === 'separate') { groups.push({name: file.name, data}); }
      else {
        const step = Math.max(1, Math.ceil(data.length / 4 / Math.max(1, Math.floor(250000 / chosen.length)))) * 4;
        for (let j = 0; j < data.length; j += step) { combined.push(...data.slice(j, j + 4)); }
      }
      await sleep();
    }
    if ($('mode').value === 'combined') { groups.push({name: 'Общая палитра', data: combined}); }
    for (const group of groups) {
      if (!group.data.length) { status(`${group.name}: нет непрозрачных пикселей.`, true); continue; }
      const data = new Uint8Array(group.data);
      const colors = quantize(data, count);
      const indices = applyPalette(data, colors);
      const hits = new Array(colors.length).fill(0);
      for (const index of indices) { hits[index] += 1; }
      const palette = colors.map((rgb, index) => ({rgb, hex: `#${rgb.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('')}`, percent: hits[index] * 100 / indices.length})).sort((a, b) => b.percent - a.percent);
      results.push({name: group.name, colors: palette});
      const panel = document.createElement('section');
      panel.className = 'panel';
      const title = document.createElement('h2'); title.textContent = group.name; panel.append(title);
      const grid = document.createElement('div'); grid.className = 'grid';
      for (const item of palette) {
        const tile = document.createElement('button'); tile.className = 'tile';
        tile.innerHTML = `<div class="swatch" style="background:${item.hex}"></div><strong>${item.hex.toUpperCase()}</strong><small>RGB ${item.rgb.slice(0, 3).join(', ')} · ${item.percent.toFixed(1)}%</small>`;
        tile.addEventListener('click', () => { copy(item.hex).catch(error => status(error.message, true)); });
        grid.append(tile);
      }
      panel.append(grid); $('palettes').append(panel);
    }
    status(`Готово. Палитр: ${results.length}. Нажми на цвет, чтобы скопировать HEX.`);
  });
  action('save', async () => {
    if (!results.length) { throw new Error('Сначала извлеки палитру.'); }
    const items = [];
    for (const result of results) {
      const c = canvas(800, 140);
      const ctx = c.getContext('2d');
      result.colors.forEach((color, index) => {
        const x = index * 800 / result.colors.length;
        ctx.fillStyle = color.hex; ctx.fillRect(x, 0, 800 / result.colors.length + 1, 100);
      });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 100, 800, 40);
      ctx.fillStyle = '#303646'; ctx.font = '14px sans-serif'; ctx.fillText(result.name, 12, 125);
      const base = baseName(result.name);
      items.push({name: `${base}.png`, blob: await toBlob(c)});
      items.push({name: `${base}.json`, blob: new Blob([JSON.stringify(result, null, 2)], {type: 'application/json'})});
      const gpl = `GIMP Palette\nName: ${result.name}\nColumns: ${result.colors.length}\n#\n${result.colors.map(item => `${item.rgb.slice(0, 3).join(' ')}\t${item.hex}`).join('\n')}`;
      items.push({name: `${base}.gpl`, blob: new Blob([gpl])});
    }
    await bundle(items, 'palettes.zip');
  });
}

const glyphs = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd',
  '6': 'afgecd', '7': 'abc', '8': 'abcdefg', '9': 'abfgcd',
  A: 'abcefg', B: 'abcdefgim', C: 'afed', D: 'abcdim', E: 'afged', F: 'afge',
  G: 'afedcg', H: 'fbceg', I: 'adim', J: 'bcde', K: 'fehk', L: 'fed', M: 'fbehj',
  N: 'fbehl', O: 'abcdef', P: 'abfge', Q: 'abcdefl', R: 'abfgek', S: 'afgcd',
  T: 'aim', U: 'fbcde', V: 'fejl', W: 'fbcdekl', X: 'hjkl', Y: 'hjm', Z: 'adjk',
  А: 'abcefg', Б: 'afgecd', В: 'abcdefgim', Г: 'afe', Д: 'bcdeim', Е: 'afged',
  Ё: 'afged', Ж: 'hjklim', З: 'abgcd', И: 'fejkb', Й: 'fejkb', К: 'fehk', Л: 'hbc',
  М: 'fbehj', Н: 'fbceg', О: 'abcdef', П: 'abcef', Р: 'abfge', С: 'afed', Т: 'aim',
  У: 'fgbcd', Ф: 'abfgcim', Х: 'hjkl', Ц: 'fbcde', Ч: 'fgbc', Ш: 'fbcdeim', Щ: 'fbcdeiml',
  Ъ: 'fgecd', Ы: 'fgecdb', Ь: 'fgecd', Э: 'abgcd', Ю: 'fbcegim', Я: 'abfgck',
  '-': 'g', '_': 'd', '=': 'gd', '+': 'gim', '/': 'jk', '\\': 'hl', ' ': '', '.': '', ':': ''
};
const segmentLines = {
  a: [15, 8, 85, 8], b: [92, 16, 92, 83], c: [92, 101, 92, 168], d: [15, 176, 85, 176],
  e: [8, 101, 8, 168], f: [8, 16, 8, 83], g: [15, 92, 85, 92],
  h: [20, 22, 44, 78], i: [50, 20, 50, 78], j: [80, 22, 56, 78],
  k: [20, 162, 44, 106], m: [50, 106, 50, 164], l: [80, 162, 56, 106]
};
export function segments(root) {
  root.innerHTML = `<div class="two"><section class="panel"><label>Текст<textarea id="text">GRAYMANSION\n2026</textarea></label><div class="row">${select('style', 'Конструкция', [['9', '9 сегментов'], ['14', 'Расширенная панель']])}${field('size', 'Высота символа, px', 'number', 100, 'min="24" max="400"')}${field('thickness', 'Толщина сегмента', 'number', 9, 'min="2" max="20"')}${field('gap', 'Между символами', 'number', 12, 'min="0" max="100"')}</div><div class="row">${field('active', 'Активный цвет', 'color', '#91f7bf')}${field('inactive', 'Неактивный цвет', 'color', '#253b31')}${field('background', 'Фон', 'color', '#101a15')}</div><div class="row"><label><input id="glow" type="checkbox" checked> Свечение</label><label><input id="transparent" type="checkbox"> Прозрачный фон</label></div><div class="actions"><button id="render" class="primary">Обновить</button><button id="save">Скачать PNG</button><button id="svg">Скачать SVG</button></div><p class="muted">Расширенная панель лучше передаёт кириллицу. В режиме 9 сегментов сложные буквы стилизованы приблизительно.</p></section><section class="panel checker preview-wrap"><canvas id="preview"></canvas></section></div><section class="panel"><h2>Собственный символ</h2><div class="row">${field('char', 'Символ', 'text', 'А', 'maxlength="1"')}${field('mask', 'Активные сегменты: a–m', 'text', 'abcefg')}</div><div class="chips" id="segmentKeys"></div><div class="actions"><button id="custom">Применить к символу</button></div></section>`;
  const custom = {};
  for (const key of Object.keys(segmentLines)) {
    const button = document.createElement('button'); button.textContent = key;
    button.addEventListener('click', () => { $('mask').value = $('mask').value.includes(key) ? $('mask').value.replaceAll(key, '') : $('mask').value + key; });
    $('segmentKeys').append(button);
  }
  let svg = '';
  function render() {
    const lines = $('text').value.toUpperCase().split('\n');
    if (lines.length > 12 || Math.max(...lines.map(line => line.length)) > 80) { throw new Error('Не более 12 строк и 80 символов в строке.'); }
    const size = Math.max(24, Math.min(400, number('size', 100)));
    const gap = Math.max(0, Math.min(100, number('gap', 12)));
    const unit = size / 184;
    const width = Math.ceil(Math.max(1, ...lines.map(line => line.length)) * (100 * unit + gap) + 32);
    const height = Math.ceil(lines.length * (size + 20) + 28);
    const c = $('preview');
    const checked = canvas(width, height); c.width = checked.width; c.height = checked.height;
    const ctx = c.getContext('2d');
    const active = $('active').value; const inactive = $('inactive').value;
    const bg = $('background').value; const thickness = Math.max(2, Math.min(20, number('thickness', 9)));
    const transparent = $('transparent').checked;
    if (!transparent) { ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height); }
    const shapes = [];
    const allowed = $('style').value === '9' ? 'abcdefghj' : Object.keys(segmentLines).join('');
    for (const [row, line] of lines.entries()) {
      for (const [col, char] of [...line].entries()) {
        const mask = custom[char] ?? glyphs[char] ?? '';
        const ox = 16 + col * (100 * unit + gap); const oy = 14 + row * (size + 20);
        for (const [key, coords] of Object.entries(segmentLines)) {
          if (!allowed.includes(key) || char === ' ') { continue; }
          const on = mask.includes(key);
          const [x1, y1, x2, y2] = coords.map((v, i) => v * unit + (i % 2 ? oy : ox));
          ctx.lineWidth = thickness * unit; ctx.lineCap = 'butt'; ctx.strokeStyle = on ? active : inactive;
          ctx.shadowColor = active; ctx.shadowBlur = on && $('glow').checked ? 12 * unit : 0;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          shapes.push(`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${on ? active : inactive}" stroke-width="${thickness * unit}"/>`);
        }
        if (char === '.' || char === ':') {
          ctx.shadowBlur = 0; ctx.fillStyle = active;
          for (const cy of char === ':' ? [60, 125] : [170]) {
            ctx.fillRect(ox + 45 * unit, oy + cy * unit, 10 * unit, 10 * unit);
            shapes.push(`<rect x="${ox + 45 * unit}" y="${oy + cy * unit}" width="${10 * unit}" height="${10 * unit}" fill="${active}"/>`);
          }
        }
      }
    }
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${transparent ? '' : `<rect width="100%" height="100%" fill="${bg}"/>`}${shapes.join('')}</svg>`;
    status('PNG содержит свечение; SVG сохраняет чистую геометрию сегментов.');
  }
  action('render', render);
  action('save', async () => { render(); download(await toBlob($('preview')), 'segment-text.png'); });
  action('svg', () => { render(); download(new Blob([svg], {type: 'image/svg+xml'}), 'segment-text.svg'); });
  action('custom', () => { custom[$('char').value.toUpperCase()] = $('mask').value; render(); });
  root.addEventListener('change', () => { try { render(); } catch (error) { status(error.message, true); } });
  render();
}

export async function icons(root) {
  const {encodeIco, decodeIco} = await import('../vendor/vendor.js');
  root.innerHTML = `<section class="panel">${files('file', '.png,.ico,image/png,image/x-icon', false)}<div class="row">${field('sizes', 'Размеры PNG через запятую', 'text', '1024,512,256,128,64,48,32,16')}${field('padding', 'Поля, %', 'number', 0, 'min="0" max="40"')}${select('sampling', 'Масштабирование', [['smooth', 'Плавное'], ['nearest', 'Без сглаживания']])}</div><div class="actions"><button id="previewButton" class="primary">Показать набор</button><button id="export">Скачать PNG + ICO</button></div><p class="muted">ICO включает размеры до 256 px. Более крупные варианты сохраняются в PNG.</p></section><section class="panel"><h2>Размерный ряд</h2><div id="sizesPreview" class="grid"></div><div id="icoFrames" class="muted"></div></section><section class="panel"><h2>Иконка в контексте — 20 вариантов</h2><div id="contexts" class="grid"></div></section>`;
  let bitmap;
  let iconURL;
  let outputs = [];
  const contextNames = ['Рабочий стол Windows', 'Тёмный рабочий стол', 'Док macOS', 'Панель задач', 'Меню «Пуск»', 'Папка приложений', 'Сетка Android', 'Экран iPhone', 'Карточка магазина', 'Список приложений', 'Вкладка браузера', 'Панель закладок', 'Уведомление', 'Системный трей', 'Настройки', 'Игровой лаунчер', 'Заставка приложения', 'Виджет', 'Список файлов', 'Аватар проекта'];
  function make(size) {
    const c = canvas(size, size); const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = $('sampling').value !== 'nearest'; ctx.imageSmoothingQuality = 'high';
    const available = size * (1 - Math.max(0, Math.min(40, number('padding'))) / 50);
    const ratio = Math.min(available / bitmap.width, available / bitmap.height);
    const w = bitmap.width * ratio; const h = bitmap.height * ratio;
    ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
    return c;
  }
  async function render() {
    const file = $('file').files[0];
    if (!file) { throw new Error('Выбери PNG или ICO.'); }
    if (bitmap) { bitmap.close(); }
    bitmap = await readImage(file);
    const sizes = [...new Set($('sizes').value.split(/[,;\s]+/).filter(Boolean).map(Number))];
    if (!sizes.length || sizes.length > 25 || sizes.some(size => !Number.isInteger(size) || size < 1 || size > 4096)) {
      throw new Error('Укажи до 25 целых размеров от 1 до 4096 px.');
    }
    outputs = []; $('sizesPreview').replaceChildren();
    for (const size of sizes) {
      const c = make(size); const blob = await toBlob(c); outputs.push({size, blob});
      const tile = document.createElement('div'); tile.className = 'tile checker';
      const image = document.createElement('img'); image.src = URL.createObjectURL(blob); image.style.width = `${Math.min(size, 128)}px`;
      image.onload = () => URL.revokeObjectURL(image.src);
      const label = document.createElement('small'); label.textContent = `${size} × ${size}`;
      tile.append(image, label); $('sizesPreview').append(tile);
    }
    if (iconURL) { URL.revokeObjectURL(iconURL); }
    iconURL = URL.createObjectURL(await toBlob(make(256)));
    $('contexts').replaceChildren();
    const icon = `<img src="${iconURL}" alt="Предпросмотр иконки">`;
    const neighbors = '<i class="app-dot a"></i><i class="app-dot b"></i>';
    const layouts = [
      `<div class="mock-desktop">${icon}<span>Приложение</span><div class="mock-taskbar">${neighbors}${icon}</div></div>`,
      `<div class="mock-desktop night">${icon}<span>Приложение</span><div class="mock-taskbar">${icon}${neighbors}</div></div>`,
      `<div class="mock-wall"><div class="mock-dock">${neighbors}${icon}<i class="app-dot c"></i></div></div>`,
      `<div class="mock-wall"><div class="mock-taskbar standalone">${neighbors}${icon}<span>Поиск</span></div></div>`,
      `<div class="mock-start"><b>Закреплённые</b><div>${neighbors}${icon}<i class="app-dot c"></i></div><small>Приложения</small></div>`,
      `<div class="mock-window"><b>Приложения</b><div class="mock-row">${icon}${neighbors}</div></div>`,
      `<div class="mock-phone android"><small>12:45</small><div>${neighbors}${icon}<i class="app-dot c"></i></div><span>Приложение</span></div>`,
      `<div class="mock-phone iphone"><div class="island"></div><div>${icon}${neighbors}<i class="app-dot c"></i></div><span>Приложение</span></div>`,
      `<div class="mock-store">${icon}<b>Приложение</b><small>Инструменты · 4.8</small><button disabled>Установить</button></div>`,
      `<div class="mock-list"><div>${icon}<span>Приложение<br><small>Установлено</small></span></div><div><i class="app-dot b"></i><span>Другое приложение</span></div></div>`,
      `<div class="mock-browser"><div class="mock-tab">${icon}<span>Главная</span><b>×</b></div><div class="mock-address">example.com</div><div class="mock-content"></div></div>`,
      `<div class="mock-bookmarks"><div>${icon}<span>Приложение</span></div><div><i class="app-dot b"></i><span>Закладка</span></div></div>`,
      `<div class="mock-notice">${icon}<div><b>Приложение</b><small>Обработка завершена.<br>Только что</small></div></div>`,
      `<div class="mock-tray"><span>⌃</span><i class="app-dot b"></i>${icon}<span>12:45<br><small>30.10.2026</small></span></div>`,
      `<div class="mock-settings"><b>Настройки</b><div>${icon}<span>Приложение<br><small>Параметры приложения</small></span><b>›</b></div></div>`,
      `<div class="mock-launcher">${icon}<b>Моя игра</b><span>Готова к запуску</span><button disabled>Играть</button></div>`,
      `<div class="mock-splash">${icon}<b>Приложение</b><span class="mock-loader"></span></div>`,
      `<div class="mock-widget"><div>${icon}<b>Приложение</b></div><strong>12:45</strong><small>Быстрый доступ</small></div>`,
      `<div class="mock-files"><b>Имя <span>Тип</span></b><div>${icon}<span>Application.exe</span></div><div><i class="app-dot b"></i><span>Documents</span></div></div>`,
      `<div class="mock-project">${icon}<b>Мой проект</b><small>Рабочее пространство</small><div>${neighbors}<span>+3</span></div></div>`
    ];
    contextNames.forEach((name, index) => {
      const tile = document.createElement('div'); tile.className = 'icon-context';
      const label = document.createElement('small'); label.textContent = name;
      const mock = document.createElement('div'); mock.className = 'mock-stage'; mock.innerHTML = layouts[index];
      tile.append(mock, label); $('contexts').append(tile);
    });
    if (/\.ico$/i.test(file.name)) {
      const frames = await decodeIco(await file.arrayBuffer());
      $('icoFrames').textContent = `В исходном ICO: ${frames.map(item => `${item.width}×${item.height}`).join(', ')}.`;
    }
    status('Набор готов. Контексты — условные макеты для оценки читаемости иконки.');
  }
  action('previewButton', render);
  action('export', async () => {
    await render();
    const items = outputs.map(item => ({name: `icon_${item.size}.png`, blob: item.blob}));
    const small = outputs.filter(item => item.size <= 256);
    if (!small.length) { small.push({size: 256, blob: await toBlob(make(256))}); }
    const ico = await encodeIco(await Promise.all(small.map(async item => ({buffer: await item.blob.arrayBuffer(), usePngIcon: true}))));
    items.push({name: 'application.ico', blob: new Blob([ico], {type: 'image/x-icon'})});
    await bundle(items, 'application-icons.zip');
    status('PNG и ICO экспортированы.');
  });
}
