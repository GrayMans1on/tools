import {strokePresetList} from '../particle-presets.js?v=20261101-v09';
import {$, field, select, files, action, status, number, toBlob, download, readImage, teardown} from '../ui.js';
import {seeded, buildParticles, particleAt, pathPoint, hexColor, mix} from '../effects-core.js?v=20261101-v07r2';
import {exportEffect} from '../effect-export.js?v=20261101-v07r2';

const numeric = (id, title, value, min, max, step = 1) => field(id, title, 'number', value, `min="${min}" max="${max}" step="${step}"`);
const modulePanel = (title, body, open = false) => `<details class="fx-module" ${open ? 'open' : ''}><summary>${title}</summary><div class="row">${body}</div></details>`;
const common = () => modulePanel('Сцена и экспорт', numeric('width', 'Ширина, px', 800, 128, 1920, 2) + numeric('height', 'Высота, px', 450, 128, 1080, 2) + numeric('duration', 'Длительность экспорта, с', 5, .1, 120, .1) + numeric('fps', 'FPS', 30, 1, 60) + field('background', 'Фон видео', 'color', '#151b2c') + '<label><input type="checkbox" id="transparent"> Прозрачные PNG / GIF</label>', true);
const footer = () => `<div class="actions"><button id="saveProject">Скачать проект</button></div>${files('project', '.json', false)}<p class="muted">Локальный проект сохраняет параметры и встроенную текстуру / путь. Файлы остаются у тебя.</p>`;
const stage = () => `<section class="panel fx-stage"><div class="checker preview-wrap"><canvas id="scene" aria-label="Предпросмотр эффекта"></canvas></div><div class="actions"><button id="play" class="primary">▶ Играть</button><button id="pause">Пауза</button><button id="restart">В начало</button><label><input type="checkbox" id="loop" checked> Повтор</label></div><label>Время<input id="seek" type="range" min="0" max="5" value="1" step="0.001"></label><p id="time" class="muted"></p><div class="actions"><button id="png">PNG кадр</button><button id="sequence">PNG sequence</button><button id="gif">GIF</button><button id="mp4">MP4</button><button id="cancel">Отмена экспорта</button></div><p class="muted">MP4 — без звука, с фоном. PNG сохраняет альфа-канал; GIF — только бинарную прозрачность. Экспорт: до 1800 кадров / 1 млрд пикселей.</p></section>`;

export async function particles(root) { return setup(root, false); }
export async function strokes(root) { return setup(root, true); }
async function setup(root, isPath) {
  const particleUI = modulePanel('Main · Начальные параметры', field('seed', 'Random Seed', 'text', 'GrayMansion') + numeric('emission', 'Duration эмиссии, с', 3, .1, 60, .1) + numeric('delay', 'Start Delay, с', 0, 0, 60, .1) + numeric('lifeMin', 'Lifetime min, с', 1, .05, 30, .05) + numeric('lifeMax', 'Lifetime max, с', 2.5, .05, 30, .05) + numeric('speedMin', 'Speed min, px/с', 70, 0, 2000) + numeric('speedMax', 'Speed max, px/с', 180, 0, 2000) + numeric('sizeMin', 'Size min, px', 3, .2, 300, .2) + numeric('sizeMax', 'Size max, px', 12, .2, 300, .2), true) +
    modulePanel('Emission · Поток и вспышка', numeric('rate', 'Rate over Time, /с', 70, 0, 1000) + numeric('burst', 'Burst при старте', 60, 0, 3000), true) +
    modulePanel('Shape · Форма эмиттера', select('shape', 'Форма 2D', [['cone', 'Конус'], ['circle', 'Круг'], ['box', 'Прямоугольник'], ['point', 'Точка']]) + numeric('x', 'X, %', 50, 0, 100) + numeric('y', 'Y, %', 78, 0, 100) + numeric('radius', 'Радиус / полуширина, px', 25, 0, 500) + numeric('angle', 'Направление, ° (−90 вверх)', -90, -360, 360) + numeric('spread', 'Угол разброса, °', 40, 0, 360)) +
    modulePanel('Velocity & Force · Движение', numeric('gravity', 'Gravity Y, px/с²', 40, -2000, 2000) + numeric('wind', 'Velocity X, px/с', 0, -1000, 1000) + numeric('drag', 'Затухание скорости', .2, 0, 10, .1)) +
    modulePanel('Color over Lifetime · Градиент', field('colorStart', 'Рождение', 'color', '#fff5ce') + field('colorMid', 'Середина', 'color', '#f2a65a') + field('colorEnd', 'Конец', 'color', '#b84d67') + numeric('alphaStart', 'Alpha 0%', 1, 0, 1, .05) + numeric('alphaMid', 'Alpha 50%', .8, 0, 1, .05) + numeric('alphaEnd', 'Alpha 100%', 0, 0, 1, .05)) +
    modulePanel('Size over Lifetime · Кривая', numeric('scaleStart', 'Множитель 0%', .4, 0, 10, .1) + numeric('scaleMid', 'Множитель 50%', 1, 0, 10, .1) + numeric('scaleEnd', 'Множитель 100%', 0, 0, 10, .1)) +
    modulePanel('Noise · Турбулентность', numeric('noise', 'Сила, px', 18, 0, 300) + numeric('frequency', 'Частота', 4, 0, 30, .1)) +
    modulePanel('Rotation & Trails', numeric('rotation', 'Random angular velocity, °/с', 120, 0, 2000) + numeric('trail', 'Длина следа, с', .08, 0, 1, .01)) +
    modulePanel('Renderer · Частицы', select('sprite', 'Вид', [['glow', 'Мягкое свечение'], ['circle', 'Круг'], ['square', 'Квадрат'], ['star', 'Звезда'], ['texture', 'Своя текстура']]) + select('blend', 'Смешивание', [['lighter', 'Additive'], ['source-over', 'Alpha']]) + '<div style="width:100%">' + files('texture', 'image/png,image/jpeg,image/webp', false) + '<button id="clearTexture">Убрать текстуру</button></div>');
  const pathUI = modulePanel('Эффект штриха', select('pathStyle', 'Материал', [['lightning', 'Молния'], ['smoke', 'Дым'], ['ink', 'Чернила'], ['particles', 'Искры'], ['glow', 'Светящийся след']]) + field('seed', 'Seed', 'text', 'Stroke-42') + field('colorStart', 'Основной цвет', 'color', '#9ec5ff') + field('colorEnd', 'Второй цвет', 'color', '#ad78ff') + numeric('strokeWidth', 'Толщина, px', 10, 1, 100) + numeric('intensity', 'Интенсивность', 1, .1, 3, .1) + numeric('reveal', 'Прорисовка, с', 2, .1, 60, .1) + numeric('fade', 'Длина хвоста, % пути', 65, 1, 100), true) + modulePanel('Нарисовать траекторию', '<p class="muted">Рисуй мышью или пальцем на поле ниже. Новый штрих заменяет путь; Undo возвращает предыдущий. Координаты масштабируются вместе со сценой.</p><canvas id="pathPad" width="720" height="270" tabindex="0" aria-label="Поле рисования пути"></canvas><div class="actions"><button id="undoPath">Undo</button><button id="demoPath">Пример волны</button><button id="clearPath">Очистить</button></div>', true);
  root.innerHTML = `<div class="fx-layout"><section class="panel fx-inspector"><div class="row">${select('preset', 'Пресет', isPath ? [['custom', 'Свой штрих'], ['lightning', 'Молния'], ['smoke', 'Дым'], ['ink', 'Чернила'], ['particles', 'Искры'], ['glow', 'Неон']] : [['fire', 'Огонь'], ['snow', 'Снег'], ['confetti', 'Конфетти'], ['fountain', 'Фонтан'], ['galaxy', 'Магия']])}<button id="newSeed">Новый seed</button></div><p class="muted">${isPath ? 'Путь + процедурный материал. Любой кадр воспроизводится по seed.' : '2D-система с модулями в духе Unity Inspector. Самостоятельный браузерный движок; Unity-проекты не импортируются.'}</p>${isPath ? pathUI : particleUI}${common()}${footer()}</section>${stage()}</div>`;
  if (isPath) { for (const [id, label] of strokePresetList) { $('preset').append(new Option(label, id)); } }
  let points = Array.from({length: 100}, (_, i) => ({x: .08 + i / 99 * .84, y: .5 + Math.sin(i / 99 * Math.PI * 3) * .22}));
  let previousPath = []; let texture; let textureData = ''; let particleList = []; let position = 1; let playing = false; let exporting = false; let cancelled = false; let disposed = false; let frame; let last = 0; let settings; let strokeSamples;
  const c = $('scene'); const ctx = c.getContext('2d');
  function config() {
    const values = {};
    for (const input of root.querySelectorAll('.fx-inspector input:not([type="file"]), .fx-inspector select')) {
      if (input.type === 'number') {
        const n = Number(input.value);
        if (!Number.isFinite(n) || n < Number(input.min) || n > Number(input.max)) { throw new Error(`Проверь параметр: ${input.closest('label')?.textContent.trim()}.`); }
        values[input.id] = n;
      } else {
        if (input.tagName === 'SELECT' && ![...input.options].some(o => o.value === input.value)) { throw new Error('Неверное значение списка.'); }
        values[input.id] = input.type === 'checkbox' ? input.checked : input.value;
      }
    }
    if (values.width % 2 || values.height % 2 || values.fps % 1) { throw new Error('Размеры — чётные целые, FPS — целое число.'); }
    if (String(values.seed).length > 200) { throw new Error('Seed — до 200 символов.'); }
    if (!isPath) {
      if (values.lifeMin > values.lifeMax || values.speedMin > values.speedMax || values.sizeMin > values.sizeMax) { throw new Error('Минимальные значения не должны превышать максимальные.'); }
      if (values.rate % 1 || values.burst % 1) { throw new Error('Rate и Burst — целые числа.'); }
      values.x = values.x / 100 * values.width; values.y = values.y / 100 * values.height;
    }
    return values;
  }
  function rebuild() {
    settings = config(); c.width = settings.width; c.height = settings.height;
    if (!isPath) { particleList = buildParticles(settings); }
    else { strokeSamples = Array.from({length: 180}, (_, i) => pathPoint(points, i / 179)); padDraw(); }
    $('seek').max = settings.duration; position = Math.min(position, settings.duration); draw(position);
  }
  function fill(time, opaque) {
    ctx.clearRect(0, 0, c.width, c.height);
    if (!settings.transparent || opaque) { ctx.fillStyle = settings.background; ctx.fillRect(0, 0, c.width, c.height); }
  }
  function drawSprite(p, q, tint) {
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rotation); ctx.globalAlpha = Math.min(1, q.alpha); ctx.fillStyle = tint;
    const r = Math.max(.01, q.size / 2);
    if (settings.sprite === 'texture' && texture) { ctx.drawImage(texture, -r, -r, r * 2, r * 2); }
    else if (settings.sprite === 'square') { ctx.fillRect(-r, -r, r * 2, r * 2); }
    else if (settings.sprite === 'star') {
      ctx.beginPath(); for (let i = 0; i < 10; i += 1) { const a = i * Math.PI / 5 - Math.PI / 2; const v = i % 2 ? r * .4 : r; ctx.lineTo(Math.cos(a) * v, Math.sin(a) * v); } ctx.closePath(); ctx.fill();
    } else {
      if (settings.sprite === 'glow') { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, tint); g.addColorStop(.25, tint); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; }
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function draw(time, opaque = false) {
    fill(time, opaque);
    if (isPath) { drawStroke(time); }
    else {
      ctx.globalCompositeOperation = settings.blend;
      for (const p of particleList) {
        const q = particleAt(p, time, settings); if (!q || q.size <= 0) { continue; }
        const tint = q.u < .5 ? hexColor(settings.colorStart, settings.colorMid, q.u * 2) : hexColor(settings.colorMid, settings.colorEnd, q.u * 2 - 1);
        if (settings.trail > 0) {
          const old = particleAt(p, Math.max(p.born, time - settings.trail), settings);
          if (old) { ctx.globalAlpha = q.alpha * .45; ctx.strokeStyle = tint; ctx.lineWidth = Math.max(.2, q.size * .35); ctx.beginPath(); ctx.moveTo(old.x, old.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.globalAlpha = 1; }
        }
        drawSprite(p, q, tint);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    $('seek').value = time; $('time').textContent = `${time.toFixed(2)} / ${settings.duration.toFixed(2)} с · Seed: ${settings.seed}${isPath ? '' : ` · Частиц в цикле: ${particleList.length}`}`;
  }
  function drawStroke(time) {
    if (points.length < 2) { return; }
    const progress = Math.min(1, time / settings.reveal); const from = Math.max(0, progress - settings.fade / 100);
    const random = seeded(`${settings.seed}:${Math.floor(time * 12)}`); const style = settings.pathStyle; const width = settings.strokeWidth;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (['lightning', 'ink', 'glow'].includes(style)) {
      const passes = style === 'ink' ? 4 : 3;
      for (let pass = 0; pass < passes; pass += 1) {
        ctx.beginPath(); let first = true;
        strokeSamples.forEach((p, i) => {
          const t = i / 179; if (t > progress || t < from) { return; }
          const jitter = style === 'lightning' ? (random() - .5) * width * 3 * settings.intensity : style === 'ink' ? (random() - .5) * width * .3 : 0;
          const x = p.x * c.width + jitter; const y = p.y * c.height + jitter;
          if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, y); }
        });
        ctx.strokeStyle = style !== 'ink' && pass === passes - 1 ? '#ffffff' : settings.colorStart;
        ctx.lineWidth = width * (passes - pass) * (style === 'ink' ? .5 : .8);
        ctx.globalAlpha = style === 'ink' ? .5 : pass === passes - 1 ? .9 : .2;
        ctx.shadowColor = settings.colorEnd; ctx.shadowBlur = style === 'ink' ? 0 : width * 2 * settings.intensity; ctx.stroke();
      }
    } else {
      const r = seeded(settings.seed);
      for (let i = 0; i < 650 * settings.intensity; i += 1) {
        const t = r(); const drift = r(); const phase = r() * Math.PI * 2; const size = r();
        if (t > progress || t < from) { continue; }
        const p = strokeSamples[Math.min(179, Math.floor(t * 180))]; const age = time - t * settings.reveal;
        const spread = style === 'smoke' ? width * (1 + age) : width * (1 + drift * age * 4);
        const x = p.x * c.width + Math.sin(phase + time) * spread; const y = p.y * c.height - age * (style === 'smoke' ? 24 : 12) + Math.cos(phase) * spread;
        const radius = Math.max(.5, width * (style === 'smoke' ? 1 + size * 2 : .1 + size * .2));
        ctx.globalAlpha = (style === 'smoke' ? .06 : .8) * Math.max(0, 1 - age / 5); ctx.fillStyle = hexColor(settings.colorStart, settings.colorEnd, drift);
        ctx.shadowColor = settings.colorStart; ctx.shadowBlur = style === 'smoke' ? width : 8; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  function padDraw() {
    if (!isPath) { return; }
    const pad = $('pathPad'); const pc = pad.getContext('2d'); pc.fillStyle = '#f5f7fc'; pc.fillRect(0, 0, pad.width, pad.height);
    pc.strokeStyle = '#747fa0'; pc.lineWidth = 3; pc.beginPath(); points.forEach((p, i) => { if (!i) { pc.moveTo(p.x * pad.width, p.y * pad.height); } else { pc.lineTo(p.x * pad.width, p.y * pad.height); } }); pc.stroke();
  }
  if (isPath) {
    let drawing = false;
    const addPoint = e => { const rect = $('pathPad').getBoundingClientRect(); points.push({x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))}); padDraw(); };
    $('pathPad').addEventListener('pointerdown', e => { if (exporting) { return; } drawing = true; previousPath = points.map(p => ({...p})); points = []; $('pathPad').setPointerCapture(e.pointerId); addPoint(e); });
    $('pathPad').addEventListener('pointermove', e => { if (drawing && points.length < 3000) { addPoint(e); } });
    const finishPath = () => { if (drawing) { drawing = false; safeRebuild(); } };
    $('pathPad').addEventListener('pointerup', finishPath); $('pathPad').addEventListener('pointercancel', finishPath);
    action('undoPath', () => { [points, previousPath] = [previousPath, points]; safeRebuild(); });
    action('clearPath', () => { previousPath = points; points = []; safeRebuild(); });
    action('demoPath', () => { previousPath = points; points = Array.from({length: 100}, (_, i) => ({x: .08 + i / 99 * .84, y: .5 + Math.sin(i / 99 * Math.PI * 3) * .22})); safeRebuild(); });
  }
  function safeRebuild() { try { rebuild(); status(''); } catch (error) { playing = false; status(error.message, true); } }
  root.querySelector('.fx-inspector').addEventListener('input', e => { if (e.target.type !== 'file' && e.target.id !== 'preset') { playing = false; safeRebuild(); } });
  action('newSeed', () => { $('seed').value = String(crypto.getRandomValues(new Uint32Array(1))[0]); safeRebuild(); });
  const presets = {
    fire: {shape: 'cone', sprite: 'glow', rate: 70, burst: 60, gravity: -30, speedMin: 70, speedMax: 180, sizeMin: 3, sizeMax: 14, colorStart: '#fff5ce', colorMid: '#f2a65a', colorEnd: '#b84d67', y: 78, noise: 18, spread: 40, rotation: 120, blend: 'lighter'},
    snow: {shape: 'box', sprite: 'circle', rate: 40, burst: 20, gravity: 5, speedMin: 20, speedMax: 60, sizeMin: 3, sizeMax: 8, colorStart: '#ffffff', colorMid: '#cbdcff', colorEnd: '#aabce2', y: 5, radius: 400, angle: 90, spread: 15, lifeMin: 5, lifeMax: 8, noise: 14, blend: 'source-over'},
    confetti: {shape: 'cone', sprite: 'square', burst: 350, rate: 0, speedMin: 120, speedMax: 380, gravity: 200, colorStart: '#ffe671', colorMid: '#ec7faf', colorEnd: '#8e9afa', rotation: 700, y: 65, spread: 100, blend: 'source-over'},
    fountain: {shape: 'cone', sprite: 'circle', rate: 100, burst: 0, gravity: 240, speedMin: 250, speedMax: 350, colorStart: '#e4f5ff', colorMid: '#65bbf0', colorEnd: '#296aaf', y: 90, spread: 35, noise: 0, drag: 0, blend: 'lighter'},
    galaxy: {shape: 'circle', sprite: 'star', rate: 60, burst: 200, gravity: 0, speedMin: 15, speedMax: 70, colorStart: '#ffe6fb', colorMid: '#b48ef9', colorEnd: '#6c9bec', y: 50, radius: 35, noise: 30, lifeMin: 2, lifeMax: 4, blend: 'lighter'}
  };
  const initialValues = Object.fromEntries([...root.querySelectorAll('.fx-inspector input[type="number"], .fx-inspector input[type="color"], .fx-inspector select')].filter(el => !el.closest('.fx-module')?.querySelector('#width') && el.id !== 'preset').map(el => [el.id, el.value]));
  $('preset').addEventListener('change', () => { playing = false; if (isPath) { if ($('preset').value !== 'custom') { const extra = strokePresetList.find(p => p[0] === $('preset').value); if (extra) { for (const [key,value] of Object.entries(extra[2])) { $(key).value = value; } } else { $('pathStyle').value = $('preset').value; } } } else { for (const [key, value] of Object.entries({...initialValues, ...presets[$('preset').value]})) { $(key).value = value; } } position = Math.min(1, number('duration')); safeRebuild(); });
  if (!isPath) {
    $('texture').addEventListener('change', async () => {
      try {
        const file = $('texture').files[0]; if (!file) { return; }
        if (file.size > 10000000) { throw new Error('Текстура — до 10 МБ.'); }
        const image = await readImage(file); const scale = Math.min(1, 512 / Math.max(image.width, image.height));
        const pad = document.createElement('canvas'); pad.width = Math.max(1, Math.round(image.width * scale)); pad.height = Math.max(1, Math.round(image.height * scale)); pad.getContext('2d').drawImage(image, 0, 0, pad.width, pad.height); image.close();
        textureData = pad.toDataURL('image/png'); texture?.close(); texture = await createImageBitmap(await toBlob(pad)); $('sprite').value = 'texture'; safeRebuild();
      } catch (error) { status(error.message, true); }
    });
    action('clearTexture', () => { texture?.close(); texture = null; textureData = ''; $('sprite').value = 'glow'; safeRebuild(); });
  }
  function tick(t) {
    if (disposed) { return; }
    if (playing && !exporting) { position += Math.min(.1, (t - last) / 1000); if (position >= settings.duration) { position = $('loop').checked ? position % settings.duration : settings.duration; if (!$('loop').checked) { playing = false; } } draw(position); }
    last = t; frame = requestAnimationFrame(tick);
  }
  action('play', () => { rebuild(); if (position >= settings.duration) { position = 0; } playing = true; last = performance.now(); });
  action('pause', () => { playing = false; });
  action('restart', () => { position = 0; rebuild(); });
  $('seek').addEventListener('input', () => { if (!exporting) { playing = false; position = number('seek'); draw(position); } });
  action('png', async () => { rebuild(); download(await toBlob(c), 'effect-frame.png'); });
  for (const format of ['sequence', 'gif', 'mp4']) {
    action(format, async () => {
      if (exporting) { throw new Error('Дождись экспорта.'); }
      rebuild(); exporting = true; playing = false; cancelled = false;
      const controls = [...root.querySelectorAll('input,select,textarea,button')].filter(el => el.id !== 'cancel');
      const state = controls.map(el => el.disabled); controls.forEach(el => { el.disabled = true; });
      try { await exportEffect({format, settings: {...settings, points: isPath ? points : undefined}, draw, canvas: c, cancelled: () => cancelled || disposed}); }
      finally { exporting = false; controls.forEach((el, i) => { el.disabled = state[i]; }); draw(position); }
    });
  }
  action('cancel', () => { cancelled = true; });
  action('saveProject', () => {
    config(); const values = Object.fromEntries([...root.querySelectorAll('.fx-inspector input:not([type="file"]), .fx-inspector select')].map(el => [el.id, el.type === 'checkbox' ? el.checked : el.value]));
    download(new Blob([JSON.stringify({format: 'GM Effect', version: 1, kind: isPath ? 'strokes' : 'particles', values, points: isPath ? points : undefined, textureData}, null, 2)], {type: 'application/json'}), `${isPath ? 'stroke' : 'particles'}-project.json`);
  });
  $('project').addEventListener('change', async () => {
    try {
      const file = $('project').files[0]; if (!file) { return; } if (file.size > 15000000) { throw new Error('Проект — до 15 МБ.'); }
      const data = JSON.parse(await file.text());
      if (data.format !== 'GM Effect' || data.version !== 1 || data.kind !== (isPath ? 'strokes' : 'particles') || !data.values) { throw new Error('Неверный тип проекта.'); }
      if (isPath && (!Array.isArray(data.points) || data.points.length > 3000 || data.points.some(p => !Number.isFinite(p.x + p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1))) { throw new Error('Повреждён путь.'); }
      if (data.textureData && (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.textureData) || data.textureData.length > 14000000)) { throw new Error('Неверная текстура.'); }
      // Validate candidate controls before replacing a working simulation.
      const old = Object.fromEntries([...root.querySelectorAll('.fx-inspector input:not([type="file"]), .fx-inspector select')].map(el => [el.id, el.type === 'checkbox' ? el.checked : el.value]));
      const assign = values => { for (const el of root.querySelectorAll('.fx-inspector input:not([type="file"]), .fx-inspector select')) { if (Object.hasOwn(values, el.id)) { if (el.type === 'checkbox') { el.checked = values[el.id] === true; } else { el.value = String(values[el.id]); } } } };
      let nextTexture;
      try { assign(data.values); const candidate = config(); if (!isPath) { buildParticles(candidate); } if (data.textureData) { nextTexture = await createImageBitmap(await (await fetch(data.textureData)).blob()); } }
      catch (error) { assign(old); throw error; }
      playing = false; if (isPath) { previousPath = points; points = data.points; } texture?.close(); texture = nextTexture; textureData = data.textureData || ''; position = 0; rebuild(); status('Проект открыт.');
    } catch (error) { status(error.message, true); }
  });
  teardown(() => { disposed = true; cancelled = true; cancelAnimationFrame(frame); texture?.close(); });
  rebuild(); frame = requestAnimationFrame(tick);
}
