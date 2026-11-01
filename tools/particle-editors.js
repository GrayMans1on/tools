import { esc } from "./ui.js";
import { clamp, clone, sampleKeys, sampleGradient } from "./particle-engine.js?v=20261101-v08";
function parameterEditor(host, title, value, bounds, changed) {
  const [min, max] = bounds;
  let selected = 0;
  let active = 0;
  let dragging = false;
  host.className = "ps-parameter";
  function render() {
    const curveMode = ["curve", "curves"].includes(value.mode);
    const list = active ? value.keys2 : value.keys;
    host.innerHTML = `<div class="ps-param-title"><strong>${esc(title)}</strong><select data-mode aria-label="${esc(title)}: режим"><option value="constant">Constant</option><option value="range">Random Between Two Constants</option><option value="curve">Curve</option><option value="curves">Random Between Two Curves</option></select></div><div class="row" data-constant><label>Value<input type="number" data-number="value" min="${min}" max="${max}" step="any" value="${value.value}"></label></div><div class="row" data-range><label>Min<input type="number" data-number="min" min="${min}" max="${max}" step="any" value="${value.min}"></label><label>Max<input type="number" data-number="max" min="${min}" max="${max}" step="any" value="${value.max}"></label></div><div data-curves><div class="row"><label>Interpolation<select data-interpolation><option value="linear">Linear</option><option value="smooth">Smooth</option><option value="step">Step</option></select></label><label data-active-label>Кривая<select data-active><option value="0">A · нижняя / первая</option><option value="1">B · верхняя / вторая</option></select></label></div><canvas width="320" height="132" data-plot tabindex="0" aria-label="${esc(title)}: редактор кривой"></canvas><div class="row"><label>Ключ<select data-key>${list.map((p, i) => `<option value="${i}">${i + 1}: ${p.t.toFixed(2)} / ${p.v.toFixed(2)}</option>`).join("")}</select></label><label>Время 0–1<input data-t type="number" min="0" max="1" step="0.01" value="${list[selected].t}"></label><label>Значение<input data-v type="number" min="${min}" max="${max}" step="any" value="${list[selected].v}"></label></div><div class="actions"><button type="button" data-add>+ Ключ</button><button type="button" data-remove>Удалить ключ</button><button type="button" data-flat>Ровная</button><button type="button" data-ramp>0 → 1</button><button type="button" data-bell>Колокол</button></div></div>`;
    host.querySelector("[data-mode]").value = value.mode;
    host.querySelector("[data-constant]").hidden = value.mode !== "constant";
    host.querySelector("[data-range]").hidden = value.mode !== "range";
    host.querySelector("[data-curves]").hidden = !curveMode;
    host.querySelector("[data-active-label]").hidden = value.mode !== "curves";
    host.querySelector("[data-interpolation]").value = value.interpolation;
    host.querySelector("[data-active]").value = active;
    host.querySelector("[data-key]").value = selected;
    host.querySelector("[data-mode]").addEventListener("change", (e) => {
      value.mode = e.target.value;
      render();
      changed();
    });
    host.querySelectorAll("[data-number]").forEach((el) => el.addEventListener("input", () => {
      value[el.dataset.number] = Number(el.value);
      changed();
    }));
    host.querySelector("[data-interpolation]").addEventListener("change", (e) => {
      value.interpolation = e.target.value;
      plot();
      changed();
    });
    host.querySelector("[data-active]").addEventListener("change", (e) => {
      active = Number(e.target.value);
      selected = 0;
      render();
    });
    host.querySelector("[data-key]").addEventListener("change", (e) => {
      selected = Number(e.target.value);
      render();
    });
    const commitKey = () => {
      const t = Number(host.querySelector("[data-t]").value);
      const v = Number(host.querySelector("[data-v]").value);
      if (!Number.isFinite(t + v) || t < 0 || t > 1 || v < min || v > max || list.some((p, i) => i !== selected && Math.abs(p.t - t) < 1e-4)) {
        return;
      }
      const point = list[selected];
      point.t = t;
      point.v = v;
      list.sort((a, b) => a.t - b.t);
      selected = list.indexOf(point);
      render();
      changed();
    };
    host.querySelector("[data-t]").addEventListener("change", commitKey);
    host.querySelector("[data-v]").addEventListener("change", commitKey);
    host.querySelector("[data-add]").addEventListener("click", () => {
      if (list.length >= 16) {
        return;
      }
      let index = 1;
      for (let i = 2; i < list.length; i += 1) {
        if (list[i].t - list[i - 1].t > list[index].t - list[index - 1].t) {
          index = i;
        }
      }
      const t = (list[index].t + list[index - 1].t) / 2;
      list.splice(index, 0, { t, v: sampleKeys(list, t, value.interpolation) });
      selected = index;
      render();
      changed();
    });
    host.querySelector("[data-remove]").addEventListener("click", () => {
      if (list.length <= 2) {
        return;
      }
      list.splice(selected, 1);
      selected = Math.max(0, selected - 1);
      render();
      changed();
    });
    for (const [key, values] of [["flat", [1, 1]], ["ramp", [0, 1]], ["bell", [0, 1, 0]]]) {
      host.querySelector(`[data-${key}]`).addEventListener("click", () => {
        const next = values.map((v, i) => ({ t: i / (values.length - 1), v: clamp(v, min, max) }));
        if (active) {
          value.keys2 = next;
        } else {
          value.keys = next;
        }
        selected = 0;
        render();
        changed();
      });
    }
    const c = host.querySelector("[data-plot]");
    c.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const x = (e.clientX - rect.left) * 320 / rect.width;
      const y = (e.clientY - rect.top) * 132 / rect.height;
      const domain = range();
      let best = Infinity;
      list.forEach((p, i) => {
        const d = Math.hypot(18 + p.t * 284 - x, 112 - (p.v - domain[0]) / (domain[1] - domain[0]) * 94 - y);
        if (d < best) {
          best = d;
          selected = i;
        }
      });
      dragging = true;
      c.setPointerCapture(e.pointerId);
      plot();
    });
    c.addEventListener("pointermove", (e) => {
      if (!dragging) {
        return;
      }
      const rect = c.getBoundingClientRect();
      const x = (e.clientX - rect.left) * 320 / rect.width;
      const y = (e.clientY - rect.top) * 132 / rect.height;
      const domain = range();
      const low = selected ? list[selected - 1].t + 1e-3 : 0;
      const high = selected < list.length - 1 ? list[selected + 1].t - 1e-3 : 1;
      list[selected].t = Number(clamp((x - 18) / 284, low, high).toFixed(3));
      list[selected].v = Number(clamp(domain[0] + (112 - y) / 94 * (domain[1] - domain[0]), min, max).toFixed(3));
      host.querySelector("[data-t]").value = list[selected].t;
      host.querySelector("[data-v]").value = list[selected].v;
      plot();
    });
    const finish = () => {
      if (dragging) {
        dragging = false;
        render();
        changed();
      }
    };
    c.addEventListener("pointerup", finish);
    c.addEventListener("pointercancel", finish);
    plot();
  }
  function range() {
    const all = [...value.keys, ...value.mode === "curves" ? value.keys2 : []].map((p) => p.v);
    let a = Math.max(min, Math.min(0, ...all));
    let b = Math.min(max, Math.max(1, ...all));
    if (a === b) {
      b = a + 1;
    }
    return [a, b];
  }
  function plot() {
    const c = host.querySelector("[data-plot]");
    const ctx = c.getContext("2d");
    const [a, b] = range();
    ctx.fillStyle = "#f6f8fc";
    ctx.fillRect(0, 0, 320, 132);
    ctx.strokeStyle = "#dce3ef";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(18 + i * 71, 18);
      ctx.lineTo(18 + i * 71, 112);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(18, 18 + i * 23.5);
      ctx.lineTo(302, 18 + i * 23.5);
      ctx.stroke();
    }
    ctx.font = "9px monospace";
    ctx.fillStyle = "#7e8aa3";
    ctx.fillText(b.toFixed(1), 2, 12);
    ctx.fillText(a.toFixed(1), 2, 126);
    ctx.fillText("0", 18, 126);
    ctx.fillText("1", 298, 126);
    for (const [index, list] of [value.keys, value.keys2].entries()) {
      if (index && value.mode !== "curves") {
        continue;
      }
      ctx.strokeStyle = index ? "#9f79bb" : "#548b73";
      ctx.lineWidth = index === active ? 2.5 : 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 120; i += 1) {
        const y = 112 - (sampleKeys(list, i / 120, value.interpolation) - a) / (b - a) * 94;
        if (!i) {
          ctx.moveTo(18, y);
        } else {
          ctx.lineTo(18 + i / 120 * 284, y);
        }
      }
      ctx.stroke();
      list.forEach((p, i) => {
        ctx.fillStyle = i === selected && index === active ? "#35ac6c" : index ? "#bba1ce" : "#8dac9b";
        ctx.beginPath();
        ctx.arc(18 + p.t * 284, 112 - (p.v - a) / (b - a) * 94, i === selected && index === active ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
  render();
}
function gradientEditor(host, title, list, changed) {
  host.className = "ps-gradient";
  function render() {
    host.innerHTML = `<strong>${esc(title)}</strong><canvas width="320" height="24"></canvas><div class="ps-gradient-keys">${list.map((p, i) => `<div class="row"><label>t<input data-index="${i}" data-prop="t" type="number" min="0" max="1" step=".01" value="${p.t}"></label><label>Color<input data-index="${i}" data-prop="color" type="color" value="${p.color}"></label><label>Alpha<input data-index="${i}" data-prop="alpha" type="number" min="0" max="1" step=".05" value="${p.alpha}"></label><button data-remove="${i}" ${list.length <= 2 ? "disabled" : ""}>×</button></div>`).join("")}</div><button data-add>+ Цветовой ключ</button>`;
    const ctx = host.querySelector("canvas").getContext("2d");
    for (let x = 0; x < 320; x += 1) {
      const color = sampleGradient(list, x / 319);
      ctx.fillStyle = `rgba(${color.rgb.join(",")},${color.alpha})`;
      ctx.fillRect(x, 0, 1, 24);
    }
    host.querySelectorAll("[data-prop]").forEach((el) => el.addEventListener("change", () => {
      const i = Number(el.dataset.index);
      const key = el.dataset.prop;
      const next = key === "color" ? el.value : Number(el.value);
      if (key === "t" && (next < 0 || next > 1 || list.some((p, j) => j !== i && Math.abs(p.t - next) < 1e-4))) {
        render();
        return;
      }
      list[i][key] = next;
      list.sort((a, b) => a.t - b.t);
      render();
      changed();
    }));
    host.querySelectorAll("[data-remove]").forEach((el) => el.addEventListener("click", () => {
      if (list.length > 2) {
        list.splice(Number(el.dataset.remove), 1);
        render();
        changed();
      }
    }));
    host.querySelector("[data-add]").addEventListener("click", () => {
      if (list.length >= 16) {
        return;
      }
      let i = 1;
      for (let j = 2; j < list.length; j += 1) {
        if (list[j].t - list[j - 1].t > list[i].t - list[i - 1].t) {
          i = j;
        }
      }
      const t = (list[i].t + list[i - 1].t) / 2;
      const g = sampleGradient(list, t);
      const color = "#" + g.rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
      list.splice(i, 0, { t, color, alpha: g.alpha });
      render();
      changed();
    });
  }
  render();
}
export {
  gradientEditor,
  parameterEditor
};
