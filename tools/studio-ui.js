import { $, field, select, action, download, status, toBlob, files, teardown } from "./ui.js";
import { canvasPoint, num, readNumber, projectControls, bindProject } from "./lab-ui.js?v=20261101-v09";
import { exportEffect } from "./effect-export.js";
const saveText = (text, name, type = "text/plain") => download(new Blob([text], { type }), name);
const stage = (id = "stage") => `<canvas id="${id}" width="960" height="600" class="lab-canvas" tabindex="0" aria-label=\
"Рабочая область"></canvas>`;
const animationControls = () => `<div class="row">${num(
  "duration",
  "Длительность, с",
  4,
  0.2,
  30,
  0.1
)}${num("fps", "FPS", 24, 5, 60)}${select("exportFormat", "Экспорт", [
  ["gif", "GIF"],
  ["sequence", "PNG sequence · ZIP"],
  ["mp4", "MP4 без звука"]
])}</div><div class="actions"><button id="play">Воспроизведение / пауза</button><button id="png">PNG</button><button id=\
"exportAnim" class="primary">Экспорт анимации</button><button id="cancelExport">Отмена экспорта</button></div>`;
function animate(c, draw, getState = () => ({}), setState = () => {
}) {
  let playing = false, time = 0, last = null, frame, dead = false, busy = false, cancelled = false;
  action("play", () => {
    playing = !playing;
    last = null;
  });
  action("png", async () => {
    const saved = structuredClone(getState());
    try {
      setState(saved, true);
      draw(time, true);
      download(await toBlob(c), "studio-frame.png");
    } finally {
      setState(saved, false);
      draw(time);
    }
  });
  action("cancelExport", () => {
    cancelled = true;
  });
  action("exportAnim", async () => {
    if (busy) {
      return;
    }
    busy = true;
    cancelled = false;
    playing = false;
    const saved = structuredClone(getState());
    const controls = [...document.querySelectorAll("#content input,#content select,#content button")];
    const disabled = controls.map((e) => e.disabled);
    for (const e of controls) {
      e.disabled = e.id !== "cancelExport";
    }
    try {
      setState(saved, true);
      await exportEffect({
        format: $("exportFormat").value,
        settings: {
          width: c.width,
          height: c.height,
          fps: readNumber("fps", 5, 60),
          duration: readNumber("duration", 0.2, 30)
        },
        canvas: c,
        draw: (t) => draw(t),
        cancelled: () => cancelled
      });
    } finally {
      setState(saved, false);
      busy = false;
      controls.forEach((e, i) => {
        e.disabled = disabled[i];
      });
      draw(time);
    }
  });
  function tick(t) {
    if (dead) {
      return;
    }
    if (!busy && playing) {
      time = (time + (last == null ? 0 : Math.min(0.1, (t - last) / 1e3))) % Math.max(0.2, Number($("duration").value));
      draw(time);
    }
    last = t;
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  teardown(() => {
    dead = true;
    cancelled = true;
    cancelAnimationFrame(frame);
  });
  return { redraw: () => draw(time), reset: () => {
    time = 0;
    draw(0);
  } };
}
function bindImage(id, callback) {
  $(id).addEventListener("change", async () => {
    try {
      const file = $(id).files[0];
      if (!file) {
        return;
      }
      if (file.size > 25e6) {
        throw new Error("Изображение — до 25 МБ.");
      }
      const { readImage } = await import("./ui.js");
      const bitmap = await readImage(file);
      try {
        await callback(bitmap);
      } finally {
        bitmap.close();
      }
    } catch (e) {
      status(e.message, true);
    }
  });
}
function imageDataURL(bitmap, max = 960) {
  const scale = Math.min(1, max / bitmap.width, max / bitmap.height);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bitmap.width * scale));
  c.height = Math.max(1, Math.round(bitmap.height * scale));
  c.getContext("2d").drawImage(bitmap, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}
async function localImage(url) {
  if (typeof url !== "string" || !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(url) || url.length > 28e6) {
    throw new Error("Проект может содержать только встроенные PNG/JPEG/WebP.");
  }
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}
export {
  $,
  action,
  animate,
  animationControls,
  bindImage,
  bindProject,
  canvasPoint,
  download,
  field,
  files,
  imageDataURL,
  localImage,
  num,
  projectControls,
  readNumber,
  saveText,
  select,
  stage,
  status,
  teardown,
  toBlob
};
