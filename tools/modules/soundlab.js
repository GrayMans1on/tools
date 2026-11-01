import { $, select, field, action, status, download, toBlob, teardown, sleep, files, esc } from "../ui.js";
import { wav, decodeAudio } from "../audio-core.js";
import { num, readNumber, projectControls, bindProject } from "../lab-ui.js?v=20261101-v09";
import { soundDefaults, soundPresets, soundLimits, validateSound, synthesize, ambiencePresets, ambienceKinds, renderAmbience } from "../sound-core.js?v=20261101-v09";
const outputUI = () => `<section class="panel"><canvas id="waveform" width="960" height="180" aria-label="Форма звуковой волны"></canvas><div class="actions"><button id="play" class="primary">Синтезировать и слушать</button><button id="stop">Стоп</button><button id="wav">Скачать WAV</button><label>Громкость прослушивания<input id="volume" type="range" min="0" max="100" value="25"></label></div><p id="audioInfo" class="muted"></p></section>`;
function player() {
  let context, source, gain;
  const c = $("waveform"), ctx = c.getContext("2d");
  function paint(result) {
    ctx.fillStyle = "#f3f6fb";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#748fa9";
    ctx.lineWidth = 1;
    const data = result.channels[0];
    for (let x = 0; x < c.width; x += 1) {
      let min = 1, max = -1;
      const a = Math.floor(x / c.width * data.length), b = Math.max(a + 1, Math.floor((x + 1) / c.width * data.length));
      for (let i = a; i < b; i += 1) {
        min = Math.min(min, data[i]);
        max = Math.max(max, data[i]);
      }
      ctx.beginPath();
      ctx.moveTo(x, c.height / 2 - min * c.height * 0.45);
      ctx.lineTo(x, c.height / 2 - max * c.height * 0.45);
      ctx.stroke();
    }
    $("audioInfo").textContent = `${(data.length / result.sampleRate).toFixed(2)} с · ${result.sampleRate} Hz · stereo · Peak ${result.peak.toFixed(3)} · WAV 16-bit`;
  }
  function stop() {
    source?.stop();
    source = null;
  }
  async function play(result) {
    stop();
    context ??= new AudioContext();
    await context.resume();
    const buffer = context.createBuffer(result.channels.length, result.channels[0].length, result.sampleRate);
    result.channels.forEach((data, i) => buffer.copyToChannel(data, i));
    source = context.createBufferSource();
    source.buffer = buffer;
    gain = context.createGain();
    gain.gain.value = Number($("volume").value) / 100;
    source.connect(gain).connect(context.destination);
    source.start();
    const current = source;
    source.onended = () => {
      if (source === current) {
        source = null;
      }
    };
  }
  $("volume").addEventListener("input", () => {
    if (gain) {
      gain.gain.value = Number($("volume").value) / 100;
    }
  });
  action("stop", stop);
  teardown(() => {
    stop();
    context?.close();
  });
  return { paint, play, stop };
}
async function soundfx(root) {
  const titles = { duration: "Длительность, s", startFreq: "Частота начала, Hz", endFreq: "Частота конца, Hz", attack: "Attack, s", decay: "Decay, s", sustain: "Sustain", release: "Release, s", noise: "Доля шума", vibrato: "Vibrato, semitones", vibratoRate: "Vibrato, Hz", arp: "Arpeggio, semitones", arpRate: "Arpeggio, Hz", cutoff: "Low-pass, Hz", crush: "Bit depth", drive: "Distortion", delay: "Delay, s", feedback: "Delay Feedback", pan: "Pan", gain: "Output Gain" };
  root.innerHTML = `<section class="panel"><div class="row">${select("preset", "Категория / пресет", soundPresets.map((p) => [p[0], p[1]]))}<button id="apply">Применить</button>${field("seed", "Seed", "text", soundDefaults.seed)}<button id="randomSeed">Другой seed</button>${select("wave", "Генератор", [["sine", "Sine"], ["triangle", "Triangle"], ["square", "Square"], ["saw", "Saw"], ["noise", "Noise"], ["fm", "FM Bell"]])}</div><p class="muted">Синтез коротких игровых и интерфейсных звуков. Это не нейросеть и не генератор реалистичных записей: выстрелы, взрывы и механика здесь стилизованные. Квадрат и пила могут содержать цифровые призвуки; для чистого тона выбирай Sine.</p><div class="grid">${Object.entries(titles).map(([id, title]) => num(id, title, soundDefaults[id], ...soundLimits[id], ["startFreq", "endFreq", "cutoff", "crush"].includes(id) ? 1 : 0.01)).join("")}</div><div class="actions"><button id="variations">8 вариаций WAV в ZIP</button><button id="cancel">Отменить пакет</button></div>${projectControls()}</section>${outputUI()}`;
  const audio = player();
  let result, signature = "", cancelled = false, busy = false;
  const config = () => validateSound(Object.fromEntries(Object.keys(soundDefaults).map((k) => [k, ["seed", "wave"].includes(k) ? $(k).value : Number($(k).value)])));
  const apply = () => {
    const p = soundPresets.find((p2) => p2[0] === $("preset").value), s = { ...soundDefaults, ...p[2], seed: $("seed").value };
    for (const [k, v] of Object.entries(s)) {
      $(k).value = v;
    }
    signature = "";
    status(`Пресет: ${p[1]}. Нажми «Синтезировать и слушать».`);
  };
  action("apply", apply);
  action("randomSeed", () => {
    $("seed").value = String(crypto.getRandomValues(new Uint32Array(1))[0]);
    signature = "";
  });
  async function generate() {
    const s = config(), sig = JSON.stringify(s);
    if (sig !== signature) {
      result = await synthesize(s, 44100, sleep);
      signature = sig;
      audio.paint(result);
      status("Звук готов.");
    }
    return result;
  }
  action("play", async () => audio.play(await generate()));
  action("wav", async () => {
    const r = await generate();
    download(wav(r.channels, r.sampleRate), "synthesized-effect.wav");
  });
  action("cancel", () => {
    cancelled = true;
  });
  action("variations", async () => {
    if (busy) {
      throw new Error("Пакет уже создаётся.");
    }
    const s = config(), { JSZip } = await import("../vendor/vendor.js");
    busy = true;
    cancelled = false;
    const zip = new JSZip();
    try {
      for (let i = 0; i < 8; i += 1) {
        if (cancelled) {
          status("Пакет отменён.");
          return;
        }
        const params = { ...s, seed: `${s.seed}:${i}`, startFreq: Math.max(20, Math.min(16e3, s.startFreq * (0.88 + i * 0.035))), endFreq: Math.max(20, Math.min(16e3, s.endFreq * (0.9 + i * 0.03))) };
        const r = await synthesize(params, 44100, async () => {
          if (cancelled) {
            throw new Error("Пакет отменён.");
          }
          await sleep();
        });
        zip.file(`effect_${i + 1}.wav`, wav(r.channels, r.sampleRate));
        zip.file(`effect_${i + 1}.json`, JSON.stringify(params));
        status(`Вариация ${i + 1}/8`);
      }
      download(await zip.generateAsync({ type: "blob" }), "sound-variations.zip");
    } finally {
      busy = false;
    }
  });
  bindProject("GM Sound", () => ({ settings: config() }), (p) => {
    const s = validateSound(p.settings || {});
    for (const [k, v] of Object.entries(s)) {
      $(k).value = v;
    }
    signature = "";
  });
  apply();
}
async function ambience(root) {
  const names = { rain: "Дождь", wind: "Ветер", ocean: "Прибой", fire: "Костёр", birds: "Птицы", hum: "Низкий гул", train: "Поезд", space: "Космос", stream: "Ручей", cafe: "Абстрактное кафе", crickets: "Сверчки", thunder: "Гром", deep: "Под водой", sample: "Своя запись" };
  root.innerHTML = `<section class="panel"><div class="row">${select("preset", "Сцена", ambiencePresets.map((p) => [p[0], p[1]]))}<button id="apply">Загрузить</button>${field("seed", "Seed", "text", "Ambience-42")}${num("duration", "Длительность WAV, s", 20, 1, 120)}<button id="addLayer">+ Слой</button></div><p class="muted">Встроенные источники синтетические. Для натуральной атмосферы загрузи свои записи: они зацикливаются с коротким кроссфейдом. До 8 слоёв; своя запись — до 30 секунд после декодирования. Файлы остаются локально.</p><div id="layers"></div><div class="actions"><button id="saveProject">Скачать проект ZIP со звуками</button></div>${files("project", ".zip", false)}</section>${outputUI()}`;
  let layers = [], samples = [], result, signature = "", assetVersion = 0;
  const audio = player();
  function editors() {
    $("layers").replaceChildren();
    layers.forEach((layer, index) => {
      const div = document.createElement("div");
      div.className = "block";
      div.innerHTML = `<div class="row"><label>Источник<select data-key="kind">${ambienceKinds.map((k) => `<option value="${k}" ${k === layer.kind ? "selected" : ""}>${names[k]}</option>`).join("")}</select></label><label>Gain<input data-key="gain" type="range" min="0" max="1" step=".01" value="${layer.gain}"></label><label>Pan<input data-key="pan" type="range" min="-1" max="1" step=".01" value="${layer.pan}"></label><label>Rate<input data-key="rate" type="number" min=".1" max="4" step=".1" value="${layer.rate}"></label><label><input data-key="mute" type="checkbox" ${layer.mute ? "checked" : ""}> Mute</label><button data-remove>Удалить</button></div><label class="drop">Загрузить свою запись<input data-sample type="file" accept="audio/*"></label><p class="muted">${samples[index] ? `Запись: ${(samples[index].channels[0].length / samples[index].sampleRate).toFixed(1)} с` : "Своя запись не загружена"}</p>`;
      div.addEventListener("input", (e) => {
        const key = e.target.dataset.key;
        if (key) {
          layer[key] = e.target.type === "checkbox" ? e.target.checked : key === "kind" ? e.target.value : Number(e.target.value);
          signature = "";
        }
      });
      div.querySelector("[data-remove]").addEventListener("click", () => {
        layers.splice(index, 1);
        samples.splice(index, 1);
        assetVersion += 1;
        signature = "";
        editors();
      });
      div.querySelector("[data-sample]").addEventListener("change", async (e) => {
        try {
          const file = e.target.files[0];
          if (!file) {
            return;
          }
          if (file.size > 2e7) {
            throw new Error("Аудиофайл до 20 МБ.");
          }
          const buffer = await decodeAudio(file), length = Math.min(buffer.length, Math.floor(buffer.sampleRate * 30));
          samples[index] = { sampleRate: buffer.sampleRate, channels: Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, i) => buffer.getChannelData(i).slice(0, length)) };
          layer.kind = "sample";
          assetVersion += 1;
          signature = "";
          editors();
          status(buffer.duration > 30 ? "Используются первые 30 секунд записи." : "Запись загружена.");
        } catch (e2) {
          status(e2.message, true);
        }
      });
      $("layers").append(div);
    });
  }
  action("apply", () => {
    const p = ambiencePresets.find((p2) => p2[0] === $("preset").value);
    layers = p[2].map(([kind, gain], i) => ({ kind, gain, pan: (i - 1) * 0.25, rate: 1, mute: false }));
    samples = layers.map(() => null);
    assetVersion += 1;
    signature = "";
    editors();
  });
  action("addLayer", () => {
    if (layers.length >= 8) {
      throw new Error("До 8 слоёв.");
    }
    layers.push({ kind: "wind", gain: 0.2, pan: 0, rate: 1, mute: false });
    samples.push(null);
    editors();
  });
  async function generate() {
    const duration = readNumber("duration", 1, 120), seed = $("seed").value, sig = JSON.stringify({ layers, duration, seed, assetVersion });
    if (sig !== signature) {
      status("Синтез сцены…");
      result = await renderAmbience(JSON.parse(JSON.stringify(layers)), duration, seed, 44100, sleep, samples.slice());
      signature = sig;
      audio.paint(result);
      status("Сцена готова.");
    }
    return result;
  }
  action("play", async () => audio.play(await generate()));
  action("wav", async () => {
    const r = await generate();
    download(wav(r.channels, r.sampleRate), "ambient-scene.wav");
  });
  action("saveProject", async () => {
    await renderAmbience(layers, 0.1 + 1, $("seed").value, 8e3, async () => {
    }, samples);
    const { JSZip } = await import("../vendor/vendor.js"), zip = new JSZip();
    const manifest = { format: "GM Ambience", version: 1, seed: $("seed").value, duration: readNumber("duration", 1, 120), layers };
    for (let i = 0; i < samples.length; i += 1) {
      if (samples[i]) {
        zip.file(`assets/${i}.wav`, wav(samples[i].channels, samples[i].sampleRate));
      }
    }
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    download(await zip.generateAsync({ type: "blob" }), "ambient-project.zip");
  });
  $("project").addEventListener("change", async () => {
    try {
      const file = $("project").files[0];
      if (!file) {
        return;
      }
      if (file.size > 6e7) {
        throw new Error("ZIP до 60 МБ.");
      }
      const { JSZip } = await import("../vendor/vendor.js"), zip = await JSZip.loadAsync(file), entry = zip.file("manifest.json");
      if (!entry) {
        throw new Error("Нет manifest.json.");
      }
      if ((entry._data?.uncompressedSize || 0) > 100000) { throw new Error("Слишком большой манифест."); }
      const text = await entry.async("string");
      if (text.length > 1e5) {
        throw new Error("Слишком большой манифест.");
      }
      const p = JSON.parse(text);
      if (p.format !== "GM Ambience" || p.version !== 1 || !Array.isArray(p.layers) || p.layers.length > 8 || !Number.isFinite(p.duration) || p.duration < 1 || p.duration > 120) {
        throw new Error("Неверный проект.");
      }
      const next = [];
      let bytes = 0;
      for (let i = 0; i < p.layers.length; i += 1) {
        const asset = zip.file(`assets/${i}.wav`);
        if (asset) {
          if ((asset._data?.uncompressedSize || 0) > 24000000) { throw new Error("Аудиозапись в ZIP слишком большая."); }
          const buffer = await asset.async("uint8array");
          bytes += buffer.length;
          if (bytes > 1e8) {
            throw new Error("Аудио в проекте превышает 100 МБ.");
          }
          const decoded = await decodeAudio(new File([buffer], "sample.wav", { type: "audio/wav" }));
          if (decoded.duration > 30.01) {
            throw new Error("Запись в проекте длиннее 30 секунд.");
          }
          next.push({ sampleRate: decoded.sampleRate, channels: Array.from({ length: Math.min(2, decoded.numberOfChannels) }, (_, j) => decoded.getChannelData(j).slice()) });
        } else {
          next.push(null);
        }
      }
      await renderAmbience(p.layers, 1, p.seed, 8e3, async () => {
      }, next);
      layers = p.layers;
      samples = next;
      $("seed").value = p.seed;
      $("duration").value = p.duration;
      assetVersion += 1;
      signature = "";
      editors();
      status("Проект восстановлен.");
    } catch (e) {
      status(e.message, true);
    }
  });
  layers = ambiencePresets[0][2].map(([kind, gain], i) => ({ kind, gain, pan: (i - 1) * 0.25, rate: 1, mute: false }));
  samples = layers.map(() => null);
  editors();
}
export {
  ambience,
  soundfx
};
