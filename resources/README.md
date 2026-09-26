# App icon & splash assets

This folder is where `@capacitor/assets` (added as a dev dependency) looks
for source images to generate every density/platform variant from.

## Once you have the splash image file

1. Save it here as `resources/splash.png` (ideally at least 2732×2732px,
   your logo/art centered — the generator crops/pads the edges per
   platform, so keep anything important within the middle ~60%).
   Also drop `resources/icon.png` here (1024×1024px, no transparency) if
   you want a matching app icon generated at the same time.
2. Make sure the native platforms exist (only needs doing once):
   ```
   npx cap add android
   npx cap add ios   # if you're building for iOS too
   ```
3. Generate every required size for both platforms:
   ```
   npx capacitor-assets generate
   ```
4. Rebuild and sync so the native projects pick up the new files:
   ```
   npm run build
   npm run cap:sync
   ```

`capacitor.config.json` already has the `SplashScreen`/`StatusBar` plugin
settings configured (background color, no-overlay status bar, auto-hide
timing) — step 3 above only needs to (re)run whenever the source image
changes.
