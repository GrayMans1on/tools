export const alphabets = ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'];
export const visualAlphabet = '○●◐◑◒◓◔◕□■▣▤▥▦▧▨△▲▽▼◁◀▷▶◇◆◈⬡⬢☆★✦';
const mod = (n, m) => ((n % m) + m) % m;
function letters(text, fn) {
  return [...text].map(char => {
    const upper = char.toUpperCase(); const alphabet = alphabets.find(a => (a.includes(char) || a.toLowerCase().includes(char)) && [...upper].length === 1);
    if (!alphabet) { return char; }
    const next = fn(alphabet.indexOf(upper), alphabet);
    return char === upper ? next : next.toLowerCase();
  }).join('');
}
export function caesar(text, shift) {
  if (!Number.isSafeInteger(shift)) { throw new Error('Сдвиг — целое число.'); }
  return letters(text, (i, a) => a[mod(i + shift, a.length)]);
}
export function atbash(text) { return letters(text, (i, a) => a[a.length - 1 - i]); }
export function vigenere(text, key, decrypt = false) {
  const keys = [...key.toUpperCase()].filter(c => alphabets.some(a => a.includes(c)));
  if (!keys.length) { throw new Error('Ключ Виженера должен содержать русские или латинские буквы.'); }
  let index = 0;
  return letters(text, (i, a) => {
    const c = keys[index++ % keys.length]; const source = alphabets.find(v => v.includes(c)); const shift = source.indexOf(c);
    return a[mod(i + shift * (decrypt ? -1 : 1), a.length)];
  });
}
export function railFence(text, rails, decrypt = false) {
  if (!Number.isInteger(rails) || rails < 2 || rails > 100) { throw new Error('Число рельсов — от 2 до 100.'); }
  const chars = [...text]; const route = chars.map((_, i) => { const t = i % (rails * 2 - 2); return t < rails ? t : rails * 2 - 2 - t; });
  if (!decrypt) { const rows = Array.from({length: rails}, () => []); chars.forEach((c, i) => rows[route[i]].push(c)); return rows.flat().join(''); }
  const counts = Array(rails).fill(0); route.forEach(r => { counts[r] += 1; });
  let offset = 0; const rows = counts.map(n => { const row = chars.slice(offset, offset + n); offset += n; return row; }); const heads = Array(rails).fill(0);
  return route.map(r => rows[r][heads[r]++]).join('');
}
export function columnar(text, key, decrypt = false) {
  const cols = [...key]; if (cols.length < 2 || cols.length > 100) { throw new Error('Ключ перестановки — от 2 до 100 символов.'); }
  const order = cols.map((c, i) => ({c, i})).sort((a, b) => a.c.codePointAt(0) - b.c.codePointAt(0) || a.i - b.i).map(v => v.i);
  const chars = [...text]; const rows = Array.from({length: cols.length}, () => []);
  if (!decrypt) { chars.forEach((c, i) => rows[i % cols.length].push(c)); return order.map(i => rows[i].join('')).join(''); }
  let offset = 0;
  for (const i of order) { const n = Math.floor(chars.length / cols.length) + (i < chars.length % cols.length ? 1 : 0); rows[i] = chars.slice(offset, offset + n); offset += n; }
  return chars.map((_, i) => rows[i % cols.length][Math.floor(i / cols.length)]).join('');
}
function symbols(key) {
  const chars = [...key]; if (chars.length !== 32 || new Set(chars).size !== 32 || chars.some(c => /\s/u.test(c))) { throw new Error('Визуальный алфавит: ровно 32 разных символа без пробелов.'); }
  return chars;
}
export function visualEncode(text, key = visualAlphabet) {
  const chars = symbols(key); const bytes = new TextEncoder().encode(text); let value = 0; let bits = 0; let out = '';
  for (const b of bytes) { value = (value << 8) | b; bits += 8; while (bits >= 5) { bits -= 5; out += chars[(value >>> bits) & 31]; } }
  if (bits) { out += chars[(value << (5 - bits)) & 31]; }
  return out;
}
export function visualDecode(text, key = visualAlphabet) {
  const chars = symbols(key); let value = 0; let bits = 0; const bytes = [];
  const input = [...text].filter(c => !/\s/u.test(c));
  for (const c of input) { const i = chars.indexOf(c); if (i < 0) { throw new Error(`Символ «${c}» отсутствует в ключе.`); } value = (value << 5) | i; bits += 5; if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 255); } }
  if ([1, 3, 6].includes(input.length % 8) || (value & ((1 << bits) - 1))) { throw new Error('Неполный или повреждённый визуальный код.'); }
  return new TextDecoder('utf-8', {fatal: true}).decode(new Uint8Array(bytes));
}
export function classic(text, kind, key, decrypt = false, shift = 3) {
  if (text.length > 1000000) { throw new Error('Текст — до 1 млн символов.'); }
  if (kind === 'caesar') { return caesar(text, shift * (decrypt ? -1 : 1)); }
  if (kind === 'atbash') { return atbash(text); }
  if (kind === 'vigenere') { return vigenere(text, key, decrypt); }
  if (kind === 'rail') { return railFence(text, Number(key), decrypt); }
  if (kind === 'columnar') { return columnar(text, key, decrypt); }
  if (kind === 'visual') { return decrypt ? visualDecode(text, key) : visualEncode(text, key); }
  throw new Error('Неизвестный шифр.');
}
const b64 = bytes => { let out = ''; for (const byte of bytes) { out += String.fromCharCode(byte); } return btoa(out); };
async function aesKey(password, salt) {
  if (!password || password.length > 10000) { throw new Error('Укажи пароль длиной до 10 000 символов.'); }
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256'}, material, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
export async function aes(text, password, decrypt = false) {
  if (!crypto.subtle) { throw new Error('AES требует HTTPS и Web Crypto.'); }
  if (text.length > 2000000) { throw new Error('Текст — до 2 млн символов.'); }
  if (decrypt) {
    const parts = text.trim().split('.');
    if (parts.length !== 4 || parts[0] !== 'GM1') { throw new Error('Ожидается пакет GM1.salt.iv.data.'); }
    try {
      const data = parts.slice(1).map(p => Uint8Array.from(atob(p), c => c.charCodeAt(0)));
      if (data[0].length !== 16 || data[1].length !== 12 || data[2].length < 16) { throw new Error(); }
      const key = await aesKey(password, data[0]); const plain = await crypto.subtle.decrypt({name: 'AES-GCM', iv: data[1]}, key, data[2]);
      return new TextDecoder('utf-8', {fatal: true}).decode(plain);
    } catch { throw new Error('Не удалось расшифровать: неверный пароль или повреждённый пакет.'); }
  }
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12)); const key = await aesKey(password, salt);
  const data = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, new TextEncoder().encode(text));
  return `GM1.${b64(salt)}.${b64(iv)}.${b64(new Uint8Array(data))}`;
}
