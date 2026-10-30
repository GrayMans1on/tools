import { fftPower } from './spectrum-core.js';
self.onmessage = event => {
  try {
    const {samples, sampleRate, start, end, size, width, height, minHz, maxHz, log, floor, palette} = event.data;
    const output = new Uint8ClampedArray(width * height * 4);
    for (let x = 0; x < width; x += 1) {
      const center = Math.round((start + x / Math.max(1, width - 1) * (end - start)) * sampleRate);
      const power = fftPower(samples, Math.max(0, center - size / 2), size);
      for (let y = 0; y < height; y += 1) {
        const ratio = 1 - y / (height - 1); const hz = log ? minHz * (maxHz / minHz) ** ratio : minHz + (maxHz - minHz) * ratio;
        const bin = Math.min(power.length - 1, Math.max(0, Math.round(hz * size / sampleRate)));
        const v = Math.max(0, Math.min(1, (power[bin] - floor) / -floor)); const offset = (y * width + x) * 4;
        const colors = palette === 'gray' ? [v * 255, v * 255, v * 255] : palette === 'ocean' ? [v * 80, v * 210, 30 + v * 225] : [Math.min(255, v * 510), Math.max(0, (v - .35) * 390), 40 + Math.sin(v * Math.PI) * 150];
        output.set([...colors, 255], offset);
      }
      if (x % 100 === 0) { self.postMessage({progress: Math.round(x / width * 100)}); }
    }
    self.postMessage({pixels: output}, [output.buffer]);
  } catch (error) { self.postMessage({error: error.message}); }
};
