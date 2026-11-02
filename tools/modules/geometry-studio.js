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
  readNumber,
  projectControls,
  bindProject,
  saveText,
  stage,
  animationControls,
  animate,
  bindImage
} from "../studio-ui.js?v=20261102-v11";
import { clamp, spiroPoints, traceRuns, runsToPath, gravityStep, voxelOBJ, validateItems } from "../studio-core.js?v=20261102-v11";
async function voxels(root) {
  root.innerHTML = `<section class="panel"><div class="row">${select("preset", "Модель", [
    "Домик",
    "Дерево",
    "Сердце",
    "Башня",
    "Пусто"
  ])}<button id="apply">Загрузить</button>${num(
    "layer",
    "Слой Y",
    0,
    0,
    15
  )}${field("color", "Цвет", "color", "#8aa9c6")}${select(
    "brush",
    "Кисть",
    [
      "Рисовать",
      "Стереть",
      "Пипетка"
    ]
  )}</div><div class="actions"><button id="undo">Отменить</button><button id="redo">Повторить</button><button id="clearL\
ayer">Очистить слой</button><button id="png">PNG</button><button id="obj">OBJ с цветами вершин</button></div><p class="m\
uted">Сетка 16×16×16. Рисуй на текущем слое слева. Справа — 3D: тащи для вращения, колесо для масштаба. ПКМ на сетке — с\
тереть. OBJ содержит цвета вершин; их отображение зависит от программы импорта.</p>${projectControls()}\
</section><div class="two"><section class="panel"><h2>Слой <output id="layerLabel">0</output></h2><canvas id="grid" widt\
h="512" height="512" class="lab-canvas" aria-label="Послойный редактор вокселей"></canvas></section><section class="pane\
l">${stage()}<p id="info" class="muted"></p></section></div>`;
  let voxels2 = [], history = [], future = [], yaw = 0.7, pitch = 0.5, zoom = 32, drag = null, painting = false;
  const c = $("stage"), ctx = c.getContext("2d"), g = $("grid"), gx = g.getContext("2d");
  const remember = () => {
    history.push(JSON.stringify(voxels2));
    if (history.length > 60) {
      history.shift();
    }
    future = [];
  };
  function draw() {
    const layer = clamp(Number($("layer").value) || 0, 0, 15);
    $("layerLabel").textContent = layer;
    gx.fillStyle = "#f4f6fa";
    gx.fillRect(0, 0, 512, 512);
    for (const v of voxels2) {
      if (v.y === layer) {
        gx.fillStyle = v.color;
        gx.fillRect(v.x * 32, v.z * 32, 32, 32);
      }
    }
    gx.strokeStyle = "#cfd6e4";
    gx.beginPath();
    for (let i = 0; i <= 16; i += 1) {
      gx.moveTo(i * 32, 0);
      gx.lineTo(i * 32, 512);
      gx.moveTo(0, i * 32);
      gx.lineTo(512, i * 32);
    }
    gx.stroke();
    ctx.clearRect(0, 0, 960, 600);
    const project = (x, y, z) => {
      x -= 8;
      y -= 8;
      z -= 8;
      const a = x * Math.cos(yaw) - z * Math.sin(yaw), b = x * Math.sin(yaw) + z * Math.cos(yaw);
      return { x: 480 + a * zoom, y: 300 + (-y * Math.cos(pitch) - b * Math.sin(pitch)) * zoom, d: b * Math.cos(pitch) -
      y * Math.sin(pitch) };
    };
    const faces = [], sides = [
      [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
      [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]],
      [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]],
      [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]],
      [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]],
      [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]]
    ];
    for (const v of voxels2) {
      sides.forEach((side, i) => {
        const p = side.map((a) => project(v.x + a[0], v.y + a[1], v.z + a[2]));
        faces.push({ p, color: v.color, d: p.reduce((n, a) => n + a.d, 0) / 4, i });
      });
    }
    faces.sort((a, b) => b.d - a.d);
    for (const f of faces) {
      ctx.fillStyle = f.color;
      ctx.strokeStyle = "#ffffff30";
      ctx.beginPath();
      f.p.forEach((p, i) => {
        if (i) {
          ctx.lineTo(p.x, p.y);
        } else {
          ctx.moveTo(p.x, p.y);
        }
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `rgba(0,0,0,${[0.14, 0.1, 0, 0.3, 0.22, 0.08][f.i]})`;
      ctx.fill();
    }
    $("info").textContent = `Вокселей: ${voxels2.length} / 4096`;
  }
  function paint(e) {
    const p = canvasPoint(g, e), x = Math.floor(p.x / 32), z = Math.floor(p.y / 32), y = clamp(Math.round(Number($("layer").value) || 0), 0, 15);
    if (x < 0 || x > 15 || z < 0 || z > 15) {
      return;
    }
    const index = voxels2.findIndex((v) => v.x === x && v.y === y && v.z === z), brush = $("brush").value;
    if (brush === "Пипетка") {
      if (index >= 0) {
        $("color").value = voxels2[index].color;
      }
      return;
    }
    if (index >= 0) {
      voxels2.splice(index, 1);
    }
    if (e.buttons !== 2 && brush !== "Стереть") {
      voxels2.push({ x, y, z, color: $("color").value });
    }
    draw();
  }
  g.oncontextmenu = (e) => e.preventDefault();
  g.onpointerdown = (e) => {
    e.preventDefault();
    remember();
    painting = true;
    g.setPointerCapture(e.pointerId);
    paint(e);
  };
  g.onpointermove = (e) => {
    if (painting) {
      paint(e);
    }
  };
  g.onpointerup = g.onpointercancel = () => {
    painting = false;
  };
  c.onpointerdown = (e) => {
    drag = { x: e.clientX, y: e.clientY };
    c.setPointerCapture(e.pointerId);
  };
  c.onpointermove = (e) => {
    if (drag) {
      yaw += (e.clientX - drag.x) * 0.01;
      pitch = clamp(pitch + (e.clientY - drag.y) * 0.01, -1.5, 1.5);
      drag = { x: e.clientX, y: e.clientY };
      draw();
    }
  };
  c.onpointerup = c.onpointercancel = () => {
    drag = null;
  };
  c.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoom = clamp(zoom * Math.exp(-e.deltaY * 1e-3), 8, 50);
    draw();
  }, { passive: false });
  function preset() {
    remember();
    voxels2 = [];
    const kind = $("preset").value;
    for (let x = 0; x < 16; x += 1) {
      for (let y = 0; y < 16; y += 1) {
        for (let z = 0; z < 16; z += 1) {
          let color = null;
          if (kind === "Домик" && x >= 4 && x <= 11 && z >= 4 && z <= 11) {
            if (y < 6 && (x === 4 || x === 11 || z === 4 || z === 11) && !(z === 4 && x >= 7 && x <= 8 && y < 4)) {
              color = "#9dafbd";
            }
            if (y >= 6 && y < 10 && Math.abs(x - 7.5) < 10 - y) {
              color = "#b18585";
            }
          }
          if (kind === "Дерево") {
            if (y < 9 && x >= 7 && x <= 8 && z >= 7 && z <= 8) {
              color = "#a28977";
            }
            if ((x - 8) ** 2 + (y - 11) ** 2 + (z - 8) ** 2 < 20) {
              color = "#8daa8e";
            }
          }
          if (kind === "Сердце" && z >= 7 && z <= 8 && ((x - 5) ** 2 + (y - 10) ** 2 < 13 || (x - 10) ** 2 + (y - 10) **
          2 < 13 || y >= 3 && y < 10 && Math.abs(x - 7.5) < (y - 2) * 0.7)) {
            color = "#b87891";
          }
          if (kind === "Башня" && x >= 5 && x <= 10 && z >= 5 && z <= 10 && (x === 5 || x === 10 || z === 5 || z ===
          10) && (y < 12 || y < 14 && (x + z) % 2 === 0)) {
            color = "#96a4ba";
          }
          if (color) {
            voxels2.push({ x, y, z, color });
          }
        }
      }
    }
    draw();
  }
  action("apply", preset);
  $("layer").oninput = draw;
  action("undo", () => {
    if (history.length) {
      future.push(JSON.stringify(voxels2));
      voxels2 = JSON.parse(history.pop());
      draw();
    }
  });
  action("redo", () => {
    if (future.length) {
      history.push(JSON.stringify(voxels2));
      voxels2 = JSON.parse(future.pop());
      draw();
    }
  });
  action("clearLayer", () => {
    remember();
    voxels2 = voxels2.filter((v) => v.y !== Number($("layer").value));
    draw();
  });
  action("png", async () => download(await toBlob(c), "voxel-model.png"));
  action("obj", () => saveText(voxelOBJ(voxels2), "voxel-model.obj"));
  bindProject("GM Voxels", () => ({ voxels: voxels2 }), (p) => {
    validateItems(p.voxels, 4096);
    const used = /* @__PURE__ */ new Set();
    for (const v of p.voxels) {
      const key = `${v.x},${v.y},${v.z}`;
      if (![v.x, v.y, v.z].every((n) => Number.isInteger(n) && n >= 0 && n < 16) || !/^#[0-9a-f]{6}$/i.test(v.color) || used.
      has(key)) {
        throw Error("Повреждённый воксель.");
      }
      used.add(key);
    }
    remember();
    voxels2 = p.voxels;
    draw();
  });
  preset();
}
async function spiro(root) {
  root.innerHTML = `<section class="panel"><div class="row">${select("preset", "Узор", [
    "Розетка",
    "Звезда",
    "Орбиты",
    "Кружево",
    "Эпициклоида",
    "Лепестки"
  ])}<button id="apply">Загрузить</button>${num(
    "outer",
    "Радиус большого круга",
    160,
    10,
    250
  )}${num(
    "inner",
    "Радиус малого круга",
    57,
    1,
    250
  )}${num("offset", "Смещение пера", 90, 0, 250)}${num(
    "turns",
    "Обороты",
    30,
    1,
    100
  )}${num(
    "stroke",
    "Толщина",
    1.2,
    0.2,
    10,
    0.1
  )}${field("color", "Цвет", "color", "#7485b3")}<label><input id="outside" type="checkbox"> Снаружи</label><label><\
input id="guides" type="checkbox" checked> Показать механизм</label></div>${animationControls()}<div cla\
ss="actions"><button id="svg">SVG</button></div><p class="muted">Рисунок строится движением пера внутри или снаружи катя\
щегося круга. Круги показываются только при предпросмотре. Экспорт — чистая линия.</p>${projectControls()}\
</section><section class="panel">${stage()}</section>`;
  const c = $("stage"), ctx = c.getContext("2d");
  let points = [], fit = 1, exporting = false;
  const ids = ["outer", "inner", "offset", "turns", "stroke", "color", "outside"];
  const settings = () => Object.fromEntries(ids.map((id) => [id, $(id).type === "checkbox" ? $(id).checked : $(id).type ===
  "color" ? $(id).value : Number($(id).value)]));
  function rebuild() {
    const s = settings();
    for (const id of ["outer", "inner", "offset", "turns", "stroke"]) {
      if (!Number.isFinite(s[id]) || s[id] <= 0 && id !== "offset") {
        throw Error("Проверь параметры.");
      }
    }
    s.outer = clamp(s.outer, 10, 250);
    s.inner = clamp(s.inner, 1, 250);
    s.offset = clamp(s.offset, 0, 250);
    s.turns = clamp(s.turns, 1, 100);
    points = spiroPoints(s, Math.min(3e4, s.turns * 300));
    fit = 250 / Math.max(1, ...points.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))));
    draw(0);
  }
  function draw(time, still = false) {
    ctx.clearRect(0, 0, 960, 600);
    ctx.strokeStyle = $("color").value;
    ctx.lineWidth = clamp(Number($("stroke").value), 0.2, 10);
    ctx.lineJoin = "round";
    ctx.beginPath();
    const count = time === 0 && !exporting || still ? points.length : Math.max(2, Math.floor(points.length * time / Math.
    max(0.2, Number($("duration").value))));
    for (let i = 0; i < count; i += 1) {
      const p = points[i];
      if (i) {
        ctx.lineTo(480 + p.x * fit, 300 + p.y * fit);
      } else {
        ctx.moveTo(480 + p.x * fit, 300 + p.y * fit);
      }
    }
    ctx.stroke();
    if ($("guides").checked && !exporting) {
      const s = settings(), phase = time / Math.max(0.2, Number($("duration").value)) * s.turns * Math.PI * 2, base = s.
      outside ? s.outer + s.inner : s.outer - s.inner, cx = 480 + base * Math.cos(phase) * fit, cy = 300 + base * Math.sin(
        phase
      ) * fit;
      ctx.strokeStyle = "#b4bfd6";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(480, 300, s.outer * fit, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, s.inner * fit, 0, Math.PI * 2);
      ctx.stroke();
      const pen = points[Math.min(points.length - 1, Math.max(0, count - 1))];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(480 + pen.x * fit, 300 + pen.y * fit);
      ctx.stroke();
    }
  }
  const presets = [
    [160, 57, 90, 30, false],
    [160, 64, 140, 8, false],
    [180, 119, 22, 30, false],
    [180, 77, 110, 30, false],
    [90, 44, 60, 20, true],
    [160, 40, 100, 4, false]
  ];
  function preset() {
    const s = presets[$("preset").selectedIndex];
    ["outer", "inner", "offset", "turns"].forEach((id, i) => {
      $(id).value = s[i];
    });
    $("outside").checked = s[4];
    rebuild();
  }
  $("guides").onchange = () => draw(0);
  action("apply", preset);
  for (const id of ids) {
    $(id).addEventListener("input", () => {
      try {
        rebuild();
      } catch (e) {
        status(e.message, true);
      }
    });
  }
  action("svg", () => {
    const d = points.map((p, i) => `${i ? "L" : "M"}${(480 + p.x * fit).toFixed(3)} ${(300 + p.y * fit).toFixed(3)}`).join(
      ""
    );
    saveText(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600"><path d="${d}" fill="none" stroke="${$("colo\
r").value}" stroke-width="${clamp(Number($("stroke").value), 0.2, 10)}"/></svg>`, "spirograph.svg", "image/svg+xml");
  });
  bindProject("GM Spiro", settings, (p) => {
    for (const id of ids) {
      if (id === "outside") {
        $(id).checked = p[id] === true;
      } else if (id === "color") {
        if (!/^#[0-9a-f]{6}$/i.test(p[id])) {
          throw Error("Цвет.");
        }
        $(id).value = p[id];
      } else {
        $(id).value = clamp(Number(p[id]) || 1, 0, 250);
      }
    }
    rebuild();
  });
  preset();
  animate(c, draw, () => ({}), (_, active) => {
    exporting = active;
  });
}
async function vectorize(root) {
  root.innerHTML = `<section class="panel">${files("image", "image/png,image/jpeg,image/webp", false)}<div class="row">${select(
    "mode",
    "Режим",
    [
      ["mono", "Монохромный силуэт"],
      ["color", "Цветные области"]
    ]
  )}${num(
    "threshold",
    "Порог яркости",
    140,
    0,
    255
  )}${select("resolution", "Детализация", [["128", "128 px"], ["256", "256 px"], ["512", "512 px"]])}${select(
    "levels",
    "Цветовые уровни",
    [["8", "8"], ["27", "27"], ["64", "64"]]
  )}<label><input id="invert" type="checkbox"> Инверсия</label></div><div class="actions"><button id="trace" class="prim\
ary">Построить SVG</button><button id="svg">Скачать SVG</button><button id="png">PNG</button></div><p class="muted">Лока\
льная векторизация областей: полностью прозрачные пиксели пропускаются, горизонтальные участки объединяются. Контур следует пиксельной се\
тке; детализация управляет количеством узлов. Это не ручная обводка кривыми Безье.</p></section><div class="two"><sectio\
n class="panel"><h2>Исходник</h2><canvas id="source" class="lab-canvas" width="512" height="512"></canvas></section><sec\
tion class="panel"><h2>Вектор</h2><div id="vectorPreview" class="vector-preview"></div><p id="info" class="muted"></p></\
section></div>`;
  let image = null, svg = "", result = null;
  const source = $("source");
  function trace() {
    if (!image) {
      throw Error("Загрузи изображение.");
    }
    const scale = Math.min(1, Number($("resolution").value) / Math.max(image.width, image.height)), w = Math.max(1, Math.
    round(image.width * scale)), h = Math.max(1, Math.round(image.height * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(image, 0, 0, w, h);
    const groups = traceRuns(ctx.getImageData(0, 0, w, h).data, w, h, readNumber("threshold", 0, 255), $("mode").value ===
    "mono" ? 1 : Number($("levels").value), $("invert").checked);
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${groups.map((g) => `\
<path fill="${g.color}" d="${runsToPath(g.runs)}"/>`).join("")}</svg>`;
    $("vectorPreview").innerHTML = svg;
    $("info").textContent = `${w}×${h} · цветов: ${groups.length} · SVG ${(new Blob(
      [svg]
    ).size / 1024).toFixed(1)} КБ`;
    result = c;
    status("SVG построен.");
  }
  bindImage("image", (bitmap) => {
    image = document.createElement("canvas");
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    image.width = Math.round(bitmap.width * scale);
    image.height = Math.round(bitmap.height * scale);
    image.getContext("2d").drawImage(bitmap, 0, 0, image.width, image.height);
    source.width = image.width;
    source.height = image.height;
    source.getContext("2d").drawImage(image, 0, 0);
    trace();
  });
  action("trace", trace);
  action("svg", () => {
    if (!svg) {
      throw Error("Сначала построй SVG.");
    }
    saveText(svg, "traced-image.svg", "image/svg+xml");
  });
  action("png", async () => {
    if (!result) {
      throw Error("Сначала построй SVG.");
    }
    const blob = new Blob([svg], { type: "image/svg+xml" }), url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = result.width;
      c.height = result.height;
      c.getContext("2d").drawImage(img, 0, 0);
      download(await toBlob(c), "traced-image.png");
    } finally {
      URL.revokeObjectURL(url);
    }
  });
}
async function orbits(root) {
  root.innerHTML = `<section class="panel"><div class="row">${select(
    "preset",
    "Система",
    [
      "Планетная система",
      "Двойная звезда",
      "Спутник планеты",
      "Рой",
      "Гравитационный манёвр",
      "Пусто"
    ]
  )}<button id="apply">Загрузить</button>${num("gravity", "Гравитационная постоянная", 60,
  0.1, 300, 0.1)}${num(
    "speed",
    "Скорость времени",
    1,
    0.01,
    5,
    0.01
  )}${num(
    "mass",
    "Масса нового / выбранного тела",
    100,
    0.1,
    2e4,
    0.1
  )}${num("vx", "Скорость X", 0, -300, 300, 0.1)}${num("vy", "Скорость Y", 30, -300, 300, 0.1)}${field("\
color", "Цвет", "color", "#8ca3cc")}<label><input id="fixed" type="checkbox"> Закрепить</label></div><div class="act\
ions"><button id="play" class="primary">Играть / пауза</button><button id="step">Шаг</button><button id="reset">Сбросить\
</button><button id="addMode">Добавление: выкл.</button><button id="applyBody">Применить к выбранному</button><button id\
="remove">Удалить тело</button><button id="clearTrails">Очистить следы</button><button id="png">PNG</button></div><p cla\
ss="muted">Выдели тело кликом. Включи добавление, протяни от места появления в направлении скорости. Колесо — масштаб, S\
hift+перетаскивание — камера. До 80 тел; модель 2D с гравитационным смягчением, без слияния и релятивистских эффектов.</\
p>${projectControls()}</section><section class="panel">${stage()}<p id="info" class="muted"></p></section>`;
  let bodies = [], saved = [], trails = [], playing = false, selected = -1, adding = false, drag = null, zoom = 1, pan = {
    x: 480,
    y: 300
  }, frame, dead = false, last = 0;
  const c = $("stage"), ctx = c.getContext("2d"), colors = ["#e8c37c", "#9fb4e1", "#a0c3af", "#c49cae", "#b1a4cc"];
  const body = (x, y, mass, vx = 0, vy = 0, fixed = false, i = 0) => ({ x, y, mass, vx, vy, fixed, color: colors[i % colors.
  length] });
  const radius = (b) => clamp(Math.cbrt(b.mass) * 1.7, 3, 25);
  const world = (e) => {
    const p = canvasPoint(c, e);
    return { x: (p.x - pan.x) / zoom, y: (p.y - pan.y) / zoom };
  };
  function draw() {
    ctx.fillStyle = "#202532";
    ctx.fillRect(0, 0, 960, 600);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    for (let i = 0; i < bodies.length; i += 1) {
      const b = bodies[i];
      ctx.strokeStyle = b.color + "70";
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      (trails[i] || []).forEach((p, j) => {
        if (j) {
          ctx.lineTo(p.x, p.y);
        } else {
          ctx.moveTo(p.x, p.y);
        }
      });
      ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, radius(b), 0, Math.PI * 2);
      ctx.fill();
      if (i === selected) {
        ctx.strokeStyle = "#64c48d";
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
      }
    }
    ctx.restore();
    $("info").textContent = `Тел: ${bodies.length} · ${selected >= 0 ? `Выбрано #${selected + 1}` : "Ничего н\
е выбрано"} · масштаб ${(zoom * 100).toFixed(0)}%`;
  }
  function step() {
    const dt = 0.03 * readNumber("speed", 0.01, 5);
    for (let n = 0; n < 5; n += 1) {
      gravityStep(bodies, dt / 5, readNumber("gravity", 0.1, 300));
    }
    bodies.forEach((b, i) => {
      (trails[i] ||= []).push({ x: b.x, y: b.y });
      if (trails[i].length > 1500) {
        trails[i].shift();
      }
    });
    draw();
  }
  function preset() {
    playing = false;
    selected = -1;
    zoom = 1;
    pan = { x: 480, y: 300 };
    const kind = $("preset").selectedIndex;
    const G = 60;
    $("gravity").value = G;
    bodies = kind === 5 ? [] : [body(0, 0, 3e3, 0, 0, true)];
    if (kind === 0) {
      for (let i = 0; i < 4; i += 1) {
        const r = 75 + i * 65;
        bodies.push(body(r, 0, 1 + i * 3, 0, Math.sqrt(G * 3e3 / r), false, i + 1));
      }
    }
    if (kind === 1) {
      bodies = [body(-95, 0, 1500, 0, -Math.sqrt(G * 1500 / 380)), body(
        95,
        0,
        1500,
        0,
        Math.sqrt(G * 1500 / 380),
        false,
        1
      )];
    }
    if (kind === 2) {
      bodies.push(body(180, 0, 200, 0, Math.sqrt(G * 3e3 / 180), false, 1), body(208, 0, 0.5, 0, Math.sqrt(G * 3e3 / 180) +
      Math.sqrt(G * 200 / 28), false, 2));
    }
    if (kind === 3) {
      for (let i = 0; i < 40; i += 1) {
        const a = i * 2.39996, r = 70 + i * 5;
        bodies.push(body(Math.cos(a) * r, Math.sin(a) * r, 0.1, -Math.sin(a) * Math.sqrt(G * 3e3 / r), Math.cos(a) * Math.
        sqrt(G * 3e3 / r), false, i));
      }
    }
    if (kind === 4) {
      bodies = [body(0, 0, 2e3, 0, 0, true), body(-350, 100, 1, 90, 0, false, 2)];
    }
    trails = [];
    saved = structuredClone(bodies);
    draw();
  }
  action("apply", preset);
  action("play", () => {
    playing = !playing;
  });
  action("step", step);
  action("reset", () => {
    playing = false;
    bodies = structuredClone(saved);
    trails = [];
    draw();
  });
  action("addMode", () => {
    adding = !adding;
    $("addMode").textContent = `Добавление: ${adding ? "вкл." : "выкл."}`;
  });
  c.onpointerdown = (e) => {
    const p = world(e);
    if (e.shiftKey) {
      drag = { camera: true, x: e.clientX, y: e.clientY };
    } else if (adding) {
      drag = { p };
    } else {
      selected = bodies.findLastIndex((b) => Math.hypot(b.x - p.x, b.y - p.y) < radius(b) + 5 / zoom);
      if (selected >= 0) {
        const b = bodies[selected];
        for (const id of ["mass", "vx", "vy", "color"]) {
          $(id).value = b[id];
        }
        $("fixed").checked = b.fixed;
      }
      draw();
    }
    c.setPointerCapture(e.pointerId);
  };
  c.onpointermove = (e) => {
    if (drag?.camera) {
      const r = c.getBoundingClientRect();
      pan.x += (e.clientX - drag.x) * c.width / r.width;
      pan.y += (e.clientY - drag.y) * c.height / r.height;
      drag.x = e.clientX;
      drag.y = e.clientY;
      draw();
    }
  };
  c.onpointerup = (e) => {
    if (drag?.p) {
      if (bodies.length >= 80) {
        status("До 80 тел.", true);
      } else {
        const p = world(e), vx = clamp((p.x - drag.p.x) * 0.3, -300, 300), vy = clamp((p.y - drag.p.y) * 0.3, -300, 300);
        bodies.push({ ...body(drag.p.x, drag.p.y, readNumber("mass", 0.1, 2e4), vx, vy, $("fixed").checked), color: $("c\
olor").value });
        saved = structuredClone(bodies);
        draw();
      }
    }
    drag = null;
  };
  c.onpointercancel = () => {
    drag = null;
  };
  c.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoom = clamp(zoom * Math.exp(-e.deltaY * 1e-3), 0.1, 8);
    draw();
  }, { passive: false });
  action("applyBody", () => {
    if (selected < 0) {
      throw Error("Выбери тело.");
    }
    Object.assign(bodies[selected], { mass: readNumber("mass", 0.1, 2e4), vx: readNumber("vx", -300, 300), vy: readNumber(
      "vy",
      -300,
      300
    ), fixed: $("fixed").checked, color: $("color").value });
    saved = structuredClone(bodies);
    draw();
  });
  action("remove", () => {
    if (selected >= 0) {
      bodies.splice(selected, 1);
      trails.splice(selected, 1);
      selected = -1;
      saved = structuredClone(bodies);
      draw();
    }
  });
  action("clearTrails", () => {
    trails = [];
    draw();
  });
  action("png", async () => download(await toBlob(c), "orbital-system.png"));
  bindProject("GM Orbits", () => ({ bodies, gravity: Number($("gravity").value) }), (p) => {
    validateItems(p.bodies, 80);
    for (const b of p.bodies) {
      if (![b.x, b.y, b.vx, b.vy, b.mass].every(Number.isFinite) || Math.abs(b.x) > 1e6 || Math.abs(b.y) > 1e6 || Math.abs(
        b.vx
      ) > 1e4 || Math.abs(b.vy) > 1e4 || b.mass < 0.1 || b.mass > 2e4 || !/^#[0-9a-f]{6}$/i.test(b.color)) {
        throw Error("Повреждённое тело.");
      }
    }
    if (!Number.isFinite(p.gravity) || p.gravity < 0.1 || p.gravity > 300) {
      throw Error("Гравитация.");
    }
    playing = false;
    bodies = p.bodies;
    saved = structuredClone(bodies);
    trails = [];
    $("gravity").value = p.gravity;
    draw();
  });
  function tick(t) {
    if (dead) {
      return;
    }
    if (playing && t - last > 16) {
      try {
        step();
      } catch (e) {
        playing = false;
        status(e.message, true);
      }
      last = t;
    }
    frame = requestAnimationFrame(tick);
  }
  teardown(() => {
    dead = true;
    cancelAnimationFrame(frame);
  });
  preset();
  frame = requestAnimationFrame(tick);
}
export {
  orbits,
  spiro,
  vectorize,
  voxels
};
