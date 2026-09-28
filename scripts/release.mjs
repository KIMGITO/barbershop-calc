#!/usr/bin/env node
/**
 * npm run release — one command from source tree to a signed, deployable
 * Android build. It is written to be idempotent and re-runnable: every step
 * either fixes something that is missing or is a no-op.
 *
 *   1. preflight ......... verify JDK, Android SDK and required SDK packages
 *   2. native project .... `npx cap add android` if android/ is absent
 *   3. toolchain ......... pin Gradle / AGP / compileSdk+targetSdk / JVM args
 *   4. signing config .... wire signingConfig into android/app/build.gradle
 *   5. keystore .......... generate signing/release.keystore once, reuse after
 *   6. web build ......... `npm run build` (production Vite build, reads .env)
 *   7. capacitor sync .... copy web assets + native plugin wiring into android/
 *   8. gradle ............ clean + assembleRelease (+ bundleRelease), signed
 *   9. collect ........... verify signature, copy to release/, write SHA256SUMS
 *
 * Environment overrides (all optional):
 *   RELEASE_TARGETS=apk,bundle   which artifacts to build (default: both)
 *   RELEASE_DRY_RUN=1            run steps 1-5 only, skip build/sync/gradle
 *   RELEASE_KEYSTORE_FILE        use an existing keystore instead of signing/
 *   RELEASE_KEYSTORE_PASSWORD    ... instead of generating one
 *   RELEASE_KEY_ALIAS            default: release
 *   RELEASE_KEY_PASSWORD         ... defaults to the store password (PKCS12)
 *   KEYSTORE_PROPERTIES_FILE     alternate keystore.properties for Gradle
 *   ANDROID_HOME / ANDROID_SDK_ROOT / JAVA_HOME
 */
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// --- configuration ----------------------------------------------------------
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ANDROID_DIR = path.join(ROOT, 'android')
const APP_GRADLE = path.join(ANDROID_DIR, 'app', 'build.gradle')
const ROOT_GRADLE = path.join(ANDROID_DIR, 'build.gradle')
const VARIABLES_GRADLE = path.join(ANDROID_DIR, 'variables.gradle')
const WRAPPER_PROPS = path.join(ANDROID_DIR, 'gradle', 'wrapper', 'gradle-wrapper.properties')
const GRADLE_PROPERTIES = path.join(ANDROID_DIR, 'gradle.properties')

const SIGNING_DIR = path.join(ROOT, 'signing')
const KEYSTORE_PROPS = path.join(SIGNING_DIR, 'keystore.properties')
const KEYSTORE_FILE = path.join(SIGNING_DIR, 'release.keystore')
const VERSION_STATE = path.join(SIGNING_DIR, '.last-version-code')
const OUT_DIR = path.join(ROOT, 'release')

// Toolchain this project is verified against. scripts/release.mjs re-applies
// these to android/, so a regenerated native project is never left stale.
// Gradle 8.14.3 + AGP 8.13.0 is the combination already provisioned on the
// build machine, and the pairing is valid (AGP 8.13 requires Gradle 8.13+).
const GRADLE_VERSION = '8.14.3'
const AGP_VERSION = '8.13.0'
const SDK_VERSION = 35
const BUILD_TOOLS_VERSION = '35.0.0'
const MIN_JDK = 17
const DEFAULT_KEY_ALIAS = 'release'
const KEY_VALIDITY_DAYS = 10000 // ~27 years; Play requires validity past 22 Oct 2033

const IS_WIN = process.platform === 'win32'
const GRADLEW = path.join(ANDROID_DIR, IS_WIN ? 'gradlew.bat' : 'gradlew')
const NPM = IS_WIN ? 'npm.cmd' : 'npm'
const NPX = IS_WIN ? 'npx.cmd' : 'npx'
const DRY_RUN = process.env.RELEASE_DRY_RUN === '1' || process.argv.includes('--dry-run')
const TARGETS = (process.env.RELEASE_TARGETS || 'apk,bundle')
  .split(',').map((s) => s.trim()).filter(Boolean)

const pkg = readJson(path.join(ROOT, 'package.json'))
const capConfig = readJson(path.join(ROOT, 'capacitor.config.json'))
const APP_NAME = capConfig.appName || pkg.name || 'app'
const APP_SLUG = APP_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// --- console ----------------------------------------------------------------
const c = {
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  d: (s) => `\x1b[2m${s}\x1b[0m`,
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
}
let stepNumber = 0
const step = (title) => console.log(`\n${c.b(`[${++stepNumber}/9]`)} ${c.g(title)}`)
const info = (msg) => console.log(`      ${msg}`)
const warn = (msg) => console.log(`      ${c.y('!')} ${msg}`)
function fail(msg) {
  throw new Error(msg)
}

// --- small helpers ----------------------------------------------------------
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}
function readProps(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#!\s][^=]*)=(.*)$/)
    if (m) out[m[1].trim()] = m[2].trim()
  }
  return out
}
function writeProps(file, obj) {
  fs.writeFileSync(file, `${Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n')}\n`)
  if (!IS_WIN) {
    try { fs.chmodSync(file, 0o600) } catch { /* best effort */ }
  }
}
const rel = (p) => path.relative(ROOT, p) || p
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d
  }
  return 0
}

/** Run a command without throwing; returns { status, stdout, stderr }. */
function sh(cmd, args = [], opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd || ROOT,
    env: { ...process.env, ...(opts.env || {}) },
    encoding: 'utf8',
    stdio: opts.stream ? 'inherit' : 'pipe',
    shell: Boolean(opts.shell) || (IS_WIN && /\.(bat|cmd)$/.test(cmd)),
    input: opts.input,
  })
  return { status: res.status ?? -1, stdout: res.stdout || '', stderr: res.stderr || '', error: res.error }
}

/** Run a command, streaming its output, failing loudly on a non-zero exit. */
function run(cmd, args = [], opts = {}) {
  const res = sh(cmd, args, { ...opts, stream: true })
  if (res.error) fail(`could not run \`${cmd}\`: ${res.error.message}`)
  if (res.status !== 0) fail(`\`${[cmd, ...args].join(' ')}\` exited with code ${res.status}`)
  return res
}

/** Replace `needle` exactly once, or fail with an actionable message. */
function replaceOnce(text, needle, replacement, file) {
  const first = text.indexOf(needle)
  if (first === -1) {
    fail(`Could not find the expected text in ${rel(file)}:\n  ${JSON.stringify(needle)}\n` +
      'The Capacitor template changed. Update scripts/release.mjs to match it.')
  }
  if (text.indexOf(needle, first + 1) !== -1) {
    fail(`Expected exactly one match in ${rel(file)} for ${JSON.stringify(needle)} but found several.`)
  }
  return text.slice(0, first) + replacement + text.slice(first + needle.length)
}

// --- environment ------------------------------------------------------------
let JAVA_HOME_RESOLVED = null
let SDK_ROOT = null

/** Locate a JDK >= MIN_JDK; returns its major version number. */
function checkJava() {
  const exe = IS_WIN ? 'java.exe' : 'java'
  if (process.env.JAVA_HOME && fs.existsSync(path.join(process.env.JAVA_HOME, 'bin', exe))) {
    JAVA_HOME_RESOLVED = process.env.JAVA_HOME
  }
  const bin = JAVA_HOME_RESOLVED ? path.join(JAVA_HOME_RESOLVED, 'bin', exe) : exe
  const res = sh(bin, ['-version'])
  if (res.status !== 0) {
    fail(`No usable Java runtime found (${JAVA_HOME_RESOLVED || 'java on PATH'}). ` +
      `Install JDK ${MIN_JDK}+ or set JAVA_HOME.`)
  }
  const m = `${res.stdout}${res.stderr}`.match(/version "(\d+)(?:\.(\d+))?/)
  if (!m) fail(`Could not determine the Java version from: ${res.stderr.split('\n')[0]}`)
  const major = Number(m[1]) === 1 ? 8 : Number(m[1]) // 1.8.0 -> 8
  if (major < MIN_JDK) {
    fail(`JDK ${MIN_JDK}+ is required, found ${major}. Gradle ${GRADLE_VERSION} / AGP ${AGP_VERSION} do not run on older JDKs.`)
  }
  return major
}

function findSdkmanager() {
  const cmdline = path.join(SDK_ROOT, 'cmdline-tools')
  const candidates = [
    path.join(cmdline, 'latest', 'bin', 'sdkmanager'),
    ...(fs.existsSync(cmdline)
      ? fs.readdirSync(cmdline).map((d) => path.join(cmdline, d, 'bin', 'sdkmanager'))
      : []),
    path.join(SDK_ROOT, 'tools', 'bin', 'sdkmanager'),
  ]
  return candidates.find((p) => fs.existsSync(p)) || null
}

/** Make sure an SDK package is installed, auto-accepting its licence. */
function ensureSdkPackage(relativeDir, sdkName) {
  if (fs.existsSync(path.join(SDK_ROOT, relativeDir))) {
    info(`${relativeDir} present`)
    return
  }
  const sdkmanager = findSdkmanager()
  if (!sdkmanager) {
    fail(`Android SDK is missing ${relativeDir} and sdkmanager was not found. Install it via Android Studio > SDK Manager.`)
  }
  info(`installing ${sdkName} (licence auto-accepted)...`)
  sh(sdkmanager, [`--sdk_root=${SDK_ROOT}`, sdkName], { input: 'y\n'.repeat(64) })
  if (!fs.existsSync(path.join(SDK_ROOT, relativeDir))) {
    fail(`Could not install ${sdkName}. Install it manually with:\n` +
      `  "${sdkmanager}" --sdk_root="${SDK_ROOT}" "${sdkName}"`)
  }
  info(`${sdkName} installed`)
}

// --- steps 1-3 --------------------------------------------------------------
function preflight() {
  step('Preflight: JDK, Android SDK and SDK packages')
  const java = checkJava()
  info(`JDK ${java} — ${JAVA_HOME_RESOLVED || 'java on PATH'}`)

  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'Android', 'Sdk'),
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    path.join(os.homedir(), '.local', 'share', 'android-sdk'),
  ].filter(Boolean)
  SDK_ROOT = candidates.find((dir) => fs.existsSync(dir))
  if (!SDK_ROOT) {
    fail('Android SDK not found. Install Android Studio (or the SDK command-line tools) and set ANDROID_HOME.')
  }
  info(`Android SDK — ${SDK_ROOT}`)

  ensureSdkPackage('platforms', `platforms;android-${SDK_VERSION}`)
  ensureSdkPackage('build-tools', `build-tools;${BUILD_TOOLS_VERSION}`)
}

function ensureNativeProject() {
  step('Capacitor Android project')
  if (fs.existsSync(APP_GRADLE)) {
    info(`android/ present — appId ${capConfig.appId}`)
    return
  }
  info('android/ missing — running `npx cap add android`')
  run(NPX, ['cap', 'add', 'android'])
  if (!fs.existsSync(APP_GRADLE)) fail('`npx cap add android` did not produce android/app/build.gradle.')
  info('android/ created')
}

/** Idempotently pin a value in a text file; no-op when already correct. */
function patchFile(file, pattern, replacement, label) {
  const before = fs.readFileSync(file, 'utf8')
  const match = before.match(pattern)
  if (!match) {
    fail(`Could not find ${label} in ${rel(file)} (pattern: ${pattern}). ` +
      'The Capacitor template changed — update scripts/release.mjs to match it.')
  }
  if (match[0] === replacement) {
    info(`${label}: already set`)
    return
  }
  fs.writeFileSync(file, before.replace(pattern, () => replacement))
  info(`${label}: ${match[0]} -> ${replacement}`)
}

function ensureToolchain() {
  step('Toolchain: Gradle, AGP, SDK levels, JVM memory')
  patchFile(WRAPPER_PROPS, /distributionUrl=.*gradle-[\d.]+-(all|bin)\.zip/,
    `distributionUrl=https\\://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-all.zip`,
    `Gradle ${GRADLE_VERSION}`)
  patchFile(ROOT_GRADLE, /com\.android\.tools\.build:gradle:[\d.]+/,
    `com.android.tools.build:gradle:${AGP_VERSION}`, `AGP ${AGP_VERSION}`)
  patchFile(VARIABLES_GRADLE, /compileSdkVersion\s*=\s*\d+/, `compileSdkVersion = ${SDK_VERSION}`,
    `compileSdk ${SDK_VERSION}`)
  patchFile(VARIABLES_GRADLE, /targetSdkVersion\s*=\s*\d+/, `targetSdkVersion = ${SDK_VERSION}`,
    `targetSdk ${SDK_VERSION}`)
  patchFile(GRADLE_PROPERTIES, /org\.gradle\.jvmargs=.*/,
    'org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfile.encoding=UTF-8', 'Gradle JVM args')
}

// --- steps 4-5 --------------------------------------------------------------
const SIGN_MARKER = '// ===== BEGIN release signing (managed by scripts/release.mjs) ====='

const SIGNING_HEADER = `${SIGN_MARKER}
// Keystore material lives in signing/keystore.properties at the repo root —
// deliberately OUTSIDE android/, so regenerating the native project with
// "npx cap add android" can never destroy the signing key. "npm run release"
// creates that file on first run and refreshes it on every run.
// If the file is absent the release build still configures; it just comes out
// unsigned instead of failing the whole build. Everything is resolved into
// plain locals first: inside a NamedDomainObjectContainer closure Gradle
// resolves method calls against the container, not the script, so calling
// Properties methods inline there is fragile.
def releasePropsFile = System.getenv('KEYSTORE_PROPERTIES_FILE')
        ? new File(System.getenv('KEYSTORE_PROPERTIES_FILE'))
        : rootProject.file('../signing/keystore.properties')
def releaseSigningAvailable = false
def releaseStoreFile = null
def releaseStorePassword = null
def releaseKeyAlias = null
def releaseKeyPassword = null
if (releasePropsFile.exists()) {
    def releaseProps = new Properties()
    releasePropsFile.withInputStream { releaseProps.load(it) }
    releaseSigningAvailable = releaseProps.getProperty('storeFile') != null
    if (releaseSigningAvailable) {
        releaseStoreFile = new File(releaseProps.getProperty('storeFile'))
        releaseStorePassword = releaseProps.getProperty('storePassword')
        releaseKeyAlias = releaseProps.getProperty('keyAlias')
        releaseKeyPassword = releaseProps.getProperty('keyPassword')
        if (!releaseStoreFile.exists()) {
            throw new GradleException("Signing keystore is missing: \${releaseStoreFile}\\n" +
                "Run 'npm run release' to generate one, or point KEYSTORE_PROPERTIES_FILE at an existing keystore.properties.")
        }
    }
}
// ===== END release signing =====`

const SIGNING_CONFIGS = `    signingConfigs {
        release {
            if (releaseSigningAvailable) {
                storeFile releaseStoreFile
                storePassword releaseStorePassword
                keyAlias releaseKeyAlias
                keyPassword releaseKeyPassword
                // minSdk is 22, so devices below API 24 need v1 (JAR) signing.
                enableV1Signing true
                enableV2Signing true
                // v3 is what Play and Android 9+ prefer, and it is the scheme
                // that allows signing-key rotation later on.
                enableV3Signing true
            }
        }
    }
`

const VERSION_BLOCK = `        // versionCode/versionName are injected per release by scripts/release.mjs
        // (-PreleaseVersionCode / -PreleaseVersionName) so a release build never
        // needs a manual edit here and can never ship a duplicate versionCode.
        versionCode project.hasProperty('releaseVersionCode') ? project.releaseVersionCode.toInteger() : 1
        versionName project.hasProperty('releaseVersionName') ? project.releaseVersionName : '1.0'`

/**
 * Teach the generated app module how to sign its release build. Marker-guarded
 * so it runs at most once per native project, and so a project that was
 * already patched (by hand, or by a previous release) is left untouched.
 */
function ensureSigningConfig() {
  step('Release signing configuration')
  const gradle = fs.readFileSync(APP_GRADLE, 'utf8')
  if (gradle.includes(SIGN_MARKER)) {
    info('android/app/build.gradle is already wired for release signing')
    return
  }
  let patched = replaceOnce(gradle,
    "apply plugin: 'com.android.application'\n",
    `apply plugin: 'com.android.application'\n\n${SIGNING_HEADER}\n`, APP_GRADLE)
  patched = replaceOnce(patched,
    '        versionCode 1\n        versionName "1.0"\n',
    `${VERSION_BLOCK}\n`, APP_GRADLE)
  patched = replaceOnce(patched,
    '    buildTypes {\n        release {\n',
    `${SIGNING_CONFIGS}    buildTypes {\n        release {\n` +
    '            if (releaseSigningAvailable) {\n                signingConfig signingConfigs.release\n            }\n',
    APP_GRADLE)
  fs.writeFileSync(APP_GRADLE, patched)
  info('patched android/app/build.gradle (signingConfigs + version injection)')
}

function generateKeystore(alias, storePassword, keyPassword) {
  const keytool = JAVA_HOME_RESOLVED
    ? path.join(JAVA_HOME_RESOLVED, 'bin', IS_WIN ? 'keytool.exe' : 'keytool')
    : (IS_WIN ? 'keytool.exe' : 'keytool')
  const orgPart = (capConfig.appId || 'app').split('.')[1] || APP_NAME
  const org = orgPart.charAt(0).toUpperCase() + orgPart.slice(1)
  const dname = `CN=${APP_NAME}, OU=Mobile, O=${org}, L=Unknown, ST=Unknown, C=US`
  warn(`no keystore found — generating a new release key at ${rel(KEYSTORE_FILE)}`)
  run(keytool, [
    '-genkeypair', '-v', '-keystore', KEYSTORE_FILE, '-storetype', 'PKCS12',
    '-alias', alias, '-keyalg', 'RSA', '-keysize', '2048',
    '-validity', String(KEY_VALIDITY_DAYS),
    '-storepass', storePassword, '-keypass', keyPassword, '-dname', dname,
  ])
  info(`generated ${rel(KEYSTORE_FILE)} — RSA 2048, valid ${KEY_VALIDITY_DAYS} days, alias "${alias}"`)
  warn(`BACK UP ${rel(SIGNING_DIR)} NOW. The signing key must stay identical forever;`)
  warn('if it is lost or regenerated, the app can no longer be updated on devices or on Play.')
}

function ensureKeystore() {
  step('Release keystore')
  fs.mkdirSync(SIGNING_DIR, { recursive: true })
  const envStore = process.env.RELEASE_KEYSTORE_FILE
  const fromEnv = Boolean(envStore && process.env.RELEASE_KEYSTORE_PASSWORD && process.env.RELEASE_KEY_PASSWORD)
  const saved = readProps(KEYSTORE_PROPS)
  const keystoreExists = fs.existsSync(KEYSTORE_FILE)
  const alias = process.env.RELEASE_KEY_ALIAS || saved.keyAlias || DEFAULT_KEY_ALIAS
  const storeFile = fromEnv ? path.resolve(envStore) : KEYSTORE_FILE

  let storePassword
  let keyPassword
  if (fromEnv) {
    info(`using the keystore from RELEASE_KEYSTORE_FILE — ${storeFile}`)
    storePassword = process.env.RELEASE_KEYSTORE_PASSWORD
    keyPassword = process.env.RELEASE_KEY_PASSWORD
  } else if (keystoreExists) {
    if (!saved.storePassword) {
      fail(`${rel(KEYSTORE_FILE)} exists but ${rel(KEYSTORE_PROPS)} is missing, so its password is unrecoverable.\n` +
        '  Restore keystore.properties from your backup, delete the keystore to generate a fresh key,\n' +
        '  or set RELEASE_KEYSTORE_FILE / RELEASE_KEYSTORE_PASSWORD / RELEASE_KEY_PASSWORD.')
    }
    info(`reusing ${rel(KEYSTORE_FILE)} (alias ${alias})`)
    storePassword = saved.storePassword
    keyPassword = saved.keyPassword || storePassword
  } else {
    // Reuse a surviving password so a lost keystore file can be re-created with
    // the same credentials; otherwise mint a random one.
    storePassword = saved.storePassword || randomBytes(16).toString('hex')
    keyPassword = storePassword // PKCS12: the key password must equal the store password
    generateKeystore(alias, storePassword, keyPassword)
  }

  writeProps(KEYSTORE_PROPS, { storeFile, storePassword, keyAlias: alias, keyPassword })
  info(`wrote ${rel(KEYSTORE_PROPS)} (git-ignored, mode 600) — never commit it`)
}

// --- steps 6-8 --------------------------------------------------------------
function buildWeb() {
  step('Production web build (Vite, reads .env)')
  run(NPM, ['run', 'build'])
}

function capacitorSync() {
  step('Capacitor sync (web assets + native plugins)')
  run(NPX, ['cap', 'sync', 'android'])
}

/**
 * versionCode = seconds since the Unix epoch. Android and Play both require a
 * strictly increasing versionCode for every upload, and this gives that for
 * free: two releases can never collide, and nobody has to remember to bump a
 * number in a Gradle file. Stays below Play's 2,100,000,000 ceiling until 2036.
 */
function nextVersionCode() {
  const now = Math.floor(Date.now() / 1000)
  const last = fs.existsSync(VERSION_STATE)
    ? Number.parseInt(fs.readFileSync(VERSION_STATE, 'utf8').trim(), 10) || 0
    : 0
  const code = Math.max(now, last + 1)
  fs.mkdirSync(SIGNING_DIR, { recursive: true })
  fs.writeFileSync(VERSION_STATE, `${code}\n`)
  return code
}

function gradleBuild(versionName, versionCode) {
  step(`Gradle release build (${TARGETS.join(' + ')})`)
  if (!TARGETS.includes('apk') && !TARGETS.includes('bundle')) {
    fail(`RELEASE_TARGETS must contain "apk" and/or "bundle" (got "${process.env.RELEASE_TARGETS}")`)
  }
  const tasks = ['clean', '--console=plain']
  if (TARGETS.includes('apk')) tasks.push('assembleRelease')
  if (TARGETS.includes('bundle')) tasks.push('bundleRelease')
  tasks.push(`-PreleaseVersionCode=${versionCode}`, `-PreleaseVersionName=${versionName}`)
  const env = { ANDROID_HOME: SDK_ROOT, ANDROID_SDK_ROOT: SDK_ROOT }
  if (JAVA_HOME_RESOLVED) env.JAVA_HOME = JAVA_HOME_RESOLVED
  run(GRADLEW, tasks, { cwd: ANDROID_DIR, env })
}

// --- step 9 -----------------------------------------------------------------
function findApksigner() {
  const dir = path.join(SDK_ROOT, 'build-tools')
  if (!fs.existsSync(dir)) return null
  const versions = fs.readdirSync(dir)
    .filter((v) => fs.existsSync(path.join(dir, v, 'apksigner')))
    .sort(compareVersions)
  return versions.length ? path.join(dir, versions[versions.length - 1], 'apksigner') : null
}

/** Refuse to ship an artifact whose signature does not verify. */
function verifyApk(apk) {
  const apksigner = findApksigner()
  if (!apksigner) {
    warn('apksigner was not found in the SDK — skipping signature verification')
    return null
  }
  const env = JAVA_HOME_RESOLVED ? { JAVA_HOME: JAVA_HOME_RESOLVED } : {}
  const res = sh(apksigner, ['verify', '--verbose', '--print-certs', apk], { env })
  if (res.status !== 0) {
    fail(`The APK signature did not verify, so this build is NOT deployable:\n` +
      `${res.stderr.trim() || res.stdout.trim()}`)
  }
  return {
    dn: (res.stdout.match(/Signer #1 certificate DN:\s*(.+)/) || [])[1]?.trim(),
    fingerprint: (res.stdout.match(/Signer #1 certificate SHA-256 digest:\s*(\S+)/) || [])[1],
    schemes: ['v1', 'v2', 'v3', 'v4']
      .filter((v) => new RegExp(`Verified using ${v} scheme[^:]*: true`).test(res.stdout))
      .join(', ') || 'none',
  }
}

function collectArtifacts(versionName, versionCode) {
  step('Verify signatures and collect artifacts')
  const sources = []
  if (TARGETS.includes('apk')) {
    sources.push({ kind: 'APK', src: path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk') })
  }
  if (TARGETS.includes('bundle')) {
    sources.push({ kind: 'AAB', src: path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab') })
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const collected = []
  for (const { kind, src } of sources) {
    if (!fs.existsSync(src)) fail(`Gradle reported success but ${rel(src)} is missing.`)
    const dest = path.join(OUT_DIR, `${APP_SLUG}-${versionName}-${versionCode}.${kind.toLowerCase()}`)
    fs.copyFileSync(src, dest)
    const size = fs.statSync(dest).size
    const hash = sha256(dest)
    collected.push({ kind, dest, size, hash })
  }

  const apk = collected.find((a) => a.kind === 'APK')
  const signature = apk ? verifyApk(apk.dest) : null
  if (!apk) {
    warn('no APK in this build, so the signature could not be verified with apksigner')
  } else if (!signature) {
    warn('apksigner was unavailable, so the signature was not verified')
  }

  for (const a of collected) {
    console.log(`      ${c.b(a.kind.padEnd(3))} ${rel(a.dest)}  ${c.d(mb(a.size))}`)
  }
  fs.writeFileSync(path.join(OUT_DIR, 'SHA256SUMS.txt'),
    `${collected.map((a) => `${a.hash}  ${path.basename(a.dest)}`).join('\n')}\n`)

  if (signature) {
    console.log(`\n      ${c.g('Signed with')} ${signature.dn}`)
    console.log(`      ${c.g('Certificate SHA-256')} ${signature.fingerprint}`)
    console.log(`      ${c.g('Signature schemes')} ${signature.schemes} (min SDK 22)`)
  }
  return collected
}

function summary(versionName, versionCode, collected, elapsedSec) {
  const apk = collected.find((a) => a.kind === 'APK')
  const aab = collected.find((a) => a.kind === 'AAB')
  console.log(`\n${c.b(c.g('Release ready'))} ${c.b(`in ${Math.round(elapsedSec)}s`)}`)
  console.log(`  app        ${capConfig.appName} (${capConfig.appId})`)
  console.log(`  version    ${versionName}  (versionCode ${versionCode})`)
  if (apk) console.log(`  install    adb install -r ${rel(apk.dest)}`)
  if (aab) console.log(`  Play Store upload the .aab: ${rel(aab.dest)}`)
  console.log(`  checksums  ${rel(path.join(OUT_DIR, 'SHA256SUMS.txt'))}`)
  console.log(`\n${c.d('  The app bundles the build in dist/, so re-run `npm run release` after any')}`)
  console.log(`${c.d('  web change. Backup signing/ — that key must never change or be lost.')}\n`)
}

// --- entry point ------------------------------------------------------------
try {
  const started = Date.now()
  console.log(c.b(`\n${capConfig.appName} — production Android release`))
  info(`versionName ${pkg.version} · targets ${TARGETS.join(', ')} · package.json ${pkg.name}`)
  if (DRY_RUN) warn('dry run: steps 6-9 (web build, sync, gradle, collect) are skipped')

  preflight()
  ensureNativeProject()
  ensureToolchain()
  ensureSigningConfig()
  ensureKeystore()

  if (DRY_RUN) {
    console.log(`\n${c.g('Dry run complete — the release toolchain and signing setup are ready.')}\n`)
    process.exit(0)
  }

  const versionCode = nextVersionCode()
  buildWeb()
  capacitorSync()
  gradleBuild(pkg.version, versionCode)
  const collected = collectArtifacts(pkg.version, versionCode)
  summary(pkg.version, versionCode, collected, (Date.now() - started) / 1000)
} catch (err) {
  console.error(`\n${c.r('✖ Release failed')} ${err.message}\n`)
  process.exit(1)
}
