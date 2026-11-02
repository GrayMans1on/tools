import {extraPhysicsPresets, buildPhysicsExtra, fluidForces} from '../physics-extra.js?v=20261102-v11';
import { $, select, field, action, status, teardown, download, toBlob } from "../ui.js";
import { num, readNumber, projectControls, bindProject, canvasPoint, bindPNG } from "../lab-ui.js?v=20261101-v09";
import { clamp } from "../lab-core.js?v=20261101-v09";
import { Matter as M } from "../vendor/physics.js";
async function physics(root) {
  root.innerHTML = `<section class="panel"><div class="row">${select("preset", "Пресет", [...extraPhysicsPresets, ["stack", "Падающая башня"], ["domino", "Домино"], ["pendulum", "Маятники"], ["cradle", "Колыбель Ньютона"], ["bridge", "Подвесной мост"], ["springs", "Пружины"], ["chain", "Цепь"], ["catapult", "Рычаг"], ["motor", "Мотор и шарнир"], ["balls", "Упругие шары"], ["ramp", "Наклонные плоскости"], ["empty", "Пустая сцена"]])}<button id="apply">Загрузить пресет</button>${select("tool", "Инструмент", [["drag", "Выбрать / тащить"], ["circle", "Шар"], ["fluid", "Жидкость · порция"], ["rect", "Прямоугольник"], ["triangle", "Треугольник"], ["bar", "Брус"], ["wall", "Статичная стенка"], ["spring", "Пружина между телами"], ["rope", "Жёсткая связь"], ["pin", "Шарнир в точке клика"], ["erase", "Удалить"]])}</div><div class="row">${num("viscosity", "Вязкость частиц", .15, 0, 1, .05)}${num("cohesion", "Сцепление частиц", .4, 0, 2, .1)}${num("gravity", "Гравитация Y", 1, -2, 3, 0.1)}${num("speed", "Скорость симуляции", 1, 0.1, 2, 0.1)}${num("size", "Размер новых тел", 35, 8, 120)}${field("color", "Цвет", "color", "#8aa9c6")}${num("stiffness", "Жёсткость новой связи", 0.03, 1e-3, 1, 1e-3)}</div><div class="actions"><button id="play" class="primary">Играть</button><button id="pause">Пауза</button><button id="step">+1 шаг</button><button id="checkpoint">Запомнить сцену</button><button id="reset">Вернуть сцену</button><button id="png">PNG</button></div><p class="muted">Создавай тела кликом; в режиме выбора тащи их мышью. Для связи выбери два тела. Шарнир прикрепляет тело к точке мира. «Запомнить сцену» задаёт точку возврата. До 240 тел и 320 связей. Столкновения и шарниры — 2D. Жидкость — приближённая модель частиц с вязкостью и сцеплением, без расчёта сплошной среды. В «Прорыве плотины» удали правую перегородку ластиком. Ткань и мягкие тела состоят из пружин; задай их жёсткость перед загрузкой пресета. Крепления ткани снимаются удалением узла.</p>${projectControls()}</section><section class="panel"><canvas id="world" width="960" height="600" class="lab-canvas" aria-label="Физическая песочница"></canvas><p id="info" class="muted"></p></section><section class="panel"><h2>Выбранное тело</h2><p id="selection" class="muted">Ничего не выбрано.</p><div class="row">${num("mass", "Масса", 2, 0.1, 100, 0.1)}${num("friction", "Трение", 0.2, 0, 1, 0.05)}${num("bounce", "Упругость", 0.5, 0, 1, 0.05)}${num("motor", "Мотор, rad/s", 0, -10, 10, 0.1)}<label><input id="static" type="checkbox"> Статичное</label><button id="applyBody">Применить к телу</button><button id="pinCenter">Шарнир в центре</button></div></section>`;
  let engine = M.Engine.create({ constraintIterations: 8, positionIterations: 8 }), playing = false, last = 0, frame, disposed = false, selected = null, linkStart = null, mouseConstraint = null, nextId = 1, saved;
  const c = $("world"), ctx = c.getContext("2d");
  const bodies = () => M.Composite.allBodies(engine.world).filter((b) => !b.plugin.boundary);
  const constraints = () => M.Composite.allConstraints(engine.world).filter((v) => v !== mouseConstraint);
  function add(kind, x, y, size = 35, opts = {}) {
    if (bodies().length >= 240) {
      throw new Error("До 240 тел.");
    }
    const options = { restitution: 0.5, friction: 0.2, density: 2e-3, render: { fillStyle: $("color").value }, ...opts };
    let b;
    if (kind === "circle") {
      b = M.Bodies.circle(x, y, size / 2, options);
    } else if (kind === "triangle") {
      b = M.Bodies.polygon(x, y, 3, size / 2, options);
    } else {
      b = M.Bodies.rectangle(x, y, kind === "bar" || kind === "wall" ? size * 3 : size, kind === "bar" || kind === "wall" ? 12 : size, options);
    }
    b.plugin = { ...b.plugin, uid: nextId++, kind, size, motor: 0 };
    M.Composite.add(engine.world, b);
    return b;
  }
  function connect(a, b, pointA, pointB, stiffness = 0.03, length) {
    if (constraints().length >= 320) {
      throw new Error("До 320 связей.");
    }
    const con = M.Constraint.create({ bodyA: a || null, bodyB: b || null, pointA: pointA || { x: 0, y: 0 }, pointB: pointB || { x: 0, y: 0 }, stiffness, damping: 0.05, ...length != null ? { length } : {} });
    M.Composite.add(engine.world, con);
    return con;
  }
  function empty() {
    M.Engine.clear(engine);
    M.Composite.clear(engine.world, false);
    selected = null;
    linkStart = null;
    mouseConstraint = null;
    nextId = 1;
    const walls = [M.Bodies.rectangle(480, 620, 1100, 40, { isStatic: true }), M.Bodies.rectangle(-20, 300, 40, 640, { isStatic: true }), M.Bodies.rectangle(980, 300, 40, 640, { isStatic: true })];
    walls.forEach((b) => {
      b.plugin.boundary = true;
    });
    M.Composite.add(engine.world, walls);
    engine.gravity.y = Number($("gravity").value);
  }
  function snapshot() {
    return { viscosity: Number($("viscosity").value), cohesion: Number($("cohesion").value), gravity: Number($("gravity").value), bodies: bodies().map((b) => ({ id: b.plugin.uid, kind: b.plugin.kind, size: b.plugin.size, x: b.position.x, y: b.position.y, angle: b.angle, vx: b.velocity.x, vy: b.velocity.y, angular: b.angularVelocity, mass: b.isStatic ? 1 : b.mass, friction: b.friction, restitution: b.restitution, isStatic: b.isStatic, color: b.render.fillStyle, motor: b.plugin.motor || 0, soft: b.collisionFilter.group < 0, fluid: b.plugin.fluid === true })), constraints: constraints().map((con) => ({ a: con.bodyA?.plugin.uid || null, b: con.bodyB?.plugin.uid || null, pa: con.pointA, pb: con.pointB, length: con.length, stiffness: con.stiffness })) };
  }
  function validate(p) {
    if (!Array.isArray(p.bodies) || p.bodies.length > 240 || !Array.isArray(p.constraints) || p.constraints.length > 320 || !Number.isFinite(p.gravity) || p.gravity < -2 || p.gravity > 3) {
      throw new Error("Неверная сцена.");
    }
    const ids = /* @__PURE__ */ new Set();
    for (const b of p.bodies) {
      if (!Number.isInteger(b.id) || ids.has(b.id) || !["circle", "triangle", "rect", "bar", "wall"].includes(b.kind) || ![b.size, b.x, b.y, b.angle, b.vx, b.vy, b.angular, b.mass, b.friction, b.restitution, b.motor].every(Number.isFinite) || b.size < 8 || b.size > 200 || Math.abs(b.x) > 1e4 || Math.abs(b.y) > 1e4 || b.mass <= 0 || b.mass > 1e3 || Math.abs(b.vx) > 1e3 || Math.abs(b.vy) > 1e3 || Math.abs(b.angular) > 10 || Math.abs(b.motor) > 10 || b.friction < 0 || b.friction > 1 || b.restitution < 0 || b.restitution > 1 || typeof b.isStatic !== "boolean" || !/^#[0-9a-f]{6}$/i.test(b.color)) {
        throw new Error("Повреждённое тело.");
      }
      ids.add(b.id);
    }
    for (const con of p.constraints) {
      if (con.a != null && !ids.has(con.a) || con.b != null && !ids.has(con.b) || !con.pa || !con.pb || ![con.pa.x, con.pa.y, con.pb.x, con.pb.y, con.length, con.stiffness].every(Number.isFinite) || con.length < 0 || con.length > 1e4 || con.stiffness < 0 || con.stiffness > 1 || [con.pa.x, con.pa.y, con.pb.x, con.pb.y].some((v) => Math.abs(v) > 1e4)) {
        throw new Error("Повреждённая связь.");
      }
    }
  }
  function restore(p) {
    validate(p);
    if (p.viscosity != null && (!Number.isFinite(p.viscosity) || p.viscosity < 0 || p.viscosity > 1) || p.cohesion != null && (!Number.isFinite(p.cohesion) || p.cohesion < 0 || p.cohesion > 2)) { throw new Error("Параметры жидкости."); }
    $("viscosity").value = p.viscosity ?? .15;
    $("cohesion").value = p.cohesion ?? .4;
    playing = false;
    empty();
    $("gravity").value = p.gravity;
    engine.gravity.y = p.gravity;
    const map = /* @__PURE__ */ new Map();
    for (const data of p.bodies) {
      const b = add(data.kind, data.x, data.y, data.size, { isStatic: data.isStatic, friction: data.friction, restitution: data.restitution, render: { fillStyle: data.color } });
      b.plugin.uid = data.id;
      b.plugin.motor = data.motor;
      b.plugin.fluid = data.fluid === true;
      if (data.soft === true) { b.collisionFilter.group = -1; }
      if (b.plugin.fluid) { b.frictionAir = .01; }
      M.Body.setAngle(b, data.angle);
      if (!data.isStatic) {
        M.Body.setMass(b, data.mass);
        M.Body.setVelocity(b, { x: data.vx, y: data.vy });
        M.Body.setAngularVelocity(b, data.angular);
      }
      map.set(data.id, b);
      nextId = Math.max(nextId, data.id + 1);
    }
    for (const con of p.constraints) {
      connect(map.get(con.a), map.get(con.b), { ...con.pa }, { ...con.pb }, con.stiffness, con.length);
    }
    draw();
  }
  function preset() {
    playing = false;
    empty();
    const kind = $("preset").value;
    buildPhysicsExtra(kind, {M, add, connect, stiffness: readNumber("stiffness", 1e-3, 1)});
    if (kind === "stack") {
      for (let y = 0; y < 7; y += 1) {
        for (let x = 0; x < 4; x += 1) {
          add("rect", 410 + x * 37, 570 - y * 37, 35, { restitution: 0.1 });
        }
      }
    }
    if (kind === "balls") {
      for (let i = 0; i < 30; i += 1) {
        add("circle", 100 + i % 10 * 75, 80 + Math.floor(i / 10) * 65, 25 + i % 4 * 8, { restitution: 0.93, friction: 0.01 });
      }
    }
    if (kind === "domino") {
      for (let i = 0; i < 18; i += 1) {
        const b = add("bar", 130 + i * 38, 550, 30, { restitution: 0.1 });
        M.Body.setAngle(b, Math.PI / 2 + (i === 0 ? 0.25 : 0));
      }
    }
    if (["pendulum", "cradle"].includes(kind)) {
      for (let i = 0; i < 5; i += 1) {
        const x = 350 + i * 48, b = add("circle", x, 350, 48, { restitution: 1, friction: 0, frictionAir: 0 });
        connect(null, b, { x, y: 110 }, { x: 0, y: 0 }, 1, 240);
        if (i === 0) {
          M.Body.setPosition(b, { x: x - 140, y: 305 });
        }
      }
    }
    if (["chain", "bridge"].includes(kind)) {
      let previous = null;
      for (let i = 0; i < 18; i += 1) {
        const b = add(kind === "chain" ? "circle" : "bar", 150 + i * 35, kind === "chain" ? 100 + i * 15 : 300, kind === "chain" ? 18 : 12, { collisionFilter: { group: -1 } });
        if (previous) {
          connect(previous, b, { x: 0, y: 0 }, { x: 0, y: 0 }, 0.9, 35);
        } else {
          connect(null, b, { x: b.position.x, y: b.position.y }, { x: 0, y: 0 }, 1, 0);
        }
        previous = b;
      }
      if (kind === "bridge") {
        connect(previous, null, { x: 0, y: 0 }, { x: 745, y: 300 }, 1, 0);
        add("circle", 450, 100, 60);
      }
    }
    if (kind === "springs") {
      for (let i = 0; i < 4; i += 1) {
        const b = add("circle", 250 + i * 130, 350, 45);
        connect(null, b, { x: b.position.x, y: 80 }, { x: 0, y: 0 }, 5e-3 + i * 8e-3, 180);
      }
    }
    if (kind === "catapult") {
      const b = add("bar", 450, 430, 100, { restitution: 0.1 });
      connect(null, b, { x: 450, y: 430 }, { x: 0, y: 0 }, 1, 0);
      add("circle", 560, 380, 35);
      add("rect", 350, 230, 75);
    }
    if (kind === "motor") {
      const b = add("bar", 480, 300, 90);
      connect(null, b, { x: 480, y: 300 }, { x: 0, y: 0 }, 1, 0);
      b.plugin.motor = 1.5;
      for (let i = 0; i < 12; i += 1) {
        add("circle", 350 + i % 4 * 55, 70 + Math.floor(i / 4) * 45, 30);
      }
    }
    if (kind === "ramp") {
      for (let i = 0; i < 3; i += 1) {
        const b = add("wall", i % 2 ? 580 : 350, 180 + i * 150, 160, { isStatic: true });
        M.Body.setAngle(b, i % 2 ? -0.18 : 0.18);
      }
      for (let i = 0; i < 8; i += 1) {
        add("circle", 200 + i * 25, 30, 20);
      }
    }
    saved = snapshot();
    draw();
    status("Пресет загружен.");
  }
  function draw() {
    ctx.fillStyle = "#f5f7fb";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#e5e9f1";
    ctx.lineWidth = 1;
    for (let x = 0; x < c.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, c.height);
      ctx.stroke();
    }
    for (const con of M.Composite.allConstraints(engine.world)) {
      const a = con.bodyA ? M.Vector.add(con.bodyA.position, con.pointA) : con.pointA, b = con.bodyB ? M.Vector.add(con.bodyB.position, con.pointB) : con.pointB;
      ctx.strokeStyle = con === mouseConstraint ? "#aabbd0" : con.stiffness < 0.2 ? "#a885b9" : "#8396aa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      if (con.stiffness < 0.2 && con.length > 10) {
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        for (let i = 1; i < 12; i += 1) {
          const t = i / 12, offset = i % 2 ? 5 : -5;
          ctx.lineTo(a.x + dx * t - dy / len * offset, a.y + dy * t + dx / len * offset);
        }
      }
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const b of M.Composite.allBodies(engine.world)) {
      ctx.fillStyle = b.plugin.boundary ? "#7a879b" : b.render.fillStyle || "#90abc4";
      ctx.strokeStyle = b === selected ? "#39ac6d" : b.isStatic ? "#647286" : "#688199";
      ctx.lineWidth = b === selected ? 3 : 1;
      ctx.beginPath();
      b.vertices.forEach((p, i) => {
        if (!i) {
          ctx.moveTo(p.x, p.y);
        } else {
          ctx.lineTo(p.x, p.y);
        }
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (b.circleRadius && !b.plugin.fluid) {
        ctx.beginPath();
        ctx.moveTo(b.position.x, b.position.y);
        ctx.lineTo(b.position.x + Math.cos(b.angle) * b.circleRadius, b.position.y + Math.sin(b.angle) * b.circleRadius);
        ctx.stroke();
      }
    }
    $("info").textContent = `Тел: ${bodies().length} · Связей: ${constraints().length}${linkStart ? " · Выбери второе тело" : ""}`;
  }
  function step() {
    engine.gravity.y = readNumber("gravity", -2, 3);
    for (const b of bodies()) {
      if (b.plugin.motor && !b.isStatic) {
        M.Body.setAngularVelocity(b, b.plugin.motor / 60);
      }
    }
    const speed = readNumber("speed", 0.1, 2), steps = Math.ceil(speed);
    for (let i = 0; i < steps; i += 1) {
      fluidForces(M, bodies().filter(b => b.plugin.fluid), readNumber("viscosity", 0, 1), readNumber("cohesion", 0, 2));
      M.Engine.update(engine, 1e3 / 60 * speed / steps);
    }
    draw();
  }
  function selectBody(b) {
    selected = b;
    $("selection").textContent = b ? `${b.plugin.kind} · #${b.plugin.uid}` : "Ничего не выбрано.";
    if (b) {
      $("mass").value = b.isStatic ? 1 : b.mass.toFixed(2);
      $("friction").value = b.friction;
      $("bounce").value = b.restitution;
      $("static").checked = b.isStatic;
      $("motor").value = b.plugin.motor || 0;
    }
  }
  function remove(b) {
    for (const con of constraints()) {
      if (con.bodyA === b || con.bodyB === b) {
        M.Composite.remove(engine.world, con);
      }
    }
    M.Composite.remove(engine.world, b);
    if (selected === b) {
      selectBody(null);
    }
  }
  c.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const p = canvasPoint(c, e), b = M.Query.point(bodies(), p).at(-1), tool = $("tool").value;
    try {
      if (tool === "erase") {
        if (b) {
          remove(b);
        }
      } else if (["spring", "rope"].includes(tool)) {
        if (b) {
          if (linkStart && linkStart !== b) {
            connect(linkStart, b, { x: 0, y: 0 }, { x: 0, y: 0 }, tool === "rope" ? 0.95 : readNumber("stiffness", 1e-3, 1));
            linkStart = null;
          } else {
            linkStart = b;
          }
        }
      } else if (tool === "pin") {
        if (b) {
          const local = M.Vector.sub(p, b.position);
          connect(null, b, p, local, 0.95, 0);
        }
      } else if (tool === "fluid") {
        if (bodies().length + 25 > 240) { throw new Error("Для порции жидкости нужно место под 25 частиц."); }
        for (let y = -2; y <= 2; y += 1) {
          for (let x = -2; x <= 2; x += 1) {
            const particle = add("circle", p.x + x * 10, p.y + y * 10, 8, {restitution: 0, friction: 0, frictionAir: .01, render: {fillStyle: "#79b1ce"}});
            particle.plugin.fluid = true;
          }
        }
      } else if (tool === "drag") {
        selectBody(b);
        if (b && !b.isStatic) {
          const local = M.Vector.sub(p, b.position);
          mouseConstraint = connect(null, b, p, local, 0.2, 0);
          c.setPointerCapture(e.pointerId);
        }
      } else {
        selectBody(add(tool, p.x, p.y, readNumber("size", 8, 120), { isStatic: tool === "wall" }));
      }
      draw();
    } catch (error) {
      status(error.message, true);
    }
  });
  c.addEventListener("pointermove", (e) => {
    if (mouseConstraint) {
      mouseConstraint.pointA = canvasPoint(c, e);
      if (!playing) {
        M.Body.setPosition(mouseConstraint.bodyB, mouseConstraint.pointA);
        draw();
      }
    }
  });
  const up = () => {
    if (mouseConstraint) {
      M.Composite.remove(engine.world, mouseConstraint);
      mouseConstraint = null;
    }
  };
  c.addEventListener("pointerup", up);
  c.addEventListener("pointercancel", up);
  $("tool").addEventListener("change", () => {
    linkStart = null;
    up();
  });
  action("apply", preset);
  action("play", () => {
    playing = true;
  });
  action("pause", () => {
    playing = false;
  });
  action("step", step);
  action("checkpoint", () => {
    saved = snapshot();
    status("Точка возврата сохранена.");
  });
  action("reset", () => restore(saved));
  bindPNG("png", c, "physics-scene.png");
  action("applyBody", () => {
    if (!selected) {
      throw new Error("Выбери тело.");
    }
    M.Body.setStatic(selected, $("static").checked);
    if (!selected.isStatic) {
      M.Body.setMass(selected, readNumber("mass", 0.1, 100));
    }
    selected.friction = readNumber("friction", 0, 1);
    selected.restitution = readNumber("bounce", 0, 1);
    selected.plugin.motor = readNumber("motor", -10, 10);
    draw();
  });
  action("pinCenter", () => {
    if (!selected) {
      throw new Error("Выбери тело.");
    }
    connect(null, selected, { ...selected.position }, { x: 0, y: 0 }, 1, 0);
    draw();
  });
  bindProject("GM Physics", () => ({ scene: snapshot() }), (p) => {
    restore(p.scene);
    saved = snapshot();
  });
  function tick(t) {
    if (disposed) {
      return;
    }
    if (playing && t - last >= 1e3 / 60) {
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
    disposed = true;
    cancelAnimationFrame(frame);
    M.Engine.clear(engine);
    M.Composite.clear(engine.world, false);
  });
  preset();
  frame = requestAnimationFrame(tick);
}
export {
  physics
};
