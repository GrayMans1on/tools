import { seeded } from "./effects-core.js?v=20261101-v09";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mod = (a, n) => (a % n + n) % n;
function periodicNoise(x, y, cells, seed) {
  const ix = Math.floor(x * cells), iy = Math.floor(y * cells);
  const fx = x * cells - ix, fy = y * cells - iy;
  const value = (a, b) => seeded(`${seed}:${mod(a, cells)}:${mod(b, cells)}`)();
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(value(ix, iy), value(ix + 1, iy), sx), lerp(value(ix, iy + 1), value(ix + 1, iy + 1), sx), sy);
}
function noiseField(size, cells, seed) {
  const random = seeded(seed);
  const grid = Float32Array.from({ length: cells * cells }, random);
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const gx = x / size * cells, gy = y / size * cells;
      const a = Math.floor(gx), b = Math.floor(gy);
      const u = gx - a, v = gy - b;
      const sx = u * u * (3 - 2 * u), sy = v * v * (3 - 2 * v);
      const at = (i, j) => grid[mod(j, cells) * cells + mod(i, cells)];
      out[y * size + x] = lerp(lerp(at(a, b), at(a + 1, b), sx), lerp(at(a, b + 1), at(a + 1, b + 1), sx), sy);
    }
  }
  return out;
}
function textureField(size, kind, scale, seed, detail = 4) {
  const out = new Float32Array(size * size);
  let sum = 0;
  for (let o = 0; o < detail; o += 1) {
    const weight = 2 ** -o;
    const f = noiseField(size, Math.max(1, Math.round(scale)) * 2 ** o, `${seed}:${o}`);
    sum += weight;
    for (let i = 0; i < f.length; i += 1) {
      out[i] += f[i] * weight;
    }
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const nx = x / size, ny = y / size;
      const n = out[i] / sum;
      let v = n;
      if (kind === "marble") {
        v = 0.5 + 0.5 * Math.sin(nx * Math.PI * 2 * scale + n * 8);
      }
      if (kind === "wood") {
        v = 0.5 + 0.5 * Math.sin((nx * scale + n * 0.3) * Math.PI * 12);
      }
      if (kind === "checker") {
        v = (Math.floor(nx * scale) + Math.floor(ny * scale)) % 2;
      }
      if (kind === "bricks") {
        const row = Math.floor(ny * scale);
        const tx = mod(nx * scale + row % 2 * 0.5, 1);
        const ty = mod(ny * scale, 1);
        v = tx < 0.045 || ty < 0.09 ? 0.06 : 0.65 + n * 0.3;
      }
      if (kind === "fabric") {
        v = 0.45 + 0.2 * Math.sin(nx * Math.PI * 2 * scale * 4) + 0.2 * Math.sin(ny * Math.PI * 2 * scale * 4) + n * 0.12;
      }
      if (kind === "dots") {
        const dx = mod(nx * scale, 1) - 0.5, dy = mod(ny * scale, 1) - 0.5;
        v = Math.hypot(dx, dy) < 0.28 ? 1 : 0;
      }
      if (kind === "grid") {
        v = mod(nx * scale, 1) < 0.05 || mod(ny * scale, 1) < 0.05 ? 1 : 0;
      }
      if (kind === "waves") {
        v = 0.5 + 0.5 * Math.sin(ny * Math.PI * 2 * scale + Math.sin(nx * Math.PI * 2 * scale) * 1.8);
      }
      if (kind === "stone") {
        v = Math.round(n * 7) / 7;
      }
      out[i] = clamp(v);
    }
  }
  return out;
}
function mapHeight(size, seed, kind, scale = 3) {
  const h = textureField(size, "noise", scale, seed, 5);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x, nx = x / (size - 1) * 2 - 1, ny = y / (size - 1) * 2 - 1;
      let mask = 0;
      if (kind === "island") {
        mask = Math.max(0, 1 - Math.pow(Math.hypot(nx, ny) * 0.82, 2));
      }
      if (kind === "archipelago") {
        mask = 0.75 - Math.pow(Math.hypot(nx, ny) * 0.45, 2);
      }
      if (kind === "continent") {
        mask = 0.95 - Math.max(0, nx * 0.6 + 0.2);
      }
      if (kind === "volcano") {
        const r = Math.hypot(nx, ny);
        mask = Math.exp(-(((r - 0.34) / 0.24) ** 2));
      }
      if (kind === "lake") {
        mask = Math.max(0, Math.hypot(nx, ny) * 0.7);
      }
      if (kind === "ridge") {
        mask = 0.65 * Math.exp(-((ny / 0.35) ** 2)) + 0.3;
      }
      if (["desert", "snow", "alien", "plains"].includes(kind)) {
        mask = 0.9 - Math.pow(Math.hypot(nx, ny) * 0.3, 2);
      }
      h[i] = clamp(h[i] * 0.6 + mask * 0.55 - 0.15);
    }
  }
  return h;
}
function riverPaths(height, size, sea, count, seed) {
  const random = seeded(seed);
  const paths = [];
  for (let k = 0; k < count; k += 1) {
    let best = 0;
    for (let j = 0; j < 100; j += 1) {
      const p = Math.floor(random() * height.length);
      if (height[p] > height[best]) {
        best = p;
      }
    }
    let index = best;
    const visited = /* @__PURE__ */ new Set();
    const path = [];
    for (let j = 0; j < size * 3; j += 1) {
      if (visited.has(index)) {
        break;
      }
      visited.add(index);
      path.push({ x: index % size, y: Math.floor(index / size) });
      if (height[index] <= sea) {
        break;
      }
      let next = index;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const x = index % size + dx, y = Math.floor(index / size) + dy;
          if (x >= 0 && y >= 0 && x < size && y < size && height[y * size + x] < height[next]) {
            next = y * size + x;
          }
        }
      }
      if (next === index) {
        break;
      }
      index = next;
    }
    if (path.length > 3) {
      paths.push(path);
    }
  }
  return paths;
}
function floodFill(pixels, width, x, y, color) {
  const index = y * width + x, old = pixels[index];
  if (old === color) {
    return;
  }
  const todo = [index];
  pixels[index] = color;
  while (todo.length) {
    const i = todo.pop(), cx = i % width, cy = Math.floor(i / width);
    for (const j of [cx ? i - 1 : -1, cx < width - 1 ? i + 1 : -1, cy ? i - width : -1, cy < width - 1 ? i + width : -1]) {
      if (j >= 0 && pixels[j] === old) {
        pixels[j] = color;
        todo.push(j);
      }
    }
  }
}
function pixelLine(x0, y0, x1, y1, put) {
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, error = dx + dy;
  while (true) {
    put(x0, y0);
    if (x0 === x1 && y0 === y1) {
      break;
    }
    const e = error * 2;
    if (e >= dy) {
      error += dy;
      x0 += sx;
    }
    if (e <= dx) {
      error += dx;
      y0 += sy;
    }
  }
}
function gearRatios(nodes, links) {
  const result = /* @__PURE__ */ new Map();
  const drive = nodes.find((n) => n.driver) || nodes[0];
  if (!drive) {
    return result;
  }
  result.set(drive.id, 1);
  const queue = [drive.id];
  while (queue.length) {
    const id = queue.shift(), a = nodes.find((n) => n.id === id);
    for (const link of links) {
      if (link.a !== id && link.b !== id) {
        continue;
      }
      const other = link.a === id ? link.b : link.a, b = nodes.find((n) => n.id === other);
      if (!b) {
        continue;
      }
      const ratio = result.get(id) * a.teeth / b.teeth * (link.kind === "mesh" || link.kind === "cross" ? -1 : 1);
      if (result.has(other)) {
        if (Math.abs(result.get(other) - ratio) > 1e-6) {
          throw new Error("Несовместимый замкнутый контур передач.");
        }
      } else {
        result.set(other, ratio);
        queue.push(other);
      }
    }
  }
  return result;
}
export {
  clamp,
  floodFill,
  gearRatios,
  lerp,
  mapHeight,
  mod,
  noiseField,
  periodicNoise,
  pixelLine,
  riverPaths,
  textureField
};
