import { $, esc, field, select, files, action, status, number, canvas, toBlob, download, teardown } from '../ui.js';
import { parse } from '../vendor/fonts.js';

export function fonts(root) {
  root.innerHTML = `<section class="panel">${files('fontFiles', '.ttf,.otf,.woff,.woff2')}<div class="row">${field('googleFont', 'Google Fonts: название семейства', 'text', 'Roboto')}<button id="loadGoogle">Загрузить из Google Fonts</button></div><p class="muted">Локальные шрифты обрабатываются на устройстве. Загрузка Google Fonts обращается к Google. Точное покрытие проверяется для TTF, OTF и WOFF; для WOFF2 отображается образец без проверки глифов.</p><p id="fontReport" class="muted"></p></section><section class="panel"><label>Текст образца<textarea id="sampleText">Съешь ещё этих мягких французских булок, да выпей чаю.\nThe quick brown fox jumps over the lazy dog. 0123456789</textarea></label><div class="row">${field('fontSize', 'Размер, px', 'number', 32, 'min="8" max="180"')}${field('letterSpacing', 'Межбуквенный интервал, px', 'number', 0, 'min="-5" max="20" step="0.1"')}${field('lineHeight', 'Межстрочный, ×', 'number', 1.4, 'min="0.8" max="3" step="0.1"')}${field('fontColor', 'Цвет текста', 'color', '#28282f')}${field('fontBg', 'Фон', 'color', '#ffffff')}</div><div class="actions"><button id="exportFonts">Скачать сравнение PNG</button></div></section><div id="fontCards"></div>`;
  const entries = [];
  function render() {
    $('fontCards').innerHTML = entries.map((item, index) => {
      const chars = [...new Set([...$('sampleText').value])].filter(char => !/\s/u.test(char));
      const missing = item.parsed ? chars.filter(char => !item.parsed.charToGlyphIndex(char)) : [];
      const axes = item.parsed?.tables.fvar?.axes ?? [];
      return `<section class="panel font-card" data-font="${index}"><div class="row"><h2>${esc(item.name)}</h2><button data-remove-font="${index}">Убрать</button></div><p class="muted">${item.parsed ? `Глифов: ${item.parsed.numGlyphs}. ${missing.length ? `Отсутствуют в образце: ${esc(missing.join(' '))}` : 'Все символы образца найдены в шрифте.'}` : 'Покрытие не проверено: браузер может подставить другой шрифт для отсутствующих символов.'}</p><div class="font-sample">${esc($('sampleText').value)}</div>${axes.length ? `<p class="muted">Вариативные оси: ${axes.map(axis => `${esc(axis.tag)} ${axis.minValue}…${axis.maxValue}`).join('; ')}</p>` : ''}<details><summary>В контексте</summary><div class="font-contexts"><div><h2>Заголовок страницы</h2><p>Текст карточки и описание инструмента.</p><button>Открыть инструмент</button></div><div><small>НАСТРОЙКИ</small><h3>Уведомления</h3><label>Название проекта<input value="Новый проект"></label><p>Изменения сохранены.</p></div><div class="font-dark"><h2>23:48</h2><p>Пятница, 30 октября</p><span>Сообщение · Проверка кириллицы</span></div></div></details>${item.parsed ? `<details><summary>Символы шрифта · первые 600</summary><div class="glyph-grid">${Object.keys(item.parsed.tables.cmap.glyphIndexMap).slice(0, 600).map(cp => `<span title="U+${Number(cp).toString(16).toUpperCase()}">${esc(String.fromCodePoint(Number(cp)))}</span>`).join('')}</div></details>` : ''}</section>`;
    }).join('');
    for (const card of $('fontCards').children) {
      const entry = entries[Number(card.dataset.font)]; const sample = card.querySelector('.font-sample');
      sample.style.fontFamily = `"${entry.family}", sans-serif`; sample.style.fontSize = `${Math.max(8, Math.min(180, number('fontSize', 32)))}px`;
      sample.style.letterSpacing = `${Math.max(-5, Math.min(20, number('letterSpacing')))}px`; sample.style.lineHeight = String(Math.max(.8, Math.min(3, number('lineHeight', 1.4))));
      sample.style.color = $('fontColor').value; sample.style.backgroundColor = $('fontBg').value;
      for (const target of card.querySelectorAll('.font-contexts,.glyph-grid')) { target.style.fontFamily = `"${entry.family}", sans-serif`; }
    }
    $('fontReport').textContent = `Загружено шрифтов: ${entries.length}.`;
  }
  async function addFont(file) {
    if (entries.length >= 12) { throw new Error('Одновременно — до 12 шрифтов.'); }
    if (file.size > 20e6) { throw new Error('Шрифт больше 20 МБ.'); }
    const buffer = await file.arrayBuffer(); const family = `GMFont${Date.now()}_${entries.length}`;
    const face = await new FontFace(family, buffer).load(); document.fonts.add(face);
    let parsed = null;
    try { parsed = parse(buffer.slice(0)); } catch (error) { status(`${file.name}: образец доступен, проверка глифов не поддерживается для этого файла.`); }
    entries.push({name: file.name, family, face, parsed}); render();
  }
  $('fontFiles').onchange = async () => {
    const reports = [];
    for (const file of $('fontFiles').files) { try { await addFont(file); } catch (error) { reports.push(`${file.name}: ${error.message}`); } }
    if (reports.length) { status(reports.join('\n'), true); }
  };
  action('loadGoogle', async () => {
    if (entries.length >= 12) { throw new Error('Одновременно — до 12 шрифтов.'); }
    const name = $('googleFont').value.trim();
    if (!/^[\p{L}\p{N} -]{1,80}$/u.test(name)) { throw new Error('Укажи название семейства шрифта.'); }
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}&display=swap`;
    await new Promise((resolve, reject) => { link.onload = resolve; link.onerror = () => reject(new Error('Не удалось подключить Google Fonts. Проверь название и сеть.')); document.head.append(link); });
    const loaded = await document.fonts.load(`32px "${name}"`, $('sampleText').value.slice(0, 100));
    if (!loaded.length || !document.fonts.check(`32px "${name}"`)) { throw new Error('Шрифт не загрузился.'); }
    entries.push({name, family: name, parsed: null, link}); render();
  });
  $('fontCards').onclick = event => {
    const value = event.target.dataset.removeFont; if (value === undefined) { return; }
    const [entry] = entries.splice(Number(value), 1); if (entry.face) { document.fonts.delete(entry.face); } entry.link?.remove(); render();
  };
  for (const id of ['sampleText', 'fontSize', 'letterSpacing', 'lineHeight', 'fontColor', 'fontBg']) { $(id).oninput = render; }
  action('exportFonts', async () => {
    if (!entries.length) { throw new Error('Загрузи шрифт.'); }
    const output = canvas(1400, entries.length * 240); const ctx = output.getContext('2d');
    ctx.fillStyle = $('fontBg').value; ctx.fillRect(0, 0, output.width, output.height);
    for (const [index, entry] of entries.entries()) {
      ctx.fillStyle = '#858b9d'; ctx.font = '18px sans-serif'; ctx.fillText(entry.name, 35, index * 240 + 35);
      ctx.fillStyle = $('fontColor').value; ctx.font = `${Math.max(8, Math.min(100, number('fontSize', 32)))}px "${entry.family}"`;
      const lines = $('sampleText').value.split('\n').slice(0, 3);
      lines.forEach((line, lineIndex) => { ctx.fillText(line, 35, index * 240 + 95 + lineIndex * 55, 1330); });
    }
    download(await toBlob(output), 'font-comparison.png');
  });
  teardown(() => { for (const entry of entries) { if (entry.face) { document.fonts.delete(entry.face); } entry.link?.remove(); } }); render();
}
