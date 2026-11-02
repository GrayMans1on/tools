import {
  $,
  field,
  select,
  action,
  download,
  status,
  toBlob,
  files,
  teardown,
  canvasPoint,
  num,
  projectControls,
  bindProject,
  saveText,
  stage,
  bindImage,
  imageDataURL,
  localImage
} from "../studio-ui.js?v=20261102-v11";
import { esc } from "../ui.js";
import { clamp, validateItems } from "../studio-core.js?v=20261102-v11";
async function mockup(root) {
  root.innerHTML = `<section class="panel"><div class="row">${select(
    "preset",
    "Компоновка",
    [
      "RPG · HUD",
      "Платформер",
      "Инвентарь",
      "Главное меню",
      "Диалог",
      "Стратегия"
    ]
  )}<button id="apply">Загрузить</button>${num("width", "Ширина холста", 960, 320, 2560)}${num("hei\
ght", "Высота холста", 600, 200, 1440)}${num(
    "snap",
    "Шаг сетки, 0 = выкл.",
    8,
    0,
    64
  )}${field("backgroundColor", "Фон", "color", "#273344")}</div><div class="two"><div><label>Изображение фона</label>${files(
  "background", "image/png,image/jpeg,image/webp", false)}</div><div><label>Добавить свою картинку</label>${files(
    "image",
    "image/png,image/jpeg,image/webp",
    false
  )}</div></div><div class="actions"><button id="addPanel">Панель</button><button id="addButton">Кнопка</button><button \
id="addText">Текст</button><button id="addBar">Шкала</button><button id="duplicate">Дублировать</button><button id="dele\
te">Удалить</button><button id="front">На передний план</button><button id="back">На задний план</button><button id="und\
o">Отменить</button><button id="redo">Повторить</button><button id="clearBg">Убрать фон</button><button id="png" class="\
primary">PNG фейкшота</button><button id="svg">SVG</button></div><p class="muted">Собери игровой экран поверх скриншота.\
 Объекты двигаются мышью, нижний правый маркер меняет размер. Порядок в списке — от заднего к переднему. Delete — удалит\
ь; Ctrl/Cmd+Z — отмена; Shift+Ctrl/Cmd+Z — повтор. Это визуальный макет, кнопки не исполняют игровые действия.</p>${projectControls()}\
</section><div class="mock-workspace"><section class="panel mock-stage">${stage()}</section><section class="panel"><h2>О\
бъект</h2><label>Слои<select id="layers" size="8" aria-label="Слои макета"></select></label><div class="row">${num(
    "x",
    "X",
    0,
    -2560,
    5120
  )}${num("y", "Y", 0, -1440, 2880)}${num("w", "Ширина", 200, 5, 2560)}${num(
    "h",
    "Высота",
    50,
    5,
    1440
  )}</div><label>Текст<textarea id="text" style="min-height:70px"></textarea></label><div class="row">${field("fill",
  "Заливка", "color", "#4f6480")}${field(
    "ink",
    "Текст / рамка",
    "color",
    "#eef3f9"
  )}${num("fontSize", "Размер шрифта", 24, 8, 200)}${num(
    "alpha",
    "Непрозрачность, %",
    100,
    0,
    100
  )}${num(
    "value",
    "Заполнение шкалы, %",
    75,
    0,
    100
  )}${num("radius", "Скругление", 10, 0, 100)}</div><label>Шрифт<select id="font"><option value="sans-serif">S\
ans-serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option><option value="Georgia\
">Georgia</option><option value="Impact">Impact</option></select></label><div class="actions"><button id="applyObject">П\
рименить</button><button id="centerX">По центру X</button><button id="centerY">По центру Y</button></div></section></div\
>`;
  let objects = [], background = null, backgroundURL = null, images = /* @__PURE__ */ new Map(), selected = -1, history = [],
  future = [], drag = null;
  const c = $("stage"), ctx = c.getContext("2d"), fonts = ["sans-serif", "serif", "monospace", "Georgia", "Impact"];
  const state = () => ({
    objects: structuredClone(objects),
    background: backgroundURL,
    width: c.width,
    height: c.height,
    color: $("backgroundColor").value
  });
  function remember() {
    history.push(state());
    if (history.length > 25) {
      history.shift();
    }
    future = [];
  }
  async function restore(p) {
    validateItems(p.objects, 200);
    if (!Number.isInteger(p.width) || p.width < 320 || p.width > 2560 || !Number.isInteger(p.height) || p.height < 200 ||
    p.height > 1440 || !/^#[0-9a-f]{6}$/i.test(p.color)) {
      throw Error("Размер холста или цвет.");
    }
    const nextImages = /* @__PURE__ */ new Map();
    for (const o of p.objects) {
      if (!["panel", "button", "text", "bar", "image"].includes(o.type) || ![o.x, o.y, o.w, o.h, o.fontSize, o.alpha, o.
      value, o.radius].every(Number.isFinite) || Math.abs(o.x) > 5120 || Math.abs(o.y) > 2880 || o.w < 5 || o.w > 2560 ||
      o.h < 5 || o.h > 1440 || o.fontSize < 8 || o.fontSize > 200 || o.alpha < 0 || o.alpha > 100 || o.value < 0 || o.value >
      100 || o.radius < 0 || o.radius > 100 || typeof o.text !== "string" || o.text.length > 1e4 || !fonts.includes(o.font) ||
      !/^#[0-9a-f]{6}$/i.test(o.fill) || !/^#[0-9a-f]{6}$/i.test(o.ink)) {
        throw Error("Повреждённый объект.");
      }
      if (o.type === "image") {
        nextImages.set(o.src, images.get(o.src) || await localImage(o.src));
      }
    }
    const nextBg = p.background ? backgroundURL === p.background ? background : await localImage(p.background) : null;
    objects = structuredClone(p.objects);
    images = nextImages;
    background = nextBg;
    backgroundURL = p.background;
    selected = -1;
    $("width").value = c.width = p.width;
    $("height").value = c.height = p.height;
    $("backgroundColor").value = p.color;
    update();
    draw();
  }
  function item(type, x = 80, y = 80, w = 240, h = 60, text = "") {
    return {
      type,
      x,
      y,
      w,
      h,
      text,
      fill: "#4f6480",
      ink: "#eef3f9",
      fontSize: 24,
      font: "sans-serif",
      alpha: 100,
      value: 75,
      radius: 10
    };
  }
  function update() {
    const value = String(selected);
    $("layers").replaceChildren(...objects.map((o2, i) => new Option(
      `${i + 1}. ${o2.type} · ${o2.text.slice(0, 25)}`,
      String(i)
    )));
    $("layers").value = value;
    const o = objects[selected];
    if (o) {
      for (const id of ["x", "y", "w", "h", "text", "fill", "ink", "fontSize", "font", "alpha", "value", "radius"]) {
        $(id).value = o[id];
      }
    }
  }
  function draw(guides = true) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = $("backgroundColor").value;
    ctx.fillRect(0, 0, c.width, c.height);
    if (background) {
      const s = Math.max(c.width / background.width, c.height / background.height);
      ctx.drawImage(background, (c.width - background.width * s) / 2, (c.height - background.height * s) / 2, background.
      width * s, background.height * s);
    }
    objects.forEach((o) => {
      ctx.save();
      ctx.globalAlpha = o.alpha / 100;
      ctx.fillStyle = o.fill;
      ctx.strokeStyle = o.ink;
      ctx.lineWidth = 1.5;
      if (o.type === "image") {
        const img = images.get(o.src);
        if (img) {
          ctx.drawImage(img, o.x, o.y, o.w, o.h);
        }
      } else {
        if (o.type !== "text") {
          ctx.beginPath();
          ctx.roundRect(o.x, o.y, o.w, o.h, Math.min(o.radius, o.w / 2, o.h / 2));
          ctx.fill();
          ctx.stroke();
          if (o.type === "bar") {
            ctx.save();
            ctx.clip();
            ctx.fillStyle = o.ink;
            ctx.fillRect(o.x, o.y, o.w * o.value / 100, o.h);
            ctx.restore();
          }
        }
        ctx.beginPath();
        ctx.rect(o.x, o.y, o.w, o.h);
        ctx.clip();
        ctx.fillStyle = o.type === "bar" ? o.fill : o.ink;
        ctx.font = `${o.fontSize}px ${o.font}`;
        ctx.textAlign = o.type === "text" ? "left" : "center";
        ctx.textBaseline = "middle";
        o.text.split("\n").forEach((line, i) => ctx.fillText(line, o.type === "text" ? o.x : o.x + o.w / 2, o.y + o.h / 2 +
        (i - (o.text.split("\n").length - 1) / 2) * o.fontSize * 1.2, o.w - 4));
      }
      ctx.restore();
    });
    if (guides && objects[selected]) {
      const o = objects[selected];
      ctx.strokeStyle = "#58bf88";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(o.x, o.y, o.w, o.h);
      ctx.setLineDash([]);
      ctx.fillStyle = "#58bf88";
      ctx.fillRect(o.x + o.w - 7, o.y + o.h - 7, 14, 14);
    }
  }
  $("layers").onchange = () => {
    selected = Number($("layers").value);
    update();
    draw();
  };
  function add(type) {
    if (objects.length >= 200) {
      throw Error("До 200 объектов.");
    }
    remember();
    objects.push(item(type, 80, 80, type === "text" ? 280 : 220, type === "text" ? 45 : 60, type === "text" ? "Новый тек\
ст" : type === "button" ? "Продолжить" : ""));
    selected = objects.length - 1;
    update();
    draw();
  }
  for (const [id, type] of [["addPanel", "panel"], ["addButton", "button"], ["addText", "text"], ["addBar", "bar"]]) {
    action(id, () => add(type));
  }
  c.onpointerdown = (e) => {
    const p = canvasPoint(c, e), o = objects[selected];
    if (o && Math.abs(p.x - o.x - o.w) < 16 && Math.abs(p.y - o.y - o.h) < 16) {
      remember();
      drag = { resize: true, p, o: structuredClone(o) };
    } else {
      selected = objects.findLastIndex((o2) => p.x >= o2.x && p.x <= o2.x + o2.w && p.y >= o2.y && p.y <= o2.y + o2.h);
      if (selected >= 0) {
        remember();
        drag = { p, o: structuredClone(objects[selected]) };
      }
      update();
      draw();
    }
    c.setPointerCapture(e.pointerId);
  };
  c.onpointermove = (e) => {
    if (!drag || selected < 0) {
      return;
    }
    const p = canvasPoint(c, e), o = objects[selected], step = clamp(Number($("snap").value) || 0, 0, 64), snap = (v) => step ?
    Math.round(v / step) * step : v;
    if (drag.resize) {
      o.w = clamp(snap(drag.o.w + p.x - drag.p.x), 5, 2560);
      o.h = clamp(snap(drag.o.h + p.y - drag.p.y), 5, 1440);
    } else {
      o.x = clamp(snap(drag.o.x + p.x - drag.p.x), -2560, 5120);
      o.y = clamp(snap(drag.o.y + p.y - drag.p.y), -1440, 2880);
    }
    update();
    draw();
  };
  c.onpointerup = c.onpointercancel = () => {
    drag = null;
  };
  action("applyObject", () => {
    const o = objects[selected];
    if (!o) {
      throw Error("Выбери объект.");
    }
    const next = { ...o };
    for (const id of ["x", "y", "w", "h", "fontSize", "alpha", "value", "radius"]) {
      const el = $(id), value = Number(el.value);
      if (!Number.isFinite(value) || value < Number(el.min) || value > Number(el.max)) {
        throw Error(`Проверь ${id}.`);
      }
      next[id] = value;
    }
    for (const id of ["text", "fill", "ink", "font"]) {
      next[id] = $(id).value;
    }
    remember();
    objects[selected] = next;
    draw();
    update();
  });
  action("delete", () => {
    if (selected >= 0) {
      remember();
      objects.splice(selected, 1);
      selected = -1;
      update();
      draw();
    }
  });
  action("duplicate", () => {
    if (selected >= 0 && objects.length < 200) {
      remember();
      const o = structuredClone(objects[selected]);
      o.x += 16;
      o.y += 16;
      objects.push(o);
      selected = objects.length - 1;
      update();
      draw();
    }
  });
  for (const id of ["front", "back"]) {
    action(id, () => {
      if (selected < 0) {
        return;
      }
      remember();
      const [o] = objects.splice(selected, 1);
      if (id === "front") {
        objects.push(o);
        selected = objects.length - 1;
      } else {
        objects.unshift(o);
        selected = 0;
      }
      update();
      draw();
    });
  }
  for (const id of ["centerX", "centerY"]) {
    action(id, () => {
      const o = objects[selected];
      if (o) {
        remember();
        if (id === "centerX") {
          o.x = (c.width - o.w) / 2;
        } else {
          o.y = (c.height - o.h) / 2;
        }
        update();
        draw();
      }
    });
  }
  action("undo", async () => {
    if (history.length) {
      const p = history.pop();
      future.push(state());
      await restore(p);
    }
  });
  action("redo", async () => {
    if (future.length) {
      const p = future.pop();
      history.push(state());
      await restore(p);
    }
  });
  for (const id of ["width", "height"]) {
    $(id).onchange = () => {
      remember();
      c.width = clamp(Math.round(Number($("width").value) || 960), 320, 2560);
      c.height = clamp(Math.round(Number($("height").value) || 600), 200, 1440);
      $("width").value = c.width;
      $("height").value = c.height;
      draw();
    };
  }
  $("backgroundColor").oninput = () => draw();
  bindImage("background", async (bitmap) => {
    const url = imageDataURL(bitmap, 2560), img = await localImage(url);
    remember();
    backgroundURL = url;
    background = img;
    draw();
  });
  bindImage("image", async (bitmap) => {
    if (objects.length >= 200) {
      throw Error("До 200 объектов.");
    }
    const url = imageDataURL(bitmap, 1600), img = await localImage(url);
    remember();
    images.set(url, img);
    const w = Math.min(300, img.width), h = clamp(w * img.height / img.width, 5, 1440);
    objects.push({ ...item("image", 80, 80, w, h), src: url });
    selected = objects.length - 1;
    update();
    draw();
  });
  action("clearBg", () => {
    remember();
    background = null;
    backgroundURL = null;
    draw();
  });
  action("png", async () => {
    draw(false);
    try {
      download(await toBlob(c), "game-ui-fake-shot.png");
    } finally {
      draw();
    }
  });
  action("svg", () => {
    const parts = [`<rect width="100%" height="100%" fill="${$("backgroundColor").value}"/>`];
    if (backgroundURL) {
      parts.push(`<image href="${backgroundURL}" width="${c.width}" height="${c.height}" preserveAspectRatio="xMidYMid s\
lice"/>`);
    }
    objects.forEach((o) => {
      let content = "";
      if (o.type === "image") {
        content = `<image href="${o.src}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" preserveAspectRatio="none\
"/>`;
      } else {
        if (o.type !== "text") {
          content += `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="${Math.min(o.radius, o.w / 2, o.h /
          2)}" fill="${o.fill}" stroke="${o.ink}"/>`;
          if (o.type === "bar") {
            content += `<rect x="${o.x}" y="${o.y}" width="${o.w * o.value / 100}" height="${o.h}" fill="${o.ink}"/>`;
          }
        }
        content += o.text.split("\n").map((line, i) => `<text x="${o.type === "text" ? o.x : o.x + o.w / 2}" y="${o.y + o.
        h / 2 + (i - (o.text.split("\n").length - 1) / 2) * o.fontSize * 1.2}" dominant-baseline="middle" text-anchor="${o.
        type === "text" ? "start" : "middle"}" fill="${o.type === "bar" ? o.fill : o.ink}" font-family="${o.font}" font-\
size="${o.fontSize}">${esc(line)}</text>`).join("");
      }
      parts.push(`<g opacity="${o.alpha / 100}">${content}</g>`);
    });
    saveText(`<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="0 0 ${c.width} ${c.
    height}">${parts.join("")}</svg>`, "game-ui-fake-shot.svg", "image/svg+xml");
  });
  function preset() {
    remember();
    objects = [];
    const scaleX = c.width / 960, scaleY = c.height / 600;
    const push = (type, x, y, w, h, text, fill = "#4f6480", ink = "#eef3f9") => {
      objects.push({ ...item(type, x * scaleX, y * scaleY, w * scaleX, h * scaleY, text), fill, ink });
    };
    const p = $("preset").selectedIndex;
    if (p === 0 || p === 1) {
      push("panel", 24, 24, 280, 110, "");
      push("bar", 44, 45, 230, 22, "", "#573b48", "#c98085");
      push("bar", 44, 80, 190, 16, "", "#384c60", "#8ab7de");
      push("text", 720, 24, 210, 45, "Монеты: 240");
      push("panel", 290, 510, 380, 65, "1     2     3     4     5");
      if (p === 0) {
        push("panel", 780, 420, 150, 150, "Карта");
      } else {
        push("text", 400, 24, 160, 45, "03:42");
      }
    }
    if (p === 2) {
      push("panel", 180, 70, 600, 470, "");
      push("text", 220, 95, 400, 50, "Инвентарь");
      for (let y = 0; y < 4; y += 1) {
        for (let x = 0; x < 7; x += 1) {
          push("button", 220 + x * 74, 170 + y * 74, 60, 60, "", "#3b4c63");
        }
      }
    }
    if (p === 3) {
      push("text", 250, 90, 460, 80, "GAME TITLE");
      for (let i = 0; i < 4; i += 1) {
        push("button", 330, 220 + i * 70, 300, 54, ["Новая игра", "Продолжить", "Настройки",
        "Выход"][i]);
      }
    }
    if (p === 4) {
      push("panel", 35, 400, 890, 165, "");
      push("text", 65, 415, 260, 40, "Имя персонажа");
      push("text", 65, 470, 800, 70, "Здесь появится реплика персонажа...");
      push("button", 780, 515, 110, 32, "Далее");
    }
    if (p === 5) {
      push("panel", 0, 0, 960, 50, "Дерево: 500     Камень: 180     Золото: 70");
      push("panel", 20, 390, 180, 190, "Мини-карта");
      push("panel", 230, 465, 710, 115, "Построить     Улучшить     Нанять");
    }
    selected = -1;
    update();
    draw();
  }
  action("apply", preset);
  bindProject("GM Mockup", state, (p) => restore(p));
  const key = (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
      return;
    }
    if (e.key === "Delete") {
      e.preventDefault();
      $("delete").click();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      $(e.shiftKey ? "redo" : "undo").click();
    }
  };
  document.addEventListener("keydown", key);
  teardown(() => document.removeEventListener("keydown", key));
  preset();
}
export {
  mockup
};
