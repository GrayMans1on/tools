#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
npm ci
./node_modules/.bin/esbuild vendor-entry.js --bundle --format=esm --minify --platform=browser --outfile=../tools/vendor/vendor.js
./node_modules/.bin/esbuild node_modules/h264-mp4-encoder/embuild/dist/h264-mp4-encoder.web.js --minify --outfile=../tools/vendor/h264.js
cp node_modules/lamejs/lame.min.js ../tools/vendor/lame.min.js
