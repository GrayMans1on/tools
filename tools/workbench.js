window.addEventListener('hashchange', () => { location.reload(); });
import { tools } from '../catalog.js?v=20261101-v07';
import { esc } from './ui.js';
const id = location.hash.slice(1) === 'textfiles' ? '' : location.hash.slice(1);
const tool = tools.find(item => item.id === id);
const app = document.getElementById('app');
const modules = {
  strokes: 'effects', particles: 'effects', puzzles: 'puzzles', ciphers: 'ciphers',
  ascii: 'ascii', markdown: 'markdown', textlab: 'text', textcheck: 'text', unicode: 'symbols', symbols: 'symbols', emoji: 'symbols',
  fonts: 'fonts', stylize: 'stylize', spectrum: 'spectrum', timing: 'timing', board: 'board',
  palette: 'images', segments: 'images', icons: 'images',
  json: 'data', tables: 'data', layout: 'data',
  clocks: 'utilities', dates: 'utilities', random: 'utilities', prompter: 'utilities',
  converter: 'media', audio: 'media', animation: 'animation', qr: 'qr', devices: 'devices'
};
if (!tool || !modules[id]) {
  app.textContent = 'Инструмент не найден.';
} else {
  document.title = `${tool.name} — GrayMansion Tools`;
  app.innerHTML = `<h1>${esc(tool.name)}</h1><p class="description">${esc(tool.description)}</p><div id="content"></div><div id="status" class="status" role="status" aria-live="polite"></div>`;
  try {
    const module = await import(`./modules/${modules[id]}.js?v=20261101-v07`);
    await module[id](document.getElementById('content'));
  } catch (error) {
    document.getElementById('status').textContent = `Не удалось открыть инструмент: ${error.message}`;
  }
}
