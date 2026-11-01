const add = (a, b) => a.map((v, i) => v + b[i]), sub = (a, b) => a.map((v, i) => v - b[i]), mul = (a, k) => a.map((v) => v * k), dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / (Math.hypot(...a) || 1));
const center = (points) => mul(points.reduce((a, b) => add(a, b), points[0].map(() => 0)), 1 / points.length);
function paperMesh(kind, size, depth = 1) {
  let vertices, faces;
  if (["cube", "box"].includes(kind)) {
    const x = size / 2, y = size / 2, z = size * depth / 2;
    vertices = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
    faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]];
  } else if (kind === "tetra") {
    const a = size / (2 * Math.sqrt(2));
    vertices = [[a, a, a], [-a, -a, a], [-a, a, -a], [a, -a, -a]];
    faces = [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]];
  } else if (kind === "octa") {
    const a = size / Math.sqrt(2);
    vertices = [[a, 0, 0], [-a, 0, 0], [0, a, 0], [0, -a, 0], [0, 0, a], [0, 0, -a]];
    faces = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];
  } else if (kind === "pyramid") {
    const a = size / 2;
    vertices = [[-a, -a, 0], [a, -a, 0], [a, a, 0], [-a, a, 0], [0, 0, size * depth]];
    faces = [[0, 3, 2, 1], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]];
  } else {
    const count = kind === "triPrism" ? 3 : kind === "hexPrism" ? 6 : kind === "cylinder" ? 12 : 5;
    const radius = size / (2 * Math.sin(Math.PI / count));
    vertices = [];
    for (let z = 0; z < 2; z += 1) {
      for (let i = 0; i < count; i += 1) {
        vertices.push([Math.cos(i * Math.PI * 2 / count) * radius, Math.sin(i * Math.PI * 2 / count) * radius, (z - 0.5) * size * depth]);
      }
    }
    faces = [Array.from({ length: count }, (_, i) => count - 1 - i), Array.from({ length: count }, (_, i) => i + count)];
    for (let i = 0; i < count; i += 1) {
      const j = (i + 1) % count;
      faces.push([i, j, j + count, i + count]);
    }
  }
  const centroid = center(vertices);
  faces = faces.map((face) => {
    const points = face.map((i) => vertices[i]), normal = cross(sub(points[1], points[0]), sub(points[2], points[0]));
    return dot(normal, sub(center(points), centroid)) < 0 ? [...face].reverse() : face;
  });
  return { vertices, faces };
}
const edgeKey = (a, b) => [a, b].sort((x, y) => x - y).join(":");
function overlaps(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i += 1) {
      const p = poly[i], q = poly[(i + 1) % poly.length], axis = [-(q[1] - p[1]), q[0] - p[0]], pa = a.map((v) => dot(v, axis)), pb = b.map((v) => dot(v, axis));
      if (Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) < 1e-5) {
        return false;
      }
    }
  }
  return true;
}
function unfold(mesh) {
  const { vertices: v, faces } = mesh;
  const normal = (face) => norm(cross(sub(v[face[1]], v[face[0]]), sub(v[face[2]], v[face[0]])));
  const first = faces[0], origin = v[first[0]], u = norm(sub(v[first[1]], origin)), w = norm(cross(normal(first), u));
  const placed = /* @__PURE__ */ new Map([[0, first.map((id) => [dot(sub(v[id], origin), u), dot(sub(v[id], origin), w)])]]);
  const folds = /* @__PURE__ */ new Set();
  let calls = 0;
  function search() {
    if (placed.size === faces.length) {
      return true;
    }
    if (++calls > 2e4) {
      return false;
    }
    const candidates = [];
    for (const [parent, poly] of placed) {
      const face = faces[parent];
      for (let e = 0; e < face.length; e += 1) {
        const a = face[e], b = face[(e + 1) % face.length];
        for (let child = 0; child < faces.length; child += 1) {
          if (placed.has(child) || !faces[child].includes(a) || !faces[child].includes(b)) {
            continue;
          }
          const pa = poly[e], pb = poly[(e + 1) % face.length], axis = norm(sub(v[b], v[a])), vertical = norm(cross(normal(faces[child]), axis)), edge = norm(sub(pb, pa)), perp = [-edge[1], edge[0]];
          const raw = faces[child].map((id) => [dot(sub(v[id], v[a]), axis), dot(sub(v[id], v[a]), vertical)]);
          const parentSide = dot(sub(center(poly), pa), perp), childSide = center(raw)[1], sign = -Math.sign(parentSide * childSide) || 1;
          const next = raw.map((p) => add(pa, add(mul(edge, p[0]), mul(perp, p[1] * sign))));
          if ([...placed.values()].some((p) => overlaps(p, next))) {
            continue;
          }
          candidates.push({ child, next, key: edgeKey(a, b) });
        }
      }
    }
    for (const candidate of candidates) {
      placed.set(candidate.child, candidate.next);
      folds.add(candidate.key);
      if (search()) {
        return true;
      }
      placed.delete(candidate.child);
      folds.delete(candidate.key);
    }
    return false;
  }
  if (!search()) {
    throw new Error("Не удалось построить развёртку без пересечений. Измени соотношение размеров.");
  }
  return { polygons: faces.map((_, i) => placed.get(i)), folds: [...folds] };
}
function paperNet(mesh, tabSize = 4) {
  const net = unfold(mesh), seen = /* @__PURE__ */ new Map(), edges = [];
  mesh.faces.forEach((face, fi) => face.forEach((id, i) => {
    const next = face[(i + 1) % face.length], key = edgeKey(id, next);
    const entry = { key, face: fi, a: net.polygons[fi][i], b: net.polygons[fi][(i + 1) % face.length] };
    edges.push(entry);
    if (!seen.has(key)) {
      seen.set(key, []);
    }
    seen.get(key).push(entry);
  }));
  const tabs = [];
  let omitted = 0;
  let label = 0;
  const labels = [];
  for (const [key, pair] of seen) {
    if (net.folds.includes(key)) {
      continue;
    }
    label += 1;
    pair.forEach((edge2) => labels.push({ ...edge2, label }));
    const edge = pair[0], d = norm(sub(edge.b, edge.a)), mid = mul(add(edge.a, edge.b), 0.5), centroid = center(net.polygons[edge.face]);
    let n = [-d[1], d[0]];
    if (dot(sub(centroid, mid), n) > 0) {
      n = mul(n, -1);
    }
    const len = Math.hypot(...sub(edge.b, edge.a));
    let accepted = false;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const h = Math.min(tabSize, len * 0.25) / 2 ** attempt, inset = Math.min(h * 0.6, len * 0.15);
      const tab = [edge.a, add(add(edge.a, mul(d, inset)), mul(n, h)), add(add(edge.b, mul(d, -inset)), mul(n, h)), edge.b];
      if (!net.polygons.some((p, i) => i !== edge.face && overlaps(tab, p)) && !tabs.some((p) => overlaps(tab, p.points))) {
        tabs.push({ ...edge, points: tab, label });
        accepted = true;
        break;
      }
    }
    if (!accepted) {
      omitted += 1;
    }
  }
  const points = [...net.polygons.flat(), ...tabs.flatMap((t) => t.points)], min = [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1]))], max = [Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))];
  return { ...net, edges, tabs, labels, omitted, min, max, width: max[0] - min[0] + 12, height: max[1] - min[1] + 12 };
}
function netSVG(mesh, net, color = "#dbe4ee", numbers = true) {
  const move = (p) => [p[0] - net.min[0] + 6, p[1] - net.min[1] + 6];
  const points = (p) => p.map((v) => move(v).join(",")).join(" ");
  let body = "";
  net.polygons.forEach((poly, i) => {
    body += `<polygon points="${points(poly)}" fill="${color}" fill-opacity=".45"/>`;
    if (numbers) {
      const c = move(center(poly));
      body += `<text x="${c[0]}" y="${c[1]}" text-anchor="middle" font-size="3.5" fill="#43516a">${i + 1}</text>`;
    }
  });
  const fold = new Set(net.folds), tabs = new Map(net.tabs.map((t) => [t.key, t]));
  const done = /* @__PURE__ */ new Set();
  for (const e of net.edges) {
    if (fold.has(e.key)) {
      if (done.has(e.key)) {
        continue;
      }
      done.add(e.key);
      body += `<polyline points="${points([e.a, e.b])}" fill="none" stroke="#6c879d" stroke-width=".22" stroke-dasharray="1.5 1"/>`;
    } else if (tabs.get(e.key)?.face === e.face) {
      const t = tabs.get(e.key);
      body += `<polyline points="${points(t.points)}" fill="white" stroke="#303d52" stroke-width=".25"/><polyline points="${points([e.a, e.b])}" fill="none" stroke="#6c879d" stroke-width=".22" stroke-dasharray="1.5 1"/>`;
    } else {
      body += `<polyline points="${points([e.a, e.b])}" fill="none" stroke="#303d52" stroke-width=".25"/>`;
    }
  }
  if (numbers) {
    for (const e of net.labels) {
      const c = move(mul(add(e.a, e.b), 0.5));
      body += `<text x="${c[0]}" y="${c[1]}" font-size="2" fill="#8d6c5e">${e.label}</text>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${net.width}mm" height="${net.height}mm" viewBox="0 0 ${net.width} ${net.height}"><rect width="100%" height="100%" fill="white"/><g font-family="Arial,sans-serif">${body}</g></svg>`;
}
function projectMesh(mesh, rx, ry, zoom = 1) {
  const points = mesh.vertices.map(([x, y, z]) => {
    const a = x * Math.cos(ry) + z * Math.sin(ry), b = -x * Math.sin(ry) + z * Math.cos(ry);
    return [a, y * Math.cos(rx) - b * Math.sin(rx), y * Math.sin(rx) + b * Math.cos(rx)];
  });
  const radius = Math.max(...mesh.vertices.map((v) => Math.hypot(...v))) || 1;
  return mesh.faces.map((face, index) => {
    const vs = face.map((i) => points[i]), n = cross(sub(vs[1], vs[0]), sub(vs[2], vs[0]));
    return { index, depth: center(vs)[2], visible: n[2] > 0, points: vs.map((p) => {
      const perspective = 3.5 * radius / (3.5 * radius - p[2]);
      return [p[0] / radius * perspective * zoom, p[1] / radius * perspective * zoom];
    }) };
  }).filter((f) => f.visible).sort((a, b) => a.depth - b.depth);
}
export {
  netSVG,
  paperMesh,
  paperNet,
  projectMesh,
  unfold
};
