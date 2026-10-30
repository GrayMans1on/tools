import { $, esc, field, select, files, action, status, number, canvas, toBlob, download, sleep, persist, restore, teardown } from '../ui.js';

export async function animation(root) {
  const {JSZip, GIFEncoder, quantize, applyPalette, Muxer, ArrayBufferTarget} = await import('../vendor/vendor.js');
  root.innerHTML = `<div class="two"><section class="panel"><h2>Текстовые блоки</h2><div id="blocks"></div><button id="add">Добавить блок</button><datalist id="fonts"><option>Arial</option><option>Georgia</option><option>monospace</option><option>Dela Gothic One</option><option>Roboto</option><option>Rubik</option><option>Montserrat</option></datalist></section><section class="panel"><h2>Сцена</h2><div class="row">${field('width', 'Ширина', 'number', 1280, 'min="128" max="3840" step="2"')}${field('height', 'Высота', 'number', 720, 'min="128" max="2160" step="2"')}${field('fps', 'FPS', 'number', 30, 'min="1" max="60"')}${field('speed', 'Скорость анимаций, ×', 'number', 1, 'min="0.25" max="4" step="0.25"')}</div><div class="row">${field('background', 'Фон', 'color', '#18181c')}<label><input id="transparent" type="checkbox"> Прозрачность PNG / GIF</label><label><input id="transition" type="checkbox" checked> Стартовый переход</label></div>${files('fontFile', '.ttf,.otf,.woff,.woff2', false)}<div class="row">${field('googleFont', 'Загрузить семейство Google Fonts', 'text', 'Dela Gothic One')}<button id="loadGoogle">Загрузить шрифт</button></div><p class="muted">Внешний запрос отправляет Google только название шрифта. Текст сцены остаётся в браузере.</p><div class="actions"><button id="preview" class="primary">Предпросмотр</button><button id="pause">Пауза</button></div><div class="checker preview-wrap" style="margin-top:18px"><canvas id="scene"></canvas></div><label>Позиция<input id="seek" type="range" min="0" max="1" step="0.01" value="0"></label><p id="timing" class="muted"></p><div class="actions"><button id="png">Кадр PNG</button><button id="sequence">PNG sequence</button><button id="gif">GIF</button><button id="mp4">MP4 без звука</button><button id="cancel">Отмена</button></div><div class="actions"><button id="saveProject">Сохранить проект</button><button id="manim">Экспорт сцены Manim .py</button></div>${files('projectFile', '.json', false)}<p class="muted">Предпросмотр и экспорт медиа выполняются браузерным рендерером. Экспорт .py создаёт сцену для настоящего Manim; сервер Manim к сайту не подключён. До 20 блоков и 1800 кадров за экспорт.</p></section></div>`;
  const defaults = [{text: 'GrayMansion', size: 72, font: 'Arial', color: '#ffffff', effect: 'fade', duration: 1, wait: 1, x: 50, y: 40}, {text: 'Меньше рутины. Больше времени на идеи.', size: 36, font: 'Arial', color: '#b6bfd9', effect: 'slide', duration: 1, wait: 2, x: 50, y: 60}];
  let blocks = restore('animation', defaults); let frame; let playing = false; let started = 0; let position = 0; let cancelled = false;
  function editors() {
    $('blocks').replaceChildren();
    blocks.forEach((block, index) => {
      const element = document.createElement('div'); element.className = 'block'; element.dataset.index = index;
      element.innerHTML = `<h3>Блок ${index + 1}</h3><label>Текст<textarea data-key="text">${esc(block.text)}</textarea></label><div class="row"><label>Размер<input data-key="size" type="number" min="8" max="400" value="${Number(block.size) || 48}"></label><label>Шрифт<input data-key="font" list="fonts" value="${esc(block.font)}"></label><label>Цвет<input data-key="color" type="color" value="${esc(block.color)}"></label></div><div class="row"><label>Появление<select data-key="effect"><option value="fade">Плавное</option><option value="type">Печатная машинка</option><option value="slide">Сдвиг снизу</option><option value="scale">Увеличение</option><option value="none">Мгновенное</option></select></label><label>Анимация, с<input data-key="duration" type="number" min="0.1" max="30" step="0.1" value="${Number(block.duration) || 1}"></label><label>Пауза, с<input data-key="wait" type="number" min="0" max="30" step="0.1" value="${Number(block.wait) || 0}"></label></div><div class="row"><label>X, %<input data-key="x" type="number" min="0" max="100" value="${Number(block.x)}"></label><label>Y, %<input data-key="y" type="number" min="0" max="100" value="${Number(block.y)}"></label></div><div class="actions"><button data-move="-1">Выше</button><button data-move="1">Ниже</button><button data-remove>Удалить блок</button></div>`;
      element.querySelector('[data-key="effect"]').value = block.effect;
      element.addEventListener('input', event => {
        const key = event.target.dataset.key; if (!key) { return; }
        block[key] = ['size', 'duration', 'wait', 'x', 'y'].includes(key) ? Number(event.target.value) : event.target.value;
        persist('animation', blocks); safeDraw();
      });
      element.querySelector('[data-remove]').addEventListener('click', () => { blocks.splice(index, 1); persist('animation', blocks); editors(); safeDraw(); });
      for (const button of element.querySelectorAll('[data-move]')) {
        button.addEventListener('click', () => { const target = index + Number(button.dataset.move); if (target >= 0 && target < blocks.length) { [blocks[index], blocks[target]] = [blocks[target], blocks[index]]; editors(); persist('animation', blocks); safeDraw(); } });
      }
      $('blocks').append(element);
    });
  }
  function config() {
    const width = Math.round(number('width', 1280)); const height = Math.round(number('height', 720));
    const fps = Math.round(number('fps', 30)); const speed = number('speed', 1);
    if (width < 128 || width > 3840 || height < 128 || height > 2160 || fps < 1 || fps > 60 || speed < .25 || speed > 4) { throw new Error('Проверь размер, FPS и скорость сцены.'); }
    if (!blocks.length || blocks.length > 20) { throw new Error('Нужно от 1 до 20 блоков.'); }
    for (const block of blocks) {
      if (block.text.length > 4000 || !Number.isFinite(block.size) || block.size < 8 || block.size > 400 || block.duration < .1 || block.duration > 30 || block.wait < 0 || block.wait > 30 || !Number.isFinite(block.duration + block.wait + block.x + block.y)) { throw new Error('Проверь параметры блоков: до 4000 символов, размер 8–400, длительности до 30 с.'); }
    }
    const duration = blocks.reduce((sum, block) => sum + block.duration / speed + block.wait, 0);
    return {width, height, fps, speed, duration};
  }
  function wrap(ctx, text, maxWidth) {
    const lines = [];
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const word of paragraph.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; }
        else { line = next; }
      }
      lines.push(line);
    }
    return lines;
  }
  function draw(time, forceOpaque = false) {
    const settings = config(); const c = $('scene');
    if (c.width !== settings.width || c.height !== settings.height) { c.width = settings.width; c.height = settings.height; }
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height);
    if (!$('transparent').checked || forceOpaque) { ctx.fillStyle = $('background').value; ctx.fillRect(0, 0, c.width, c.height); }
    let offset = 0;
    for (const [index, block] of blocks.entries()) {
      const length = block.duration / settings.speed; const local = time - offset;
      offset += length + block.wait;
      if (local < 0) { continue; }
      let progress = Math.max(0, Math.min(1, local / length));
      if (index === 0 && !$('transition').checked) { progress = 1; }
      if (block.effect === 'none') { progress = 1; }
      const ease = 1 - Math.pow(1 - progress, 3);
      const text = block.effect === 'type' ? [...block.text].slice(0, Math.ceil([...block.text].length * progress)).join('') : block.text;
      const x = c.width * block.x / 100; const y = c.height * block.y / 100;
      ctx.save(); ctx.font = `${block.size}px "${block.font.replace(/["\\]/g, '')}"`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = block.color;
      ctx.globalAlpha = block.effect === 'fade' ? ease : 1;
      ctx.translate(x, y + (block.effect === 'slide' ? (1 - ease) * 50 : 0));
      if (block.effect === 'scale') { const scale = .65 + ease * .35; ctx.scale(scale, scale); }
      const lines = wrap(ctx, text, c.width * .92);
      lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * block.size * 1.25));
      ctx.restore();
    }
    $('seek').max = settings.duration; $('seek').value = time;
    $('timing').textContent = `${time.toFixed(2)} / ${settings.duration.toFixed(2)} с · ${Math.ceil(settings.duration * settings.fps - 1e-8)} кадров`;
    return settings;
  }
  function safeDraw() { try { draw(Math.min(position, config().duration)); } catch (error) { status(error.message, true); } }
  async function fontsReady() { await Promise.all(blocks.map(block => document.fonts.load(`${block.size}px "${block.font.replace(/["\\]/g, '')}"`))); }
  function tick(time) {
    if (playing) {
      position = (time - started) / 1000;
      const duration = config().duration;
      if (position >= duration) { position = duration; playing = false; }
      draw(position);
    }
    frame = requestAnimationFrame(tick);
  }
  action('add', () => { if (blocks.length >= 20) { throw new Error('Не более 20 блоков.'); } blocks.push({...defaults[0], text: 'Новый блок', size: 48}); editors(); safeDraw(); persist('animation', blocks); });
  action('preview', async () => { await fontsReady(); config(); playing = true; position = 0; started = performance.now(); });
  action('pause', () => { playing = false; });
  $('seek').addEventListener('input', () => { playing = false; position = number('seek'); safeDraw(); });
  action('loadGoogle', async () => {
    const family = $('googleFont').value.trim(); if (!family || family.length > 100 || !/^[\p{L}\p{N} -]+$/u.test(family)) { throw new Error('Укажи название семейства шрифтов.'); }
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
    await new Promise((resolve, reject) => { link.onload = resolve; link.onerror = () => reject(new Error('Не удалось загрузить Google Fonts.')); document.head.append(link); });
    await document.fonts.load(`48px "${family}"`); $('fonts').append(new Option(family));
    status(`Шрифт «${family}» загружен. Укажи его имя в блоке.`); safeDraw();
  });
  $('fontFile').addEventListener('change', async () => {
    try {
      const file = $('fontFile').files[0]; if (!file) { return; }
      const family = `Imported ${file.name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N} -]/gu, '')}`;
      const face = new FontFace(family, await file.arrayBuffer()); await face.load(); document.fonts.add(face);
      $('fonts').append(new Option(family)); status(`Шрифт загружен: ${family}. Выбери его в блоках.`);
    } catch (error) { status(error.message, true); }
  });
  action('png', async () => { await fontsReady(); draw(position); download(await toBlob($('scene')), 'animation-frame.png'); });
  let exporting = false;
  async function exportAnimation(format) {
    if (exporting) { throw new Error('Дождись завершения текущего экспорта.'); }
    const settings = config(); const total = Math.ceil(settings.duration * settings.fps - 1e-8);
    if (total > 1800) { throw new Error('Экспорт ограничен 1800 кадрами. Уменьши FPS или длительность.'); }
    if (format === 'mp4' && (settings.width % 2 || settings.height % 2)) { throw new Error('Для MP4 ширина и высота должны быть чётными.'); }
    playing = false; cancelled = false; exporting = true;
    const lockedControls = [...root.querySelectorAll('input,select,textarea,button')].filter(element => element.id !== 'cancel');
    lockedControls.forEach(element => { element.disabled = true; });
    const zip = format === 'sequence' ? new JSZip() : null;
    const gif = format === 'gif' ? GIFEncoder() : null;
    let muxer; let encoder; let software; let failure;
    try {
      await fontsReady();
      if (format === 'mp4') {
        const options = {codec: settings.width > 1280 || settings.height > 720 || settings.fps > 30 ? 'avc1.42002a' : 'avc1.42001f', width: settings.width, height: settings.height, bitrate: 6000000, framerate: settings.fps, avc: {format: 'avc'}};
        const supported = window.VideoEncoder ? await VideoEncoder.isConfigSupported(options) : {supported: false};
        if (supported.supported) {
          muxer = new Muxer({target: new ArrayBufferTarget(), video: {codec: 'avc', width: settings.width, height: settings.height}, fastStart: 'in-memory'});
          encoder = new VideoEncoder({output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: error => { failure = error; }});
          encoder.configure(options);
        } else {
          status('Загрузка запасного MP4-кодировщика…');
          if (!window.HME) {
            await new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = new URL('../vendor/h264.js', import.meta.url).href;
              script.onload = resolve; script.onerror = () => reject(new Error('Не удалось загрузить MP4-кодировщик.'));
              document.head.append(script);
            });
          }
          software = await window.HME.createH264MP4Encoder();
          software.width = settings.width; software.height = settings.height;
          software.frameRate = settings.fps; software.speed = 8; software.quantizationParameter = 23;
          software.initialize();
        }
      }
      for (let i = 0; i < total; i += 1) {
        if (cancelled) { status('Экспорт отменён.'); return; }
        if (failure) { throw failure; }
        draw(i === total - 1 ? settings.duration : i / settings.fps, format === 'mp4');
        const c = $('scene');
        if (zip) { zip.file(`frame_${String(i + 1).padStart(6, '0')}.png`, await toBlob(c)); }
        if (gif) {
          const pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          const palette = quantize(pixels, 128, {format: 'rgba4444'});
          const indices = applyPalette(pixels, palette, 'rgba4444');
          const transparentIndex = palette.findIndex(color => color[3] === 0);
          const delay = (Math.round((i + 1) * 100 / settings.fps) - Math.round(i * 100 / settings.fps)) * 10;
          gif.writeFrame(indices, c.width, c.height, {palette, delay: Math.max(10, delay), transparent: transparentIndex >= 0, transparentIndex: Math.max(0, transparentIndex), dispose: 2, repeat: 0});
        }
        if (software) { software.addFrameRgba(c.getContext('2d').getImageData(0, 0, c.width, c.height).data); }
        if (encoder) {
          const videoFrame = new VideoFrame(c, {timestamp: Math.round(i * 1000000 / settings.fps), duration: Math.round(1000000 / settings.fps)});
          encoder.encode(videoFrame, {keyFrame: i % (settings.fps * 2) === 0}); videoFrame.close();
          if (encoder.encodeQueueSize > 8) { await encoder.flush(); }
        }
        status(`Рендер ${i + 1}/${total} (${Math.round((i + 1) / total * 100)}%).`);
        if (i % 3 === 0) { await sleep(); }
      }
      if (zip) { download(await zip.generateAsync({type: 'blob'}), 'animation-frames.zip'); }
      if (gif) { gif.finish(); download(new Blob([gif.bytes()], {type: 'image/gif'}), 'text-animation.gif'); }
      if (software) { software.finalize(); download(new Blob([software.FS.readFile(software.outputFilename)], {type: 'video/mp4'}), 'text-animation.mp4'); }
      if (encoder) { await encoder.flush(); if (failure) { throw failure; } muxer.finalize(); download(new Blob([muxer.target.buffer], {type: 'video/mp4'}), 'text-animation.mp4'); }
      status(`Готово: ${total} кадров, ${format === 'mp4' ? 'MP4 без звука' : format.toUpperCase()}.`);
    } finally { if (encoder && encoder.state !== 'closed') { encoder.close(); } if (software) { software.delete(); } lockedControls.forEach(element => { element.disabled = false; }); exporting = false; draw(position); }
  }
  action('sequence', () => exportAnimation('sequence')); action('gif', () => exportAnimation('gif')); action('mp4', () => exportAnimation('mp4'));
  action('cancel', () => { cancelled = true; });
  action('saveProject', () => { download(new Blob([JSON.stringify({version: 1, blocks, settings: Object.fromEntries(['width', 'height', 'fps', 'speed', 'background'].map(id => [id, $(id).value])), transition: $('transition').checked, transparent: $('transparent').checked}, null, 2)], {type: 'application/json'}), 'text-animation-project.json'); });
  $('projectFile').addEventListener('change', async () => {
    try {
      const file = $('projectFile').files[0]; if (!file) { return; }
      const project = JSON.parse(await file.text());
      if (!Array.isArray(project.blocks) || !project.blocks.length || project.blocks.length > 20) { throw new Error('Неверный проект.'); }
      const candidate = project.blocks.map(block => ({text: String(block.text || ''), font: String(block.font || 'Arial').replace(/["\\<>]/g, ''), color: /^#[0-9a-f]{6}$/i.test(block.color) ? block.color : '#ffffff', effect: ['fade', 'type', 'slide', 'scale', 'none'].includes(block.effect) ? block.effect : 'fade', size: Number(block.size), duration: Number(block.duration), wait: Number(block.wait), x: Number(block.x), y: Number(block.y)}));
      blocks = candidate;
      for (const id of ['width', 'height', 'fps', 'speed', 'background']) { if (project.settings?.[id] != null) { $(id).value = project.settings[id]; } }
      $('transition').checked = Boolean(project.transition); $('transparent').checked = Boolean(project.transparent);
      editors(); position = 0; config(); safeDraw(); persist('animation', blocks);
    } catch (error) { status(error.message, true); }
  });
  action('manim', () => {
    const settings = config();
    const data = JSON.stringify({blocks, ...settings, background: $('background').value, transition: $('transition').checked});
    const encoded = btoa(Array.from(new TextEncoder().encode(data), byte => String.fromCharCode(byte)).join(''));
    const code = `from manim import *\nimport base64\nimport json\n\nDATA = json.loads(base64.b64decode("${encoded}").decode("utf-8"))\nconfig.pixel_width = DATA["width"]\nconfig.pixel_height = DATA["height"]\nconfig.frame_rate = DATA["fps"]\nconfig.background_color = DATA["background"]\n\nclass TextBlocks(Scene):\n    def construct(self):\n        for index, block in enumerate(DATA["blocks"]):\n            text = Text(block["text"], font=block["font"], font_size=block["size"], color=block["color"])\n            text.move_to([(block["x"] / 100 - 0.5) * config.frame_width, (0.5 - block["y"] / 100) * config.frame_height, 0])\n            duration = block["duration"] / DATA["speed"]\n            effect = block["effect"]\n            if effect == "none" or (index == 0 and not DATA["transition"]):\n                self.add(text)\n                self.wait(duration)\n            elif effect == "type":\n                self.play(AddTextLetterByLetter(text), run_time=duration)\n            elif effect == "slide":\n                self.play(FadeIn(text, shift=UP * 0.5), run_time=duration)\n            elif effect == "scale":\n                self.play(GrowFromCenter(text), run_time=duration)\n            else:\n                self.play(FadeIn(text), run_time=duration)\n            self.wait(block["wait"])\n`;
    download(new Blob([code], {type: 'text/x-python'}), 'graymansion_text_blocks.py');
    status('Создана сцена Manim. Импортированные шрифты должны быть установлены и на машине рендера.');
  });
  root.addEventListener('change', event => { if (!event.target.closest('#blocks')) { safeDraw(); } });
  teardown(() => { cancelled = true; cancelAnimationFrame(frame); }); editors(); draw(0); frame = requestAnimationFrame(tick);
}
