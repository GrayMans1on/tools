'use strict';

const homeView = document.getElementById('home-view');
const toolView = document.getElementById('tool-view');
const frame = document.getElementById('tool-frame');
const breadcrumb = document.getElementById('breadcrumb');
let resizeObserver;

function resizeTool() {
  const content = frame.contentDocument;
  if (content && content.body) {
    frame.style.height = `${Math.ceil(content.body.getBoundingClientRect().height) + 4}px`;
  }
}

frame.addEventListener('load', () => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  if (frame.contentDocument && frame.contentDocument.body) {
    resizeObserver = new ResizeObserver(resizeTool);
    resizeObserver.observe(frame.contentDocument.body);
    resizeTool();
  }
});

function showPage() {
  const isTool = window.location.hash === '#pixel-nearest';
  const page = isTool ? 'pixel-nearest' : 'home';
  homeView.hidden = isTool;
  toolView.hidden = !isTool;
  breadcrumb.textContent = isTool ? 'Pixel Nearest' : 'Главная';
  document.title = `${breadcrumb.textContent} — GrayMansion Tools`;
  for (const link of document.querySelectorAll('[data-page]')) {
    const active = link.dataset.page === page;
    link.classList.toggle('active', active);
    if (active) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }
  if (isTool && !frame.getAttribute('src')) {
    frame.src = frame.dataset.src;
  }
  if (isTool) {
    requestAnimationFrame(resizeTool);
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => {
  showPage();
  document.getElementById('main').focus({ preventScroll: true });
});
window.addEventListener('resize', resizeTool);
showPage();
