import { $, select, field, action, status, download, toBlob, teardown } from "../ui.js";
import { num, readNumber, projectControls, bindProject, canvasPoint, safe } from "../lab-ui.js?v=20261101-v09";
import { paperMesh, paperNet, netSVG, projectMesh } from "../paper-core.js?v=20261101-v09";
async function paper(root) {
  const shapes = [["cube", "Куб"], ["box", "Коробка"], ["tetra", "Тетраэдр"], ["octa", "Октаэдр"], ["pyramid", "Пирамида"], ["triPrism", "Треугольная призма"], ["hexPrism", "Шестигранная призма"], ["cylinder", "12-гранный цилиндр"]];
  root.innerHTML = `<section class="panel"><div class="row">${select("shape", "Модель", shapes)}${num("size", "Ребро основания, мм", 30, 10, 100)}${num("depth", "Глубина / высота, ×", 1, 0.3, 3, 0.1)}${num("tabs", "Клапан, мм", 4, 1, 10)}${field("color", "Цвет граней", "color", "#b5c9df")}<label><input id="numbers" type="checkbox" checked> Номера граней и швов</label></div><div class="actions"><button id="build" class="primary">Построить</button><button id="resetView">Сбросить 3D-вид</button><button id="svg">Развёртка SVG</button><button id="pdf">Развёртка PDF</button><button id="png">3D-вид PNG</button></div><p class="muted">В 3D: перетаскивание вращает модель, колесо приближает. SVG и PDF сохраняют размеры в миллиметрах; печатай 100%, без подгонки. Сплошные линии — резать, пунктир — сгибать. Числа на швах обозначают склеиваемые пары. PDF имеет страницу по размеру развёртки.</p>${projectControls()}</section><div class="two"><section class="panel"><h2>Модель · вращение и масштаб</h2><canvas id="model" width="640" height="520" class="lab-canvas" aria-label="Вращаемая бумажная модель"></canvas><label><input id="rotate" type="checkbox"> Автовращение</label></section><section class="panel"><h2>Развёртка</h2><div id="net" class="paper-net"></div><p id="dimensions" class="muted"></p></section></div>`;
  let settings, mesh, net, svg, rx = -0.4, ry = 0.6, zoom = 190, drag, frame, disposed = false;
  const c = $("model"), ctx = c.getContext("2d");
  function config() {
    const s = { shape: $("shape").value, size: readNumber("size", 10, 100), depth: readNumber("depth", 0.3, 3), tabs: readNumber("tabs", 1, 10), color: $("color").value, numbers: $("numbers").checked };
    if (!shapes.some((v) => v[0] === s.shape)) {
      throw new Error("Неизвестная модель.");
    }
    return s;
  }
  function build() {
    const s = config(), m = paperMesh(s.shape, s.size, s.shape === "cube" ? 1 : s.depth), n = paperNet(m, s.tabs);
    settings = s;
    mesh = m;
    net = n;
    svg = netSVG(mesh, net, s.color, s.numbers);
    $("net").innerHTML = svg;
    $("dimensions").textContent = `${net.width.toFixed(1)} × ${net.height.toFixed(1)} мм · ${mesh.faces.length} граней${net.omitted ? ` · ${net.omitted} клапанов не поместилось: эти швы склеиваются отдельными полосками` : ""}`;
    draw();
    status("Развёртка без пересечений граней построена.");
  }
  function draw() {
    ctx.fillStyle = "#f5f7fb";
    ctx.fillRect(0, 0, c.width, c.height);
    const faces = projectMesh(mesh, rx, ry, zoom);
    for (const f of faces) {
      const poly = f.points.map((p) => [c.width / 2 + p[0], c.height / 2 - p[1]]);
      ctx.beginPath();
      poly.forEach((p, i) => {
        if (!i) {
          ctx.moveTo(...p);
        } else {
          ctx.lineTo(...p);
        }
      });
      ctx.closePath();
      ctx.fillStyle = settings.color;
      ctx.globalAlpha = 0.65 + f.index % 3 * 0.12;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#65788f";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (settings.numbers) {
        const x = poly.reduce((s, p) => s + p[0], 0) / poly.length, y = poly.reduce((s, p) => s + p[1], 0) / poly.length;
        ctx.fillStyle = "#38485d";
        ctx.font = "18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(f.index + 1), x, y);
      }
    }
  }
  action("build", build);
  action("resetView", () => {
    rx = -0.4;
    ry = 0.6;
    zoom = 190;
    draw();
  });
  action("svg", () => download(new Blob([svg], { type: "image/svg+xml" }), "paper-model-net.svg"));
  action("png", async () => download(await toBlob(c), "paper-model-3d.png"));
  action("pdf", async () => {
    const { PDFDocument } = await import("../vendor/vendor.js");
    const doc = await PDFDocument.create();
    const factor = 72 / 25.4, page = doc.addPage([net.width * factor, net.height * factor]);
    const move = (p) => ({ x: (p[0] - net.min[0] + 6) * factor, y: (net.height - (p[1] - net.min[1] + 6)) * factor });
    const line = (a, b, dash = false) => page.drawLine({ start: move(a), end: move(b), thickness: 0.5, ...dash ? { dashArray: [3, 2] } : {} });
    const folds = new Set(net.folds), tabs = new Map(net.tabs.map((t) => [t.key, t])), done = /* @__PURE__ */ new Set();
    for (const e of net.edges) {
      if (folds.has(e.key)) {
        if (done.has(e.key)) {
          continue;
        }
        done.add(e.key);
        line(e.a, e.b, true);
      } else if (tabs.get(e.key)?.face === e.face) {
        const p = tabs.get(e.key).points;
        for (let i = 0; i < 3; i += 1) {
          line(p[i], p[i + 1]);
        }
        line(e.a, e.b, true);
      } else {
        line(e.a, e.b);
      }
    }
    if (settings.numbers) {
      net.polygons.forEach((p, i) => {
        const q = move([p.reduce((s, v) => s + v[0], 0) / p.length, p.reduce((s, v) => s + v[1], 0) / p.length]);
        page.drawText(String(i + 1), { x: q.x - 3, y: q.y, size: 9 });
      });
      for (const e of net.labels) {
        const q = move([(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2]);
        page.drawText(String(e.label), { x: q.x, y: q.y, size: 5 });
      }
    }
    download(new Blob([await doc.save()], { type: "application/pdf" }), "paper-model-net.pdf");
  });
  c.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    drag = { p: canvasPoint(c, e), rx, ry };
    c.setPointerCapture(e.pointerId);
  });
  c.addEventListener("pointermove", (e) => {
    if (drag) {
      const p = canvasPoint(c, e);
      rx = drag.rx + (p.y - drag.p.y) * 0.01;
      ry = drag.ry + (p.x - drag.p.x) * 0.01;
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
    zoom = Math.max(60, Math.min(400, zoom * Math.exp(-e.deltaY * 1e-3)));
    draw();
  }, { passive: false });
  function tick() {
    if (disposed) {
      return;
    }
    if ($("rotate").checked && !drag) {
      ry += 6e-3;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  bindProject("GM Paper", () => ({ settings }), (p) => {
    if (!p.settings) {
      throw new Error("Повреждён проект.");
    }
    for (const id of ["shape", "size", "depth", "tabs", "color"]) {
      $(id).value = p.settings[id];
    }
    $("numbers").checked = p.settings.numbers === true;
    build();
  });
  teardown(() => {
    disposed = true;
    cancelAnimationFrame(frame);
  });
  build();
  frame = requestAnimationFrame(tick);
}
export {
  paper
};
