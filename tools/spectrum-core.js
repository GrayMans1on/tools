export function fftPower(samples, offset, size) {
  const re = new Float64Array(size); const im = new Float64Array(size);
  for (let i = 0; i < size; i += 1) { re[i] = (samples[offset + i] || 0) * (.5 - .5 * Math.cos(2 * Math.PI * i / (size - 1))); }
  for (let i = 1, j = 0; i < size; i += 1) {
    let bit = size >> 1;
    while (j & bit) { j ^= bit; bit >>= 1; }
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = -2 * Math.PI / length; const wr = Math.cos(angle); const wi = Math.sin(angle);
    for (let start = 0; start < size; start += length) {
      let ur = 1; let ui = 0;
      for (let j = 0; j < length / 2; j += 1) {
        const a = start + j; const b = a + length / 2;
        const tr = re[b] * ur - im[b] * ui; const ti = re[b] * ui + im[b] * ur;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const next = ur * wr - ui * wi; ui = ur * wi + ui * wr; ur = next;
      }
    }
  }
  return Float32Array.from(re.slice(0, size / 2), (value, i) => 20 * Math.log10(Math.max(1e-8, Math.hypot(value, im[i]) * 4 / size)));
}
