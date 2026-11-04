import { setupTextureChecker } from './texture-checker.js?v=20261104-textures';
import { $, field, select, files, action, status, download, toBlob, readImage, esc } from "../ui.js";
import { num, readNumber, projectControls, bindProject, canvasPoint, bindPNG, safe } from "../lab-ui.js?v=20261101-v09";
import { textureField, mapHeight, riverPaths, clamp, lerp } from "../lab-core.js?v=20261101-v09";
import { seeded } from "../effects-core.js?v=20261101-v09";
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
async function textures(root) {
  const presets = [["clouds", "Облака", "noise", "#303d5b", "#e6e9f3", 4], ["marble", "Мрамор", "marble", "#414b62", "#eff1f7", 4], ["wood", "Дерево", "wood", "#604232", "#c59b63", 2], ["bricks", "Кирпич", "bricks", "#353c49", "#b27b68", 8], ["fabric", "Ткань", "fabric", "#586b89", "#c9d7df", 8], ["stone", "Камень", "stone", "#555e6a", "#bfc1b2", 5], ["checker", "Шахматка", "checker", "#282d3c", "#dce2ed", 8], ["dots", "Горошек", "dots", "#d9e4db", "#658b79", 8], ["grid", "Сетка", "grid", "#f1f3f8", "#7c8ca7", 8], ["waves", "Волны", "waves", "#385b7a", "#b5d4ce", 4], ["lava", "Лава", "marble", "#2c2228", "#ff9c41", 6], ["alien", "Инопланетная", "noise", "#382b58", "#73d8bc", 9]];
  root.innerHTML = `<section class="panel"><div class="row">${select("preset", "Пресет", presets.map((p) => [p[0], p[1]]))}<button id="apply">Применить</button>${field("seed", "Seed", "text", "Tile-42")}${select("kind", "Рисунок", [["noise", "Шум / облака"], ["marble", "Мрамор"], ["wood", "Дерево"], ["bricks", "Кирпич"], ["fabric", "Ткань"], ["stone", "Камень"], ["checker", "Шахматка"], ["dots", "Горошек"], ["grid", "Сетка"], ["waves", "Волны"]])}</div><div class="row">${num("size", "Размер тайла", 512, 64, 1024)}${num("scale", "Повторов", 4, 2, 32, 2)}${num("detail", "Октавы", 4, 1, 6)}${num("contrast", "Контраст", 1, 0.1, 4, 0.1)}${field("colorA", "Цвет A", "color", "#303d5b")}${field("colorB", "Цвет B", "color", "#e6e9f3")}</div><p class="muted">Периодические функции повторяются без разрыва. Для кирпича число рядов чётное. Свой мотив накладывается с переносом через края тайла.</p>${files("stamp", "image/png,image/jpeg,image/webp", false)}<div class="row">${num("stampScale", "Размер мотива, %", 35, 5, 100)}${num("rotation", "Поворот мотива, °", 0, -180, 180)}<button id="clearStamp">Убрать мотив</button></div><div class="actions"><button id="generate" class="primary">Построить</button><button id="randomSeed">Другой seed</button><button id="png">Тайл PNG</button><button id="previewPNG">Повторение PNG</button><button id="normal">Normal Map PNG</button></div>${projectControls()}</section><div class="two"><section class="panel"><h2>Один тайл</h2><canvas id="tile"></canvas></section><section class="panel"><h2>Проверка повторения · 3 × 3</h2><canvas id="repeat"></canvas></section></div>`;
  setupTextureChecker(root);
  let values, heights, stampData = "", stamp;
  const tile = $("tile"), ctx = tile.getContext("2d");
  const ids = ["seed", "kind", "size", "scale", "detail", "contrast", "colorA", "colorB", "stampScale", "rotation"];
  function config() {
    const s = { seed: $("seed").value, kind: $("kind").value, size: readNumber("size", 64, 1024), scale: readNumber("scale", 2, 32), detail: readNumber("detail", 1, 6), contrast: readNumber("contrast", 0.1, 4), colorA: $("colorA").value, colorB: $("colorB").value, stampScale: readNumber("stampScale", 5, 100), rotation: readNumber("rotation", -180, 180) };
    if (!Number.isInteger(s.size) || !Number.isInteger(s.detail) || s.scale % 2 || s.seed.length > 200 || !presets.some((p) => p[2] === s.kind)) {
      throw new Error("Размер и октавы — целые, повторы — чётные, seed до 200 знаков.");
    }
    return s;
  }
  function generate() {
    values = config();
    const s = values;
    heights = textureField(s.size, s.kind, s.scale, s.seed, s.detail);
    tile.width = s.size;
    tile.height = s.size;
    const img = ctx.createImageData(s.size, s.size), a = rgb(s.colorA), b = rgb(s.colorB);
    for (let i = 0; i < heights.length; i += 1) {
      const v = clamp((heights[i] - 0.5) * s.contrast + 0.5);
      for (let j = 0; j < 3; j += 1) {
        img.data[i * 4 + j] = lerp(a[j], b[j], v);
      }
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    if (stamp) {
      const extent = s.size * s.stampScale / 100, w = extent * stamp.width / Math.max(stamp.width, stamp.height), h = extent * stamp.height / Math.max(stamp.width, stamp.height);
      for (let y = -1; y <= 1; y += 1) {
        for (let x = -1; x <= 1; x += 1) {
          ctx.save();
          ctx.translate(s.size * (0.5 + x), s.size * (0.5 + y));
          ctx.rotate(s.rotation * Math.PI / 180);
          ctx.drawImage(stamp, -w / 2, -h / 2, w, h);
          ctx.restore();
        }
      }
    }
    const c = $("repeat");
    c.width = s.size * 3;
    c.height = s.size * 3;
    const pc = c.getContext("2d");
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        pc.drawImage(tile, x * s.size, y * s.size);
      }
    }
    status(`Тайл ${s.size} × ${s.size}. Normal Map строится по процедурной высоте, без накладываемого мотива.`);
  }
  action("generate", generate);
  action("randomSeed", () => {
    $("seed").value = String(crypto.getRandomValues(new Uint32Array(1))[0]);
    generate();
  });
  $("preset").addEventListener("change", () => {
  });
  action("apply", () => {
    const p = presets.find((p2) => p2[0] === $("preset").value);
    for (const [k, v] of Object.entries({ kind: p[2], colorA: p[3], colorB: p[4], scale: p[5] })) {
      $(k).value = v;
    }
    generate();
  });
  bindPNG("png", tile, "seamless-tile.png");
  bindPNG("previewPNG", $("repeat"), "seamless-repeat.png");
  action("normal", async () => {
    if (!heights) {
      generate();
    }
    const n = values.size, c = document.createElement("canvas");
    c.width = n;
    c.height = n;
    const pc = c.getContext("2d"), im = pc.createImageData(n, n);
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        const at = (a, b) => heights[(b + n) % n * n + (a + n) % n];
        const dx = (at(x + 1, y) - at(x - 1, y)) * 4, dy = (at(x, y + 1) - at(x, y - 1)) * 4, len = Math.hypot(dx, dy, 1), i = (y * n + x) * 4;
        im.data[i] = (-dx / len * 0.5 + 0.5) * 255;
        im.data[i + 1] = (-dy / len * 0.5 + 0.5) * 255;
        im.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
        im.data[i + 3] = 255;
      }
    }
    pc.putImageData(im, 0, 0);
    download(await toBlob(c), "tile-normal-map.png");
  });
  $("stamp").addEventListener("change", async () => {
    try {
      const f = $("stamp").files[0];
      if (!f) {
        return;
      }
      if (f.size > 1e7) {
        throw new Error("Мотив до 10 МБ.");
      }
      const im = await readImage(f);
      const c = document.createElement("canvas");
      const scale = Math.min(1, 512 / Math.max(im.width, im.height));
      c.width = Math.max(1, Math.round(im.width * scale));
      c.height = Math.max(1, Math.round(im.height * scale));
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      im.close();
      stamp?.close();
      stamp = await createImageBitmap(await toBlob(c));
      stampData = c.toDataURL("image/png");
      generate();
    } catch (e) {
      status(e.message, true);
    }
  });
  action("clearStamp", () => {
    stamp?.close();
    stamp = null;
    stampData = "";
    generate();
  });
  bindProject("GM Texture", () => ({ settings: config(), stampData }), async (p) => {
    if (!p.settings || p.stampData && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(p.stampData)) {
      throw new Error("Повреждён проект.");
    }
    const previous = Object.fromEntries(ids.map((id) => [id, $(id).value]));
    try {
      for (const id of ids) {
        if (p.settings[id] != null) {
          $(id).value = p.settings[id];
        }
      }
      config();
    } catch (e) {
      for (const id of ids) {
        $(id).value = previous[id];
      }
      throw e;
    }
    const next = p.stampData ? await createImageBitmap(await (await fetch(p.stampData)).blob()) : null;
    stamp?.close();
    stamp = next;
    stampData = p.stampData || "";
    generate();
  });
  generate();
  status("");
}
async function terrain(root) {
  const kinds = [["island", "Остров"], ["archipelago", "Архипелаг"], ["continent", "Континент"], ["volcano", "Вулкан"], ["lake", "Внутреннее озеро"], ["ridge", "Горный хребет"], ["desert", "Пустыня"], ["snow", "Снежный край"], ["alien", "Чужая планета"], ["plains", "Равнины"]];
  root.innerHTML = `<section class="panel"><div class="row">${select("preset", "Тип местности", kinds)}${field("seed", "Seed", "text", "Atlas-42")}${num("size", "Разрешение", 512, 128, 1024)}${num("scale", "Масштаб рельефа", 3, 1, 10)}${num("sea", "Уровень моря", 0.38, 0.05, 0.8, 0.01)}${num("rivers", "Истоки рек", 8, 0, 30)}${num("towns", "Поселения", 7, 0, 20)}</div><div class="row">${select("style", "Оформление", [["atlas", "Атлас"], ["paper", "Бумажная"], ["height", "Рельеф"], ["night", "Ночная"]])}<label><input id="contours" type="checkbox"> Горизонтали</label>${select("mode", "Мышь", [["pan", "Перемещение"], ["town", "Добавить поселение"], ["erase", "Убрать ближайшую метку"]])}${field("townName", "Название новой метки", "text", "Новое место", 'maxlength="60"')}</div><div class="actions"><button id="generate" class="primary">Построить карту</button><button id="randomSeed">Другой seed</button><button id="resetView">Сбросить вид</button><button id="png">Карта PNG</button><button id="heightPNG">Heightmap PNG</button><button id="svg">SVG с метками</button></div><p class="muted">Реки спускаются по высоте до моря или локальной впадины. Колесо — масштаб, перетаскивание — перемещение. Метки редактируются в списке. Экспорт сохраняет всю карту.</p>${projectControls()}</section><section class="panel"><canvas id="map" width="960" height="640" class="lab-canvas" aria-label="Карта местности"></canvas><div id="places" class="chips"></div></section>`;
  let settings, height, rivers = [], places = [], view = { x: 0, y: 0, zoom: 1 };
  const c = $("map"), ctx = c.getContext("2d"), raster = document.createElement("canvas");
  function config() {
    const s = { kind: $("preset").value, seed: $("seed").value, size: readNumber("size", 128, 1024), scale: readNumber("scale", 1, 10), sea: readNumber("sea", 0.05, 0.8), rivers: readNumber("rivers", 0, 30), towns: readNumber("towns", 0, 20), style: $("style").value, contours: $("contours").checked };
    if (![s.size, s.scale, s.rivers, s.towns].every(Number.isInteger) || s.seed.length > 200 || !kinds.some((k) => k[0] === s.kind) || !["atlas", "paper", "height", "night"].includes(s.style)) {
      throw new Error("Проверь настройки карты.");
    }
    return s;
  }
  function generate(keep = false) {
    settings = config();
    height = mapHeight(settings.size, settings.seed, settings.kind, settings.scale);
    rivers = riverPaths(height, settings.size, settings.sea, settings.rivers, settings.seed + "r");
    if (!keep) {
      places = [];
      const r = seeded(settings.seed + "towns");
      const names = ["Лист", "Берег", "Камень", "Мыс", "Ручей", "Сосны", "Холм", "Тихий", "Дальний", "Лунный"];
      for (let i = 0; i < settings.towns; i += 1) {
        for (let tries = 0; tries < 500; tries += 1) {
          const x = Math.floor(r() * settings.size), y = Math.floor(r() * settings.size), v = height[y * settings.size + x];
          if (v > settings.sea + 0.02 && v < 0.67 && places.every((p) => Math.hypot(p.x - x, p.y - y) > settings.size * 0.07)) {
            places.push({ x, y, name: names[i % names.length] + (i >= names.length ? ` ${i + 1}` : "") });
            break;
          }
        }
      }
    }
    paintRaster();
    view = { x: 0, y: 0, zoom: 1 };
    renderPlaces();
    draw();
    status(`${places.length} поселений · ${rivers.length} русел.`);
  }
  function paintRaster() {
    const n = settings.size;
    raster.width = n;
    raster.height = n;
    const rc = raster.getContext("2d"), im = rc.createImageData(n, n);
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        const i = y * n + x, v = height[i], s = settings;
        let col;
        if (s.style === "height") {
          col = [v * 255, v * 255, v * 255];
        } else if (v < s.sea) {
          col = s.style === "paper" ? [169, 192, 191] : s.style === "night" ? [21, 37, 65] : [47 + v * 50, 90 + v * 60, 125 + v * 70];
        } else {
          const t = (v - s.sea) / (1 - s.sea);
          if (s.kind === "desert") {
            col = [208 - t * 50, 184 - t * 65, 127 - t * 55];
          } else if (s.kind === "alien") {
            col = [120 + t * 30, 100 + t * 45, 155 + t * 40];
          } else if (s.kind === "snow") {
            col = [190 + t * 60, 210 + t * 40, 220 + t * 30];
          } else {
            col = t < 0.12 ? [196, 193, 145] : t < 0.5 ? [106 - t * 40, 145 - t * 35, 105 - t * 25] : t < 0.8 ? [130 + t * 25, 129 + t * 20, 120 + t * 25] : [225, 230, 230];
          }
          if (s.style === "paper") {
            col = col.map((v2, i2) => lerp(v2, [223, 212, 177][i2], 0.5));
          }
          if (s.style === "night") {
            col = col.map((v2) => v2 * 0.55);
          }
        }
        const dx = (height[y * n + Math.max(0, x - 1)] - height[y * n + Math.min(n - 1, x + 1)]) * 10;
        const dy = (height[Math.max(0, y - 1) * n + x] - height[Math.min(n - 1, y + 1) * n + x]) * 10;
        let shade = clamp(1 + dx + dy, 0.65, 1.3);
        if (s.contours && v > s.sea && Math.floor(v * 35) !== Math.floor((height[i + 1] ?? v) * 35)) {
          shade *= 0.65;
        }
        for (let k = 0; k < 3; k += 1) {
          im.data[i * 4 + k] = clamp(col[k] * shade, 0, 255);
        }
        im.data[i * 4 + 3] = 255;
      }
    }
    rc.putImageData(im, 0, 0);
    rc.strokeStyle = settings.style === "night" ? "#8eb4d0" : "#7bb3cd";
    rc.lineWidth = Math.max(1, n / 400);
    for (const river of rivers) {
      rc.beginPath();
      river.forEach((p, i) => {
        if (!i) {
          rc.moveTo(p.x, p.y);
        } else {
          rc.lineTo(p.x, p.y);
        }
      });
      rc.stroke();
    }
  }
  function drawMap(target, size) {
    target.drawImage(raster, 0, 0, size, size);
    target.font = `${Math.max(10, size / 48)}px Georgia`;
    target.textAlign = "left";
    for (const p of places) {
      const x = p.x / settings.size * size, y = p.y / settings.size * size;
      target.fillStyle = "#f9eee1";
      target.strokeStyle = "#48516a";
      target.lineWidth = 1;
      target.beginPath();
      target.arc(x, y, Math.max(2, size / 180), 0, Math.PI * 2);
      target.fill();
      target.stroke();
      target.lineWidth = 3;
      target.strokeStyle = settings.style === "night" ? "#182434" : "#f2ead7";
      target.strokeText(p.name, x + 5, y - 5);
      target.fillStyle = settings.style === "night" ? "#eeeeed" : "#353f4b";
      target.fillText(p.name, x + 5, y - 5);
    }
  }
  function draw() {
    ctx.fillStyle = "#edf0f6";
    ctx.fillRect(0, 0, c.width, c.height);
    const size = Math.min(c.width, c.height) - 30;
    ctx.save();
    ctx.translate((c.width - size) / 2 + view.x, 15 + view.y);
    ctx.scale(view.zoom, view.zoom);
    drawMap(ctx, size);
    ctx.restore();
  }
  function renderPlaces() {
    $("places").replaceChildren();
    places.forEach((p, i) => {
      const label = document.createElement("label");
      label.textContent = `${i + 1}. `;
      const input = document.createElement("input");
      input.value = p.name;
      input.maxLength = 60;
      input.addEventListener("input", () => {
        p.name = input.value;
        draw();
      });
      label.append(input);
      $("places").append(label);
    });
  }
  action("generate", () => generate());
  action("randomSeed", () => {
    $("seed").value = String(crypto.getRandomValues(new Uint32Array(1))[0]);
    generate();
  });
  action("resetView", () => {
    view = { x: 0, y: 0, zoom: 1 };
    draw();
  });
  const full = () => {
    const out = document.createElement("canvas");
    out.width = settings.size;
    out.height = settings.size;
    drawMap(out.getContext("2d"), settings.size);
    return out;
  };
  action("png", async () => download(await toBlob(full()), "terrain-map.png"));
  action("heightPNG", async () => {
    const n = settings.size, out = document.createElement("canvas");
    out.width = n;
    out.height = n;
    const rc = out.getContext("2d"), im = rc.createImageData(n, n);
    for (let i = 0; i < height.length; i += 1) {
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = height[i] * 255;
      im.data[i * 4 + 3] = 255;
    }
    rc.putImageData(im, 0, 0);
    download(await toBlob(out), "terrain-heightmap.png");
  });
  action("svg", () => {
    const n = settings.size;
    const labels = places.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#fff" stroke="#444"/><text x="${p.x + 6}" y="${p.y - 5}" font-size="12" font-family="Georgia" fill="#303847" stroke="#f3efdf" stroke-width="2" paint-order="stroke">${esc(p.name)}</text>`).join("");
    download(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 ${n} ${n}"><image width="${n}" height="${n}" href="${raster.toDataURL()}"/>${labels}</svg>`], { type: "image/svg+xml" }), "terrain-map.svg");
  });
  let drag;
  c.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const p = canvasPoint(c, e);
    const size = Math.min(c.width, c.height) - 30;
    const x = (p.x - (c.width - size) / 2 - view.x) / view.zoom / size * settings.size, y = (p.y - 15 - view.y) / view.zoom / size * settings.size;
    if ($("mode").value === "town") {
      if (x >= 0 && y >= 0 && x < settings.size && y < settings.size && places.length < 30) {
        places.push({ x, y, name: $("townName").value.slice(0, 60) || "Метка" });
        renderPlaces();
        draw();
      }
    } else if ($("mode").value === "erase") {
      let index = -1, d = Infinity;
      places.forEach((v, i) => {
        const dist = Math.hypot(v.x - x, v.y - y);
        if (dist < d) {
          d = dist;
          index = i;
        }
      });
      if (index >= 0 && d < settings.size * 0.08) {
        places.splice(index, 1);
        renderPlaces();
        draw();
      }
    } else {
      drag = { p, x: view.x, y: view.y };
      c.setPointerCapture(e.pointerId);
    }
  });
  c.addEventListener("pointermove", (e) => {
    if (drag) {
      const p = canvasPoint(c, e);
      view.x = drag.x + p.x - drag.p.x;
      view.y = drag.y + p.y - drag.p.y;
      draw();
    }
  });
  c.addEventListener("pointerup", () => {
    drag = null;
  });
  c.addEventListener("pointercancel", () => {
    drag = null;
  });
  c.addEventListener("wheel", (e) => {
    e.preventDefault();
    view.zoom = clamp(view.zoom * Math.exp(-e.deltaY * 1e-3), 0.4, 8);
    draw();
  }, { passive: false });
  bindProject("GM Terrain", () => ({ settings, places }), (p) => {
    if (!p.settings || !Array.isArray(p.places) || p.places.length > 30 || p.places.some((v) => !Number.isFinite(v.x + v.y) || typeof v.name !== "string" || v.name.length > 60)) {
      throw new Error("Повреждён проект карты.");
    }
    for (const [id, key] of [["preset", "kind"], ["seed", "seed"], ["size", "size"], ["scale", "scale"], ["sea", "sea"], ["rivers", "rivers"], ["towns", "towns"], ["style", "style"]]) {
      $(id).value = p.settings[key];
    }
    $("contours").checked = p.settings.contours === true;
    config();
    places = p.places;
    generate(true);
  });
  generate();
}
export {
  terrain,
  textures
};
