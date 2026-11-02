import {
  $,
  field,
  select,
  action,
  download,
  status,
  files,
  canvasPoint,
  num,
  readNumber,
  projectControls,
  bindProject,
  stage,
  animationControls,
  animate,
  bindImage,
  imageDataURL,
  localImage
} from "../studio-ui.js?v=20261102-v11";
import { clamp, posedBones, skinPoint, samplePose, validateItems } from "../studio-core.js?v=20261102-v11";
function imageCanvas() {
  const c = document.createElement("canvas");
  c.width = 960;
  c.height = 600;
  return c;
}
function fitImage(source, target) {
  const ctx = target.getContext("2d");
  ctx.clearRect(0, 0, 960, 600);
  const scale = Math.min(960 / source.width, 600 / source.height);
  ctx.drawImage(source, (960 - source.width * scale) / 2, (600 - source.height * scale) / 2, source.width * scale, source.
  height * scale);
}
function triangle(ctx, image, source, target) {
  const [a, b, c] = source, [p, q, r] = target, det = a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y);
  if (Math.abs(det) < 1e-6) {
    return;
  }
  const affine = (u, v, w) => [
    (u * (b.y - c.y) + v * (c.y - a.y) + w * (a.y - b.y)) / det,
    (u * (c.x - b.x) + v * (a.x - c.x) + w * (b.x - a.x)) / det,
    (u * (b.x * c.y - c.x * b.y) + v * (c.x * a.y - a.x * c.y) + w * (a.x * b.y - b.x * a.y)) / det
  ];
  const x = affine(p.x, q.x, r.x), y = affine(p.y, q.y, r.y);
  const center = { x: (p.x + q.x + r.x) / 3, y: (p.y + q.y + r.y) / 3 };
  const clip = [p, q, r].map((v) => {
    const dx = v.x - center.x, dy = v.y - center.y, d = Math.hypot(dx, dy) || 1;
    return { x: v.x + dx / d * 0.5, y: v.y + dy / d * 0.5 };
  });
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(clip[0].x, clip[0].y);
  ctx.lineTo(clip[1].x, clip[1].y);
  ctx.lineTo(clip[2].x, clip[2].y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(x[0], y[0], x[1], y[1], x[2], y[2]);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}
function mesh(ctx, image, transform, step = 30) {
  for (let y = 0; y < 600; y += step) {
    for (let x = 0; x < 960; x += step) {
      const a = { x, y }, b = { x: Math.min(x + step, 960), y }, c = { x: Math.min(x + step, 960), y: Math.min(
        y + step,
        600
      ) }, d = { x, y: Math.min(y + step, 600) };
      const p = [a, b, c, d].map(transform);
      triangle(ctx, image, [a, b, c], [p[0], p[1], p[2]]);
      triangle(ctx, image, [a, c, d], [p[0], p[2], p[3]]);
    }
  }
}
function sampleCharacter(c) {
  const ctx = c.getContext("2d");
  ctx.lineCap = "round";
  ctx.strokeStyle = "#7f94ba";
  ctx.lineWidth = 55;
  ctx.beginPath();
  ctx.moveTo(480, 225);
  ctx.lineTo(480, 350);
  ctx.moveTo(480, 250);
  ctx.lineTo(390, 300);
  ctx.lineTo(330, 240);
  ctx.moveTo(480, 250);
  ctx.lineTo(570, 300);
  ctx.lineTo(630, 240);
  ctx.moveTo(480, 350);
  ctx.lineTo(425, 455);
  ctx.lineTo(400, 530);
  ctx.moveTo(480, 350);
  ctx.lineTo(535, 455);
  ctx.lineTo(560, 530);
  ctx.stroke();
  ctx.fillStyle = "#adc5b3";
  ctx.beginPath();
  ctx.arc(480, 155, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#374255";
  ctx.beginPath();
  ctx.arc(460, 148, 5, 0, 7);
  ctx.arc(500, 148, 5, 0, 7);
  ctx.fill();
}
async function rig(root) {
  root.innerHTML = `<section class="panel">${files("image", "image/png,image/jpeg,image/webp", false)}<div class="row">${select(
    "editMode",
    "Редактирование",
    [
      ["pose", "Поза"],
      ["add", "Добавлять кости"],
      ["move", "Двигать опорные точки"]
    ]
  )}<label>Кость<select id="bone"></select></label>${num(
    "angle",
    "Угол выбранной кости, °",
    0,
    -180,
    180
  )}${num(
    "softness",
    "Локальность влияния",
    1.5,
    0.2,
    4,
    0.1
  )}${num("time", "Время ключа, с", 0, 0, 30, 0.1)}<label><input id="guides" type="checkbox" checked> Показыв\
ать скелет</label></div><div class="actions"><button id="key">Записать ключ в текущий момент</button><button id="deleteK\
ey">Удалить ключ в текущий момент</button><button id="demo">Демо-анимация</button><button id="clearBones">Новый скелет</\
button><button id="undoBone">Удалить последнюю кость</button></div><p class="muted">В режиме добавления клик создаёт сус\
тав, родитель — выбранная кость. В режиме позы задай угол и запиши ключ. Движение картинки — деформация сетки с автомати\
ческим влиянием ближайших суставов; отдельные части из фотографии не вырезаются. До 32 суставов и 120 ключей. PNG с проз\
рачностью подходит лучше всего.</p><p id="keys" class="muted"></p>${animationControls()}${projectControls()}\
</section><section class="panel">${stage()}</section>`;
  const c = $("stage"), ctx = c.getContext("2d"), image = imageCanvas();
  sampleCharacter(image);
  let bones = [{ x: 480, y: 350, parent: -1 }, { x: 480, y: 240, parent: 0 }, { x: 480, y: 155, parent: 1 }, {
    x: 390,
    y: 300,
    parent: 1
  }, { x: 330, y: 240, parent: 3 }, { x: 570, y: 300, parent: 1 }, { x: 630, y: 240, parent: 5 }, {
    x: 425,
    y: 455,
    parent: 0
  }, { x: 400, y: 530, parent: 7 }, { x: 535, y: 455, parent: 0 }, { x: 560, y: 530, parent: 9 }], angles = Array(
    11
  ).fill(0), keys = [], manual = true, exporting = false, moving = -1;
  function update() {
    const selected = $("bone").value;
    $("bone").replaceChildren(...bones.map((b, i) => new Option(`Сустав ${i + 1}${b.parent < 0 ? " · корень" :
    ` ← ${b.parent + 1}`}`, String(i))));
    if (bones.length) {
      $("bone").value = selected !== "" && Number(selected) < bones.length ? selected : "0";
    }
    $("angle").value = angles[Number($("bone").value)] || 0;
    $("keys").textContent = `Ключи: ${keys.length ? keys.map((k) => `${k.t.toFixed(1)} с`).join(" · ") : "нет"}`;
  }
  function draw(t = 0, still = false) {
    ctx.clearRect(0, 0, 960, 600);
    const values = manual && (!exporting || still) || !keys.length ? angles : samplePose(keys, t, bones.length), posed = posedBones(
    bones, values);
    mesh(ctx, image, (p) => skinPoint(p, bones, posed, clamp(Number($("softness").value), 0.2, 4)), 40);
    if ($("guides").checked && !exporting) {
      bones.forEach((b, i) => {
        const p = posed[i];
        ctx.strokeStyle = "#486474";
        ctx.lineWidth = 2;
        if (b.parent >= 0) {
          const a = posed[b.parent];
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
        ctx.fillStyle = i === Number($("bone").value) ? "#3cab71" : "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, 7);
        ctx.fill();
        ctx.stroke();
      });
    }
  }
  function demo() {
    keys = [{ t: 0, angles: Array(bones.length).fill(0) }, { t: Number($("duration").value) / 2, angles: bones.map((b, i) => i %
    2 ? 22 : -15) }, { t: Number($("duration").value), angles: Array(bones.length).fill(0) }];
    manual = false;
    update();
    draw(0);
  }
  bindImage("image", (bitmap) => {
    fitImage(bitmap, image);
    draw();
  });
  $("bone").onchange = () => {
    $("angle").value = angles[Number($("bone").value)] || 0;
    draw();
  };
  $("angle").oninput = () => {
    if (!bones.length) {
      return;
    }
    angles[Number($("bone").value)] = clamp(Number($("angle").value) || 0, -180, 180);
    manual = true;
    draw();
  };
  $("softness").oninput = $("guides").onchange = () => draw();
  $("time").oninput = () => {
    const t = clamp(Number($("time").value) || 0, 0, 30);
    angles = samplePose(keys, t, bones.length);
    $("angle").value = angles[Number($("bone").value)] || 0;
    manual = false;
    draw(t);
  };
  c.onpointerdown = (e) => {
    if (exporting) {
      return;
    }
    const p = canvasPoint(c, e), mode = $("editMode").value;
    if (mode === "add") {
      if (bones.length >= 32) {
        status("До 32 суставов.", true);
        return;
      }
      bones.push({ x: p.x, y: p.y, parent: bones.length ? Number($("bone").value) : -1 });
      angles.push(0);
      $("bone").value = String(bones.length - 1);
      update();
      $("bone").value = String(bones.length - 1);
      manual = true;
      draw();
    } else if (mode === "move") {
      moving = bones.findLastIndex((b) => Math.hypot(b.x - p.x, b.y - p.y) < 20);
      c.setPointerCapture(e.pointerId);
    } else {
      const posed = posedBones(bones, angles), i = posed.findLastIndex((b) => Math.hypot(b.x - p.x, b.y - p.y) < 20);
      if (i >= 0) {
        $("bone").value = String(i);
        $("angle").value = angles[i] || 0;
        draw();
      }
    }
  };
  c.onpointermove = (e) => {
    if (moving >= 0) {
      const p = canvasPoint(c, e);
      bones[moving].x = clamp(p.x, 0, 960);
      bones[moving].y = clamp(p.y, 0, 600);
      manual = true;
      draw();
    }
  };
  c.onpointerup = c.onpointercancel = () => {
    moving = -1;
  };
  action("key", () => {
    const t = readNumber("time", 0, 30);
    keys = keys.filter((k) => Math.abs(k.t - t) > 1e-3);
    if (keys.length >= 120) {
      throw Error("До 120 ключей.");
    }
    keys.push({ t, angles: [...angles] });
    keys.sort((a, b) => a.t - b.t);
    update();
  });
  action("deleteKey", () => {
    keys = keys.filter((k) => Math.abs(k.t - Number($("time").value)) > 1e-3);
    update();
  });
  action("clearBones", () => {
    bones = [];
    angles = [];
    keys = [];
    update();
    draw();
  });
  action("undoBone", () => {
    bones.pop();
    angles.pop();
    keys = [];
    update();
    draw();
  });
  action("demo", demo);
  $("play").addEventListener("click", () => {
    manual = false;
  });
  bindProject("GM Rig", () => ({ image: image.toDataURL(), bones, angles, keys, manual, duration: Number($("duration").value),
  softness: Number(
    $("softness").value
  ) }), async (p) => {
    validateItems(p.bones, 32);
    validateItems(p.keys, 120);
    p.bones.forEach((b, i) => {
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || b.x < 0 || b.x > 960 || b.y < 0 || b.y > 600 || !Number.isInteger(
        b.parent
      ) || b.parent < -1 || b.parent >= i) {
        throw Error("Повреждённый скелет.");
      }
    });
    for (const k of p.keys) {
      if (!Number.isFinite(k.t) || k.t < 0 || k.t > 30 || !Array.isArray(k.angles) || k.angles.length !== p.bones.length ||
      !k.angles.every((a) => Number.isFinite(a) && Math.abs(a) <= 180)) {
        throw Error("Повреждённые ключи.");
      }
    }
    if (!Array.isArray(p.angles) || p.angles.length !== p.bones.length || !p.angles.every((a) => Number.isFinite(a) && Math.
    abs(a) <= 180)) {
      throw Error("Повреждённая поза.");
    }
    const img = await localImage(p.image);
    fitImage(img, image);
    bones = p.bones;
    angles = p.angles;
    keys = p.keys;
    $("duration").value = clamp(Number(p.duration) || 4, 0.2, 30);
    $("softness").value = clamp(Number(p.softness) || 1.5, 0.2, 4);
    manual = p.manual === true;
    update();
    draw();
  });
  update();
  demo();
  animate(c, draw, () => ({}), (_, active) => {
    exporting = active;
  });
}
async function livephoto(root) {
  root.innerHTML = `<section class="panel">${files("image", "image/png,image/jpeg,image/webp", false)}<div class="row">${select(
    "preset",
    "Движение",
    [
      "Волны",
      "Дым вверх",
      "Дыхание",
      "Облака",
      "Покачивание"
    ]
  )}<button id="apply">Загрузить</button>${select(
    "brush",
    "Маска",
    ["Движение", "Стереть"]
  )}${num(
    "brushSize",
    "Размер кисти",
    65,
    5,
    200
  )}${num(
    "strength",
    "Амплитуда, px",
    14,
    0,
    70
  )}${num("direction", "Направление, °", 0, -180, 180)}${num(
    "waves",
    "Частота волн",
    3,
    0.2,
    12,
    0.1
  )}<label><input id="showMask" type="checkbox" checked> Показать маску</label></div><div class="actions"><button id="al\
l">Движение везде</button><button id="clear">Очистить маску</button><button id="undo">Отменить маску</button></div><p cl\
ass="muted">Закрась области, которые должны двигаться. Остальные остаются неподвижными. Это зацикленная деформация одног\
о изображения по маске, а не восстановление реального движения: скрытые за объектами детали не генерируются. Маска и исх\
одник сохраняются в проект.</p>${animationControls()}${projectControls()}</section><section class\
="panel">${stage()}</section>`;
  const c = $("stage"), ctx = c.getContext("2d"), image = imageCanvas(), mask = imageCanvas(), mx = mask.getContext("2d");
  const ix = image.getContext("2d"), gradient = ix.createLinearGradient(0, 0, 0, 600);
  gradient.addColorStop(0, "#d8e4f1");
  gradient.addColorStop(0.5, "#c4d4e8");
  gradient.addColorStop(1, "#91acc5");
  ix.fillStyle = gradient;
  ix.fillRect(0, 0, 960, 600);
  ix.fillStyle = "#f3f6fa";
  for (let i = 0; i < 7; i += 1) {
    ix.beginPath();
    ix.ellipse(80 + i * 140, 180 + i % 2 * 70, 160, 40, 0, 0, 7);
    ix.fill();
  }
  let maskPixels = new Uint8ClampedArray(960 * 600 * 4), drawing = false, lastPoint = null, previous = null, exporting = false,
  currentTime = 0;
  const refresh = () => {
    maskPixels = mx.getImageData(0, 0, 960, 600).data;
  };
  function draw(t = 0) {
    currentTime = t;
    ctx.clearRect(0, 0, 960, 600);
    const strength = clamp(Number($("strength").value) || 0, 0, 70), angle = (Number($("direction").value) || 0) * Math.
    PI / 180, waves = clamp(Number($("waves").value) || 3, 0.2, 12), phase = t / Math.max(0.2, Number($("duration").value)) *
    Math.PI * 2;
    mesh(ctx, image, (p) => {
      const x = clamp(Math.round(p.x), 0, 959), y = clamp(Math.round(p.y), 0, 599), weight = maskPixels[(y * 960 + x) * 4 +
      3] / 255, offset = Math.sin(phase + p.x / 960 * waves * Math.PI * 2) * strength * weight;
      return { x: p.x + Math.cos(angle) * offset, y: p.y + Math.sin(angle) * offset };
    }, 30);
    if ($("showMask").checked && !exporting) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.drawImage(mask, 0, 0);
      ctx.restore();
    }
  }
  function paint(p) {
    mx.globalCompositeOperation = $("brush").value === "Стереть" ? "destination-out" : "source-over";
    mx.strokeStyle = "#3bb879";
    mx.fillStyle = "#3bb879";
    mx.lineCap = "round";
    mx.lineJoin = "round";
    mx.lineWidth = clamp(Number($("brushSize").value) || 65, 5, 200);
    if (lastPoint) {
      mx.beginPath();
      mx.moveTo(lastPoint.x, lastPoint.y);
      mx.lineTo(p.x, p.y);
      mx.stroke();
    } else {
      mx.beginPath();
      mx.arc(p.x, p.y, mx.lineWidth / 2, 0, 7);
      mx.fill();
    }
    lastPoint = p;
    refresh();
    draw(currentTime);
  }
  c.onpointerdown = (e) => {
    if (exporting) {
      return;
    }
    previous = mx.getImageData(0, 0, 960, 600);
    drawing = true;
    lastPoint = null;
    c.setPointerCapture(e.pointerId);
    paint(canvasPoint(c, e));
  };
  c.onpointermove = (e) => {
    if (drawing) {
      paint(canvasPoint(c, e));
    }
  };
  c.onpointerup = c.onpointercancel = () => {
    drawing = false;
    lastPoint = null;
  };
  action("all", () => {
    previous = mx.getImageData(0, 0, 960, 600);
    mx.globalCompositeOperation = "source-over";
    mx.fillStyle = "#3bb879";
    mx.fillRect(0, 0, 960, 600);
    refresh();
    draw();
  });
  action("clear", () => {
    previous = mx.getImageData(0, 0, 960, 600);
    mx.clearRect(0, 0, 960, 600);
    refresh();
    draw();
  });
  action("undo", () => {
    if (previous) {
      const next = mx.getImageData(0, 0, 960, 600);
      mx.putImageData(previous, 0, 0);
      previous = next;
      refresh();
      draw();
    }
  });
  function preset() {
    const p = [[14, 90, 4], [20, -90, 2], [7, 0, 0.2], [10, 0, 1], [18, 0, 3]][$("preset").selectedIndex];
    ["strength", "direction", "waves"].forEach((id, i) => {
      $(id).value = p[i];
    });
    draw();
  }
  action("apply", preset);
  for (const id of ["strength", "direction", "waves", "showMask"]) {
    $(id).addEventListener("input", () => draw(currentTime));
  }
  bindImage("image", (bitmap) => {
    fitImage(bitmap, image);
    mx.clearRect(0, 0, 960, 600);
    refresh();
    draw();
    status("Закрась движущуюся область.");
  });
  bindProject(
    "GM Live Photo",
    () => ({ image: image.toDataURL(), mask: mask.toDataURL(), strength: Number($("strength").value), direction: Number(
    $("direction").value), waves: Number($("waves").value), duration: Number($("duration").value) }),
    async (p) => {
      const img = await localImage(p.image), m = await localImage(p.mask);
      fitImage(img, image);
      fitImage(m, mask);
      for (const [id, min, max] of [["strength", 0, 70], ["direction", -180, 180], ["waves", 0.2, 12], ["duration", 0.2,
      30]]) {
        if (!Number.isFinite(p[id]) || p[id] < min || p[id] > max) {
          throw Error("Параметры проекта.");
        }
        $(id).value = p[id];
      }
      refresh();
      draw();
    }
  );
  mx.fillStyle = "#3bb879";
  mx.fillRect(0, 90, 960, 240);
  refresh();
  preset();
  animate(c, draw, () => ({}), (_, active) => {
    exporting = active;
  });
}
export {
  livephoto,
  rig
};
