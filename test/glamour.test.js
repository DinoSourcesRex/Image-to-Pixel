import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { getPalette } from '../lib/index.js';

test('glamour re-palettes a PNG to Apollo at the same size', () => {
  const dir = mkdtempSync(join(tmpdir(), 'glamour-'));
  const src = new PNG({ width: 20, height: 12 });
  for (let y = 0; y < 12; y++) for (let x = 0; x < 20; x++) src.data.set([x * 12, y * 20, 128, 255], (y * 20 + x) * 4);
  const file = join(dir, 'g.png');
  writeFileSync(file, PNG.sync.write(src));

  const report = JSON.parse(execFileSync('node', ['bin/glamour.mjs', file, '--json'], { encoding: 'utf8' }));
  const out = PNG.sync.read(readFileSync(report[0].output));
  assert.equal(out.width, 20); assert.equal(out.height, 12);
  const apollo = new Set(getPalette('apollo').colors);
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i + 3] < 255) continue;
    const hex = [...out.data.subarray(i, i + 3)].map(c => c.toString(16).padStart(2, '0')).join('');
    assert.ok(apollo.has(hex), `${hex} not in Apollo`);
  }
});
