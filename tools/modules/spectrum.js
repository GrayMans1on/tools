import { $, field, select, files, action, status, number, toBlob, download, teardown } from '../ui.js';
import { decodeAudio } from '../audio-core.js?v=20261031-v06';

export function spectrum(root) {
  root.innerHTML = `<section class="panel">${files('spectrumFile', 'audio/*', false)}<audio id="spectrumAudio" controls style="width:100%"></audio><p id="spectrumInfo" class="muted"></p><div class="row">${field('spectrumStart', 'Начало, с', 'number', 0, 'min="0" step="0.01"')}${field('spectrumEnd', 'Конец, с', 'number', 10, 'min="0" step="0.01"')}${field('minHz', 'Нижняя частота, Hz', 'number', 20, 'min="1"')}${field('maxHz', 'Верхняя частота, Hz', 'number', 20000, 'min="2"')}</div><div class="row">${select('fftSize', 'Размер FFT', ['512','1024','2048','4096'])}${select('freqScale', 'Шкала частот', [['log', 'Логарифмическая'], ['linear', 'Линейная']])}${select('spectrumPalette', 'Цвета', [['heat', 'Тепловая'], ['ocean', 'Океан'], ['gray', 'Монохром']])}${field('dbFloor', 'Нижний уровень, dBFS', 'number', -90, 'min="-140" max="-20"')}</div><div class="actions"><button id="renderSpectrum" class="primary">Построить</button><button id="cancelSpectrum">Остановить расчёт</button><button id="saveSpectrum" disabled>Скачать PNG</button><button id="resetSpectrum">Весь файл</button></div></section><section class="panel"><div class="spectrum-stage"><canvas id="spectrumCanvas" width="1200" height="500"></canvas><div id="spectrumCursor" hidden></div></div><p class="muted">Нажатие — перейти к моменту. Shift + протягивание — выделить временной участок, затем «Построить». Цвет показывает уровень отдельной FFT-ячейки, dBFS. Частотная и временная детализация зависят от размера FFT.</p></section>`;
  let buffer; let url; let worker; let view; let selection;
  $('fftSize').value = '2048';
  $('spectrumFile').onchange = async () => {
    try {
      const file = $('spectrumFile').files[0]; if (!file) { return; }
      worker?.terminate(); buffer = null; $('saveSpectrum').disabled = true;
      if (file.size > 100e6) { throw new Error('Аудиофайл — до 100 МБ.'); }
      const decoded = await decodeAudio(file); buffer = decoded;
      if (url) { URL.revokeObjectURL(url); } url = URL.createObjectURL(file); $('spectrumAudio').src = url;
      $('spectrumEnd').value = decoded.duration.toFixed(3); $('maxHz').value = Math.min(20000, decoded.sampleRate / 2);
      $('spectrumInfo').textContent = `${file.name} · ${decoded.duration.toFixed(2)} с · ${decoded.sampleRate} Hz · ${decoded.numberOfChannels} каналов. Для анализа каналы усредняются.`;
      status('Файл готов к построению.');
    } catch (error) { status(error.message, true); }
  };
  action('renderSpectrum', async () => {
    if (!buffer) { throw new Error('Выбери аудиофайл.'); }
    const start = number('spectrumStart'); const end = number('spectrumEnd'); const minHz = number('minHz'); const maxHz = number('maxHz'); const floor = number('dbFloor');
    if (start < 0 || end <= start || end > buffer.duration + .01 || minHz < 1 || maxHz <= minHz || maxHz > buffer.sampleRate / 2 || floor < -140 || floor > -20) { throw new Error('Проверь время, частоты и диапазон dBFS.'); }
    worker?.terminate(); worker = new Worker('./spectrum-worker.js', {type: 'module'});
    const from = Math.floor(start * buffer.sampleRate); const until = Math.min(buffer.length, Math.ceil(end * buffer.sampleRate));
    const samples = new Float32Array(until - from);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel); for (let i = 0; i < samples.length; i += 1) { samples[i] += data[from + i] / buffer.numberOfChannels; }
    }
    view = {start, end, minHz, maxHz, log: $('freqScale').value === 'log'};
    const plotWidth = 1100; const plotHeight = 430; const target = $('spectrumCanvas');
    worker.onmessage = event => {
      if (event.data.error) { status(event.data.error, true); return; }
      if (event.data.progress !== undefined) { status(`Расчёт ${event.data.progress}%…`); return; }
      const plot = document.createElement('canvas'); plot.width = plotWidth; plot.height = plotHeight;
      plot.getContext('2d').putImageData(new ImageData(event.data.pixels, plotWidth, plotHeight), 0, 0);
      const ctx = target.getContext('2d'); ctx.fillStyle = '#fafbfe'; ctx.fillRect(0, 0, 1200, 500); ctx.drawImage(plot, 75, 15);
      ctx.fillStyle = '#59647c'; ctx.font = '13px sans-serif';
      for (let i = 0; i <= 5; i += 1) {
        const hz = view.log ? minHz * (maxHz / minHz) ** (i / 5) : minHz + (maxHz - minHz) * i / 5;
        ctx.fillText(`${Math.round(hz)} Hz`, 5, 447 - i / 5 * plotHeight);
        ctx.fillText(`${(start + (end - start) * i / 5).toFixed(2)} с`, 75 + i / 5 * plotWidth, 477);
      }
      $('saveSpectrum').disabled = false; status('Спектрограмма готова.'); worker.terminate();
    };
    worker.onerror = () => { status('Ошибка расчёта спектрограммы.', true); };
    worker.postMessage({samples, sampleRate: buffer.sampleRate, start: 0, end: (until - from) / buffer.sampleRate, size: number('fftSize'), width: plotWidth, height: plotHeight, minHz, maxHz, log: view.log, floor, palette: $('spectrumPalette').value}, [samples.buffer]);
  });
  $('cancelSpectrum').onclick = () => { worker?.terminate(); status('Расчёт остановлен.'); };
  $('resetSpectrum').onclick = () => { if (buffer) { $('spectrumStart').value = 0; $('spectrumEnd').value = buffer.duration.toFixed(3); } };
  function timeAt(event) { const rect = $('spectrumCanvas').getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width * 1200; return view.start + Math.max(0, Math.min(1, (x - 75) / 1100)) * (view.end - view.start); }
  $('spectrumCanvas').onpointerdown = event => { if (view) { selection = {time: timeAt(event), shift: event.shiftKey}; $('spectrumCanvas').setPointerCapture(event.pointerId); } };
  $('spectrumCanvas').onpointerup = event => {
    if (!view || !selection) { return; }
    const end = timeAt(event);
    if (selection.shift && Math.abs(end - selection.time) > .01) { $('spectrumStart').value = Math.min(selection.time, end).toFixed(3); $('spectrumEnd').value = Math.max(selection.time, end).toFixed(3); status('Участок выделен. Нажми «Построить» для увеличения.'); }
    else { $('spectrumAudio').currentTime = end; }
    selection = null;
  };
  $('spectrumAudio').ontimeupdate = () => {
    if (!view) { return; } const ratio = ($('spectrumAudio').currentTime - view.start) / (view.end - view.start);
    $('spectrumCursor').hidden = ratio < 0 || ratio > 1; $('spectrumCursor').style.left = `${(75 + ratio * 1100) / 1200 * 100}%`;
  };
  action('saveSpectrum', async () => { download(await toBlob($('spectrumCanvas')), 'spectrogram.png'); });
  teardown(() => { worker?.terminate(); $('spectrumAudio').pause(); if (url) { URL.revokeObjectURL(url); } });
}
