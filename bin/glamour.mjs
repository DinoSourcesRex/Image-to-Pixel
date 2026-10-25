#!/usr/bin/env node
// glamour: re-palette PNGs with the pixel-art engine (local tool, not published).
//   glamour sprite.png              -> sprite.apollo.png, same size, Apollo palette, no dither
//   glamour a.png b.png -o out/ --palette pico-8 --json
// Run with --help for flags. Exit 1 if any input failed.

import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, extname, join, dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { createPixelator, getPalette, PALETTES, encodePNG, uniqueColors, normalizeSettings, mergeSettings, settingsFromJSON, DITHER_METHODS } from '../lib/index.js';

const HELP = `usage: glamour <input.png...> [options]
  -o, --out <path>      output .png (one input) or directory; default <name>.<palette>.png beside input
  --palette <id>        built-in palette id (default apollo; see --palettes)
  --settings <file>     editor settings JSON, used instead of the defaults
  --block <n>           pixel size in source pixels (default 1)
  --width <n>           output width in pixels instead of --block
  --dither <id>         dither method (default none)   --strength <0..1>
  --resample <box|nearest>   --scale <n>  integer upscale of the pixel art (default: output matches the source size)
  --json                print a JSON report to stdout
  --palettes            list built-in palettes
  -h, --help`;

const fail = msg => { console.error('glamour: ' + msg); process.exit(1); };

let args;
try {
  args = parseArgs({ allowPositionals: true, options: {
    out: { type: 'string', short: 'o' }, settings: { type: 'string' }, palette: { type: 'string' },
    block: { type: 'string' }, width: { type: 'string' }, dither: { type: 'string' }, strength: { type: 'string' },
    resample: { type: 'string' }, scale: { type: 'string' },
    json: { type: 'boolean' }, palettes: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
} catch (e) { fail(e.message); }
const { values: v, positionals: inputs } = args;

if (v.help) { console.log(HELP); process.exit(0); }
if (v.palettes) {
  for (const p of PALETTES) console.log(`${p.id.padEnd(26)} ${p.name} (${p.colors.length})`);
  process.exit(0);
}
if (!inputs.length) fail('no input files (see --help)');

const num = (name, lo, hi) => {
  if (v[name] === undefined) return undefined;
  const n = Number(v[name]);
  if (!(n >= lo && n <= hi)) fail(`--${name} must be a number from ${lo} to ${hi}`);
  return n;
};
let settings;
try {
  settings = v.settings ? settingsFromJSON(readFileSync(v.settings, 'utf8'))
    : mergeSettings(normalizeSettings({}), { size: { mode: 'block', block: 1, resample: 'box' }, palette: { source: 'builtin', id: 'apollo' }, dither: { method: 'none' }, export: { size: 'source', scale: 1 } });
} catch (e) { fail(`--settings: ${e.message}`); }
const patch = { size: {}, palette: {}, dither: {}, export: {} };
if (v.palette) {
  const p = getPalette(v.palette);
  if (!p) fail(`unknown palette '${v.palette}' (list them with --palettes)`);
  patch.palette = { source: 'builtin', id: p.id };
}
if (v.block) Object.assign(patch.size, { mode: 'block', block: num('block', 1, 2048) });
if (v.width) Object.assign(patch.size, { mode: 'width', width: num('width', 1, 2048) });
if (v.resample) {
  if (!['box', 'nearest'].includes(v.resample)) fail('--resample must be box or nearest');
  patch.size.resample = v.resample;
}
if (v.dither) {
  if (!DITHER_METHODS.some(m => m.id === v.dither)) fail(`unknown dither '${v.dither}': ${DITHER_METHODS.map(m => m.id).join(', ')}`);
  patch.dither.method = v.dither;
}
if (v.strength) patch.dither.strength = num('strength', 0, 1);
if (v.scale) Object.assign(patch.export, { size: 'scale', scale: Math.round(num('scale', 1, 64)) });
settings = mergeSettings(settings, patch);

const asFile = inputs.length === 1 && v.out && /\.png$/i.test(v.out);
if (inputs.length > 1 && v.out && /\.png$/i.test(v.out)) fail('-o must be a directory with several inputs');
const tag = settings.palette.source === 'builtin' ? settings.palette.id : settings.palette.source;

const px = await createPixelator();
const report = [];
let failed = false;
for (const input of inputs) {
  try {
    const { width, height, data } = PNG.sync.read(readFileSync(input));
    const r = await px.process({ width, height, data: new Uint8ClampedArray(data) }, settings);
    const name = `${basename(input, extname(input))}.${tag}.png`;
    const output = asFile ? v.out : join(v.out ?? dirname(input), name);
    // ponytail: case-insensitive compare (Windows paths); a case-only rename on Linux is also refused
    if (resolve(output).toLowerCase() === resolve(input).toLowerCase()) throw new Error('refusing to overwrite the input');
    mkdirSync(dirname(output), { recursive: true });
    // like the editor: 'source' brings the pixel art back up to the size of the (framed) input
    const size = settings.export.size === 'source'
      ? { width: Math.max(1, Math.round(r.crop.w * width)), height: Math.max(1, Math.round(r.crop.h * height)) }
      : { width: r.width * settings.export.scale, height: r.height * settings.export.scale };
    const png = await encodePNG(r, { ...(settings.export.size === 'source' ? size : { scale: settings.export.scale }), indexed: settings.export.indexed });
    writeFileSync(output, png);
    const { width: w, height: h } = size;
    report.push({ input, output, width: w, height: h, colors: uniqueColors(r).length, ms: Math.round(r.ms) });
    if (!v.json) console.log(`${input} -> ${output}`);
  } catch (e) {
    failed = true;
    console.error(`glamour: ${input}: ${e.message}`);
  }
}
if (v.json) console.log(JSON.stringify(report));
process.exitCode = failed ? 1 : 0;   // not exit(): lets piped stdout flush
