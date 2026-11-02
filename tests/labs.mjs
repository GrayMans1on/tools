import assert from "node:assert/strict";
import { periodicNoise, textureField, mapHeight, riverPaths, floodFill, pixelLine, gearRatios } from "../tools/lab-core.js";
import { paperMesh, paperNet, projectMesh, netSVG } from "../tools/paper-core.js";
import { soundDefaults, soundPresets, synthesize, ambienceKinds, renderAmbience } from "../tools/sound-core.js";
import { particlePresetList, makeParticlePreset, strokePresetList } from "../tools/particle-presets.js";
import { validateLayer, ParticleEngine, makeScene } from "../tools/particle-engine.js";
import { Matter as M } from "../tools/vendor/physics.js";
import { tools } from "../catalog.js";
for (const x of [0.01, 0.2, 0.5, 0.99]) {
  assert.ok(Math.abs(periodicNoise(x, 0.4, 8, "test") - periodicNoise(x + 1, 0.4, 8, "test")) < 1e-12);
}
for (const kind of ["noise", "wood", "marble", "bricks", "fabric", "stone", "checker", "dots", "grid", "waves"]) {
  const field = textureField(32, kind, 8, "42");
  assert.ok([...field].every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
  assert.deepEqual(field, textureField(32, kind, 8, "42"));
}
for (const kind of ["island", "archipelago", "continent", "volcano", "lake", "ridge", "desert", "snow", "alien", "plains"]) {
  const field = mapHeight(32, "42", kind);
  assert.ok([...field].every((v) => v >= 0 && v <= 1));
  for (const river of riverPaths(field, 32, 0.4, 5, "r")) {
    for (let i = 1; i < river.length; i++) {
      assert.ok(field[river[i].y * 32 + river[i].x] <= field[river[i - 1].y * 32 + river[i - 1].x]);
    }
  }
}
for (const kind of ["cube", "box", "tetra", "octa", "pyramid", "triPrism", "hexPrism", "cylinder"]) {
  const mesh = paperMesh(kind, 30, 1), net = paperNet(mesh, 4);
  assert.equal(net.polygons.length, mesh.faces.length);
  assert.equal(net.folds.length, mesh.faces.length - 1);
  for (let f = 0; f < mesh.faces.length; f++) {
    const ids = mesh.faces[f], poly = net.polygons[f];
    for (let i = 0; i < ids.length; i++) {
      const a2 = mesh.vertices[ids[i]], b2 = mesh.vertices[ids[(i + 1) % ids.length]], p = poly[i], q = poly[(i + 1) % poly.length];
      assert.ok(Math.abs(Math.hypot(...a2.map((v, j) => v - b2[j])) - Math.hypot(p[0] - q[0], p[1] - q[1])) < 1e-6, kind);
    }
  }
  assert.ok(netSVG(mesh, net).includes("mm"));
  assert.ok(projectMesh(mesh, 0.4, 0.7).every((f) => f.points.flat().every(Number.isFinite)));
}
const pixels = new Uint32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]);
floodFill(pixels, 3, 0, 0, 2);
assert.deepEqual([...pixels], [2, 1, 0, 2, 1, 0, 2, 1, 0]);
const line = [];
pixelLine(0, 0, 3, 3, (x, y) => line.push([x, y]));
assert.deepEqual(line, [[0, 0], [1, 1], [2, 2], [3, 3]]);
const nodes = [{ id: 1, teeth: 24, driver: true }, { id: 2, teeth: 36 }, { id: 3, teeth: 12 }];
assert.equal(gearRatios(nodes, [{ a: 1, b: 2, kind: "mesh" }]).get(2), -2 / 3);
assert.throws(() => gearRatios(nodes, [{ a: 1, b: 2, kind: "mesh" }, { a: 2, b: 3, kind: "mesh" }, { a: 3, b: 1, kind: "mesh" }]));
for (const [id, , params] of soundPresets) {
  const result = await synthesize({ ...soundDefaults, ...params, duration: 0.1 }, 8e3);
  assert.ok(result.channels.every((ch) => [...ch].every(Number.isFinite)), id);
  assert.ok(result.peak <= 0.95);
  assert.ok(result.channels[0].some((v) => v !== 0));
}
const a = await synthesize(soundDefaults, 8e3), b = await synthesize(soundDefaults, 8e3);
assert.deepEqual(a.channels, b.channels);
for (const kind of ambienceKinds.filter((k) => k !== "sample")) {
  const result = await renderAmbience([{ kind, gain: 0.5, pan: 0, rate: 1 }], 1, "42", 8e3);
  assert.ok(result.channels[0].every(Number.isFinite));
}
for (const [id] of particlePresetList) {
  const layer = validateLayer(makeParticlePreset(id));
  const engine2 = new ParticleEngine(layer, makeScene());
  await engine2.seek(0.1);
  assert.ok(engine2.items.every((p) => Number.isFinite(p.x + p.y)));
}
assert.equal(particlePresetList.length, 48);
assert.equal(strokePresetList.length, 12);
const engine = M.Engine.create();
const ball = M.Bodies.circle(0, 0, 10);
M.Composite.add(engine.world, ball);
for (let i = 0; i < 60; i++) {
  M.Engine.update(engine, 1e3 / 60);
}
assert.ok(ball.position.y > 100);
M.Engine.clear(engine);
assert.equal(tools.length, 40);
console.log("PASS: periodic textures, deterministic terrain/rivers, unfold edge lengths/topology, 3D projection, flood fill, gear ratios, sound/ambience DSP, 48 particle presets and Matter.js dynamics.");
