const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function spiroPoints({ outer = 160, inner = 57, offset = 90, turns = 20, outside = false }, count = 6e3) {
  const r = Math.max(1, inner), base = outside ? outer + r : outer - r;
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count * turns * TAU;
    return {
      x: base * Math.cos(t) + offset * Math.cos(base / r * t),
      y: base * Math.sin(t) + (outside ? -1 : 1) * offset * Math.sin(base / r * t)
    };
  });
}
function traceRuns(data, width, height, threshold = 140, levels = 1, invert = false) {
  const groups = /* @__PURE__ */ new Map();
  for (let y = 0; y < height; y += 1) {
    let start = 0, previous = -1;
    const keyAt = (x) => {
      const i = (y * width + x) * 4;
      if (x >= width || data[i + 3] < 32) {
        return -1;
      }
      const l = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      if (levels === 1) {
        return (invert ? l >= threshold : l < threshold) ? 0 : -1;
      }
      const n = Math.max(2, Math.round(Math.cbrt(levels)));
      return [0, 1, 2].map((k) => Math.round(Math.round(data[i + k] / 255 * (n - 1)) * 255 / (n - 1))).join(",");
    };
    for (let x = 0; x <= width; x += 1) {
      const key = keyAt(x);
      if (key !== previous) {
        if (previous !== -1) {
          if (!groups.has(previous)) {
            groups.set(previous, []);
          }
          groups.get(previous).push([start, y, x - start]);
        }
        previous = key;
        start = x;
      }
    }
  }
  return [...groups].map(([color, runs]) => ({ color: color === 0 ? "#28282f" : `rgb(${color})`, runs }));
}
function runsToPath(runs) {
  const active = /* @__PURE__ */ new Map(), rectangles = [];
  for (const [x, y, width] of runs) {
    const key = `${x},${width}`, prev = active.get(key);
    if (prev && prev.y + prev.h === y) {
      prev.h += 1;
    } else {
      const r = { x, y, w: width, h: 1 };
      rectangles.push(r);
      active.set(key, r);
    }
  }
  return rectangles.map((r) => `M${r.x} ${r.y}h${r.w}v${r.h}h-${r.w}z`).join("");
}
function gravityStep(bodies, dt, gravity = 1, softening = 8) {
  const accelerations = () => bodies.map((a, i) => bodies.reduce((sum, b, j) => {
    if (i !== j) {
      const dx = b.x - a.x, dy = b.y - a.y, d = (dx * dx + dy * dy + softening ** 2) ** 1.5;
      sum.x += gravity * b.mass * dx / d;
      sum.y += gravity * b.mass * dy / d;
    }
    return sum;
  }, { x: 0, y: 0 }));
  let acc = accelerations();
  bodies.forEach((b, i) => {
    if (!b.fixed) {
      b.x += b.vx * dt + 0.5 * acc[i].x * dt ** 2;
      b.y += b.vy * dt + 0.5 * acc[i].y * dt ** 2;
      b.vx += 0.5 * acc[i].x * dt;
      b.vy += 0.5 * acc[i].y * dt;
    }
  });
  acc = accelerations();
  bodies.forEach((b, i) => {
    if (!b.fixed) {
      b.vx += 0.5 * acc[i].x * dt;
      b.vy += 0.5 * acc[i].y * dt;
    }
  });
  return bodies;
}
function posedBones(bones, angles) {
  return bones.map((bone, i) => {
    const parent = bone.parent >= 0 ? bones[bone.parent] : null;
    const angle = (angles[i] || 0) * Math.PI / 180;
    return { bone, angle, parent };
  }).reduce((posed, { bone, angle }, i) => {
    const p = bone.parent >= 0 ? posed[bone.parent] : null;
    const restP = bone.parent >= 0 ? bones[bone.parent] : null;
    const x = p ? p.x + Math.cos(p.angle) * (bone.x - restP.x) - Math.sin(p.angle) * (bone.y - restP.y) : bone.x;
    const y = p ? p.y + Math.sin(p.angle) * (bone.x - restP.x) + Math.cos(p.angle) * (bone.y - restP.y) : bone.y;
    posed.push({ x, y, angle: angle + (p?.angle || 0) });
    return posed;
  }, []);
}
function skinPoint(point, bones, posed, softness = 1) {
  if (!bones.length) {
    return { ...point };
  }
  let x = 0, y = 0, sum = 0;
  for (let i = 0; i < bones.length; i += 1) {
    const b = bones[i], p = posed[i], dx = point.x - b.x, dy = point.y - b.y;
    const weight = 1 / (dx * dx + dy * dy + 100) ** clamp(softness, 0.2, 4);
    x += (p.x + Math.cos(p.angle) * dx - Math.sin(p.angle) * dy) * weight;
    y += (p.y + Math.sin(p.angle) * dx + Math.cos(p.angle) * dy) * weight;
    sum += weight;
  }
  return { x: x / sum, y: y / sum };
}
function samplePose(keys, time, count) {
  const sorted = [...keys].sort((a2, b2) => a2.t - b2.t);
  if (!sorted.length) {
    return Array(count).fill(0);
  }
  const a = [...sorted].reverse().find((k) => k.t <= time) || sorted[0];
  const b = sorted.find((k) => k.t >= time) || sorted.at(-1);
  const f = a.t === b.t ? 0 : clamp((time - a.t) / (b.t - a.t), 0, 1);
  return Array.from({ length: count }, (_, i) => (a.angles[i] || 0) * (1 - f) + (b.angles[i] || 0) * f);
}
function voxelOBJ(voxels) {
  let result = "# GrayMansion voxels\n", index = 1;
  const occupied = new Set(voxels.map((v) => `${v.x},${v.y},${v.z}`));
  const faces = [
    [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]],
    [[-1, 0, 0], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]],
    [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]],
    [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
    [[0, 0, 1], [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]]],
    [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]]
  ];
  for (const v of voxels) {
    const rgb = v.color.slice(1).match(/../g).map((c) => (parseInt(c, 16) / 255).toFixed(4)).join(" ");
    for (const [normal, corners] of faces) {
      if (occupied.has(`${v.x + normal[0]},${v.y + normal[1]},${v.z + normal[2]}`)) {
        continue;
      }
      for (const p of corners) {
        result += `v ${p[0] + v.x} ${p[1] + v.y} ${p[2] + v.z} ${rgb}
`;
      }
      result += `f ${index} ${index + 1} ${index + 2} ${index + 3}
`;
      index += 4;
    }
  }
  return result;
}
function validateItems(items, max = 300) {
  if (!Array.isArray(items) || items.length > max) {
    throw new Error("Неверный размер проекта.");
  }
  return items;
}
export {
  clamp,
  gravityStep,
  posedBones,
  runsToPath,
  samplePose,
  skinPoint,
  spiroPoints,
  traceRuns,
  validateItems,
  voxelOBJ
};
