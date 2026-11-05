import {$, field, select, files, action, status, number, readImage, download, teardown} from '../ui.js';
import {puzzleGame, puzzleMarkup} from '../puzzle-runtime.js?v=20261105-puzzle-google';
import {puzzleTextEditor} from '../puzzle-text.js?v=20261105-puzzle-google';

export async function puzzles(root) {
  root.innerHTML = `<section class="panel"><div class="row">${select('sourceType', 'Источник', [['image', 'Картинка'], ['text', 'Текстовые блоки']])}${select('mode', 'Режим игры', [['jigsaw', 'Пазл с выступами'], ['sliding', 'Пятнашки'], ['swap', 'Мозаика · обмен фрагментов']])}${field('gridColumns', 'Столбцы', 'number', 3, 'min="2" max="8" step="1"')}${field('gridRows', 'Строки', 'number', 3, 'min="2" max="8" step="1"')}${field('seed', 'Seed перемешивания', 'text', 'Puzzle-42')}</div><div id="puzzleImageSource"><p class="muted">Загрузи картинку или используй пример. Пропорции сохраняются, картинка делится целиком без обрезки.</p>${files('image', 'image/png,image/jpeg,image/webp,image/bmp', false)}</div><div id="puzzleTextSource" hidden></div><div class="actions"><button id="build" class="primary">Создать / перемешать</button><button id="randomSeed">Новый seed</button><button id="saveLayout">Скачать собранный пазл PNG</button><button id="saveGame">Скачать игру HTML</button><button id="saveProject">Скачать проект</button></div>${files('project', '.json', false)}<p class="muted">HTML — самостоятельная игра с картинкой и надписями внутри. Настройки применяются кнопкой «Создать». Текстовые блоки редактируются в проекте. Пятнашки перемешиваются разрешёнными ходами и имеют решение.</p></section><section id="game" class="panel">${puzzleMarkup()}</section>`;
  let imageData = ''; let imageWidth = 960; let imageHeight = 600; let dispose; let active; let disposed = false;
  function grid() {
    const columns = number('gridColumns'); const rows = number('gridRows');
    if (![columns, rows].every(value => Number.isInteger(value) && value >= 2 && value <= 8)) {
      throw new Error('Число строк и столбцов — целые числа от 2 до 8.');
    }
    return {columns, rows};
  }
  const editor = puzzleTextEditor($('puzzleTextSource'), grid);
  function showSource() {
    const text = $('sourceType').value === 'text';
    $('puzzleImageSource').hidden = text; $('puzzleTextSource').hidden = !text;
    if (text) { try { editor.syncGrid(); } catch (error) { status(error.message, true); } }
  }
  $('sourceType').addEventListener('change', showSource);
  for (const id of ['gridColumns', 'gridRows']) {
    $(id).addEventListener('change', () => { try { editor.syncGrid(); } catch (error) { status(error.message, true); } });
  }
  function example() { const c = document.createElement('canvas'); c.width = 960; c.height = 600; const ctx = c.getContext('2d'); const g = ctx.createLinearGradient(0, 0, 960, 600); g.addColorStop(0, '#526d9e'); g.addColorStop(1, '#f2c394'); ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 600); ctx.fillStyle = '#f8e2ad'; ctx.beginPath(); ctx.arc(720, 150, 65, 0, Math.PI * 2); ctx.fill(); for (let i = 0; i < 4; i += 1) { ctx.fillStyle = ['#586a88', '#687c90', '#809294', '#445f72'][i]; ctx.beginPath(); ctx.moveTo(0, 600); for (let x = 0; x <= 960; x += 10) { ctx.lineTo(x, 300 + i * 60 + Math.sin(x / (100 + i * 20) + i) * 65); } ctx.lineTo(960, 600); ctx.fill(); } ctx.fillStyle = '#ffffffcc'; ctx.font = 'bold 45px sans-serif'; ctx.fillText('Собери момент', 45, 540); return c.toDataURL('image/png'); }
  function build() {
    const dimensions = grid();
    const seed = $('seed').value;
    if (seed.length > 200) { throw new Error('Seed — до 200 символов.'); }
    editor.syncGrid();
    const sourceType = $('sourceType').value;
    const source = sourceType === 'text' ? editor.render()
      : {image: imageData || example(), imageWidth, imageHeight};
    active = {mode: $('mode').value, ...dimensions, seed, sourceType, sourceImage: imageData, sourceImageWidth: imageWidth, sourceImageHeight: imageHeight, ...source};
    dispose?.(); $('game').innerHTML = puzzleMarkup(); dispose = puzzleGame($('game'), active);
    status(`Игра создана: ${dimensions.columns} × ${dimensions.rows}, ${dimensions.columns * dimensions.rows} фрагментов.`);
  }
  action('build', build);
  action('randomSeed', () => { $('seed').value = String(crypto.getRandomValues(new Uint32Array(1))[0]); build(); });
  $('image').addEventListener('change', async () => {
    try {
      const file = $('image').files[0]; if (!file) { return; }
      if (file.size > 25e6) { throw new Error('Картинка — до 25 МБ.'); }
      const image = await readImage(file);
      if (disposed) { image.close(); return; }
      const canvas = document.createElement('canvas'); const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); image.close();
      imageData = canvas.toDataURL('image/png'); imageWidth = canvas.width; imageHeight = canvas.height; build();
    } catch (error) { status(error.message, true); }
  });
  action('saveLayout', async () => {
    build(); const response = await fetch(active.image); download(await response.blob(), 'puzzle-layout.png');
  });
  action('saveGame', () => {
    build();
    const json = JSON.stringify(active).replace(/</g, '\\u003c');
    const html = `<!doctype html><html lang="ru"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Головоломка · GrayMansion</title><style>body{margin:0;padding:20px;background:#fff;color:#30384c;font:15px system-ui}main{max-width:850px;margin:auto}canvas{display:block;width:100%;height:auto;border-radius:12px;touch-action:none}button{background:#626f8d;color:white;border:0;padding:12px;border-radius:8px;cursor:pointer}.actions{display:flex;gap:16px;flex-wrap:wrap;align-items:center}p{line-height:1.6}input{accent-color:#626f8d}</style><main><h1>Головоломка</h1><p>Пазл: перетаскивай фрагменты на поле. Мозаика: выбери два фрагмента. Пятнашки: двигай соседнюю с пустой клетку; также работают стрелки.</p>${puzzleMarkup()}<p>GrayMansion Tools · Локальная игра</p></main><script>(${puzzleGame.toString()})(document.querySelector('main'),${json});<\/script></html>`;
    download(new Blob([html], {type: 'text/html;charset=utf-8'}), 'picture-puzzle.html');
  });
  action('saveProject', () => {
    build();
    const text = editor.settings();
    download(new Blob([JSON.stringify({format: 'GM Puzzle', version: 2, ...active, text})], {type: 'application/json'}), 'puzzle-project.json');
  });
  $('project').addEventListener('change', async () => {
    try {
      const file = $('project').files[0]; if (!file) { return; }
      if (file.size > 35e6) { throw new Error('Проект — до 35 МБ.'); }
      const data = JSON.parse(await file.text());
      const columns = data.columns || data.grid; const rows = data.rows || data.grid;
      const validImage = value => typeof value === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value);
      if (data.format !== 'GM Puzzle' || ![1, 2].includes(data.version) || !['sliding', 'swap', 'jigsaw'].includes(data.mode)
        || ![columns, rows].every(value => Number.isInteger(value) && value >= 2 && value <= 8)
        || typeof data.seed !== 'string' || data.seed.length > 200 || !validImage(data.image)
        || (data.sourceType && !['image', 'text'].includes(data.sourceType))
        || (data.sourceImage && !validImage(data.sourceImage))) { throw new Error('Неверный проект головоломки.'); }
      const source = data.sourceType === 'text' ? data.sourceImage || '' : data.image;
      const bitmap = await createImageBitmap(await (await fetch(source || data.image)).blob());
      const width = bitmap.width; const height = bitmap.height; bitmap.close();
      if (width > 4096 || height > 4096 || disposed) { throw new Error('Изображение проекта — до 4096 px по стороне.'); }
      const previous = {mode: $('mode').value, columns: $('gridColumns').value, rows: $('gridRows').value,
        seed: $('seed').value, sourceType: $('sourceType').value, text: editor.settings()};
      try {
        $('mode').value = data.mode; $('gridColumns').value = columns; $('gridRows').value = rows;
        $('seed').value = data.seed; $('sourceType').value = data.sourceType || 'image'; editor.syncGrid();
        if (data.text) { await editor.load(data.text); }
        else if (data.sourceType === 'text') { throw new Error('В проекте нет текстовых блоков.'); }
      } catch (error) {
        $('mode').value = previous.mode; $('gridColumns').value = previous.columns; $('gridRows').value = previous.rows;
        $('seed').value = previous.seed; $('sourceType').value = previous.sourceType;
        editor.syncGrid(); await editor.load(previous.text); showSource(); throw error;
      }
      imageData = source; imageWidth = source ? width : 960; imageHeight = source ? height : 600;
      showSource(); build();
    } catch (error) { status(error.message, true); }
  });
  teardown(() => { disposed = true; editor.dispose(); dispose?.(); }); build();
}
