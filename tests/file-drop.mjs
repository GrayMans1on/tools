import assert from 'node:assert/strict';
import {acceptsFile, selectDroppedFiles, enhanceFileDrops} from '../tools/file-drop.js';
const file = (name, type = '', size = 123) => ({name, type, size});
const png = file('Тест.PNG'); const wav = file('sample.wav'); const txt = file('notes.txt', 'text/plain');
assert(acceptsFile(png, 'image/*'));
assert(acceptsFile(png, 'image/png'));
assert(acceptsFile(wav, 'audio/*'));
assert(acceptsFile(txt, '.TXT, application/json'));
assert(acceptsFile(file('random.bin'), ''));
assert(!acceptsFile(txt, 'image/*,.ico'));
assert(!acceptsFile(file('image.png.exe'), '.png'));
assert.deepEqual(selectDroppedFiles([txt, png, wav], 'image/*,audio/*', true), {files:[png,wav], rejected:[txt], excess:false});
assert.deepEqual(selectDroppedFiles([txt, png, wav], 'image/*,audio/*', false), {files:[png], rejected:[txt], excess:true});

// Exercise the drop controller while preserving the same change handlers used by tools.
class Element {
  constructor() {
    this.children = []; this.listeners = {}; this.dataset = {}; this.classes = new Set();
    this.classList = {add: name => this.classes.add(name), remove: name => this.classes.delete(name),
      toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name)};
  }
  set innerHTML(value) { this.parts = {'strong':new Element(), '.file-drop-formats':new Element(), '.file-drop-hint':new Element()}; }
  querySelector(selector) { return this.parts[selector]; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute() {}
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  dispatchEvent(event) { for (const fn of this.listeners[event.type] || []) { fn(event); } }
}
globalThis.document = {createElement: () => new Element()};
globalThis.window = {addEventListener() {}};
globalThis.MutationObserver = class {observe() {} disconnect() {}};
globalThis.DataTransfer = class {
  constructor() { this.files = []; this.items = {add: file => this.files.push(file)}; }
};
const zone = new Element(); zone.childNodes = [];
const input = new Element(); input.files = []; input.multiple = true; input.accept = 'image/*';
input.closest = () => zone; input.matches = () => Boolean(input.disabled);
const root = {querySelectorAll: () => [input]};
let changes = 0;
input.addEventListener('change', () => { changes += 1; });
enhanceFileDrops(root); enhanceFileDrops(root);
assert.equal(zone.listeners.drop.length, 1, 'Dynamic rescans must not bind twice');
const drag = (type, files = []) => ({type, dataTransfer:{types:['Files'], files}, preventDefault() {}, stopPropagation() {}});
zone.dispatchEvent(drag('dragenter')); zone.dispatchEvent(drag('dragenter'));
zone.dispatchEvent(drag('dragleave')); assert(zone.classes.has('is-dragover'));
zone.dispatchEvent(drag('dragleave')); assert(!zone.classes.has('is-dragover'));
zone.dispatchEvent(drag('drop', [png,txt]));
assert.deepEqual(input.files, [png]); assert.equal(changes, 1);
assert(zone.children.at(-1).textContent.includes('notes.txt'));
input.disabled = true; zone.dispatchEvent(drag('drop', [wav]));
assert.equal(changes, 1); assert.deepEqual(input.files, [png]);
input.disabled = false; input.accept = 'audio/*'; input.multiple = false;
zone.dispatchEvent(drag('drop', [wav, file('two.mp3')]));
assert.deepEqual(input.files, [wav]); assert.equal(changes, 2);
assert(zone.children.at(-1).textContent.includes('один файл'));
zone.dispatchEvent(drag('drop', [txt]));
assert.deepEqual(input.files, [wav]); assert.equal(changes, 2, 'Rejected drops preserve the previous selection');
zone.dispatchEvent(drag('drop', []));
assert(zone.children.at(-1).textContent.includes('папку'));
console.log('File upload filters and drop/change controller: passed');
