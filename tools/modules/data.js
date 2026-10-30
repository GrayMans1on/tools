import { $, esc, field, files, select, action, status, download, copy, previewTable, persist, restore } from '../ui.js';
import { parseDelimited, writeDelimited, convertLayout, diffJSON } from '../logic.js';

export function layout(root) {
  root.innerHTML = `<div class="two"><section class="panel"><h2>Исходный текст</h2><textarea id="source" placeholder="Ghbdtn? vbh!"></textarea>${select('direction', 'Направление', [['en', 'Английская → русская'], ['ru', 'Русская → английская']])}<div class="actions"><button id="convert" class="primary">Преобразовать</button><button id="swap">Поменять местами</button></div></section><section class="panel"><h2>Результат</h2><textarea id="output" readonly></textarea><div class="actions"><button id="copy">Копировать</button><button id="save">Скачать TXT</button></div></section></div>`;
  $('source').value = restore('layout', 'Ghbdtn? vbh!');
  function update() {
    $('output').value = convertLayout($('source').value, $('direction').value === 'ru');
    persist('layout', $('source').value);
  }
  $('source').addEventListener('input', update);
  $('direction').addEventListener('change', update);
  action('convert', update);
  action('copy', () => copy($('output').value));
  action('save', () => download(new Blob([$ ('output').value], {type: 'text/plain;charset=utf-8'}), 'layout-result.txt'));
  action('swap', () => {
    $('source').value = $('output').value;
    $('direction').value = $('direction').value === 'en' ? 'ru' : 'en';
    update();
  });
  update();
}

export function json(root) {
  root.innerHTML = `<div class="panel">${files('file', '.json,application/json', false)}<div class="two"><label>JSON<textarea id="source" class="code" spellcheck="false"></textarea></label><label>Второй JSON для сравнения<textarea id="other" class="code" spellcheck="false" placeholder="Вставь документ для сравнения"></textarea></label></div><div class="actions"><button id="format" class="primary">Форматировать</button><button id="minify">Сжать</button><button id="validate">Проверить</button><button id="diff">Сравнить</button><button id="copy">Копировать</button><button id="save">Скачать JSON</button></div></div><section class="panel">${field('search', 'Поиск в структуре')}<div id="tree"></div><pre id="differences"></pre></section>`;
  $('source').value = restore('json', '{"name":"GrayMansion","tools":["Pixel Upscaler"],"available":true}');
  let parsed;
  function read() {
    try {
      parsed = JSON.parse($('source').value);
      persist('json', $('source').value);
      return parsed;
    } catch (error) {
      const position = /position (\d+)/.exec(error.message);
      if (position) {
        const before = $('source').value.slice(0, Number(position[1]));
        throw new Error(`Строка ${before.split('\n').length}, столбец ${before.length - before.lastIndexOf('\n')}: ${error.message}`);
      }
      throw error;
    }
  }
  function tree() {
    const target = $('tree');
    target.replaceChildren();
    const query = $('search').value.toLowerCase();
    let count = 0;
    function visit(value, key, parent, path) {
      if (count > 3000) {
        return;
      }
      count += 1;
      const complex = value !== null && typeof value === 'object';
      const serialized = JSON.stringify(value);
      if (query && !`${key} ${serialized}`.toLowerCase().includes(query)) {
        return;
      }
      const node = document.createElement(complex ? 'details' : 'div');
      const label = document.createElement(complex ? 'summary' : 'span');
      label.textContent = complex ? `${key}: ${Array.isArray(value) ? `Array (${value.length})` : `Object (${Object.keys(value).length})`}` : `${key}: ${serialized}`;
      label.title = path;
      node.append(label);
      if (complex) {
        node.open = Boolean(query) || path === '$';
        for (const [child, item] of Object.entries(value)) {
          visit(item, child, node, `${path}[${JSON.stringify(child)}]`);
        }
      } else {
        node.style.padding = '5px 16px';
        node.className = 'code';
        node.style.fontSize = '12px';
      }
      parent.append(node);
    }
    visit(parsed, '$', target, '$');
    if (count > 3000) {
      status('Показаны первые 3000 узлов. Полный документ доступен в редакторе.');
    }
  }
  function valid() {
    read();
    tree();
    status('Корректный JSON.');
  }
  action('format', () => {
    $('source').value = JSON.stringify(read(), null, 2);
    valid();
  });
  action('minify', () => {
    $('source').value = JSON.stringify(read());
    valid();
  });
  action('validate', valid);
  action('diff', () => {
    const changes = diffJSON(read(), JSON.parse($('other').value));
    tree();
    $('differences').textContent = changes.length ? JSON.stringify(changes, null, 2) : 'Документы совпадают.';
    status(`Различий: ${changes.length}${changes.length >= 2000 ? ' (вывод ограничен)' : ''}.`);
  });
  action('copy', () => copy($('source').value));
  action('save', () => {
    read();
    download(new Blob([$ ('source').value], {type: 'application/json'}), 'document.json');
  });
  $('file').addEventListener('change', async () => {
    if ($('file').files[0]) {
      $('source').value = await $('file').files[0].text();
      try { valid(); } catch (error) { status(error.message, true); }
    }
  });
  $('search').addEventListener('input', () => {
    try { read(); tree(); } catch (error) { status(error.message, true); }
  });
  valid();
}

export async function tables(root) {
  const {XLSX} = await import('../vendor/vendor.js');
  root.innerHTML = `<section class="panel">${files('file', '.csv,.tsv,.json,.md,.txt,.xlsx,.xls', false)}<div class="row">${select('inputFormat', 'Исходный формат', ['CSV', 'TSV', 'JSON', 'Markdown', 'XLSX'])}${select('encoding', 'Кодировка файла', ['utf-8', 'windows-1251'])}${select('delimiter', 'Разделитель CSV', [[',', 'Запятая'], [';', 'Точка с запятой'], ['\t', 'Табуляция']])}${select('sheet', 'Лист XLSX', [['', 'Сначала загрузи XLSX']])}</div><label>Исходные данные<textarea id="source" class="code"></textarea></label><div class="row">${select('outputFormat', 'Результат', ['CSV', 'TSV', 'JSON', 'Markdown', 'XLSX'])}<label><input id="headers" type="checkbox" checked> Первая строка — заголовки JSON</label></div><div class="actions"><button id="convert" class="primary">Преобразовать</button><button id="save">Скачать</button><button id="copy">Копировать текст</button></div></section><section class="panel"><h2>Предпросмотр — первые 100 строк</h2><div id="table" class="table-wrap"></div><label>Текст результата<textarea id="output" class="code" readonly></textarea></label></section>`;
  $('source').value = 'Название,Количество,Код\nИконка,3,0012\nСпрайт,8,0042';
  let workbook;
  let rows = [];
  let exported;
  function parse() {
    const text = $('source').value;
    switch ($('inputFormat').value) {
      case 'XLSX': {
        if (!workbook) { throw new Error('Загрузи книгу XLSX.'); }
        return XLSX.utils.sheet_to_json(workbook.Sheets[$('sheet').value], {header: 1, raw: false, defval: ''});
      }
      case 'JSON': {
        const value = JSON.parse(text);
        if (!Array.isArray(value)) { throw new Error('JSON должен быть массивом строк или объектов.'); }
        if (!value.length) { return []; }
        if (Array.isArray(value[0])) { return value; }
        if (value.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
          throw new Error('Все элементы должны быть объектами либо массивами.');
        }
        const keys = [...new Set(value.flatMap(item => Object.keys(item)))];
        return [keys, ...value.map(item => keys.map(key => item[key] ?? ''))];
      }
      case 'Markdown': {
        return text.trim().split(/\r?\n/).filter(line => !/^\s*\|?[\s:|-]+\|?\s*$/.test(line)).map(line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|').replace(/<br\s*\/?\s*>/gi, '\n')));
      }
      default: { return parseDelimited(text, $('inputFormat').value === 'TSV' ? '\t' : $('delimiter').value); }
    }
  }
  function convert() {
    rows = parse();
    if (!rows.length) { throw new Error('Таблица пуста.'); }
    previewTable(rows, $('table'));
    const format = $('outputFormat').value;
    let text = '';
    if (format === 'JSON') {
      if ($('headers').checked) {
        const headers = rows[0].map(String);
        if (new Set(headers).size !== headers.length) { throw new Error('Для JSON-объектов заголовки должны быть уникальны.'); }
        text = JSON.stringify(rows.slice(1).map(row => Object.fromEntries(headers.map((key, i) => [key, row[i] ?? '']))), null, 2);
      } else { text = JSON.stringify(rows, null, 2); }
    } else if (format === 'Markdown') {
      const encode = row => `| ${row.map(cell => String(cell ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')).join(' | ')} |`;
      text = [encode(rows[0]), encode(rows[0].map(() => '---')), ...rows.slice(1).map(encode)].join('\n');
    } else if (format === 'XLSX') {
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Данные');
      exported = new Blob([XLSX.write(book, {type: 'array', bookType: 'xlsx'})], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      text = 'Бинарный XLSX готов к скачиванию. Значения сохраняются как текст, если были текстом.';
    } else { text = writeDelimited(rows, format === 'TSV' ? '\t' : $('delimiter').value); }
    if (format !== 'XLSX') { exported = new Blob([format === 'CSV' ? '\uFEFF' : '', text], {type: 'text/plain;charset=utf-8'}); }
    $('output').value = text;
    status(`Строк: ${rows.length}; столбцов: ${Math.max(...rows.map(row => row.length))}.`);
  }
  action('convert', convert);
  action('save', () => { convert(); download(exported, `table.${{CSV: 'csv', TSV: 'tsv', JSON: 'json', Markdown: 'md', XLSX: 'xlsx'}[$('outputFormat').value]}`); });
  action('copy', () => { convert(); if ($('outputFormat').value === 'XLSX') { throw new Error('XLSX нужно скачать файлом.'); } return copy($('output').value); });
  $('file').addEventListener('change', async () => {
    try {
      const file = $('file').files[0];
      if (!file) { return; }
      const extension = file.name.split('.').pop().toLowerCase();
      if (['xlsx', 'xls'].includes(extension)) {
        workbook = XLSX.read(await file.arrayBuffer());
        $('sheet').replaceChildren(...workbook.SheetNames.map(name => new Option(name, name)));
        $('inputFormat').value = 'XLSX';
        $('source').value = 'Выбери лист книги. Предпросмотр появится после преобразования.';
      } else {
        $('source').value = new TextDecoder($('encoding').value).decode(await file.arrayBuffer());
        $('inputFormat').value = {json: 'JSON', tsv: 'TSV', md: 'Markdown'}[extension] || 'CSV';
      }
      convert();
    } catch (error) { status(error.message, true); }
  });
  convert();
}
