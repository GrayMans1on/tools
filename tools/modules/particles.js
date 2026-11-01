import { $, esc, field, select, files, action, status, toBlob, download, readImage, teardown, sleep } from "../ui.js";
import {
  ParticleEngine,
  makeLayer,
  makeScene,
  parameter,
  keys,
  gradient,
  clone,
  validateProject,
  emitterAt,
  paramRanges,
  numericLimits,
  choices,
  clamp,
  sample
} from "../particle-engine.js?v=20261101-v08";
import { parameterEditor, gradientEditor } from "../particle-editors.js?v=20261101-v08";
import { exportEffect } from "../effect-export.js?v=20261101-v08";
const labels = {
  shape: ["Конус", "Точка", "Круг / сектор", "Кольцо / дуга", "Прямоугольник", "Периметр", "Линия"],
  motion: ["Неподвижный", "Туда-обратно", "Эллипс"],
  space: [
    "World",
    "Local"
  ],
  collisionMode: ["Плоскость", "Границы сцены"],
  triggerAction: [
    "Уничтожить",
    "Перекрасить",
    "Sub Emitter"
  ],
  subEvent: ["Рождение", "Смерть", "Столкновение", "Вход в триггер"],
  sprite: ["Soft Glow", "Circle", "Square", "Star", "Custom Sprite", "Stretched Billboard"],
  blend: [
    "Additive",
    "Alpha",
    "Screen",
    "Multiply"
  ],
  sort: ["Oldest first", "Youngest first", "Smallest first", "Largest first"],
  sheetMode: ["Whole Sheet", "Single Row"]
};
const modules = [
  { title: "Main", open: true, body: [["seed", "Seed", "text"], ["emission", "Duration, s"], ["looping", "Looping", "check"], ["prewarm", "Prewarm (только Looping)", "check"], ["delay", "Start Delay, s"], ["maxParticles", "Max Particles"], ["simulationSpeed", "Simulation Speed"], ["space", "Simulation Space", "select"]], params: [["life", "Start Lifetime, s"], ["speed", "Start Speed, px/s"], ["size", "Start Size, px"], ["startRotation", "Start Rotation, °"]], extra: "startColor" },
  { title: "Emission", flag: "emissionEnabled", open: true, body: [["rateDistance", "Rate over Distance, /px"]], params: [
    ["rate", "Rate over Time, /s"]
  ], extra: "bursts" },
  { title: "Shape", body: [["shape", "Shape", "select"], ["x", "Position X, %"], ["y", "Position Y, %"], ["radius", "Radius / line half-width, px"], ["thickness", "Radius Thickness"], ["boxWidth", "Box Width, px"], ["boxHeight", "Box Height, px"], ["angle", "Direction / Arc Center, °"], ["spread", "Cone Angle, °"], ["arc", "Arc, °"], ["randomDirection", "Randomize Direction"]] },
  { title: "Emitter Motion", body: [["motion", "Motion", "select"], ["motionX", "Amplitude X, px"], ["motionY", "Amplitude Y, px"], ["period", "Period, s"]] },
  { title: "Inherit Velocity", flag: "inheritEnabled", body: [["inherit", "Emitter Velocity Multiplier"]] },
  { title: "Lifetime by Emitter Speed", flag: "lifetimeSpeedEnabled", body: [["lifetimeSpeedMin", "Speed Min, px/s"], ["lifetimeSpeedMax", "Speed Max, px/s"], ["lifetimeMultiplier", "Lifetime Multiplier at Max"]] },
  { title: "Velocity over Lifetime", flag: "velocityEnabled", params: [["velocityX", "Linear X, px/s"], ["velocityY", "Linear Y, px/s"], ["orbital", "Orbital, °/s"], ["radial", "Radial, px/s"]] },
  { title: "Force over Lifetime", flag: "forceEnabled", body: [["gravity", "Gravity Y, px/s²"]], params: [["forceX", "Force X, px/s²"], ["forceY", "Force Y, px/s²"]] },
  { title: "Limit Velocity over Lifetime", flag: "limitEnabled", body: [["dampen", "Dampen"]], params: [["limit", "Speed Limit, px/s"]] },
  { title: "Drag", body: [["drag", "Drag /s"]] },
  { title: "Noise", flag: "noiseEnabled", body: [["noise", "Strength, px/s²"], ["frequency", "Frequency"], ["noiseScroll", "Scroll Speed"], ["octaves", "Octaves"]] },
  { title: "External Forces", flag: "fieldEnabled", body: [["fieldX", "Field X, %"], ["fieldY", "Field Y, %"], ["fieldRadius", "Range, px"], ["attraction", "Attraction (− = repel)"], ["vortex", "Vortex"]] },
  {
    title: "Color over Lifetime",
    flag: "colorEnabled",
    body: [["colorRandom", "Random Between Two Gradients", "check"]],
    params: [["alpha", "Alpha Multiplier"]],
    gradients: [["colorKeys", "Gradient A"], ["colorKeys2", "Gradient B"]]
  },
  { title: "Color by Speed", flag: "colorSpeedEnabled", body: [["speedMin", "Shared Speed Min, px/s"], ["speedMax", "Shared Speed Max, px/s"]], gradients: [["colorSpeedKeys", "Speed Gradient"]] },
  { title: "Size over Lifetime", flag: "sizeEnabled", body: [["separateSize", "Separate Axes", "check"]], params: [["sizeX", "Size X Multiplier"], ["sizeY", "Size Y Multiplier"]] },
  { title: "Size by Speed", flag: "sizeSpeedEnabled", params: [["sizeBySpeed", "Size Multiplier by Speed"]] },
  { title: "Rotation over Lifetime", flag: "rotationEnabled", params: [["rotation", "Angular Velocity, °/s"]] },
  { title: "Rotation by Speed", flag: "rotationSpeedEnabled", params: [["rotationBySpeed", "Angular Velocity by Speed, °/s"]] },
  { title: "Collision", flag: "collisionEnabled", body: [["collisionMode", "Mode", "select"], ["floor", "Floor Y, %"], [
    "bounce",
    "Bounce"
  ], ["friction", "Friction"], ["lifetimeLoss", "Lifetime Loss per Hit"], ["killSpeed", "Kill Below Speed, px/s"]] },
  { title: "Triggers", flag: "triggerEnabled", body: [["triggerX", "Center X, %"], ["triggerY", "Center Y, %"], ["triggerWidth", "Width, px"], ["triggerHeight", "Height, px"], ["triggerAction", "On Enter", "select"], [
    "triggerColor",
    "Color",
    "color"
  ]] },
  { title: "Sub Emitters", flag: "subEnabled", body: [["subEvent", "Event", "select"], ["subCount", "Count"], ["subProbability", "Probability"], ["subLife", "Lifetime, s"], ["subSpeed", "Speed, px/s"], ["subSize", "Size, px"], [
    "subInherit",
    "Inherit Velocity"
  ], ["subColor", "Color", "color"]] },
  { title: "Texture Sheet Animation", flag: "sheetEnabled", body: [["sheetCols", "Tiles X"], ["sheetRows", "Tiles Y"], [
    "sheetMode",
    "Animation",
    "select"
  ], ["sheetRow", "Row (с 0)"], ["sheetCycles", "Cycles"], ["sheetRandomStart", "Random Start Frame", "check"]], note: "Атлас загружается в Renderer → Custom Sprite. Счёт кадров слева направо, сверху вниз." },
  { title: "Trails", flag: "trailsEnabled", body: [["trailLife", "Lifetime, s"], ["trailRatio", "Ratio"], [
    "trailSamples",
    "Max Samples"
  ], ["trailDieWithParticle", "Die with Particles", "check"], ["trailWorld", "World Space Trails", "check"]], params: [["trailWidth", "Width over Trail Multiplier"]] },
  { title: "Renderer", body: [["sprite", "Render Mode", "select"], ["blend", "Blend", "select"], ["sort", "Sort Mode", "select"], ["alignVelocity", "Align to Velocity", "check"], ["flipX", "Random Flip X"], ["flipY", "Random Flip Y"], ["stretch", "Velocity Stretch"], ["glow", "Glow Radius, px"]], extra: "texture" }
];
function preset(name) {
  const s = makeLayer();
  if (name === "snow") {
    Object.assign(s, { shape: "box", boxWidth: 850, boxHeight: 0, y: 0, angle: 90, spread: 10, gravity: 5, noise: 15, sprite: "circle", blend: "source-over", life: parameter(7, 10), speed: parameter(30, 65), size: parameter(2, 7), startColorA: "#ffffff", startColorB: "#d8e9ff", colorKeys: gradient("#ffffff", "#c7dbff"), sizeX: parameter(1), rate: parameter(45), bursts: [] });
  }
  if (name === "rain") {
    Object.assign(s, {
      shape: "line",
      radius: 500,
      y: -5,
      angle: 105,
      spread: 3,
      gravity: 100,
      noiseEnabled: false,
      sprite: "stretched",
      stretch: 0.025,
      life: parameter(1.2, 2),
      speed: parameter(350, 450),
      size: parameter(1, 3),
      rate: parameter(
        120
      ),
      colorKeys: gradient("#c3dfff", "#678dbb"),
      sizeX: parameter(1),
      collisionEnabled: true,
      floor: 96,
      subEnabled: true,
      subEvent: "collision",
      subCount: 3,
      subLife: 0.2,
      subSpeed: 30,
      subSize: 2,
      bursts: []
    });
  }
  if (name === "confetti") {
    Object.assign(s, {
      looping: false,
      shape: "cone",
      spread: 100,
      gravity: 230,
      drag: 0.2,
      noise: 8,
      sprite: "square",
      blend: "source-over",
      life: parameter(3, 5),
      speed: parameter(220, 400),
      size: parameter(5, 12),
      rate: parameter(0),
      bursts: [{
        time: 0,
        min: 300,
        max: 400,
        cycles: 1,
        interval: 1,
        probability: 1
      }],
      startColorA: "#fff5bb",
      startColorB: "#f2c4ff",
      colorRandom: true,
      colorKeys: gradient("#ffe45c", "#e264ab"),
      colorKeys2: gradient("#6bc6e9", "#8b72d4"),
      rotation: parameter(-600, 600),
      sizeX: parameter(1)
    });
  }
  if (name === "fountain") {
    Object.assign(s, {
      y: 95,
      spread: 30,
      gravity: 300,
      drag: 0,
      noiseEnabled: false,
      sprite: "circle",
      life: parameter(
        2,
        3
      ),
      speed: parameter(280, 380),
      size: parameter(2, 6),
      colorKeys: gradient("#d9f6ff", "#51a8e0", "#3076be"),
      collisionEnabled: true,
      floor: 96,
      bounce: 0.3
    });
  }
  if (name === "magic") {
    Object.assign(s, { shape: "circle", y: 50, radius: 30, gravity: 0, speed: parameter(20, 80), size: parameter(3, 8), life: parameter(
      2,
      4
    ), sprite: "star", colorKeys: gradient("#fff6ff", "#b88aff", "#5385dd"), velocityEnabled: true, orbital: parameter(
      65
    ), noise: 25 });
  }
  if (name === "smoke") {
    Object.assign(s, {
      sprite: "glow",
      blend: "source-over",
      gravity: -15,
      life: parameter(3, 5),
      speed: parameter(25, 50),
      size: parameter(25, 50),
      rate: parameter(30),
      colorKeys: [{ t: 0, color: "#8a91a4", alpha: 0 }, { t: 0.2, color: "#8a91a4", alpha: 0.25 }, { t: 1, color: "#444d62", alpha: 0 }],
      sizeX: { ...parameter(1), mode: "curve", keys: keys(
        0.3,
        1,
        2.5
      ) },
      noise: 20,
      bursts: []
    });
  }
  if (name === "explosion") {
    Object.assign(s, {
      looping: false,
      shape: "point",
      y: 50,
      spread: 360,
      gravity: 0,
      drag: 1,
      life: parameter(0.7, 1.5),
      speed: parameter(120, 400),
      rate: parameter(0),
      bursts: [{ time: 0, min: 300, max: 300, cycles: 1, interval: 1, probability: 1 }],
      trailsEnabled: true,
      trailLife: 0.15,
      noiseEnabled: false
    });
  }
  if (name === "fireworks") {
    Object.assign(s, {
      emission: 3,
      looping: true,
      y: 95,
      shape: "point",
      spread: 10,
      gravity: 100,
      life: parameter(
        1.4,
        1.7
      ),
      speed: parameter(280, 320),
      rate: parameter(0),
      bursts: [{ time: 0, min: 3, max: 5, cycles: 1, interval: 1, probability: 1 }],
      subEnabled: true,
      subEvent: "death",
      subCount: 30,
      subLife: 1,
      subSpeed: 160,
      subSize: 5,
      subColor: "#cda0ff",
      trailsEnabled: true,
      trailLife: 0.3,
      colorKeys: gradient("#ffffff", "#f5b76f"),
      noiseEnabled: false
    });
  }
  if (name === "orbit") {
    Object.assign(s, {
      motion: "circle",
      motionX: 180,
      motionY: 90,
      y: 50,
      period: 3,
      shape: "point",
      spread: 360,
      speed: parameter(
        0,
        20
      ),
      life: parameter(0.5, 1.2),
      rate: parameter(0),
      rateDistance: 0.5,
      inheritEnabled: true,
      inherit: 0.2,
      trailsEnabled: true,
      trailLife: 0.5,
      gravity: 0,
      colorKeys: gradient("#d3ffe0", "#5fb7c2", "#7779e0"),
      noiseEnabled: false
    });
  }
  return s;
}
async function particles(root) {
  let project = { format: "GM Particle Studio", version: 2, scene: makeScene(), layers: [makeLayer()] };
  let active = 0;
  let engines = [];
  let textures = [];
  let generation = 0;
  let position = 1;
  let playing = false;
  let exporting = false;
  let cancelled = false;
  let disposed = false;
  let frame;
  let last = 0;
  let rendering = false;
  let pending = false;
  let renderTask = Promise.resolve();
  let history = [];
  let historyIndex = -1;
  let search = "";
  const openModules = /* @__PURE__ */ new Set(["Main", "Emission"]);
  root.innerHTML = `<div class="ps-header panel"><div class="row"><label>Слои эмиттеров<select id="layers"></select></label><button id="addLayer">+ Эмиттер</button><button id="duplicateLayer">Дубликат</button><button id="removeLayer">Удалить</button><button id="upLayer">Выше</button><button id="downLayer">Ниже</button></div><div class="row" style="margin-top:14px">${field("layerName", "Имя слоя", "text", "Emitter 1", 'maxlength="80"')}<label><input id="layerVisible" type="checkbox" checked> Видимый</label><button id="solo">Solo</button><button id="undo">Undo</button><button id="redo">Redo</button></div></div><div class="ps-layout"><section class="panel ps-inspector"><div class="row">${select("preset", "Пресет", [
    ["fire", "Огонь"],
    ["snow", "Снег"],
    ["rain", "Дождь + брызги"],
    ["confetti", "Конфетти"],
    ["fountain", "Фонтан"],
    ["magic", "Магия / орбита"],
    ["smoke", "Дым"],
    ["explosion", "Взрыв"],
    ["fireworks", "Фейерверк / Sub Emitters"],
    ["orbit", "Движущийся эмиттер"]
  ])}<button id="applyPreset">Применить</button><button id="newSeed">Новый seed</button></div><p class="muted">2D Particle Studio. Модули устроены по принципу Unity Shuriken; расчёт — собственный, шаг 1/60 с. Без 3D Mesh, Unity Physics и импорта .prefab.</p>${field(
    "moduleSearch",
    "Поиск модуля",
    "search",
    "",
    'placeholder="Noise, Collision, Trails…"'
  )}<div class="actions"><button id="expand">Развернуть</button><button id="collapse">Свернуть</button></div><div id="inspector"></div></section><div class="ps-right"><section class="panel ps-stage"><div class="checker preview-wrap"><canvas id="scene" aria-label="Сцена системы частиц"></canvas></div><div class="actions"><button id="play" class="primary">Играть</button><button id="pause">Пауза</button><button id="restart">В начало</button><button id="step">+1 кадр</button><label><input id="repeat" type="checkbox" checked> Повтор просмотра</label><label><input id="guides" type="checkbox" checked> Направляющие</label></div><label>Позиция<input id="seek" type="range" min="0" max="6" value="1" step=".001"></label><p id="time" class="muted"></p><p id="stats" class="muted"></p><div class="actions"><button id="png">PNG кадр</button><button id="sequence">PNG sequence</button><button id="gif">GIF</button><button id="mp4">MP4</button><button id="atlas">Sprite Sheet</button><button id="cancel">Отмена экспорта</button></div><p class="muted">Направляющие не попадают в экспорт. MP4 без звука и альфа-канала. PNG — полный alpha, GIF — бинарная прозрачность. До 1800 кадров / 1 млрд пикселей. До 6 слоёв, суммарно 8000 Max Particles. Дочерние эмиттеры — один уровень.</p></section><section class="panel"><h2>Сцена и экспорт</h2><div id="sceneSettings" class="row"></div><div class="row">${field("atlasColumns", "Колонок в Sprite Sheet", "number", 4, 'min="1" max="8" step="1"')}</div><p class="muted">Looping повторяет эмиссию, «Повтор просмотра» повторяет только проигрывание сцены. Prewarm предварительно просчитывает один Duration эмиссии. Curves используют время 0–1; by Speed — общий диапазон из Color by Speed.</p><div class="actions"><button id="saveProject">Скачать проект</button><button id="savePreset">Сохранить пресет в браузере</button></div>${files("project", ".json", false)}<div class="row"><label>Мои пресеты<select id="userPresets"></select></label><button id="loadPreset">Применить мой пресет</button></div><p class="muted">Проект включает все слои и текстуры. Настройки старых проектов particles v0.7 переносятся в новый движок; физика эффекта изменится. Локальные пресеты хранят настройки без текстур. Ctrl+Z / Ctrl+Shift+Z — история, Ctrl+S — проект; Space — запуск/пауза вне полей.</p></section></div></div>`;
  const c = $("scene");
  const ctx = c.getContext("2d");
  const spriteCanvas = document.createElement("canvas");
  const spriteCtx = spriteCanvas.getContext("2d");
  let ownPresets = {};
  try {
    ownPresets = JSON.parse(localStorage.getItem("gm-particle-presets-v2") || "{}");
    if (!ownPresets || Array.isArray(ownPresets) || typeof ownPresets !== "object") {
      ownPresets = {};
    }
  } catch {
    ownPresets = {};
  }
  function updatePresets() {
    $("userPresets").replaceChildren();
    for (const name of Object.keys(ownPresets)) {
      $("userPresets").append(new Option(name, name));
    }
  }
  function updateLayers() {
    $("layers").replaceChildren();
    project.layers.forEach((s, i) => $("layers").append(new Option(
      `${i + 1}. ${s.name}${s.visible ? "" : " (скрыт)"}`,
      String(i)
    )));
    $("layers").value = active;
    $("layerName").value = project.layers[active].name;
    $("layerVisible").checked = project.layers[active].visible;
  }
  function control([key, title, type], s) {
    if (type === "check") {
      return `<label class="ps-check"><input data-value="${key}" type="checkbox" ${s[key] ? "checked" : ""}> ${esc(title)}</label>`;
    }
    if (type === "select") {
      return `<label>${esc(title)}<select data-value="${key}">${choices[key].map((v, i) => `<option value="${v}" ${s[key] === v ? "selected" : ""}>${esc(labels[key][i])}</option>`).join("")}</select></label>`;
    }
    const limits = numericLimits[key];
    return `<label>${esc(title)}<input data-value="${key}" type="${type || "number"}" value="${esc(s[key])}" ${limits ? `min="${limits[0]}" max="${limits[1]}" step="any"` : ""}></label>`;
  }
  function renderInspector() {
    const s = project.layers[active];
    $("inspector").replaceChildren();
    for (const mod of modules) {
      const box = document.createElement("details");
      box.className = "ps-module";
      box.dataset.title = mod.title;
      box.open = openModules.has(mod.title);
      box.hidden = !mod.title.toLowerCase().includes(search.toLowerCase());
      box.innerHTML = `<summary>${mod.flag ? `<input data-enable="${mod.flag}" type="checkbox" ${s[mod.flag] ? "checked" : ""} aria-label="Включить ${mod.title}">` : ""}<span>${mod.title}</span>${mod.flag ? `<small>${s[mod.flag] ? "ON" : "OFF"}</small>` : ""}</summary><div class="ps-module-body"><div class="row">${(mod.body || []).map((d) => control(
        d,
        s
      )).join("")}</div>${mod.note ? `<p class="muted">${mod.note}</p>` : ""}</div>`;
      const body = box.querySelector(".ps-module-body");
      for (const [key, title] of mod.params || []) {
        const host = document.createElement("div");
        host.dataset.parameter = key;
        body.append(host);
        parameterEditor(host, title, s[key], paramRanges[key], commit);
      }
      for (const [key, title] of mod.gradients || []) {
        const host = document.createElement("div");
        body.append(host);
        gradientEditor(host, title, s[key], commit);
      }
      if (mod.extra === "startColor") {
        const row = document.createElement("div");
        row.className = "row";
        row.innerHTML = control(["startColorA", "Start Color A", "color"], s) + control([
          "startColorB",
          "Start Color B",
          "color"
        ], s);
        body.append(row);
        const note = document.createElement("p");
        note.className = "muted";
        note.textContent = "Цвет рождения выбирается между A и B по seed и умножается на градиенты.";
        body.append(note);
      }
      if (mod.extra === "bursts") {
        const host = document.createElement("div");
        host.id = "bursts";
        body.append(host);
        renderBursts(host);
      }
      if (mod.extra === "texture") {
        const host = document.createElement("div");
        host.innerHTML = files("texture", "image/png,image/jpeg,image/webp", false) + `<div class="actions"><button id="clearTexture">Убрать текстуру</button></div><p class="muted">Текстура ${s.textureData ? "встроена" : "не загружена"}. До 10 МБ, сохраняется в PNG до 1024 px. Градиенты тонируют спрайт; Sheet Animation делит его на равные ячейки.</p>`;
        body.append(host);
        host.querySelector("#texture").addEventListener("change", loadTexture);
        host.querySelector("#clearTexture").addEventListener("click", () => {
          s.textureData = "";
          s.sprite = "glow";
          commit();
          renderInspector();
        });
      }
      box.addEventListener("toggle", () => {
        if (box.open) {
          openModules.add(mod.title);
        } else {
          openModules.delete(mod.title);
        }
      });
      $("inspector").append(box);
      const enabled = box.querySelector("[data-enable]");
      if (enabled) {
        enabled.addEventListener("click", (e) => {
          e.stopPropagation();
        });
        enabled.addEventListener("change", () => {
          s[mod.flag] = enabled.checked;
          box.querySelector("summary small").textContent = enabled.checked ? "ON" : "OFF";
          commit();
        });
      }
    }
  }
  function renderBursts(target) {
    const host = target || $("bursts");
    if (!host) {
      return;
    }
    const s = project.layers[active];
    host.innerHTML = `<h3>Bursts · события внутри Duration</h3><div class="table-wrap"><table><thead><tr>${[
      "Time",
      "Min",
      "Max",
      "Cycles",
      "Interval",
      "Probability",
      ""
    ].map((t) => `<th>${t}</th>`).join("")}</tr></thead><tbody>${s.bursts.map((b, i) => `<tr>${["time", "min", "max", "cycles", "interval", "probability"].map((k) => `<td><input aria-label="Burst ${i + 1} ${k}" data-burst="${i}" data-burst-key="${k}" type="number" step="any" value="${b[k]}"></td>`).join("")}<td><button data-remove-burst="${i}">×</button></td></tr>`).join("")}</tbody></table></div><button id="addBurst">+ Burst</button>`;
    host.querySelector("#addBurst").addEventListener("click", () => {
      if (s.bursts.length >= 24) {
        status("До 24 строк Burst.", true);
        return;
      }
      s.bursts.push({ time: Math.min(s.emission - 0.05, 0.5), min: 30, max: 50, cycles: 1, interval: 1, probability: 1 });
      renderBursts();
      commit();
    });
    host.querySelectorAll("[data-remove-burst]").forEach((el) => el.addEventListener("click", () => {
      s.bursts.splice(Number(el.dataset.removeBurst), 1);
      renderBursts();
      commit();
    }));
  }
  function renderScene() {
    const scene = project.scene;
    $("sceneSettings").innerHTML = [["width", "Ширина, px", 128, 1920, 2], [
      "height",
      "Высота, px",
      128,
      1080,
      2
    ], ["duration", "Длительность, s", 0.1, 120, 0.1], ["fps", "FPS", 1, 60, 1]].map(([k, t, min, max, step]) => `<label>${t}<input id="${k}" data-scene="${k}" type="number" min="${min}" max="${max}" step="${step}" value="${scene[k]}"></label>`).join("") + `<label>Фон<input id="background" data-scene="background" type="color" value="${scene.background}"></label><label><input id="transparent" data-scene="transparent" type="checkbox" ${scene.transparent ? "checked" : ""}> Прозрачный PNG / GIF</label>`;
  }
  function snapshot() {
    const json = JSON.stringify(project);
    if (history[historyIndex] === json) {
      return;
    }
    history = history.slice(0, historyIndex + 1);
    history.push(json);
    while (history.length > 24 || history.reduce((n, s) => n + s.length, 0) > 16e6 && history.length > 1) {
      history.shift();
    }
    historyIndex = history.length - 1;
    historyButtons();
  }
  function historyButtons() {
    $("undo").disabled = historyIndex <= 0;
    $("redo").disabled = historyIndex >= history.length - 1;
  }
  function rebuild() {
    const validated = validateProject(project);
    project.scene = validated.scene;
    const previous = engines;
    engines = project.layers.map((s, i) => {
      const valid = validated.layers[i];
      const sig = JSON.stringify({ ...valid, textureData: void 0 }) + JSON.stringify({width: project.scene.width, height: project.scene.height});
      if (previous[i]?.signature === sig) {
        return previous[i];
      }
      return { signature: sig, engine: new ParticleEngine(valid, project.scene) };
    });
    generation += 1;
    c.width = project.scene.width;
    c.height = project.scene.height;
    $("seek").max = project.scene.duration;
    position = Math.min(position, project.scene.duration);
    requestPreview();
  }
  function commit() {
    if (exporting) {
      return;
    }
    playing = false;
    try {
      validateProject(project);
      snapshot();
      rebuild();
      status("");
    } catch (e) {
      status(e.message, true);
    }
  }
  $("inspector").addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.value) {
      const key = el.dataset.value;
      project.layers[active][key] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
      commit();
    }
    if (el.dataset.burst) {
      project.layers[active].bursts[Number(el.dataset.burst)][el.dataset.burstKey] = Number(el.value);
      commit();
    }
  });
  $("sceneSettings").addEventListener("input", (e) => {
    if (e.target.dataset.scene) {
      project.scene[e.target.dataset.scene] = e.target.type === "checkbox" ? e.target.checked : e.target.type === "number" ? Number(e.target.value) : e.target.value;
      commit();
    }
  });
  async function loadTexture() {
    try {
      const file = $("texture").files[0];
      if (!file) {
        return;
      }
      if (file.size > 1e7) {
        throw new Error("Текстура — до 10 МБ.");
      }
      const image = await readImage(file);
      const scale = Math.min(1, 1024 / Math.max(image.width, image.height));
      const pad = document.createElement("canvas");
      pad.width = Math.max(1, Math.round(image.width * scale));
      pad.height = Math.max(1, Math.round(image.height * scale));
      pad.getContext("2d").drawImage(image, 0, 0, pad.width, pad.height);
      image.close();
      const s = project.layers[active];
      s.textureData = pad.toDataURL("image/png");
      s.sprite = "texture";
      await prepareTextures();
      commit();
      renderInspector();
    } catch (e) {
      status(e.message, true);
    }
  }
  async function prepareTextures() {
    const old = textures;
    textures = [];
    try {
      for (const s of project.layers) {
        textures.push(s.textureData ? await createImageBitmap(await (await fetch(s.textureData)).blob()) : null);
      }
    } catch (e) {
      textures.forEach((t) => t?.close());
      textures = old;
      throw e;
    }
    old.forEach((t) => t?.close());
  }
  function trail(points, q, s, time, fade = 1) {
    if (points.length < 2) {
      return;
    }
    ctx.lineCap = "round";
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const age = time - b.time;
      if (age > s.trailLife) {
        continue;
      }
      ctx.strokeStyle = `rgb(${(b.color || q.color).join(",")})`;
      ctx.globalAlpha = (b.alpha ?? q.alpha) * clamp(1 - age / s.trailLife) * fade;
      ctx.lineWidth = Math.max(0.1, (b.size ?? q.sx) * sample(s.trailWidth, i / (points.length - 1), 0.5));
      ctx.beginPath();
      const emitter = !s.trailWorld && s.space === "local" ? emitterAt(s, project.scene, time) : { x: 0, y: 0 };
      ctx.moveTo(a.x + emitter.x, a.y + emitter.y);
      ctx.lineTo(b.x + emitter.x, b.y + emitter.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function sprite(p, q, s, texture) {
    if (q.sx <= 0 || q.sy <= 0 || q.alpha <= 0) {
      return;
    }
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate((s.alignVelocity || s.sprite === "stretched" ? Math.atan2(p.actualVy ?? p.vy, p.actualVx ?? p.vx) : 0) + q.rotation);
    const stretch = s.sprite === "stretched" ? q.speed * s.stretch : 0;
    ctx.scale(p.r[0] < s.flipX ? -1 : 1, p.r[1] < s.flipY ? -1 : 1);
    ctx.globalAlpha = q.alpha;
    const w = q.sx + stretch;
    const h = q.sy;
    const color = `rgb(${q.color.join(",")})`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = s.glow;
    if (s.sprite === "texture" && texture) {
      let sx = 0;
      let sy = 0;
      let sw = texture.width;
      let sh = texture.height;
      if (s.sheetEnabled) {
        sw /= s.sheetCols;
        sh /= s.sheetRows;
        const count = s.sheetMode === "row" ? s.sheetCols : s.sheetCols * s.sheetRows;
        const start = s.sheetRandomStart ? Math.floor(p.r[10] * count) : 0;
        const index = (start + Math.floor(q.u * s.sheetCycles * count)) % count;
        sx = index % s.sheetCols * sw;
        sy = (s.sheetMode === "row" ? s.sheetRow : Math.floor(index / s.sheetCols)) * sh;
      }
      const bw = Math.max(1, Math.min(256, Math.round(sw)));
      const bh = Math.max(1, Math.min(256, Math.round(sh)));
      if (spriteCanvas.width !== bw || spriteCanvas.height !== bh) {
        spriteCanvas.width = bw;
        spriteCanvas.height = bh;
      }
      spriteCtx.clearRect(0, 0, bw, bh);
      spriteCtx.globalCompositeOperation = "source-over";
      spriteCtx.drawImage(texture, sx, sy, sw, sh, 0, 0, bw, bh);
      spriteCtx.globalCompositeOperation = "multiply";
      spriteCtx.fillStyle = color;
      spriteCtx.fillRect(0, 0, bw, bh);
      spriteCtx.globalCompositeOperation = "destination-in";
      spriteCtx.drawImage(texture, sx, sy, sw, sh, 0, 0, bw, bh);
      spriteCtx.globalCompositeOperation = "source-over";
      ctx.drawImage(spriteCanvas, -w / 2, -h / 2, w, h);
    } else if (s.sprite === "square" || s.sprite === "stretched") {
      ctx.fillRect(-w / 2, -h / 2, w, h);
    } else if (s.sprite === "star") {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = i * Math.PI / 5 - Math.PI / 2;
        const r = i % 2 ? 0.4 : 1;
        ctx.lineTo(Math.cos(a) * w / 2 * r, Math.sin(a) * h / 2 * r);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.scale(w / 2, h / 2);
      if (s.sprite === "glow") {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, color);
        g.addColorStop(0.2, color);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
      }
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function guides(s, time) {
    const e = emitterAt(s, project.scene, time);
    ctx.save();
    ctx.strokeStyle = "#9ab2d7";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(e.x - 10, e.y);
    ctx.lineTo(e.x + 10, e.y);
    ctx.moveTo(e.x, e.y - 10);
    ctx.lineTo(e.x, e.y + 10);
    ctx.stroke();
    if (["circle", "ring"].includes(s.shape)) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (["box", "edge"].includes(s.shape)) {
      ctx.strokeRect(e.x - s.boxWidth / 2, e.y - s.boxHeight / 2, s.boxWidth, s.boxHeight);
    }
    if (s.collisionEnabled) {
      ctx.strokeStyle = "#95c7a0";
      if (s.collisionMode === "floor") {
        ctx.beginPath();
        ctx.moveTo(0, project.scene.height * s.floor / 100);
        ctx.lineTo(project.scene.width, project.scene.height * s.floor / 100);
        ctx.stroke();
      } else {
        ctx.strokeRect(1, 1, project.scene.width - 2, project.scene.height - 2);
      }
    }
    if (s.triggerEnabled) {
      ctx.strokeStyle = "#d3bc7e";
      ctx.strokeRect(project.scene.width * s.triggerX / 100 - s.triggerWidth / 2, project.scene.height * s.triggerY / 100 - s.triggerHeight / 2, s.triggerWidth, s.triggerHeight);
    }
    if (s.fieldEnabled) {
      ctx.strokeStyle = "#bc94cf";
      ctx.beginPath();
      ctx.arc(project.scene.width * s.fieldX / 100, project.scene.height * s.fieldY / 100, s.fieldRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  async function draw(time, opaque = false, withGuides = false) {
    const token = generation;
    const current = engines;
    const layers = project.layers.slice();
    for (let i = 0; i < current.length; i += 1) {
      if (layers[i]?.visible) {
        await current[i].engine.seek(time, async () => {
          if (disposed || exporting && cancelled) {
            throw new Error("Расчёт отменён.");
          }
          await sleep();
        });
      }
    }
    if (token !== generation || disposed) {
      return;
    }
    ctx.clearRect(0, 0, c.width, c.height);
    if (!project.scene.transparent || opaque) {
      ctx.fillStyle = project.scene.background;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    let alive = 0;
    let dropped = 0;
    let collisions = 0;
    let triggers = 0;
    let ghost = 0;
    for (let i = 0; i < current.length; i += 1) {
      const s = project.layers[i];
      if (!s.visible) {
        continue;
      }
      const engine = current[i].engine;
      let list = engine.particles;
      alive += list.length;
      dropped += engine.dropped;
      collisions += engine.collisions;
      triggers += engine.triggers;
      ghost += engine.ghosts.length;
      if (s.sort === "youngest") {
        list.reverse();
      }
      if (["smallest", "largest"].includes(s.sort)) {
        list.sort((a, b) => (a.q.sx - b.q.sx) * (s.sort === "largest" ? -1 : 1));
      }
      ctx.globalCompositeOperation = s.blend;
      for (const entry of engine.ghosts) {
        trail(entry.trail, entry.q, s, engine.time, 1 - (engine.time - entry.death) / s.trailLife);
      }
      for (const { p, q } of list) {
        if (s.trailsEnabled) {
          trail(p.trail, q, s, engine.time);
        }
        sprite(p, q, s, textures[i]);
      }
      ctx.globalCompositeOperation = "source-over";
      if (withGuides && i === active) {
        guides(s, engine.time);
      }
    }
    $("seek").value = time;
    $("time").textContent = `${time.toFixed(2)} / ${project.scene.duration.toFixed(2)} s · Seed: ${project.layers[active].seed}`;
    $("stats").textContent = `Alive ${alive} · Trails ${ghost} · Collisions ${collisions} · Triggers ${triggers} · Отсечено Max Particles: ${dropped}`;
  }
  function requestPreview() {
    pending = true;
    if (!rendering) {
      rendering = true;
      renderTask = (async () => {
        try {
          while (pending && !exporting && !disposed) {
            pending = false;
            await draw(position, false, $("guides").checked);
          }
        } catch (e) {
          playing = false;
          status(e.message, true);
        } finally {
          rendering = false;
        }
      })();
    }
    return renderTask;
  }
  async function changedLayer(index) {
    playing = false;
    active = index;
    updateLayers();
    renderInspector();
    requestPreview();
  }
  $("layers").addEventListener("change", () => changedLayer(Number($("layers").value)));
  $("layerName").addEventListener("input", () => {
    project.layers[active].name = $("layerName").value;
    commit();
    $("layers").options[active].textContent = `${active + 1}. ${project.layers[active].name}`;
  });
  $("layerVisible").addEventListener("change", () => {
    project.layers[active].visible = $("layerVisible").checked;
    commit();
    updateLayers();
  });
  action("addLayer", async () => {
    if (project.layers.length >= 6) {
      throw new Error("До 6 слоёв.");
    }
    const layer = makeLayer(`Emitter ${project.layers.length + 1}`);
    layer.maxParticles = Math.min(1e3, 8e3 - project.layers.reduce((n, s) => n + s.maxParticles, 0));
    if (layer.maxParticles < 1) {
      throw new Error("Уменьши Max Particles существующих слоёв.");
    }
    project.layers.push(layer);
    active = project.layers.length - 1;
    await prepareTextures();
    commit();
    updateLayers();
    renderInspector();
  });
  action("duplicateLayer", async () => {
    if (project.layers.length >= 6) {
      throw new Error("До 6 слоёв.");
    }
    const layer = clone(project.layers[active]);
    if (project.layers.reduce((n, s) => n + s.maxParticles, 0) + layer.maxParticles > 8e3) {
      throw new Error("Суммарно до 8000 Max Particles.");
    }
    layer.name += " copy";
    project.layers.push(layer);
    active = project.layers.length - 1;
    await prepareTextures();
    commit();
    updateLayers();
    renderInspector();
  });
  action("removeLayer", async () => {
    if (project.layers.length === 1) {
      throw new Error("Нужен хотя бы один слой.");
    }
    project.layers.splice(active, 1);
    active = Math.min(active, project.layers.length - 1);
    await prepareTextures();
    commit();
    updateLayers();
    renderInspector();
  });
  for (const [id, delta] of [["upLayer", -1], ["downLayer", 1]]) {
    action(id, async () => {
      const index = active + delta;
      if (index < 0 || index >= project.layers.length) {
        return;
      }
      [project.layers[index], project.layers[active]] = [project.layers[active], project.layers[index]];
      active = index;
      await prepareTextures();
      commit();
      updateLayers();
      renderInspector();
    });
  }
  action("solo", () => {
    project.layers.forEach((s, i) => {
      s.visible = i === active;
    });
    commit();
    updateLayers();
  });
  action("applyPreset", async () => {
    const name = project.layers[active].name;
    const seed = project.layers[active].seed;
    const max = project.layers[active].maxParticles;
    project.layers[active] = { ...preset($("preset").value), name, seed, maxParticles: max };
    await prepareTextures();
    commit();
    renderInspector();
  });
  action("newSeed", () => {
    project.layers[active].seed = String(crypto.getRandomValues(new Uint32Array(1))[0]);
    commit();
    renderInspector();
  });
  $("moduleSearch").addEventListener("input", () => {
    search = $("moduleSearch").value;
    for (const box of $("inspector").querySelectorAll("details")) {
      box.hidden = !box.dataset.title.toLowerCase().includes(search.toLowerCase());
    }
  });
  action("expand", () => {
    for (const box of $("inspector").querySelectorAll("details")) {
      if (!box.hidden) {
        box.open = true;
        openModules.add(box.dataset.title);
      }
    }
  });
  action("collapse", () => {
    openModules.clear();
    for (const box of $("inspector").querySelectorAll("details")) {
      box.open = false;
    }
  });
  async function historyMove(delta) {
    const next = historyIndex + delta;
    if (next < 0 || next >= history.length) {
      return;
    }
    const candidate = validateProject(JSON.parse(history[next]));
    playing = false;
    project = candidate;
    historyIndex = next;
    active = Math.min(active, project.layers.length - 1);
    await prepareTextures();
    updateLayers();
    renderInspector();
    renderScene();
    historyButtons();
    rebuild();
  }
  action("undo", () => historyMove(-1));
  action("redo", () => historyMove(1));
  action("play", () => {
    validateProject(project);
    if (position >= project.scene.duration) {
      position = 0;
    }
    playing = true;
    last = performance.now();
  });
  action("pause", () => {
    playing = false;
  });
  action("restart", () => {
    playing = false;
    position = 0;
    requestPreview();
  });
  action("step", () => {
    playing = false;
    position = Math.min(project.scene.duration, position + 1 / project.scene.fps);
    requestPreview();
  });
  $("seek").addEventListener("input", () => {
    playing = false;
    position = Number($("seek").value);
    requestPreview();
  });
  $("guides").addEventListener("change", () => requestPreview());
  async function tick(t) {
    if (disposed) {
      return;
    }
    if (playing && !exporting) {
      position += Math.min(0.25, (t - last) / 1e3);
      if (position >= project.scene.duration) {
        position = $("repeat").checked ? position % project.scene.duration : project.scene.duration;
        if (!$("repeat").checked) {
          playing = false;
        }
      }
      await requestPreview();
    }
    last = t;
    frame = requestAnimationFrame(tick);
  }
  async function lockExport(callback) {
    if (exporting) {
      throw new Error("Дождись экспорта.");
    }
    validateProject(project);
    exporting = true;
    playing = false;
    cancelled = false;
    root.classList.add("ps-exporting");
    const controls = [...root.querySelectorAll("input,select,textarea,button")].filter((el) => el.id !== "cancel");
    const state = controls.map((el) => el.disabled);
    controls.forEach((el) => {
      el.disabled = true;
    });
    try {
      await renderTask;
      if (cancelled || disposed) { return; }
      await callback();
    } finally {
      exporting = false;
      root.classList.remove("ps-exporting");
      controls.forEach((el, i) => {
        el.disabled = state[i];
      });
      historyButtons();
      requestPreview();
    }
  }
  action("png", () => lockExport(async () => {
    await draw(position, false, false);
    download(await toBlob(c), "particle-studio-frame.png");
  }));
  for (const format of ["sequence", "gif", "mp4"]) {
    action(format, () => lockExport(() => exportEffect({ format, settings: { ...project.scene, layers: project.layers, simulationStep: 1 / 60 }, draw: (time, opaque) => draw(time, opaque, false), canvas: c, cancelled: () => cancelled || disposed })));
  }
  action("atlas", () => lockExport(async () => {
    const { JSZip } = await import("../vendor/vendor.js");
    const scene = project.scene;
    const total = Math.ceil(scene.duration * scene.fps - 1e-8);
    const columns = Number($("atlasColumns").value);
    if (!Number.isInteger(columns) || columns < 1 || columns > 8 || columns * scene.width > 8192) {
      throw new Error("Атлас: 1–8 колонок, ширина до 8192 px.");
    }
    if (total > 1800 || scene.width * scene.height * total > 1e9) {
      throw new Error("Лимит 1800 кадров / 1 млрд пикселей.");
    }
    const rows = Math.max(1, Math.min(8, Math.floor(8192 / scene.height), Math.floor(4e7 / (columns * scene.width * scene.height))));
    const perPage = rows * columns;
    const zip = new JSZip();
    const metadata = { format: "GM Particle Atlas", fps: scene.fps, duration: scene.duration, scene: project.scene, layers: project.layers, frames: [] };
    for (let start = 0; start < total; start += perPage) {
      if (cancelled || disposed) {
        status("Экспорт отменён.");
        return;
      }
      const count = Math.min(perPage, total - start);
      const pad = document.createElement("canvas");
      pad.width = columns * scene.width;
      pad.height = Math.ceil(count / columns) * scene.height;
      const pc = pad.getContext("2d");
      const name = `atlas_${String(Math.floor(start / perPage)).padStart(3, "0")}.png`;
      for (let i = 0; i < count; i += 1) {
        if (cancelled || disposed) {
          status("Экспорт отменён.");
          return;
        }
        await draw((start + i) / scene.fps, false, false);
        const x = i % columns * scene.width;
        const y = Math.floor(i / columns) * scene.height;
        pc.drawImage(c, x, y);
        metadata.frames.push({ file: name, index: start + i, time: (start + i) / scene.fps, x, y, width: scene.width, height: scene.height });
        status(`Sprite Sheet: ${start + i + 1}/${total}`);
        await sleep();
      }
      zip.file(name, await toBlob(pad));
    }
    zip.file("atlas.json", JSON.stringify(metadata, null, 2));
    const blob = await zip.generateAsync({ type: "blob" });
    if (!cancelled && !disposed) {
      download(blob, "particle-sprite-sheets.zip");
      status(`Готово: ${total} кадров в атласах PNG.`);
    }
  }));
  action("cancel", () => {
    cancelled = true;
  });
  function save() {
    const data = validateProject(project);
    download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "particle-studio-project-v2.json");
  }
  action("saveProject", save);
  $("project").addEventListener("change", async () => {
    try {
      const file = $("project").files[0];
      if (!file) {
        return;
      }
      if (file.size > 3e7) {
        throw new Error("Проект — до 30 МБ.");
      }
      const candidate = validateProject(JSON.parse(await file.text()));
      const previous = project;
      project = candidate;
      try {
        await prepareTextures();
      } catch (e) {
        project = previous;
        throw e;
      }
      playing = false;
      active = 0;
      position = 0;
      snapshot();
      updateLayers();
      renderInspector();
      renderScene();
      rebuild();
      status("Проект открыт.");
    } catch (e) {
      status(e.message, true);
    }
  });
  action("savePreset", () => {
    validateProject(project);
    const layer = clone(project.layers[active]);
    layer.textureData = "";
    Object.defineProperty(ownPresets, layer.name, { value: layer, writable: true, configurable: true, enumerable: true });
    localStorage.setItem("gm-particle-presets-v2", JSON.stringify(ownPresets));
    updatePresets();
    status("Пресет сохранён без текстуры. Проект сохраняет текстуры полностью.");
  });
  action("loadPreset", async () => {
    const layer = ownPresets[$("userPresets").value];
    if (!layer) {
      throw new Error("Пресет не выбран.");
    }
    const candidate = validateProject({ ...project, layers: project.layers.map((s, i) => i === active ? layer : s) });
    project = candidate;
    await prepareTextures();
    commit();
    updateLayers();
    renderInspector();
  });
  const keyHandler = (e) => {
    const editing = ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (!exporting) {
        save();
      }
      return;
    }
    if (editing || exporting) {
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      historyMove(e.shiftKey ? 1 : -1).catch((err) => status(err.message, true));
    }
    if (e.code === "Space") {
      e.preventDefault();
      playing = !playing;
      last = performance.now();
    }
  };
  document.addEventListener("keydown", keyHandler);
  teardown(() => {
    disposed = true;
    cancelled = true;
    generation += 1;
    cancelAnimationFrame(frame);
    textures.forEach((t) => t?.close());
    document.removeEventListener("keydown", keyHandler);
  });
  updateLayers();
  renderInspector();
  renderScene();
  updatePresets();
  snapshot();
  await prepareTextures();
  rebuild();
  frame = requestAnimationFrame(tick);
}
export {
  particles
};
