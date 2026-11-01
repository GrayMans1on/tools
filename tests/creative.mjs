import assert from 'node:assert/strict';
import {seeded, buildParticles, particleAt, pathPoint} from '../tools/effects-core.js';
import {classic, aes, visualEncode, visualDecode, visualAlphabet} from '../tools/cipher-core.js';
import {tools} from '../catalog.js';
import {cardIllustration} from '../illustrations.js';
assert.equal(classic('ſ ı ß', 'caesar', '', false, 3), 'ſ ı ß');
const text = 'Привет, Ёжик! Hello 123 🧩\nНовая строка. e\u0301';
for (const [kind, key] of [['caesar',''], ['atbash',''], ['vigenere','КЛЮЧ'], ['rail','4'], ['columnar','БАНАН'], ['visual',visualAlphabet]]) {
  const encoded = classic(text, kind, key, false, 41);
  assert.equal(classic(encoded, kind, key, true, 41), text, `${kind} round trip`);
}
for (let i = 0; i < 80; i += 1) { const value = [...text].slice(0, i).join(''); assert.equal(visualDecode(visualEncode(value)), value); }
assert.throws(() => visualDecode('○'));
assert.throws(() => visualEncode(text,'AAAA'));
assert.throws(() => classic(text, 'rail', '1'));
const secret = await aes(text, 'пароль 42'); assert.equal(await aes(secret, 'пароль 42', true), text); assert.notEqual(secret, await aes(text, 'пароль 42')); await assert.rejects(aes(secret, 'wrong', true));
const randA = seeded('same'); const randB = seeded('same'); assert.deepEqual(Array.from({length: 100}, randA), Array.from({length: 100}, randB));
const s = {seed:'42',rate:20,burst:10,emission:2,delay:0,lifeMin:1,lifeMax:2,speedMin:10,speedMax:100,sizeMin:2,sizeMax:8,angle:-90,spread:40,radius:20,shape:'cone',x:400,y:300,rotation:50,drag:.2,noise:10,frequency:3,wind:5,gravity:20,scaleStart:0,scaleMid:1,scaleEnd:0,alphaStart:1,alphaMid:.5,alphaEnd:0};
const a = buildParticles(s); assert.equal(a.length,50); assert.deepEqual(a,buildParticles(s)); assert.notDeepEqual(a,buildParticles({...s,seed:'43'}));
assert.equal(particleAt(a[0], -1, s), null); assert.equal(particleAt(a[0], 5, s), null);
const q = particleAt(a[0], .5, s); assert.ok(Number.isFinite(q.x + q.y + q.size)); particleAt(a[0], .7, s); assert.deepEqual(particleAt(a[0],.5,s),q);
assert.deepEqual(pathPoint([{x:0,y:0},{x:1,y:0},{x:1,y:3}],.5),{x:1,y:1});
for (const id of ['particles','strokes','puzzles','ciphers']) { assert.ok(tools.some(t=>t.id===id)); assert.ok(cardIllustration(id).includes('<svg')); }
console.log('Creative tools: classic/Unicode/AES round trips, bad keys, seed determinism, random access, path sampling, catalog passed.');
