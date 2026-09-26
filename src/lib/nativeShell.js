import { Capacitor } from '@capacitor/core'

// Called once, at app start. No-ops harmlessly in a plain browser tab
// (npm run dev) since every call is guarded behind isNativePlatform().
export async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    // overlay: false is what "guarantees" the status bar area — the
    // WebView is pushed down below it instead of drawing under it, so
    // nothing the app renders can ever end up hidden behind the clock/
    // battery icons. Style/Dark = light text+icons, for our dark-on-light
    // top bar; background matches the app's off-white background.
    await StatusBar.setOverlaysWebView({ overlay: false })
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#F4F2FA' })
  } catch {
    // Status bar plugin not available on this platform/build — ignore.
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    // launchAutoHide is also on in capacitor.config.json, but hiding it
    // explicitly once React has actually mounted avoids a flash of an
    // unstyled/blank screen if a slow device takes longer than the
    // configured auto-hide duration to finish its first render.
    await SplashScreen.hide()
  } catch {
    // Splash screen already hidden or plugin unavailable — ignore.
  }
}

// Android hardware back button: go back through in-app history first,
// and only exit the app once there's nowhere left to go back to (i.e.
// we're sitting on the root/home screen). Without this, Capacitor's
// default behaviour is to exit the app on every back press.
//
// Uses plain browser history (works with HashRouter or no router at all —
// e.g. the single-screen provider view) rather than react-router's
// useNavigate, so it can be wired up once from the top of the app with
// no dependency on which tree/role is currently mounted.
export function initBackButtonHandler() {
  if (!Capacitor.isNativePlatform()) return () => {}

  let listenerHandle
  let cancelled = false

  import('@capacitor/app').then(({ App }) => {
    if (cancelled) return
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back()
      } else {
        App.exitApp()
      }
    }).then((h) => { listenerHandle = h })
  })

  return () => {
    cancelled = true
    listenerHandle?.remove()
  }
}
