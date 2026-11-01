// This function is intentionally self-contained for offline HTML game exports.
export function puzzleGame(host, config) {
  const image = new Image(); const c = host.querySelector('canvas'); const ctx = c.getContext('2d'); const info = host.querySelector('[data-info]');
  const n = config.grid; const mode = config.mode; const board = {x: 40, y: 35, w: 720, h: 450}; const tw = board.w / n; const th = board.h / n;
  c.width = 800; c.height = mode === 'jigsaw' ? 760 : 520; c.tabIndex = 0; c.style.touchAction = 'none';
  c.setAttribute('aria-label', mode === 'sliding' ? 'Пятнашки. Стрелки перемещают пустую клетку.' : 'Головоломка. Стрелки выбирают клетку, Enter выбирает и меняет местами фрагменты.');
  let tiles = []; let pieces = []; let selected = -1; let focus = 0; let moves = 0; let started = 0; let finished = false; let drag; let timer; let disposed = false;
  const hash = value => { let h = 2166136261; for (const char of String(value)) { h = Math.imul(h ^ char.codePointAt(0), 16777619); } return h; };
  let state = hash(config.seed);
  function random() { state += 0x6D2B79F5; let t = Math.imul(state ^ state >>> 15, state | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function shuffle(items) { for (let i = items.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } }
  const path = p => {
    const out = new Path2D(); out.moveTo(0, 0);
    function edge(x, y, dx, dy, sign) {
      const nx = dy / Math.hypot(dx, dy); const ny = -dx / Math.hypot(dx, dy); const bump = Math.min(tw, th) * .19 * sign;
      const point = (t, v) => [x + dx * t + nx * bump * v, y + dy * t + ny * bump * v];
      out.lineTo(...point(.35, 0));
      if (sign) { out.bezierCurveTo(...point(.47, 0), ...point(.32, 1), ...point(.5, 1)); out.bezierCurveTo(...point(.68, 1), ...point(.53, 0), ...point(.65, 0)); }
      out.lineTo(x + dx, y + dy);
    }
    edge(0, 0, tw, 0, p.edges[0]); edge(tw, 0, 0, th, p.edges[1]); edge(tw, th, -tw, 0, p.edges[2]); edge(0, th, 0, -th, p.edges[3]); out.closePath(); return out;
  };
  function reset() {
    state = hash(config.seed); tiles = Array.from({length: n * n}, (_, i) => i); selected = -1; moves = 0; started = Date.now(); finished = false;
    if (mode === 'sliding') {
      let empty = tiles.length - 1; let previous = -1;
      // Scramble through legal moves: every generated sliding puzzle is solvable.
      for (let i = 0; i < n * n * 35; i += 1) {
        const options = [empty - n, empty + n, empty % n ? empty - 1 : -1, empty % n < n - 1 ? empty + 1 : -1].filter(v => v >= 0 && v < tiles.length && v !== previous);
        const next = options[Math.floor(random() * options.length)]; [tiles[empty], tiles[next]] = [tiles[next], tiles[empty]]; previous = empty; empty = next;
      }
      if (tiles.every((v, i) => v === i)) { const next = empty % n ? empty - 1 : empty + 1; [tiles[empty], tiles[next]] = [tiles[next], tiles[empty]]; }
    } else if (mode === 'swap') { shuffle(tiles); if (tiles.every((v, i) => v === i)) { [tiles[0], tiles[1]] = [tiles[1], tiles[0]]; } }
    else {
      const signs = Array.from({length: n * n * 2}, () => random() < .5 ? -1 : 1);
      pieces = tiles.map(id => { const row = Math.floor(id / n); const col = id % n; const p = {id, x: 30 + random() * (720 - tw), y: 530 + random() * Math.max(1, 190 - th), fixed: false, edges: [row ? -signs[(id - n) * 2] : 0, col < n - 1 ? signs[id * 2 + 1] : 0, row < n - 1 ? signs[id * 2] : 0, col ? -signs[(id - 1) * 2 + 1] : 0]}; p.path = path(p); return p; }); shuffle(pieces);
    }
    draw(); announce();
  }
  function announce() {
    const elapsed = Math.floor((Date.now() - started) / 1000); const correct = mode === 'jigsaw' ? pieces.filter(p => p.fixed).length : tiles.filter((v, i) => v === i).length;
    info.textContent = `${finished ? 'Собрано! ' : ''}${moves} ходов · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')} · На месте ${correct}/${n * n}${selected >= 0 ? ' · Выбери второй фрагмент' : ''}`;
  }
  function tile(id, x, y, w, h) { ctx.drawImage(image, id % n * image.width / n, Math.floor(id / n) * image.height / n, image.width / n, image.height / n, x, y, w, h); }
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height); ctx.fillStyle = '#f0f3f9'; ctx.fillRect(0, 0, c.width, c.height); ctx.fillStyle = '#dce2ed'; ctx.fillRect(board.x, board.y, board.w, board.h);
    if (mode === 'jigsaw') {
      if (host.querySelector('[data-hint]').checked) { ctx.globalAlpha = .25; ctx.drawImage(image, board.x, board.y, board.w, board.h); ctx.globalAlpha = 1; }
      ctx.fillStyle = '#8993a9'; ctx.font = '14px sans-serif'; ctx.fillText('Перетащи фрагменты на картинку — правильные примагнитятся', 40, 515);
      for (const p of [...pieces.filter(p => p.fixed), ...pieces.filter(p => !p.fixed)]) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.shadowColor = '#27334955'; ctx.shadowBlur = p.fixed ? 0 : 5; ctx.fillStyle = 'white'; ctx.fill(p.path); ctx.shadowBlur = 0; ctx.clip(p.path); ctx.drawImage(image, -p.id % n * tw, -Math.floor(p.id / n) * th, board.w, board.h); ctx.restore();
        ctx.save(); ctx.translate(p.x, p.y); ctx.strokeStyle = p.fixed ? '#ffffff66' : '#47546e'; ctx.lineWidth = 1; ctx.stroke(p.path); ctx.restore();
      }
    } else {
      for (let i = 0; i < tiles.length; i += 1) {
        const x = board.x + i % n * tw; const y = board.y + Math.floor(i / n) * th; const id = tiles[i];
        if (!(mode === 'sliding' && id === tiles.length - 1 && !finished)) { tile(id, x + 1, y + 1, tw - 2, th - 2); }
        if (host.querySelector('[data-numbers]').checked) { ctx.fillStyle = '#18223dbb'; ctx.fillRect(x + 4, y + 4, 30, 23); ctx.fillStyle = 'white'; ctx.font = '15px sans-serif'; ctx.fillText(String(id + 1), x + 9, y + 21); }
        if (i === selected || i === focus) { ctx.strokeStyle = i === selected ? '#38b76b' : '#8798ca'; ctx.lineWidth = i === selected ? 5 : 2; ctx.strokeRect(x + 3, y + 3, tw - 6, th - 6); }
      }
      if (host.querySelector('[data-hint]').checked) { ctx.globalAlpha = .85; ctx.drawImage(image, board.x, board.y, board.w, board.h); ctx.globalAlpha = 1; }
    }
  }
  function complete() {
    finished = mode === 'jigsaw' ? pieces.every(p => p.fixed) : tiles.every((v, i) => v === i); draw(); announce();
  }
  function choose(index) {
    if (finished || mode === 'jigsaw' || index < 0 || index >= tiles.length) { return; }
    focus = index;
    if (mode === 'sliding') { const empty = tiles.indexOf(tiles.length - 1); if (Math.abs(Math.floor(empty / n) - Math.floor(index / n)) + Math.abs(empty % n - index % n) !== 1) { return; } [tiles[empty], tiles[index]] = [tiles[index], tiles[empty]]; moves += 1; }
    else if (selected < 0) { selected = index; } else { if (index !== selected) { [tiles[index], tiles[selected]] = [tiles[selected], tiles[index]]; moves += 1; } selected = -1; }
    complete();
  }
  function coordinates(e) { const r = c.getBoundingClientRect(); return {x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height}; }
  function down(e) {
    if (disposed || !image.complete || finished) { return; } e.preventDefault(); const pos = coordinates(e); c.focus({preventScroll: true});
    if (mode === 'jigsaw') {
      const p = [...pieces].reverse().find(v => !v.fixed && ctx.isPointInPath(v.path, pos.x - v.x, pos.y - v.y));
      if (p) { pieces.splice(pieces.indexOf(p), 1); pieces.push(p); drag = {p, dx: pos.x - p.x, dy: pos.y - p.y}; c.setPointerCapture(e.pointerId); }
    } else if (pos.x >= board.x && pos.x < board.x + board.w && pos.y >= board.y && pos.y < board.y + board.h) { choose(Math.floor((pos.x - board.x) / tw) + Math.floor((pos.y - board.y) / th) * n); }
  }
  function move(e) { if (!drag) { return; } const pos = coordinates(e); drag.p.x = Math.max(0, Math.min(c.width - tw, pos.x - drag.dx)); drag.p.y = Math.max(0, Math.min(c.height - th, pos.y - drag.dy)); draw(); }
  function up() { if (!drag) { return; } const p = drag.p; const tx = board.x + p.id % n * tw; const ty = board.y + Math.floor(p.id / n) * th; if (Math.hypot(p.x - tx, p.y - ty) < Math.min(tw, th) * .3) { p.x = tx; p.y = ty; p.fixed = true; } moves += 1; drag = null; complete(); }
  function key(e) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(e.key) || mode === 'jigsaw') { return; } e.preventDefault();
    const delta = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -n, ArrowDown: n}[e.key];
    if (mode === 'sliding' && delta) { const empty = tiles.indexOf(tiles.length - 1); choose(empty + delta); }
    else if (delta) { focus = Math.max(0, Math.min(tiles.length - 1, focus + delta)); draw(); } else { choose(focus); }
  }
  const resetButton = host.querySelector('[data-reset]'); const hint = host.querySelector('[data-hint]'); const numbers = host.querySelector('[data-numbers]');
  resetButton.addEventListener('click', reset); hint.addEventListener('change', draw); numbers.addEventListener('change', draw);
  c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up); c.addEventListener('keydown', key);
  image.onload = () => { if (!disposed) { reset(); timer = setInterval(() => { if (!finished && !disposed) { announce(); } }, 1000); } };
  image.onerror = () => { info.textContent = 'Не удалось открыть изображение.'; }; image.src = config.image;
  return () => { disposed = true; clearInterval(timer); image.onload = null; image.onerror = null; resetButton.removeEventListener('click', reset); hint.removeEventListener('change', draw); numbers.removeEventListener('change', draw); c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); c.removeEventListener('keydown', key); };
}
export function puzzleMarkup() { return '<div class="actions"><button data-reset>Начать заново</button><label><input type="checkbox" data-hint> Подсказка-картинка</label><label><input type="checkbox" data-numbers> Номера</label></div><p data-info role="status" aria-live="polite"></p><canvas id="puzzleCanvas"></canvas>'; }
