import { $, esc, field, select, files, action, status, number, download, bundle, baseName, copy } from '../ui.js';
import { textStats, checkRules, checkText, fixText, splitText, replaceText } from '../text-core.js?v=20261030-v051';

export async function readText(file, encoding = 'utf-8') {
  if (file.size > 20 * 1024 * 1024) { throw new Error('Файл больше 20 МБ.'); }
  if (/\.docx$/i.test(file.name)) {
    const {mammoth} = await import('../vendor/vendor.js');
    return (await mammoth.extractRawText({arrayBuffer: await file.arrayBuffer()})).value;
  }
  const text = new TextDecoder(encoding).decode(await file.arrayBuffer()).replace(/^\ufeff/, '');
  if (/\.html?$/i.test(file.name)) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    doc.querySelectorAll('script,style').forEach(element => { element.remove(); });
    doc.querySelectorAll('p,div,br,li,h1,h2,h3,tr').forEach(element => { element.append('\n'); });
    return doc.body.textContent;
  }
  return text;
}
const inputPanel = () => `<section class="panel">${files('importText', '.txt,.md,.csv,.tsv,.json,.html,.htm,.docx', false)}${select('encoding', 'Кодировка текстового файла', [['utf-8', 'UTF-8'], ['windows-1251', 'Windows-1251'], ['utf-16le', 'UTF-16 LE']])}<label>Текст<textarea id="text" spellcheck="false"></textarea></label><small>TXT, MD, CSV, TSV, JSON, HTML и текст из DOCX. Абзац — блок, отделённый пустой строкой. Импорт заменяет поле текста.</small></section>`;
function importHandler(callback) {
  $('importText').addEventListener('change', async () => {
    try {
      const file = $('importText').files[0];
      if (file) { $('text').value = await readText(file, $('encoding').value); callback(); }
    } catch (error) { status(error.message, true); }
  });
}
export function textfiles(root) {
  root.innerHTML = `<section class="panel">${select('mode', 'Режим', [['split', 'Разделить файл'], ['merge', 'Объединить файлы']])}${files('inputFiles', '.txt,.md,.csv,.tsv,.json,.log,.html,.docx')}${select('encoding', 'Кодировка входных файлов', [['utf-8', 'UTF-8'], ['windows-1251', 'Windows-1251'], ['utf-16le', 'UTF-16 LE']])}<div id="fileOrder"></div></section><section class="panel"><div id="splitOptions" class="row">${select('splitMode', 'Разделить по', [['lines', 'Числу строк'], ['characters', 'Числу символов'], ['bytes', 'Размеру UTF-8 в байтах'], ['delimiter', 'Разделителю'], ['chapters', 'Главам / Markdown-заголовкам']])}${field('amount', 'Строк / символов / байтов в части', 'number', 100, 'min="1" max="10000000"')}${field('delimiter', 'Разделитель', 'text', '---')}</div><div id="mergeOptions" hidden>${field('separator', 'Разделитель между файлами (\\n — перенос)', 'text', '\\n\\n')}<label><input id="headings" type="checkbox"> Добавить названия исходных файлов</label></div><div class="actions"><button id="prepare" class="primary">Подготовить результат</button><button id="saveFiles" disabled>Скачать</button></div><p id="fileSummary" class="muted"></p><pre id="filePreview"></pre></section>`;
  let chosen = []; let results = [];
  function invalidate() { results = []; $('saveFiles').disabled = true; }
  function order() {
    $('fileOrder').innerHTML = chosen.map((file, index) => `<div class="file-row"><span>${esc(file.name)}</span><button data-up="${index}" aria-label="Выше ${esc(file.name)}" ${index === 0 ? 'disabled' : ''}>↑</button><button data-down="${index}" aria-label="Ниже ${esc(file.name)}" ${index === chosen.length - 1 ? 'disabled' : ''}>↓</button><button data-remove="${index}" aria-label="Убрать ${esc(file.name)}">Убрать</button></div>`).join('');
    invalidate();
  }
  $('inputFiles').onchange = () => { chosen = [...$('inputFiles').files]; order(); };
  $('fileOrder').onclick = event => {
    const button = event.target.closest('button'); if (!button) { return; }
    if (button.dataset.remove !== undefined) { chosen.splice(Number(button.dataset.remove), 1); }
    else {
      const index = Number(button.dataset.up ?? button.dataset.down);
      const next = index + (button.dataset.up !== undefined ? -1 : 1);
      [chosen[index], chosen[next]] = [chosen[next], chosen[index]];
    }
    order();
  };
  root.addEventListener('input', invalidate);
  $('mode').onchange = () => {
    $('splitOptions').hidden = $('mode').value !== 'split'; $('mergeOptions').hidden = $('mode').value !== 'merge'; invalidate();
  };
  action('prepare', async () => {
    invalidate();
    if (!chosen.length) { throw new Error('Выбери файлы.'); }
    if ($('mode').value === 'split' && chosen.length !== 1) { throw new Error('Для разделения выбери ровно один файл.'); }
    if (chosen.reduce((sum, file) => sum + file.size, 0) > 50e6) { throw new Error('Общий размер — до 50 МБ.'); }
    const texts = await Promise.all(chosen.map(file => readText(file, $('encoding').value)));
    if ($('mode').value === 'split') {
      results = splitText(texts[0], $('splitMode').value, number('amount'), $('delimiter').value).map((text, index) => ({name: `${baseName(chosen[0].name)}_${String(index + 1).padStart(3, '0')}.txt`, text}));
    } else {
      const separator = $('separator').value.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      results = [{name: 'merged.txt', text: texts.map((text, index) => ($('headings').checked ? `--- ${chosen[index].name} ---\n` : '') + text).join(separator)}];
    }
    $('fileSummary').textContent = `Файлов на выходе: ${results.length}. UTF-8. Исходники сохраняются. Предпросмотр первой части до 10 000 символов.`;
    $('filePreview').textContent = results[0].text.slice(0, 10000); $('saveFiles').disabled = false;
  });
  action('saveFiles', async () => { await bundle(results.map(item => ({name: item.name, blob: new Blob([item.text], {type: 'text/plain;charset=utf-8'})})), 'text-parts.zip'); });
}
export function textlab(root) {
  root.innerHTML = inputPanel() + `<section class="panel"><h2>Статистика</h2><div class="row">${field('needle', 'Посчитать символ или сочетание')}<label><input id="ignoreCase" type="checkbox"> Без учёта регистра</label></div><div id="stats" class="stats-grid"></div><p class="muted">Вхождения сочетания считаются без перекрытий. Символы — кодовые точки; видимые знаки — графемы.</p><details><summary>Частотность слов</summary><div id="frequency" class="table-wrap"></div></details><div class="actions"><button id="saveStats">Скачать статистику JSON</button></div></section><section class="panel"><h2>Массовая замена</h2><div id="replaceRows"></div><button id="addRule">Добавить замену</button><div class="actions"><label><input id="regex" type="checkbox"> Регулярные выражения</label><label><input id="replaceCase" type="checkbox"> Без учёта регистра</label><label><input id="whole" type="checkbox"> Целые слова</label></div><p class="muted">Правила выполняются сверху вниз. В режиме регулярных выражений доступны $1, $2 и $&amp;.</p><div class="actions"><button id="replacePreview" class="primary">Предпросмотр замен</button><button id="applyReplace" disabled>Применить</button><button id="undoText" disabled>Отменить применение</button><button id="saveText">Скачать TXT</button></div><label>Результат<textarea id="replacement" readonly></textarea></label></section>`;
  let previous = null; let snapshot = null; let metrics;
  function update() {
    const text = $('text').value;
    if (text.length > 2e6) { status('Для анализа — до 2 млн символов.', true); return; }
    metrics = textStats(text, $('needle').value, $('ignoreCase').checked);
    const names = {paragraphs: 'Абзацы', lines: 'Строки', words: 'Слова', letters: 'Буквы', digits: 'Цифры', spaces: 'Пробельные', characters: 'Символы', graphemes: 'Видимые знаки', occurrences: 'Вхождения'};
    $('stats').innerHTML = Object.entries(names).map(([key, title]) => `<div class="stat"><strong>${metrics[key].toLocaleString('ru')}</strong><span>${title}</span></div>`).join('');
    $('frequency').innerHTML = `<table><tr><th>Слово</th><th>Количество</th></tr>${metrics.frequency.map(([word, count]) => `<tr><td>${esc(word)}</td><td>${count}</td></tr>`).join('')}</table>`;
    snapshot = null; $('applyReplace').disabled = true;
  }
  let debounce;
  $('text').oninput = () => { clearTimeout(debounce); debounce = setTimeout(update, 250); };
  $('needle').oninput = update; $('ignoreCase').onchange = update; importHandler(update);
  function addRule() {
    const row = document.createElement('div'); row.className = 'replace-row';
    row.innerHTML = '<input aria-label="Найти" placeholder="Найти"><input aria-label="Заменить на" placeholder="Заменить на"><button aria-label="Удалить правило">Убрать</button>';
    row.querySelector('button').onclick = () => { row.remove(); snapshot = null; $('applyReplace').disabled = true; };
    row.oninput = () => { snapshot = null; $('applyReplace').disabled = true; }; $('replaceRows').append(row);
  }
  $('addRule').onclick = addRule; addRule();
  for (const id of ['regex', 'replaceCase', 'whole']) { $(id).onchange = () => { snapshot = null; $('applyReplace').disabled = true; }; }
  action('replacePreview', async () => {
    const text = $('text').value;
    if (text.length > 2e6) { throw new Error('До 2 млн символов.'); }
    const rules = [...$('replaceRows').children].map(row => [...row.querySelectorAll('input')].map(input => input.value));
    const source = `self.onmessage = e => {try {self.postMessage({result: (${replaceText.toString()})(...e.data)});} catch(error) {self.postMessage({error:error.message});}};`;
    const url = URL.createObjectURL(new Blob([source], {type: 'text/javascript'})); const worker = new Worker(url);
    try {
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { reject(new Error('Замена превысила 3 секунды: упрости выражение.')); }, 3000);
        worker.onmessage = event => { clearTimeout(timer); event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.result); };
        worker.onerror = () => { clearTimeout(timer); reject(new Error('Ошибка выполнения замены.')); };
        worker.postMessage([text, rules, $('regex').checked, $('replaceCase').checked, $('whole').checked]);
      });
      $('replacement').value = result.text; snapshot = text; $('applyReplace').disabled = false;
      status(`Замен: ${result.total}. Проверь результат перед применением.`);
    } finally { worker.terminate(); URL.revokeObjectURL(url); }
  });
  $('applyReplace').onclick = () => {
    if (snapshot !== $('text').value) { status('Текст изменён: обнови предпросмотр.', true); return; }
    previous = $('text').value; $('text').value = $('replacement').value; $('undoText').disabled = false; update();
  };
  $('undoText').onclick = () => { if (previous !== null) { $('text').value = previous; previous = null; $('undoText').disabled = true; update(); } };
  action('saveText', () => { download(new Blob([$('text').value], {type: 'text/plain;charset=utf-8'}), 'text-result.txt'); });
  action('saveStats', () => { update(); download(new Blob([JSON.stringify(metrics, null, 2)], {type: 'application/json'}), 'text-statistics.json'); });
  update();
}
export function textcheck(root) {
  root.innerHTML = inputPanel() + `<section class="panel"><h2>Проверки</h2><div class="chips">${checkRules.map(rule => `<label class="chip"><input type="checkbox" data-rule="${rule.id}" checked> ${rule.name}</label>`).join('')}</div><div class="row">${field('maxLength', 'Максимум символов (0 — без ограничения)', 'number', 0, 'min="0"')}${field('forbidden', 'Запрещённые слова через запятую')}</div><div class="actions"><button id="check" class="primary">Проверить</button><button id="fix">Исправить выбранные группы</button><button id="undoCheck" disabled>Отменить</button><button id="saveChecked">Скачать TXT</button></div><p class="muted">Техническая проверка и типографика. Смешанные алфавиты только подсвечиваются. Невидимые знаки иногда нужны: проверь каждое исправление. Орфография и грамматика не анализируются.</p><div id="issues"></div></section>`;
  let previous; let issues = []; let checkedText;
  const selected = () => [...root.querySelectorAll('[data-rule]:checked')].map(input => input.dataset.rule);
  function run() {
    const text = $('text').value;
    if (text.length > 2e6) { status('До 2 млн символов.', true); return; }
    checkedText = text; issues = checkText(text, selected());
    const limit = number('maxLength');
    if (limit > 0 && [...text].length > limit) { issues.push({name: `Превышение длины: ${[...text].length} / ${limit}`, index: 0, text: '', replacement: null}); }
    for (const word of $('forbidden').value.split(',').map(value => value.trim()).filter(Boolean)) {
      let start = text.toLocaleLowerCase().indexOf(word.toLocaleLowerCase());
      while (start !== -1 && issues.length < 2000) { issues.push({name: 'Запрещённое слово', index: start, text: text.slice(start, start + word.length), replacement: null}); start = text.toLocaleLowerCase().indexOf(word.toLocaleLowerCase(), start + word.length); }
    }
    $('issues').innerHTML = `<p>Найдено: ${issues.length}${issues.length >= 2000 ? ' (первые 2000)' : ''}</p>` + issues.slice(0, 2000).map((issue, index) => `<div class="issue"><strong>${esc(issue.name)}</strong><small>Позиция ${issue.index + 1}</small><code>${esc(text.slice(Math.max(0, issue.index - 24), issue.index))}<mark>${esc(issue.text || '∅')}</mark>${esc(text.slice(issue.index + issue.text.length, issue.index + issue.text.length + 24))}</code>${issue.replacement !== null ? `<button data-fix="${index}">Исправить</button>` : ''}</div>`).join('');
  }
  function remember() { previous = $('text').value; $('undoCheck').disabled = false; }
  $('check').onclick = run; importHandler(run);
  $('fix').onclick = () => { remember(); $('text').value = fixText($('text').value, selected()); run(); };
  $('undoCheck').onclick = () => { $('text').value = previous; $('undoCheck').disabled = true; run(); };
  $('issues').onclick = event => {
    const index = event.target.dataset.fix; if (index === undefined) { return; }
    if (checkedText !== $('text').value) { status('Текст изменён: выполни проверку заново.', true); return; }
    const issue = issues[Number(index)]; remember(); $('text').value = previous.slice(0, issue.index) + issue.replacement + previous.slice(issue.index + issue.text.length); run();
  };
  action('saveChecked', () => { download(new Blob([$('text').value], {type: 'text/plain;charset=utf-8'}), 'checked-text.txt'); });
}
