import { $, select, field, files, action, status, readImage, download, toBlob, teardown } from '../ui.js';

export function setupTextureChecker(root) {
  const generator = document.createElement('div');
  generator.append(...root.children);
  generator.hidden = true;
  root.append(generator);
  const controls = document.createElement('section');
  controls.className = 'panel';
  controls.innerHTML = select('textureMode', 'Режим', [['check', 'Проверка своей картинки'], ['generate', 'Генератор текстур']]);
  const checker = document.createElement('section');
  checker.className = 'panel';
  checker.innerHTML = `<p class="muted">Загрузи текстуру: картинка повторяется вплотную, без добавления фона, полей или эффектов. Швы видны на стыках.</p>${files('textureFile', 'image/png,image/jpeg,image/webp,image/bmp', false)}<div class="row">${select('textureRepeats', 'Сетка повторений', [['2', '2 × 2'], ['3', '3 × 3'], ['5', '5 × 5'], ['8', '8 × 8']])}${field('textureZoom', 'Масштаб просмотра, %', 'number', 100, 'min="25" max="800" step="25"')}${field('textureBackground', 'Фон прозрачности', 'color', '#ffffff')}</div><div class="actions"><label><input id="textureGrid" type="checkbox"> Границы тайлов</label><label><input id="textureOffset" type="checkbox"> Сдвиг на полтайла</label><label><input id="texturePixels" type="checkbox"> Чёткие пиксели</label><button id="textureFit">Вписать</button><button id="textureExport" disabled>Скачать повторение PNG</button></div><p id="textureInfo" class="muted" role="status">Картинка ещё не выбрана.</p><div id="textureViewport" style="overflow:auto;max-height:560px;border:1px solid #dce1eb;border-radius:8px"><div id="textureStage" style="position:relative;min-height:240px;background-repeat:repeat"><div id="textureGuides" style="position:absolute;inset:0;pointer-events:none"></div></div></div>`;
  root.prepend(controls, checker);
  $('textureRepeats').value = '3';
  let image = null;
  let imageURL = '';
  let name = '';
  let loading = 0;
  let disposed = false;
  function update() {
    if (!image) { return; }
    const repeats = Number($('textureRepeats').value);
    const zoom = Math.max(25, Math.min(800, Number($('textureZoom').value) || 100));
    const stage = $('textureStage');
    const width = Math.max(1, $('textureViewport').clientWidth) * zoom / 100;
    const offset = $('textureOffset').checked ? width / repeats / 2 : 0;
    stage.style.width = `${width}px`;
    stage.style.height = `${width * image.height / image.width}px`;
    stage.style.minHeight = '0';
    stage.style.backgroundImage = `url("${imageURL}")`;
    stage.style.backgroundSize = `${100 / repeats}% ${100 / repeats}%`;
    stage.style.backgroundPosition = `${offset}px ${offset * image.height / image.width}px`;
    stage.style.backgroundColor = $('textureBackground').value;
    stage.style.imageRendering = $('texturePixels').checked ? 'pixelated' : 'auto';
    const guides = $('textureGuides');
    guides.style.backgroundImage = $('textureGrid').checked
      ? 'linear-gradient(to right,#e64c73 1px,transparent 1px),linear-gradient(to bottom,#e64c73 1px,transparent 1px)' : 'none';
    guides.style.backgroundSize = stage.style.backgroundSize;
    guides.style.backgroundPosition = stage.style.backgroundPosition;
    $('textureInfo').textContent = `${name} · ${image.width} × ${image.height} px · ${repeats} × ${repeats} повторений. Исходная картинка используется целиком.`;
  }
  $('textureFile').addEventListener('change', async () => {
    const ticket = ++loading;
    try {
      const file = $('textureFile').files[0];
      if (!file) { return; }
      if (file.size > 40e6) { throw new Error('Изображение должно быть не больше 40 МБ.'); }
      const next = await readImage(file);
      if (disposed || ticket !== loading) { next.close(); return; }
      const url = URL.createObjectURL(file);
      image?.close();
      if (imageURL) { URL.revokeObjectURL(imageURL); }
      image = next; imageURL = url; name = file.name;
      $('textureExport').disabled = false;
      update();
      status('Картинка загружена для проверки стыков.');
    } catch (error) { status(error.message, true); }
  });
  for (const id of ['textureRepeats', 'textureZoom', 'textureBackground', 'textureGrid', 'textureOffset', 'texturePixels']) {
    $(id).addEventListener('input', update);
  }
  $('textureMode').addEventListener('change', () => {
    const check = $('textureMode').value === 'check';
    checker.hidden = !check; generator.hidden = check;
    if (check) { update(); }
    status('');
  });
  action('textureFit', () => { $('textureZoom').value = '100'; update(); });
  action('textureExport', async () => {
    if (!image) { return; }
    const repeats = Number($('textureRepeats').value);
    const scale = Math.min(1, 4096 / Math.max(image.width * repeats, image.height * repeats));
    const tileWidth = Math.max(1, Math.floor(image.width * scale));
    const tileHeight = Math.max(1, Math.floor(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = tileWidth * repeats; canvas.height = tileHeight * repeats;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = !$('texturePixels').checked;
    for (let y = 0; y < repeats; y++) {
      for (let x = 0; x < repeats; x++) {
        context.drawImage(image, x * tileWidth, y * tileHeight, tileWidth, tileHeight);
      }
    }
    download(await toBlob(canvas), `${name.replace(/\.[^.]+$/, '')}-repeat-${repeats}x${repeats}.png`);
    status(`Повторение ${canvas.width} × ${canvas.height} px скачано. Экспорт без направляющих; максимум 4096 px по стороне.`);
  });
  const observer = new ResizeObserver(update);
  observer.observe($('textureViewport'));
  teardown(() => { disposed = true; loading++; observer.disconnect(); image?.close(); if (imageURL) { URL.revokeObjectURL(imageURL); } });
}
