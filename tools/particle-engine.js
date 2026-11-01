import { seeded } from "./effects-core.js?v=20261101-v09";
const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const keys = (...values) => values.map((v, i) => ({ t: i / (values.length - 1 || 1), v }));
const parameter = (value, max) => ({ mode: max == null ? "constant" : "range", value, min: value, max: max ?? value, keys: keys(
  value,
  value
), keys2: keys(max ?? value, max ?? value), interpolation: "linear" });
function sampleKeys(list, time, interpolation = "linear") {
  const t = clamp(time);
  if (t <= list[0].t) {
    return list[0].v;
  }
  for (let i = 1; i < list.length; i += 1) {
    if (t <= list[i].t) {
      let u = (t - list[i - 1].t) / (list[i].t - list[i - 1].t || 1);
      if (interpolation === "step") {
        u = u >= 1 ? 1 : 0;
      }
      if (interpolation === "smooth") {
        u = u * u * (3 - 2 * u);
      }
      return lerp(list[i - 1].v, list[i].v, u);
    }
  }
  return list.at(-1).v;
}
function sample(p, t, random = 0.5) {
  if (p.mode === "constant") {
    return p.value;
  }
  if (p.mode === "range") {
    return lerp(p.min, p.max, random);
  }
  const a = sampleKeys(p.keys, t, p.interpolation);
  return p.mode === "curves" ? lerp(a, sampleKeys(p.keys2, t, p.interpolation), random) : a;
}
const gradient = (...colors) => colors.map((color, i) => ({ t: i / (colors.length - 1 || 1), color, alpha: i === colors.length - 1 ? 0 : 1 }));
const rgb = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
function sampleGradient(list, t) {
  let a = list[0];
  let b = a;
  for (const stop of list) {
    if (stop.t <= t) {
      a = stop;
    }
    if (stop.t >= t) {
      b = stop;
      break;
    }
    b = stop;
  }
  const f = clamp((t - a.t) / (b.t - a.t || 1));
  const ca = rgb(a.color);
  const cb = rgb(b.color);
  return { rgb: ca.map((v, i) => lerp(v, cb[i], f)), alpha: lerp(a.alpha, b.alpha, f) };
}
const paramRanges = {
  life: [0.05, 30],
  speed: [0, 2e3],
  size: [0.2, 300],
  startRotation: [-3600, 3600],
  rate: [0, 1e3],
  velocityX: [-2e3, 2e3],
  velocityY: [-2e3, 2e3],
  orbital: [-1440, 1440],
  radial: [-2e3, 2e3],
  forceX: [-4e3, 4e3],
  forceY: [-4e3, 4e3],
  limit: [0, 3e3],
  sizeX: [0, 10],
  sizeY: [0, 10],
  alpha: [0, 1],
  rotation: [-3e3, 3e3],
  sizeBySpeed: [0, 10],
  rotationBySpeed: [-3e3, 3e3],
  trailWidth: [0, 10]
};
const numericLimits = {
  emission: [0.1, 60],
  delay: [0, 60],
  maxParticles: [1, 3e3],
  simulationSpeed: [0.1, 4],
  x: [-100, 200],
  y: [-100, 200],
  radius: [0, 1e3],
  thickness: [0, 1],
  boxWidth: [0, 2e3],
  boxHeight: [0, 2e3],
  angle: [-360, 360],
  spread: [0, 360],
  arc: [0, 360],
  randomDirection: [0, 1],
  motionX: [-1e3, 1e3],
  motionY: [-1e3, 1e3],
  period: [0.1, 60],
  inherit: [-3, 3],
  lifetimeSpeedMin: [0, 2e3],
  lifetimeSpeedMax: [1, 3e3],
  lifetimeMultiplier: [0.05, 10],
  rateDistance: [0, 10],
  gravity: [-4e3, 4e3],
  drag: [0, 20],
  dampen: [0, 1],
  noise: [0, 1e3],
  frequency: [0.01, 20],
  noiseScroll: [-20, 20],
  octaves: [1, 4],
  fieldX: [-100, 200],
  fieldY: [-100, 200],
  fieldRadius: [1, 2e3],
  attraction: [-4e3, 4e3],
  vortex: [-4e3, 4e3],
  speedMin: [0, 3e3],
  speedMax: [1, 4e3],
  floor: [0, 100],
  bounce: [0, 1],
  friction: [0, 1],
  lifetimeLoss: [0, 1],
  killSpeed: [0, 1e3],
  triggerX: [-100, 200],
  triggerY: [-100, 200],
  triggerWidth: [1, 2e3],
  triggerHeight: [1, 2e3],
  subCount: [1, 30],
  subProbability: [0, 1],
  subLife: [0.05, 5],
  subSpeed: [0, 1e3],
  subSize: [0.2, 100],
  subInherit: [-2, 2],
  trailLife: [0.01, 3],
  trailRatio: [0, 1],
  trailSamples: [2, 80],
  sheetCols: [1, 16],
  sheetRows: [1, 16],
  sheetCycles: [0.1, 20],
  sheetRow: [0, 15],
  flipX: [0, 1],
  flipY: [0, 1],
  stretch: [0, 0.2],
  glow: [0, 100]
};
const choices = {
  shape: ["cone", "point", "circle", "ring", "box", "edge", "line"],
  motion: ["static", "line", "circle"],
  space: ["world", "local"],
  collisionMode: ["floor", "bounds"],
  triggerAction: ["kill", "color", "sub"],
  subEvent: ["birth", "death", "collision", "trigger"],
  sprite: ["glow", "circle", "square", "star", "texture", "stretched"],
  blend: ["lighter", "source-over", "screen", "multiply"],
  sort: ["oldest", "youngest", "smallest", "largest"],
  sheetMode: ["whole", "row"]
};
function makeLayer(name = "Emitter 1") {
  return {
    name,
    visible: true,
    seed: "GrayMansion",
    emission: 3,
    delay: 0,
    maxParticles: 1800,
    simulationSpeed: 1,
    looping: true,
    prewarm: false,
    x: 50,
    y: 80,
    shape: "cone",
    radius: 18,
    thickness: 1,
    boxWidth: 500,
    boxHeight: 20,
    angle: -90,
    spread: 35,
    arc: 360,
    randomDirection: 0,
    motion: "static",
    motionX: 140,
    motionY: 70,
    period: 3,
    space: "world",
    inheritEnabled: false,
    inherit: 1,
    lifetimeSpeedEnabled: false,
    lifetimeSpeedMin: 0,
    lifetimeSpeedMax: 300,
    lifetimeMultiplier: 0.5,
    life: parameter(1, 2.5),
    speed: parameter(80, 180),
    size: parameter(5, 15),
    startRotation: parameter(0, 360),
    startColorA: "#fff5da",
    startColorB: "#ffffff",
    emissionEnabled: true,
    rate: parameter(80),
    rateDistance: 0,
    bursts: [{ time: 0, min: 50, max: 70, cycles: 1, interval: 1, probability: 1 }],
    velocityEnabled: false,
    velocityX: parameter(0),
    velocityY: parameter(0),
    orbital: parameter(0),
    radial: parameter(0),
    forceEnabled: true,
    forceX: parameter(0),
    forceY: parameter(0),
    gravity: -30,
    limitEnabled: false,
    limit: parameter(150),
    dampen: 0.5,
    drag: 0.1,
    noiseEnabled: true,
    noise: 35,
    frequency: 2,
    noiseScroll: 0.7,
    octaves: 2,
    fieldEnabled: false,
    fieldX: 50,
    fieldY: 40,
    fieldRadius: 220,
    attraction: 120,
    vortex: 200,
    colorEnabled: true,
    colorRandom: false,
    colorKeys: gradient("#fff2b4", "#f2a65a", "#b84d67"),
    colorKeys2: gradient("#e8d9ff", "#9574ff", "#425cdd"),
    alpha: parameter(1),
    colorSpeedEnabled: false,
    colorSpeedKeys: [{ t: 0, color: "#83bfff", alpha: 1 }, { t: 1, color: "#ff775d", alpha: 1 }],
    speedMin: 0,
    speedMax: 300,
    sizeEnabled: true,
    separateSize: false,
    sizeX: { ...parameter(1), mode: "curve", keys: keys(0.3, 1, 0) },
    sizeY: parameter(1),
    sizeSpeedEnabled: false,
    sizeBySpeed: { ...parameter(1), mode: "curve", keys: keys(0.3, 2) },
    rotationEnabled: true,
    rotation: parameter(-100, 100),
    rotationSpeedEnabled: false,
    rotationBySpeed: parameter(0),
    collisionEnabled: false,
    collisionMode: "floor",
    floor: 90,
    bounce: 0.65,
    friction: 0.15,
    lifetimeLoss: 0,
    killSpeed: 0,
    triggerEnabled: false,
    triggerX: 50,
    triggerY: 40,
    triggerWidth: 180,
    triggerHeight: 100,
    triggerAction: "color",
    triggerColor: "#80ffbf",
    subEnabled: false,
    subEvent: "death",
    subCount: 8,
    subProbability: 1,
    subLife: 0.5,
    subSpeed: 80,
    subSize: 4,
    subColor: "#ffd78c",
    subInherit: 0.2,
    trailsEnabled: false,
    trailLife: 0.35,
    trailRatio: 1,
    trailSamples: 25,
    trailWidth: { ...parameter(1), mode: "curve", keys: keys(0, 1) },
    trailDieWithParticle: false,
    trailWorld: true,
    sheetEnabled: false,
    sheetCols: 4,
    sheetRows: 4,
    sheetCycles: 1,
    sheetRandomStart: false,
    sheetMode: "whole",
    sheetRow: 0,
    sprite: "glow",
    blend: "lighter",
    sort: "oldest",
    alignVelocity: false,
    flipX: 0,
    flipY: 0,
    stretch: 0.015,
    glow: 0,
    textureData: ""
  };
}
function makeScene() {
  return { width: 800, height: 450, fps: 30, duration: 6, background: "#141a2a", transparent: false };
}
function checkedKeys(list, min, max, name) {
  if (!Array.isArray(list) || list.length < 2 || list.length > 16) {
    throw new Error(`${name}: нужно 2–16 ключей.`);
  }
  return list.map((p, i) => {
    if (!Number.isFinite(p.t) || p.t < 0 || p.t > 1 || i && p.t <= list[i - 1].t || !Number.isFinite(p.v) || p.v < min || p.v > max) {
      throw new Error(`${name}: время ключей должно возрастать от 0 до 1, значения — внутри диапазона.`);
    }
    return { t: p.t, v: p.v };
  });
}
function checkedGradient(list) {
  if (!Array.isArray(list) || list.length < 2 || list.length > 16) {
    throw new Error("Градиент: нужно 2–16 ключей.");
  }
  return list.map((p, i) => {
    if (!Number.isFinite(p.t) || p.t < 0 || p.t > 1 || i && p.t <= list[i - 1].t || !/^#[0-9a-f]{6}$/i.test(p.color) || !Number.isFinite(p.alpha) || p.alpha < 0 || p.alpha > 1) {
      throw new Error("Неверный ключ градиента.");
    }
    return { t: p.t, color: p.color, alpha: p.alpha };
  });
}
function validateLayer(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Неверный слой.");
  }
  const out = makeLayer();
  for (const key of Object.keys(out)) {
    if (Object.hasOwn(input, key)) {
      out[key] = clone(input[key]);
    }
  }
  if (typeof out.name !== "string" || out.name.length > 80 || typeof out.seed !== "string" || out.seed.length > 200) {
    throw new Error("Имя — до 80 символов, seed — до 200.");
  }
  for (const [k, [min, max]] of Object.entries(numericLimits)) {
    if (!Number.isFinite(out[k]) || out[k] < min || out[k] > max) {
      throw new Error(`Параметр ${k}: ${min}…${max}.`);
    }
  }
  for (const k of ["maxParticles", "octaves", "subCount", "trailSamples", "sheetCols", "sheetRows", "sheetRow"]) {
    if (!Number.isInteger(out[k])) {
      throw new Error(`${k}: нужно целое число.`);
    }
  }
  for (const [k, v] of Object.entries(makeLayer())) {
    if (typeof v === "boolean" && typeof out[k] !== "boolean") {
      throw new Error(`Неверный флаг ${k}.`);
    }
  }
  for (const [k, opts] of Object.entries(choices)) {
    if (!opts.includes(out[k])) {
      throw new Error(`Неверный режим ${k}.`);
    }
  }
  if (out.speedMin >= out.speedMax || out.lifetimeSpeedMin >= out.lifetimeSpeedMax) {
    throw new Error("Максимальная скорость диапазона должна быть больше минимальной.");
  }
  for (const k of ["startColorA", "startColorB", "subColor", "triggerColor"]) {
    if (!/^#[0-9a-f]{6}$/i.test(out[k])) {
      throw new Error("Неверный цвет.");
    }
  }
  for (const [k, [min, max]] of Object.entries(paramRanges)) {
    const p = out[k];
    if (!p || !["constant", "range", "curve", "curves"].includes(p.mode) || !["linear", "smooth", "step"].includes(p.interpolation)) {
      throw new Error(`Неверная кривая ${k}.`);
    }
    for (const n of ["value", "min", "max"]) {
      if (!Number.isFinite(p[n]) || p[n] < min || p[n] > max) {
        throw new Error(`${k}: ${min}…${max}.`);
      }
    }
    if (p.min > p.max) {
      throw new Error(`${k}: min больше max.`);
    }
    p.keys = checkedKeys(p.keys, min, max, k);
    p.keys2 = checkedKeys(p.keys2, min, max, k);
  }
  out.colorKeys = checkedGradient(out.colorKeys);
  out.colorKeys2 = checkedGradient(out.colorKeys2);
  out.colorSpeedKeys = checkedGradient(out.colorSpeedKeys);
  if (!Array.isArray(out.bursts) || out.bursts.length > 24) {
    throw new Error("До 24 строк Burst.");
  }
  for (const b of out.bursts) {
    if (![b.time, b.min, b.max, b.cycles, b.interval, b.probability].every(Number.isFinite) || b.time < 0 || b.time > 60 || b.min < 0 || b.max < b.min || b.max > 3e3 || !Number.isInteger(b.min) || !Number.isInteger(b.max) || !Number.isInteger(
      b.cycles
    ) || b.cycles < 1 || b.cycles > 32 || b.interval < 0.05 || b.interval > 60 || b.probability < 0 || b.probability > 1) {
      throw new Error("Проверь Burst: count 0–3000, repeats 1–32, probability 0–1, interval 0.05–60.");
    }
  }
  if (out.bursts.reduce((sum, b) => sum + b.max * b.cycles, 0) > 24e3) {
    throw new Error("До 24 000 частиц во всех Burst за цикл.");
  }
  if (out.sheetRow >= out.sheetRows) {
    throw new Error("Номер строки атласа должен быть меньше Rows (счёт с 0).");
  }
  if (typeof out.textureData !== "string" || out.textureData.length > 15e6 || out.textureData && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(out.textureData)) {
    throw new Error("Неверная встроенная текстура.");
  }
  return out;
}
function validateScene(s) {
  const limits = { width: [128, 1920], height: [128, 1080], fps: [1, 60], duration: [0.1, 120] };
  const out = makeScene();
  for (const k of Object.keys(out)) {
    if (Object.hasOwn(s, k)) {
      out[k] = s[k];
    }
  }
  for (const [k, [a, b]] of Object.entries(limits)) {
    if (!Number.isFinite(out[k]) || out[k] < a || out[k] > b) {
      throw new Error(`Сцена: ${k} ${a}…${b}.`);
    }
  }
  if (out.width % 2 || out.height % 2 || out.fps % 1 || !/^#[0-9a-f]{6}$/i.test(out.background) || typeof out.transparent !== "boolean") {
    throw new Error("Сцена: чётные размеры, целый FPS, цвет #RRGGBB.");
  }
  return out;
}
function emitterAt(s, scene, time) {
  const t = time * Math.PI * 2 / s.period;
  const base = { x: scene.width * s.x / 100, y: scene.height * s.y / 100 };
  if (s.motion === "line") {
    base.x += Math.sin(t) * s.motionX;
    base.y += Math.sin(t) * s.motionY;
  }
  if (s.motion === "circle") {
    base.x += Math.cos(t) * s.motionX;
    base.y += Math.sin(t) * s.motionY;
  }
  return base;
}
const noise1 = (seed, x) => {
  const i = Math.floor(x);
  const t = x - i;
  const a = seeded(`${seed}:${i}`)();
  const b = seeded(`${seed}:${i + 1}`)();
  return lerp(a, b, t * t * (3 - 2 * t)) * 2 - 1;
};
const DT = 1 / 60;
class ParticleEngine {
  constructor(settings, scene) {
    this.s = validateLayer(settings);
    this.scene = validateScene(scene);
    this.reset();
  }
  reset() {
    this.frame = 0;
    this.items = [];
    this.ghosts = [];
    this.id = 0;
    this.credit = 0;
    this.dropped = 0;
    this.collisions = 0;
    this.triggers = 0;
    this.budget = 0;
    this.emit(-1e-8, 0);
    this.offset = this.s.prewarm && this.s.looping ? Math.round(this.s.emission * 60) : 0;
  }
  add(time, origin, parent, event = "main") {
    const s = this.s;
    if (this.items.length >= s.maxParticles) {
      this.dropped += 1;
      return null;
    }
    const id = this.id++;
    const random = seeded(`${s.seed}:particle:${id}`);
    const r = Array.from({ length: 12 }, random);
    const cycleT = clamp((time - s.delay) % s.emission / s.emission);
    const emit = emitterAt(s, this.scene, time);
    let x = 0;
    let y = 0;
    let a = (s.angle + (r[0] - 0.5) * s.spread) * Math.PI / 180;
    const theta = (s.angle + (r[1] - 0.5) * s.arc) * Math.PI / 180;
    const radius = s.radius * Math.sqrt(lerp((1 - s.thickness) ** 2, 1, r[2]));
    if (["circle", "ring"].includes(s.shape)) {
      const rr = s.shape === "ring" ? s.radius : radius;
      x = Math.cos(theta) * rr;
      y = Math.sin(theta) * rr;
      a = theta;
    }
    if (["box", "edge"].includes(s.shape)) {
      x = (r[1] - 0.5) * s.boxWidth;
      y = (r[2] - 0.5) * s.boxHeight;
      if (s.shape === "edge") {
        const perimeter = 2 * (s.boxWidth + s.boxHeight);
        let v = r[1] * perimeter;
        if (v < s.boxWidth) {
          x = v - s.boxWidth / 2;
          y = -s.boxHeight / 2;
        } else if ((v -= s.boxWidth) < s.boxHeight) {
          x = s.boxWidth / 2;
          y = v - s.boxHeight / 2;
        } else if ((v -= s.boxHeight) < s.boxWidth) {
          x = s.boxWidth / 2 - v;
          y = s.boxHeight / 2;
        } else {
          x = -s.boxWidth / 2;
          y = s.boxHeight / 2 - (v - s.boxWidth);
        }
      }
    }
    if (["cone", "line"].includes(s.shape)) {
      x = (r[1] - 0.5) * s.radius * 2;
    }
    a = lerp(a, r[3] * Math.PI * 2, s.randomDirection);
    const speed = sample(s.speed, cycleT, r[4]);
    let life = sample(s.life, cycleT, r[5]);
    const before = emitterAt(s, this.scene, time - DT);
    const ev = { x: (emit.x - before.x) / DT, y: (emit.y - before.y) / DT };
    const emitterSpeed = Math.hypot(ev.x, ev.y);
    if (s.lifetimeSpeedEnabled) {
      life *= lerp(1, s.lifetimeMultiplier, clamp((emitterSpeed - s.lifetimeSpeedMin) / (s.lifetimeSpeedMax - s.lifetimeSpeedMin)));
    }
    const p = {
      id,
      birth: time,
      age: 0,
      life,
      originalLife: life,
      x: x + (s.space === "local" ? 0 : emit.x),
      y: y + (s.space === "local" ? 0 : emit.y),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      size: sample(s.size, cycleT, r[6]),
      rotation: sample(s.startRotation, cycleT, r[7]) * Math.PI / 180,
      r,
      trail: [],
      child: Boolean(parent),
      eventCount: 0,
      inside: false,
      dead: false
    };
    if (s.inheritEnabled) {
      p.vx += ev.x * s.inherit;
      p.vy += ev.y * s.inherit;
    }
    const ca = rgb(s.startColorA);
    const cb = rgb(s.startColorB);
    p.tint = ca.map((v, i) => lerp(v, cb[i], r[8]));
    if (parent) {
      p.x = origin.x - (s.space === "local" ? emit.x : 0);
      p.y = origin.y - (s.space === "local" ? emit.y : 0);
      p.life = s.subLife;
      p.originalLife = s.subLife;
      p.size = s.subSize;
      const angle = r[0] * Math.PI * 2;
      p.vx = Math.cos(angle) * s.subSpeed + (parent.actualVx ?? parent.vx) * s.subInherit;
      p.vy = Math.sin(angle) * s.subSpeed + (parent.actualVy ?? parent.vy) * s.subInherit;
      p.tint = rgb(s.subColor);
    }
    this.items.push(p);
    if (!parent && s.subEnabled && s.subEvent === "birth") {
      this.sub(p, time, "birth");
    }
    return p;
  }
  world(p, time) {
    const e = emitterAt(this.s, this.scene, time);
    return { x: p.x + (this.s.space === "local" ? e.x : 0), y: p.y + (this.s.space === "local" ? e.y : 0) };
  }
  sub(p, time, event) {
    const s = this.s;
    if (p.child || !s.subEnabled || s.subEvent !== event || p.eventCount >= 16) {
      return;
    }
    const random = seeded(`${s.seed}:${p.id}:${event}:${p.eventCount++}`);
    if (random() >= s.subProbability) {
      return;
    }
    const origin = this.world(p, time);
    for (let i = 0; i < s.subCount; i += 1) {
      this.add(time, origin, p, event);
    }
  }
  emit(previous, time) {
    const s = this.s;
    if (!s.emissionEnabled || time < s.delay) {
      return;
    }
    const cycle = Math.floor((time - s.delay) / s.emission);
    if (!s.looping && previous >= s.delay + s.emission - 1e-10) {
      return;
    }
    const from = Math.max(0, Math.floor((Math.max(previous, s.delay) - s.delay) / s.emission));
    for (let c = from; c <= cycle; c += 1) {
      if (!s.looping && c > 0) {
        break;
      }
      const base = s.delay + c * s.emission;
      s.bursts.forEach((b, index) => {
        for (let k = 0; k < b.cycles; k += 1) {
          const t2 = base + b.time + k * b.interval;
          if (t2 >= base + s.emission || t2 <= previous + 1e-10 || t2 > time + 1e-10) {
            continue;
          }
          const random = seeded(`${s.seed}:burst:${c}:${index}:${k}`);
          if (random() >= b.probability) {
            continue;
          }
          const count2 = b.min + Math.floor(random() * (b.max - b.min + 1));
          for (let n = 0; n < count2; n += 1) {
            this.add(time);
          }
        }
      });
    }
    if (previous < 0 || time <= previous) {
      return;
    }
    const activeEnd = s.looping ? time : Math.min(time, s.delay + s.emission);
    const activeStart = Math.max(previous, s.delay);
    const mid = (activeStart + activeEnd) / 2;
    const t = clamp((mid - s.delay) % s.emission / s.emission);
    const rate = sample(s.rate, t, seeded(`${s.seed}:rate:${cycle}`)());
    const emit = emitterAt(s, this.scene, time);
    const before = emitterAt(s, this.scene, previous);
    this.credit += rate * Math.max(0, activeEnd - activeStart) + Math.hypot(emit.x - before.x, emit.y - before.y) * s.rateDistance;
    const count = Math.floor(this.credit + 1e-9);
    this.credit -= count;
    for (let n = 0; n < count; n += 1) {
      this.add(time);
    }
  }
  appearance(p, time) {
    const s = this.s;
    const u = clamp(p.age / p.life);
    const speed = Math.hypot(p.actualVx ?? p.vx, p.actualVy ?? p.vy);
    const v = clamp((speed - s.speedMin) / (s.speedMax - s.speedMin));
    let color = { rgb: [255, 255, 255], alpha: 1 };
    if (s.colorEnabled && !p.child) {
      color = sampleGradient(s.colorKeys, u);
      if (s.colorRandom) {
        const b = sampleGradient(s.colorKeys2, u);
        color = { rgb: color.rgb.map((x, i) => lerp(x, b.rgb[i], p.r[9])), alpha: lerp(color.alpha, b.alpha, p.r[9]) };
      }
    }
    if (s.colorSpeedEnabled && !p.child) {
      const g = sampleGradient(s.colorSpeedKeys, v);
      color = { rgb: color.rgb.map((x, i) => x * g.rgb[i] / 255), alpha: color.alpha * g.alpha };
    }
    color.rgb = color.rgb.map((x, i) => x * p.tint[i] / 255);
    if (p.triggerTint) {
      color.rgb = rgb(p.triggerTint);
    }
    const sizeMultiplier = s.sizeEnabled && !p.child ? sample(s.sizeX, u, p.r[6]) : 1;
    const bySpeed = s.sizeSpeedEnabled && !p.child ? sample(s.sizeBySpeed, v, p.r[6]) : 1;
    const sx = p.size * sizeMultiplier * bySpeed;
    const sy = p.size * (s.separateSize && s.sizeEnabled && !p.child ? sample(s.sizeY, u, p.r[7]) : sizeMultiplier) * bySpeed;
    return { ...this.world(p, time), sx, sy, color: color.rgb.map(Math.round), alpha: clamp(color.alpha * (p.child ? 1 - u : sample(s.alpha, u, p.r[10]))), rotation: p.rotation, u, speed };
  }
  step() {
    const s = this.s;
    const previous = this.frame * DT;
    const time = (this.frame + 1) * DT;
    this.emit(previous, time);
    const current = [...this.items];
    for (const p of current) {
      if (++this.budget > 2e7) {
        throw new Error("Лимит расчёта на перемотку. Уменьши Max Particles, Simulation Speed или время.");
      }
      p.age = time - p.birth;
      if (p.age >= p.life) {
        this.sub(p, time, "death");
        p.dead = true;
        continue;
      }
      const startX = p.x;
      const startY = p.y;
      const u = clamp(p.age / p.life);
      let fx = 0;
      let fy = s.forceEnabled ? s.gravity : 0;
      if (s.forceEnabled && !p.child) {
        fx += sample(s.forceX, u, p.r[0]);
        fy += sample(s.forceY, u, p.r[1]);
      }
      const world = this.world(p, time);
      const e = emitterAt(s, this.scene, time);
      if (s.noiseEnabled && !p.child) {
        let nx = 0;
        let ny = 0;
        let weight = 1;
        for (let o = 0; o < s.octaves; o += 1) {
          const phase = p.r[2] * 100 + time * s.frequency * s.noiseScroll * 2 ** o;
          nx += noise1(`${s.seed}:${p.id}:x:${o}`, phase) * weight;
          ny += noise1(`${s.seed}:${p.id}:y:${o}`, phase) * weight;
          weight *= 0.5;
        }
        fx += nx * s.noise;
        fy += ny * s.noise;
      }
      if (s.fieldEnabled) {
        const dx = this.scene.width * s.fieldX / 100 - world.x;
        const dy = this.scene.height * s.fieldY / 100 - world.y;
        const d = Math.hypot(dx, dy);
        if (d > 1 && d < s.fieldRadius) {
          const f = 1 - d / s.fieldRadius;
          fx += (dx * s.attraction - dy * s.vortex) / d * f;
          fy += (dy * s.attraction + dx * s.vortex) / d * f;
        }
      }
      p.vx = (p.vx + fx * DT) * Math.exp(-s.drag * DT);
      p.vy = (p.vy + fy * DT) * Math.exp(-s.drag * DT);
      let vx = p.vx;
      let vy = p.vy;
      if (s.velocityEnabled && !p.child) {
        vx += sample(s.velocityX, u, p.r[0]);
        vy += sample(s.velocityY, u, p.r[1]);
        const dx = world.x - e.x;
        const dy = world.y - e.y;
        const d = Math.hypot(dx, dy);
        const radial = sample(s.radial, u, p.r[2]);
        if (d > 1) {
          vx += dx / d * radial;
          vy += dy / d * radial;
        }
        const angle = sample(s.orbital, u, p.r[3]) * Math.PI / 180 * DT;
        const cs = Math.cos(angle);
        const sn = Math.sin(angle);
        p.x += dx * (cs - 1) - dy * sn;
        p.y += dx * sn + dy * (cs - 1);
      }
      if (s.limitEnabled) {
        const speed = Math.hypot(vx, vy);
        const limit = sample(s.limit, u, p.r[4]);
        if (speed > limit) {
          const f = lerp(1, limit / (speed || 1), s.dampen);
          vx *= f;
          vy *= f;
          p.vx *= f;
          p.vy *= f;
        }
      }
      p.x += vx * DT;
      p.y += vy * DT;
      p.actualVx = (p.x - startX) / DT;
      p.actualVy = (p.y - startY) / DT;
      const speedT = clamp((Math.hypot(p.actualVx, p.actualVy) - s.speedMin) / (s.speedMax - s.speedMin));
      if (!p.child) {
        p.rotation += (s.rotationEnabled ? sample(s.rotation, u, p.r[5]) : 0) * DT * Math.PI / 180;
        if (s.rotationSpeedEnabled) {
          p.rotation += sample(s.rotationBySpeed, speedT, p.r[5]) * DT * Math.PI / 180;
        }
      }
      if (s.collisionEnabled) {
        const q = this.appearance(p, time);
        const radius = Math.min(Math.max(q.sx, q.sy) / 2, Math.min(this.scene.width, this.scene.height) * 0.2);
        const w = this.world(p, time);
        let hit = false;
        const left = radius;
        const right = this.scene.width - radius;
        const top = radius;
        const floor = this.scene.height * (s.collisionMode === "floor" ? s.floor / 100 : 1) - radius;
        if (w.y > floor && vy > 0) {
          p.y -= w.y - floor;
          p.vy = -Math.abs(vy) * s.bounce - (vy - p.vy);
          p.vx *= 1 - s.friction;
          hit = true;
        }
        if (s.collisionMode === "bounds") {
          if (w.y < top && vy < 0) {
            p.y += top - w.y;
            p.vy = Math.abs(vy) * s.bounce - (vy - p.vy);
            hit = true;
          }
          if (w.x < left && vx < 0) {
            p.x += left - w.x;
            p.vx = Math.abs(vx) * s.bounce - (vx - p.vx);
            p.vy *= 1 - s.friction;
            hit = true;
          }
          if (w.x > right && vx > 0) {
            p.x -= w.x - right;
            p.vx = -Math.abs(vx) * s.bounce - (vx - p.vx);
            p.vy *= 1 - s.friction;
            hit = true;
          }
        }
        if (hit) {
          this.collisions += 1;
          p.life -= p.originalLife * s.lifetimeLoss;
          this.sub(p, time, "collision");
          if (p.age >= p.life || Math.hypot(p.vx, p.vy) < s.killSpeed) {
            this.sub(p, time, "death");
            p.dead = true;
          }
        }
      }
      if (s.triggerEnabled && !p.dead) {
        const w = this.world(p, time);
        const inside = Math.abs(w.x - this.scene.width * s.triggerX / 100) < s.triggerWidth / 2 && Math.abs(w.y - this.scene.height * s.triggerY / 100) < s.triggerHeight / 2;
        if (inside && !p.inside) {
          this.triggers += 1;
          if (s.triggerAction === "kill") {
            this.sub(p, time, "death");
            p.dead = true;
          }
          if (s.triggerAction === "color") {
            p.triggerTint = s.triggerColor;
          }
          if (s.triggerAction === "sub") {
            this.sub(p, time, "trigger");
          }
        }
        p.inside = inside;
      }
      if (s.trailsEnabled && p.r[11] <= s.trailRatio && this.frame % 2 === 0) {
        const q = this.appearance(p, time);
        p.trail.push({ x: !s.trailWorld && s.space === "local" ? p.x : q.x, y: !s.trailWorld && s.space === "local" ? p.y : q.y, time, color: q.color, alpha: q.alpha, size: q.sx });
        while (p.trail.length > s.trailSamples || p.trail[0]?.time < time - s.trailLife) {
          p.trail.shift();
        }
      }
    }
    for (const p of this.items) {
      if (p.dead && s.trailsEnabled && !s.trailDieWithParticle && p.trail.length > 1) {
        this.ghosts.push({ trail: p.trail, death: time, q: this.appearance(p, time) });
      }
    }
    this.items = this.items.filter((p) => !p.dead);
    this.ghosts = this.ghosts.filter((p) => time - p.death < s.trailLife).slice(-s.maxParticles);
    this.frame += 1;
  }
  async seek(time, yieldControl = async () => {
  }) {
    const target = Math.max(0, Math.floor(time * this.s.simulationSpeed * 60 + 1e-7)) + this.offset;
    if (target < this.frame) {
      this.reset();
    }
    this.budget = 0;
    while (this.frame < target) {
      this.step();
      if (this.frame % 120 === 0) {
        await yieldControl();
      }
    }
    return this;
  }
  get time() {
    return this.frame * DT;
  }
  get particles() {
    return this.items.map((p) => ({ p, q: this.appearance(p, this.time) }));
  }
}
function importLegacy(data) {
  if (data?.format !== "GM Effect" || data.version !== 1 || data.kind !== "particles") {
    throw new Error("Неверный старый проект частиц.");
  }
  const v = data.values || {};
  const s = makeLayer("Импорт v0.7");
  for (const k of Object.keys(s)) {
    if (typeof s[k] === "number" && v[k] != null) {
      s[k] = Number(v[k]);
    } else if (typeof s[k] === "string" && typeof v[k] === "string" && !["textureData"].includes(k)) {
      s[k] = v[k];
    }
  }
  const range = (name, a, b) => {
    if (v[a] != null && v[b] != null) {
      s[name] = parameter(Number(v[a]), Number(v[b]));
    }
  };
  range("life", "lifeMin", "lifeMax");
  range("speed", "speedMin", "speedMax");
  range("size", "sizeMin", "sizeMax");
  s.rate = parameter(Number(v.rate ?? 70));
  s.bursts = [{ time: 0, min: Number(v.burst ?? 60), max: Number(v.burst ?? 60), cycles: 1, interval: 1, probability: 1 }];
  s.looping = false;
  s.colorKeys = [0, 0.5, 1].map((t, i) => ({ t, color: v[["colorStart", "colorMid", "colorEnd"][i]] || "#ffffff", alpha: Number(
    v[["alphaStart", "alphaMid", "alphaEnd"][i]] ?? 1
  ) }));
  s.sizeX = { ...parameter(1), mode: "curve", keys: keys(...["scaleStart", "scaleMid", "scaleEnd"].map((k) => Number(v[k] ?? 1))) };
  s.rotation = parameter(-Number(v.rotation ?? 120), Number(v.rotation ?? 120));
  s.velocityEnabled = Number(v.wind ?? 0) !== 0;
  s.velocityX = parameter(Number(v.wind ?? 0));
  s.noiseEnabled = Number(v.noise ?? 0) > 0;
  s.trailsEnabled = Number(v.trail ?? 0) > 0;
  s.trailLife = Math.max(0.01, Number(v.trail ?? 0.08));
  s.textureData = data.textureData || "";
  const scene = makeScene();
  for (const k of ["width", "height", "fps", "duration"]) {
    if (v[k] != null) {
      scene[k] = Number(v[k]);
    }
  }
  if (v.background) {
    scene.background = v.background;
  }
  scene.transparent = v.transparent === true;
  return { format: "GM Particle Studio", version: 2, scene: validateScene(scene), layers: [validateLayer(s)] };
}
function validateProject(data) {
  if (data?.format === "GM Effect") {
    return importLegacy(data);
  }
  if (data?.format !== "GM Particle Studio" || data.version !== 2 || !Array.isArray(data.layers) || !data.layers.length || data.layers.length > 6) {
    throw new Error("Нужен проект GM Particle Studio v2, до 6 слоёв.");
  }
  const scene = validateScene(data.scene || {});
  const layers = data.layers.map(validateLayer);
  if (layers.reduce((sum, s) => sum + s.maxParticles, 0) > 8e3) {
    throw new Error("Суммарно до 8000 Max Particles во всех слоях.");
  }
  return { format: "GM Particle Studio", version: 2, scene, layers };
}
export {
  ParticleEngine,
  choices,
  clamp,
  clone,
  emitterAt,
  gradient,
  importLegacy,
  keys,
  makeLayer,
  makeScene,
  numericLimits,
  paramRanges,
  parameter,
  sample,
  sampleGradient,
  sampleKeys,
  validateLayer,
  validateProject,
  validateScene
};
