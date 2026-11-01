import { makeLayer, parameter, keys, gradient } from "./particle-engine.js?v=20261101-v09";
const definitions = [
  ["trailComet", "След · голубая комета", "#a9e8ff", "#508cff", "circle", 1.2, 18],
  ["trailGold", "След · золотая комета", "#fff3af", "#ec963f", "circle", 1.1, 20],
  ["trailMeteor", "След · метеор", "#ffd2a0", "#d04b43", "line", 0.7, 14],
  ["trailLaser", "След · тонкий лазер", "#c4ffec", "#37d59a", "line", 0.3, 3],
  ["trailNeonPink", "След · розовый неон", "#ffc7f1", "#b862dc", "circle", 1, 9],
  ["trailNeonBlue", "След · синий неон", "#d0f6ff", "#3688ec", "circle", 1, 9],
  ["trailInk", "След · чернила", "#574e70", "#151b31", "line", 1.5, 12],
  ["trailChalk", "След · мел", "#f7efda", "#c9bfa6", "line", 1.4, 7],
  ["trailWide", "След · широкая лента", "#b8ffe1", "#547ac4", "circle", 1.1, 35],
  ["trailDotted", "След · прерывистый", "#efddff", "#8f74d2", "circle", 0.18, 12],
  ["trailSmoke", "След · дым", "#d5dbea", "#5c627b", "line", 1.8, 32],
  ["trailSpark", "След · искры", "#fff1bd", "#f1844b", "line", 0.25, 6],
  ["trailVortex", "След · вихрь", "#e5ccff", "#7558c8", "static", 0.7, 8],
  ["trailSpiral", "След · спираль", "#a1f4e5", "#3b88a9", "static", 1.2, 8],
  ["trailElectric", "След · электрический", "#e5f8ff", "#839ff3", "line", 0.3, 5],
  ["trailOrbit", "След · орбитальное кольцо", "#d6f2ff", "#7293da", "circle", 2, 5],
  ["trailSoft", "След · мягкое свечение", "#e3caff", "#9367b2", "circle", 1.4, 26],
  ["trailFire", "След · огненный", "#fff3ad", "#ec543d", "line", 0.7, 18],
  ["trailIce", "След · ледяной", "#efffff", "#7ed7e6", "line", 0.9, 13],
  ["trailRainbow", "След · смена цветов", "#ffa3b4", "#809bff", "circle", 1.5, 14],
  ["trailJet", "След · реактивная струя", "#e5efff", "#6a83ff", "line", 0.2, 15],
  ["trailWater", "След · брызги", "#e2fbff", "#439ac3", "line", 0.35, 7],
  ["trailSquares", "След · пиксельная лента", "#e0ffc4", "#61b991", "circle", 0.65, 8],
  ["trailLocal", "След · локальная орбита", "#ffd6fb", "#9266d3", "circle", 0.9, 8]
];
const particles = [["sparkBurst", "Частицы · вспышка искр"], ["sparkFountain", "Частицы · фонтан искр"], ["dust", "Частицы · пыль в воздухе"], ["embers", "Частицы · тлеющие угли"], ["blizzard", "Частицы · метель"], ["bubbles", "Частицы · пузырьки"], ["steam", "Частицы · пар"], ["smokeDark", "Частицы · густой дым"], ["smokePurple", "Частицы · магический дым"], ["portal", "Частицы · портал"], ["blackhole", "Частицы · воронка"], ["repel", "Частицы · отталкивание"], ["stars", "Частицы · звёздная пыль"], ["pixelHit", "Частицы · пиксельный удар"], ["pixelDust", "Частицы · пиксельная пыль"], ["rainImpact", "Частицы · дождь и отскоки"], ["snowBurst", "Частицы · снежный взрыв"], ["leaves", "Частицы · листопад (геометрический)"], ["goldRain", "Частицы · золотой дождь"], ["fireworkMulti", "Частицы · серия фейерверков"], ["shockwave", "Частицы · расширяющееся кольцо"], ["fireflies", "Частицы · светлячки"], ["confettiPastel", "Частицы · пастельное конфетти"], ["confettiFast", "Частицы · салют конфетти"]];
const particlePresetList = [...definitions.map((p) => [p[0], p[1]]), ...particles];
function makeParticlePreset(id) {
  const trail = definitions.find((p) => p[0] === id);
  if (!trail && !particles.some((p) => p[0] === id)) {
    return null;
  }
  const s = makeLayer();
  Object.assign(s, { startColorA: "#ffffff", startColorB: "#ffffff", y: 50 });
  if (trail) {
    const [, , a, b, motion, life, size] = trail;
    Object.assign(s, { motion, motionX: 160, motionY: 90, period: 3, shape: "point", speed: parameter(2, 15), life: parameter(0.3, 0.7), size: parameter(size * 0.6, size), colorKeys: gradient(a, b), rate: parameter(100), gravity: 0, noiseEnabled: false, trailsEnabled: true, trailLife: life, trailSamples: 60, trailRatio: 1, trailDieWithParticle: false, trailWidth: { ...parameter(1), mode: "curve", keys: keys(0, 0.6, 1) }, sizeX: { ...parameter(1), mode: "curve", keys: keys(0.7, 1, 0.1) }, bursts: [], rotationEnabled: false });
    if (id === "trailDotted") {
      s.rate = parameter(18);
      s.trailRatio = 0.35;
    }
    if (id === "trailInk" || id === "trailChalk") {
      s.blend = "source-over";
      s.sprite = "circle";
      s.trailWidth = { ...parameter(1), mode: "curve", keys: keys(0.3, 1, 1) };
    }
    if (id === "trailWide") {
      s.trailWidth = { ...parameter(1), mode: "curve", keys: keys(0, 1, 0.4) };
    }
    if (id === "trailSmoke" || id === "trailSoft") {
      s.blend = "source-over";
      s.noiseEnabled = true;
      s.noise = 25;
      s.sizeX = { ...parameter(1), mode: "curve", keys: keys(0.2, 1, 2) };
    }
    if (["trailVortex", "trailSpiral"].includes(id)) {
      s.shape = "circle";
      s.radius = 35;
      s.speed = parameter(30, 70);
      s.life = parameter(1, 2);
      s.velocityEnabled = true;
      s.orbital = parameter(id === "trailVortex" ? 180 : 90);
      s.radial = parameter(id === "trailVortex" ? -30 : 50);
    }
    if (id === "trailElectric") {
      s.noiseEnabled = true;
      s.noise = 1e3;
      s.frequency = 16;
      s.octaves = 4;
      s.life = parameter(0.1, 0.3);
    }
    if (id === "trailOrbit") {
      s.motionX = 180;
      s.motionY = 180;
      s.speed = parameter(0);
      s.period = 4;
      s.rate = parameter(90);
    }
    if (id === "trailRainbow") {
      s.colorKeys = [{ t: 0, color: "#ff6b91", alpha: 1 }, { t: 0.25, color: "#ffd36b", alpha: 1 }, { t: 0.5, color: "#6be8b3", alpha: 1 }, { t: 0.75, color: "#6ba9ff", alpha: 1 }, { t: 1, color: "#c18cff", alpha: 0 }];
    }
    if (id === "trailJet") {
      s.speed = parameter(80, 160);
      s.angle = 90;
      s.spread = 15;
      s.noiseEnabled = true;
      s.noise = 15;
    }
    if (id === "trailWater") {
      s.gravity = 150;
      s.forceEnabled = true;
      s.collisionEnabled = true;
      s.floor = 85;
      s.bounce = 0.7;
      s.speed = parameter(10, 60);
      s.life = parameter(0.8, 1.2);
    }
    if (id === "trailSquares") {
      s.sprite = "square";
      s.blend = "source-over";
      s.startRotation = parameter(0);
    }
    if (id === "trailLocal") {
      s.space = "local";
      s.trailWorld = false;
      s.shape = "circle";
      s.radius = 35;
      s.velocityEnabled = true;
      s.orbital = parameter(90);
      s.speed = parameter(20, 40);
      s.life = parameter(1, 2);
    }
    return s;
  }
  const burst = (count = 200) => Object.assign(s, { looping: false, shape: "point", spread: 360, speed: parameter(80, 250), life: parameter(0.4, 1), rate: parameter(0), bursts: [{ time: 0, min: count, max: count, cycles: 1, interval: 1, probability: 1 }], gravity: 50, noiseEnabled: false });
  if (["sparkBurst", "pixelHit", "snowBurst", "confettiFast"].includes(id)) {
    burst();
    s.trailsEnabled = id === "sparkBurst";
    s.trailLife = 0.2;
    if (id === "pixelHit") {
      s.sprite = "square";
      s.size = parameter(3, 9);
      s.startRotation = parameter(0);
      s.colorKeys = gradient("#ffe7cc", "#c46f66");
    }
    if (id === "snowBurst") {
      s.colorKeys = gradient("#ffffff", "#91cadb");
      s.sprite = "circle";
    }
    if (id === "confettiFast") {
      s.sprite = "square";
      s.rotation = parameter(-900, 900);
      s.gravity = 250;
      s.life = parameter(2, 3);
      s.colorRandom = true;
    }
  }
  if (id === "sparkFountain") {
    Object.assign(s, { y: 90, speed: parameter(250, 400), gravity: 300, size: parameter(2, 5), trailsEnabled: true, trailLife: 0.2, life: parameter(1, 2) });
  }
  if (["dust", "fireflies", "stars", "pixelDust"].includes(id)) {
    Object.assign(s, { shape: "box", boxWidth: 700, boxHeight: 350, speed: parameter(2, 10), gravity: 0, life: parameter(3, 6), rate: parameter(25), size: parameter(2, id === "fireflies" ? 8 : 4), noise: 10, bursts: [], sprite: id === "pixelDust" ? "square" : id === "stars" ? "star" : "glow", colorKeys: gradient(id === "fireflies" ? "#eaff9b" : "#e6e9ff", id === "fireflies" ? "#739c56" : "#8f95b4") });
  }
  if (id === "embers") {
    Object.assign(s, { y: 90, speed: parameter(30, 80), gravity: -15, size: parameter(2, 5), life: parameter(2, 4), rate: parameter(25), noise: 70, trailsEnabled: true, trailLife: 0.2 });
  }
  if (["blizzard", "goldRain", "leaves"].includes(id)) {
    Object.assign(s, { shape: "box", boxWidth: 900, boxHeight: 0, y: -5, angle: 70, spread: 25, gravity: 25, speed: parameter(50, 140), life: parameter(5, 8), rate: parameter(70), size: parameter(3, 10), bursts: [], noise: 60, blend: "source-over", sprite: id === "leaves" ? "square" : "circle", colorKeys: gradient(id === "goldRain" ? "#ffe69d" : id === "leaves" ? "#bfbe68" : "#ffffff", id === "goldRain" ? "#b98b3c" : id === "leaves" ? "#876042" : "#afcedf") });
  }
  if (["steam", "smokeDark", "smokePurple"].includes(id)) {
    Object.assign(s, { y: 85, speed: parameter(20, 50), life: parameter(3, 5), size: parameter(25, 55), rate: parameter(25), gravity: -12, noise: 25, blend: "source-over", sizeX: { ...parameter(1), mode: "curve", keys: keys(0.2, 1, 2.4) }, colorKeys: [{ t: 0, color: id === "smokePurple" ? "#a075bb" : id === "steam" ? "#e1e8ed" : "#4b5064", alpha: 0 }, { t: 0.2, color: id === "smokePurple" ? "#a075bb" : id === "steam" ? "#e1e8ed" : "#4b5064", alpha: 0.3 }, { t: 1, color: "#626c80", alpha: 0 }], bursts: [] });
  }
  if (["portal", "blackhole", "repel"].includes(id)) {
    Object.assign(s, { shape: "ring", radius: 120, speed: parameter(0, 10), gravity: 0, life: parameter(2, 3), rate: parameter(100), fieldEnabled: true, fieldY: 50, fieldRadius: 300, attraction: id === "repel" ? -300 : 250, vortex: 250, trailsEnabled: true, trailLife: 0.5, size: parameter(3, 7), colorKeys: gradient("#decdff", "#718be8"), bursts: [] });
    if (id === "portal") {
      s.attraction = 0;
      s.velocityEnabled = true;
      s.orbital = parameter(130);
    }
  }
  if (id === "bubbles") {
    Object.assign(s, { y: 95, shape: "box", boxWidth: 650, boxHeight: 0, angle: -90, spread: 5, gravity: -8, speed: parameter(20, 50), size: parameter(6, 22), life: parameter(4, 6), sprite: "circle", colorKeys: [{ t: 0, color: "#a3e0f5", alpha: 0.2 }, { t: 1, color: "#d5f7ff", alpha: 0 }], rate: parameter(20), bursts: [] });
  }
  if (id === "rainImpact") {
    Object.assign(s, { shape: "line", radius: 500, y: -10, angle: 95, spread: 2, speed: parameter(300, 400), life: parameter(2, 3), gravity: 100, noiseEnabled: false, sprite: "stretched", size: parameter(1, 3), rate: parameter(100), collisionEnabled: true, floor: 90, bounce: 0.3, subEnabled: true, subEvent: "collision", subCount: 3, subLife: 0.3, subSpeed: 40, subSize: 2, subColor: "#b9e4f5", colorKeys: gradient("#d5efff", "#638dae"), bursts: [] });
  }
  if (id === "fireworkMulti") {
    Object.assign(s, { emission: 4, y: 90, shape: "point", speed: parameter(260, 330), life: parameter(1.2, 1.7), gravity: 100, noiseEnabled: false, rate: parameter(0), bursts: [{ time: 0, min: 2, max: 4, cycles: 4, interval: 0.8, probability: 1 }], subEnabled: true, subEvent: "death", subCount: 25, subSpeed: 150, subLife: 1, subColor: "#c0a1ff", trailsEnabled: true, trailLife: 0.35 });
  }
  if (id === "shockwave") {
    burst(350);
    s.gravity = 0;
    s.shape = "ring";
    s.radius = 10;
    s.arc = 360;
    s.speed = parameter(180);
    s.life = parameter(0.7);
    s.size = parameter(4);
    s.colorKeys = gradient("#d0f5ff", "#6c9ec2");
    s.trailsEnabled = true;
    s.trailLife = 0.1;
  }
  if (id === "confettiPastel") {
    burst(300);
    Object.assign(s, { sprite: "square", blend: "source-over", gravity: 180, life: parameter(2, 4), size: parameter(6, 12), colorRandom: true, colorKeys: gradient("#ffe7b7", "#e0a6b2"), colorKeys2: gradient("#c9efdc", "#b6bbec"), rotation: parameter(-500, 500) });
  }
  return s;
}
const strokePresetList = [["mint", "Мятный неон", { pathStyle: "glow", colorStart: "#adffe0", colorEnd: "#43ad98", strokeWidth: 8 }], ["pink", "Розовый неон", { pathStyle: "glow", colorStart: "#ffd0ee", colorEnd: "#c751bf", strokeWidth: 12 }], ["gold", "Золотые искры", { pathStyle: "particles", colorStart: "#fff2a5", colorEnd: "#eaa24c", strokeWidth: 10, intensity: 2 }], ["ice", "Ледяная молния", { pathStyle: "lightning", colorStart: "#d9fbff", colorEnd: "#7ea9ed", strokeWidth: 8 }], ["redLightning", "Красная молния", { pathStyle: "lightning", colorStart: "#ffd6c9", colorEnd: "#e05654", strokeWidth: 14 }], ["inkBlack", "Чёрные чернила", { pathStyle: "ink", colorStart: "#242735", colorEnd: "#151722", strokeWidth: 16 }], ["inkBlue", "Синие чернила", { pathStyle: "ink", colorStart: "#3c5384", colorEnd: "#182d59", strokeWidth: 12 }], ["smokeGray", "Серый дым", { pathStyle: "smoke", colorStart: "#c6cad3", colorEnd: "#666e84", strokeWidth: 18, intensity: 2 }], ["smokeMagic", "Магический дым", { pathStyle: "smoke", colorStart: "#d1a8ec", colorEnd: "#7664ab", strokeWidth: 16, intensity: 2 }], ["fineSpark", "Тонкий след искр", { pathStyle: "particles", colorStart: "#e4f6ff", colorEnd: "#7cb4df", strokeWidth: 4, intensity: 1.5 }], ["wideGlow", "Широкое свечение", { pathStyle: "glow", colorStart: "#e2d4ff", colorEnd: "#9273c8", strokeWidth: 25 }], ["fastArc", "Быстрая дуга", { pathStyle: "lightning", colorStart: "#ecffff", colorEnd: "#739cf5", strokeWidth: 5, intensity: 2, reveal: 0.5, fade: 30 }]];
export {
  makeParticlePreset,
  particlePresetList,
  strokePresetList
};
