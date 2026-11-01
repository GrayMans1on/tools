import { $, select, action, status, teardown, download, toBlob } from "../ui.js";
import { num, readNumber, projectControls, bindProject, canvasPoint, bindPNG } from "../lab-ui.js?v=20261101-v09";
import { gearRatios, clamp } from "../lab-core.js?v=20261101-v09";
async function mechanisms(root) {
  root.innerHTML = `<section class="panel"><div class="row">${select("preset", "Механизм", [["gears", "Пара шестерёнок"], ["reducer", "Редуктор"], ["train", "Ряд передач"], ["belt", "Ременная передача"], ["cross", "Перекрёстный ремень"], ["clock", "Часовой ход"], ["crank", "Кривошип и ползун"], ["fourbar", "Четырёхзвенник"], ["lever", "Качающийся рычаг"]])}<button id="apply">Загрузить</button>${num("rpm", "Обороты ведущего, RPM", 20, -120, 120)}${select("tool", "Мышь", [["move", "Выбрать / двигать"], ["add", "Добавить колесо"], ["mesh", "Зацепить два колеса"], ["belt", "Соединить ремнём"], ["cross", "Перекрёстный ремень"], ["erase", "Удалить колесо"]])}</div><div class="row">${num("teeth", "Зубья выбранного колеса", 24, 8, 80)}<button id="setTeeth">Изменить</button><button id="driver">Сделать ведущим</button>${num("crank", "Кривошип / входное звено", 70, 20, 150)}${num("rod", "Шатун / соединитель", 190, 80, 280)}${num("output", "Выходное звено", 110, 30, 180)}${num("ground", "Межосевое расстояние", 220, 100, 380)}</div><div class="actions"><button id="play" class="primary">Играть</button><button id="pause">Пауза</button><button id="reset">В начало</button><button id="png">PNG</button></div><p class="muted">Это кинематический конструктор: зубчатые и ременные передачи сохраняют передаточное отношение. Зубчатый профиль схематический; силы, люфты и проскальзывание не рассчитываются. Для динамики предназначена физическая песочница. Радиус = зубья × 2 px.</p>${projectControls()}</section><section class="panel"><canvas id="mechanism" width="960" height="600" class="lab-canvas" aria-label="Конструктор механизмов"></canvas><p id="info" class="muted"></p></section>`;
  let nodes = [], links = [], mode = "gears", time = 0, playing = true, selected = null, linkStart = null, drag, frame, last = 0, disposed = false;
  const c = $("mechanism"), ctx = c.getContext("2d");
  const radius = (n) => n.teeth * 2;
  function preset() {
    mode = $("preset").value;
    nodes = [];
    links = [];
    selected = null;
    linkStart = null;
    time = 0;
    const add = (x, y, teeth) => {
      const n = { id: nodes.length + 1, x, y, teeth, driver: nodes.length === 0 };
      nodes.push(n);
      return n;
    };
    if (["gears", "reducer", "train", "clock"].includes(mode)) {
      const counts = mode === "gears" ? [24, 36] : mode === "reducer" ? [12, 48, 20] : mode === "clock" ? [10, 60, 12, 60] : [16, 24, 16, 32];
      let x = 160;
      counts.forEach((t, i) => {
        if (i) {
          x += counts[i - 1] * 2 + t * 2;
        }
        add(x, 300, t);
        if (i) {
          links.push({ a: i, b: i + 1, kind: "mesh" });
        }
      });
    }
    if (["belt", "cross"].includes(mode)) {
      add(300, 300, 24);
      add(650, 300, 40);
      links = [{ a: 1, b: 2, kind: mode }];
    }
    selected = nodes[0] || null;
    draw();
  }
  function wheel(n, angle) {
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.rotate(angle);
    const r = radius(n);
    ctx.beginPath();
    for (let i = 0; i < n.teeth * 4; i += 1) {
      const a = i / (n.teeth * 4) * Math.PI * 2, rr = r + (i % 4 < 2 ? 3 : -3);
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = n.driver ? "#a5c6b2" : "#a6b6d0";
    ctx.strokeStyle = n === selected ? "#2aaa68" : "#6d809e";
    ctx.lineWidth = n === selected ? 3 : 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#f5f7fa";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(r - 9, 0);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#526179";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${n.teeth}T${n.driver ? " · DRIVE" : ""}`, n.x, n.y + r + 23);
  }
  function line(a, b, color = "#788ba7", width = 10) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  function joint(p) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#657791";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  function linkage() {
    const theta = time * Number($("rpm").value) * Math.PI * 2 / 60, a = readNumber("crank", 20, 150), b = readNumber("rod", 80, 280), out = readNumber("output", 30, 180), d = readNumber("ground", 100, 380);
    const origin = { x: 270, y: 300 }, end = { x: origin.x + a * Math.cos(theta), y: origin.y + a * Math.sin(theta) };
    ctx.strokeStyle = "#d3dce8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, a, 0, Math.PI * 2);
    ctx.stroke();
    line(origin, end, "#7fa797", 12);
    joint(origin);
    joint(end);
    if (mode === "crank") {
      if (b < a) {
        throw new Error("Шатун должен быть не короче кривошипа.");
      }
      const slider = { x: end.x + Math.sqrt(Math.max(0, b * b - (end.y - origin.y) ** 2)), y: origin.y };
      line({ x: origin.x + 70, y: origin.y - 25 }, { x: origin.x + a + b + 30, y: origin.y - 25 }, "#d4dce8", 3);
      line({ x: origin.x + 70, y: origin.y + 25 }, { x: origin.x + a + b + 30, y: origin.y + 25 }, "#d4dce8", 3);
      line(end, slider);
      ctx.fillStyle = "#b8a7ca";
      ctx.fillRect(slider.x - 25, slider.y - 18, 50, 36);
      joint(slider);
      $("info").textContent = `Ход ползуна ${(a * 2).toFixed(0)} px · Положение ${(slider.x - origin.x).toFixed(1)} px`;
    } else {
      const fixed = { x: origin.x + d, y: origin.y };
      const dx = fixed.x - end.x, dy = fixed.y - end.y, dist = Math.hypot(dx, dy);
      if (dist > b + out || dist < Math.abs(b - out)) {
        throw new Error("При этом угле звенья не замыкаются. Измени длины или вращай в обратную сторону.");
      }
      const along = (b * b - out * out + dist * dist) / (2 * dist), height = Math.sqrt(Math.max(0, b * b - along * along));
      const meeting = { x: end.x + along * dx / dist - height * dy / dist, y: end.y + along * dy / dist + height * dx / dist };
      line(end, meeting);
      line(meeting, fixed, "#a88cb7");
      line(origin, fixed, "#d0d8e4", 3);
      joint(meeting);
      joint(fixed);
      $("info").textContent = `Угол выходного звена ${(Math.atan2(meeting.y - fixed.y, meeting.x - fixed.x) * 180 / Math.PI).toFixed(1)}°`;
    }
  }
  function draw() {
    ctx.fillStyle = "#f5f7fb";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#e2e7f0";
    ctx.lineWidth = 1;
    for (let x = 0; x < c.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, c.height);
      ctx.stroke();
    }
    try {
      if (["crank", "fourbar", "lever"].includes(mode)) {
        linkage();
        return;
      }
      const ratios = gearRatios(nodes, links);
      for (const link of links) {
        const a = nodes.find((n) => n.id === link.a), b = nodes.find((n) => n.id === link.b);
        if (!a || !b) {
          continue;
        }
        if (link.kind === "mesh") {
          line(a, b, "#d0dbe8", 1);
        } else {
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, sign = link.kind === "cross" ? -1 : 1;
          line({ x: a.x + nx * radius(a), y: a.y + ny * radius(a) }, { x: b.x + nx * radius(b) * sign, y: b.y + ny * radius(b) * sign }, "#75859e", 4);
          line({ x: a.x - nx * radius(a), y: a.y - ny * radius(a) }, { x: b.x - nx * radius(b) * sign, y: b.y - ny * radius(b) * sign }, "#75859e", 4);
        }
      }
      for (const n of nodes) {
        wheel(n, time * Number($("rpm").value) * Math.PI * 2 / 60 * (ratios.get(n.id) || 0));
      }
      const rpm = Number($("rpm").value);
      $("info").textContent = nodes.map((n) => `#${n.id}: ${((ratios.get(n.id) || 0) * rpm).toFixed(2)} RPM`).join(" · ") + (linkStart ? " · Выбери второе колесо" : "");
    } catch (e) {
      playing = false;
      $("info").textContent = e.message;
    }
  }
  c.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (["crank", "fourbar", "lever"].includes(mode)) {
      return;
    }
    const p = canvasPoint(c, e), n = [...nodes].reverse().find((n2) => Math.hypot(n2.x - p.x, n2.y - p.y) < radius(n2) + 8), tool = $("tool").value;
    if (tool === "add") {
      if (nodes.length >= 30) {
        status("До 30 колёс.", true);
        return;
      }
      const next = { id: Math.max(0, ...nodes.map((n2) => n2.id)) + 1, x: p.x, y: p.y, teeth: readNumber("teeth", 8, 80), driver: !nodes.length };
      nodes.push(next);
      selected = next;
    } else if (tool === "erase") {
      if (n) {
        nodes = nodes.filter((v) => v !== n);
        links = links.filter((l) => l.a !== n.id && l.b !== n.id);
        selected = null;
      }
    } else if (["mesh", "belt", "cross"].includes(tool)) {
      if (n) {
        if (linkStart && linkStart !== n) {
          const link = { a: linkStart.id, b: n.id, kind: tool };
          try {
            gearRatios(nodes, [...links, link]);
            links.push(link);
            if (tool === "mesh") {
              const angle = Math.atan2(n.y - linkStart.y, n.x - linkStart.x), distance = radius(n) + radius(linkStart);
              n.x = linkStart.x + Math.cos(angle) * distance;
              n.y = linkStart.y + Math.sin(angle) * distance;
            }
            linkStart = null;
          } catch (e2) {
            status(e2.message, true);
          }
        } else {
          linkStart = n;
        }
      }
    } else if (n) {
      selected = n;
      $("teeth").value = n.teeth;
      drag = { n, dx: p.x - n.x, dy: p.y - n.y };
      c.setPointerCapture(e.pointerId);
    }
    draw();
  });
  c.addEventListener("pointermove", (e) => {
    if (drag) {
      const p = canvasPoint(c, e);
      drag.n.x = clamp(p.x - drag.dx, 20, 940);
      drag.n.y = clamp(p.y - drag.dy, 20, 580);
      draw();
    }
  });
  c.addEventListener("pointerup", () => {
    drag = null;
  });
  c.addEventListener("pointercancel", () => {
    drag = null;
  });
  action("apply", () => {
    if ($("preset").value === "lever") {
      $("crank").value = 35;
      $("rod").value = 220;
      $("output").value = 100;
      $("ground").value = 220;
    }
    if ($("preset").value === "fourbar") {
      $("crank").value = 50;
      $("rod").value = 220;
      $("output").value = 110;
      $("ground").value = 220;
    }
    preset();
  });
  action("setTeeth", () => {
    if (!selected) {
      throw new Error("Выбери колесо.");
    }
    const n = readNumber("teeth", 8, 80);
    if (!Number.isInteger(n)) {
      throw new Error("Число зубьев — целое.");
    }
    selected.teeth = n;
    draw();
  });
  action("driver", () => {
    if (!selected) {
      throw new Error("Выбери колесо.");
    }
    nodes.forEach((n) => {
      n.driver = n === selected;
    });
    draw();
  });
  action("play", () => {
    playing = true;
    last = performance.now();
  });
  action("pause", () => {
    playing = false;
  });
  action("reset", () => {
    time = 0;
    draw();
  });
  bindPNG("png", c, "mechanism.png");
  bindProject("GM Mechanism", () => ({ nodes, links, mode, settings: Object.fromEntries(["rpm", "crank", "rod", "output", "ground"].map((id) => [id, Number($(id).value)])) }), (p) => {
    if (!Array.isArray(p.nodes) || p.nodes.length > 30 || !Array.isArray(p.links) || p.links.length > 60 || !["gears", "reducer", "train", "clock", "belt", "cross", "crank", "fourbar", "lever"].includes(p.mode)) {
      throw new Error("Неверный проект.");
    }
    const ids = /* @__PURE__ */ new Set();
    for (const n of p.nodes) {
      if (!Number.isInteger(n.id) || ids.has(n.id) || ![n.x, n.y, n.teeth].every(Number.isFinite) || n.x < 0 || n.x > 960 || n.y < 0 || n.y > 600 || n.teeth < 8 || n.teeth > 80 || !Number.isInteger(n.teeth)) {
        throw new Error("Повреждённое колесо.");
      }
      ids.add(n.id);
    }
    for (const l of p.links) {
      if (!ids.has(l.a) || !ids.has(l.b) || !["mesh", "belt", "cross"].includes(l.kind)) {
        throw new Error("Повреждённая передача.");
      }
    }
    gearRatios(p.nodes, p.links);
    for (const id of ["rpm", "crank", "rod", "output", "ground"]) {
      $(id).value = p.settings?.[id] ?? Number($(id).value);
    }
    readNumber("rpm", -120, 120);
    nodes = p.nodes;
    links = p.links;
    mode = p.mode;
    playing = false;
    time = 0;
    draw();
  });
  function tick(t) {
    if (disposed) {
      return;
    }
    if (playing) {
      time += Math.min(0.05, (t - last) / 1e3);
      draw();
    }
    last = t;
    frame = requestAnimationFrame(tick);
  }
  teardown(() => {
    disposed = true;
    cancelAnimationFrame(frame);
  });
  preset();
  frame = requestAnimationFrame(tick);
}
export {
  mechanisms
};
