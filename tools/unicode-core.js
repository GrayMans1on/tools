const cache = new Map();
let metadata;
const meta = () => metadata ??= fetch('./data/unicode-meta.json').then(response => response.json());
export const unicodeBlocks = [
  ['Основная латиница', 0x20, 0x7e], ['Латиница и диакритика', 0xa0, 0x24f], ['Кириллица', 0x400, 0x52f],
  ['Греческие', 0x370, 0x3ff], ['Пунктуация и пробелы', 0x2000, 0x206f], ['Валюты', 0x20a0, 0x20cf],
  ['Стрелки', 0x2190, 0x21ff], ['Математика', 0x2200, 0x22ff], ['Технические', 0x2300, 0x23ff],
  ['Рамки', 0x2500, 0x257f], ['Блоки', 0x2580, 0x259f], ['Геометрия', 0x25a0, 0x25ff],
  ['Знаки', 0x2600, 0x26ff], ['Декоративные', 0x2700, 0x27bf], ['Дополнительные стрелки', 0x2900, 0x297f],
  ['Брайль', 0x2800, 0x28ff], ['Музыкальные', 0x1d100, 0x1d1ff], ['Математические буквы', 0x1d400, 0x1d7ff]
];
export async function unicodeInfo(cp) {
  const key = cp >> 12;
  if (!cache.has(key)) {
    cache.set(key, fetch(`./data/unicode-${key.toString(16)}.json`).then(response => response.ok ? response.json() : []).then(rows => new Map(rows.map(row => [row[0], row]))));
  }
  const row = (await cache.get(key)).get(cp);
  if (row) { return {name: row[1], category: row[2]}; }
  const range = (await meta()).ranges.find(([start, end]) => cp >= start && cp <= end);
  if (range) { return {name: `${range[2]}${cp.toString(16).toUpperCase()}`, category: 'Lo'}; }
  if (cp >= 0xac00 && cp <= 0xd7a3) {
    const index = cp - 0xac00;
    const l = ['G','GG','N','D','DD','R','M','B','BB','S','SS','','J','JJ','C','K','T','P','H'];
    const v = ['A','AE','YA','YAE','EO','E','YEO','YE','O','WA','WAE','OE','YO','U','WEO','WE','WI','YU','EU','YI','I'];
    const t = ['','G','GG','GS','N','NJ','NH','D','L','LG','LM','LB','LS','LT','LP','LH','M','B','BS','S','SS','NG','J','C','K','T','P','H'];
    return {name: `HANGUL SYLLABLE ${l[Math.floor(index / 588)]}${v[Math.floor(index % 588 / 28)]}${t[index % 28]}`, category: 'Lo'};
  }
  return {name: cp < 32 || cp >= 127 && cp <= 159 ? 'CONTROL CHARACTER' : 'Нет имени в базе Unicode 14', category: cp < 32 || cp >= 127 && cp <= 159 ? 'Cc' : '—'};
}
export const code = cp => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
