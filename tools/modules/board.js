import { $, esc, field, select, action, status, number, download, toBlob, canvas, readImage, teardown } from '../ui.js';
import { newBoard, bounds, boardBounds, validateBoard, moveObject, scaleObject, attachment, bindingPoint, resolveBindings, arrowPoints } from '../board-core.js?v=20261031-v06';

export async function board(root) {
  root.innerHTML = `<section class="panel board-toolbar"><div class="actions"><button id="downloadBoard" class="primary">Скачать доску</button><label class="button">Открыть доску<input id="openBoard" type="file" accept=".gmboard" hidden></label><button id="saveBoardFile">Сохранить в тот же файл</button><button id="newBoard">Новая доска</button><button id="restoreBoardBackup" hidden>Предыдущая доска</button><button id="boardFullscreen">Полный экран</button></div><p id="boardSaveState" class="muted">Доска хранится на этом устройстве. Сервер не используется.</p><div class="board-tools" role="toolbar" aria-label="Инструменты рисования">${[['select','Выделение'],['hand','Рука'],['pen','Перо'],['highlight','Хайлайтер'],['rect','Прямоугольник'],['ellipse','Эллипс'],['arrow','Стрелка'],['eraser','Ластик'],['text','Текст'],['table','Таблица']].map(([id, label]) => `<button data-board-tool="${id}" aria-pressed="${id === 'select'}">${label}</button>`).join('')}<label class="button">Картинка<input id="boardImage" type="file" accept="image/png,image/jpeg,image/webp" hidden multiple></label></div><details class="board-properties"><summary>Оформление и операции</summary><div class="row">${select('arrowStyle','Линия стрелки',[['straight','Прямая'],['elbow','С изгибами']])}${field('bendOffset','Сдвиг изгиба, px','number',0,'step="10"')}${field('boardColor', 'Цвет', 'color', '#606a86')}${field('boardFill', 'Заливка', 'color', '#eef0f7')}<label><input id="noFill" type="checkbox" checked> Без заливки</label>${field('boardWidth', 'Толщина', 'number', 3, 'min="1" max="80"')}${field('boardSize', 'Размер текста', 'number', 24, 'min="8" max="300"')}${field('boardBackground', 'Фон доски', 'color', '#ffffff')}</div><div class="actions"><button id="boardUndo">Отменить</button><button id="boardRedo">Повторить</button><button id="boardDuplicate">Дублировать</button><button id="boardDelete">Удалить выбранное</button><button id="boardFront">Вперёд</button><button id="boardBack">Назад</button><button id="boardGroup">Сгруппировать</button><button id="boardUngroup">Разгруппировать</button><label><input id="boardGrid" type="checkbox" checked> Сетка</label></div></details><div id="boardQuick" class="actions"><label><input id="keepTool" type="checkbox"> Закрепить инструмент (Q)</label><button id="boardHelp">Горячие клавиши</button><span id="boardSelection" class="muted"></span></div></section><section class="board-stage" id="boardStage"><canvas id="boardCanvas" aria-label="Бесконечная доска" tabindex="0"></canvas><div class="board-zoom"><button id="zoomOut" aria-label="Отдалить">−</button><span id="zoomLevel">100%</span><button id="zoomIn" aria-label="Приблизить">+</button><button id="fitBoard">Вся доска</button><button id="resetBoardView">100%</button></div></section><section class="panel"><p class="muted">Перо и хайлайтер: протяни мышь. Фигуры: протяни от угла до угла. Текст и таблица: нажми на доску. Выделение: нажми на объект или обведи рамкой; Shift — несколько объектов. Нижний правый маркер меняет размер. Space + перетаскивание или средняя кнопка — перемещение; колесо — перемещение; Ctrl/Cmd + колесо — масштаб. Ctrl+Z / Ctrl+Shift+Z — отмена; Delete — удаление. Изображения можно перетащить или вставить из буфера.</p><label>Текст выбранного объекта / содержимое таблицы<textarea id="boardText" placeholder="В таблице: ячейки разделяются Tab, строки — переносом" style="min-height:90px"></textarea></label><div class="actions"><button id="applyBoardText">Применить текст</button><button id="applyBoardStyle">Применить оформление</button>${select('boardExportScope', 'Область экспорта', [['all','Вся доска'],['view','Видимая область']])}<button id="boardPNG">PNG</button><button id="boardSVG">SVG</button><button id="boardPDF">PDF</button></div><p class="muted">Автосохранение в этом браузере восстанавливает последний черновик. Файл .gmboard содержит редактируемые объекты и все изображения. Для переноса и надёжного хранения скачай доску. Экспорт ограничен 16 000 px по стороне и 30 млн пикселей.</p></section>`;
  let doc = newBoard(); let selected = new Set(); let tool = 'select'; let interaction; let space = false; let dirty = false;
  const undo = []; const redo = []; const imageCache = new Map(); let db; let writeTimer; let generation = 0; let fileHandle;
  const element = $('boardCanvas'); const ctx = element.getContext('2d'); const stage = $('boardStage');
  function setSaveState(message) { $('boardSaveState').textContent = message; }
  async function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('gm-tools-board', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('documents'); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
  }
  function storeDraft() {
    if (!db) { return; }
    try {
      const transaction = db.transaction('documents', 'readwrite'); transaction.objectStore('documents').put(doc, 'draft');
      transaction.oncomplete = () => { setSaveState(`${dirty ? 'Есть изменения после скачивания. ' : ''}Черновик сохранён в этом браузере.`); };
      transaction.onerror = () => { setSaveState('Автосохранение не удалось. Скачай файл доски.'); };
    } catch (error) { setSaveState('Автосохранение недоступно. Скачай файл доски.'); }
  }
  function backup() {
    if (db && doc.objects.length) {
      try { db.transaction('documents', 'readwrite').objectStore('documents').put(doc, 'backup'); $('restoreBoardBackup').hidden = false; }
      catch (error) { status('Резервная копия в браузере не сохранена. Скачай доску.', true); }
    }
  }
  action('restoreBoardBackup', async () => {
    if (!db) { throw new Error('Локальное хранилище недоступно.'); }
    const saved = await new Promise((resolve, reject) => { const request = db.transaction('documents').objectStore('documents').get('backup'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    if (!saved) { throw new Error('Предыдущая доска не найдена.'); }
    const previous = validateBoard(saved); backup(); doc = previous; await cacheImages(); selected.clear(); undo.length = 0; redo.length = 0; fileHandle = null; $('boardBackground').value = doc.background; changed();
  });
  function changed() {
    dirty = true; generation += 1; clearTimeout(writeTimer); writeTimer = setTimeout(storeDraft, 350);
    setSaveState('Изменения ещё не скачаны. Автосохранение…'); render();
  }
  function remember() { undo.push(JSON.stringify({objects: doc.objects, background: doc.background})); if (undo.length > 60) { undo.shift(); } redo.length = 0; }
  function history(from, to) {
    if (!from.length) { return; }
    to.push(JSON.stringify({objects: doc.objects, background: doc.background})); const state = JSON.parse(from.pop()); doc.objects = state.objects; doc.background = state.background; $('boardBackground').value = doc.background; selected.clear(); changed();
  }
  function make(type, point) { return {id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, type, x: point.x, y: point.y, w: 0, h: 0, color: $('boardColor').value, fill: $('noFill').checked ? 'none' : $('boardFill').value, width: Math.max(1, Math.min(80, number('boardWidth', 3))), size: Math.max(8, Math.min(300, number('boardSize', 24))), text: ''}; }
  function selectedObjects() { return doc.objects.filter(object => selected.has(object.id)); }
  function union(objects) { const box = boardBounds(objects); return {x: box.x + 30, y: box.y + 30, w: box.w - 60, h: box.h - 60}; }
  function world(event) { const rect = element.getBoundingClientRect(); return {x: (event.clientX - rect.left - doc.view.x) / doc.view.zoom, y: (event.clientY - rect.top - doc.view.y) / doc.view.zoom}; }
  function fit() { const box = boardBounds(doc.objects); doc.view.zoom = Math.max(.05, Math.min(3, Math.min(stage.clientWidth / box.w, stage.clientHeight / box.h) * .92)); doc.view.x = stage.clientWidth / 2 - (box.x + box.w / 2) * doc.view.zoom; doc.view.y = stage.clientHeight / 2 - (box.y + box.h / 2) * doc.view.zoom; render(); storeDraft(); }
  function zoom(factor, x = stage.clientWidth / 2, y = stage.clientHeight / 2) {
    const old = doc.view.zoom; doc.view.zoom = Math.max(.05, Math.min(8, old * factor)); doc.view.x = x - (x - doc.view.x) * doc.view.zoom / old; doc.view.y = y - (y - doc.view.y) * doc.view.zoom / old; render(); storeDraft();
  }
  function drawObject(target, object) {
    target.save(); target.strokeStyle = object.color; target.fillStyle = object.fill; target.lineWidth = object.width; target.lineCap = 'round'; target.lineJoin = 'round';
    if (object.type === 'pen' || object.type === 'highlight') {
      target.strokeStyle = object.color; target.globalAlpha = object.type === 'highlight' ? .3 : 1; target.lineWidth = object.type === 'highlight' ? object.width * 6 : object.width;
      target.beginPath(); object.points?.forEach(([x, y], i) => { if (i === 0) { target.moveTo(x, y); } else { target.lineTo(x, y); } });
      if (object.points?.length === 1) { target.lineTo(object.points[0][0] + .01, object.points[0][1]); } target.stroke();
    } else if (object.type === 'rect' || object.type === 'ellipse') {
      const box = bounds(object); target.beginPath();
      if (object.type === 'ellipse') { target.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, box.h / 2, 0, 0, 2 * Math.PI); } else { target.rect(box.x, box.y, box.w, box.h); }
      if (object.fill !== 'none') { target.fill(); } target.stroke();
    } else if (object.type === 'arrow') {
      const points=arrowPoints(object);const [endX,endY]=points.at(-1);const previous=points.at(-2);const angle=Math.atan2(endY-previous[1],endX-previous[0]);const length=Math.max(12,object.width*4);
      target.beginPath();points.forEach(([x,y],i)=>{if(i===0){target.moveTo(x,y);}else{target.lineTo(x,y);}});target.moveTo(endX-length*Math.cos(angle-.45),endY-length*Math.sin(angle-.45));target.lineTo(endX,endY);target.lineTo(endX-length*Math.cos(angle+.45),endY-length*Math.sin(angle+.45));target.stroke();
    } else if (object.type === 'text') {
      target.fillStyle = object.color; target.font = `${object.size}px sans-serif`; target.textBaseline = 'top';
      object.text.split('\n').forEach((line, i) => { target.fillText(line, object.x, object.y + i * object.size * 1.3); });
    } else if (object.type === 'table') {
      const rows = object.text.split('\n').map(line => line.split('\t')); const columns = Math.max(1, ...rows.map(row => row.length));
      const box = bounds(object); const cellW = box.w / columns; const cellH = box.h / rows.length;
      if (object.fill !== 'none') { target.fillRect(box.x, box.y, box.w, box.h); }
      target.font = `${object.size}px sans-serif`; target.textBaseline = 'middle'; target.fillStyle = object.color;
      rows.forEach((row, r) => { for (let c = 0; c < columns; c += 1) { target.strokeRect(box.x + c * cellW, box.y + r * cellH, cellW, cellH); target.save(); target.beginPath(); target.rect(box.x + c * cellW + 5, box.y + r * cellH, Math.max(1, cellW - 10), cellH); target.clip(); target.fillText(row[c] || '', box.x + c * cellW + 8, box.y + (r + .5) * cellH); target.restore(); } });
    } else if (object.type === 'image') {
      const image = imageCache.get(object.asset); if (image?.complete) { const box = bounds(object); target.drawImage(image, box.x, box.y, box.w, box.h); }
    }
    if(['rect','ellipse','arrow'].includes(object.type) && object.text) {
      target.font=`${object.size}px sans-serif`;target.textAlign='center';target.textBaseline='middle';const box=bounds(object);const lines=object.text.split('\n');
      lines.forEach((line,i)=>{const y=box.y+box.h/2+(i-(lines.length-1)/2)*object.size*1.3;if(object.type==='arrow'){const w=target.measureText(line).width;target.fillStyle=doc.background;target.fillRect(box.x+box.w/2-w/2-5,y-object.size*.65,w+10,object.size*1.3);}target.fillStyle=object.color;target.fillText(line,box.x+box.w/2,y);});
    }
    target.restore();
  }
  function render() {
    resolveBindings(doc.objects);
    const ratio = window.devicePixelRatio || 1; const width = stage.clientWidth; const height = stage.clientHeight;
    if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) { element.width = Math.round(width * ratio); element.height = Math.round(height * ratio); }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.fillStyle = doc.background; ctx.fillRect(0, 0, width, height);
    ctx.translate(doc.view.x, doc.view.y); ctx.scale(doc.view.zoom, doc.view.zoom);
    if ($('boardGrid').checked) {
      const step = 25 * (doc.view.zoom < .3 ? 4 : 1); ctx.fillStyle = '#dce0eb';
      const left = -doc.view.x / doc.view.zoom; const top = -doc.view.y / doc.view.zoom;
      for (let x = Math.floor(left / step) * step; x < left + width / doc.view.zoom; x += step) { for (let y = Math.floor(top / step) * step; y < top + height / doc.view.zoom; y += step) { ctx.fillRect(x, y, 1 / doc.view.zoom, 1 / doc.view.zoom); } }
    }
    doc.objects.forEach(object => { drawObject(ctx, object); });
    const objects = selectedObjects();
    if (objects.length) {
      const box = union(objects); ctx.strokeStyle = '#536bd1'; ctx.lineWidth = 1.5 / doc.view.zoom; ctx.setLineDash([5 / doc.view.zoom, 4 / doc.view.zoom]); ctx.strokeRect(box.x - 4, box.y - 4, box.w + 8, box.h + 8); ctx.setLineDash([]); ctx.fillStyle = '#536bd1'; const size = 9 / doc.view.zoom; ctx.fillRect(box.x + box.w - size / 2, box.y + box.h - size / 2, size, size);
    }
    if (interaction?.kind === 'marquee') { ctx.strokeStyle = '#536bd1'; ctx.lineWidth = 1 / doc.view.zoom; ctx.strokeRect(interaction.start.x, interaction.start.y, interaction.now.x - interaction.start.x, interaction.now.y - interaction.start.y); }
    $('boardSelection').textContent = `Объектов: ${doc.objects.length}; выделено: ${selected.size}`;
    $('zoomLevel').textContent = `${Math.round(doc.view.zoom * 100)}%`; $('boardUndo').disabled = !undo.length; $('boardRedo').disabled = !redo.length;
  }
  function choose(point, additive) {
    const tolerance = 7 / doc.view.zoom;
    const object = [...doc.objects].reverse().find(item => { const box = bounds(item); return point.x >= box.x - tolerance && point.x <= box.x + box.w + tolerance && point.y >= box.y - tolerance && point.y <= box.y + box.h + tolerance; });
    if (!additive && (!object || !selected.has(object.id))) { selected.clear(); }
    if (object) {
      const members = doc.objects.filter(item => item.id === object.id || object.group && item.group === object.group);
      if (additive && selected.has(object.id)) { members.forEach(item => { selected.delete(item.id); }); } else { members.forEach(item => { selected.add(item.id); }); }
      $('boardText').value = object.text; if(object.type==='arrow'){$('arrowStyle').value=object.arrowStyle||'straight';$('bendOffset').value=object.bendOffset||0;} $('boardColor').value = object.color; $('boardFill').value = object.fill === 'none' ? '#eef0f7' : object.fill; $('noFill').checked = object.fill === 'none'; $('boardWidth').value = object.width; $('boardSize').value = object.size;
    }
    return object;
  }
  let inlineEditor;
  function finishEditor() { if(inlineEditor) { inlineEditor.remove(); inlineEditor=null; render(); } }
  function editObject(object) {
    if(!['text','table','rect','ellipse','arrow'].includes(object.type)) { return; }
    finishEditor();const box=bounds(object);const input=document.createElement('textarea');input.className='board-inline';input.value=object.text;
    input.style.left=`${box.x*doc.view.zoom+doc.view.x}px`;input.style.top=`${box.y*doc.view.zoom+doc.view.y}px`;input.style.width=`${Math.max(180,box.w*doc.view.zoom+24)}px`;input.style.height=`${Math.max(90,box.h*doc.view.zoom+24)}px`;input.style.fontSize=`${Math.max(12,Math.min(100,object.size*doc.view.zoom))}px`;stage.append(input);inlineEditor=input;let recorded=false;
    input.oninput=()=>{if(!recorded){remember();recorded=true;}object.text=input.value.slice(0,100000);$('boardText').value=object.text;if(object.type==='text'){ctx.font=`${object.size}px sans-serif`;object.w=Math.max(40,...object.text.split('\n').map(line=>ctx.measureText(line).width));object.h=object.text.split('\n').length*object.size*1.3;}changed();};
    input.onkeydown=event=>{event.stopPropagation();if(event.key==='Escape'||(event.key==='Enter'&&(event.ctrlKey||event.metaKey))){event.preventDefault();finishEditor();element.focus();}if(event.key==='Tab'){event.preventDefault();input.setRangeText('\t',input.selectionStart,input.selectionEnd,'end');input.dispatchEvent(new Event('input'));}};input.onblur=finishEditor;input.focus();input.select();
  }
  function targetBinding(point) {
    const tolerance=15/doc.view.zoom;const object=[...doc.objects].reverse().find(item=>{if(['arrow','pen','highlight'].includes(item.type)){return false;}const box=bounds(item);return point.x>=box.x-tolerance&&point.x<=box.x+box.w+tolerance&&point.y>=box.y-tolerance&&point.y<=box.y+box.h+tolerance;});
    return object?attachment(object,point):null;
  }
  function useTool(next) {const button=root.querySelector(`[data-board-tool="${next}"]`);if(button){button.click();}}
  function erase(point) {const hit=[...doc.objects].reverse().find(item=>{const box=bounds(item);return point.x>=box.x-5&&point.x<=box.x+box.w+5&&point.y>=box.y-5&&point.y<=box.y+box.h+5;});if(hit){doc.objects=doc.objects.filter(item=>item!==hit);selected.delete(hit.id);changed();}}
  element.onpointerdown = event => {
    if (event.button !== 0 && event.button !== 1) { return; }
    finishEditor(); event.preventDefault(); element.focus(); element.setPointerCapture(event.pointerId); const point = world(event);
    if (space || tool === 'hand' || event.button === 1) { interaction = {kind: 'pan', clientX: event.clientX, clientY: event.clientY, x: doc.view.x, y: doc.view.y}; return; }
    if(tool==='eraser'){remember();interaction={kind:'erase'};erase(point);return;}
    if (tool === 'select') {
      const objects = selectedObjects(); const box = objects.length ? union(objects) : null;
      if (box && Math.hypot(point.x - box.x - box.w, point.y - box.y - box.h) < 13 / doc.view.zoom) {
        interaction = {kind: 'scale', start: point, box, originals: JSON.parse(JSON.stringify(objects))}; return;
      }
      const hit = choose(point, event.shiftKey);
      if (hit && event.altKey && selected.has(hit.id)) { $('boardDuplicate').click(); }
      if (hit && selected.has(hit.id) || hit && event.altKey) { interaction = {kind: 'move', start: point, originals: JSON.parse(JSON.stringify(selectedObjects()))}; }
      else if (!hit) { interaction = {kind: 'marquee', start: point, now: point, previous: event.shiftKey ? new Set(selected) : new Set()}; }
      render(); return;
    }
    remember(); const object = make(tool, point);
    if(tool==='arrow'){object.arrowStyle=$('arrowStyle').value;object.bendOffset=number('bendOffset');object.startBinding=targetBinding(point);if(object.startBinding){const anchor=bindingPoint(object.startBinding,doc.objects);object.x=anchor.x;object.y=anchor.y;}}
    if (tool === 'text') {
      object.text = $('boardText').value || 'Новый текст'; ctx.font = `${object.size}px sans-serif`; object.w = Math.max(40, ...object.text.split('\n').map(line => ctx.measureText(line).width)); object.h = object.size * 1.3 * object.text.split('\n').length;
    } else if (tool === 'table') { object.text = $('boardText').value || 'Ячейка 1\tЯчейка 2\nЯчейка 3\tЯчейка 4'; object.w = 360; object.h = 160; }
    else if (tool === 'pen' || tool === 'highlight') { object.points = [[point.x, point.y]]; }
    doc.objects.push(object); selected = new Set([object.id]);
    if (!['text','table'].includes(tool)) { interaction = {kind: 'draw', start: point, object}; }
    else { $('boardText').value = object.text; }
    changed();
    if(['text','table'].includes(tool)){editObject(object);if(!$('keepTool').checked){useTool('select');}}
  };
  element.onpointermove = event => {
    if (!interaction) { return; } const point = world(event);
    if(interaction.kind==='erase'){erase(point);return;}
    if (interaction.kind === 'pan') { doc.view.x = interaction.x + event.clientX - interaction.clientX; doc.view.y = interaction.y + event.clientY - interaction.clientY; render(); return; }
    if (['move','scale'].includes(interaction.kind) && !interaction.remembered) { remember(); interaction.remembered = true; }
    if (interaction.kind === 'draw') {
      const object = interaction.object; object.w = point.x - object.x; object.h = point.y - object.y;
      if(object.type==='arrow'){object.endBinding=targetBinding(point);}
      if(event.shiftKey && ['rect','ellipse'].includes(object.type)){const side=Math.max(Math.abs(object.w),Math.abs(object.h));object.w=Math.sign(object.w||1)*side;object.h=Math.sign(object.h||1)*side;}
      if (object.points && object.points.length < 50000) { object.points.push([point.x, point.y]); }
    } else if (interaction.kind === 'move') {
      for (const original of interaction.originals) { const target = doc.objects.find(item => item.id === original.id); Object.assign(target, JSON.parse(JSON.stringify(original))); if(target.type==='arrow'){if(!selected.has(target.startBinding?.id)){delete target.startBinding;}if(!selected.has(target.endBinding?.id)){delete target.endBinding;}} moveObject(target, point.x - interaction.start.x, point.y - interaction.start.y); }
    } else if (interaction.kind === 'scale') {
      const {box} = interaction; const fx = Math.max(.05, (point.x - box.x) / Math.max(1, box.w)); const fy = Math.max(.05, (point.y - box.y) / Math.max(1, box.h));
      for (const original of interaction.originals) { const target = doc.objects.find(item => item.id === original.id); Object.assign(target, JSON.parse(JSON.stringify(original))); scaleObject(target, box, fx, fy); }
    } else if (interaction.kind === 'marquee') {
      interaction.now = point; const left = Math.min(point.x, interaction.start.x); const top = Math.min(point.y, interaction.start.y); const right = Math.max(point.x, interaction.start.x); const bottom = Math.max(point.y, interaction.start.y);
      selected = new Set(interaction.previous);
      for (const object of doc.objects) { const box = bounds(object); if (box.x >= left && box.y >= top && box.x + box.w <= right && box.y + box.h <= bottom) { selected.add(object.id); } }
      render(); return;
    }
    changed();
  };
  function release() { if(interaction?.kind==='draw' && !['pen','highlight'].includes(tool) && !$('keepTool').checked){useTool('select');} if (interaction?.kind === 'pan') { storeDraft(); } interaction = null; render(); }
  element.onpointerup = release; element.onpointercancel = release;
  element.onwheel = event => {event.preventDefault();if(event.ctrlKey||event.metaKey){const rect=element.getBoundingClientRect();zoom(Math.exp(-event.deltaY*.003),event.clientX-rect.left,event.clientY-rect.top);}else{doc.view.x-=event.shiftKey?event.deltaY:event.deltaX;doc.view.y-=event.shiftKey?0:event.deltaY;render();storeDraft();}};
  element.ondblclick=event=>{const object=choose(world(event),false);if(object){editObject(object);}render();};
  root.querySelectorAll('[data-board-tool]').forEach(button => {
    button.onclick = () => { tool = button.dataset.boardTool; root.querySelectorAll('[data-board-tool]').forEach(item => { item.setAttribute('aria-pressed', String(item === button)); }); element.style.cursor = tool === 'hand' ? 'grab' : tool === 'select' ? 'default' : 'crosshair'; };
  });
  $('boardUndo').onclick = () => history(undo, redo); $('boardRedo').onclick = () => history(redo, undo);
  function remove() { if (!selected.size) { return; } remember(); doc.objects = doc.objects.filter(object => !selected.has(object.id)); selected.clear(); changed(); }
  $('boardDelete').onclick = remove;
  $('boardDuplicate').onclick=()=>{const objects=selectedObjects();if(!objects.length){return;}remember();selected.clear();const groups=new Map();const ids=new Map(objects.map(object=>[object.id,make('rect',{x:0,y:0}).id]));for(const original of objects){const object=JSON.parse(JSON.stringify(original));object.id=ids.get(original.id);if(object.group){if(!groups.has(object.group)){groups.set(object.group,object.id);}object.group=groups.get(object.group);}for(const key of ['startBinding','endBinding']){if(object[key]){if(ids.has(object[key].id)){object[key].id=ids.get(object[key].id);}else{delete object[key];}}}moveObject(object,25,25);doc.objects.push(object);selected.add(object.id);}changed();};
  for (const [id, front] of [['boardFront', true], ['boardBack', false]]) { $(id).onclick = () => { if (!selected.size) { return; } remember(); const chosen = selectedObjects(); const rest = doc.objects.filter(item => !selected.has(item.id)); doc.objects = front ? [...rest, ...chosen] : [...chosen, ...rest]; changed(); }; }
  $('boardGroup').onclick = () => { if (selected.size < 2) { return; } remember(); const group = `group-${Date.now()}`; selectedObjects().forEach(object => { object.group = group; }); changed(); };
  $('boardUngroup').onclick = () => { remember(); selectedObjects().forEach(object => { delete object.group; }); changed(); };
  $('applyBoardText').onclick = () => {
    const objects = selectedObjects().filter(item => ['text','table','rect','ellipse','arrow'].includes(item.type)); if (!objects.length) { status('Выдели текст или таблицу.', true); return; }
    if ($('boardText').value.length > 100000) { status('Текст объекта — до 100 000 символов.', true); return; }
    remember(); for (const object of objects) { object.text = $('boardText').value; if (object.type === 'text') { ctx.font = `${object.size}px sans-serif`; object.w = Math.max(40, ...object.text.split('\n').map(line => ctx.measureText(line).width)); object.h = object.text.split('\n').length * object.size * 1.3; } } changed();
  };
  $('boardText').onkeydown = event => { if (event.key === 'Tab') { event.preventDefault(); const target = event.target; target.setRangeText('\t', target.selectionStart, target.selectionEnd, 'end'); } };
  $('applyBoardStyle').onclick = () => { if (!selected.size) { return; } remember(); const style = make('rect', {x: 0, y: 0}); for (const object of selectedObjects()) { for (const key of ['color','fill','width','size']) { object[key] = style[key]; } if(object.type==='arrow'){object.arrowStyle=$('arrowStyle').value;object.bendOffset=number('bendOffset');} } changed(); };
  $('boardBackground').onchange = () => { remember(); doc.background = $('boardBackground').value; changed(); };
  $('boardGrid').onchange = render; $('zoomIn').onclick = () => zoom(1.25); $('zoomOut').onclick = () => zoom(.8); $('fitBoard').onclick = fit;
  $('resetBoardView').onclick = () => { doc.view = {x: 0, y: 0, zoom: 1}; render(); storeDraft(); };
  async function cacheImages() {
    imageCache.clear(); await Promise.all(Object.entries(doc.assets).map(([key, data]) => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => { imageCache.set(key, image); resolve(); }; image.onerror = () => reject(new Error('Повреждённое изображение в доске.')); image.src = data; })));
  }
  async function addImages(files, position = {x: (stage.clientWidth / 2 - doc.view.x) / doc.view.zoom, y: (stage.clientHeight / 2 - doc.view.y) / doc.view.zoom}) {
    const chosen = [...files].filter(file => /^image\/(png|jpeg|webp)$/.test(file.type)); if (!chosen.length) { return; }
    remember(); selected.clear();
    for (const [index, file] of chosen.entries()) {
      if (file.size > 15e6) { status(`${file.name}: максимум 15 МБ на изображение.`, true); continue; }
      const image = await readImage(file); const output = canvas(Math.min(image.width, 3000), Math.max(1, Math.round(image.height * Math.min(1, 3000 / image.width)))); output.getContext('2d').drawImage(image, 0, 0, output.width, output.height); image.close();
      const object = make('image', {x: position.x + index * 25, y: position.y + index * 25}); const scale = Math.min(1, 500 / output.width, 500 / output.height); object.w = output.width * scale; object.h = output.height * scale; object.asset = `image-${object.id}`; doc.assets[object.asset] = output.toDataURL('image/png'); doc.objects.push(object); selected.add(object.id);
    }
    await cacheImages(); changed();
  }
  $('boardImage').onchange = () => { addImages($('boardImage').files).catch(error => status(error.message, true)); };
  element.ondragover = event => { event.preventDefault(); };
  element.ondrop = event => { event.preventDefault(); addImages(event.dataTransfer.files, world(event)).catch(error => status(error.message, true)); };
  function paste(event) {
    if(event.target.matches('input,textarea')){return;}const files=[...event.clipboardData.items].filter(item=>item.kind==='file').map(item=>item.getAsFile());
    if(files.length){event.preventDefault();addImages(files).catch(error=>status(error.message,true));return;}
    const text=event.clipboardData.getData('text/plain');if(!text){return;}
    try {
      let data;try{data=JSON.parse(text);}catch(error){}
      if(data?.format==='gm-board-selection'){
        const incoming=validateBoard({...newBoard(),objects:data.objects,assets:data.assets||{}});remember();const ids=new Map(incoming.objects.map(object=>[object.id,make('rect',{x:0,y:0}).id]));const groups=new Map();selected.clear();
        for(const object of incoming.objects){const old=object.id;object.id=ids.get(old);if(object.group){if(!groups.has(object.group)){groups.set(object.group,`group-${object.id}`);}object.group=groups.get(object.group);}for(const key of ['startBinding','endBinding']){if(object[key]){if(ids.has(object[key].id)){object[key].id=ids.get(object[key].id);}else{delete object[key];}}}moveObject(object,25,25);if(object.type==='image'){const asset=`image-${object.id}`;doc.assets[asset]=incoming.assets[object.asset];object.asset=asset;}doc.objects.push(object);selected.add(object.id);}
        cacheImages().then(changed).catch(error=>status(error.message,true));
      }else{remember();const object=make('text',{x:(stage.clientWidth/2-doc.view.x)/doc.view.zoom,y:(stage.clientHeight/2-doc.view.y)/doc.view.zoom});object.text=text.slice(0,100000);object.w=400;object.h=object.text.split('\n').length*object.size*1.3;doc.objects.push(object);selected=new Set([object.id]);changed();}
      event.preventDefault();
    }catch(error){status(error.message,true);}
  }
  document.addEventListener('paste', paste);
  function packed() { const used = new Set(doc.objects.filter(object => object.type === 'image').map(object => object.asset)); return {...doc, assets: Object.fromEntries(Object.entries(doc.assets).filter(([key]) => used.has(key)))}; }
  function blob() { return new Blob([JSON.stringify(packed())], {type: 'application/json'}); }
  action('downloadBoard', () => { download(blob(), `board-${new Date().toISOString().replace(/[:.]/g, '-')}.gmboard`); dirty = false; storeDraft(); setSaveState('Файл подготовлен к скачиванию. Черновик также хранится в браузере.'); });
  $('saveBoardFile').hidden = !('showSaveFilePicker' in window);
  action('saveBoardFile', async () => {
    if (!fileHandle) { fileHandle = await window.showSaveFilePicker({suggestedName: 'board.gmboard', types: [{description: 'GrayMansion Board', accept: {'application/json': ['.gmboard']}}]}); }
    const writable = await fileHandle.createWritable(); await writable.write(blob()); await writable.close(); dirty = false; storeDraft(); setSaveState('Файл доски сохранён на устройство.');
  });
  $('openBoard').onchange = async () => {
    try {
      const file = $('openBoard').files[0]; if (!file) { return; }
      if (file.size > 80e6) { throw new Error('Файл доски — до 80 МБ.'); }
      const next = validateBoard(JSON.parse(await file.text()));
      if (doc.objects.length && dirty) { download(blob(), `board-before-open-${Date.now()}.gmboard`); }
      backup(); const old = doc; doc = next;
      try { await cacheImages(); } catch (error) { doc = old; await cacheImages(); throw error; }
      selected.clear(); undo.length = 0; redo.length = 0; fileHandle = null; dirty = false; $('boardBackground').value = doc.background; storeDraft(); render(); status(`Открыто объектов: ${doc.objects.length}.`);
    } catch (error) { status(error.message, true); }
  };
  $('newBoard').onclick = () => {
    if (doc.objects.length) { download(blob(), `board-before-new-${Date.now()}.gmboard`); }
    backup(); doc = newBoard(); fileHandle = null; selected.clear(); undo.length = 0; redo.length = 0; imageCache.clear(); dirty = false; $('boardBackground').value = doc.background; render(); storeDraft();
  };
  action('boardFullscreen', async () => { if (document.fullscreenElement) { await document.exitFullscreen(); } else { await root.requestFullscreen(); } });
  function exportBox() {
    resolveBindings(doc.objects);
    const box = $('boardExportScope').value === 'all' ? boardBounds(doc.objects) : {x: -doc.view.x / doc.view.zoom, y: -doc.view.y / doc.view.zoom, w: stage.clientWidth / doc.view.zoom, h: stage.clientHeight / doc.view.zoom};
    const scale = Math.min(1, 16000 / box.w, 16000 / box.h, Math.sqrt(30e6 / (box.w * box.h))); return {...box, scale, width: Math.max(1, Math.ceil(box.w * scale)), height: Math.max(1, Math.ceil(box.h * scale))};
  }
  function exportCanvas() { const box = exportBox(); const output = canvas(box.width, box.height); const target = output.getContext('2d'); target.fillStyle = doc.background; target.fillRect(0, 0, output.width, output.height); target.scale(box.scale, box.scale); target.translate(-box.x, -box.y); doc.objects.forEach(object => drawObject(target, object)); return output; }
  action('boardPNG', async () => { download(await toBlob(exportCanvas()), 'whiteboard.png'); });
  action('boardSVG', () => {
    const box = exportBox();
    const parts = doc.objects.map(object => {
      const b = bounds(object); const common = `stroke="${object.color}" stroke-width="${object.width}" fill="${object.fill}"`;
      if (object.type === 'image') { return `<image x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" href="${doc.assets[object.asset]}"/>`; }
      if (object.type === 'rect') { return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" ${common}/>`; }
      if (object.type === 'ellipse') { return `<ellipse cx="${b.x + b.w / 2}" cy="${b.y + b.h / 2}" rx="${b.w / 2}" ry="${b.h / 2}" ${common}/>`; }
      if (object.type === 'pen' || object.type === 'highlight') { return `<polyline points="${object.points.map(point => point.join(',')).join(' ')}" fill="none" stroke="${object.color}" stroke-width="${object.width * (object.type === 'highlight' ? 6 : 1)}" opacity="${object.type === 'highlight' ? .3 : 1}" stroke-linecap="round" stroke-linejoin="round"/>`; }
      if(object.type==='arrow'){const points=arrowPoints(object);const [x,y]=points.at(-1);const last=points.at(-2);const a=Math.atan2(y-last[1],x-last[0]);const l=Math.max(12,object.width*4);return `<path d="${points.map(([px,py],i)=>`${i?'L':'M'}${px} ${py}`).join('')}M${x-l*Math.cos(a-.45)} ${y-l*Math.sin(a-.45)}L${x} ${y}L${x-l*Math.cos(a+.45)} ${y-l*Math.sin(a+.45)}" fill="none" stroke="${object.color}" stroke-width="${object.width}"/>`;}
      if (object.type === 'text') { return object.text.split('\n').map((line, i) => `<text x="${object.x}" y="${object.y + object.size + i * object.size * 1.3}" fill="${object.color}" font-family="sans-serif" font-size="${object.size}">${esc(line)}</text>`).join(''); }
      if (object.type === 'table') {
        const rows = object.text.split('\n').map(line => line.split('\t')); const cols = Math.max(1, ...rows.map(row => row.length));
        return rows.map((row, r) => Array.from({length: cols}, (_, c) => `<svg x="${b.x + c * b.w / cols}" y="${b.y + r * b.h / rows.length}" width="${b.w / cols}" height="${b.h / rows.length}" overflow="hidden"><rect width="100%" height="100%" ${common}/><text x="8" y="50%" dominant-baseline="middle" fill="${object.color}" font-family="sans-serif" font-size="${object.size}">${esc(row[c] || '')}</text></svg>`).join('')).join('');
      }
      return '';
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${doc.background}"/>${parts.join('')}${doc.objects.filter(object=>['rect','ellipse','arrow'].includes(object.type)&&object.text).map(object=>{const box=bounds(object);return object.text.split('\n').map((line,i)=>`<text x="${box.x+box.w/2}" y="${box.y+box.h/2+(i-(object.text.split('\n').length-1)/2)*object.size*1.3}" text-anchor="middle" dominant-baseline="middle" fill="${object.color}" font-family="sans-serif" font-size="${object.size}">${esc(line)}</text>`).join('');}).join('')}</svg>`;
    download(new Blob([svg], {type: 'image/svg+xml'}), 'whiteboard.svg');
  });
  action('boardPDF', async () => { const {PDFDocument} = await import('../vendor/vendor.js'); const output = exportCanvas(); const pdf = await PDFDocument.create(); const image = await pdf.embedPng(await (await toBlob(output)).arrayBuffer()); const scale = Math.min(1, 14400 / output.width, 14400 / output.height); const page = pdf.addPage([output.width * scale, output.height * scale]); page.drawImage(image, {x: 0, y: 0, width: page.getWidth(), height: page.getHeight()}); download(new Blob([await pdf.save()], {type: 'application/pdf'}), 'whiteboard.pdf'); });
  function keydown(event) {
    const ctrl=event.ctrlKey||event.metaKey;const key=event.code;
    if(ctrl&&key==='KeyS'){event.preventDefault();$('downloadBoard').click();return;}
    if(event.target.matches('input,textarea,select')||event.target.isContentEditable){return;}
    if(event.target.matches('button')&&!ctrl&&['Enter','Space','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key)){return;}
    if(key==='Space'){event.preventDefault();space=true;return;}
    if(ctrl&&key==='KeyZ'){event.preventDefault();finishEditor();history(event.shiftKey?redo:undo,event.shiftKey?undo:redo);return;}
    if(ctrl&&key==='KeyY'){event.preventDefault();history(redo,undo);return;}
    const shortcuts={KeyD:'boardDuplicate',KeyG:event.shiftKey?'boardUngroup':'boardGroup',KeyS:'downloadBoard'};
    if(ctrl&&shortcuts[key]){event.preventDefault();$(shortcuts[key]).click();return;}
    if(ctrl&&key==='KeyA'){event.preventDefault();selected=new Set(doc.objects.map(object=>object.id));render();return;}
    if(ctrl&&['Equal','NumpadAdd','Minus','NumpadSubtract'].includes(key)){event.preventDefault();zoom(['Equal','NumpadAdd'].includes(key)?1.2:1/1.2);return;}
    if(ctrl&&key==='Digit0'){event.preventDefault();$('resetBoardView').click();return;}
    if(event.shiftKey&&key==='Digit1'){event.preventDefault();fit();return;}
    if(event.shiftKey&&key==='Digit2'){event.preventDefault();const objects=selectedObjects();if(objects.length){const box=boardBounds(objects);doc.view.zoom=Math.max(.05,Math.min(8,Math.min(stage.clientWidth/box.w,stage.clientHeight/box.h)*.9));doc.view.x=stage.clientWidth/2-(box.x+box.w/2)*doc.view.zoom;doc.view.y=stage.clientHeight/2-(box.y+box.h/2)*doc.view.zoom;render();}return;}
    if(key==='Delete'||key==='Backspace'){event.preventDefault();remove();return;}
    if(key==='Escape'){finishEditor();selected.clear();useTool('select');render();return;}
    if(key==='Enter'&&selected.size===1){event.preventDefault();editObject(selectedObjects()[0]);return;}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key)&&selected.size){event.preventDefault();if(!event.repeat){remember();}const distance=event.shiftKey?10:1;selectedObjects().forEach(object=>{moveObject(object,key==='ArrowLeft'?-distance:key==='ArrowRight'?distance:0,key==='ArrowUp'?-distance:key==='ArrowDown'?distance:0);});changed();return;}
    if(key==='F1'||event.key==='?'){event.preventDefault();$('boardHelp').click();return;}
    if(ctrl||event.altKey){return;}
    if(key==='KeyQ'){$('keepTool').checked=!$('keepTool').checked;return;}
    const tools={KeyV:'select',KeyH:'hand',KeyR:'rect',KeyO:'ellipse',KeyA:'arrow',KeyL:'arrow',KeyP:'pen',KeyT:'text',KeyB:'highlight',KeyE:'eraser',Digit1:'select',Digit2:'rect',Digit4:'ellipse',Digit5:'arrow',Digit7:'pen',Digit8:'text'};
    if(tools[key]){event.preventDefault();useTool(tools[key]);}
  }
  function keyup(event) { if (event.code === 'Space') { space = false; } }
  function warning(event) { if (dirty) { event.preventDefault(); event.returnValue = ''; } }
  const dialog=document.createElement('dialog');dialog.className='board-help';dialog.innerHTML='<h2>Управление доской</h2><p>V / 1 — выделение; H — рука; R / 2 — прямоугольник; O / 4 — эллипс; A / L / 5 — стрелка; P / 7 — перо; T / 8 — текст; B — хайлайтер; E — ластик.</p><p>Space + перетаскивание или средняя кнопка — перемещение. Колесо — прокрутка доски; Ctrl/Cmd + колесо — перемещение; Ctrl/Cmd + колесо — масштаб. Shift + колесо — горизонтально.</p><p>Ctrl/Cmd+A — всё; C/X/V — копировать/вырезать/вставить; D — дублировать; G / Shift+G — группа / разгруппировка; Z / Shift+Z или Y — отмена / повтор; S — скачать доску.</p><p>Стрелки — сдвиг на 1 px, Shift — на 10 px. Shift+1 — вся доска, Shift+2 — выделение. Enter или двойной клик — текст на доске. Ctrl/Cmd+Enter или Esc — завершить редактирование. Q — закрепить инструмент. Shift при рисовании — квадрат / круг.</p><p>Стрелка привязывается к границе фигуры. В «Оформлении» выбираются изгибы и их сдвиг. F1 / ? — эта справка.</p><form method="dialog"><button>Закрыть</button></form>';root.append(dialog);$('boardHelp').onclick=()=>dialog.showModal();
  $('boardQuick').prepend($('boardUndo'),$('boardRedo'));
  function copyObjects(event){if(event.target.matches('input,textarea')||!selected.size){return;}const objects=selectedObjects();const assets=Object.fromEntries(objects.filter(object=>object.type==='image').map(object=>[object.asset,doc.assets[object.asset]]));event.clipboardData.setData('text/plain',JSON.stringify({format:'gm-board-selection',objects,assets}));event.preventDefault();if(event.type==='cut'){remove();}}
  document.addEventListener('copy',copyObjects);document.addEventListener('cut',copyObjects);
  document.addEventListener('keydown', keydown); document.addEventListener('keyup', keyup); window.addEventListener('beforeunload', warning);
  const observer = new ResizeObserver(render); observer.observe(stage);
  try {
    db = await openDB(); const saved = await new Promise((resolve, reject) => { const request = db.transaction('documents').objectStore('documents').get('draft'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const backupRequest = db.transaction('documents').objectStore('documents').get('backup'); backupRequest.onsuccess = () => { $('restoreBoardBackup').hidden = !backupRequest.result; };
    if (saved) { doc = validateBoard(saved); await cacheImages(); $('boardBackground').value = doc.background; dirty = true; setSaveState('Восстановлен локальный черновик. Скачай файл для надёжного хранения.'); }
  } catch (error) { setSaveState('Локальное восстановление недоступно. Сохраняй доску в файл.'); }
  render();
  teardown(() => { clearTimeout(writeTimer); storeDraft(); observer.disconnect(); document.removeEventListener('keydown', keydown); document.removeEventListener('keyup', keyup); document.removeEventListener('paste', paste); document.removeEventListener('copy',copyObjects); document.removeEventListener('cut',copyObjects); window.removeEventListener('beforeunload', warning); });
}
