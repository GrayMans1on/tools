import { $, esc, field, select, action, status, number, teardown, download } from '../ui.js';

export function devices(root) {
  root.innerHTML = `<div class="grid" id="deviceMenu"></div><section class="panel" id="test" style="margin-top:18px"><p>Выбери устройство для проверки.</p></section>`;
  const kinds = [['keyboard', 'Клавиатура', 'Кнопки и сочетания'], ['mouse', 'Мышь', 'Кнопки, колесо и двойные клики'], ['microphone', 'Микрофон', 'Уровень, запись и прослушивание'], ['headphones', 'Наушники / колонки', 'Левый и правый каналы'], ['gamepad', 'Геймпад', 'Кнопки, оси и мёртвые зоны'], ['camera', 'Веб-камера', 'Видео и параметры потока']];
  let cleanups = [];
  function clean() { for (const fn of cleanups) { fn(); } cleanups = []; }
  teardown(clean);
  function button(id, name, fn) { action(id, fn); }
  async function show(kind) {
    clean(); status('');
    const panel = $('test');
    if (kind === 'keyboard') {
      const codes = ['Escape', ...Array.from({length: 12}, (_, i) => `F${i + 1}`), 'Backquote', ...'1234567890'.split('').map(n => `Digit${n}`), 'Minus', 'Equal', 'Backspace', 'Tab', ...'QWERTYUIOP'.split('').map(n => `Key${n}`), 'BracketLeft', 'BracketRight', 'Backslash', 'CapsLock', ...'ASDFGHJKL'.split('').map(n => `Key${n}`), 'Semicolon', 'Quote', 'Enter', 'ShiftLeft', ...'ZXCVBNM'.split('').map(n => `Key${n}`), 'Comma', 'Period', 'Slash', 'ShiftRight', 'ControlLeft', 'MetaLeft', 'AltLeft', 'Space', 'AltRight', 'ControlRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight', 'Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown'];
      panel.innerHTML = '<h2>Клавиатура</h2><p class="muted">Кликни сюда и нажимай клавиши. Tab и системные сочетания могут перехватываться браузером или ОС. Ярко-зелёный — нажата сейчас; едва заметный зелёный — уже проверена и отпущена.</p><div id="keyInfo" class="result">Ожидание ввода</div><div id="keys" class="key-grid"></div><pre id="keyHistory"></pre><button id="resetKeys">Сбросить</button>';
      panel.tabIndex = 0; panel.focus(); const history = [];
      for (const code of codes) { const key = document.createElement('div'); key.className = 'key'; key.dataset.code = code; key.textContent = code.replace('Key', '').replace('Digit', ''); $('keys').append(key); }
      const find = code => [...$('keys').children].find(el => el.dataset.code === code);
      function down(event) {
        if (!['Tab', 'Escape'].includes(event.code) && !event.metaKey && !event.ctrlKey) { event.preventDefault(); }
        const key = find(event.code); if (key) { key.classList.add('pressed', 'seen'); }
        $('keyInfo').textContent = `${event.key} · ${event.code}${event.repeat ? ' · повтор' : ''}`;
        history.unshift(`${event.code} (key=${event.key}, location=${event.location})`); history.splice(12);
        $('keyHistory').textContent = history.join('\n');
      }
      function up(event) { find(event.code)?.classList.remove('pressed'); }
      panel.addEventListener('keydown', down); panel.addEventListener('keyup', up);
      const release = () => { panel.querySelectorAll('.pressed').forEach(key => key.classList.remove('pressed')); }; panel.addEventListener('focusout', release); window.addEventListener('blur', release); cleanups.push(() => window.removeEventListener('blur', release));
      button('resetKeys', 'Сбросить', () => { [...$('keys').children].forEach(el => { el.className = 'key'; }); history.length = 0; $('keyHistory').textContent = ''; panel.focus(); });
    }
    if (kind === 'mouse') {
      panel.innerHTML = '<h2>Мышь</h2><div id="mouseArea" class="drop" tabindex="0" style="height:250px;display:grid;place-items:center">Нажимай кнопки и вращай колесо в этой области</div><div id="mouseButtons" class="chips"><span class="key" data-mouse="0">Левая</span><span class="key" data-mouse="1">Средняя</span><span class="key" data-mouse="2">Правая</span><span class="key" data-mouse="3">Назад</span><span class="key" data-mouse="4">Вперёд</span></div><p class="muted">Ярко-зелёный — нажато, бледный — проверено.</p><pre id="mouseInfo"></pre><button id="resetMouse">Сбросить</button>';
      let presses = {}; let wheels = 0; let doubleClicks = 0; let previous = 0; let interval = 0;
      function display() { $('mouseInfo').textContent = `Нажатия: ${JSON.stringify(presses)}\nКолесо: ${wheels}\nДвойные клики: ${doubleClicks}\nИнтервал последних нажатий: ${interval.toFixed(0)} мс`; }
      $('mouseArea').addEventListener('pointerdown', event => { event.preventDefault(); const indicator = panel.querySelector(`[data-mouse="${event.button}"]`); indicator?.classList.add('pressed', 'seen'); $('mouseArea').setPointerCapture(event.pointerId); presses[event.button] = (presses[event.button] || 0) + 1; interval = previous ? performance.now() - previous : 0; previous = performance.now(); display(); });
      $('mouseArea').addEventListener('pointerup', event => { panel.querySelector(`[data-mouse="${event.button}"]`)?.classList.remove('pressed'); });
      const releaseMouse = () => { panel.querySelectorAll('.pressed').forEach(key => key.classList.remove('pressed')); }; window.addEventListener('blur', releaseMouse); cleanups.push(() => window.removeEventListener('blur', releaseMouse));
      $('mouseArea').addEventListener('contextmenu', event => event.preventDefault());
      $('mouseArea').addEventListener('dblclick', () => { doubleClicks += 1; display(); });
      $('mouseArea').addEventListener('wheel', event => { event.preventDefault(); wheels += event.deltaY; display(); }, {passive: false});
      button('resetMouse', '', () => { presses = {}; wheels = 0; doubleClicks = 0; previous = 0; panel.querySelectorAll('[data-mouse]').forEach(key => { key.className = 'key'; }); display(); }); display();
    }
    if (kind === 'microphone' || kind === 'camera') {
      const mic = kind === 'microphone';
      panel.innerHTML = `<h2>${mic ? 'Микрофон' : 'Веб-камера'}</h2>${select('inputDevice', 'Устройство', [['', 'По умолчанию']])}<div class="actions"><button id="startDevice" class="primary">Включить</button><button id="stopDevice">Остановить</button>${mic ? '<button id="record" disabled>Записать</button><button id="stopRecord" disabled>Завершить запись</button>' : ''}</div>${mic ? '<p>Уровень сигнала</p><div class="meter"><div id="level"></div></div><p id="levelText" class="muted"></p><audio id="recording" controls hidden></audio><button id="saveRecording" hidden>Скачать запись</button>' : '<video id="cameraVideo" playsinline muted style="max-height:480px"></video>'}<pre id="deviceInfo"></pre>`;
      let stream; let context; let frame; let recorder; let chunks = []; let result; let resultURL;
      function stop() {
        cancelAnimationFrame(frame);
        if (recorder?.state === 'recording') { recorder.stop(); }
        stream?.getTracks().forEach(track => track.stop()); stream = null;
        context?.close(); context = null;
        if ($('cameraVideo')) { $('cameraVideo').srcObject = null; }
        if ($('level')) { $('level').style.width = '0%'; }
      }
      cleanups.push(stop, () => { if (resultURL) { URL.revokeObjectURL(resultURL); } });
      button('stopDevice', '', stop);
      async function enumerate() {
        const list = await navigator.mediaDevices.enumerateDevices();
        const selected = $('inputDevice').value;
        $('inputDevice').replaceChildren(new Option('По умолчанию', ''));
        for (const device of list.filter(item => item.kind === (mic ? 'audioinput' : 'videoinput'))) {
          $('inputDevice').add(new Option(device.label || `Устройство ${$('inputDevice').options.length}`, device.deviceId));
        }
        if ([...$('inputDevice').options].some(option => option.value === selected)) { $('inputDevice').value = selected; }
      }
      if (!navigator.mediaDevices) { throw new Error('Доступ к устройствам требует HTTPS и поддерживаемого браузера.'); }
      await enumerate();
      button('startDevice', '', async () => {
        stop(); const id = $('inputDevice').value;
        stream = await navigator.mediaDevices.getUserMedia(mic ? {audio: {deviceId: id ? {exact: id} : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false}} : {video: {deviceId: id ? {exact: id} : undefined}});
        await enumerate(); $('deviceInfo').textContent = JSON.stringify(stream.getTracks()[0].getSettings(), null, 2);
        if (mic) {
          context = new AudioContext(); await context.resume();
          const source = context.createMediaStreamSource(stream); const analyser = context.createAnalyser();
          analyser.fftSize = 1024; source.connect(analyser);
          const buffer = new Float32Array(analyser.fftSize);
          function meter() {
            analyser.getFloatTimeDomainData(buffer);
            const peak = Math.max(...buffer.map(Math.abs));
            $('level').style.width = `${Math.min(100, peak * 100)}%`;
            $('levelText').textContent = `Пик: ${peak > 0 ? (20 * Math.log10(peak)).toFixed(1) : '−∞'} dBFS`;
            frame = requestAnimationFrame(meter);
          }
          meter(); $('record').disabled = false;
        } else { $('cameraVideo').srcObject = stream; await $('cameraVideo').play(); }
        status('Устройство включено. Данные не отправляются на сервер.');
      });
      if (mic) {
        button('record', '', () => {
          if (!stream) { throw new Error('Сначала включи микрофон.'); }
          if (!window.MediaRecorder) { throw new Error('Запись не поддерживается браузером.'); }
          chunks = []; recorder = new MediaRecorder(stream);
          recorder.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); } };
          recorder.onstop = () => {
            result = new Blob(chunks, {type: recorder.mimeType});
            if (resultURL) { URL.revokeObjectURL(resultURL); }
            resultURL = URL.createObjectURL(result);
            if ($('recording')) { $('recording').src = resultURL; $('recording').hidden = false; $('saveRecording').hidden = false; $('stopRecord').disabled = true; $('record').disabled = !stream; }
          };
          recorder.start(); $('stopRecord').disabled = false; $('record').disabled = true;
        });
        button('stopRecord', '', () => { if (recorder?.state === 'recording') { recorder.stop(); } });
        button('saveRecording', '', () => { if (result) { download(result, `microphone-test.${result.type.includes('mp4') ? 'm4a' : result.type.includes('ogg') ? 'ogg' : 'webm'}`); } });
      }
    }
    if (kind === 'headphones') {
      panel.innerHTML = `<h2>Наушники / колонки</h2><p class="muted">Начни с небольшой громкости. Тест воспроизводит короткий тон в выбранном канале.</p><div class="row">${field('frequency', 'Частота, Гц', 'number', 440, 'min="40" max="16000"')}${field('volume', 'Громкость теста, %', 'number', 10, 'min="0" max="50"')}</div><div class="actions"><button id="left">Левый</button><button id="right">Правый</button><button id="both">Оба канала</button><button id="stopSound">Стоп</button></div>`;
      let context;
      function stop() { context?.close(); context = null; }
      cleanups.push(stop); button('stopSound', '', stop);
      async function play(channel) {
        stop(); context = new AudioContext(); await context.resume();
        const oscillator = context.createOscillator(); const gain = context.createGain();
        const pan = context.createStereoPanner(); pan.pan.value = channel;
        oscillator.frequency.value = Math.max(40, Math.min(16000, number('frequency', 440)));
        gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(50, number('volume', 10))) / 100, context.currentTime + .03);
        gain.gain.setTargetAtTime(0, context.currentTime + .8, .03);
        oscillator.connect(gain).connect(pan).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 1);
      }
      button('left', '', () => play(-1)); button('right', '', () => play(1)); button('both', '', () => play(0));
    }
    if (kind === 'gamepad') {
      panel.innerHTML = `<h2>Геймпад</h2><p class="muted">Подключи геймпад и нажми на нём кнопку, чтобы браузер обнаружил устройство.</p>${field('deadzone', 'Мёртвая зона', 'number', .1, 'min="0" max="0.9" step="0.01"')}<div id="gamepads"></div>`;
      let frame; const seen = new Set();
      function update() {
        const pads = [...navigator.getGamepads()].filter(Boolean); const target = $('gamepads'); target.replaceChildren();
        if (!pads.length) { target.textContent = 'Ожидание геймпада…'; }
        for (const pad of pads) {
          const card = document.createElement('div'); card.className = 'block';
          const title = document.createElement('h3'); title.textContent = pad.id;
          const axes = document.createElement('pre');
          const deadzone = Math.max(0, Math.min(.9, number('deadzone', .1)));
          axes.textContent = pad.axes.map((v, i) => `Ось ${i}: ${v.toFixed(4)} ${Math.abs(v) < deadzone ? '(мёртвая зона)' : ''}`).join('\n');
          const buttons = document.createElement('div'); buttons.className = 'chips';
          pad.buttons.forEach((item, i) => { const el = document.createElement('span'); if(item.pressed){seen.add(`${pad.index}:${i}`);} el.className = `chip key${seen.has(`${pad.index}:${i}`)?' seen':''}${item.pressed?' pressed':''}`; el.textContent = `${i}: ${item.value.toFixed(2)}`; buttons.append(el); });
          card.append(title, axes, buttons); target.append(card);
        }
        frame = requestAnimationFrame(update);
      }
      frame = requestAnimationFrame(update); cleanups.push(() => cancelAnimationFrame(frame));
    }
  }
  for (const [id, name, description] of kinds) {
    const button = document.createElement('button'); button.className = 'tile'; button.innerHTML = `<strong>${name}</strong><small>${description}</small>`;
    button.addEventListener('click', () => { show(id).catch(error => status(error.message, true)); }); $('deviceMenu').append(button);
  }
}
