import { $, esc, field, select, files, action, status, number, canvas, readImage, toBlob, download, sleep, teardown } from '../ui.js';

export function stylize(root) {
  root.innerHTML = `<section class="panel">${files('styleFile', 'image/*,.ico', false)}<div class="row">${select('effect', 'Стилизация', [['dots', 'Полутоновые точки'], ['lines', 'Параллельная штриховка'], ['cross', 'Перекрёстная штриховка'], ['engrave', 'Гравюра'], ['contour', 'Контуры'], ['dither', 'Дизеринг Floyd–Steinberg'], ['ordered', 'Газетный растр']])}${field('styleWidth', 'Ширина результата, px', 'number', 1200, 'min="64" max="2400"')}${field('cell', 'Шаг рисунка, px', 'number', 9, 'min="3" max="60"')}${field('angle', 'Угол, °', 'number', 35, 'min="-180" max="180"')}</div><div class="row">${field('contrast', 'Контраст, ×', 'number', 1.2, 'min="0.1" max="4" step="0.1"')}${field('brightness', 'Яркость, −100…100', 'number', 0, 'min="-100" max="100"')}${field('inkColor', 'Чернила', 'color', '#35394a')}${field('paperColor', 'Бумага', 'color', '#faf8f1')}</div><label><input type="checkbox" id="invertStyle"> Инвертировать свет и тень</label><div class="actions"><button id="applyStyle" class="primary">Применить</button><button id="stylePNG" disabled>Скачать PNG</button><button id="styleSVG" disabled>Скачать SVG</button></div><p class="muted">Все эффекты работают локально. Прозрачные области исходника заполняются цветом бумаги. SVG доступен для точек и штриховки. Шаг и угол применяются к точкам и штрихам; дизеринг работает по пикселям.</p></section><div class="two"><section class="panel"><h2>Исходник</h2><canvas id="styleOriginal"></canvas></section><section class="panel"><h2>Результат</h2><canvas id="styleResult"></canvas></section></div>`;
  let image; let vector = ''; let generation = 0;
  $('styleFile').onchange = async () => {
    const file = $('styleFile').files[0]; if (!file) { return; }
    try { image?.close(); image = await readImage(file); $('styleOriginal').width = Math.min(1200, image.width); $('styleOriginal').height = Math.round(image.height * $('styleOriginal').width / image.width); $('styleOriginal').getContext('2d').drawImage(image, 0, 0, $('styleOriginal').width, $('styleOriginal').height); status('Изображение готово.'); }
    catch (error) { status(error.message, true); }
  };
  action('applyStyle', async () => {
    if (!image) { throw new Error('Выбери изображение.'); }
    const width = Math.round(number('styleWidth', 1200)); const height = Math.round(image.height / image.width * width);
    if (width < 64 || width > 2400 || width * height > 6e6) { throw new Error('Ширина 64–2400 px, до 6 млн пикселей.'); }
    const cell = Math.round(number('cell', 9)); if (cell < 3 || cell > 60) { throw new Error('Шаг — 3–60 px.'); }
    const run = ++generation; const source = canvas(width, height); const context = source.getContext('2d', {willReadFrequently: true});
    const paper = $('paperColor').value; const ink = $('inkColor').value; const effect = $('effect').value;
    context.fillStyle = paper; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data; const gray = new Float32Array(width * height);
    const contrast = Math.max(.1, Math.min(4, number('contrast', 1.2))); const brightness = Math.max(-100, Math.min(100, number('brightness')));
    for (let i = 0; i < gray.length; i += 1) {
      let value = ((pixels[i * 4] * .2126 + pixels[i * 4 + 1] * .7152 + pixels[i * 4 + 2] * .0722) / 255 - .5) * contrast + .5 + brightness / 100;
      value = Math.max(0, Math.min(1, value)); gray[i] = $('invertStyle').checked ? 1 - value : value;
    }
    const output = $('styleResult'); output.width = width; output.height = height;
    const ctx = output.getContext('2d'); ctx.fillStyle = paper; ctx.fillRect(0, 0, width, height); ctx.fillStyle = ink; ctx.strokeStyle = ink;
    const paths = []; const angle = number('angle', 35) * Math.PI / 180;
    function stroke(x, y, length, rotation, thickness) {
      const dx = Math.cos(rotation) * length / 2; const dy = Math.sin(rotation) * length / 2;
      ctx.lineWidth = thickness; ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
      paths.push(`<path d="M${(x - dx).toFixed(2)} ${(y - dy).toFixed(2)}l${(2 * dx).toFixed(2)} ${(2 * dy).toFixed(2)}" stroke="${ink}" stroke-width="${thickness.toFixed(2)}"/>`);
    }
    const at = (x, y) => gray[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))];
    status('Стилизация…');
    if (['dither', 'ordered', 'contour'].includes(effect)) {
      const bayer = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = y * width + x; let dark;
          if (effect === 'contour') {
            const gx = -at(x - 1, y - 1) + at(x + 1, y - 1) - 2 * at(x - 1, y) + 2 * at(x + 1, y) - at(x - 1, y + 1) + at(x + 1, y + 1);
            const gy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
            dark = Math.hypot(gx, gy) > .25;
          } else if (effect === 'ordered') { dark = gray[index] < (bayer[(y % 4) * 4 + x % 4] + .5) / 16; }
          else {
            const old = gray[index]; const value = old < .5 ? 0 : 1; dark = value === 0; const error = old - value;
            if (x + 1 < width) { gray[index + 1] += error * 7 / 16; }
            if (y + 1 < height) {
              if (x > 0) { gray[index + width - 1] += error * 3 / 16; }
              gray[index + width] += error * 5 / 16;
              if (x + 1 < width) { gray[index + width + 1] += error / 16; }
            }
          }
          if (dark) { ctx.fillRect(x, y, 1, 1); }
        }
        if (y % 60 === 0) { await sleep(); if (generation !== run) { return; } }
      }
    } else {
      for (let y = cell / 2; y < height; y += cell) {
        for (let x = cell / 2; x < width; x += cell) {
          let sum = 0; let count = 0;
          for (let sy = Math.max(0, Math.floor(y - cell / 2)); sy < Math.min(height, y + cell / 2); sy += 2) {
            for (let sx = Math.max(0, Math.floor(x - cell / 2)); sx < Math.min(width, x + cell / 2); sx += 2) { sum += gray[sy * width + sx]; count += 1; }
          }
          const darkness = 1 - sum / count;
          if (darkness < .025) { continue; }
          if (effect === 'dots') {
            const radius = Math.sqrt(darkness) * cell * .55; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
            paths.push(`<circle cx="${x}" cy="${y}" r="${radius.toFixed(2)}" fill="${ink}"/>`);
          } else {
            stroke(x, y, cell * 1.35, angle, Math.max(.4, darkness * cell * (effect === 'cross' ? .28 : .65)));
            if (effect === 'cross' && darkness > .4) { stroke(x, y, cell * 1.35, angle + Math.PI / 2, (darkness - .3) * cell * .4); }
            if (effect === 'engrave') { stroke(x, y + cell * .28, cell * .9, angle + darkness * .6, darkness * cell * .16); }
          }
        }
        if (Math.floor(y / cell) % 15 === 0) { await sleep(); if (generation !== run) { return; } }
      }
    }
    vector = paths.length ? `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><clipPath id="bounds"><rect width="${width}" height="${height}"/></clipPath></defs><rect width="100%" height="100%" fill="${paper}"/><g clip-path="url(#bounds)">${paths.join('')}</g></svg>` : '';
    $('stylePNG').disabled = false; $('styleSVG').disabled = !vector; status(`Готово: ${width} × ${height} px.`);
  });
  action('stylePNG', async () => { download(await toBlob($('styleResult')), 'stylized-image.png'); });
  action('styleSVG', () => { if (vector) { download(new Blob([vector], {type: 'image/svg+xml'}), 'stylized-image.svg'); } });
  teardown(() => { generation += 1; image?.close(); });
}
