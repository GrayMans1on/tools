import { $, select, field, files, action, status, download, toBlob, readImage, teardown, sleep } from "../ui.js";
import { num, readNumber, projectControls, bindProject, canvasPoint } from "../lab-ui.js?v=20261101-v09";
import { floodFill, pixelLine, clamp } from "../lab-core.js?v=20261101-v09";
const palettes = { retro: ["#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070", "#38b764", "#257179", "#29366f", "#3b5dc9", "#41a6f6", "#73eff7", "#f4f4f4", "#94b0c2", "#566c86", "#333c57"], gameboy: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"], mono: ["#18181c", "#ffffff"], cga: ["#000000", "#55ffff", "#ff55ff", "#ffffff"], sunset: ["#2b2448", "#553868", "#935179", "#c97879", "#eca878", "#ffe0a3"], ice: ["#132d46", "#22577a", "#38a3a5", "#80ed99", "#c7f9cc", "#f4ffff"], earth: ["#282a24", "#57563d", "#7b7851", "#a49a71", "#c7bb91", "#ebe0b9"], fire: ["#241726", "#6b253b", "#b43d39", "#e87135", "#f7b94b", "#fff1a8"], ocean: ["#101d3c", "#21416a", "#306e91", "#44a9b0", "#8bd3c7", "#e0f3db"], purple: ["#211b36", "#42305b", "#704b7d", "#aa73a4", "#dca9c8", "#f7dfe7"], pastel: ["#474a63", "#a7a6d3", "#d8b6d1", "#efc6b2", "#f0e5be", "#b9d7c4", "#b3d5e6", "#f5f3ed"], warmgray: ["#211e20", "#50494a", "#7e7470", "#afa299", "#d8ccbc", "#f3e8d6"] };
const pack = (h) => parseInt(h.slice(1), 16) * 256 + 255 >>> 0;
function imageData(pixels, n) {
  const im = new ImageData(n, n);
  for (let i = 0; i < pixels.length; i += 1) {
    const v = pixels[i];
    im.data[i * 4] = v >>> 24;
    im.data[i * 4 + 1] = v >>> 16 & 255;
    im.data[i * 4 + 2] = v >>> 8 & 255;
    im.data[i * 4 + 3] = v & 255;
  }
  return im;
}
async function pixelstudio(root) {
  root.innerHTML = `<section class="panel"><div class="row">${num("size", "Холст N × N", 32, 8, 128)}<button id="resize">Изменить холст</button>${select("tool", "Инструмент", [["pen", "Карандаш"], ["erase", "Ластик"], ["fill", "Заливка"], ["line", "Линия"], ["rect", "Прямоугольник"], ["ellipse", "Эллипс"], ["pick", "Пипетка"], ["select", "Выделение"], ["paste", "Вставить фрагмент"]])}${field("color", "Цвет", "color", "#a7f070")}${select("palette", "Палитра", Object.keys(palettes).map((k) => [k, k]))}<button id="applyPalette">Применить палитру</button><button id="addColor">+ Цвет</button></div><div id="swatches" class="chips"></div><div class="row"><label><input id="paletteLock" type="checkbox" checked> Только цвета палитры</label><label><input id="mirrorX" type="checkbox"> Симметрия X</label><label><input id="mirrorY" type="checkbox"> Симметрия Y</label><label><input id="grid" type="checkbox" checked> Сетка</label><label><input id="onion" type="checkbox"> Предыдущий кадр</label>${num("fps", "FPS", 8, 1, 30)}${num("exportScale", "Масштаб экспорта", 1, 1, 20)}</div><div class="actions"><button id="undo">Undo</button><button id="redo">Redo</button><button id="copy">Копировать область</button><button id="cut">Вырезать область</button><button id="clear">Очистить кадр</button><button id="quantize">Привести кадр к палитре</button></div><p class="muted">Размер меняется обрезкой / дополнением справа и снизу без размытия. Импорт вписывается в текущий квадрат методом nearest neighbour. Карандаш, линии и фигуры учитывают симметрию. Выделение копируется во внутренний буфер; затем выбери «Вставить фрагмент» и кликни место вставки.</p>${files("image", "image/png,image/jpeg,image/webp", false)}${projectControls()}</section><div class="two"><section class="panel"><canvas id="editor" width="640" height="640" class="lab-canvas pixel-canvas" aria-label="Пиксельный холст"></canvas></section><section class="panel"><h2>Анимация</h2><canvas id="preview" width="256" height="256" class="checker pixel-canvas"></canvas><div class="actions"><button id="play">Играть</button><button id="pause">Пауза</button><button id="addFrame">+ Пустой кадр</button><button id="duplicate">Дубликат кадра</button><button id="remove">Удалить кадр</button><button id="left">Кадр левее</button><button id="right">Кадр правее</button></div><div id="frames" class="chips"></div><div class="actions"><button id="png">PNG</button><button id="gif">GIF</button><button id="sheet">Sprite Sheet + JSON</button><button id="sequence">PNG sequence</button></div><p id="info" class="muted"></p></section></div>`;
  let n = 32, frames = [new Uint32Array(1024)], index = 0, palette = [...palettes.retro], selection = null, clipboard = null, drag = null, playing = false, frame, last = 0, disposed = false, history = [], cursor = -1;
  const c = $("editor"), ctx = c.getContext("2d"), pc = $("preview").getContext("2d"), scratch = document.createElement("canvas");
  const current = () => frames[index];
  function saveHistory() {
    const state = JSON.stringify({ n, index, palette, frames: frames.map((f) => Array.from(f)) });
    if (history[cursor] === state) {
      return;
    }
    history = history.slice(0, cursor + 1);
    history.push(state);
    while (history.length > 30 || history.reduce((n2, s) => n2 + s.length, 0) > 2e7 && history.length > 1) {
      history.shift();
    }
    cursor = history.length - 1;
  }
  function restoreHistory(offset) {
    const next = cursor + offset;
    if (next < 0 || next >= history.length) {
      return;
    }
    const state = JSON.parse(history[next]);
    cursor = next;
    n = state.n;
    frames = state.frames.map((f) => Uint32Array.from(f));
    index = state.index;
    palette = state.palette;
    $("size").value = n;
    selection = null;
    swatches();
    frameButtons();
    draw();
  }
  function swatches() {
    $("swatches").replaceChildren();
    palette.forEach((color) => {
      const b = document.createElement("button");
      b.type = "button";
      b.style.background = color;
      b.style.width = "30px";
      b.style.height = "30px";
      b.style.padding = "0";
      b.title = color;
      b.setAttribute("aria-label", `Цвет ${color}`);
      b.addEventListener("click", () => {
        $("color").value = color;
      });
      $("swatches").append(b);
    });
  }
  function renderPixels(data, scale2 = 1) {
    scratch.width = n;
    scratch.height = n;
    scratch.getContext("2d").putImageData(imageData(data, n), 0, 0);
    const out = document.createElement("canvas");
    out.width = n * scale2;
    out.height = n * scale2;
    const oc = out.getContext("2d");
    oc.imageSmoothingEnabled = false;
    oc.drawImage(scratch, 0, 0, out.width, out.height);
    return out;
  }
  function draw() {
    ctx.fillStyle = "#f0f2f7";
    ctx.fillRect(0, 0, 640, 640);
    const cell = 640 / n;
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        ctx.fillStyle = (x + y) % 2 ? "#e0e5ee" : "#f4f6fa";
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    ctx.imageSmoothingEnabled = false;
    if ($("onion").checked && index > 0) {
      ctx.globalAlpha = 0.25;
      ctx.drawImage(renderPixels(frames[index - 1]), 0, 0, 640, 640);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(renderPixels(current()), 0, 0, 640, 640);
    if ($("grid").checked && n <= 64) {
      ctx.strokeStyle = "#8d9bb044";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= n; i += 1) {
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, 640);
        ctx.moveTo(0, i * cell);
        ctx.lineTo(640, i * cell);
      }
      ctx.stroke();
    }
    if (selection) {
      ctx.strokeStyle = "#31ad70";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 4]);
      ctx.strokeRect(selection.x * cell, selection.y * cell, selection.w * cell, selection.h * cell);
      ctx.setLineDash([]);
    }
    pc.clearRect(0, 0, 256, 256);
    pc.imageSmoothingEnabled = false;
    pc.drawImage(renderPixels(current()), 0, 0, 256, 256);
    $("info").textContent = `${n} × ${n} · Кадр ${index + 1}/${frames.length} · ${palette.length} цветов палитры`;
  }
  function frameButtons() {
    $("frames").replaceChildren();
    frames.forEach((f, i) => {
      const b = document.createElement("button");
      b.textContent = String(i + 1);
      b.className = i === index ? "primary" : "";
      b.addEventListener("click", () => {
        playing = false;
        index = i;
        selection = null;
        frameButtons();
        draw();
      });
      $("frames").append(b);
    });
  }
  function nearest(value) {
    if (!(value & 255) || !$("paletteLock").checked) { return value; }
    const input = [value >>> 24, value >>> 16 & 255, value >>> 8 & 255];
    let best = pack(palette[0]), distance = Infinity;
    for (const color of palette.map(pack)) {
      const candidate = [color >>> 24, color >>> 16 & 255, color >>> 8 & 255];
      const next = candidate.reduce((sum, channel, i) => sum + (channel - input[i]) ** 2, 0);
      if (next < distance) { best = color; distance = next; }
    }
    return best;
  }
  function put(x, y, value) {
    value = nearest(value);
    if (x < 0 || y < 0 || x >= n || y >= n) {
      return;
    }
    const xs = $("mirrorX").checked ? [x, n - 1 - x] : [x], ys = $("mirrorY").checked ? [y, n - 1 - y] : [y];
    for (const xx of xs) {
      for (const yy of ys) {
        current()[yy * n + xx] = value;
      }
    }
  }
  function point(e) {
    const p = canvasPoint(c, e);
    return { x: clamp(Math.floor(p.x / 640 * n), 0, n - 1), y: clamp(Math.floor(p.y / 640 * n), 0, n - 1) };
  }
  function shape(a, b, kind, value) {
    if (kind === "line") {
      pixelLine(a.x, a.y, b.x, b.y, (x, y) => put(x, y, value));
    } else if (kind === "rect") {
      for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x += 1) {
        put(x, a.y, value);
        put(x, b.y, value);
      }
      for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y += 1) {
        put(a.x, y, value);
        put(b.x, y, value);
      }
    } else {
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, rx = Math.abs(a.x - b.x) / 2, ry = Math.abs(a.y - b.y) / 2;
      for (let i = 0; i < Math.max(24, n * 8); i += 1) {
        const t = i / Math.max(24, n * 8) * Math.PI * 2;
        put(Math.round(cx + Math.cos(t) * rx), Math.round(cy + Math.sin(t) * ry), value);
      }
    }
  }
  c.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    playing = false;
    const p = point(e), tool = $("tool").value, color = tool === "erase" ? 0 : nearest(pack($("color").value));
    if (tool === "pick") {
      const v = current()[p.y * n + p.x];
      if (v & 255) {
        $("color").value = "#" + (v >>> 8).toString(16).padStart(6, "0");
      }
      return;
    }
    if (tool === "fill") {
      const xs = $("mirrorX").checked ? [p.x, n - 1 - p.x] : [p.x], ys = $("mirrorY").checked ? [p.y, n - 1 - p.y] : [p.y];
      for (const x of xs) {
        for (const y of ys) {
          floodFill(current(), n, x, y, color);
        }
      }
      saveHistory();
      draw();
      return;
    }
    if (tool === "paste") {
      if (clipboard) {
        for (let y = 0; y < clipboard.h; y += 1) {
          for (let x = 0; x < clipboard.w; x += 1) {
            const v = clipboard.pixels[y * clipboard.w + x];
            if (v & 255) {
              put(p.x + x, p.y + y, v);
            }
          }
        }
        saveHistory();
        draw();
      }
      return;
    }
    drag = { start: p, previous: p, tool, color, before: current().slice() };
    if (["pen", "erase"].includes(tool)) {
      put(p.x, p.y, color);
    }
    if (tool === "select") {
      selection = { x: p.x, y: p.y, w: 1, h: 1 };
    }
    c.setPointerCapture(e.pointerId);
    draw();
  });
  c.addEventListener("pointermove", (e) => {
    if (!drag) {
      return;
    }
    const p = point(e);
    if (["pen", "erase"].includes(drag.tool)) {
      pixelLine(drag.previous.x, drag.previous.y, p.x, p.y, (x, y) => put(x, y, drag.color));
    } else if (drag.tool === "select") {
      selection = { x: Math.min(p.x, drag.start.x), y: Math.min(p.y, drag.start.y), w: Math.abs(p.x - drag.start.x) + 1, h: Math.abs(p.y - drag.start.y) + 1 };
    } else {
      frames[index] = drag.before.slice();
      shape(drag.start, p, drag.tool, drag.color);
    }
    drag.previous = p;
    draw();
  });
  const up = () => {
    if (drag) {
      drag = null;
      saveHistory();
      draw();
    }
  };
  c.addEventListener("pointerup", up);
  c.addEventListener("pointercancel", up);
  action("undo", () => restoreHistory(-1));
  action("redo", () => restoreHistory(1));
  for (const id of ["grid", "onion"]) {
    $(id).addEventListener("change", draw);
  }
  action("applyPalette", () => {
    palette = [...palettes[$("palette").value]];
    swatches();
    saveHistory();
  });
  action("addColor", () => {
    if (palette.length >= 64) {
      throw new Error("До 64 цветов.");
    }
    if (!palette.includes($("color").value)) {
      palette.push($("color").value);
    }
    swatches();
    saveHistory();
  });
  function copy(cut = false) {
    const s = selection || { x: 0, y: 0, w: n, h: n };
    clipboard = { w: s.w, h: s.h, pixels: new Uint32Array(s.w * s.h) };
    for (let y = 0; y < s.h; y += 1) {
      for (let x = 0; x < s.w; x += 1) {
        clipboard.pixels[y * s.w + x] = current()[(y + s.y) * n + x + s.x];
        if (cut) {
          current()[(y + s.y) * n + x + s.x] = 0;
        }
      }
    }
    if (cut) {
      saveHistory();
      draw();
    }
    status("Область во внутреннем буфере. Выбери «Вставить фрагмент».");
  }
  action("copy", () => copy());
  action("cut", () => copy(true));
  action("clear", () => {
    current().fill(0);
    saveHistory();
    draw();
  });
  action("quantize", () => {
    const colors = palette.map(pack);
    for (let i = 0; i < current().length; i += 1) {
      const v = current()[i];
      if (!(v & 255)) {
        continue;
      }
      const channel = [v >>> 24, v >>> 16 & 255, v >>> 8 & 255];
      let best = colors[0], distance = Infinity;
      for (const c2 of colors) {
        const next = [c2 >>> 24, c2 >>> 16 & 255, c2 >>> 8 & 255];
        const d = next.reduce((s, c3, j) => s + (c3 - channel[j]) ** 2, 0);
        if (d < distance) {
          distance = d;
          best = c2;
        }
      }
      current()[i] = best;
    }
    saveHistory();
    draw();
  });
  action("resize", () => {
    const next = readNumber("size", 8, 128);
    if (!Number.isInteger(next)) {
      throw new Error("Целый размер.");
    }
    frames = frames.map((old) => {
      const out = new Uint32Array(next * next);
      for (let y = 0; y < Math.min(n, next); y += 1) {
        for (let x = 0; x < Math.min(n, next); x += 1) {
          out[y * next + x] = old[y * n + x];
        }
      }
      return out;
    });
    n = next;
    selection = null;
    saveHistory();
    draw();
  });
  action("addFrame", () => {
    if (frames.length >= 48) {
      throw new Error("До 48 кадров.");
    }
    frames.splice(index + 1, 0, new Uint32Array(n * n));
    index += 1;
    saveHistory();
    frameButtons();
    draw();
  });
  action("duplicate", () => {
    if (frames.length >= 48) {
      throw new Error("До 48 кадров.");
    }
    frames.splice(index + 1, 0, current().slice());
    index += 1;
    saveHistory();
    frameButtons();
    draw();
  });
  action("remove", () => {
    if (frames.length === 1) {
      throw new Error("Нужен один кадр.");
    }
    frames.splice(index, 1);
    index = Math.min(index, frames.length - 1);
    saveHistory();
    frameButtons();
    draw();
  });
  for (const [id, delta] of [["left", -1], ["right", 1]]) {
    action(id, () => {
      const next = index + delta;
      if (next < 0 || next >= frames.length) {
        return;
      }
      [frames[index], frames[next]] = [frames[next], frames[index]];
      index = next;
      saveHistory();
      frameButtons();
      draw();
    });
  }
  $("image").addEventListener("change", async () => {
    try {
      const file = $("image").files[0];
      if (!file) {
        return;
      }
      if (file.size > 2e7) {
        throw new Error("Изображение до 20 МБ.");
      }
      const im = await readImage(file), pad = document.createElement("canvas");
      pad.width = n;
      pad.height = n;
      const p = pad.getContext("2d");
      p.imageSmoothingEnabled = false;
      const scale2 = Math.min(n / im.width, n / im.height), w = Math.max(1, Math.round(im.width * scale2)), h = Math.max(1, Math.round(im.height * scale2));
      p.drawImage(im, Math.floor((n - w) / 2), Math.floor((n - h) / 2), w, h);
      im.close();
      const data = p.getImageData(0, 0, n, n).data;
      frames[index] = Uint32Array.from({ length: n * n }, (_, i) => data[i * 4] * 16777216 + data[i * 4 + 1] * 65536 + data[i * 4 + 2] * 256 + data[i * 4 + 3] >>> 0);
      saveHistory();
      draw();
    } catch (e) {
      status(e.message, true);
    }
  });
  const scale = () => {
    const s = readNumber("exportScale", 1, 20);
    if (!Number.isInteger(s)) {
      throw new Error("Масштаб — целый.");
    }
    return s;
  };
  action("png", async () => download(await toBlob(renderPixels(current(), scale())), "pixel-frame.png"));
  action("sequence", async () => {
    const { JSZip } = await import("../vendor/vendor.js"), zip = new JSZip(), s = scale();
    for (let i = 0; i < frames.length; i += 1) {
      zip.file(`frame_${String(i).padStart(3, "0")}.png`, await toBlob(renderPixels(frames[i], s)));
    }
    zip.file("animation.json", JSON.stringify({ fps: readNumber("fps", 1, 30), width: n * s, height: n * s, frames: frames.length }));
    download(await zip.generateAsync({ type: "blob" }), "pixel-sequence.zip");
  });
  action("sheet", async () => {
    const { JSZip } = await import("../vendor/vendor.js"), zip = new JSZip(), s = scale(), cols = Math.min(8, Math.ceil(Math.sqrt(frames.length))), sheet = document.createElement("canvas");
    sheet.width = cols * n * s;
    sheet.height = Math.ceil(frames.length / cols) * n * s;
    if (sheet.width * sheet.height > 4e7) {
      throw new Error("Атлас до 40 млн пикселей: уменьши масштаб.");
    }
    const p = sheet.getContext("2d");
    p.imageSmoothingEnabled = false;
    const meta = [];
    for (let i = 0; i < frames.length; i += 1) {
      const x = i % cols * n * s, y = Math.floor(i / cols) * n * s;
      p.drawImage(renderPixels(frames[i], s), x, y);
      meta.push({ index: i, x, y, width: n * s, height: n * s });
    }
    zip.file("sprites.png", await toBlob(sheet));
    zip.file("sprites.json", JSON.stringify({ fps: readNumber("fps", 1, 30), frames: meta }, null, 2));
    download(await zip.generateAsync({ type: "blob" }), "pixel-spritesheet.zip");
  });
  action("gif", async () => {
    const { GIFEncoder, quantize, applyPalette } = await import("../vendor/vendor.js"), gif = GIFEncoder(), s = scale(), fps = readNumber("fps", 1, 30);
    if (frames.length * n * n * s * s > 12e7) {
      throw new Error("GIF до 120 млн пикселей суммарно: уменьши масштаб.");
    }
    for (let i = 0; i < frames.length; i += 1) {
      const pad = renderPixels(frames[i], s), data = pad.getContext("2d").getImageData(0, 0, pad.width, pad.height).data, palette2 = quantize(data, 128, { format: "rgba4444" }), indices = applyPalette(data, palette2, "rgba4444"), alpha = palette2.findIndex((c2) => c2[3] === 0);
      gif.writeFrame(indices, pad.width, pad.height, { palette: palette2, delay: Math.max(10, (Math.round((i + 1) * 100 / fps) - Math.round(i * 100 / fps)) * 10), transparent: alpha >= 0, transparentIndex: Math.max(0, alpha), dispose: 2, repeat: 0 });
      await sleep();
    }
    gif.finish();
    download(new Blob([gif.bytes()], { type: "image/gif" }), "pixel-animation.gif");
  });
  bindProject("GM Pixel Studio", () => ({ size: n, frames: frames.map((f) => Array.from(f)), palette, fps: readNumber("fps", 1, 30) }), (p) => {
    if (!Number.isInteger(p.size) || p.size < 8 || p.size > 128 || !Array.isArray(p.frames) || !p.frames.length || p.frames.length > 48 || p.frames.some((f) => !Array.isArray(f) || f.length !== p.size * p.size || f.some((v) => !Number.isInteger(v) || v < 0 || v > 4294967295)) || !Array.isArray(p.palette) || !p.palette.length || p.palette.length > 64 || p.palette.some((c2) => !/^#[0-9a-f]{6}$/i.test(c2)) || !Number.isFinite(p.fps) || p.fps < 1 || p.fps > 30) {
      throw new Error("Повреждённый пиксельный проект.");
    }
    playing = false;
    n = p.size;
    frames = p.frames.map((f) => Uint32Array.from(f));
    palette = p.palette;
    index = 0;
    selection = null;
    $("size").value = n;
    $("fps").value = p.fps;
    saveHistory();
    swatches();
    frameButtons();
    draw();
  });
  action("play", () => {
    readNumber("fps", 1, 30);
    playing = true;
  });
  action("pause", () => {
    playing = false;
  });
  function tick(t) {
    if (disposed) {
      return;
    }
    if (playing && t - last > 1e3 / Number($("fps").value)) {
      index = (index + 1) % frames.length;
      draw();
      last = t;
    }
    frame = requestAnimationFrame(tick);
  }
  const keyboard = (e) => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      restoreHistory(e.shiftKey ? 1 : -1);
    }
    const tools = { b: "pen", e: "erase", g: "fill", i: "pick", l: "line", r: "rect" };
    if (tools[e.key]) {
      $("tool").value = tools[e.key];
    }
  };
  document.addEventListener("keydown", keyboard);
  teardown(() => {
    disposed = true;
    cancelAnimationFrame(frame);
    document.removeEventListener("keydown", keyboard);
  });
  for (let y = 8; y < 24; y += 1) {
    for (let x = 8; x < 24; x += 1) {
      if ((x - 16) ** 2 + (y - 16) ** 2 < 65) {
        frames[0][y * n + x] = pack("#38b764");
      }
    }
  }
  for (const x of [12, 19]) {
    frames[0][13 * n + x] = pack("#f4f4f4");
    frames[0][14 * n + x] = pack("#1a1c2c");
  }
  saveHistory();
  swatches();
  frameButtons();
  draw();
  frame = requestAnimationFrame(tick);
}
export {
  pixelstudio
};
