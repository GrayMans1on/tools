# GrayMansion Tools

Публичные инструменты для разработки и творчества.

**Сайт:** https://graymans1on.github.io/tools/

## Инструменты

- **Pixel Upscaler** — пакетное увеличение пиксель-арта в 1–100 раз методом ближайшего соседа. Один файл сохраняется в PNG, несколько — в ZIP. Обработка происходит локально в браузере.

## Разработка

Статический HTML, CSS и JavaScript без сборки, внешних библиотек и API. Для локального просмотра запустите `python3 -m http.server 8000` из корня проекта.

- `index.html` — главная и навигация.
- `styles.css` — адаптивный интерфейс.
- `app.js` — переключение страниц через hash URL.
- `tools/pixel-nearest.html` — самостоятельный апскейлер.

Каталог и навигация строятся из `catalog.js`. Новые страницы подключаются через `tools/workbench.js` и модули в `tools/modules/`.

## Публикация

GitHub Actions публикует сайт после изменений в `main`. В Settings → Pages должен быть выбран источник **GitHub Actions**. Workflow также пытается включить Pages автоматически, если права репозитория позволяют.

## Инструменты v0.4

Каталог содержит 16 инструментов: Pixel Upscaler, палитра, конвертер файлов, сегментный текст, JSON, таблицы, аудио, анимация текста, QR, часы, отсчёты дат, рандомайзер, тестеры устройств, иконки, суфлёр и исправление раскладки.

Обработка выполняется в браузере. Камера и микрофон включаются только кнопкой пользователя. Загрузка семейства Google Fonts обращается к Google за шрифтом; текст сцены не передаётся.

### Поддержка экспорта

- Изображения: PNG, JPEG, WebP, BMP, статический GIF, ICO, PDF.
- Аудио: входные форматы зависят от декодера браузера; выход — WAV PCM16 и MP3 192 kbps. Пакетный редактор применяет только громкость.
- Документы: TXT/MD/HTML/DOCX на входе; TXT/MD/HTML и текстовый PDF на выходе. Исходная офисная вёрстка не переносится. Видеоконвертация отсутствует.
- Таблицы: CSV, TSV, JSON-массивы, Markdown и XLSX.
- Анимация: редактор блоков, PNG sequence в ZIP, GIF, MP4 H.264 без звука. MP4 использует WebCodecs или локальный WASM-кодировщик.
- Manim: экспортируется готовая `.py`-сцена; браузерный медиарендер не является Python Manim. Сервер Manim не подключён.
- Иконки: PNG до 4096 px; ICO содержит размеры до 256 px. Контексты — 20 условных макетов, не снимки реальных ОС.

При блокировке автоматического скачивания остаётся прямая ссылка на сформированный файл.

### Проверки и зависимости

Запуск основных тестов: `node tests/core.mjs` (Node.js 22+).

Готовые библиотеки находятся в `tools/vendor/`. Для их повторной сборки: `bash vendor-src/build.sh`. Зафиксированные версии содержатся в `vendor-src/package-lock.json`; атрибуция — в `tools/vendor/THIRD_PARTY_NOTICES.txt`.

## Version 0.5 — text, graphics and local whiteboard

Eleven additional tools bring the catalog to 27 entries. Sidebar tool icons have been removed; card illustrations remain.

- Text files: split by lines, Unicode code points, UTF-8 byte size, chapter/Markdown headings or literal delimiter; merge with ordering, separators and optional filenames. UTF-8 output; UTF-8, Windows-1251 and UTF-16 LE input. Source files are never changed.
- Unicode inspector: code points, grapheme count, Unicode names/categories, UTF-8 and UTF-16. Bundled names use Unicode 14; newer characters may have no name.
- Symbol catalog: categorized symbols, English-name/code search, favorites and recent choices stored locally.
- Emoji and text emotions: 3998 emoji records from Emojibase 18 plus 28 kaomoji; Russian/English labels and tags, favorites and composition.
- Text checks: mixed alphabets, invisible controls, spacing, repeated words, quotes, dashes, length and forbidden words. Individual/group fixes and undo. This is not a spelling or grammar engine.
- Text analysis: paragraphs, lines, words, letters, digits, whitespace, code points, graphemes, substring occurrences and word frequency. Ordered batch replacements, literal/regex, case/whole-word settings, worker timeout, preview and undo. TXT/MD/CSV/TSV/JSON/HTML and raw DOCX text import. No PDF import.
- Font viewer: local TTF/OTF/WOFF/WOFF2 samples, comparison, UI contexts, optional Google Fonts and PNG export. Exact glyph coverage requires a format supported by OpenType.js; WOFF2 and remotely loaded Google Fonts are displayed without claiming verified coverage.
- Image stylization: dots, parallel/cross hatching, engraving, Sobel contours, Floyd–Steinberg dithering and ordered halftone. PNG, and SVG for vector effects. Up to 6 million output pixels.
- Spectrogram: Hann-windowed radix-2 FFT in a worker, linear/log frequency scales, time selection, palettes, audio position cursor and PNG. Stereo channels are averaged. No server processing.
- Timing: multiple timers, synthesized alarms with volume, stopwatch/laps/CSV, local recovery and fullscreen. Alarms require an open, active-enough browser; closed/suspended browser alarms are not guaranteed.
- Whiteboard: world-coordinate canvas, pen/highlighter, rectangle/ellipse/arrows, text, tab-separated tables, local images, selection/move/resize/groups/layer order, undo/redo, zoom/pan and local IndexedDB recovery. `.gmboard` is a versioned self-contained JSON document containing objects, view and embedded PNG images. Open/download; optional File System Access save where supported. PNG/SVG/PDF export; PDF is rasterized. New/open actions first prepare a backup download for an existing unsaved board. Drafts stay on the device and can be removed by clearing browser site data. Explicit file saves are the durable portable copy.

`node tests/expansion.mjs` verifies text algorithms, replacement boundaries, FFT frequency detection, board validation/transforms and catalog illustrations. Existing checks remain in `node tests/core.mjs`.

Additional vendor bundle: `fonts.js` (OpenType.js). Emoji data and Unicode name shards are self-hosted in `tools/data/`. Rebuild the font bundle with `vendor-src/build.sh` alongside the existing vendor bundles. See `tools/vendor/THIRD_PARTY_NOTICES.txt`.

Data can be regenerated with `python3 vendor-src/build-data.py` after `npm ci` in `vendor-src`; Unicode generation requires Python's Unicode 14.0.0 database. Before replacing the current whiteboard, an additional recoverable previous-board copy is retained in IndexedDB.

## Version 0.6 — selected refinements

Catalog: 28 tools. Text splitting/merging is hidden from navigation and routing; its source is retained for later restoration. New ASCII image generator exports TXT, colored HTML and PNG. New Markdown editor has live sanitized preview, formatting toolbar, local draft/previous draft recovery, embedded local pictures, MD/HTML export and keyboard shortcuts. External images are disabled in its preview/export; HTML is sanitized with DOMPurify and a restrictive content policy. Markdown documents are limited to 2 million characters.

Selected improvements:

- Pixel Upscaler: inverse integer nearest-neighbor reduction; dimensions must divide evenly by the chosen factor.
- Palette: a single proportional strip. Representatives are actual sampled source colors; shades are assigned to nearest representatives in OKLab. Hover/focus/click reveals a vertical split of exact and merged source shades and percentages. Large inputs use nearest-neighbor sampling; counts describe sampled opaque pixels, not an exact full-resolution histogram.
- Converter: target size for PNG/JPEG/WebP, bounded quality search and resolution reduction when needed. Other output families retain previous behavior.
- Segment display: selected segments can be dim, off, stuck on or flickering. Flicker is live in preview; PNG/SVG export a still frame.
- JSON: edit values/subtrees and add object fields/array items through the tree, with valid JSON input and stale-source protection.
- Tables: selected-column whitespace cleanup, number/date normalization, empty-cell fill, preview and undo. Numeric cleanup preserves leading zeros; invalid dates/numbers are retained.
- Audio: 0–100% within-file RMS leveling over 250 ms windows, interpolated gain, a silence gate, gain bounds and peak protection. This is not LUFS mastering or literal equal amplitude at every sample. Crossfade joins selected fragments of a single source file; batch inputs remain gain-only.
- QR: labeled A4 sheets, variable grid and multi-page PDF, first-page preview.
- World clocks: one reference date and shared time slider across all zones.
- Dates: user-defined working weekdays/excluded dates and optional start/end progress. Start date is excluded and end included in working-day counts; no automatic national holiday calendar.
- Randomizer: cross-run weighted bag and balanced groups with together/apart pair constraints. Constrained searches are bounded and report conflicting/unsatisfied limits.
- Device tester: active buttons bright green, released tested buttons nearly white green, including mouse/gamepad history. Blur clears stuck key states.
- Icon readability: 16/20/24/32/48 px at actual size on light, dark and busy backgrounds.
- Prompter: duration-based pace estimate, `[[notes]]`, `**emphasis**` and text Document Picture-in-Picture. PiP requires a compatible secure desktop browser and remains tied to the original page. Notes are visually distinct and excluded from word counts, not automatic timed pauses.
- Layout recovery: selectable fragment candidates; the user approves the relevant fragments.
- Unicode symbols: configurable single/double/heavy/rounded text frames with copy/TXT export.
- Text checks: literal custom replacement rules with explanations, case setting, local profiles and JSON import/export.
- Fonts: characters missing from a parsed font are highlighted as potential fallback. Exact detection remains unavailable for unparsed WOFF2/remote fonts; their coverage is explicitly unverified.
- Whiteboard: bound arrow endpoints, elbow routing/bend offset and labels; figure movement updates connections. Compact sticky toolbar, inline text editing, eraser, one-shot tools/lock, copy/cut/paste, duplication, grouping, selection/nudge/zoom shortcuts, wheel pan and Ctrl/Cmd-wheel zoom. Existing `.gmboard` files remain supported. Pointer and keyboard interactions draw on the documented Miro/Excalidraw patterns; the board remains an independent implementation.

Reference sources for controls and PiP:
- https://help.miro.com/hc/en-us/articles/360017731033-Shortcuts-and-hotkeys
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/HelpDialog.tsx
- https://developer.chrome.com/docs/web-platform/document-picture-in-picture

`node tests/refinements.mjs` verifies palette provenance, leveling, crossfades, cleanup, working-day arithmetic, constrained allocation, bound arrows and catalog changes. Additional dependency DOMPurify is pinned in `vendor-src` and self-hosted as `tools/vendor/purify.js`; license texts are included in THIRD_PARTY_NOTICES.txt.
