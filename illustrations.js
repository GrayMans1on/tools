const ink = '#69728c';
const paper = '#fafbfe';
const text = (x, y, value, size = 10, fill = ink, extra = '') =>
  `<text x="${x}" y="${y}" font-family="Segoe UI,Arial,sans-serif" font-size="${size}" fill="${fill}" ${extra}>${value}</text>`;
const rect = (x, y, w, h, fill = paper, radius = 4, stroke = 'none') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
const line = (x1, y1, x2, y2, stroke = ink, width = 2) =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;
const arrow = (x, y) => `<path d="M${x} ${y}h29m-6-6 6 6-6 6" fill="none" stroke="#9ba3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
const windowFrame = (x, y, w, h) => rect(x, y, w, h, paper, 5, '#bfc6d8') +
  rect(x + 1, y + 1, w - 2, 15, '#e4e7f0', 4) + [0, 1, 2].map(i => rect(x + 8 + i * 7, y + 7, 3, 3, '#a7afc3', 1)).join('');
const sheet = (x, y, label, accent = ink) => `<path d="M${x} ${y}h42l15 15v59h-57z" fill="${paper}" stroke="#b8c0d3" stroke-width="1.5"/><path d="M${x + 42} ${y}v15h15" fill="#e1e5ef" stroke="#b8c0d3" stroke-width="1.5"/>` +
  rect(x + 8, y + 33, 41, 20, accent, 3) + text(x + 28.5, y + 47, label, 10, '#fff', 'text-anchor="middle" font-weight="600"') +
  line(x + 9, y + 63, x + 45, y + 63, '#d7dce8', 2);
const grid = (x, y, w, h, cols, rows) => {
  let output = rect(x, y, w, h, paper, 3, '#b7bfd2') + rect(x + 1, y + 1, w - 2, h / rows - 1, '#b3bdd3', 2);
  for (let i = 1; i < cols; i += 1) { output += line(x + w * i / cols, y, x + w * i / cols, y + h, '#d9deea', 1); }
  for (let i = 1; i < rows; i += 1) { output += line(x, y + h * i / rows, x + w, y + h * i / rows, '#d9deea', 1); }
  return output;
};
const clock = (x, y, radius, hour, label) => {
  const angle = hour * Math.PI / 6 - Math.PI / 2;
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${paper}" stroke="#a8b1c8" stroke-width="2"/>` +
    [0, 1, 2, 3].map(i => { const a = i * Math.PI / 2; return line(x + Math.cos(a) * (radius - 5), y + Math.sin(a) * (radius - 5), x + Math.cos(a) * (radius - 2), y + Math.sin(a) * (radius - 2), '#b2bbce', 1.5); }).join('') +
    line(x, y, x + Math.cos(angle) * radius * .48, y + Math.sin(angle) * radius * .48, ink, 2.7) +
    line(x, y, x + radius * .4, y - radius * .4, '#8f9bb6', 2) +
    `<circle cx="${x}" cy="${y}" r="2.5" fill="${ink}"/>` + text(x, y + radius + 18, label, 9, '#8c95ab', 'text-anchor="middle" letter-spacing="1"');
};
const miniApp = (x, y, size) => rect(x, y, size, size, '#73819f', size / 5) +
  rect(x + size * .23, y + size * .23, size * .24, size * .24, '#dfe6f5', 1) +
  rect(x + size * .53, y + size * .23, size * .24, size * .24, '#b7c6d8', 1) +
  rect(x + size * .23, y + size * .53, size * .24, size * .24, '#b7c6d8', 1) +
  rect(x + size * .53, y + size * .53, size * .24, size * .24, '#dfe6f5', 1);

function segmentDigit(x, y, digit) {
  const masks = {0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgecd', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd'};
  const coords = {a: [5, 0, 23, 4], b: [29, 6, 4, 24], c: [29, 36, 4, 24], d: [5, 62, 23, 4], e: [0, 36, 4, 24], f: [0, 6, 4, 24], g: [5, 31, 23, 4]};
  return Object.entries(coords).map(([key, v]) => rect(x + v[0], y + v[1], v[2], v[3], masks[digit].includes(key) ? '#a3cfb8' : '#394e49', 1)).join('');
}
function qrPattern(x, y, cell = 3) {
  let output = rect(x - 8, y - 8, 21 * cell + 16, 21 * cell + 16, paper, 4, '#bdc6d8');
  function finder(cx, cy) {
    return rect(x + cx * cell, y + cy * cell, 7 * cell, 7 * cell, ink, 0) +
      rect(x + (cx + 1) * cell, y + (cy + 1) * cell, 5 * cell, 5 * cell, paper, 0) +
      rect(x + (cx + 2) * cell, y + (cy + 2) * cell, 3 * cell, 3 * cell, ink, 0);
  }
  for (let row = 0; row < 21; row += 1) {
    for (let col = 0; col < 21; col += 1) {
      if ((col < 8 && row < 8) || (col > 12 && row < 8) || (col < 8 && row > 12)) { continue; }
      if ((row * 17 + col * 11 + row * col) % 7 < 3) { output += rect(x + col * cell, y + row * cell, cell, cell, ink, 0); }
    }
  }
  return output + finder(0, 0) + finder(14, 0) + finder(0, 14);
}

const pictures = {
  palette: () => {
    const colors = ['#4e6078', '#869eb3', '#bdc8d4', '#9dbba8', '#e1c9a8'];
    return windowFrame(38, 44, 100, 77) + rect(46, 66, 84, 47, '#c4d0df', 2) +
      `<circle cx="111" cy="77" r="6" fill="#e8dcc7"/><path d="M46 113V99l24-22 27 26 17-11 16 21" fill="#71869d"/><path d="m46 113 35-29 35 29" fill="#96b6a6"/>` +
      arrow(150, 84) + colors.map((color, i) => rect(196 + i * 15, 58, 15, 49, color, 0)).join('') +
      colors.map((color, i) => rect(196 + i * 15, 113, 10, 3, color, 1)).join('') + text(232, 136, 'HEX  /  RGB', 8, '#919aaf', 'text-anchor="middle" letter-spacing="1"');
  },
  converter: () => sheet(62, 47, 'PNG', '#8999b4') + arrow(146, 84) + sheet(199, 47, 'WEBP', '#8eaf9f') +
    text(160, 143, 'ФАЙЛ → НОВЫЙ ФОРМАТ', 8, '#939bb0', 'text-anchor="middle" letter-spacing="1"'),
  segments: () => rect(53, 43, 214, 91, '#273833', 7) + rect(59, 49, 202, 79, '#2d403a', 4) +
    segmentDigit(73, 56, 1) + segmentDigit(118, 56, 2) + segmentDigit(173, 56, 4) + segmentDigit(218, 56, 8) +
    rect(162, 76, 4, 4, '#a3cfb8', 1) + rect(162, 102, 4, 4, '#a3cfb8', 1),
  json: () => windowFrame(54, 40, 212, 100) + text(70, 78, '{', 24, '#8999b4', 'font-family="monospace"') +
    text(89, 78, '"name"', 12, '#7a8eaf', 'font-family="monospace"') + text(139, 78, ': "tools",', 12, '#8ea696', 'font-family="monospace"') +
    text(89, 98, '"ready"', 12, '#7a8eaf', 'font-family="monospace"') + text(146, 98, ': true', 12, '#8ea696', 'font-family="monospace"') + text(70, 122, '}', 24, '#8999b4', 'font-family="monospace"') +
    `<circle cx="247" cy="126" r="15" fill="#a3bfae"/><path d="m240 126 5 5 9-10" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  tables: () => grid(40, 53, 91, 69, 4, 5) + rect(63, 81, 23, 14, '#d7e5dc', 0) + arrow(146, 86) +
    grid(193, 53, 91, 69, 4, 5) + rect(194, 54, 89, 12, '#9eb9aa', 1) +
    text(84, 140, 'CSV / JSON', 8, '#909aaf', 'text-anchor="middle" letter-spacing=".7"') + text(238, 140, 'XLSX / TSV', 8, '#909aaf', 'text-anchor="middle" letter-spacing=".7"'),
  audio: () => {
    const heights = [7, 14, 24, 15, 32, 47, 28, 52, 36, 18, 42, 58, 34, 46, 23, 14, 31, 18, 8, 13, 7];
    return windowFrame(33, 43, 254, 92) + rect(96, 65, 119, 55, '#e0e8e4', 2) +
      heights.map((h, i) => rect(49 + i * 10.6, 91 - h / 2, 4, h, i > 3 && i < 16 ? '#7b9c8b' : '#adb6ca', 2)).join('') +
      line(96, 65, 96, 120, '#749583', 2) + line(215, 65, 215, 120, '#749583', 2) +
      rect(92, 61, 8, 8, '#749583', 2) + rect(211, 61, 8, 8, '#749583', 2) +
      line(106, 148, 214, 148, '#bfc6d7', 2) + `<circle cx="170" cy="148" r="4" fill="#7f8eaa"/>`;
  },
  animation: () => {
    let output = '';
    [0, 1, 2].forEach(i => {
      output += rect(36 + i * 91, 54, 77, 60, paper, 4, '#c0c7d8');
      output += text(74 + i * 91, 94 - (2 - i) * 3, 'Aa', 27, ['#d8dce7', '#a6afc4', '#707d99'][i], 'text-anchor="middle" font-weight="600"');
      if (i < 2) { output += text(122 + i * 91, 90, '›', 18, '#a6aec1'); }
    });
    return output + line(44, 137, 280, 137, '#c2c9d9', 2) + rect(44, 131, 41, 12, '#d3dce9', 2) +
      rect(90, 131, 90, 12, '#b8c5d8', 2) + rect(185, 131, 95, 12, '#a3b8ac', 2) + line(191, 126, 191, 149, ink, 2);
  },
  qr: () => qrPattern(59, 59, 3) + arrow(149, 87) + rect(209, 39, 54, 106, '#818da7', 8) +
    rect(214, 46, 44, 90, paper, 4) + rect(229, 49, 14, 3, '#b6bfd2', 2) +
    `<path d="M223 76v-8h8m18 8v-8h-8m-18 33v8h8m18-8v8h-8" fill="none" stroke="#93afa0" stroke-width="2"/>` +
    rect(226, 79, 18, 18, '#dbe3ee', 1) + line(219, 87, 253, 87, '#88ab97', 1.5),
  clocks: () => clock(69, 85, 28, 9, 'LONDON') + clock(160, 78, 36, 12, 'МОСКВА') + clock(251, 85, 28, 6, 'TOKYO'),
  dates: () => rect(53, 48, 86, 81, paper, 5, '#bdc5d8') + rect(54, 49, 84, 21, '#adb9d0', 4) +
    [72, 118].map(x => line(x, 42, x, 57, ink, 4)).join('') + text(96, 106, '15', 29, ink, 'text-anchor="middle" font-weight="600"') +
    arrow(155, 88) + text(234, 86, '12', 37, '#7d8ca8', 'text-anchor="middle" font-weight="600"') +
    text(234, 108, 'ДНЕЙ', 9, '#939db2', 'text-anchor="middle" letter-spacing="2"') +
    line(205, 120, 262, 120, '#d0d7e4', 2),
  random: () => {
    let output = `<g transform="rotate(-10 97 88)">${rect(62, 53, 69, 69, paper, 9, '#a9b5cd')}`;
    for (const [x, y] of [[79, 70], [114, 70], [96, 87], [79, 105], [114, 105]]) { output += `<circle cx="${x}" cy="${y}" r="4.5" fill="#8392ad"/>`; }
    return output + '</g>' + arrow(150, 86) + [0, 1, 2].map(i => rect(200, 49 + i * 27, 72, 22, i === 1 ? '#dce8df' : paper, 4, i === 1 ? '#9eb7a7' : '#c6cddd') +
      text(216, 64 + i * 27, ['A', 'B', 'C'][i], 11, '#8b96ac') + line(233, 60 + i * 27, 260, 60 + i * 27, i === 1 ? '#8da695' : '#c1c9da', 2)).join('');
  },
  devices: () => {
    let output = rect(37, 67, 155, 63, paper, 6, '#b8c2d7');
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 10; col += 1) { output += rect(46 + col * 14, 76 + row * 13, 10, 9, row === 1 && [3, 4, 5].includes(col) ? '#a3bcac' : '#dde2ee', 2); }
    }
    return output + rect(82, 117, 66, 6, '#c5cede', 2) + rect(214, 63, 37, 67, paper, 18, '#aebbd1') +
      line(232.5, 65, 232.5, 91, '#bbc5d8', 1.5) + rect(230, 72, 5, 12, '#93a5bf', 2) +
      `<path d="M86 53v-6a16 16 0 0 1 32 0v6m-32-6v12h7V47m25 0v12h-7V47" fill="none" stroke="#9aa9c2" stroke-width="3"/>`;
  },
  icons: () => miniApp(47, 56, 62) + arrow(124, 86) + miniApp(173, 45, 48) + miniApp(231, 59, 32) + miniApp(273, 75, 16) +
    text(197, 112, '48', 8, '#939db1', 'text-anchor="middle"') + text(247, 112, '32', 8, '#939db1', 'text-anchor="middle"') + text(281, 112, '16', 8, '#939db1', 'text-anchor="middle"') +
    line(173, 130, 288, 130, '#c2cbdb', 1) + text(231, 146, 'PNG + ICO', 8, '#929bb0', 'text-anchor="middle" letter-spacing="1"'),
  prompter: () => rect(55, 40, 211, 99, '#3b4257', 6) + rect(62, 47, 197, 85, '#454e65', 3) +
    [0, 1, 2, 3, 4].map(i => rect(90 + (i === 0 ? 8 : 0), 57 + i * 14, [125, 143, 137, 128, 96][i], 4, i === 2 ? '#d3e5d9' : '#8390aa', 2)).join('') +
    `<path d="m71 80 7 7-7 7" fill="none" stroke="#b5d0bf" stroke-width="2"/>` +
    line(77, 87, 245, 87, '#b5d0bf', 1) + rect(145, 140, 31, 5, '#abb6cb', 2) + line(160, 145, 160, 155, '#abb6cb', 3),
  layout: () => rect(36, 59, 102, 57, paper, 7, '#c0c8da') + rect(42, 64, 90, 45, '#f3f5fa', 4) +
    text(87, 93, 'Ghbdtn', 16, '#8b96af', 'text-anchor="middle"') + arrow(146, 87) +
    rect(194, 59, 102, 57, '#eaf0ec', 7, '#afc3b5') + text(245, 93, 'Привет', 16, '#728d7d', 'text-anchor="middle"') +
    text(87, 137, 'EN', 8, '#939db1', 'text-anchor="middle" letter-spacing="1"') + text(245, 137, 'RU', 8, '#8aa291', 'text-anchor="middle" letter-spacing="1"')
};

export function cardIllustration(id) {
  const content = pictures[id];
  if (!content) { return ''; }
  return `<svg viewBox="0 0 320 172" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${content()}</svg>`;
}
