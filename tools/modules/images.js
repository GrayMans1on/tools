import { $, esc, field, select, files, action, status, canvas, toBlob, download, bundle, readImage, baseName, number, sleep, copy, teardown } from '../ui.js';

export async function palette(root) {
  const {quantize} = await import('../vendor/vendor.js');
  const {paletteGroups} = await import('../release-core.js?v=20261031-v06');
  root.innerHTML = `<section class="panel">${files('files', 'image/*,.ico')}<div class="row">${field('colors', 'Количество цветов', 'number', 8, 'min="2" max="64"')}${select('mode', 'Несколько изображений', [['combined', 'Общая палитра'], ['separate', 'Отдельные палитры']])}</div><div class="actions"><button id="extract" class="primary">Извлечь палитру</button><button id="save">Скачать палитры</button></div><p class="muted">Ширина сегмента — доля цвета с объединёнными оттенками. Наведи или нажми Tab: вертикальные полосы покажут точный цвет и ближайшие исходные оттенки. Анализ до 1 млн пикселей на файл без сглаживания; у больших изображений доли приблизительные. Прозрачность исключается.</p></section><div id="palettes"></div>`;
  let results=[];
  action('extract', async()=>{
    const chosen=[...$('files').files]; if(!chosen.length) { throw new Error('Выбери изображения.'); }
    const count=Math.max(2,Math.min(64,Math.round(number('colors',8)))); const groups=[]; const combined=[]; results=[]; $('palettes').replaceChildren();
    for(const file of chosen) {
      const image=await readImage(file); const ratio=Math.min(1,Math.sqrt(1e6/(image.width*image.height)));
      const c=canvas(Math.max(1,Math.round(image.width*ratio)),Math.max(1,Math.round(image.height*ratio))); const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false; ctx.drawImage(image,0,0,c.width,c.height); image.close();
      const rgba=ctx.getImageData(0,0,c.width,c.height).data; const data=[];
      const step=$('mode').value==='combined'?Math.max(1,Math.ceil(rgba.length/4/Math.max(1,1e6/chosen.length)))*4:4;
      for(let i=0;i<rgba.length;i+=step) { if(rgba[i+3]>127) { data.push(rgba[i],rgba[i+1],rgba[i+2],255); } }
      if($('mode').value==='separate') { groups.push({name:file.name,data}); } else { combined.push(data); }
      await sleep();
    }
    if($('mode').value==='combined') { groups.push({name:'Общая палитра',data:combined.flat()}); }
    for(const group of groups) {
      if(!group.data.length) { continue; }
      const data=new Uint8Array(group.data); const colors=paletteGroups(data,quantize(data,count)); results.push({name:group.name,colors});
      const panel=document.createElement('section'); panel.className='panel'; const title=document.createElement('h2'); title.textContent=group.name;
      const strip=document.createElement('div'); strip.className='palette-strip'; const info=document.createElement('div'); info.className='palette-info'; info.setAttribute('aria-live','polite');
      for(const item of colors) {
        const button=document.createElement('button'); button.className='palette-bucket'; button.style.width=`${item.percent}%`; button.style.background=item.hex; button.title=`${item.hex.toUpperCase()} · ${item.percent.toFixed(2)}%`; button.setAttribute('aria-label',button.title);
        let offset=0; const gradient=item.sources.map(source=>{ const start=offset; offset+=source.count/item.total*100; return `${source.hex} ${start}% ${offset}%`; }).join(',');
        function show() {
          button.style.background=`linear-gradient(to bottom,${gradient})`;
          info.innerHTML=`<strong>${item.hex.toUpperCase()} · ${item.percent.toFixed(2)}% палитры</strong><p>Точно этот цвет: ${(item.exact/item.total*100).toFixed(2)}% сегмента; ближайшие оттенки: ${((1-item.exact/item.total)*100).toFixed(2)}%.</p><div class="chips">${item.sources.slice(0,80).map(source=>`<span class="chip"><i style="display:inline-block;width:12px;height:12px;background:${source.hex}"></i> ${source.hex.toUpperCase()} · ${(source.count/item.total*100).toFixed(2)}%</span>`).join('')}</div>${item.sources.length>80?`<small>Ещё оттенков: ${item.sources.length-80}. Полный состав — в JSON.</small>`:''}`;
        }
        button.onmouseenter=show; button.onfocus=show; button.onmouseleave=()=>{button.style.background=item.hex;}; button.onblur=()=>{button.style.background=item.hex;}; button.onclick=()=>{show();copy(item.hex).catch(error=>status(error.message,true));}; strip.append(button);
      }
      panel.append(title,strip,info); $('palettes').append(panel);
    }
    status(`Палитр: ${results.length}. Цвета объединяются с ближайшим представителем в OKLab.`);
  });
  action('save',async()=>{
    if(!results.length) { throw new Error('Сначала извлеки палитру.'); } const items=[];
    for(const result of results) {
      const c=canvas(1200,160);const ctx=c.getContext('2d');let x=0;
      for(const item of result.colors) {const width=item.percent*12;ctx.fillStyle=item.hex;ctx.fillRect(x,0,width+1,160);x+=width;}
      const base=baseName(result.name);items.push({name:`${base}.png`,blob:await toBlob(c)},{name:`${base}.json`,blob:new Blob([JSON.stringify(result,null,2)],{type:'application/json'})},{name:`${base}.gpl`,blob:new Blob([`GIMP Palette\nName: ${result.name}\n#\n${result.colors.map(item=>`${item.rgb.join(' ')}\t${item.hex}`).join('\n')}`])});
    }
    await bundle(items,'palettes.zip');
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
  root.innerHTML = `<div class="two"><section class="panel"><label>Текст<textarea id="text">GRAYMANSION\n2026</textarea></label><div class="row">${select('style', 'Конструкция', [['9', '9 сегментов'], ['14', 'Расширенная панель']])}${field('size', 'Высота символа, px', 'number', 100, 'min="24" max="400"')}${field('thickness', 'Толщина сегмента', 'number', 9, 'min="2" max="20"')}${field('gap', 'Между символами', 'number', 12, 'min="0" max="100"')}</div><div class="row">${field('active', 'Активный цвет', 'color', '#91f7bf')}${field('inactive', 'Неактивный цвет', 'color', '#253b31')}${field('background', 'Фон', 'color', '#101a15')}</div><div class="row">${select('faultMode', 'Неисправность панели', [['none','Нет'],['dim','Тусклые'],['off','Не горят'],['stuck','Постоянно горят'],['flicker','Мерцают']])}${field('faultKeys', 'Сегменты с неисправностью (a–m)', 'text', 'abg')}</div><div class="row"><label><input id="glow" type="checkbox" checked> Свечение</label><label><input id="transparent" type="checkbox"> Прозрачный фон</label></div><div class="actions"><button id="render" class="primary">Обновить</button><button id="save">Скачать PNG</button><button id="svg">Скачать SVG</button></div><p class="muted">Расширенная панель лучше передаёт кириллицу. В режиме 9 сегментов сложные буквы стилизованы приблизительно.</p></section><section class="panel checker preview-wrap"><canvas id="preview"></canvas></section></div><section class="panel"><h2>Собственный символ</h2><div class="row">${field('char', 'Символ', 'text', 'А', 'maxlength="1"')}${field('mask', 'Активные сегменты: a–m', 'text', 'abcefg')}</div><div class="chips" id="segmentKeys"></div><div class="actions"><button id="custom">Применить к символу</button></div></section>`;
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
          const fault = $('faultKeys').value.includes(key); const mode = $('faultMode').value;
          let on = mask.includes(key);
          if (fault && mode === 'off') { on = false; }
          if (fault && mode === 'stuck') { on = true; }
          if (fault && mode === 'flicker' && Math.sin(performance.now() / 75 + col * 7 + row * 11 + key.charCodeAt(0)) < .1) { on = false; }
          ctx.globalAlpha = fault && mode === 'dim' && on ? .22 : 1;
          const [x1, y1, x2, y2] = coords.map((v, i) => v * unit + (i % 2 ? oy : ox));
          ctx.lineWidth = thickness * unit; ctx.lineCap = 'butt'; ctx.strokeStyle = on ? active : inactive;
          ctx.shadowColor = active; ctx.shadowBlur = on && $('glow').checked ? 12 * unit : 0;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          shapes.push(`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${on ? active : inactive}" stroke-width="${thickness * unit}" opacity="${ctx.globalAlpha}"/>`);
        }
        if (char === '.' || char === ':') {
          ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.fillStyle = active;
          for (const cy of char === ':' ? [60, 125] : [170]) {
            ctx.fillRect(ox + 45 * unit, oy + cy * unit, 10 * unit, 10 * unit);
            shapes.push(`<rect x="${ox + 45 * unit}" y="${oy + cy * unit}" width="${10 * unit}" height="${10 * unit}" fill="${active}"/>`);
          }
        }
      }
    }
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${transparent ? '' : `<rect width="100%" height="100%" fill="${bg}"/>`}${shapes.join('')}</svg>`;
    ctx.globalAlpha = 1;
    status('PNG и SVG сохраняют текущий кадр. Мерцание видно в предпросмотре.');
  }
  action('render', render);
  action('save', async () => { render(); download(await toBlob($('preview')), 'segment-text.png'); });
  action('svg', () => { render(); download(new Blob([svg], {type: 'image/svg+xml'}), 'segment-text.svg'); });
  action('custom', () => { custom[$('char').value.toUpperCase()] = $('mask').value; render(); });
  root.addEventListener('change', () => { try { render(); } catch (error) { status(error.message, true); } });
  const faultTimer = setInterval(() => { if ($('faultMode').value === 'flicker') { try { render(); } catch (error) { status(error.message, true); } } }, 120);
  teardown(() => clearInterval(faultTimer));
  render();
}

export async function icons(root) {
  const {encodeIco, decodeIco} = await import('../vendor/vendor.js');
  root.innerHTML = `<section class="panel">${files('file', '.png,.ico,image/png,image/x-icon', false)}<div class="row">${field('sizes', 'Размеры PNG через запятую', 'text', '1024,512,256,128,64,48,32,16')}${field('padding', 'Поля, %', 'number', 0, 'min="0" max="40"')}${select('sampling', 'Масштабирование', [['smooth', 'Плавное'], ['nearest', 'Без сглаживания']])}</div><div class="actions"><button id="previewButton" class="primary">Показать набор</button><button id="export">Скачать PNG + ICO</button></div><p class="muted">ICO включает размеры до 256 px. Более крупные варианты сохраняются в PNG.</p></section><section class="panel"><h2>Читаемость в реальном размере</h2><div id="readability" class="readability-grid"></div><h2 style="margin-top:20px">Размерный ряд</h2><div id="sizesPreview" class="grid"></div><div id="icoFrames" class="muted"></div></section><section class="panel"><h2>Иконка в контексте — 20 вариантов</h2><div id="contexts" class="grid"></div></section>`;
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
    $('readability').replaceChildren();
    for (const background of ['light','dark','busy']) { const row = document.createElement('div'); row.className = `icon-readability ${background}`; for (const size of [16,20,24,32,48]) { const item = document.createElement('div'); const image = document.createElement('img'); image.src = iconURL; image.style.width = `${size}px`; image.style.height = `${size}px`; const label = document.createElement('small'); label.textContent = `${size} px`; item.append(image,label); row.append(item); } $('readability').append(row); }
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
