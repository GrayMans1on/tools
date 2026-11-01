import { seeded } from "./effects-core.js?v=20261101-v09";
import { clamp, lerp } from "./lab-core.js?v=20261101-v09";
const soundDefaults = { seed: "Sound-42", wave: "sine", duration: 0.5, startFreq: 700, endFreq: 180, attack: 5e-3, decay: 0.16, sustain: 0.1, release: 0.15, noise: 0.1, vibrato: 0, vibratoRate: 8, arp: 0, arpRate: 8, cutoff: 12e3, crush: 16, drive: 0, delay: 0, feedback: 0.25, pan: 0, gain: 0.7 };
const soundPresets = [
  ["coin", "Монета", { wave: "square", duration: 0.3, startFreq: 900, endFreq: 1300, arp: 7, arpRate: 9, noise: 0, decay: 0.1, release: 0.12 }],
  ["jump", "Прыжок", { wave: "square", duration: 0.35, startFreq: 170, endFreq: 700, noise: 0 }],
  ["laser", "Лазер", { wave: "saw", duration: 0.45, startFreq: 1800, endFreq: 75, noise: 0.05, crush: 10 }],
  ["shot", "Выстрел · стилизация", { wave: "triangle", duration: 0.28, startFreq: 150, endFreq: 35, noise: 0.9, cutoff: 6500, drive: 2 }],
  ["explosion", "Взрыв · ретро", { wave: "noise", duration: 1.2, startFreq: 80, endFreq: 20, noise: 1, cutoff: 2200, decay: 0.35, sustain: 0.15, release: 0.7, drive: 1 }],
  ["hit", "Удар", { wave: "sine", duration: 0.18, startFreq: 190, endFreq: 45, noise: 0.45, decay: 0.07, release: 0.08 }],
  ["click", "Щелчок UI", { wave: "triangle", duration: 0.055, startFreq: 2200, endFreq: 800, noise: 0.2, attack: 1e-3, decay: 0.02, release: 0.025 }],
  ["hover", "Наведение UI", { wave: "sine", duration: 0.1, startFreq: 650, endFreq: 850, noise: 0, decay: 0.04, release: 0.05 }],
  ["confirm", "Подтверждение", { wave: "sine", duration: 0.4, startFreq: 500, endFreq: 1e3, arp: 12, arpRate: 6, noise: 0 }],
  ["cancel", "Отмена", { wave: "triangle", duration: 0.32, startFreq: 700, endFreq: 200, noise: 0 }],
  ["error", "Ошибка", { wave: "square", duration: 0.4, startFreq: 140, endFreq: 120, vibrato: 4, vibratoRate: 16, noise: 0, cutoff: 2500 }],
  ["notify", "Уведомление", { wave: "sine", duration: 0.8, startFreq: 700, endFreq: 700, arp: 7, arpRate: 5, noise: 0, release: 0.5, delay: 0.16, feedback: 0.35 }],
  ["powerup", "Усиление", { wave: "square", duration: 1, startFreq: 180, endFreq: 1300, arp: 4, arpRate: 14, noise: 0, release: 0.2 }],
  ["down", "Потеря усиления", { wave: "saw", duration: 0.8, startFreq: 1200, endFreq: 80, arp: -3, arpRate: 10, noise: 0.1 }],
  ["teleport", "Телепорт", { wave: "fm", duration: 1, startFreq: 300, endFreq: 1600, vibrato: 8, vibratoRate: 18, noise: 0.15, delay: 0.12 }],
  ["shield", "Щит", { wave: "fm", duration: 0.8, startFreq: 80, endFreq: 500, noise: 0.2, attack: 0.08, cutoff: 4e3 }],
  ["magic", "Магический всплеск", { wave: "sine", duration: 1.2, startFreq: 1400, endFreq: 500, arp: 7, arpRate: 16, noise: 0.2, delay: 0.2, release: 0.7 }],
  ["whoosh", "Взмах / переход", { wave: "noise", duration: 0.6, startFreq: 100, endFreq: 60, noise: 1, attack: 0.15, decay: 0.12, sustain: 0.15, release: 0.3, cutoff: 5e3 }],
  ["sweep", "Короткий свип", { wave: "saw", duration: 0.3, startFreq: 120, endFreq: 3e3, noise: 0.2, cutoff: 6500 }],
  ["kick", "Бочка", { wave: "sine", duration: 0.4, startFreq: 130, endFreq: 38, noise: 0.02, decay: 0.12, release: 0.2, drive: 0.5 }],
  ["snare", "Малый барабан", { wave: "triangle", duration: 0.2, startFreq: 180, endFreq: 100, noise: 0.85, cutoff: 9e3 }],
  ["hat", "Хэт", { wave: "noise", duration: 0.07, startFreq: 1200, endFreq: 1e3, noise: 1, attack: 1e-3, decay: 0.025, release: 0.035, cutoff: 16e3 }],
  ["tom", "Том", { wave: "sine", duration: 0.4, startFreq: 220, endFreq: 90, noise: 0.08, release: 0.25 }],
  ["pluck", "Щипок", { wave: "triangle", duration: 0.8, startFreq: 440, endFreq: 430, noise: 0.04, decay: 0.15, release: 0.5, cutoff: 4500 }],
  ["bell", "Колокольчик", { wave: "fm", duration: 1.6, startFreq: 900, endFreq: 895, noise: 0, decay: 0.3, release: 1.1 }],
  ["sonar", "Сонар", { wave: "sine", duration: 1.4, startFreq: 1100, endFreq: 1050, noise: 0, attack: 0.02, release: 1, delay: 0.25, feedback: 0.4 }],
  ["robot", "Робот", { wave: "square", duration: 0.8, startFreq: 260, endFreq: 240, arp: 5, arpRate: 16, vibrato: 2, vibratoRate: 25, crush: 6, noise: 0.1 }],
  ["blip", "Радиосигнал", { wave: "sine", duration: 0.18, startFreq: 1600, endFreq: 1600, noise: 0, release: 0.05 }],
  ["engine", "Запуск двигателя", { wave: "saw", duration: 2, startFreq: 40, endFreq: 180, noise: 0.35, attack: 0.3, decay: 0.2, sustain: 0.8, release: 0.4, cutoff: 2e3 }],
  ["alarm", "Сирена", { wave: "sine", duration: 2, startFreq: 600, endFreq: 600, vibrato: 8, vibratoRate: 2, noise: 0, sustain: 0.8, release: 0.2 }],
  ["heartbeat", "Сердцебиение · стилизация", { wave: "sine", duration: 0.35, startFreq: 65, endFreq: 40, noise: 0.12, delay: 0.17, feedback: 0.65, cutoff: 600 }],
  ["glitch", "Глитч", { wave: "square", duration: 0.6, startFreq: 2400, endFreq: 80, noise: 0.45, arp: -7, arpRate: 35, crush: 4, drive: 3 }]
];
const soundLimits = { duration: [0.03, 10], startFreq: [20, 16e3], endFreq: [20, 16e3], attack: [1e-3, 3], decay: [1e-3, 3], sustain: [0, 1], release: [1e-3, 5], noise: [0, 1], vibrato: [0, 24], vibratoRate: [0.1, 40], arp: [-24, 24], arpRate: [1, 40], cutoff: [100, 2e4], crush: [2, 16], drive: [0, 5], delay: [0, 1], feedback: [0, 0.8], pan: [-1, 1], gain: [0, 1] };
function validateSound(input) {
  const s = { ...soundDefaults };
  for (const k of Object.keys(s)) {
    if (Object.hasOwn(input, k)) {
      s[k] = input[k];
    }
  }
  for (const [k, [a, b]] of Object.entries(soundLimits)) {
    if (!Number.isFinite(s[k]) || s[k] < a || s[k] > b) {
      throw new Error(`${k}: ${a}…${b}.`);
    }
  }
  if (typeof s.seed !== "string" || s.seed.length > 200 || !["sine", "triangle", "square", "saw", "noise", "fm"].includes(s.wave)) {
    throw new Error("Неверный генератор или seed.");
  }
  return s;
}
async function synthesize(input, sampleRate = 44100, yieldControl = async () => {
}) {
  const s = validateSound(input), length = Math.round(s.duration * sampleRate), left = new Float32Array(length), right = new Float32Array(length), random = seeded(s.seed), levels = 2 ** s.crush;
  let phase = 0, low = 0;
  const alpha = 1 - Math.exp(-Math.PI * 2 * Math.min(s.cutoff, sampleRate * 0.45) / sampleRate), delay = Math.round(s.delay * sampleRate);
  const pan = (s.pan + 1) * Math.PI / 4;
  let peak = 0;
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate, u = t / s.duration;
    const pitch = lerp(Math.log(s.startFreq), Math.log(s.endFreq), u), vib = Math.sin(t * Math.PI * 2 * s.vibratoRate) * s.vibrato, arp = Math.floor(t * s.arpRate) % 2 ? s.arp : 0, freq = Math.min(sampleRate * 0.42, Math.exp(pitch) * 2 ** ((vib + arp) / 12));
    phase += freq / sampleRate;
    const p = phase % 1;
    let tone = s.wave === "sine" ? Math.sin(phase * Math.PI * 2) : s.wave === "triangle" ? 1 - 4 * Math.abs(p - 0.5) : s.wave === "square" ? p < 0.5 ? 1 : -1 : s.wave === "saw" ? p * 2 - 1 : s.wave === "fm" ? Math.sin(phase * Math.PI * 2 + Math.sin(phase * Math.PI * 2 * 2.76) * 2) : 0;
    const noise = random() * 2 - 1;
    if (s.wave === "noise") {
      tone = noise;
    }
    let envelope = t < s.attack ? t / s.attack : t < s.attack + s.decay ? lerp(1, s.sustain, (t - s.attack) / s.decay) : s.sustain;
    envelope *= clamp((s.duration - t) / s.release);
    const transient = Math.exp(-t / (s.decay || 0.1));
    envelope = Math.max(envelope, transient * 0.15) * clamp(t / 1e-3);
    let value = (s.wave === "noise" ? tone : tone * (1 - s.noise) + noise * s.noise) * envelope;
    low += alpha * (value - low);
    value = low;
    if (s.drive) {
      value = Math.tanh(value * (1 + s.drive * 3)) / Math.tanh(1 + s.drive * 3);
    }
    value = Math.round(value * levels) / levels;
    if (delay && i >= delay) {
      value += (left[i - delay] + right[i - delay]) * 0.707 * s.feedback;
    }
    value *= s.gain;
    left[i] = value * Math.cos(pan);
    right[i] = value * Math.sin(pan);
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    if (i % 131072 === 0) {
      await yieldControl();
    }
  }
  const scale = peak > 0.95 ? 0.95 / peak : 1;
  for (let i = 0; i < length; i += 1) {
    const tail = clamp((length - 1 - i) / (sampleRate * 5e-3));
    left[i] *= scale * tail;
    right[i] *= scale * tail;
  }
  return { channels: [left, right], sampleRate, peak: peak * scale };
}
const ambiencePresets = [
  ["rain", "Дождь у окна", [["rain", 0.55], ["wind", 0.13], ["hum", 0.04]]],
  ["storm", "Гроза · синтетическая", [["rain", 0.7], ["wind", 0.3], ["thunder", 0.25]]],
  ["forest", "Лес у ручья", [["birds", 0.35], ["stream", 0.45], ["wind", 0.13]]],
  ["camp", "Костёр ночью", [["fire", 0.6], ["crickets", 0.25], ["wind", 0.1]]],
  ["train", "Поезд", [["train", 0.65], ["rain", 0.18], ["hum", 0.1]]],
  ["space", "Космический корабль", [["hum", 0.4], ["space", 0.4], ["wind", 0.1]]],
  ["ocean", "Морской берег", [["ocean", 0.7], ["wind", 0.15]]],
  ["cafe", "Кафе · абстрактный гул", [["cafe", 0.5], ["hum", 0.12]]],
  ["night", "Летняя ночь", [["crickets", 0.4], ["wind", 0.15]]],
  ["underwater", "Под водой", [["deep", 0.7], ["space", 0.12]]],
  ["fan", "Вентиляция", [["wind", 0.3], ["hum", 0.35]]],
  ["river", "Река и дождь", [["stream", 0.65], ["rain", 0.25]]]
];
const ambienceKinds = ["rain", "wind", "ocean", "fire", "birds", "hum", "train", "space", "stream", "cafe", "crickets", "thunder", "deep", "sample"];
async function renderAmbience(layers, duration, seed, sampleRate = 44100, yieldControl = async () => {
}, samples = []) {
  if (!Number.isFinite(duration) || duration < 1 || duration > 120 || typeof seed !== "string" || seed.length > 200 || !Array.isArray(layers) || layers.length > 8) {
    throw new Error("Сцена: 1–120 с, до 8 слоёв.");
  }
  const length = Math.round(duration * sampleRate), out = [new Float32Array(length), new Float32Array(length)];
  for (let index = 0; index < layers.length; index += 1) {
    const layer = layers[index];
    if (!ambienceKinds.includes(layer.kind) || !Number.isFinite(layer.gain) || layer.gain < 0 || layer.gain > 1 || !Number.isFinite(layer.pan) || Math.abs(layer.pan) > 1 || !Number.isFinite(layer.rate) || layer.rate < 0.1 || layer.rate > 4) {
      throw new Error("Неверный звуковой слой.");
    }
    if (layer.mute) {
      continue;
    }
    if (layer.kind === "sample" && !samples[index]) {
      throw new Error(`Для слоя ${index + 1} загрузи аудиофайл.`);
    }
    const random = seeded(`${seed}:${index}`);
    let low = 0, brown = 0, pop = 0, chirp = 0, chirpPhase = 0, chirpFreq = 1600, thunder = 0;
    const pan = (layer.pan + 1) * Math.PI / 4;
    for (let i = 0; i < length; i += 1) {
      const t = i / sampleRate, n = random() * 2 - 1;
      low += 0.025 * (n - low);
      brown = clamp(brown + n * 0.015, -1, 1) * 0.999;
      let value = 0;
      const rate = layer.rate;
      if (layer.kind === "rain") {
        if (random() < 9e-4 * rate) {
          pop = random() * 0.6;
        }
        pop *= 0.93;
        value = n * 0.3 + pop;
      }
      if (layer.kind === "wind") {
        value = (low * 1.5 + brown * 0.5) * (0.5 + 0.5 * Math.sin(t * 0.38 + 0.5) ** 2);
      }
      if (layer.kind === "ocean") {
        value = (low * 2 + n * 0.12) * (0.15 + 0.85 * (0.5 + 0.5 * Math.sin(t * 0.75 * rate)) ** 2);
      }
      if (layer.kind === "stream") {
        value = n * 0.18 + low * 0.9 + Math.sin(t * (180 + Math.sin(t * 3) * 100)) * low * 0.25;
      }
      if (layer.kind === "fire") {
        if (random() < 1e-3 * rate) {
          pop = random();
        }
        pop *= 0.85;
        value = brown * 0.2 + low * 0.6 + pop * n;
      }
      if (layer.kind === "birds") {
        if (random() < 5e-5 * rate) {
          chirp = 0.2 + random() * 0.4;
          chirpFreq = 1400 + random() * 2400;
        }
        chirpPhase += (chirpFreq + Math.sin(t * 30) * 500) / sampleRate;
        value = chirp > 0 ? Math.sin(chirpPhase * Math.PI * 2) * Math.sin(Math.PI * Math.min(1, chirp / 0.4)) * 0.4 : 0;
        chirp -= 1 / sampleRate;
      }
      if (layer.kind === "crickets") {
        value = Math.sin(t * Math.PI * 2 * 4200) * Math.max(0, Math.sin(t * 9 * rate)) * Math.max(0, Math.sin(t * 35)) * 0.14;
      }
      if (layer.kind === "hum") {
        value = Math.sin(t * Math.PI * 2 * 55) * 0.18 + Math.sin(t * Math.PI * 2 * 110) * 0.06 + low * 0.2;
      }
      if (layer.kind === "train") {
        const beat = t * rate * 3 % 1;
        value = low * 0.7 + brown * 0.3 + Math.exp(-beat * 45) * n * 0.5;
      }
      if (layer.kind === "space") {
        value = Math.sin(t * Math.PI * 2 * (80 + Math.sin(t * 0.2) * 3)) * 0.15 + low * 0.6 + Math.sin(t * Math.PI * 2 * 220) * 0.025;
      }
      if (layer.kind === "cafe") {
        value = low * 0.8 * (0.7 + 0.3 * Math.sin(t * 3.7)) + Math.sin(t * 140) * brown * 0.12;
      }
      if (layer.kind === "thunder") {
        if (random() < 5e-6 * rate) {
          thunder = 1;
        }
        thunder *= 0.99997;
        value = (brown * 0.7 + low) * thunder;
      }
      if (layer.kind === "deep") {
        value = brown * 0.4 + Math.sin(t * Math.PI * 2 * 38) * 0.15;
      }
      if (layer.kind === "sample") {
        const asset = samples[index], pos = t * asset.sampleRate * rate, period = asset.channels[0].length, fade = Math.min(Math.floor(asset.sampleRate * 0.05), Math.floor(period / 4)), loopLength = period - fade;
        const phase = pos % loopLength;
        const at = (ch) => {
          const data = asset.channels[Math.min(ch, asset.channels.length - 1)], j = Math.floor(phase), f = phase - j, a = data[j] || 0, b = data[(j + 1) % period] || 0;
          let v = lerp(a, b, f);
          if (phase < fade) {
            const old = phase + loopLength, k = Math.floor(old), q = old - k;
            v = lerp(lerp(data[k] || 0, data[Math.min(period - 1, k + 1)] || 0, q), v, phase / fade);
          }
          return v;
        };
        const edge2 = Math.min(1, t / 0.08, (duration - t) / 0.08);
        out[0][i] += at(0) * layer.gain * Math.cos(pan) * edge2;
        out[1][i] += at(1) * layer.gain * Math.sin(pan) * edge2;
        if (i % 131072 === 0) {
          await yieldControl();
        }
        continue;
      }
      const edge = Math.min(1, t / 0.08, (duration - t) / 0.08);
      value *= layer.gain * edge;
      out[0][i] += value * Math.cos(pan);
      out[1][i] += value * Math.sin(pan);
      if (i % 131072 === 0) {
        await yieldControl();
      }
    }
    await yieldControl();
  }
  let peak = 0;
  for (let i = 0; i < length; i += 1) {
    peak = Math.max(peak, Math.abs(out[0][i]), Math.abs(out[1][i]));
  }
  if (peak > 0.95) {
    for (const ch of out) {
      for (let i = 0; i < ch.length; i += 1) {
        ch[i] *= 0.95 / peak;
      }
    }
  }
  return { channels: out, sampleRate, peak: Math.min(peak, 0.95) };
}
export {
  ambienceKinds,
  ambiencePresets,
  renderAmbience,
  soundDefaults,
  soundLimits,
  soundPresets,
  synthesize,
  validateSound
};
