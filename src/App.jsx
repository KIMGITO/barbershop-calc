import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import { useShopStore } from './store/useShopStore'
import { startSyncLoop } from './lib/sync'
import { initNativeShell, initBackButtonHandler } from './lib/nativeShell'
import NetworkBanner from './components/NetworkBanner'
import BottomNav, { OWNER_TABS, providerTabs } from './components/BottomNav'
import { useProviderStore } from './store/useProviderStore'

import AdminOnboarding from './screens/AdminOnboarding'
import ProviderClaim from './screens/ProviderClaim'
import ProviderHome from './screens/ProviderHome'
import ProviderHistory from './screens/ProviderHistory'
import RecordService from './screens/RecordService'
import Requests from './screens/Requests'
import Home from './screens/Home'
import ProviderList from './screens/ProviderList'
import AddProvider from './screens/AddProvider'
import ProviderDetail from './screens/ProviderDetail'
import AddEarning from './screens/AddEarning'
import AddPayout from './screens/AddPayout'
import Services from './screens/Services'
import History from './screens/History'
import ShopDashboard from './screens/ShopDashboard'

export default function App() {
  const { role, shop, ready, init } = useAuthStore()
  const setShopId = useShopStore((s) => s.setShopId)

  useEffect(() => {
    init()
    const stopSync = startSyncLoop()
    initNativeShell()
    const stopBackButton = initBackButtonHandler()
    return () => { stopSync(); stopBackButton() }
  }, [])

  useEffect(() => {
    if (role === 'owner' && shop) setShopId(shop.id)
  }, [role, shop])

  if (!ready) return null

  if (role === 'provider') {
    return (
      <ProviderShell />
    )
  }

  if (role === 'owner') {
    return (
      <HashRouter>
        <NetworkBanner />
        <RequestsPoller />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/providers" element={<ProviderList />} />
          <Route path="/add-provider" element={<AddProvider />} />
          <Route path="/services" element={<Services />} />
          <Route path="/dashboard" element={<ShopDashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/provider/:id" element={<ProviderDetail />} />
          <Route path="/provider/:id/add-earning" element={<AddEarning />} />
          <Route path="/provider/:id/add-payout" element={<AddPayout />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <OwnerNav />
      </HashRouter>
    )
  }

  // No session at all yet: let the person choose which side they're on.
  return <RoleChoice />
}

function RoleChoice() {
  const adminExists = useAuthStore((s) => s.adminExists)
  const [exists, setExists] = useState(null) // null = checking
  const [choice, setChoice] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    adminExists().then(setExists).catch((e) => setError(e.message || 'Could not reach the server.'))
  }, [])

  if (error) {
    return <div style={{ padding: 24, color: '#D9482B' }}>{error}</div>
  }
  if (exists === null) return null

  // Fresh install: the first person in becomes the one admin.
  if (!exists) return <AdminOnboarding mode="setup" />

  if (choice === 'owner') return <AdminOnboarding mode="resume" onBack={() => setChoice(null)} />
  if (choice === 'provider') return <ProviderClaim />
  return (
    <div style={{ padding: 24, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Barbershop</div>
      <button onClick={() => setChoice('owner')} style={{ padding: 16, borderRadius: 14, border: 'none', background: '#7C5CFC', color: '#fff', fontWeight: 700 }}>
        I'm the Admin
      </button>
      <button onClick={() => setChoice('provider')} style={{ padding: 16, borderRadius: 14, border: '1px solid #7C5CFC', background: '#fff', color: '#7C5CFC', fontWeight: 700 }}>
        I'm a Service Provider
      </button>
    </div>
  )
}

// Keeps the admin's approvals inbox fresh: on start, every 30s, and
// whenever the app comes back to the foreground.
function RequestsPoller() {
  const shopId = useShopStore((s) => s.shopId)
  const loadRequests = useShopStore((s) => s.loadRequests)

  useEffect(() => {
    if (!shopId) return
    loadRequests()
    const timer = setInterval(loadRequests, 30000)
    const onVisible = () => { if (document.visibilityState === 'visible') loadRequests() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [shopId])

  return null
}

function OwnerNav() {
  const pending = useShopStore((s) => s.requests.filter((r) => r.status === 'pending').length)
  return <BottomNav tabs={OWNER_TABS} badges={{ '/requests': pending }} />
}

// Provider side: loads their data once here (so every tab has it), keeps
// it fresh, and only shows the Record tab if the admin allowed it.
function ProviderShell() {
  const load = useProviderStore((s) => s.load)
  const canRecord = useProviderStore((s) => !!s.provider?.can_self_record)

  useEffect(() => {
    load()
    const timer = setInterval(load, 60000)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  return (
    <HashRouter>
      <NetworkBanner />
      <Routes>
        <Route path="/" element={<ProviderHome />} />
        <Route path="/record" element={<RecordService />} />
        <Route path="/history" element={<ProviderHistory />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <BottomNav tabs={providerTabs(canRecord)} />
    </HashRouter>
  )
}
