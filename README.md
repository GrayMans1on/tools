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
