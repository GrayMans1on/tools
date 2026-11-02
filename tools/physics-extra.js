const extraPhysicsPresets = [
  ["fluid", "Жидкость · частицы"],
  ["dam", "Прорыв плотины"],
  ["cloth", "Ткань на креплениях"],
  ["soft", "Мягкие тела"],
  ["reaction", "Цепная реакция · домино и башня"],
  ["stairs", "Цепная реакция · каскад"],
  ["launcher", "Цепная реакция · рычаг"],
  ["swing", "Цепная реакция · маятник"]
];
function buildPhysicsExtra(kind, { M, add, connect, stiffness = 0.1 }) {
  const joint = (a, b, length) => connect(a, b, { x: 0, y: 0 }, { x: 0, y: 0 }, stiffness, length);
  if (["fluid", "dam"].includes(kind)) {
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        const b = add(
          "circle",
          110 + x * 10,
          kind === "dam" ? 480 + y * 10 : 120 + y * 10,
          8,
          { restitution: 0, friction: 0, frictionAir: 0.01, render: { fillStyle: "#79b1ce" } }
        );
        b.plugin.fluid = true;
      }
    }
    if (kind === "dam") {
      const wall = add("wall", 285, 530, 45, { isStatic: true });
      M.Body.setAngle(wall, Math.PI / 2);
    } else {
      const wall = add("wall", 510, 360, 180, { isStatic: true });
      M.Body.setAngle(wall, 0.2);
    }
    return true;
  }
  if (["cloth", "soft"].includes(kind)) {
    const nx = kind === "cloth" ? 12 : 6, ny = kind === "cloth" ? 8 : 6, spacing = kind === "cloth" ? 28 : 24;
    const grid = [];
    for (let y = 0; y < ny; y += 1) {
      grid[y] = [];
      for (let x = 0; x < nx; x += 1) {
        const b = add(
          "circle",
          310 + x * spacing,
          100 + y * spacing,
          kind === "cloth" ? 8 : 15,
          { collisionFilter: { group: -1 }, restitution: 0.1, frictionAir: 0.02, render: { fillStyle: kind === "cloth" ?
          "#aba1ca" : "#91b7a4" } }
        );
        grid[y][x] = b;
        if (x) {
          joint(grid[y][x - 1], b, spacing);
        }
        if (y) {
          joint(grid[y - 1][x], b, spacing);
        }
        if (x && y) {
          joint(grid[y - 1][x - 1], b, spacing * Math.SQRT2);
          if (kind === "soft") {
            joint(grid[y - 1][x], grid[y][x - 1], spacing * Math.SQRT2);
          }
        }
        if (kind === "cloth" && y === 0 && (x % 2 === 0 || x === nx - 1)) {
          connect(null, b, { x: b.position.x, y: b.position.y }, { x: 0, y: 0 }, 1, 0);
        }
      }
    }
    add("circle", 530, 470, 100, { isStatic: true, render: { fillStyle: "#a7b9ca" } });
    return true;
  }
  const domino = (start, count, y = 550) => {
    for (let i = 0; i < count; i += 1) {
      const b = add("bar", start + i * 35, y, 28, { restitution: 0.1 });
      M.Body.setAngle(b, Math.PI / 2 + (i === 0 ? 0.18 : 0));
    }
  };
  if (kind === "reaction") {
    domino(130, 15);
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        add("rect", 720 + x * 30, 580 - y * 30, 28, { restitution: 0.1 });
      }
    }
    const b = add("circle", 75, 460, 42);
    M.Body.setVelocity(b, { x: 4, y: 0 });
    return true;
  }
  if (kind === "stairs") {
    for (let i = 0; i < 4; i += 1) {
      const wall = add("wall", i % 2 ? 580 : 380, 150 + i * 120, 145, { isStatic: true });
      M.Body.setAngle(wall, i % 2 ? -0.23 : 0.23);
    }
    for (let i = 0; i < 12; i += 1) {
      add("circle", 200 + i % 4 * 25, 30 + Math.floor(i / 4) * 24, 20, { restitution: 0.4 });
    }
    return true;
  }
  if (kind === "launcher") {
    const lever = add("bar", 380, 460, 105);
    connect(null, lever, { x: 380, y: 460 }, { x: 0, y: 0 }, 1, 0);
    add("rect", 260, 180, 85);
    add("circle", 505, 415, 32);
    domino(590, 8);
    return true;
  }
  if (kind === "swing") {
    const ball = add("circle", 130, 320, 55, { restitution: 0.7 });
    connect(null, ball, { x: 300, y: 130 }, { x: 0, y: 0 }, 1, 255);
    domino(310, 15, 545);
    return true;
  }
  return false;
}
function fluidForces(M, particles, viscosity = 0.15, cohesion = 0.4) {
  for (let i = 0; i < particles.length; i += 1) {
    const a = particles[i];
    for (let j = i + 1; j < particles.length; j += 1) {
      const b = particles[j], dx = b.position.x - a.position.x, dy = b.position.y - a.position.y, d = Math.hypot(dx, dy);
      if (d < 1e-3 || d > 24) {
        continue;
      }
      const q = 1 - d / 24, force = (d < 9 ? -4e-5 * (9 - d) : cohesion * 2e-6 * q) * Math.min(a.mass, b.mass);
      const fx = dx / d * force, fy = dy / d * force;
      M.Body.applyForce(a, a.position, { x: fx, y: fy });
      M.Body.applyForce(b, b.position, { x: -fx, y: -fy });
      if (!a.isStatic && !b.isStatic) {
        const vx = (b.velocity.x - a.velocity.x) * viscosity * q * 0.08, vy = (b.velocity.y - a.velocity.y) * viscosity *
        q * 0.08;
        M.Body.setVelocity(a, { x: a.velocity.x + vx, y: a.velocity.y + vy });
        M.Body.setVelocity(b, { x: b.velocity.x - vx, y: b.velocity.y - vy });
      }
    }
  }
}
export {
  buildPhysicsExtra,
  extraPhysicsPresets,
  fluidForces
};
