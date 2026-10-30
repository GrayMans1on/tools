export function parseDelimited(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (quoted || field.length === 0) {
        quoted = !quoted;
      } else {
        field += char;
      }
    } else if (char === delimiter && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (quoted) {
    throw new Error('Незакрытая кавычка в таблице.');
  }
  if (field.length || row.length || (!rows.length && source.length)) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
export function writeDelimited(rows, delimiter = ',') {
  return rows.map(row => row.map(value => {
    const text = String(value ?? '');
    return text.includes(delimiter) || /["\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(delimiter)).join('\r\n');
}
const english = '`qwertyuiop[]asdfghjkl;\'zxcvbnm,./~QWERTYUIOP{}ASDFGHJKL:"ZXCVBNM<>?';
const russian = 'ёйцукенгшщзхъфывапролджэячсмитьбю.ЁЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ,';
export function convertLayout(text, reverse = false) {
  const source = reverse ? russian : english;
  const target = reverse ? english : russian;
  return [...text].map(char => {
    const index = source.indexOf(char);
    return index < 0 ? char : target[index];
  }).join('');
}
export function randomInt(min, max) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min || max - min >= 4294967296) {
    throw new Error('Укажи целые границы; диапазон — не более 2³² значений.');
  }
  const range = max - min + 1;
  const limit = Math.floor(4294967296 / range) * range;
  const value = new Uint32Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);
  return min + value[0] % range;
}
export function shuffle(list) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const index = randomInt(0, i);
    [result[i], result[index]] = [result[index], result[i]];
  }
  return result;
}
export function diffJSON(left, right, path = '$', changes = []) {
  if (changes.length >= 2000) {
    return changes;
  }
  if (Object.is(left, right)) {
    return changes;
  }
  const objects = left !== null && right !== null && typeof left === 'object' && typeof right === 'object';
  if (!objects || Array.isArray(left) !== Array.isArray(right)) {
    changes.push({path, before: left, after: right});
    return changes;
  }
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (changes.length >= 2000) { break; }
    const location = `${path}[${JSON.stringify(key)}]`;
    if (!Object.hasOwn(left, key)) {
      changes.push({path: location, added: right[key]});
    } else if (!Object.hasOwn(right, key)) {
      changes.push({path: location, removed: left[key]});
    } else {
      diffJSON(left[key], right[key], location, changes);
    }
  }
  return changes;
}
