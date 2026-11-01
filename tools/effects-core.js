// Pure, time-addressable simulation: rendering order never consumes shared randomness.
export function seeded(seed) {
  let h = 2166136261;
  for (const c of String(seed)) { h = Math.imul(h ^ c.codePointAt(0), 16777619); }
  return () => { h += 0x6D2B79F5; let t = Math.imul(h ^ h >>> 15, h | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const mix = (a, b, t) => a + (b - a) * t;
export function curve(a, b, c, t) { return t < .5 ? mix(a, b, t * 2) : mix(b, c, t * 2 - 1); }
export function buildParticles(s) {
  const random = seeded(s.seed); const out = [];
  const total = Math.ceil(s.rate * s.emission) + s.burst;
  if (total > 12000) { throw new Error('До 12 000 частиц за цикл. Уменьши Rate или Duration.'); }
  for (let i = 0; i < total; i += 1) {
    const born = i < s.burst ? s.delay : s.delay + (i - s.burst) / s.rate;
    const angle = (s.angle + (random() - .5) * s.spread) * Math.PI / 180;
    const radius = Math.sqrt(random()) * s.radius;
    const theta = random() * Math.PI * 2;
    let x = 0; let y = 0; let direction = angle;
    if (s.shape === 'circle') { x = Math.cos(theta) * radius; y = Math.sin(theta) * radius; direction = theta; }
    if (s.shape === 'box') { x = (random() - .5) * s.radius * 2; y = (random() - .5) * s.radius * 2; }
    if (s.shape === 'cone') { x = (random() - .5) * s.radius * 2; }
    const speed = mix(s.speedMin, s.speedMax, random());
    out.push({born, life: mix(s.lifeMin, s.lifeMax, random()), x: x + s.x, y: y + s.y, vx: Math.cos(direction) * speed, vy: Math.sin(direction) * speed, size: mix(s.sizeMin, s.sizeMax, random()), rotation: random() * Math.PI * 2, spin: (random() * 2 - 1) * s.rotation, phase: random() * Math.PI * 2, frequency: .6 + random() * 1.4, tint: random()});
  }
  return out;
}
export function particleAt(p, time, s) {
  const age = time - p.born;
  if (age < 0 || age >= p.life) { return null; }
  const u = age / p.life; const drag = s.drag;
  const motion = drag > .0001 ? (1 - Math.exp(-drag * age)) / drag : age;
  const f = p.frequency * s.frequency;
  const noiseX = s.noise * (Math.sin(p.phase + age * f) - Math.sin(p.phase));
  const noiseY = s.noise * (Math.cos(p.phase + age * f * 1.13) - Math.cos(p.phase));
  return {x: p.x + p.vx * motion + s.wind * age + noiseX, y: p.y + p.vy * motion + .5 * s.gravity * age * age + noiseY, size: p.size * curve(s.scaleStart, s.scaleMid, s.scaleEnd, u), alpha: Math.max(0, curve(s.alphaStart, s.alphaMid, s.alphaEnd, u)), rotation: p.rotation + p.spin * age * Math.PI / 180, u};
}
export function pathPoint(points, t) {
  if (!points.length) { return {x: .5, y: .5}; }
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) { lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)); }
  const target = Math.max(0, Math.min(1, t)) * lengths.at(-1);
  let i = 1; while (i < points.length - 1 && lengths[i] < target) { i += 1; }
  if (points.length === 1) { return points[0]; }
  const f = (target - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
  return {x: mix(points[i - 1].x, points[i].x, f), y: mix(points[i - 1].y, points[i].y, f)};
}
export function hexColor(a, b, t) {
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const c = rgb(a); const d = rgb(b);
  return `rgb(${c.map((v, i) => Math.round(mix(v, d[i], t))).join(',')})`;
}
