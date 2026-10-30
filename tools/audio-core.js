import { sleep } from './ui.js';

export async function decodeAudio(file) {
  const context = new AudioContext();
  try { return await context.decodeAudioData(await file.arrayBuffer()); }
  finally { await context.close(); }
}
export function wav(channels, sampleRate) {
  const length = channels[0].length;
  const count = channels.length;
  const buffer = new ArrayBuffer(44 + length * count * 2);
  const view = new DataView(buffer);
  function text(offset, value) { for (let i = 0; i < value.length; i += 1) { view.setUint8(offset + i, value.charCodeAt(i)); } }
  text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, count, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * count * 2, true);
  view.setUint16(32, count * 2, true); view.setUint16(34, 16, true); text(36, 'data');
  view.setUint32(40, length * count * 2, true);
  let offset = 44;
  for (let i = 0; i < length; i += 1) {
    for (let channel = 0; channel < count; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i] || 0));
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2;
    }
  }
  return new Blob([buffer], {type: 'audio/wav'});
}
export async function encodeAudio(channels, sampleRate, format = 'wav') {
  if (format === 'wav') { return wav(channels, sampleRate); }
  if (!window.lamejs?.Mp3Encoder) { throw new Error('MP3-кодировщик не загрузился. Обнови страницу или выбери WAV.'); }
  const encoder = new window.lamejs.Mp3Encoder(channels.length, sampleRate, 192);
  const out = [];
  for (let offset = 0; offset < channels[0].length; offset += 1152) {
    const parts = channels.map(channel => {
      const data = new Int16Array(Math.min(1152, channel.length - offset));
      for (let i = 0; i < data.length; i += 1) { data[i] = Math.max(-32768, Math.min(32767, Math.round((channel[offset + i] || 0) * 32767))); }
      return data;
    });
    const bytes = encoder.encodeBuffer(parts[0], parts[1]);
    if (bytes.length) { out.push(new Uint8Array(bytes)); }
    if (offset % (1152 * 150) === 0) { await sleep(); }
  }
  const tail = encoder.flush(); if (tail.length) { out.push(new Uint8Array(tail)); }
  return new Blob(out, {type: 'audio/mpeg'});
}
export async function processAudio(buffer, options) {
  const rate = buffer.sampleRate;
  const start = Math.max(0, Math.min(buffer.length - 1, Math.round((options.start || 0) * rate)));
  const end = Math.max(start + 1, Math.min(buffer.length, Math.round((options.end ?? buffer.duration) * rate)));
  const source = Array.from({length: Math.min(2, buffer.numberOfChannels)}, (_, i) => buffer.getChannelData(i).slice(start, end));
  let channels = source;
  const tempo = options.tempo || 1; const pitch = options.pitch || 0;
  if (tempo !== 1 || pitch !== 0) {
    const {SoundTouch, SimpleFilter} = await import('./vendor/vendor.js');
    const pipe = new SoundTouch(); pipe.tempo = tempo; pipe.pitch = Math.pow(2, pitch / 12);
    const sourceSound = {extract(target, frames, position) {
      const available = Math.max(0, Math.min(frames, source[0].length + 16384 - position));
      for (let i = 0; i < available; i += 1) {
        target[i * 2] = source[0][position + i] || 0; target[i * 2 + 1] = (source[1] || source[0])[position + i] || 0;
      }
      return available;
    }};
    const filter = new SimpleFilter(sourceSound, pipe);
    const expected = Math.ceil((source[0].length + 16384) / tempo) + 32768;
    if (expected > 80000000) { throw new Error('Слишком длинный результат. Уменьши фрагмент или увеличь темп.'); }
    const left = new Float32Array(expected); const right = new Float32Array(expected);
    const chunk = new Float32Array(8192); let offset = 0;
    while (true) {
      const count = filter.extract(chunk, 4096); if (!count) { break; }
      if (offset + count > expected) { throw new Error('Результат превысил расчётный размер.'); }
      for (let i = 0; i < count; i += 1) { left[offset + i] = chunk[i * 2]; right[offset + i] = chunk[i * 2 + 1]; }
      offset += count;
      if (offset % (4096 * 30) === 0) { await sleep(); }
    }
    if (!offset) { throw new Error('Фрагмент слишком короткий для изменения темпа.'); }
    const wanted = Math.min(offset, Math.round(source[0].length / tempo));
    channels = source.length > 1 ? [left.slice(0, wanted), right.slice(0, wanted)] : [left.slice(0, wanted)];
  }
  if (options.channel === 'mono' && channels.length > 1) {
    channels = [channels[0].map((value, index) => (value + channels[1][index]) / 2)];
  } else if (options.channel === 'left') { channels = [channels[0]]; }
  else if (options.channel === 'right') { channels = [channels[1] || channels[0]]; }
  else if (options.channel === 'swap' && channels.length > 1) { channels.reverse(); }
  const gain = Math.pow(10, (options.gain || 0) / 20);
  const fadeIn = Math.max(0, options.fadeIn || 0) * rate;
  const fadeOut = Math.max(0, options.fadeOut || 0) * rate;
  let peak = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i += 1) {
      const fade = Math.min(1, fadeIn ? i / fadeIn : 1, fadeOut ? (channel.length - 1 - i) / fadeOut : 1);
      channel[i] *= gain * Math.max(0, fade); peak = Math.max(peak, Math.abs(channel[i]));
    }
  }
  return {channels, sampleRate: rate, peak};
}
