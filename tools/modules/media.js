import { $, esc, field, select, files, action, status, number, canvas, toBlob, readImage, baseName, bundle, download, sleep, teardown } from '../ui.js';
import { decodeAudio, encodeAudio, processAudio } from '../audio-core.js';
import { parseDelimited, writeDelimited } from '../logic.js';

function drawWave(buffer, element) {
  element.width = 1000; element.height = 180;
  const ctx = element.getContext('2d'); const data = buffer.getChannelData(0);
  ctx.fillStyle = '#f5f6fa'; ctx.fillRect(0, 0, 1000, 180); ctx.strokeStyle = '#7b87a7';
  ctx.beginPath();
  const step = Math.max(1, Math.floor(data.length / 1000));
  for (let x = 0; x < 1000; x += 1) {
    let min = 1; let max = -1;
    for (let j = 0; j < step && x * step + j < data.length; j += 1) { const v = data[x * step + j]; min = Math.min(min, v); max = Math.max(max, v); }
    ctx.moveTo(x, 90 + min * 80); ctx.lineTo(x, 90 + max * 80);
  }
  ctx.stroke();
}
export async function audio(root) {
  root.innerHTML = `<section class="panel">${files('files', 'audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aac')}<label>Файл для предпросмотра<select id="selected"></select></label><p id="batchNote" class="muted"></p><audio id="original" controls hidden style="width:100%"></audio><canvas id="wave"></canvas><p id="info" class="muted"></p></section><section class="panel"><div class="row">${field('gain', 'Громкость, dB', 'number', 0, 'min="-60" max="30" step="0.5"')}<label>Громкость<input id="gainRange" type="range" min="-60" max="30" step="0.5" value="0"></label>${select('format', 'Формат результата', [['wav', 'WAV · PCM 16 bit'], ['mp3', 'MP3 · 192 kbps']])}</div><div id="singleOptions"><div class="row">${field('start', 'Начало, с', 'number', 0, 'min="0" step="0.01"')}${field('end', 'Конец, с', 'number', 1, 'min="0" step="0.01"')}${field('fadeIn', 'Появление, с', 'number', 0, 'min="0" step="0.1"')}${field('fadeOut', 'Затухание, с', 'number', 0, 'min="0" step="0.1"')}</div><div class="row">${select('channel', 'Каналы', [['original', 'Сохранить'], ['mono', 'Моно: среднее каналов'], ['left', 'Только левый'], ['right', 'Только правый'], ['swap', 'Поменять левый / правый'], ['split', 'Экспортировать каналы отдельно']])}${field('tempo', 'Темп, ×', 'number', 1, 'min="0.5" max="2" step="0.05"')}${field('pitch', 'Высота, полутонов', 'number', 0, 'min="-12" max="12" step="1"')}</div></div><div class="actions"><button id="preview" class="primary">Прослушать результат</button><button id="export">Скачать результат</button><button id="cancel">Отмена партии</button></div><audio id="processed" controls hidden style="width:100%;margin-top:18px"></audio><p class="muted">Положительное усиление может вызвать клиппинг. Уровень проверяется до экспорта. Темп и высота изменяются независимо.</p></section>`;
  let buffer; let activeFile; let originalURL; let processedURL; let cancel = false;
  async function load() {
    const chosen = [...$('files').files]; const file = chosen[Number($('selected').value) || 0];
    if (!file) { return; }
    status(`Чтение ${file.name}…`); buffer = await decodeAudio(file); activeFile = file;
    if (originalURL) { URL.revokeObjectURL(originalURL); }
    originalURL = URL.createObjectURL(file); $('original').src = originalURL; $('original').hidden = false;
    $('end').value = buffer.duration.toFixed(3); $('start').value = 0;
    drawWave(buffer, $('wave'));
    $('info').textContent = `${file.name} · ${buffer.duration.toFixed(2)} с · ${buffer.sampleRate} Hz · каналов: ${buffer.numberOfChannels}`;
    const batch = chosen.length > 1;
    $('singleOptions').hidden = batch;
    for (const input of $('singleOptions').querySelectorAll('input, select')) { input.disabled = batch; }
    $('batchNote').textContent = batch ? `Выбрано ${chosen.length} файлов. В пакетном режиме применяется только громкость; формат экспорта общий.` : 'Один файл: доступны все операции.';
    status('Файл готов. Для обрезки можно кликнуть по волне: обычный клик — начало, Shift+клик — конец.');
  }
  $('files').addEventListener('change', async () => {
    $('selected').replaceChildren(...[...$('files').files].map((file, i) => new Option(file.name, String(i))));
    try { await load(); } catch (error) { status(`Не удалось прочитать аудио: ${error.message}`, true); }
  });
  $('selected').addEventListener('change', () => { load().catch(error => status(error.message, true)); });
  $('gainRange').addEventListener('input', () => { $('gain').value = $('gainRange').value; });
  $('gain').addEventListener('input', () => { $('gainRange').value = $('gain').value; });
  $('wave').addEventListener('click', event => {
    if (!buffer || $('files').files.length > 1) { return; }
    const rect = $('wave').getBoundingClientRect(); const time = (event.clientX - rect.left) / rect.width * buffer.duration;
    $(event.shiftKey ? 'end' : 'start').value = time.toFixed(3);
  });
  function options(target) {
    const gain = number('gain');
    if (gain < -60 || gain > 30) { throw new Error('Громкость — от −60 до +30 dB.'); }
    if ($('files').files.length > 1) { return {gain, end: target.duration}; }
    const start = number('start'); const end = number('end'); const tempo = number('tempo', 1); const pitch = number('pitch');
    if (start < 0 || end <= start || end > target.duration + .01) { throw new Error('Проверь границы фрагмента.'); }
    if (tempo < .5 || tempo > 2 || pitch < -12 || pitch > 12) { throw new Error('Темп: 0.5–2×; высота: −12…+12 полутонов.'); }
    return {gain, start, end, tempo, pitch, fadeIn: number('fadeIn'), fadeOut: number('fadeOut'), channel: $('channel').value};
  }
  action('preview', async () => {
    if (!buffer) { throw new Error('Выбери аудиофайл.'); }
    status('Обработка…'); await sleep();
    const result = await processAudio(buffer, options(buffer));
    if (processedURL) { URL.revokeObjectURL(processedURL); }
    processedURL = URL.createObjectURL(await encodeAudio(result.channels, result.sampleRate, 'wav'));
    $('processed').src = processedURL; $('processed').hidden = false;
    status(`Результат: ${(result.channels[0].length / result.sampleRate).toFixed(2)} с. Пик: ${result.peak.toFixed(3)}${result.peak > 1 ? ' — клиппинг: уменьши громкость.' : '.'}`, result.peak > 1);
  });
  action('cancel', () => { cancel = true; status('Партия остановится после текущего файла.'); });
  action('export', async () => {
    const chosen = [...$('files').files]; if (!chosen.length) { throw new Error('Выбери аудиофайлы.'); }
    cancel = false; const results = []; let clipping = 0;
    for (const [i, file] of chosen.entries()) {
      if (cancel) { break; }
      status(`Обработка ${i + 1}/${chosen.length}: ${file.name}`); await sleep();
      const current = file === activeFile ? buffer : await decodeAudio(file);
      const processed = await processAudio(current, options(current));
      if (processed.peak > 1) { clipping += 1; }
      const format = $('format').value;
      if (chosen.length === 1 && $('channel').value === 'split') {
        for (const [channel, samples] of processed.channels.entries()) {
          results.push({name: `${baseName(file.name)}_${channel === 0 ? 'L' : 'R'}.${format}`, blob: await encodeAudio([samples], processed.sampleRate, format)});
        }
      } else { results.push({name: `${baseName(file.name)}_edited.${format}`, blob: await encodeAudio(processed.channels, processed.sampleRate, format)}); }
    }
    if (results.length) { await bundle(results, 'audio-results.zip'); }
    status(`${cancel ? 'Остановлено.' : 'Готово.'} Результатов: ${results.length}.${clipping ? ` Клиппинг в ${clipping} файлах: уменьши усиление для сохранения пиков.` : ''}`, clipping > 0);
  });
  teardown(() => { if (originalURL) { URL.revokeObjectURL(originalURL); } if (processedURL) { URL.revokeObjectURL(processedURL); } });
}

function bmp(c) {
  const w = c.width; const h = c.height; const stride = Math.ceil(w * 3 / 4) * 4;
  const out = new ArrayBuffer(54 + stride * h); const view = new DataView(out);
  view.setUint16(0, 0x4d42, true); view.setUint32(2, out.byteLength, true); view.setUint32(10, 54, true);
  view.setUint32(14, 40, true); view.setInt32(18, w, true); view.setInt32(22, h, true);
  view.setUint16(26, 1, true); view.setUint16(28, 24, true); view.setUint32(34, stride * h, true);
  const data = c.getContext('2d').getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const source = ((h - 1 - y) * w + x) * 4; const target = 54 + y * stride + x * 3;
      view.setUint8(target, data[source + 2]); view.setUint8(target + 1, data[source + 1]); view.setUint8(target + 2, data[source]);
    }
  }
  return new Blob([out], {type: 'image/bmp'});
}
function plainHTML(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const element of doc.querySelectorAll('script,style,iframe,object,embed,link,meta')) { element.remove(); }
  for (const element of doc.querySelectorAll('*')) {
    for (const attr of [...element.attributes]) {
      if (/^on/i.test(attr.name) || ['srcdoc', 'style'].includes(attr.name) || (['href', 'src', 'action'].includes(attr.name) && /^\s*(javascript|data|vbscript):/i.test(attr.value))) { element.removeAttribute(attr.name); }
    }
  }
  return doc.body.innerHTML;
}
async function textPDF(text) {
  const {PDFDocument} = await import('../vendor/vendor.js');
  const pdf = await PDFDocument.create();
  const c = canvas(1240, 1754); const ctx = c.getContext('2d'); ctx.font = '24px sans-serif';
  const lines = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      if (ctx.measureText(`${line} ${word}`).width > 1090 && line) { lines.push(line); line = word; }
      else { line = line ? `${line} ${word}` : word; }
    }
    lines.push(line);
  }
  if (lines.length > 5000) { throw new Error('Слишком большой документ: более 5000 строк после переноса.'); }
  for (let offset = 0; offset < Math.max(1, lines.length); offset += 48) {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.fillStyle = '#202029';
    for (let i = 0; i < 48 && offset + i < lines.length; i += 1) { ctx.fillText(lines[offset + i], 75, 95 + i * 32); }
    const image = await pdf.embedPng(await (await toBlob(c)).arrayBuffer());
    pdf.addPage([595.28, 841.89]).drawImage(image, {x: 0, y: 0, width: 595.28, height: 841.89});
    await sleep();
  }
  return new Blob([await pdf.save()], {type: 'application/pdf'});
}
export async function converter(root) {
  const vendor = await import('../vendor/vendor.js');
  root.innerHTML = `<section class="panel"><div class="row">${select('family', 'Тип файлов', [['image', 'Изображения'], ['audio', 'Аудио'], ['document', 'Текстовые документы'], ['table', 'Таблицы']])}${select('format', 'Выходной формат', [])}</div>${files('files')}<p id="support" class="muted"></p><div id="imageOptions" class="row">${field('width', 'Ширина, 0 = исходная', 'number', 0, 'min="0" max="16384"')}${field('height', 'Высота, 0 = по пропорциям', 'number', 0, 'min="0" max="16384"')}${field('quality', 'Качество JPEG / WebP, %', 'number', 90, 'min="1" max="100"')}${field('background', 'Фон без прозрачности', 'color', '#ffffff')}</div><div class="actions"><button id="convert" class="primary">Преобразовать и скачать</button><button id="cancel">Отменить партию</button></div><pre id="report"></pre></section>`;
  const formats = {image: ['png', 'jpeg', 'webp', 'bmp', 'gif', 'ico', 'pdf'], audio: ['wav', 'mp3'], document: ['txt', 'md', 'html', 'pdf'], table: ['csv', 'tsv', 'json', 'md', 'xlsx']};
  const descriptions = {
    image: 'Вход: PNG, JPEG, WebP, BMP, GIF (первый кадр), SVG и ICO. GIF на выходе статический. ICO — до 256 px. BMP сохраняется без прозрачности.',
    audio: 'Вход: WAV, MP3, OGG, FLAC, M4A и другие форматы, которые декодирует твой браузер. Выход: WAV или MP3. Видео не обрабатывается.',
    document: 'Вход: TXT, MD, HTML, DOCX. Преобразуется текст документа. PDF формируется как страницы с текстом; исходная вёрстка DOCX не переносится. PDF на входе пока не поддерживается.',
    table: 'Вход: CSV (запятая), TSV, JSON-массив, XLSX/XLS. Для выбора разделителя и листа используй отдельный конвертер таблиц.'
  };
  const accepts = {image: 'image/*,.ico,.svg', audio: 'audio/*,.flac,.m4a', document: '.txt,.md,.html,.htm,.docx', table: '.csv,.tsv,.json,.xlsx,.xls'};
  function update() {
    const family = $('family').value;
    $('format').replaceChildren(...formats[family].map(value => new Option(value.toUpperCase(), value)));
    $('support').textContent = descriptions[family]; $('imageOptions').hidden = family !== 'image'; $('files').accept = accepts[family];
  }
  $('family').addEventListener('change', update); update();
  let cancelled = false;
  action('cancel', () => { cancelled = true; status('Остановка после текущего файла.'); });
  action('convert', async () => {
    const chosen = [...$('files').files]; if (!chosen.length) { throw new Error('Выбери файлы.'); }
    const family = $('family').value; const format = $('format').value;
    const results = []; const report = []; cancelled = false;
    for (const [index, file] of chosen.entries()) {
      if (cancelled) { break; }
      status(`${index + 1}/${chosen.length}: ${file.name}`); await sleep();
      try {
        let blob;
        if (family === 'image') {
          const image = await readImage(file);
          const requestedW = Math.floor(number('width')); const requestedH = Math.floor(number('height'));
          let width = requestedW || (requestedH ? Math.round(image.width * requestedH / image.height) : image.width);
          let height = requestedH || (requestedW ? Math.round(image.height * requestedW / image.width) : image.height);
          if (format === 'ico') { const ratio = Math.min(1, 256 / Math.max(width, height)); width = Math.max(1, Math.round(width * ratio)); height = Math.max(1, Math.round(height * ratio)); }
          const c = canvas(width, height); const ctx = c.getContext('2d');
          if (['jpeg', 'bmp', 'pdf'].includes(format)) { ctx.fillStyle = $('background').value; ctx.fillRect(0, 0, width, height); }
          ctx.drawImage(image, 0, 0, width, height); image.close();
          if (format === 'bmp') { blob = bmp(c); }
          else if (format === 'gif') {
            const rgba = ctx.getImageData(0, 0, width, height).data;
            const palette = vendor.quantize(rgba, 256, {format: 'rgba4444'});
            const indexed = vendor.applyPalette(rgba, palette, 'rgba4444');
            const transparentIndex = palette.findIndex(color => color[3] === 0);
            const gif = vendor.GIFEncoder(); gif.writeFrame(indexed, width, height, {palette, transparent: transparentIndex >= 0, transparentIndex: Math.max(0, transparentIndex), delay: 100}); gif.finish(); blob = new Blob([gif.bytes()], {type: 'image/gif'});
          } else if (format === 'ico') { blob = new Blob([await vendor.encodeIco([{buffer: await (await toBlob(c)).arrayBuffer(), usePngIcon: true}])], {type: 'image/x-icon'}); }
          else if (format === 'pdf') {
            const pdf = await vendor.PDFDocument.create(); const imagePDF = await pdf.embedPng(await (await toBlob(c)).arrayBuffer());
            pdf.addPage([width, height]).drawImage(imagePDF, {x: 0, y: 0, width, height}); blob = new Blob([await pdf.save()], {type: 'application/pdf'});
          } else {
            blob = await toBlob(c, `image/${format}`, Math.max(.01, Math.min(1, number('quality', 90) / 100)));
            if (blob.type !== `image/${format}`) { throw new Error(`Браузер не кодирует ${format.toUpperCase()}.`); }
          }
        } else if (family === 'audio') {
          const decoded = await decodeAudio(file);
          const channels = Array.from({length: Math.min(2, decoded.numberOfChannels)}, (_, i) => decoded.getChannelData(i));
          blob = await encodeAudio(channels, decoded.sampleRate, format);
        } else if (family === 'document') {
          const extension = file.name.split('.').pop().toLowerCase();
          let text; let html;
          if (extension === 'docx') {
            html = plainHTML((await vendor.mammoth.convertToHtml({arrayBuffer: await file.arrayBuffer()})).value);
            text = (await vendor.mammoth.extractRawText({arrayBuffer: await file.arrayBuffer()})).value;
          } else {
            const input = await file.text();
            html = plainHTML(extension === 'md' ? vendor.marked.parse(input) : ['html', 'htm'].includes(extension) ? input : `<pre>${esc(input)}</pre>`);
            text = ['html', 'htm'].includes(extension) ? new DOMParser().parseFromString(html.replace(/<\/(p|div|h[1-6]|li)>/gi, '$&\n'), 'text/html').body.textContent : input;
          }
          if (format === 'pdf') { blob = await textPDF(text); }
          else if (format === 'html') { blob = new Blob([`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(baseName(file.name))}</title></head><body>${html}</body></html>`], {type: 'text/html'}); }
          else { blob = new Blob([text], {type: 'text/plain;charset=utf-8'}); }
        } else {
          const extension = file.name.split('.').pop().toLowerCase(); let rows;
          if (['xlsx', 'xls'].includes(extension)) {
            const book = vendor.XLSX.read(await file.arrayBuffer()); rows = vendor.XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], {header: 1, raw: false, defval: ''});
          } else if (extension === 'json') {
            const data = JSON.parse(await file.text());
            if (!Array.isArray(data)) { throw new Error('Нужен JSON-массив.'); }
            if (Array.isArray(data[0])) { rows = data; }
            else { const keys = [...new Set(data.flatMap(row => Object.keys(row)))]; rows = [keys, ...data.map(row => keys.map(key => row[key] ?? ''))]; }
          } else { rows = parseDelimited(await file.text(), extension === 'tsv' ? '\t' : ','); }
          if (format === 'xlsx') {
            const book = vendor.XLSX.utils.book_new(); vendor.XLSX.utils.book_append_sheet(book, vendor.XLSX.utils.aoa_to_sheet(rows), 'Данные'); blob = new Blob([vendor.XLSX.write(book, {type: 'array', bookType: 'xlsx'})]);
          } else {
            let text = format === 'json' ? JSON.stringify(rows, null, 2) : format === 'md' ? [rows[0], rows[0].map(() => '---'), ...rows.slice(1)].map(row => `| ${row.map(cell => String(cell ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>')).join(' | ')} |`).join('\n') : writeDelimited(rows, format === 'tsv' ? '\t' : ',');
            blob = new Blob([format === 'csv' ? '\uFEFF' : '', text], {type: 'text/plain;charset=utf-8'});
          }
        }
        results.push({name: `${baseName(file.name)}_converted.${format === 'jpeg' ? 'jpg' : format}`, blob});
        report.push(`${file.name}: готово · ${(blob.size / 1024).toFixed(1)} КБ`);
      } catch (error) { report.push(`${file.name}: ${error.message}`); }
      $('report').textContent = report.join('\n');
    }
    if (results.length) { await bundle(results, 'converted-files.zip'); }
    status(`${cancelled ? 'Остановлено.' : 'Готово.'} Успешно: ${results.length}/${chosen.length}.`, results.length !== chosen.length);
  });
}
