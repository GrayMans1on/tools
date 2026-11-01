import { $, field, select, action, download, toBlob, files, status } from "./ui.js";
const num = (id, label, value, min, max, step = 1) => field(id, label, "number", value, `min="${min}" max="${max}" step="${step}"`);
function readNumber(id, min, max) {
  const n = Number($(id).value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`${$(id).closest("label")?.textContent.trim()}: ${min}…${max}.`);
  }
  return n;
}
const projectControls = () => `<div class="actions"><button id="saveProject">Скачать проект</button></div>${files("project", ".json", false)}`;
function bindProject(format, get, load) {
  action("saveProject", () => download(new Blob([JSON.stringify({ format, version: 1, ...get() }, null, 2)], { type: "application/json" }), `${format.toLowerCase().replaceAll(" ", "-")}-project.json`));
  $("project").addEventListener("change", async () => {
    try {
      const file = $("project").files[0];
      if (!file) {
        return;
      }
      if (file.size > 3e7) {
        throw new Error("Проект — до 30 МБ.");
      }
      const data = JSON.parse(await file.text());
      if (data.format !== format || data.version !== 1) {
        throw new Error("Неверный тип проекта.");
      }
      await load(data);
      status("Проект открыт.");
    } catch (e) {
      status(e.message, true);
    }
  });
}
function canvasPoint(canvas, event) {
  const r = canvas.getBoundingClientRect();
  return { x: (event.clientX - r.left) * canvas.width / r.width, y: (event.clientY - r.top) * canvas.height / r.height };
}
function bindPNG(id, canvas, name) {
  action(id, async () => download(await toBlob(canvas), name));
}
function safe(fn) {
  try {
    return fn();
  } catch (e) {
    status(e.message, true);
    return null;
  }
}
export {
  bindPNG,
  bindProject,
  canvasPoint,
  num,
  projectControls,
  readNumber,
  safe
};
