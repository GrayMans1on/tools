import { $, select, action, download, status, files, teardown, canvasPoint, num, readNumber, stage, saveText } from "../studio-ui.js?v=20261102-v11";
import { wav } from "../audio-core.js?v=20261031-v06";
import { clamp } from "../studio-core.js?v=20261102-v11";
async function spatial(root) {
  root.innerHTML = `<section class="panel">${files("audioFiles", "audio/*,.wav,.mp3,.ogg,.flac,.m4a", true)}<div class="\
row"><label>Источник<select id="track"></select></label>${num("gain", "Громкость источника, %",
  70, 0, 150)}${num(
    "x",
    "X, метры",
    -2,
    -10,
    10,
    0.1
  )}${num("z", "Z, метры", -2, -10, 10, 0.1)}${num(
    "orbit",
    "Оборотов в минуту",
    0,
    -60,
    60,
    0.1
  )}${select(
    "model",
    "Панорамирование",
    [["HRTF", "HRTF · наушники"], ["equalpower", "Equal power · стерео"]]
  )}${num(
    "duration",
    "Длительность WAV, с",
    10,
    1,
    60
  )}</div><div class="actions"><button id="play" class="primary">Слушать</button><button id="stop">Стоп</button><button \
id="demo">Добавить тестовый тон</button><button id="remove">Удалить источник</button><button id="export">Скачать простра\
нственный WAV</button><button id="saveProject">Скачать проект ZIP</button></div><p class="muted">Тащи источники вокруг с\
лушателя. Верх поля — перед слушателем, низ — за спиной. Звуки зацикливаются. Для эффекта HRTF нужны наушники; направлен\
ие спереди/сзади воспринимается индивидуально. До 6 источников, до 30 с на источник после декодирования. Экспорт учитыва\
ет позиции, громкость и вращение.</p>${files(
    "project",
    ".zip",
    false
  )}</section><section class="panel">${stage()}<p id="info" class="muted"></p></section>`;
  let tracks = [], context = null, nodes = [], playing = false, started = 0, frame, dead = false, drag = -1;
  const c = $("stage"), ctx = c.getContext("2d");
  const position = (track, t) => {
    const a = t * track.orbit / 60 * Math.PI * 2;
    return { x: Math.cos(a) * track.x - Math.sin(a) * track.z, z: Math.sin(a) * track.x + Math.cos(a) * track.z };
  };
  async function getContext() {
    if (!context || context.state === "closed") {
      context = new AudioContext();
    }
    await context.resume();
    return context;
  }
  function stop() {
    for (const n of nodes) {
      try {
        n.source.stop();
      } catch (e) {
      }
      n.source.disconnect();
      n.panner.disconnect();
      n.gain.disconnect();
    }
    nodes = [];
    playing = false;
    draw();
  }
  function selected() {
    return tracks[Number($("track").value) || 0];
  }
  function update() {
    const index = $("track").value;
    $("track").replaceChildren(...tracks.map((t2, i) => new Option(t2.name, String(i))));
    if (tracks.length) {
      $("track").value = index !== "" && Number(index) < tracks.length ? index : "0";
    }
    const t = selected();
    if (t) {
      for (const id of ["x", "z", "orbit"]) {
        $(id).value = t[id];
      }
      $("gain").value = t.gain * 100;
    }
    draw();
  }
  function draw() {
    ctx.fillStyle = "#f6f8fc";
    ctx.fillRect(0, 0, 960, 600);
    ctx.strokeStyle = "#d8deea";
    ctx.lineWidth = 1;
    for (let r = 50; r <= 250; r += 50) {
      ctx.beginPath();
      ctx.arc(480, 300, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(180, 300);
    ctx.lineTo(780, 300);
    ctx.moveTo(480, 0);
    ctx.lineTo(480, 600);
    ctx.stroke();
    ctx.fillStyle = "#65758f";
    ctx.font = "14px sans-serif";
    ctx.fillText("СПЕРЕДИ", 445, 25);
    ctx.fillText("СЗАДИ", 453, 580);
    ctx.fillStyle = "#8da7bb";
    ctx.beginPath();
    ctx.arc(480, 300, 15, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(480, 272);
    ctx.lineTo(470, 285);
    ctx.lineTo(490, 285);
    ctx.fill();
    const time = playing && context ? context.currentTime - started : 0;
    tracks.forEach((t, i) => {
      const p = position(t, time), x = 480 + p.x * 25, y = 300 + p.z * 25;
      ctx.fillStyle = i === Number($("track").value) ? "#4bb77a" : "#9aa9c4";
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#374458";
      ctx.fillText(`${i + 1}. ${t.name.slice(0, 32)}`, x + 18, y + 5);
    });
    $("info").textContent = `Источников: ${tracks.length}/6 · 1 клетка = 2 метра · ${playing ? "п\
рослушивание" : "остановлено"}`;
  }
  function makeNodes(ac, track, when = 0) {
    const source = ac.createBufferSource();
    source.buffer = track.buffer;
    source.loop = true;
    const panner = ac.createPanner();
    panner.panningModel = $("model").value;
    panner.distanceModel = "inverse";
    panner.refDistance = 1;
    panner.rolloffFactor = 0.6;
    panner.maxDistance = 30;
    const gain = ac.createGain();
    gain.gain.value = track.gain;
    source.connect(panner).connect(gain).connect(ac.destination);
    source.start(when);
    return { source, panner, gain };
  }
  async function addFiles(list) {
    stop();
    const ac = await getContext();
    let added = 0;
    for (const f of list) {
      if (tracks.length >= 6) {
        status("Лимит: 6 источников.", true);
        break;
      }
      if (f.size > 25e6) {
        status(
          `Пропущен ${f.name}: больше 25 МБ.`,
          true
        );
        continue;
      }
      try {
        const decoded = await ac.decodeAudioData(await f.arrayBuffer());
        const len = Math.min(decoded.length, Math.round(decoded.sampleRate * 30)), buffer = ac.createBuffer(1, len, decoded.
        sampleRate), out = buffer.getChannelData(0);
        for (let i = 0; i < len; i += 1) {
          for (let ch = 0; ch < decoded.numberOfChannels; ch += 1) {
            out[i] += decoded.getChannelData(ch)[i] / decoded.numberOfChannels;
          }
        }
        tracks.push({ name: f.name, buffer, x: tracks.length % 2 ? 2 : -2, z: -2, gain: 0.7, orbit: 0 });
        added += 1;
      } catch (e) {
        status(`Не удалось декодировать ${f.name}: ${e.message}`, true);
      }
    }
    update();
    if (added) {
      status(`Добавлено: ${added}. Источники сведены в моно для пространственного размещения.`);
    }
  }
  $("audioFiles").addEventListener("change", () => {
    addFiles([...$("audioFiles").files]).catch((e) => status(e.message, true));
  });
  $("track").onchange = update;
  for (const id of ["x", "z", "gain", "orbit"]) {
    $(id).oninput = () => {
      const t = selected();
      if (!t) {
        return;
      }
      if (id === "gain") {
        t.gain = clamp(Number($("gain").value) || 0, 0, 150) / 100;
      } else {
        t[id] = clamp(Number($(id).value) || 0, id === "orbit" ? -60 : -10, id === "orbit" ? 60 : 10);
      }
      draw();
    };
  }
  action("demo", async () => {
    stop();
    if (tracks.length >= 6) {
      throw Error("До 6 источников.");
    }
    const ac = await getContext(), buffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), data = buffer.getChannelData(
      0
    );
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.sin(i / ac.sampleRate * Math.PI * 2 * 330) * 0.2 * (0.7 + 0.3 * Math.sin(i / ac.sampleRate * Math.PI *
      4));
    }
    tracks.push({
      name: "Тестовый тон 330 Hz",
      buffer,
      x: -3,
      z: -2,
      gain: 0.7,
      orbit: 6
    });
    update();
  });
  action("play", async () => {
    stop();
    if (!tracks.length) {
      throw Error("Добавь звук или тестовый тон.");
    }
    const ac = await getContext();
    started = ac.currentTime;
    nodes = tracks.map((t) => makeNodes(ac, t));
    playing = true;
  });
  action("stop", stop);
  action("remove", () => {
    stop();
    tracks.splice(Number($("track").value) || 0, 1);
    update();
  });
  $("model").onchange = stop;
  c.onpointerdown = (e) => {
    const p = canvasPoint(c, e), time = playing ? context.currentTime - started : 0;
    drag = tracks.findLastIndex((t) => {
      const v = position(t, time);
      return Math.hypot(480 + v.x * 25 - p.x, 300 + v.z * 25 - p.y) < 25;
    });
    if (drag >= 0) {
      stop();
      $("track").value = String(drag);
      update();
      c.setPointerCapture(e.pointerId);
    }
  };
  c.onpointermove = (e) => {
    if (drag >= 0) {
      const p = canvasPoint(c, e);
      tracks[drag].x = clamp((p.x - 480) / 25, -10, 10);
      tracks[drag].z = clamp((p.y - 300) / 25, -10, 10);
      update();
    }
  };
  c.onpointerup = c.onpointercancel = () => {
    drag = -1;
  };
  action("export", async () => {
    stop();
    if (!tracks.length) {
      throw Error("Добавь источники.");
    }
    const seconds = readNumber("duration", 1, 60), rate = 44100, offline = new OfflineAudioContext(2, Math.ceil(seconds *
    rate), rate);
    for (const t of tracks) {
      const n = makeNodes(offline, t);
      for (let time = 0; time <= seconds + 0.02; time += 0.02) {
        const p = position(t, time);
        n.panner.positionX.linearRampToValueAtTime(p.x, time);
        n.panner.positionZ.linearRampToValueAtTime(p.z, time);
      }
    }
    status("Рендер пространственного звука…");
    const buffer = await offline.startRendering();
    download(wav([buffer.getChannelData(0), buffer.getChannelData(1)], rate), "spatial-audio.wav");
    status("Стерео WAV готов.");
  });
  action("saveProject", async () => {
    const { JSZip } = await import("../vendor/vendor.js");
    const zip = new JSZip();
    zip.file("project.json", JSON.stringify({ format: "GM Spatial", version: 1, model: $("model").value, duration: Number(
      $("duration").value
    ), tracks: tracks.map(({ buffer, ...t }, i) => ({ ...t, file: `audio/${i}.wav` })) }));
    tracks.forEach((t, i) => zip.file(`audio/${i}.wav`, wav([t.buffer.getChannelData(0)], t.buffer.sampleRate)));
    download(await zip.generateAsync({ type: "blob" }), "spatial-project.zip");
  });
  $("project").addEventListener("change", async () => {
    try {
      const file = $("project").files[0];
      if (!file) {
        return;
      }
      if (file.size > 4e7) {
        throw Error("ZIP — до 40 МБ.");
      }
      const { JSZip } = await import("../vendor/vendor.js");
      const zip = await JSZip.loadAsync(file);
      const meta = zip.file("project.json");
      if (!meta || meta._data.uncompressedSize > 1e5) {
        throw Error("Повреждённый проект.");
      }
      const p = JSON.parse(await meta.async("string"));
      if (p.format !== "GM Spatial" || p.version !== 1 || !Array.isArray(p.tracks) || p.tracks.length > 6) {
        throw Error("Неверный проект.");
      }
      const ac = await getContext(), next = [];
      for (const t of p.tracks) {
        if (![t.x, t.z, t.gain, t.orbit].every(Number.isFinite) || Math.abs(t.x) > 10 || Math.abs(t.z) > 10 || t.gain < 0 ||
        t.gain > 1.5 || Math.abs(t.orbit) > 60 || typeof t.name !== "string" || t.name.length > 300 || !/^audio\/[0-5]\.wav$/.
        test(t.file)) {
          throw Error("Параметры источника.");
        }
        const f = zip.file(t.file);
        if (!f || f._data.uncompressedSize > 6e6) {
          throw Error("Звук отсутствует или слишком большой.");
        }
        const buffer = await ac.decodeAudioData(await f.async("arraybuffer"));
        if (buffer.duration > 30.1) {
          throw Error("Запись длиннее 30 с.");
        }
        next.push({ ...t, buffer });
      }
      stop();
      tracks = next;
      $("model").value = p.model === "equalpower" ? "equalpower" : "HRTF";
      $("duration").value = clamp(Number(p.duration) || 10, 1, 60);
      update();
      status("Проект открыт.");
    } catch (e) {
      status(e.message, true);
    }
  });
  function tick() {
    if (dead) {
      return;
    }
    if (playing) {
      tracks.forEach((t, i) => {
        const p = position(t, context.currentTime - started);
        nodes[i].panner.positionX.setTargetAtTime(p.x, context.currentTime, 0.02);
        nodes[i].panner.positionZ.setTargetAtTime(p.z, context.currentTime, 0.02);
        nodes[i].gain.gain.setTargetAtTime(t.gain, context.currentTime, 0.02);
      });
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  teardown(() => {
    dead = true;
    stop();
    cancelAnimationFrame(frame);
    context?.close();
  });
  update();
  frame = requestAnimationFrame(tick);
}
export {
  spatial
};
