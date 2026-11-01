import assert from "node:assert/strict";
import {
  ParticleEngine,
  makeLayer,
  makeScene,
  parameter,
  keys,
  sample,
  sampleKeys,
  sampleGradient,
  validateLayer,
  validateProject,
  importLegacy
} from "../tools/particle-engine.js";
const scene = makeScene();
const base = () => ({
  ...makeLayer(),
  looping: false,
  emission: 1,
  noiseEnabled: false,
  forceEnabled: false,
  drag: 0,
  sizeEnabled: false,
  colorEnabled: false,
  rotationEnabled: false,
  life: parameter(2),
  speed: parameter(100),
  rate: parameter(0),
  bursts: [{
    time: 0,
    min: 1,
    max: 1,
    cycles: 1,
    interval: 1,
    probability: 1
  }]
});
assert.equal(sampleKeys(keys(0, 2), 0.5), 1);
assert.equal(sampleKeys(keys(0, 2), 0.5, "step"), 0);
assert.equal(sample({ ...parameter(1), mode: "curves", keys: keys(0, 2), keys2: keys(2, 4) }, 0.5, 0.25), 1.5);
assert.deepEqual(sampleGradient([{ t: 0, color: "#000000", alpha: 1 }, { t: 1, color: "#ffffff", alpha: 0 }], 0.5), { rgb: [
  127.5,
  127.5,
  127.5
], alpha: 0.5 });
let s = base();
let e = new ParticleEngine(s, scene);
await e.seek(0.5);
assert.equal(e.items.length, 1);
assert.ok(e.items[0].y < scene.height * 0.8);
const first = JSON.stringify(e.items);
await e.seek(0.9);
await e.seek(0.5);
assert.equal(JSON.stringify(e.items), first, "backward seek must reproduce physics and trails");
const same = new ParticleEngine(s, scene);
await same.seek(0.5);
assert.equal(JSON.stringify(same.items), first);
const different = new ParticleEngine({ ...s, seed: "other" }, scene);
await different.seek(0.5);
assert.notEqual(JSON.stringify(different.items), first);
s = { ...base(), bursts: [], rate: parameter(60), life: parameter(5) };
e = new ParticleEngine(s, scene);
await e.seek(1);
assert.equal(e.items.length, 60, "last emission interval is counted");
s = { ...base(), looping: true, emission: 0.5, life: parameter(5), bursts: [{
  time: 0,
  min: 2,
  max: 2,
  cycles: 2,
  interval: 0.25,
  probability: 1
}] };
e = new ParticleEngine(s, scene);
await e.seek(1);
assert.equal(e.items.length, 10, "repeated bursts and looping");
e = new ParticleEngine({ ...s, bursts: [{ time: 0, min: 100, max: 100, cycles: 1, interval: 1, probability: 0 }] }, scene);
await e.seek(1);
assert.equal(e.items.length, 0);
e = new ParticleEngine({ ...s, maxParticles: 3 }, scene);
await e.seek(1);
assert.equal(e.items.length, 3);
assert.equal(e.dropped, 7);
s = { ...base(), looping: true, emission: 0.5, life: parameter(3), rate: parameter(20) };
const warm = new ParticleEngine({ ...s, prewarm: true }, scene);
const manual = new ParticleEngine(s, scene);
await warm.seek(0);
await manual.seek(0.5);
assert.equal(JSON.stringify(warm.items), JSON.stringify(manual.items));
s = { ...base(), motion: "line", motionX: 100, motionY: 0, period: 2, speed: parameter(0) };
const world = new ParticleEngine(s, scene);
const local = new ParticleEngine({ ...s, space: "local" }, scene);
await world.seek(0.5);
await local.seek(0.5);
assert.ok(local.particles[0].q.x - world.particles[0].q.x > 90, "local particles follow moving emitter");
e = new ParticleEngine({ ...s, bursts: [], rateDistance: 1 }, scene);
await e.seek(0.5);
assert.ok(e.items.length >= 99, "distance emission follows travel");
s = { ...base(), angle: 90, spread: 0, y: 50, speed: parameter(200), collisionEnabled: true, floor: 70, bounce: 1 };
e = new ParticleEngine(s, scene);
await e.seek(0.6);
assert.ok(e.collisions > 0);
assert.ok(e.items[0].vy < 0, "collision reflects downward speed");
s = {
  ...base(),
  speed: parameter(0),
  life: parameter(0.1),
  subEnabled: true,
  subEvent: "death",
  subCount: 4,
  subLife: 1,
  subSpeed: 50
};
e = new ParticleEngine(s, scene);
await e.seek(0.2);
assert.equal(e.items.length, 4);
assert.ok(e.items.every((p) => p.child));
s = {
  ...base(),
  x: 50,
  y: 50,
  speed: parameter(0),
  triggerEnabled: true,
  triggerX: 50,
  triggerY: 50,
  triggerWidth: 100,
  triggerHeight: 100,
  triggerAction: "kill"
};
e = new ParticleEngine(s, scene);
await e.seek(0.1);
assert.equal(e.items.length, 0);
assert.equal(e.triggers, 1);
s = { ...base(), life: parameter(0.2), trailsEnabled: true, trailLife: 0.5 };
e = new ParticleEngine(s, scene);
await e.seek(0.3);
assert.ok(e.ghosts.length > 0);
await e.seek(1);
assert.equal(e.ghosts.length, 0);
e = new ParticleEngine({
  ...base(),
  velocityEnabled: true,
  orbital: parameter(30),
  radial: parameter(15),
  noiseEnabled: true,
  noise: 100,
  forceEnabled: true,
  forceX: { ...parameter(0), mode: "curve", keys: keys(0, 100) },
  fieldEnabled: true
}, scene);
await e.seek(0.8);
const combined = JSON.stringify(e.items);
await e.seek(0.2);
await e.seek(0.8);
assert.equal(JSON.stringify(e.items), combined, "combined modules remain deterministic");
e = new ParticleEngine({
  ...base(),
  speed: parameter(0),
  velocityEnabled: true,
  velocityX: parameter(200),
  sizeSpeedEnabled: true,
  sizeBySpeed: { ...parameter(1), mode: "curve", keys: keys(0, 3) },
  speedMin: 0,
  speedMax: 200
}, scene);
await e.seek(0.2);
assert.ok(Math.abs(e.particles[0].q.speed - 200) < 1e-6, "by Speed includes Velocity over Lifetime");
const old = importLegacy({ format: "GM Effect", version: 1, kind: "particles", values: {
  lifeMin: 1,
  lifeMax: 2,
  speedMin: 50,
  speedMax: 90,
  sizeMin: 2,
  sizeMax: 8,
  rate: 20,
  burst: 5
} });
assert.equal(old.layers[0].rate.value, 20);
assert.equal(old.layers[0].looping, false);
assert.equal(old.layers[0].bursts[0].max, 5);
validateProject(old);
assert.throws(() => validateLayer({ ...makeLayer(), bursts: [{ time: 0, min: 3e3, max: 3e3, cycles: 32, interval: 0.1, probability: 1 }] }));
assert.throws(() => validateLayer({ ...makeLayer(), sheetRows: 2, sheetRow: 2 }));
assert.throws(() => validateLayer({ ...makeLayer(), life: { ...parameter(1), keys: [{ t: 0, v: 1 }, { t: 0, v: 2 }] } }));
assert.throws(() => validateProject({ format: "GM Particle Studio", version: 2, scene, layers: Array.from(
  { length: 6 },
  () => makeLayer()
) }));
console.log("PASS: particle curves/gradients, seeded physics, backward seek, rate/bursts/loops, prewarm, distance/local-space motion, cap, collisions, sub-emitters, triggers, trails, legacy import and invalid projects.");

const fading = new ParticleEngine({...base(), life: parameter(.2), trailsEnabled: true, trailLife: .5, colorEnabled: true}, scene);
await fading.seek(.3);
assert.equal(fading.ghosts[0].q.alpha, 0);
assert.ok(fading.ghosts[0].trail.some(point => point.alpha > 0), 'detached trails retain sampled color and alpha');
