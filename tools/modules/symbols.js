import { $, esc, field, select, action, status, copy, restore, persist } from '../ui.js';
import { unicodeBlocks, unicodeInfo, code } from '../unicode-core.js';

export function unicode(root) {
  root.innerHTML = `<section class="panel"><label>Текст или символы<textarea id="unicodeText" spellcheck="false">АA → 👨‍👩‍👧‍👦</textarea></label><div class="actions"><button id="inspect" class="primary">Разобрать</button><button id="copyCodes">Копировать коды</button></div><p id="unicodeSummary" class="muted"></p></section><section class="panel"><div id="unicodeRows" class="table-wrap"></div><p class="muted">Имена и категории: Unicode 14. Новые символы продолжают отображаться, но могут отсутствовать в базе имён. Невидимые знаки показаны пунктирным квадратом.</p></section>`;
  let current = [];
  async function inspect() {
    const text = $('unicodeText').value;
    if ([...text].length > 1000) { throw new Error('За один раз — до 1000 кодовых точек.'); }
    const graphemes = [...new Intl.Segmenter('ru', {granularity: 'grapheme'}).segment(text)];
    current = [...text];
    const rows = await Promise.all(current.map(async char => {
      const cp = char.codePointAt(0); const info = await unicodeInfo(cp);
      const bytes = [...new TextEncoder().encode(char)].map(value => value.toString(16).toUpperCase().padStart(2, '0')).join(' ');
      const utf16 = Array.from({length: char.length}, (_, i) => char.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')).join(' ');
      return `<tr><td class="symbol-large">${/\s|\p{C}/u.test(char) ? '⬚' : esc(char)}</td><td>${code(cp)}</td><td>${esc(info.name)}</td><td>${info.category}</td><td>${bytes}</td><td>${utf16}</td><td><button data-char="${cp}">Копировать</button></td></tr>`;
    }));
    $('unicodeRows').innerHTML = `<table><tr><th>Знак</th><th>Код</th><th>Имя</th><th>Категория</th><th>UTF-8</th><th>UTF-16</th><th></th></tr>${rows.join('')}</table>`;
    $('unicodeSummary').textContent = `Кодовых точек: ${current.length}; видимых знаков: ${graphemes.length}; кодовых единиц UTF-16: ${text.length}.`;
  }
  action('inspect', inspect); action('copyCodes', () => copy([...$('unicodeText').value].map(char => code(char.codePointAt(0))).join(' ')));
  $('unicodeRows').onclick = event => { const value = event.target.dataset.char; if (value) { copy(String.fromCodePoint(Number(value))).catch(error => status(error.message, true)); } };
  return inspect();
}
export async function symbols(root) {
  root.innerHTML = `<section class="panel"><div class="row">${field('symbolSearch', 'Поиск по английскому имени или U+2192')}${select('symbolBlock', 'Категория', [['all', 'Все категории'], ['favorite', 'Избранное'], ...unicodeBlocks.map((item, index) => [String(index), item[0]])])}</div><p class="muted">Нажатие копирует знак. Звёздочка добавляет в избранное. Названия знаков — английские; категории — русские.</p><p id="symbolCount" class="muted"></p><div id="symbolGrid" class="symbol-grid"></div><div class="actions"><button id="symbolMore">Показать ещё</button></div><h3>Недавно использованные</h3><div id="recentSymbols" class="chips"></div></section>`;
  const data = [];
  const favorites = new Set(restore('symbol-favorites', [])); let recent = restore('symbol-recent', []); let limit = 120;
  for (const [block, start, end] of unicodeBlocks) {
    const entries = await Promise.all(Array.from({length: end - start + 1}, async (_, i) => {
      const cp = start + i; return {cp, block, ...await unicodeInfo(cp)};
    }));
    data.push(...entries.filter(item => item.category !== '—' && !['Cc', 'Cs', 'Co'].includes(item.category)));
  }
  function render() {
    const query = $('symbolSearch').value.trim().toLowerCase(); const block = $('symbolBlock').value;
    const filtered = data.filter(item => (block === 'all' || block === 'favorite' && favorites.has(item.cp) || unicodeBlocks[Number(block)]?.[0] === item.block) && (!query || `${item.name} ${code(item.cp)} ${String.fromCodePoint(item.cp)} ${item.block}`.toLowerCase().includes(query)));
    $('symbolCount').textContent = `Найдено ${filtered.length}. Показано ${Math.min(limit, filtered.length)}.`;
    $('symbolGrid').innerHTML = filtered.slice(0, limit).map(item => `<div class="symbol-cell"><button data-copy="${item.cp}" title="${esc(item.name)} · ${code(item.cp)}"><span>${esc(String.fromCodePoint(item.cp))}</span><small>${code(item.cp)}</small></button><button data-star="${item.cp}" aria-label="Избранное ${code(item.cp)}" aria-pressed="${favorites.has(item.cp)}">${favorites.has(item.cp) ? '★' : '☆'}</button></div>`).join('');
    $('symbolMore').hidden = filtered.length <= limit;
    $('recentSymbols').innerHTML = recent.map(cp => `<button data-copy="${cp}" title="${code(cp)}">${esc(String.fromCodePoint(cp))}</button>`).join('');
  }
  root.onclick = event => {
    const button = event.target.closest('button'); if (!button) { return; }
    if (button.dataset.star) {
      const cp = Number(button.dataset.star); favorites.has(cp) ? favorites.delete(cp) : favorites.add(cp); persist('symbol-favorites', [...favorites]); render();
    }
    if (button.dataset.copy) {
      const cp = Number(button.dataset.copy); copy(String.fromCodePoint(cp)).catch(error => status(error.message, true));
      recent = [cp, ...recent.filter(item => item !== cp)].slice(0, 24); persist('symbol-recent', recent); render();
    }
  };
  $('symbolSearch').oninput = () => { limit = 120; render(); }; $('symbolBlock').onchange = () => { limit = 120; render(); };
  $('symbolMore').onclick = () => { limit += 120; render(); }; render();
}
export async function emoji(root) {
  root.innerHTML = `<section class="panel"><div class="row">${field('emojiSearch', 'Ключевые слова: устал, кот, праздник, поддержка…')}${select('emojiKind', 'Каталог', [['emoji', 'Эмодзи'], ['kaomoji', 'Текстовые эмоции'], ['favorite', 'Избранное']])}</div><label>Набранное сочетание<textarea id="emojiCollection" style="min-height:80px"></textarea></label><div class="actions"><button id="copyCollection">Копировать сочетание</button><button id="clearCollection">Очистить сочетание</button></div><p class="muted">Нажатие копирует элемент и добавляет в сочетание. Поиск по русским и английским названиям и ключевым словам. Внешний вид эмодзи зависит от устройства.</p><p id="emojiCount" class="muted"></p><div id="emojiGrid" class="emoji-grid"></div><div class="actions"><button id="emojiMore">Показать ещё</button></div></section>`;
  const response = await fetch('./data/emoji.json'); if (!response.ok) { throw new Error('Не удалось загрузить каталог.'); }
  const data = await response.json();
  const faces = [
    ['¯\\_(ツ)_/¯', 'не знаю shrug пожать плечами'], ['(╯°□°）╯︵ ┻━┻', 'злость стол rage anger'], ['┬─┬ノ( º _ ºノ)', 'успокоить стол calm'],
    ['(づ｡◕‿‿◕｡)づ', 'обнять поддержка hugs love'], ['(ಥ﹏ಥ)', 'грусть плакать sad cry'], ['(－_－) zzZ', 'устал спать sleep tired'],
    ['ಠ_ಠ', 'подозрение недовольство serious'], ['(ง •̀_•́)ง', 'борьба мотивация fight'], ['(☞ﾟヮﾟ)☞', 'указать finger'],
    ['(｡♥‿♥｡)', 'любовь love'], ['(•‿•)', 'радость улыбка happy'], ['(⌐■_■)', 'круто очки cool'], ['(≧▽≦)', 'смех радость laugh'],
    ['(⊙_⊙)', 'удивление shock'], ['(¬_¬)', 'скепсис подозрение'], ['(；一_一)', 'неловко awkward'], ['(=^･ω･^=)', 'кот cat'],
    ['ʕ•ᴥ•ʔ', 'медведь bear'], ['( •_•)>⌐■-■', 'очки круто'], ['(☍﹏⁰)', 'печаль грусть'], ['(￣^￣)ゞ', 'принято salute'],
    ['(人 •͈ᴗ•͈)', 'спасибо просьба thank please'], ['(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', 'праздник магия celebration'], ['(╥_╥)', 'слёзы плач cry'],
    ['(ᵔᴥᵔ)', 'собака dog'], ['ᕦ(ò_óˇ)ᕤ', 'сила strong'], ['(・_・;)', 'неловко тревога'], ['(｡•́︿•̀｡)', 'грусть sad']
  ].map(([char, keywords]) => ({char, label: keywords, keywords, kind: 'kaomoji'}));
  const entries = [...data.map(item => ({...item, kind: 'emoji'})), ...faces];
  const favorites = new Set(restore('emoji-favorites', [])); let limit = 120;
  function render() {
    const words = $('emojiSearch').value.toLocaleLowerCase().trim().split(/\s+/u).filter(Boolean); const kind = $('emojiKind').value;
    const filtered = entries.filter(item => (kind === 'favorite' ? favorites.has(item.char) : item.kind === kind) && words.every(word => item.char.includes(word) || `${item.label} ${item.keywords}`.toLocaleLowerCase().replace(/ё/g, 'е').split(/[^\p{L}\p{N}]+/u).some(token => token.startsWith(word.replace(/ё/g, 'е')))));
    $('emojiCount').textContent = `В каталоге ${entries.length}. Найдено ${filtered.length}.`;
    $('emojiGrid').innerHTML = filtered.slice(0, limit).map(item => `<div class="emoji-cell"><button data-emoji="${esc(item.char)}" title="${esc(item.label)}"><span class="${item.kind === 'kaomoji' ? 'kaomoji' : ''}">${esc(item.char)}</span><small>${esc(item.label)}</small></button><button data-favorite="${esc(item.char)}" aria-label="В избранное" aria-pressed="${favorites.has(item.char)}">${favorites.has(item.char) ? '★' : '☆'}</button></div>`).join('');
    $('emojiMore').hidden = filtered.length <= limit;
  }
  $('emojiGrid').onclick = event => {
    const button = event.target.closest('button'); if (!button) { return; }
    if (button.dataset.emoji) { const char = button.dataset.emoji; $('emojiCollection').value += char; copy(char).catch(error => status(error.message, true)); }
    if (button.dataset.favorite) { const char = button.dataset.favorite; favorites.has(char) ? favorites.delete(char) : favorites.add(char); persist('emoji-favorites', [...favorites]); render(); }
  };
  $('emojiSearch').oninput = () => { limit = 120; render(); }; $('emojiKind').onchange = () => { limit = 120; render(); };
  $('emojiMore').onclick = () => { limit += 120; render(); };
  action('copyCollection', () => copy($('emojiCollection').value)); $('clearCollection').onclick = () => { $('emojiCollection').value = ''; }; render();
}
