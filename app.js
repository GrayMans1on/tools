import { tools } from './catalog.js?v=20261031-v06';
import { cardIllustration } from './illustrations.js?v=20261031-v06';

const homeView = document.getElementById('home-view');
const toolView = document.getElementById('tool-view');
const frame = document.getElementById('tool-frame');
const breadcrumb = document.getElementById('breadcrumb');
const grid = document.querySelector('.tool-grid');
const originalArt = document.querySelector('.card-art').outerHTML;
const nav = document.querySelector('nav');
let resizeObserver;
let currentTool = '';

for (const link of nav.querySelectorAll('[data-page]:not([data-page="home"])')) {
  link.remove();
}
nav.querySelector('.nav-count').textContent = tools.length;
for (const tool of tools) {
  const link = document.createElement('a');
  link.className = 'nav-item';
  link.href = `#${tool.id}`;
  link.dataset.page = tool.id;
  const name = document.createElement('span');
  name.textContent = tool.name;
  link.append(name);
  nav.append(link);
}
document.querySelector('h2 > span').textContent = String(tools.length).padStart(2, '0');
const searchbar = document.createElement('div');
searchbar.className = 'catalog-search';
searchbar.innerHTML = '<label for="tool-search">Поиск инструментов</label><input id="tool-search" type="search" placeholder="Название или задача…"><select id="category" aria-label="Категория"><option value="">Все категории</option></select>';
document.querySelector('.section-heading').after(searchbar);
for (const category of new Set(tools.map(tool => tool.category))) {
  document.getElementById('category').add(new Option(category, category));
}
function renderCatalog() {
  const query = document.getElementById('tool-search').value.toLowerCase().trim();
  const category = document.getElementById('category').value;
  grid.replaceChildren();
  const found = tools.filter(tool => (!category || tool.category === category) &&
    `${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(query));
  for (const tool of found) {
    const card = document.createElement('a');
    card.className = 'tool-card';
    card.href = `#${tool.id}`;
    card.innerHTML = tool.id === 'pixel-nearest' ? originalArt :
      `<div class="card-art tool-illustration" aria-hidden="true">${cardIllustration(tool.id)}</div>`;
    const content = document.createElement('div');
    content.className = 'card-content';
    const categoryLabel = document.createElement('div');
    categoryLabel.className = 'card-category';
    categoryLabel.textContent = tool.category.toUpperCase();
    const status = document.createElement('span');
    status.className = 'available';
    status.innerHTML = '<i></i> Доступен';
    categoryLabel.append(status);
    const heading = document.createElement('h3');
    heading.textContent = tool.name;
    const description = document.createElement('p');
    description.textContent = tool.description;
    content.append(categoryLabel, heading, description);
    card.append(content);
    grid.append(card);
  }
  if (!found.length) {
    grid.textContent = 'Ничего не найдено.';
  }
}
document.getElementById('tool-search').addEventListener('input', renderCatalog);
document.getElementById('category').addEventListener('change', renderCatalog);
renderCatalog();

function resizeTool() {
  const content = frame.contentDocument;
  if (content && content.body && !toolView.hidden) {
    frame.style.height = `${Math.ceil(content.body.getBoundingClientRect().height) + 8}px`;
  }
}
frame.addEventListener('load', () => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  if (frame.contentDocument?.body) {
    resizeObserver = new ResizeObserver(resizeTool);
    resizeObserver.observe(frame.contentDocument.body);
    resizeTool();
  }
});
function showPage() {
  const id = location.hash.slice(1);
  if (id === 'main') {
    return;
  }
  const tool = tools.find(item => item.id === id);
  homeView.hidden = Boolean(tool);
  toolView.hidden = !tool;
  breadcrumb.textContent = tool ? tool.name : 'Главная';
  document.title = `${breadcrumb.textContent} — GrayMansion Tools`;
  for (const link of document.querySelectorAll('[data-page]')) {
    const active = link.dataset.page === (tool ? tool.id : 'home');
    link.classList.toggle('active', active);
    if (active) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }
  if (tool && currentTool !== tool.id) {
    frame.title = tool.name;
    toolView.setAttribute('aria-label', tool.name);
    frame.src = tool.id === 'pixel-nearest' ? 'tools/pixel-nearest.html?v=20261031-v06' : `tools/workbench.html?v=20261031-v06&tool=${tool.id}#${tool.id}`;
    document.querySelector('.tool-topline > span').textContent = tool.category.toUpperCase();
    currentTool = tool.id;
  }
  if (!tool && currentTool) {
    frame.src = 'about:blank';
    currentTool = '';
  }
  requestAnimationFrame(resizeTool);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => {
  showPage();
  document.getElementById('main').focus({preventScroll: true});
});
window.addEventListener('resize', resizeTool);
showPage();
