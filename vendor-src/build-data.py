import json
import pathlib
import unicodedata

root = pathlib.Path(__file__).resolve().parent.parent
packages = pathlib.Path(__file__).resolve().parent / 'node_modules'
output = root / 'tools' / 'data'
output.mkdir(exist_ok=True)
if unicodedata.unidata_version != '14.0.0':
    raise RuntimeError('Use Python with Unicode 14.0.0 for reproducible Unicode data.')
parts = {}
ranges = []
for cp in range(0x110000):
    name = unicodedata.name(chr(cp), '')
    if not name:
        continue
    prefix = next((value for value in ['CJK UNIFIED IDEOGRAPH-', 'CJK COMPATIBILITY IDEOGRAPH-'] if name.startswith(value)), None)
    if prefix:
        if ranges and ranges[-1][1] == cp - 1 and ranges[-1][2] == prefix:
            ranges[-1][1] = cp
        else:
            ranges.append([cp, cp, prefix])
        continue
    if name.startswith('HANGUL SYLLABLE '):
        continue
    parts.setdefault(cp >> 12, []).append([cp, name, unicodedata.category(chr(cp))])
for key, rows in parts.items():
    (output / f'unicode-{key:x}.json').write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
(output / 'unicode-meta.json').write_text(json.dumps({'version': unicodedata.unidata_version, 'parts': list(parts), 'ranges': ranges}), encoding='utf-8')

def flatten(items):
    result = []
    for item in items:
        result.append(item)
        result.extend(flatten(item.get('skins', [])))
    return result

ru = flatten(json.loads((packages / 'emojibase-data/ru/data.json').read_text(encoding='utf-8')))
en = {item['hexcode']: item for item in flatten(json.loads((packages / 'emojibase-data/en/data.json').read_text(encoding='utf-8')))}
extra = {'1F634': 'устал спать сон усталость tired sleep', '1F971': 'устал сон зевать tired', '1F917': 'поддержка обнять объятия hugs support', '1F389': 'праздник поздравление party celebration', '1F63A': 'кот кошка cat', '1F431': 'кот кошка cat', '1F62C': 'неловко awkward', '1F44D': 'поддержка хорошо да support yes'}
rows = []
for item in ru:
    eng = en.get(item['hexcode'], {})
    keywords = [item.get('label', ''), eng.get('label', ''), *item.get('tags', []), *eng.get('tags', []), extra.get(item['hexcode'], '')]
    rows.append({'char': item.get('emoji', item.get('text', '')), 'label': item.get('label', ''), 'keywords': ' '.join(keywords)})
(output / 'emoji.json').write_text(json.dumps([item for item in rows if item['char']], ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
