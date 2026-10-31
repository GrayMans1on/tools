import {workdaysBetween, constrainedGroups} from '../release-core.js?v=20261031-v06';
import { $, esc, field, select, action, status, number, copy, persist, restore, teardown, download } from '../ui.js';
import { randomInt, shuffle } from '../logic.js';

export function clocks(root) {
  const defaults = ['Europe/Moscow', 'Asia/Yekaterinburg', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai', 'Asia/Kolkata', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Sao_Paulo', 'Australia/Sydney', 'Pacific/Auckland', 'UTC'];
  let zones = restore('clocks', defaults);
  root.innerHTML = `<section class="panel"><div class="row"><label>Город или часовой пояс<input id="zone" list="zones" placeholder="Asia/Yekaterinburg"><datalist id="zones"></datalist></label>${select('format', 'Формат', [['24', '24 часа'], ['12', '12 часов']])}<button id="add" class="primary">Добавить</button><button id="reset">Вернуть набор</button></div><p class="muted">Названия часовых поясов доступны в поиске; UTC — всемирное время.</p></section><section class="panel"><h2>Время во всех городах</h2>${field('previewDate', 'Опорная дата и время браузера', 'datetime-local')}<label>Сдвиг относительно опорного времени: <output id="clockOffset">0 ч</output><input id="clockSlider" type="range" min="-1440" max="1440" step="15" value="0"></label><button id="liveClocks">Текущее время</button><p class="muted">Передвигай ползунок: все города меняются одновременно, включая дату и сезонное смещение.</p></section><div id="clocks" class="grid"></div>`;
  let previewBase = null;
  const nowLocal = new Date(); nowLocal.setMinutes(nowLocal.getMinutes() - nowLocal.getTimezoneOffset()); $('previewDate').value = nowLocal.toISOString().slice(0,16);
  $('clockSlider').oninput = () => { if (previewBase === null) { previewBase = new Date($('previewDate').value).getTime(); } $('clockOffset').textContent = `${number('clockSlider') / 60} ч`; render(); };
  $('previewDate').onchange = () => { previewBase = new Date($('previewDate').value).getTime(); if (!Number.isFinite(previewBase)) { previewBase = null; status('Проверь дату.', true); } render(); };
  $('liveClocks').onclick = () => { previewBase = null; $('clockSlider').value = 0; $('clockOffset').textContent = 'Текущее время'; render(); };
  const supported = ['UTC', ...(Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : defaults)];
  $('zones').replaceChildren(...supported.map(zone => new Option(zone.replaceAll('_', ' '), zone)));
  function render() {
    $('clocks').replaceChildren();
    const now = previewBase === null ? new Date() : new Date(previewBase + number('clockSlider') * 60000);
    for (const zone of zones) {
      try {
        const panel = document.createElement('section'); panel.className = 'tile';
        const title = document.createElement('strong'); title.textContent = zone.split('/').pop().replaceAll('_', ' ');
        const time = document.createElement('div'); time.className = 'clock';
        time.textContent = new Intl.DateTimeFormat('ru-RU', {timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: $('format').value === '12'}).format(now);
        const date = document.createElement('small');
        date.textContent = new Intl.DateTimeFormat('ru-RU', {timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', timeZoneName: 'shortOffset'}).format(now);
        const remove = document.createElement('button'); remove.textContent = 'Убрать'; remove.style.marginTop = '14px';
        remove.addEventListener('click', () => { zones = zones.filter(item => item !== zone); persist('clocks', zones); render(); });
        panel.append(title, time, date, document.createElement('br'), remove); $('clocks').append(panel);
      } catch (error) { status(`Недоступный часовой пояс: ${zone}`, true); }
    }
  }
  action('add', () => {
    const zone = $('zone').value.trim();
    new Intl.DateTimeFormat('ru-RU', {timeZone: zone}).format();
    if (!zones.includes(zone)) { zones.push(zone); persist('clocks', zones); }
    $('zone').value = ''; render();
  });
  action('reset', () => { zones = [...defaults]; persist('clocks', zones); render(); });
  $('format').addEventListener('change', render);
  const timer = setInterval(render, 1000); teardown(() => clearInterval(timer)); render();
}

function zonedDate(text, zone) {
  if (!text) { throw new Error('Укажи дату и время.'); }
  if (zone === 'local') { return new Date(text); }
  const target = new Date(`${text}Z`).getTime();
  let guess = target;
  const formatter = new Intl.DateTimeFormat('en-US', {timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'});
  for (let i = 0; i < 4; i += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(item => [item.type, item.value]));
    const shown = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess += target - shown;
  }
  if (!Number.isFinite(guess)) { throw new Error('Неверная дата.'); }
  return new Date(guess);
}
export function dates(root) {
  let events = restore('dates', []);
  root.innerHTML = `<section class="panel"><div class="row">${field('name', 'Название', 'text', 'Событие')}${field('date', 'Дата и время', 'datetime-local')}${select('zone', 'Часовой пояс', [['local', 'Местное время браузера'], ['UTC', 'UTC'], ['Asia/Yekaterinburg', 'Екатеринбург'], ['Europe/Moscow', 'Москва']])}${field('periodStart', 'Начало периода для прогресса (необязательно)', 'datetime-local')}</div><div class="actions"><button id="add" class="primary">Добавить отсчёт</button></div><label><input type="checkbox" id="showWorkdays" checked> Считать рабочие дни</label><div class="chips"><label class="chip"><input type="checkbox" data-weekday="0" > Вс</label><label class="chip"><input type="checkbox" data-weekday="1" checked> Пн</label><label class="chip"><input type="checkbox" data-weekday="2" checked> Вт</label><label class="chip"><input type="checkbox" data-weekday="3" checked> Ср</label><label class="chip"><input type="checkbox" data-weekday="4" checked> Чт</label><label class="chip"><input type="checkbox" data-weekday="5" checked> Пт</label><label class="chip"><input type="checkbox" data-weekday="6" > Сб</label></div><label>Исключить даты, по одной YYYY-MM-DD<textarea id="excludedDays" style="min-height:70px"></textarea></label><small>Расписание задаётся пользователем. Начальный день не включается, конечный включается.</small></section><div id="events" class="grid"></div>`;
  const future = new Date(Date.now() + 86400000); future.setMinutes(future.getMinutes() - future.getTimezoneOffset());
  $('date').value = future.toISOString().slice(0, 16);
  function render() {
    $('events').replaceChildren();
    if (!events.length) { $('events').textContent = 'Добавь дату — будущую или прошедшую.'; }
    for (const event of events) {
      const target = new Date(event.date);
      const delta = target.getTime() - Date.now();
      let seconds = Math.floor(Math.abs(delta) / 1000);
      const days = Math.floor(seconds / 86400); seconds %= 86400;
      const hours = Math.floor(seconds / 3600); seconds %= 3600;
      const minutes = Math.floor(seconds / 60); seconds %= 60;
      const panel = document.createElement('section'); panel.className = 'panel';
      const title = document.createElement('h2'); title.textContent = event.name;
      const label = document.createElement('p'); label.textContent = `${delta < 0 ? 'Прошло с' : 'Осталось до'} ${target.toLocaleString('ru-RU', {timeZone: event.zone === 'local' ? undefined : event.zone})} · ${event.zone === 'local' ? 'местное время' : event.zone}`;
      label.className = 'muted';
      const result = document.createElement('div'); result.className = 'result'; result.textContent = `${days} дн. ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      const remove = document.createElement('button'); remove.textContent = 'Удалить';
      remove.addEventListener('click', () => { events = events.filter(item => item.id !== event.id); persist('dates', events); render(); });
      panel.append(title, label, result);
      if (event.weekdays) {
        const ordinal = date => { const parts = new Intl.DateTimeFormat('en-CA', {timeZone: event.zone === 'local' ? undefined : event.zone, year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date); const map = Object.fromEntries(parts.map(item=>[item.type,item.value])); return Date.UTC(Number(map.year),Number(map.month)-1,Number(map.day))/86400000; };
        const work = document.createElement('p'); work.className = 'muted'; work.textContent = `Рабочих дней ${delta < 0 ? 'прошло' : 'осталось'}: ${Math.abs(workdaysBetween(ordinal(new Date()),ordinal(target),event.weekdays,event.excluded || []))}`; panel.append(work);
      }
      if (event.start) {
        const progress = Math.max(0,Math.min(1,(Date.now()-Date.parse(event.start))/(target.getTime()-Date.parse(event.start))));
        const track = document.createElement('div'); track.className='meter'; const fill=document.createElement('div'); fill.style.width=`${progress*100}%`; track.append(fill); const text=document.createElement('small'); text.textContent=`Период пройден на ${(progress*100).toFixed(1)}%`; panel.append(track,text,document.createElement('br'));
      }
      panel.append(remove); $('events').append(panel);
    }
  }
  action('add', () => {
    const date = zonedDate($('date').value, $('zone').value);
    if (!Number.isFinite(date.getTime())) { throw new Error('Неверная дата.'); }
    const start = $('periodStart').value ? zonedDate($('periodStart').value, $('zone').value).toISOString() : null;
    if (start && Date.parse(start) >= date.getTime()) { throw new Error('Начало периода должно быть раньше конечной даты.'); }
    const weekdays = [...root.querySelectorAll('[data-weekday]:checked')].map(input => Number(input.dataset.weekday));
    if ($('showWorkdays').checked && !weekdays.length) { throw new Error('Выбери рабочие дни недели.'); }
    const excluded = $('excludedDays').value.trim().split(/\s+/).filter(Boolean).map(text => { if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text+'T00:00:00Z')) || new Date(text+'T00:00:00Z').toISOString().slice(0,10)!==text) { throw new Error(`Проверь дату: ${text}`); } return Date.parse(text+'T00:00:00Z')/86400000; });
    events.push({start, weekdays: $('showWorkdays').checked ? weekdays : null, excluded, id: [...crypto.getRandomValues(new Uint32Array(4))].map(value => value.toString(16).padStart(8, '0')).join(''), name: $('name').value.trim() || 'Событие', date: date.toISOString(), zone: $('zone').value});
    persist('dates', events); render();
  });
  const timer = setInterval(render, 1000); teardown(() => clearInterval(timer)); render();
}

export function random(root) {
  const modes = [
    ['numbers', 'Числа от X до Y', 'Одно или несколько целых чисел'],
    ['list', 'Выбор из списка', 'Варианты, веса и выбор без повторений'],
    ['shuffle', 'Перемешать', 'Случайный порядок всех элементов'],
    ['groups', 'Разделить на группы', 'Случайное распределение участников'],
    ['dice', 'Кубики', 'Количество кубиков и граней'],
    ['coin', 'Монетка', 'Орёл или решка']
  ];
  root.innerHTML = `<div class="grid" id="modes"></div><section id="settings" class="panel" style="margin-top:18px" hidden><h2 id="modeTitle"></h2><div id="numberFields" class="row">${field('min', 'От', 'number', 1)}${field('max', 'До', 'number', 100)}</div><label id="listField">Варианты — каждый с новой строки<textarea id="list" placeholder="Вариант А\nВариант Б | 3\nВариант В"></textarea><small>Для весов: «Вариант | 3». Без веса вероятность одинакова.</small></label><div class="row">${field('count', 'Количество результатов / групп', 'number', 1, 'min="1" max="10000"')}<label id="uniqueField"><input id="unique" type="checkbox"> Без повторений</label></div><div id="constraints" hidden><div class="two"><label>Вместе: имя | имя<textarea id="together" placeholder="Анна | Борис"></textarea></label><label>Раздельно: имя | имя<textarea id="apart" placeholder="Анна | Вера"></textarea></label></div><small>До 200 уникальных имён. Группы равномерные; невозможные ограничения показываются ошибкой.</small></div><label id="bagField" hidden><input id="bag" type="checkbox"> Мешок: не повторять между запусками до исчерпания</label><button id="resetBag" hidden>Сбросить мешок</button><p id="bagInfo" class="muted"></p><div class="actions"><button id="run" class="primary">Сгенерировать</button><button id="copy">Копировать</button></div></section><section class="panel" style="margin-top:18px"><h2>Результат</h2><pre id="result" class="result"></pre><h3>Последние результаты</h3><pre id="history"></pre></section>`;
  let mode = ''; const history = []; let bagItems = []; let bagFingerprint = '';
  $('resetBag').onclick = () => { bagItems = []; bagFingerprint = ''; $('bagInfo').textContent = 'Мешок сброшен.'; };
  for (const [id, name, description] of modes) {
    const button = document.createElement('button'); button.className = 'tile';
    button.innerHTML = `<strong>${name}</strong><small>${description}</small>`;
    button.addEventListener('click', () => {
      mode = id; $('settings').hidden = false; $('modeTitle').textContent = name;
      $('numberFields').hidden = !['numbers', 'dice'].includes(id);
      $('listField').hidden = !['list', 'shuffle', 'groups'].includes(id);
      $('uniqueField').hidden = !['numbers', 'list'].includes(id); $('constraints').hidden = id !== 'groups'; $('bagField').hidden = id !== 'list'; $('resetBag').hidden = id !== 'list';
      if (id === 'dice') { $('min').value = 1; $('max').value = 6; }
      $('count').value = id === 'groups' ? 2 : 1;
    }); $('modes').append(button);
  }
  function chooseWeighted(items) {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    if (!Number.isFinite(total) || total <= 0) { throw new Error('Неверные веса.'); }
    const array = new Uint32Array(1); crypto.getRandomValues(array);
    let point = array[0] / 4294967296 * total;
    for (let i = 0; i < items.length; i += 1) {
      point -= items[i].weight;
      if (point < 0) { return i; }
    }
    return items.length - 1;
  }
  action('run', () => {
    if (!mode) { throw new Error('Выбери режим.'); }
    const count = Math.floor(number('count', 1));
    if (count < 1 || count > 10000) { throw new Error('Количество — от 1 до 10000.'); }
    let results = [];
    if (mode === 'numbers' || mode === 'dice') {
      const min = mode === 'dice' ? 1 : number('min'); const max = number('max');
      randomInt(min, max);
      if (mode === 'numbers' && $('unique').checked) {
        const range = max - min + 1;
        if (count > range) { throw new Error('Результатов больше, чем чисел в диапазоне.'); }
        const selected = new Set();
        for (let j = range - count; j < range; j += 1) {
          const t = randomInt(0, j); selected.add(selected.has(t) ? j : t);
        }
        results = shuffle([...selected]).map(n => n + min);
      } else { results = Array.from({length: count}, () => randomInt(min, max)); }
    } else if (mode === 'coin') { results = Array.from({length: count}, () => randomInt(0, 1) ? 'Орёл' : 'Решка'); }
    else {
      let items = $('list').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
        const match = /^(.*?)\s*\|\s*([\d.]+)$/.exec(line);
        return {name: match ? match[1] : line, weight: match ? Number(match[2]) : 1};
      });
      if (!items.length || items.length > 20000 || items.some(item => !Number.isFinite(item.weight) || item.weight <= 0)) { throw new Error('Нужен список до 20000 строк с положительными весами.'); }
      if (mode === 'shuffle') { results = shuffle(items).map(item => item.name); }
      else if (mode === 'groups') {
        if (count > items.length) { throw new Error('Групп больше, чем участников.'); }
        const groups = Array.from({length: count}, () => []);
        const restricted = $('together').value.trim() || $('apart').value.trim();
        if (restricted) { const assigned = constrainedGroups(items.map(item=>item.name), count, $('together').value, $('apart').value, () => randomInt(0, 0xffffffff) / 4294967296); groups.splice(0, groups.length, ...assigned); }
        else { shuffle(items).forEach((item, i) => groups[i % count].push(item.name)); }
        results = groups.map((group, i) => `Группа ${i + 1}:\n${group.join('\n')}`);
      } else {
        if ($('bag').checked) { const fingerprint = $('list').value; if (bagFingerprint !== fingerprint || !bagItems.length) { bagItems = items.map(item=>({...item})); bagFingerprint = fingerprint; } if (count > bagItems.length) { throw new Error(`В мешке осталось ${bagItems.length}. Уменьши количество или сбрось мешок.`); } items = bagItems; }
        if ($('unique').checked && count > items.length) { throw new Error('Результатов больше, чем вариантов.'); }
        for (let i = 0; i < count; i += 1) {
          const index = chooseWeighted(items); results.push(items[index].name);
          if ($('unique').checked || $('bag').checked) { items.splice(index, 1); }
        }
      }
    }
    $('bagInfo').textContent = mode === 'list' && $('bag').checked ? `В мешке осталось: ${bagItems.length}. При исчерпании следующий запуск начнёт новый круг.` : '';
    const text = results.join(mode === 'groups' ? '\n\n' : '\n');
    $('result').textContent = text;
    history.unshift(`${new Date().toLocaleTimeString('ru-RU')} — ${text.slice(0, 300)}`);
    history.splice(10); $('history').textContent = history.join('\n\n'); status('Готово.');
  });
  action('copy', () => copy($('result').textContent));
}

export function prompter(root) {
  root.innerHTML = `<section class="panel"><label>Текст<textarea id="text" placeholder="Основной текст, **акцент**, [[пауза / пометка]]"></textarea></label><div class="row">${field('size','Размер текста','number',40,'min="16" max="120"')}${field('speed','Скорость, px/с','number',40,'min="1" max="600"')}${field('delay','Задержка старта, с','number',0,'min="0" max="30"')}${field('width','Ширина текста, %','number',90,'min="30" max="100"')}${field('foreground','Цвет текста','color','#ffffff')}${field('background','Фон','color','#18191e')}${field('speechMinutes','Время выступления, мин','number',5,'min="0.1" max="240" step="0.5"')}</div><div class="actions"><label><input id="mirror" type="checkbox"> Зеркальный текст</label><label><input id="showNotes" type="checkbox" checked> Показывать пометки [[…]]</label><button id="pace">Рассчитать темп</button></div><p id="paceInfo" class="muted"></p><div class="actions"><button id="start" class="primary">Старт / пауза</button><button id="reset">В начало</button><button id="fullscreen">Полный экран</button><button id="pip">Картинка в картинке</button></div><p class="muted">[[Пометки]] выделяются отдельно и не учитываются в числе слов. **Акцент** выделяется жирным. Пробел — старт/пауза, Home — в начало, ↑/↓ — прокрутка. PiP открывает текст поверх других окон в поддерживаемых настольных браузерах.</p></section><div id="reader" class="prompter" tabindex="0" aria-label="Область суфлёра"><div id="readerText" class="prompter-text"></div></div>`;
  const saved=restore('prompter',{});$('text').value=saved.text||'Основной текст.\n\n[[Пауза 2 секунды]]\n\n**Важная мысль**.';
  for(const id of ['size','speed','width','delay','speechMinutes']) { if(saved[id]!=null) {$(id).value=saved[id];} }
  const original=$('reader');let reader=original;let textElement=$('readerText');let pipWindow;let running=false;let last=0;let startedAt=0;let position=0;let frame;let animationWindow=window;let disposed=false;
  function markup() { return esc($('text').value).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/\[\[([\s\S]*?)\]\]/g,(_,note)=>$('showNotes').checked?`<span class="prompter-note">${note}</span>`:''); }
  function update() {
    for(const [container,element] of [[original,$('readerText')],...(pipWindow?[[reader,textElement]]:[])]) {
      element.innerHTML=markup();element.style.fontSize=`${Math.max(16,Math.min(120,number('size',40)))}px`;element.style.maxWidth=`${Math.max(30,Math.min(100,number('width',90)))}%`;element.style.margin='auto';element.style.paddingTop=`${container.clientHeight*.5}px`;element.style.paddingBottom=`${container.clientHeight*.8}px`;element.classList.toggle('mirror',$('mirror').checked);container.style.color=$('foreground').value;container.style.background=$('background').value;
    }
    persist('prompter',Object.fromEntries(['text','size','speed','width','delay','speechMinutes'].map(id=>[id,$(id).value])));
    const words=($('text').value.replace(/\[\[[\s\S]*?\]\]/g,'').match(/[\p{L}\p{N}]+/gu)||[]).length;
    const minutes=number('speechMinutes',5);$('paceInfo').textContent=`Слов без пометок: ${words}. Для ${minutes} мин: ${minutes>0?Math.round(words/minutes):0} слов/мин. Скорость — ориентир; размер окна и паузы влияют на прокрутку.`;
  }
  function toggle() {running=!running;startedAt=Date.now()+Math.max(0,Math.min(30,number('delay')))*1000;position=reader.scrollTop;$('start').textContent=running?'Пауза':'Продолжить';}
  function readerKeys(event) {if(event.code==='Space') {event.preventDefault();toggle();} if(event.code==='Home') {event.preventDefault();reader.scrollTop=0;position=0;} }
  original.addEventListener('keydown',readerKeys);original.addEventListener('scroll',()=>{if(!running) {position=reader.scrollTop;}});
  action('start',toggle);action('reset',()=>{reader.scrollTop=0;position=0;running=false;$('start').textContent='Старт';});
  action('fullscreen',async()=>{await reader.requestFullscreen();reader.focus();});
  action('pace',async()=>{const minutes=number('speechMinutes',5);if(minutes<=0||minutes>240) {throw new Error('Время — от 0.1 до 240 минут.');} update();await new Promise(resolve=>requestAnimationFrame(resolve));$('speed').value=Math.max(1,Math.min(600,(reader.scrollHeight-reader.clientHeight)/(minutes*60))).toFixed(1);update();});
  action('pip',async()=>{
    if(pipWindow) {pipWindow.close();return;}
    const api=window.top.documentPictureInPicture;
    if(!api) {throw new Error('Этот браузер не поддерживает PiP для текста. Используй настольный Chrome или Edge с поддержкой Document PiP.');}
    pipWindow=await api.requestWindow({width:620,height:420});
    const style=pipWindow.document.createElement('style');style.textContent='html,body{margin:0;height:100%;overflow:hidden;font-family:Arial,sans-serif}.prompter{height:100%;overflow:auto;padding:0 24px;box-sizing:border-box}.prompter-text{white-space:pre-wrap;line-height:1.65}.mirror{transform:scaleX(-1)}.prompter-note{color:#f2ca79;font-size:.7em;border:1px solid #806b46;padding:3px 7px;border-radius:5px}';pipWindow.document.head.append(style);
    reader=pipWindow.document.createElement('div');reader.className='prompter';reader.tabIndex=0;textElement=pipWindow.document.createElement('div');textElement.className='prompter-text';reader.append(textElement);pipWindow.document.body.append(reader);update();reader.scrollTop=position;reader.addEventListener('keydown',readerKeys);reader.addEventListener('scroll',()=>{if(!running) {position=reader.scrollTop;}});reader.focus();
    window.cancelAnimationFrame(frame);animationWindow=pipWindow;last=0;frame=animationWindow.requestAnimationFrame(tick);pipWindow.addEventListener('resize',update);
    pipWindow.addEventListener('pagehide',()=>{if(disposed){return;}try{animationWindow.cancelAnimationFrame(frame);}catch(error){}animationWindow=window;last=0;reader=original;textElement=$('readerText');reader.scrollTop=position;pipWindow=null;update();frame=animationWindow.requestAnimationFrame(tick);},{once:true});status('Текст открыт в режиме «картинка в картинке». Управление остаётся на странице.');
  });
  root.addEventListener('input',update);
  function tick(time) {if(running&&Date.now()>=startedAt&&last) {position+=Math.min(100,time-last)/1000*Math.max(1,Math.min(600,number('speed',40)));reader.scrollTop=position;if(reader.scrollTop>=reader.scrollHeight-reader.clientHeight-1) {running=false;$('start').textContent='Продолжить';}}last=time;frame=animationWindow.requestAnimationFrame(tick);}
  teardown(()=>{disposed=true;animationWindow.cancelAnimationFrame(frame);pipWindow?.close();});update();frame=requestAnimationFrame(tick);
}
