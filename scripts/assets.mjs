#!/usr/bin/env node
/**
 * Branding — `npm run assets` (also a step of `npm run release`).
 *
 * public/image.png is the single source of truth for the app artwork. This
 * script derives the source images @capacitor/assets expects and then runs that
 * generator, so the icon and splash survive `npx cap add android` recreating
 * android/ from the stock template (android/ is git-ignored, so anything written
 * straight into it would be lost on the next regeneration).
 *
 *   public/image.png
 *     ├─ assets/icon-only.png        1024x1024   legacy + round launcher icons
 *     ├─ assets/icon-foreground.png  1536x1536   adaptive icon foreground
 *     ├─ assets/icon-background.png  1536x1536   adaptive icon background (flat)
 *     └─ assets/splash.jpg           2732x4878   every drawable-{port,land}-* splash
 *
 *   public/favicon.png, public/apple-touch-icon.png   browser tab / home screen
 *
 * assets/ is generated and git-ignored — re-run this script after editing the
 * photo (it happens automatically on every `npm run release`).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// --- configuration ----------------------------------------------------------
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.join(ROOT, 'public', 'image.png')
const ASSET_DIR = path.join(ROOT, 'assets')
const ANDROID_RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

const ICON_SIZE = 1024
// @capacitor/assets writes an <inset android:inset="16.7%"> around both adaptive
// layers, so only the central 66.6% of a 108dp layer survives the launcher mask.
// Feeding it 1.5x the intended framing makes the adaptive icon match the legacy
// icon instead of showing a 1.5x zoom of it.
const ADAPTIVE_SCALE = 1.5
// 9:16, the photo's own aspect: the splash templates are centre-cropped out of
// this, so matching the source aspect keeps the portrait crop almost lossless.
const SPLASH = { width: 2732, height: 4878, quality: 92 }
const SPLASH_BG = '#000000'
const WEB_ICONS = [
  { file: 'favicon.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
]
// Capacitor's own branding, replaced by the generated mipmaps above.
const LEGACY_RES = [
  'drawable/ic_launcher_background.xml',
  'drawable-v24/ic_launcher_foreground.xml',
  'values/ic_launcher_background.xml',
]

const IS_WIN = process.platform === 'win32'
const rel = (p) => path.relative(ROOT, p) || p
const c = {
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  d: (s) => `\x1b[2m${s}\x1b[0m`,
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
}
const info = (msg) => console.log(`      ${msg}`)
const warn = (msg) => console.log(`      ${c.y('!')} ${msg}`)
function fail(msg) {
  throw new Error(msg)
}

/** sharp is a dependency of @capacitor/assets; load it with a useful message. */
async function loadSharp() {
  try {
    const mod = await import('sharp')
    return mod.default || mod
  } catch (err) {
    fail('sharp could not be loaded, so the icon cannot be generated.\n' +
      '  Run `npm install` (@capacitor/assets ships sharp) and try again.\n' +
      `  ${err.message}`)
  }
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: opts.capture ? 'pipe' : 'inherit',
    shell: IS_WIN,
  })
  if (res.error) fail(`could not run \`${cmd}\`: ${res.error.message}`)
  if (res.status !== 0) {
    // A generator that failed explains why better than this script does.
    if (opts.capture) console.log(`${res.stdout || ''}${res.stderr || ''}`)
    fail(`\`${[path.basename(cmd), ...args].join(' ')}\` exited with code ${res.status}`)
  }
  return { stdout: res.stdout || '', stderr: res.stderr || '' }
}


/** Square, centre-cropped view of the photo — the launcher icon framing. */
async function squareCrop(sharp) {
  const meta = await sharp(SOURCE).metadata()
  if (!meta.width || !meta.height) fail(`${rel(SOURCE)} is not a readable image`)
  const side = Math.min(meta.width, meta.height)
  return {
    left: Math.round((meta.width - side) / 2),
    top: Math.round((meta.height - side) / 2),
    width: side,
    height: side,
    source: `${meta.width}x${meta.height}`,
  }
}

/** public/image.png -> the four sources @capacitor/assets consumes + web icons. */
async function derive(sharp) {
  console.log(`${c.b(c.g('Deriving artwork from'))} ${c.b(rel(SOURCE))}`)
  if (!fs.existsSync(SOURCE)) fail(`${rel(SOURCE)} not found — that photo is the app icon and splash source`)
  const crop = await squareCrop(sharp)
  info(`photo ${crop.source} -> square crop ${crop.width}x${crop.height} at +${crop.left}+${crop.top}`)

  fs.mkdirSync(ASSET_DIR, { recursive: true })
  const base = () => sharp(SOURCE).extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })

  await base()
    .resize(ICON_SIZE, ICON_SIZE)
    .png({ compressionLevel: 9 })
    .toFile(path.join(ASSET_DIR, 'icon-only.png'))
  await base()
    .resize(Math.round(ICON_SIZE * ADAPTIVE_SCALE), Math.round(ICON_SIZE * ADAPTIVE_SCALE))
    .png({ compressionLevel: 9 })
    .toFile(path.join(ASSET_DIR, 'icon-foreground.png'))
  // Flat layer: the foreground covers the whole mask, this only shows if a
  // launcher masks smaller than the standard 72dp circle.
  await sharp({ create: { width: ICON_SIZE, height: ICON_SIZE, channels: 4, background: '#0c0e11' } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ASSET_DIR, 'icon-background.png'))
  await sharp(SOURCE)
    .resize(SPLASH.width, SPLASH.height, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: SPLASH.quality, mozjpeg: true })
    .toFile(path.join(ASSET_DIR, 'splash.jpg'))

  for (const { file, size } of WEB_ICONS) {
    await base()
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(ROOT, 'public', file))
  }

  for (const f of ['icon-only.png', 'icon-foreground.png', 'icon-background.png', 'splash.jpg']) {
    const p = path.join(ASSET_DIR, f)
    info(`${c.d('generated')} ${rel(p)}  ${c.d(`${(fs.statSync(p).size / 1024).toFixed(0)} KB`)}`)
  }
  for (const { file } of WEB_ICONS) info(`${c.d('generated')} public/${file}`)
}

/** Idempotently add a <color> to a values file, creating the file if needed. */
function ensureColor(file, name, value) {
  const skeleton = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n`
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : skeleton
  if (before.includes(`name="${name}"`)) return
  const entry = `    <color name="${name}">${value}</color>\n`
  const after = before.replace(/<\/resources>\s*$/, `${entry}</resources>\n`)
  fs.writeFileSync(file, after === before ? before.replace(/(<resources[^>]*>)/, `$1\n${entry}`) : after)
  info(`${c.d('wrote')} ${rel(file)}  ${c.d(`${name} = ${value}`)}`)
}

/**
 * Android 12+ (API 31) draws the launch splash itself from two theme attributes
 * instead of the window background. The stock template leaves them alone, which
 * is why a 12+ device shows the generic Android robot on ?android:colorBackground.
 * Platform (android:*) attributes are used so this needs nothing beyond
 * compileSdk 31, and values-v31 keeps older releases on the Capacitor path.
 */
const STYLES_V31 = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by scripts/assets.mjs — edit that script, not this file. -->
<resources>
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
        <item name="android:windowSplashScreenBackground">@color/splashBackground</item>
        <item name="android:windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>
    </style>
</resources>
`

// @capacitor/assets writes the adaptive foreground/background layers at the
// legacy icon sizes (36-192px) instead of the 108dp adaptive sizes (81-432px),
// so every Android 8+ launcher has to upscale a 192px bitmap. Rewrite them.
const ADAPTIVE_SIZES = { ldpi: 81, mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 }

async function fixAdaptiveLayers(sharp) {
  for (const [density, size] of Object.entries(ADAPTIVE_SIZES)) {
    for (const name of ['ic_launcher_foreground', 'ic_launcher_background']) {
      const dest = path.join(ANDROID_RES, `mipmap-${density}`, `${name}.png`)
      if (!fs.existsSync(dest)) continue
      await sharp(path.join(ASSET_DIR, `icon-${name === 'ic_launcher_foreground' ? 'foreground' : 'background'}.png`))
        .resize(size, size)
        .png({ compressionLevel: 9 })
        .toFile(dest)
    }
  }
  info(`${c.d('rewrote')} mipmap-*/ic_launcher_{foreground,background}.png at ${Object.values(ADAPTIVE_SIZES).join('/')}px`)
}

/** Run the generator over android/, then retire the stock Capacitor artwork. */
async function generateAndroid(sharp) {
  if (!fs.existsSync(ANDROID_RES)) {
    warn('android/ is not there yet — run `npm run release` (or `npx cap add android`) to write the native resources')
    return
  }
  const bin = path.join(ROOT, 'node_modules', '.bin', IS_WIN ? 'capacitor-assets.cmd' : 'capacitor-assets')
  if (!fs.existsSync(bin)) fail('node_modules/.bin/capacitor-assets is missing — run `npm install` first')
  const res = run(bin, ['generate', '--android', '--assetPath', 'assets'], { capture: true })
  const written = (res.stdout.match(/^CREATE/gm) || []).length
  info(`${c.g('generated')} ${written} Android resources in ${rel(ANDROID_RES)}`)
  await fixAdaptiveLayers(sharp)

  for (const f of LEGACY_RES) {
    const p = path.join(ANDROID_RES, f)
    if (fs.existsSync(p)) {
      fs.rmSync(p)
      info(`${c.d('removed')} ${rel(p)}  ${c.d('(stock Capacitor artwork)')}`)
    }
  }

  ensureColor(path.join(ANDROID_RES, 'values/colors.xml'), 'splashBackground', SPLASH_BG)
  const styles = path.join(ANDROID_RES, 'values-v31/styles.xml')
  if (fs.existsSync(styles) && fs.readFileSync(styles, 'utf8') === STYLES_V31) {
    info(`${c.d('unchanged')} ${rel(styles)}`)
  } else {
    fs.mkdirSync(path.dirname(styles), { recursive: true })
    fs.writeFileSync(styles, STYLES_V31)
    info(`${c.d('wrote')} ${rel(styles)}  ${c.d('(Android 12+ launch splash)')}`)
  }
}

// --- entry point ------------------------------------------------------------
try {
  console.log(`\n${c.b('App icon and splash')}`)
  const sharp = await loadSharp()
  await derive(sharp)
  await generateAndroid(sharp)
  console.log(`${c.g('Branding up to date')} ${c.d('— run `npm run assets` after editing public/image.png')}\n`)
} catch (err) {
  console.error(`\n${c.r('✖ Asset generation failed')} ${err.message}\n`)
  process.exit(1)
}

