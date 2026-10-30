import { $, esc, field, select, action, status, number, persist, restore, download, teardown } from '../ui.js';
const displayTime = milliseconds => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor(seconds / 60 % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
};
export function timing(root) {
  root.innerHTML = `<section class="panel"><div class="row">${field('timerName', 'Название', 'text', 'Таймер')}${field('timerHours', 'Часы', 'number', 0, 'min="0" max="999"')}${field('timerMinutes', 'Минуты', 'number', 5, 'min="0" max="59"')}${field('timerSeconds', 'Секунды', 'number', 0, 'min="0" max="59"')}</div><div class="actions"><button id="addTimer" class="primary">Добавить таймер</button>${[1,5,10,25].map(value => `<button data-preset="${value}">${value} мин</button>`).join('')}</div><div class="row">${select('timerSound', 'Сигнал', [['bell', 'Колокол'], ['beep', 'Сигнал'], ['soft', 'Мягкий'], ['silent', 'Без звука']])}<label>Громкость<input id="timerVolume" type="range" min="0" max="100" value="65"></label></div><div class="actions"><button id="testAlarm">Проверить звук</button><button id="stopAlarm">Остановить сигнал</button><button id="timingFullscreen">Полный экран</button></div><p class="muted">При первом запуске нажми «Проверить звук». Для сигнала держи страницу открытой: при закрытии браузера или усыплении устройства звук не гарантируется. Оставшееся время восстанавливается по часам устройства.</p></section><section class="panel" id="timingStage"><h2>Таймеры</h2><div id="timerList" class="grid"></div><h2 style="margin-top:28px">Секундомер</h2><div id="stopwatchTime" class="big">00:00:00.00</div><div class="actions"><button id="stopwatchStart" class="primary">Старт</button><button id="stopwatchLap">Круг</button><button id="stopwatchReset">Сброс</button><button id="saveLaps">Скачать круги CSV</button></div><div id="lapList" class="table-wrap"></div></section>`;
  const stored = restore('timing', {}); let timers = Array.isArray(stored.timers) ? stored.timers : [];
  let watch = stored.watch || {elapsed: 0, since: null, laps: []}; let context; const oscillators = new Set(); const alarms = new Set();
  let lastSave = Date.now();
  const elapsed = () => watch.elapsed + (watch.since === null ? 0 : Date.now() - watch.since);
  const remaining = timer => timer.running ? Math.max(0, timer.deadline - Date.now()) : timer.remaining;
  function save() { persist('timing', {timers, watch}); }
  async function unlock() {
    if (!context) { context = new AudioContext(); }
    if (context.state === 'suspended') { await context.resume(); }
  }
  function sound() {
    if (!context || context.state !== 'running' || $('timerSound').value === 'silent') { return; }
    const kind = $('timerSound').value;
    for (let i = 0; i < 3; i += 1) {
      const oscillator = context.createOscillator(); const gain = context.createGain(); const start = context.currentTime + i * .35;
      oscillator.type = kind === 'beep' ? 'square' : 'sine'; oscillator.frequency.value = kind === 'bell' ? 880 + i * 220 : kind === 'soft' ? 440 : 740;
      gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(number('timerVolume', 65) / 100 * .18 + .0001, start + .012); gain.gain.exponentialRampToValueAtTime(.0001, start + .3);
      oscillator.connect(gain).connect(context.destination); oscillator.start(start); oscillator.stop(start + .32); oscillators.add(oscillator);
      oscillator.onended = () => { oscillators.delete(oscillator); gain.disconnect(); };
    }
  }
  function draw() {
    $('timerList').innerHTML = timers.map(timer => `<div class="tile ${timer.finished ? 'timer-finished' : ''}" data-timer="${esc(timer.id)}"><strong>${esc(timer.name)}</strong><div class="clock" data-time>${displayTime(remaining(timer))}</div><small>${timer.finished ? 'Время вышло' : timer.running ? 'Идёт отсчёт' : 'Пауза'}</small><div class="actions"><button data-timer-action="toggle">${timer.running ? 'Пауза' : 'Старт'}</button><button data-timer-action="repeat">Заново</button><button data-timer-action="remove">Удалить</button></div></div>`).join('') || '<p class="muted">Таймеров пока нет.</p>';
    $('stopwatchStart').textContent = watch.since === null ? 'Старт' : 'Пауза';
    $('lapList').innerHTML = `<table><tr><th>Круг</th><th>Отсечка, с</th><th>Круг, с</th></tr>${watch.laps.map((lap, i) => `<tr><td>${i + 1}</td><td>${(lap / 1000).toFixed(2)}</td><td>${((lap - (watch.laps[i - 1] || 0)) / 1000).toFixed(2)}</td></tr>`).join('')}</table>`;
  }
  action('addTimer', () => {
    const hours = number('timerHours'); const minutes = number('timerMinutes'); const seconds = number('timerSeconds');
    if (![hours, minutes, seconds].every(Number.isInteger) || hours < 0 || hours > 999 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) { throw new Error('Часы 0–999, минуты и секунды 0–59, целые числа.'); }
    const duration = (hours * 3600 + minutes * 60 + seconds) * 1000;
    if (!duration || timers.length >= 20) { throw new Error('Нужно ненулевое время; максимум 20 таймеров.'); }
    timers.push({id: `${Date.now()}-${Math.random()}`, name: $('timerName').value.trim() || 'Таймер', duration, remaining: duration, running: false, finished: false}); save(); draw();
  });
  root.addEventListener('click', event => {
    const value = event.target.dataset.preset; if (value) { $('timerHours').value = 0; $('timerMinutes').value = value; $('timerSeconds').value = 0; }
  });
  $('timerList').onclick = async event => {
    const action = event.target.dataset.timerAction; if (!action) { return; }
    const timer = timers.find(item => item.id === event.target.closest('[data-timer]').dataset.timer); if (!timer) { return; }
    alarms.delete(timer.id);
    if (action === 'remove') { timers = timers.filter(item => item !== timer); }
    else if (action === 'repeat') { timer.running = false; timer.remaining = timer.duration; timer.finished = false; }
    else if (timer.running) { timer.remaining = remaining(timer); timer.running = false; }
    else {
      try { await unlock(); } catch (error) { status('Звук недоступен, таймер продолжит работу.'); }
      if (timer.remaining <= 0) { timer.remaining = timer.duration; }
      timer.deadline = Date.now() + timer.remaining; timer.running = true; timer.finished = false;
    }
    save(); draw();
  };
  action('testAlarm', async () => { await unlock(); sound(); status('Проверка сигнала.'); });
  $('stopAlarm').onclick = () => { alarms.clear(); for (const oscillator of oscillators) { try { oscillator.stop(); } catch (error) {} } };
  action('timingFullscreen', async () => { if (document.fullscreenElement) { await document.exitFullscreen(); } else { await $('timingStage').requestFullscreen(); } });
  $('stopwatchStart').onclick = () => { if (watch.since === null) { watch.since = Date.now(); } else { watch.elapsed = elapsed(); watch.since = null; } save(); draw(); };
  $('stopwatchLap').onclick = () => { if (watch.since !== null && watch.laps.length < 1000) { watch.laps.push(elapsed()); save(); draw(); } };
  $('stopwatchReset').onclick = () => { watch = {elapsed: 0, since: null, laps: []}; save(); draw(); };
  action('saveLaps', () => { const csv = 'Круг;Отсечка (с);Круг (с)\r\n' + watch.laps.map((lap, i) => `${i + 1};${(lap / 1000).toFixed(3)};${((lap - (watch.laps[i - 1] || 0)) / 1000).toFixed(3)}`).join('\r\n'); download(new Blob(['\ufeff', csv], {type: 'text/csv;charset=utf-8'}), 'stopwatch-laps.csv'); });
  let lastSound = 0;
  const interval = setInterval(() => {
    for (const timer of timers) {
      if (timer.running && remaining(timer) === 0) { timer.running = false; timer.remaining = 0; timer.finished = true; alarms.add(timer.id); save(); draw(); }
    }
    for (const tile of $('timerList').querySelectorAll('[data-timer]')) { const timer = timers.find(item => item.id === tile.dataset.timer); tile.querySelector('[data-time]').textContent = displayTime(remaining(timer)); }
    const time = elapsed(); $('stopwatchTime').textContent = `${displayTime(Math.floor(time / 1000) * 1000)}.${Math.floor(time % 1000 / 10).toString().padStart(2, '0')}`;
    if (alarms.size && Date.now() - lastSound > 2500) { sound(); lastSound = Date.now(); }
    if (Date.now() - lastSave > 3000) { save(); lastSave = Date.now(); }
  }, 50);
  teardown(() => { clearInterval(interval); save(); context?.close(); }); draw();
}
