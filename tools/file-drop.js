// Enhance shared upload fields without changing the tools' FileList/change contract.
const mimeExtensions = {
  'image/png': ['png'], 'image/jpeg': ['jpg', 'jpeg', 'jfif'], 'image/webp': ['webp'],
  'image/gif': ['gif'], 'image/bmp': ['bmp'], 'image/svg+xml': ['svg'],
  'image/x-icon': ['ico'], 'image/vnd.microsoft.icon': ['ico'], 'image/avif': ['avif'],
  'audio/wav': ['wav'], 'audio/mpeg': ['mp3'], 'audio/ogg': ['ogg', 'oga', 'opus'],
  'audio/flac': ['flac'], 'audio/mp4': ['m4a'], 'audio/aac': ['aac'], 'audio/webm': ['webm']
};
export function acceptsFile(file, accept) {
  const rules = accept.toLowerCase().split(',').map(rule => rule.trim()).filter(Boolean);
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  return !rules.length || rules.some(rule => {
    if (rule.startsWith('.')) { return name.endsWith(rule); }
    const extensionMatch = Object.entries(mimeExtensions).some(([type, extensions]) =>
      (type === rule || (rule.endsWith('/*') && type.startsWith(rule.slice(0, -1)))) &&
      extensions.some(extension => name.endsWith(`.${extension}`)));
    return extensionMatch || (rule.endsWith('/*') ? mime.startsWith(rule.slice(0, -1)) : mime === rule);
  });
}
export function selectDroppedFiles(files, accept, multiple) {
  const accepted = []; const rejected = [];
  for (const file of files) {
    (acceptsFile(file, accept) ? accepted : rejected).push(file);
  }
  return {files: multiple ? accepted : accepted.slice(0, 1), rejected, excess: !multiple && accepted.length > 1};
}
function sizeLabel(bytes) {
  return bytes < 1024 ? `${bytes} Б` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} КБ` : `${(bytes / 1048576).toFixed(1)} МБ`;
}
export function enhanceFileDrops(root = document) {
  for (const input of root.querySelectorAll('.drop input[type="file"]')) {
    if (input.dataset.dropReady) { continue; }
    input.dataset.dropReady = 'true';
    const zone = input.closest('.drop');
    const customTitle = [...zone.childNodes].filter(node => node.nodeType === 3)
      .map(node => node.textContent.trim()).join(' ').trim();
    zone.replaceChildren(input);
    zone.classList.add('file-drop');
    const content = document.createElement('span');
    content.className = 'file-drop-content';
    content.innerHTML = '<span class="file-drop-plus" aria-hidden="true">+</span><strong></strong><span class="file-drop-hint">или нажми, чтобы выбрать файлы</span><span class="file-drop-formats"></span>';
    const title = content.querySelector('strong');
    const formats = content.querySelector('.file-drop-formats');
    const hint = content.querySelector('.file-drop-hint');
    const list = document.createElement('span');
    list.className = 'file-drop-list'; list.setAttribute('aria-live', 'polite');
    const message = document.createElement('span');
    message.className = 'file-drop-message'; message.setAttribute('role', 'status');
    zone.append(content, list, message);
    const update = () => {
      title.textContent = customTitle && customTitle !== 'Выбери файлы' ? customTitle :
        input.multiple ? 'Перетащи сюда файлы' : 'Перетащи сюда файл';
      input.setAttribute('aria-label', title.textContent);
      hint.textContent = input.multiple ? 'или нажми, чтобы выбрать файлы' : 'или нажми, чтобы выбрать файл';
      const names = {'image/*':'Изображения', 'audio/*':'Аудио', 'image/x-icon':'ICO', 'image/vnd.microsoft.icon':'ICO'};
      formats.textContent = input.accept ? [...new Set(input.accept.split(',').map(value =>
        names[value.trim()] || value.trim().replace(/^\./, '').replace(/^image\//, '').toUpperCase()))].join(' · ') : 'Любые форматы';
      zone.classList.toggle('is-disabled', input.matches(':disabled'));
    };
    const render = () => {
      list.replaceChildren();
      if (input.files.length) {
        const count = document.createElement('strong');
        count.textContent = `Выбрано файлов: ${input.files.length}`; list.append(count);
        for (const file of [...input.files].slice(0, 20)) {
          const row = document.createElement('span');
          row.textContent = `${file.name} · ${sizeLabel(file.size)}`; list.append(row);
        }
        if (input.files.length > 20) {
          const rest = document.createElement('span');
          rest.textContent = `И ещё ${input.files.length - 20}`; list.append(rest);
        }
      }
    };
    let depth = 0;
    const resetDrag = () => { depth = 0; zone.classList.remove('is-dragover'); };
    const isFileDrag = event => [...(event.dataTransfer?.types || [])].includes('Files');
    zone.addEventListener('dragenter', event => {
      if (!isFileDrag(event)) { return; }
      event.preventDefault(); depth += 1;
      if (!input.matches(':disabled')) { zone.classList.add('is-dragover'); }
    });
    zone.addEventListener('dragover', event => {
      if (!isFileDrag(event)) { return; }
      event.preventDefault();
      event.dataTransfer.dropEffect = input.matches(':disabled') ? 'none' : 'copy';
    });
    zone.addEventListener('dragleave', event => {
      if (!isFileDrag(event)) { return; }
      depth = Math.max(0, depth - 1);
      if (!depth) { resetDrag(); }
    });
    zone.addEventListener('drop', event => {
      if (!isFileDrag(event)) { return; }
      event.preventDefault(); event.stopPropagation(); resetDrag();
      if (input.matches(':disabled')) { return; }
      const result = selectDroppedFiles(event.dataTransfer.files, input.accept, input.multiple);
      if (result.files.length) {
        try {
          const transfer = new DataTransfer();
          for (const file of result.files) { transfer.items.add(file); }
          input.files = transfer.files;
          input.dispatchEvent(new Event('change', {bubbles: true}));
        } catch (error) {
          message.textContent = 'Браузер не поддерживает перенос файлов. Нажми на область для выбора.';
          return;
        }
      }
      message.textContent = [result.rejected.length ? `Не подходят по формату: ${result.rejected.map(file => file.name).slice(0, 5).join(', ')}.` : '',
        result.excess ? 'Здесь можно выбрать один файл; взят первый подходящий.' : '',
        !event.dataTransfer.files.length ? 'Перетащи сами файлы, а не папку.' : ''].filter(Boolean).join(' ');
    });
    input.addEventListener('change', () => { message.textContent = ''; render(); });
    input.form?.addEventListener('reset', () => { queueMicrotask(render); });
    const attributes = new MutationObserver(update);
    attributes.observe(input, {attributes: true, attributeFilter: ['accept', 'multiple', 'disabled']});
    window.addEventListener('pagehide', () => { attributes.disconnect(); }, {once: true});
    update(); render();
  }
}
if (typeof document !== 'undefined') {
  const observer = new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 &&
      (node.matches?.('.drop') || node.querySelector?.('.drop input[type="file"]'))))) {
      enhanceFileDrops();
    }
  });
  observer.observe(document.documentElement, {childList: true, subtree: true});
  enhanceFileDrops();
  window.addEventListener('pagehide', () => { observer.disconnect(); }, {once: true});
}
