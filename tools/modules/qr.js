import { $, field, select, files, action, status, number, download, toBlob, readImage, teardown, canvas } from '../ui.js';

export async function qr(root) {
  const {QRCode, jsQR} = await import('../vendor/vendor.js');
  root.innerHTML = `<div class="two"><section class="panel"><h2>Создать QR</h2>${select('type', 'Содержимое', [['text', 'Текст / ссылка'], ['wifi', 'Wi-Fi'], ['contact', 'Контакт']])}<label id="textField">Текст или ссылка<textarea id="text">https://graymans1on.github.io/tools/</textarea></label><div id="wifiFields" hidden>${field('ssid', 'Название сети')}${field('password', 'Пароль', 'password')}${select('security', 'Защита', ['WPA', 'WEP', 'nopass'])}<label><input id="hiddenNetwork" type="checkbox"> Скрытая сеть</label></div><div id="contactFields" hidden>${field('contactName', 'Имя')}${field('phone', 'Телефон', 'tel')}${field('email', 'Email', 'email')}</div><div class="row">${field('size', 'Размер PNG', 'number', 512, 'min="128" max="4096"')}${field('dark', 'Код', 'color', '#28282f')}${field('light', 'Фон', 'color', '#ffffff')}${select('correction', 'Коррекция ошибок', ['M', 'L', 'Q', 'H'])}</div><div class="actions"><button id="generate" class="primary">Создать</button><button id="png">PNG</button><button id="svg">SVG</button></div></section><section class="panel"><canvas id="qrCanvas"></canvas><p class="muted">Сохраняй контраст: тёмный код на светлом фоне.</p></section></div><section class="panel"><h2>Прочитать QR</h2>${files('scanFile', 'image/*', false)}<div class="actions"><button id="scan">Прочитать файл</button><button id="camera">Включить камеру</button><button id="stop">Остановить камеру</button></div><video id="video" playsinline muted hidden style="max-height:360px"></video><label>Распознанное содержимое<textarea id="decoded" readonly></textarea></label></section>`;
  const sheet=document.createElement('section');sheet.className='panel';sheet.innerHTML='<h2>Лист QR-кодов для печати</h2><label>Строка: подпись | содержимое QR<textarea id="sheetItems" placeholder="Мой сайт | https://example.com\nКонтакт | mail@example.com"></textarea></label><div class="row">'+select('sheetCols','Колонок',['2','3','4'])+select('sheetRows','Строк на странице',['3','4','5','6'])+'</div><div class="actions"><button id="buildSheet">Подготовить A4</button><button id="saveSheet" disabled>Скачать PDF для печати</button></div><p id="sheetInfo" class="muted"></p><canvas id="sheetPreview" style="max-height:700px;width:auto"></canvas>';root.append(sheet);let sheetPDF;
  action('buildSheet',async()=>{sheetPDF=null;$('saveSheet').disabled=true;const entries=$('sheetItems').value.trim().split('\n').filter(line=>line.trim()).map(line=>{const index=line.indexOf('|');return {label:index>=0?line.slice(0,index).trim():'',value:index>=0?line.slice(index+1).trim():line.trim()};});if(!entries.length||entries.length>240||entries.some(item=>!item.value)){throw new Error('Нужно 1–240 кодов с непустым содержимым.');}const {PDFDocument}=await import('../vendor/vendor.js');const pdf=await PDFDocument.create();const cols=Number($('sheetCols').value);const rows=Number($('sheetRows').value);const perPage=cols*rows;const pageCanvas=canvas(1240,1754);const pageCtx=pageCanvas.getContext('2d');for(let start=0;start<entries.length;start+=perPage){pageCtx.fillStyle='white';pageCtx.fillRect(0,0,1240,1754);const cellW=1140/cols;const cellH=1654/rows;const size=Math.floor(Math.min(cellW-24,cellH-65));for(let i=0;i<perPage&&start+i<entries.length;i+=1){const item=entries[start+i];const code=canvas(size,size);await QRCode.toCanvas(code,item.value,{...options(),width:size});const x=50+i%cols*cellW;const y=50+Math.floor(i/cols)*cellH;pageCtx.drawImage(code,x+(cellW-size)/2,y);pageCtx.save();pageCtx.beginPath();pageCtx.rect(x,y+size,cellW,60);pageCtx.clip();pageCtx.textAlign='center';pageCtx.font='18px sans-serif';pageCtx.fillStyle='#28282f';pageCtx.fillText(item.label.slice(0,100),x+cellW/2,y+size+25,cellW-12);pageCtx.restore();}if(start===0){$('sheetPreview').width=1240;$('sheetPreview').height=1754;$('sheetPreview').getContext('2d').drawImage(pageCanvas,0,0);}const image=await pdf.embedPng(await (await toBlob(pageCanvas)).arrayBuffer());pdf.addPage([595.28,841.89]).drawImage(image,{x:0,y:0,width:595.28,height:841.89});}sheetPDF=new Blob([await pdf.save()],{type:'application/pdf'});$('saveSheet').disabled=false;$('sheetInfo').textContent=`Кодов: ${entries.length}; страниц: ${Math.ceil(entries.length/perPage)}. Предпросмотр первой страницы. Печать: A4, масштаб 100%.`;});
  action('saveSheet',()=>{if(!sheetPDF){throw new Error('Сначала подготовь лист.');}download(sheetPDF,'qr-print-sheet.pdf');});
  let stream; let frame;
  function content() {
    const escapeWifi = text => text.replace(/[\\;,:"']/g, '\\$&');
    if ($('type').value === 'wifi') {
      if (!$('ssid').value) { throw new Error('Введи название сети.'); }
      return `WIFI:T:${$('security').value};S:${escapeWifi($('ssid').value)};P:${escapeWifi($('password').value)};H:${$('hiddenNetwork').checked};;`;
    }
    if ($('type').value === 'contact') {
      const v = value => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, '\\$&');
      return `BEGIN:VCARD\nVERSION:3.0\nFN:${v($('contactName').value)}\nTEL:${v($('phone').value)}\nEMAIL:${v($('email').value)}\nEND:VCARD`;
    }
    if (!$('text').value.trim()) { throw new Error('Введи содержимое QR.'); }
    return $('text').value;
  }
  function options() {
    return {width: Math.round(Math.max(128, Math.min(4096, number('size', 512)))), margin: 4, errorCorrectionLevel: $('correction').value, color: {dark: $('dark').value, light: $('light').value}};
  }
  async function generate() { await QRCode.toCanvas($('qrCanvas'), content(), options()); status('QR-код готов.'); }
  action('generate', generate);
  action('png', async () => { await generate(); download(await toBlob($('qrCanvas')), 'qr-code.png'); });
  action('svg', async () => { download(new Blob([await QRCode.toString(content(), {...options(), type: 'svg'})], {type: 'image/svg+xml'}), 'qr-code.svg'); });
  $('type').addEventListener('change', () => {
    $('textField').hidden = $('type').value !== 'text'; $('wifiFields').hidden = $('type').value !== 'wifi'; $('contactFields').hidden = $('type').value !== 'contact';
  });
  const scanner = document.createElement('canvas'); const ctx = scanner.getContext('2d', {willReadFrequently: true});
  function decode(image, width, height) {
    const ratio = Math.min(1, 1600 / Math.max(width, height));
    scanner.width = Math.round(width * ratio); scanner.height = Math.round(height * ratio);
    ctx.drawImage(image, 0, 0, scanner.width, scanner.height);
    const pixels = ctx.getImageData(0, 0, scanner.width, scanner.height);
    return jsQR(pixels.data, pixels.width, pixels.height, {inversionAttempts: 'attemptBoth'});
  }
  action('scan', async () => {
    const file = $('scanFile').files[0]; if (!file) { throw new Error('Выбери изображение с QR-кодом.'); }
    const bitmap = await readImage(file);
    try {
      const code = decode(bitmap, bitmap.width, bitmap.height);
      if (!code) { throw new Error('QR-код не найден. Попробуй более чёткое изображение.'); }
      $('decoded').value = code.data; status('QR-код распознан. Ссылки автоматически не открываются.');
    } finally { bitmap.close(); }
  });
  function stop() {
    if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
    cancelAnimationFrame(frame); $('video').srcObject = null; $('video').hidden = true;
  }
  action('stop', stop); teardown(stop);
  action('camera', async () => {
    stop();
    if (!navigator.mediaDevices?.getUserMedia) { throw new Error('Камера доступна только через HTTPS в поддерживаемом браузере.'); }
    stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}});
    $('video').srcObject = stream; $('video').hidden = false; await $('video').play();
    let last = 0;
    function tick(time) {
      if (time - last > 250 && $('video').videoWidth) {
        last = time;
        const code = decode($('video'), $('video').videoWidth, $('video').videoHeight);
        if (code) { $('decoded').value = code.data; status('QR-код распознан.'); stop(); return; }
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  });
  await generate();
}
