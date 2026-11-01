import {download, toBlob, sleep, status} from './ui.js';
// One offline frame clock is shared by preview, seek, PNG, GIF and video.
export async function exportEffect({format, settings, draw, canvas, cancelled}) {
  const {JSZip, GIFEncoder, quantize, applyPalette, Muxer, ArrayBufferTarget} = await import('./vendor/vendor.js');
  const {width, height, fps, duration} = settings;
  const total = Math.ceil(duration * fps - 1e-8);
  if (total > 1800 || width * height * total > 1000000000) { throw new Error('Лимит экспорта: 1800 кадров и 1 млрд пикселей суммарно. Уменьши размер, FPS или длительность.'); }
  const zip = format === 'sequence' ? new JSZip() : null;
  const gif = format === 'gif' ? GIFEncoder() : null;
  let encoder; let muxer; let software; let failure;
  try {
    if (format === 'mp4') {
      const config = {codec: width > 1280 || height > 720 || fps > 30 ? 'avc1.42002a' : 'avc1.42001f', width, height, bitrate: 6000000, framerate: fps, avc: {format: 'avc'}};
      const supported = globalThis.VideoEncoder ? await VideoEncoder.isConfigSupported(config) : {supported: false};
      if (supported.supported) {
        muxer = new Muxer({target: new ArrayBufferTarget(), video: {codec: 'avc', width, height}, fastStart: 'in-memory'});
        encoder = new VideoEncoder({output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { failure = e; }}); encoder.configure(config);
      } else {
        if (!window.HME) {
          await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = new URL('./vendor/h264.js', import.meta.url).href; script.onload = resolve; script.onerror = () => reject(new Error('MP4-кодировщик не загрузился.')); document.head.append(script); });
        }
        software = await window.HME.createH264MP4Encoder();
        software.width = width; software.height = height; software.frameRate = fps; software.speed = 8; software.quantizationParameter = 23; software.initialize();
      }
    }
    if (zip) { zip.file('settings.json', JSON.stringify({format: 'GrayMansion Effect export', fps, duration, frames: total, settings}, null, 2)); }
    for (let i = 0; i < total; i += 1) {
      if (cancelled()) { status('Экспорт отменён.'); return; }
      if (failure) { throw failure; }
      draw(i / fps, format === 'mp4');
      if (zip) { zip.file(`frame_${String(i).padStart(6, '0')}.png`, await toBlob(canvas)); }
      if (gif) {
        const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data;
        const palette = quantize(pixels, 128, {format: 'rgba4444'});
        const indices = applyPalette(pixels, palette, 'rgba4444');
        const transparentIndex = palette.findIndex(c => c[3] === 0);
        const delay = Math.max(10, (Math.round((i + 1) * 100 / fps) - Math.round(i * 100 / fps)) * 10);
        gif.writeFrame(indices, width, height, {palette, delay, transparent: transparentIndex >= 0, transparentIndex: Math.max(0, transparentIndex), dispose: 2, repeat: 0});
      }
      if (software) { software.addFrameRgba(canvas.getContext('2d').getImageData(0, 0, width, height).data); }
      if (encoder) {
        const frame = new VideoFrame(canvas, {timestamp: Math.round(i * 1000000 / fps), duration: Math.round(1000000 / fps)});
        encoder.encode(frame, {keyFrame: i % (fps * 2) === 0}); frame.close();
        if (encoder.encodeQueueSize > 8) { await encoder.flush(); }
      }
      status(`Экспорт: ${i + 1} / ${total} кадров.`);
      if (i % 3 === 0) { await sleep(); }
    }
    if (zip) { download(await zip.generateAsync({type: 'blob'}), 'effect-png-sequence.zip'); }
    if (gif) { gif.finish(); download(new Blob([gif.bytes()], {type: 'image/gif'}), 'effect.gif'); }
    if (software) { software.finalize(); download(new Blob([software.FS.readFile(software.outputFilename)], {type: 'video/mp4'}), 'effect.mp4'); }
    if (encoder) { await encoder.flush(); if (failure) { throw failure; } muxer.finalize(); download(new Blob([muxer.target.buffer], {type: 'video/mp4'}), 'effect.mp4'); }
    status(`Готово: ${total} кадров, ${(total / fps).toFixed(2)} с. Видео без звука.`);
  } finally { if (encoder && encoder.state !== 'closed') { encoder.close(); } if (software) { software.delete(); } }
}
