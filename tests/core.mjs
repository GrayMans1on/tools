import assert from 'node:assert/strict';
import { parseDelimited, writeDelimited, convertLayout, randomInt, shuffle, diffJSON } from '../tools/logic.js';
import { wav, processAudio } from '../tools/audio-core.js';

// ImageData is referenced by the browser-only ICO decoder at module initialization.
global.ImageData = class ImageData {};
try {
  const rows = [['Имя', 'Код', 'Текст'], ['Влад', '0012', 'Первая\nВторая'], ['a,b', '"цитата"', '']];
  assert.deepEqual(parseDelimited(writeDelimited(rows)), rows);
  assert.throws(() => parseDelimited('"unfinished'));
  assert.equal(convertLayout('Ghbdtn? vbh!'), 'Привет, мир!');
  assert.equal(convertLayout('Привет, мир!', true), 'Ghbdtn? vbh!');
  assert.equal(diffJSON({a: 1}, {a: 2}).length, 1);
  assert.equal(diffJSON({}, {a: null})[0].added, null);
  assert.equal(diffJSON({a: null}, {})[0].removed, null);
  for (let i = 0; i < 1000; i += 1) { assert.ok([1, 2, 3].includes(randomInt(1, 3))); }
  assert.deepEqual([...shuffle([1, 2, 3])].sort(), [1, 2, 3]);
  const rate = 44100;
  const raw = Float32Array.from({length: rate}, (_, i) => Math.sin(i * 440 * 2 * Math.PI / rate) * .2);
  const fake = {sampleRate: rate, length: rate, duration: 1, numberOfChannels: 2, getChannelData: i => i ? raw.map(x => x * .5) : raw};
  const a = await processAudio(fake, {gain: 6.020599913, start: .25, end: .75, channel: 'mono'});
  assert.equal(a.channels.length, 1);
  assert.equal(a.channels[0].length, 22050);
  assert.ok(Math.abs(a.peak - .3) < .001);
  const b = await processAudio(fake, {tempo: 2, end: 1});
  assert.ok(b.channels[0].length > rate * .4 && b.channels[0].length < rate * .6, `Tempo output: ${b.channels[0].length}`);
  const blob = wav([raw], rate);
  const view = new DataView(await blob.arrayBuffer());
  assert.equal(view.getUint32(40, true), rate * 2);
  assert.equal(view.getUint16(22, true), 1);
  const {XLSX, QRCode, quantize, applyPalette, GIFEncoder} = await import('../tools/vendor/vendor.js');
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Data');
  const encoded = XLSX.write(book, {type: 'array', bookType: 'xlsx'});
  const decoded = XLSX.read(encoded);
  assert.deepEqual(XLSX.utils.sheet_to_json(decoded.Sheets.Data, {header: 1, raw: false, defval: ''}), rows);
  assert.ok(QRCode.create('Привет, мир!').modules.size > 0);
  const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255]);
  const palette = quantize(pixels, 2);
  assert.equal(palette.length, 2);
  const indices = applyPalette(pixels, palette);
  assert.equal(indices[0], indices[2]);
  const gif = GIFEncoder();
  gif.writeFrame(indices, 2, 2, {palette, delay: 100});
  gif.finish();
  assert.equal(new TextDecoder().decode(gif.bytes().slice(0, 6)), 'GIF89a');
  console.log('PASS: CSV, layout roundtrip, JSON diff, randomness, WAV, gain/trim/mono/tempo, XLSX roundtrip, QR, palette and GIF.');
} catch (error) {
  console.error(`${error.name}: ${error.message}`);
  process.exitCode = 1;
}
