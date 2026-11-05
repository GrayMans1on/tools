import {fetchGoogleFont, validateGoogleFonts} from './puzzle-google-fonts.js?v=20261105-puzzle-google';
import {$, field, select, files, action, status} from './ui.js';

const fonts = ['Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Trebuchet MS', 'Courier New', 'monospace', 'sans-serif'];
const colors = ['#dce8e0', '#dce4f2', '#eee0ed', '#f4e6cb', '#d8ebed', '#e6e3f2'];
const defaults = index => ({text: `Блок ${index + 1}`, background: colors[index % colors.length], color: '#28282f', font: 'Arial', size: 36, bold: true, align: 'center'});

export function puzzleTextEditor(host, grid) {
  host.innerHTML = `<div class="row">${field('blockWidth', 'Ширина блока, px', 'number', 280, 'min="64" max="800"')}${field('blockHeight', 'Высота блока, px', 'number', 180, 'min="64" max="800"')}${field('blockPadding', 'Отступ текста, px', 'number', 20, 'min="0" max="100"')}</div><p class="muted">Выбери блок в сетке и отредактируй его. Надписи переносятся и уменьшаются, если не помещаются. Изменения применяются кнопкой «Создать».</p><div id="textBlockGrid" style="display:grid;gap:6px;margin:16px 0;overflow:auto;padding:4px"></div><label>Текст выбранного блока<textarea id="blockText" rows="3" maxlength="2000"></textarea></label><div class="row">${field('blockBackground', 'Фон блока', 'color', '#dce8e0')}${field('blockColor', 'Цвет текста', 'color', '#28282f')}${select('blockFont', 'Шрифт', fonts.map(font => [font, font]))}${field('blockFontSize', 'Размер шрифта, px', 'number', 36, 'min="8" max="240"')}${select('blockAlign', 'Выравнивание', [['left', 'Слева'], ['center', 'По центру'], ['right', 'Справа']])}</div><div class="actions"><label><input id="blockBold" type="checkbox" checked> Жирный</label><button id="blockApplyAll">Применить оформление ко всем блокам</button></div><div class="row">${field('blockGoogleFont', 'Google Fonts: название семейства', 'text', 'Dela Gothic One', 'list="puzzleGoogleSuggestions" maxlength="100"')}<button id="blockLoadGoogle">Загрузить Google Fonts</button></div><datalist id="puzzleGoogleSuggestions"><option>Dela Gothic One</option><option>Roboto</option><option>Montserrat</option><option>Rubik</option><option>Oswald</option><option>Comfortaa</option><option>Unbounded</option></datalist><p class="muted">Загрузка обращается к Google. Загруженные файлы шрифта сохраняются в проекте для работы без интернета.</p><p class="muted">Свой шрифт TTF, OTF или WOFF/WOFF2:</p>${files('blockFontFile', '.ttf,.otf,.woff,.woff2', false)}<p class="muted">Шрифт встраивается в проект; в игре и PNG надписи уже отрисованы.</p>`;
  let blocks = [];
  let selected = 0;
  let columns = 0;
  let rows = 0;
  let customFontData = '';
  let customFace = null;
  let disposed = false;
  const googleFonts = new Map();
  const googleRequests = new Set();
  const controlIds = ['blockText', 'blockBackground', 'blockColor', 'blockFont', 'blockFontSize', 'blockAlign', 'blockBold'];
  function saveSelected() {
    if (!blocks[selected]) { return; }
    blocks[selected] = {text: $('blockText').value, background: $('blockBackground').value, color: $('blockColor').value, font: $('blockFont').value, size: Math.max(8, Math.min(240, Number($('blockFontSize').value) || 36)), bold: $('blockBold').checked, align: $('blockAlign').value};
  }
  function selectBlock(index) {
    selected = index;
    const block = blocks[index];
    $('blockText').value = block.text; $('blockBackground').value = block.background; $('blockColor').value = block.color;
    $('blockFont').value = block.font; $('blockFontSize').value = block.size; $('blockAlign').value = block.align;
    $('blockBold').checked = block.bold;
    drawGrid();
  }
  function drawGrid() {
    const view = $('textBlockGrid');
    view.style.gridTemplateColumns = `repeat(${columns},minmax(72px,1fr))`;
    view.replaceChildren();
    blocks.slice(0, columns * rows).forEach((block, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = block.text || `Блок ${index + 1}`;
      button.setAttribute('aria-label', `Блок ${index + 1}: ${block.text}`);
      button.setAttribute('aria-pressed', String(index === selected));
      button.style.cssText = 'min-height:64px;white-space:pre-wrap;overflow-wrap:anywhere;padding:10px;';
      button.style.background = block.background; button.style.color = block.color;
      button.style.fontFamily = block.font; button.style.fontWeight = block.bold ? '700' : '400';
      button.style.textAlign = block.align; button.style.outline = index === selected ? '2px solid #37835b' : 'none';
      button.onclick = () => { saveSelected(); selectBlock(index); };
      view.append(button);
    });
  }
  function syncGrid() {
    saveSelected();
    const next = grid();
    columns = next.columns; rows = next.rows;
    while (blocks.length < columns * rows) { blocks.push(defaults(blocks.length)); }
    selected = Math.min(selected, columns * rows - 1);
    selectBlock(selected);
  }
  for (const id of controlIds) {
    $(id).addEventListener('input', () => { saveSelected(); drawGrid(); });
  }
  action('blockApplyAll', () => {
    saveSelected(); const {text, ...style} = blocks[selected];
    blocks = blocks.map(block => ({...block, ...style})); drawGrid();
  });
  async function installFont(data) {
    const next = await new FontFace('PuzzleCustom', `url("${data}")`).load();
    if (disposed) { return; }
    if (customFace) { document.fonts.delete(customFace); }
    customFace = next; customFontData = data; document.fonts.add(next);
    if (!$('blockFont').querySelector('option[value="PuzzleCustom"]')) {
      $('blockFont').add(new Option('Свой шрифт', 'PuzzleCustom'));
    }
  }
  async function installGoogle(group) {
    if (googleFonts.has(group.family)) { return; }
    const faces = await Promise.all(group.faces.map(face =>
      new FontFace(group.family, `url("${face.data}")`, {unicodeRange: face.range}).load()));
    if (disposed) { return; }
    faces.forEach(face => { document.fonts.add(face); });
    googleFonts.set(group.family, {group, faces});
    if (![...$('blockFont').options].some(option => option.value === group.family)) {
      $('blockFont').add(new Option(`${group.family} · Google Fonts`, group.family));
    }
  }
  action('blockLoadGoogle', async () => {
    const family = $('blockGoogleFont').value.trim();
    const target = selected;
    const controller = new AbortController(); googleRequests.add(controller);
    const timeout = setTimeout(() => { controller.abort(); }, 25000);
    try {
      status('Загрузка Google Fonts…');
      if (!googleFonts.has(family)) {
        const group = await fetchGoogleFont(family, controller.signal);
        if (disposed) { return; }
        validateGoogleFonts([...googleFonts.values()].map(entry => entry.group).concat(group));
        await installGoogle(group);
      }
      if (disposed) { return; }
      blocks[target].font = family;
      if (selected === target) { $('blockFont').value = family; }
      drawGrid(); status(`Шрифт ${family} загружен и выбран для блока ${target + 1}.`);
    } catch (error) {
      if (!disposed) { throw new Error(error.name === 'AbortError' ? 'Время загрузки истекло. Проверь соединение с Google Fonts.' : error.message); }
    } finally { clearTimeout(timeout); googleRequests.delete(controller); }
  });
  $('blockFontFile').addEventListener('change', async () => {
    try {
      const file = $('blockFontFile').files[0]; if (!file) { return; }
      if (file.size > 5e6) { throw new Error('Шрифт — до 5 МБ.'); }
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
      });
      await installFont(data); if (disposed) { return; }
      $('blockFont').value = 'PuzzleCustom'; saveSelected(); drawGrid(); status('Свой шрифт загружен.');
    } catch (error) { status(`Не удалось загрузить шрифт: ${error.message}`, true); }
  });
  function settings() {
    saveSelected();
    const width = Number($('blockWidth').value); const height = Number($('blockHeight').value);
    const padding = Number($('blockPadding').value);
    if (![width, height].every(value => Number.isInteger(value) && value >= 64 && value <= 800) || !Number.isInteger(padding) || padding < 0 || padding > 100) {
      throw new Error('Размер блока — от 64 до 800 px; отступ — от 0 до 100 px.');
    }
    if (width * columns > 4096 || height * rows > 4096) { throw new Error('Общее изображение — до 4096 px по стороне.'); }
    return {width, height, padding, blocks: blocks.map(block => ({...block})), customFontData, googleFonts: [...googleFonts.values()].map(entry => entry.group)};
  }
  function render() {
    const data = settings();
    const canvas = document.createElement('canvas'); canvas.width = data.width * columns; canvas.height = data.height * rows;
    const context = canvas.getContext('2d');
    data.blocks.slice(0, columns * rows).forEach((block, index) => {
      const x = index % columns * data.width; const y = Math.floor(index / columns) * data.height;
      const padding = Math.min(data.padding, data.width / 3, data.height / 3);
      const maxWidth = data.width - 2 * padding; const maxHeight = data.height - 2 * padding;
      context.save(); context.beginPath(); context.rect(x, y, data.width, data.height); context.clip();
      context.fillStyle = block.background; context.fillRect(x, y, data.width, data.height);
      let size = block.size; let lines;
      function wrap() {
        const result = [];
        for (const paragraph of block.text.split('\n')) {
          let line = '';
          for (const char of paragraph) {
            if (line && context.measureText(line + char).width > maxWidth) { result.push(line); line = ''; }
            line += char;
          }
          result.push(line);
        }
        return result;
      }
      do {
        context.font = `${block.bold ? '700' : '400'} ${size}px ${block.font.includes(' ') ? JSON.stringify(block.font) : block.font}`;
        lines = wrap(); if (lines.length * size * 1.2 <= maxHeight || size <= 8) { break; } size--;
      } while (size >= 8);
      if (lines.length * size * 1.2 > maxHeight) {
        throw new Error(`Текст блока ${index + 1} не помещается. Увеличь блок или сократи надпись.`);
      }
      context.fillStyle = block.color; context.textAlign = block.align; context.textBaseline = 'middle';
      const tx = block.align === 'left' ? x + padding : block.align === 'right' ? x + data.width - padding : x + data.width / 2;
      lines.forEach((line, lineIndex) => {
        const ty = y + data.height / 2 + (lineIndex - (lines.length - 1) / 2) * size * 1.2;
        context.fillText(line, tx, ty, maxWidth);
      });
      context.restore();
    });
    return {image: canvas.toDataURL('image/png'), imageWidth: canvas.width, imageHeight: canvas.height, text: data};
  }
  async function load(data) {
    if (!data || !Number.isInteger(data.width) || !Number.isInteger(data.height) || data.width < 64 || data.width > 800 || data.height < 64 || data.height > 800 || !Number.isInteger(data.padding) || data.padding < 0 || data.padding > 100 || !Array.isArray(data.blocks) || data.blocks.length < columns * rows || data.blocks.length > 64) { throw new Error('Неверные текстовые блоки проекта.'); }
    const importedGoogle = validateGoogleFonts(data.googleFonts || []);
    for (const block of data.blocks) {
      if (!block || typeof block.text !== 'string' || block.text.length > 2000 || !/^#[0-9a-f]{6}$/i.test(block.background) || !/^#[0-9a-f]{6}$/i.test(block.color) || ![...fonts, 'PuzzleCustom', ...importedGoogle.map(group => group.family)].includes(block.font) || !Number.isFinite(block.size) || block.size < 8 || block.size > 240 || typeof block.bold !== 'boolean' || !['left', 'center', 'right'].includes(block.align)) { throw new Error('Неверное оформление блока.'); }
    }
    if (data.customFontData) {
      if (typeof data.customFontData !== 'string' || data.customFontData.length > 7e6 || !/^data:[a-z0-9.+/-]*;base64,[A-Za-z0-9+/=]+$/i.test(data.customFontData)) { throw new Error('Неверный шрифт проекта.'); }
      await installFont(data.customFontData);
    } else if (data.blocks.some(block => block.font === 'PuzzleCustom')) { throw new Error('В проекте отсутствует свой шрифт.'); }
    const combined = new Map([...googleFonts.values()].map(entry => [entry.group.family, entry.group]));
    importedGoogle.forEach(group => { combined.set(group.family, group); });
    validateGoogleFonts([...combined.values()]);
    for (const group of importedGoogle) { await installGoogle(group); }
    $('blockWidth').value = data.width; $('blockHeight').value = data.height; $('blockPadding').value = data.padding;
    blocks = data.blocks.map(block => ({...block})); selectBlock(0); settings();
  }
  syncGrid();
  return {syncGrid, render, settings, load, dispose: () => { disposed = true; googleRequests.forEach(controller => { controller.abort(); }); googleFonts.forEach(entry => { entry.faces.forEach(face => { document.fonts.delete(face); }); }); if (customFace) { document.fonts.delete(customFace); } }};
}
