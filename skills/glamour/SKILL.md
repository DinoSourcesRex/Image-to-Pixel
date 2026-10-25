---
name: glamour
description: Re-palette PNG images with the user's local `glamour` CLI (the Image-to-Pixel engine). Use whenever they want an existing PNG re-paletted, recoloured to a palette, snapped to the game palette, pixelated, "made Apollo", "glamoured", or ask for demgooners PNGs to be converted or brought into the game palette, whether or not they name the tool. Also for batch re-palettes of a folder of sprites. Not for generating or AI-converting art (that's PixelLab), designing a palette from scratch, or editing the engine's code.
---

# glamour

`glamour` is a global CLI on this machine, callable from any folder. It reads PNG files from disk, snaps them to a palette, and writes a new PNG beside the original. The original is never overwritten (the CLI refuses an `-o` that points at an input).

## Quick start

```
glamour sprite.png              -> sprite.apollo.png, same size, Apollo palette, no dither
glamour a.png b.png c.png       -> one output per input, beside each input
```

Batch in PowerShell (the array must be splatted, see below):

```powershell
$f = (Get-ChildItem sprites\*.png -Exclude *.apollo.png).FullName; glamour @f -o out --json
```

Defaults: Apollo palette, pixel size 1 (`--block 1`), box resample, no dither, output at the source image's size. Output name is `<name>.<palette>.png`.

## demgooners

The game's convention is Apollo at 1× source size with no dither, which is exactly the defaults. For demgooners art run `glamour <files>` with no flags. Don't guess asset folders; use the paths they give you.

## Flags

| Flag | Does | Default |
|---|---|---|
| `--palette <id>` | Built-in palette. `glamour --palettes` lists the ids (apollo, pico-8, endesga-32, sweetie-16, game-boy-dmg, ...). | apollo |
| `--block <n>` | Pixel size in source pixels, 1-256 (larger values silently become 256). `--block 4` turns each 4×4 area into one pixel. | 1 |
| `--width <n>` | Output pixel-art width, 1-2048, instead of `--block`. | |
| `--resample box\|nearest` | How source pixels are combined per block. | box |
| `--dither <id>` | none, bayer2/4/8/16, cluster4/8, lines, bluenoise, floyd-steinberg, atkinson, sierra-lite, sierra, burkes, jarvis, stucki | none |
| `--strength <0..1>` | Dither strength. | 0.6 |
| `--scale <n>` | Integer upscale 1-64 of the pixel art. Switches output from "source size" to "pixel art × n". | source size |
| `--settings <file.json>` | A settings file saved from the browser editor, used as the base. Other flags still override it. See below. | |
| `-o <file.png>` | Output file. Only with one input. | |
| `-o <dir>` | Output directory, created if missing. Required form with several inputs. | beside input |
| `--json` | Prints `[{input, output, width, height, colors, ms}]` on stdout instead of the `in -> out` lines. | |

Exit code is 1 if any input failed; errors go to stderr, and a failed file is skipped rather than aborting the batch. `--block` and `--scale` compose: `--block 4 --scale 2` on a 64×48 image gives 16×12 pixel art written at 32×24. Alpha is cut at 50%: semi-transparent pixels come out fully opaque or fully transparent, which matters for soft-edged UI art.

### `--settings` replaces the defaults entirely

Anything the file omits falls to the editor's own defaults (Endesga 32, width 96, Bayer 4×4 at 0.6, 4× scale), not to Apollo / block 1 / no dither / source size. No flag restores source-size output (`--scale` always means pixel art × n), so set Export size in the editor before saving. Non-built-in palettes name the output `<name>.custom.png` or `<name>.extract.png`.

## Inputs are file paths

The tool reads PNGs from disk. It cannot see an image pasted into the chat. Work from paths: the user gives paths or a folder. If an image only exists as a chat paste, ask for its path or a saved file.

PowerShell doesn't expand `*.png` for native commands (ENOENT on the literal `*.png`), and `glamour` resolves to npm's `glamour.ps1` shim, which flattens an inline array into one space-joined argument, hence the `$f = ...; glamour @f` form above. Bash expands the glob itself but then also matches earlier outputs, giving `x.apollo.apollo.png`, so exclude them. Re-running on the same source just overwrites the previous `.apollo.png`, which is fine.

PNG only. For a JPG or WebP, say so and ask for a PNG; don't convert it yourself. The pixel art is capped at 2048 px per side and then resized back up, so sources over 2048 px aren't snapped 1:1; crop or shrink them first.

## Verify before reporting

Run with `--json`, then check: the exit code is 0 and there is one entry per input (`--json` lists only successes; a failed file shows only on stderr, so a partial batch looks fine on stdout). Width and height should be what the flags imply (source size unless `--scale`), and `colors` at or under the palette's size (Apollo is 46; transparent pixels aren't counted). Then look at the output with the Read tool, or spot-check one for a batch. Report the paths written, not the raw JSON.

## What the CLI can't do

No flags for custom palette files (.gpl/.hex), extracted palettes, adjustments, outline, cleanup or crop. All of those are set in the browser editor, saved as a settings file ("Save JSON" in the editor downloads `image-to-pixel-settings.json`), and passed with `--settings`. Video, GIF and sprite-sheet slicing are not supported.
