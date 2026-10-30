export function textStats(text, needle = '', insensitive = false) {
  const points = [...text];
  const words = [...text.matchAll(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)].map(match => match[0]);
  const counts = new Map();
  for (const word of words) {
    const key = word.toLocaleLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let occurrences = 0;
  const source = insensitive ? text.toLocaleLowerCase() : text;
  const query = insensitive ? needle.toLocaleLowerCase() : needle;
  if (query) {
    let index = source.indexOf(query);
    while (index !== -1) {
      occurrences += 1;
      index = source.indexOf(query, index + query.length);
    }
  }
  let graphemes = 0;
  for (const segment of new Intl.Segmenter('ru', {granularity: 'grapheme'}).segment(text)) { graphemes += 1; }
  return {
    paragraphs: text.trim() ? text.trim().split(/\r?\n\s*\r?\n/u).length : 0,
    lines: text ? text.split(/\r\n|\r|\n/u).length : 0,
    words: words.length, letters: points.filter(char => /\p{L}/u.test(char)).length,
    digits: points.filter(char => /\p{N}/u.test(char)).length,
    spaces: points.filter(char => /\s/u.test(char)).length, characters: points.length,
    graphemes,
    occurrences, frequency: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 100)
  };
}
export const checkRules = [
  {id: 'mixed', name: 'Смешение кириллицы и латиницы', pattern: /\b[a-zа-яё]*[a-z][a-zа-яё]*[а-яё][a-zа-яё]*|[а-яё][a-zа-яё]*[a-z][a-zа-яё]*/giu},
  {id: 'invisible', name: 'Невидимые управляющие символы', pattern: /[\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/gu, replacement: ''},
  {id: 'spaces', name: 'Повторные пробелы', pattern: /[ \t]{2,}/gu, replacement: ' '},
  {id: 'trailing', name: 'Пробелы в конце строки', pattern: /[ \t]+$/gmu, replacement: ''},
  {id: 'punctuation', name: 'Пробел перед знаком препинания', pattern: / +([,.;:!?])/gu, replacement: '$1'},
  {id: 'repeat', name: 'Повтор слова подряд', pattern: /(?<!\p{L})([\p{L}]+)(\s+)\1(?!\p{L})/giu, replacement: '$1'},
  {id: 'newlines', name: 'Лишние пустые строки', pattern: /\n{3,}/gu, replacement: '\n\n'},
  {id: 'quotes', name: 'Прямые парные кавычки', pattern: /"([^"\n]+)"/gu, replacement: '«$1»'},
  {id: 'dash', name: 'Дефис вместо тире между пробелами', pattern: / (?:-|--) /gu, replacement: ' — '}
];
export function checkText(text, selected = checkRules.map(rule => rule.id)) {
  const issues = [];
  for (const rule of checkRules.filter(item => selected.includes(item.id))) {
    for (const match of text.matchAll(new RegExp(rule.pattern))) {
      issues.push({rule: rule.id, name: rule.name, index: match.index, text: match[0], replacement: rule.replacement === undefined ? null : match[0].replace(new RegExp(rule.pattern), rule.replacement)});
      if (issues.length >= 2000) { return issues.sort((a, b) => a.index - b.index); }
    }
  }
  return issues.sort((a, b) => a.index - b.index);
}
export function fixText(text, selected) {
  for (const rule of checkRules.filter(item => selected.includes(item.id) && item.replacement !== undefined)) {
    text = text.replace(new RegExp(rule.pattern), rule.replacement);
  }
  return text;
}
export function splitText(text, mode, amount, delimiter = '') {
  if (mode === 'chapters') {
    return text ? text.split(/(?=^(?:#{1,6} +|Глава +\S|Chapter +\S))/gimu).filter(Boolean) : [''];
  }
  if (mode === 'delimiter') {
    if (!delimiter) { throw new Error('Укажи разделитель.'); }
    return text.split(delimiter);
  }
  if (!Number.isInteger(amount) || amount < 1) { throw new Error('Размер части должен быть целым положительным числом.'); }
  if (mode === 'bytes') {
    const encoder = new TextEncoder(); const parts = []; let part = ''; let size = 0;
    for (const char of text) {
      const bytes = encoder.encode(char).length;
      if (bytes > amount) { throw new Error('Размер части слишком мал для одного символа UTF-8.'); }
      if (size + bytes > amount) { parts.push(part); part = ''; size = 0; }
      part += char; size += bytes;
      if (parts.length >= 10000) { throw new Error('Слишком много частей: увеличь размер.'); }
    }
    if (part || !parts.length) { parts.push(part); }
    return parts;
  }
  const items = mode === 'lines' ? text.split(/(?<=\n)/u) : [...text];
  const result = [];
  for (let i = 0; i < items.length; i += amount) {
    result.push(items.slice(i, i + amount).join(''));
    if (result.length > 10000) { throw new Error('Слишком много частей: увеличь размер.'); }
  }
  return result.length ? result : [''];
}
export function replaceText(text, rules, regex, insensitive, whole) {
  let total = 0;
  for (const [search, replacement] of rules) {
    if (!search) { continue; }
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = whole ? `(?<![\\p{L}\\p{N}_])(?:${regex ? search : escaped})(?![\\p{L}\\p{N}_])` : regex ? search : escaped;
    const expression = new RegExp(pattern, insensitive ? 'giu' : 'gu');
    text = text.replace(expression, (...args) => {
      total += 1;
      if (!regex) { return replacement; }
      const hasGroups = typeof args.at(-1) === 'object';
      const offset = args.at(hasGroups ? -3 : -2);
      const source = args.at(hasGroups ? -2 : -1);
      const captures = args.slice(1, hasGroups ? -3 : -2);
      return replacement.replace(/\$(\$|&|`|'|\d{1,2}|<[^>]+>)/g, (token, key) => {
        if (key === '$') { return '$'; }
        if (key === '&') { return args[0]; }
        if (key === '`') { return source.slice(0, offset); }
        if (key === "'") { return source.slice(offset + args[0].length); }
        if (key.startsWith('<')) { return hasGroups ? args.at(-1)[key.slice(1, -1)] ?? '' : token; }
        return Number(key) > 0 && Number(key) <= captures.length ? captures[Number(key) - 1] ?? '' : token;
      });
    });
  }
  return {text, total};
}
