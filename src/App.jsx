import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import { useShopStore } from './store/useShopStore'
import { startSyncLoop } from './lib/sync'
import NetworkBanner from './components/NetworkBanner'

import OwnerLogin from './screens/OwnerLogin'
import ProviderClaim from './screens/ProviderClaim'
import ProviderHome from './screens/ProviderHome'
import ProviderList from './screens/ProviderList'
import ProviderDetail from './screens/ProviderDetail'
import AddEarning from './screens/AddEarning'
import AddPayout from './screens/AddPayout'
import History from './screens/History'
import ShopDashboard from './screens/ShopDashboard'

// TODO: replace with your real shop id once you've created the shop row,
// or fetch it after owner sign-in (select id from shops where owner_user_id = auth.uid()).
const DEMO_SHOP_ID = 'REPLACE-WITH-YOUR-SHOP-ID'

export default function App() {
  const { role, ready, init, ownerSession } = useAuthStore()
  const setShopId = useShopStore((s) => s.setShopId)

  useEffect(() => {
    init()
    const stop = startSyncLoop()
    return stop
  }, [])

  useEffect(() => {
    if (role === 'owner') setShopId(DEMO_SHOP_ID)
  }, [role])

  if (!ready) return null

  if (role === 'provider') {
    return (
      <>
        <NetworkBanner />
        <ProviderHome />
      </>
    )
  }

  if (role === 'owner') {
    return (
      <HashRouter>
        <NetworkBanner />
        <Routes>
          <Route path="/" element={<ProviderList />} />
          <Route path="/dashboard" element={<ShopDashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/provider/:id" element={<ProviderDetail />} />
          <Route path="/provider/:id/add-earning" element={<AddEarning />} />
          <Route path="/provider/:id/add-payout" element={<AddPayout />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </HashRouter>
    )
  }

  // No session at all yet: let the person choose which side they're on.
  return <RoleChoice />
}

function RoleChoice() {
  const [choice, setChoice] = useState(null)
  if (choice === 'owner') return <OwnerLogin />
  if (choice === 'provider') return <ProviderClaim shopId={DEMO_SHOP_ID} />
  return (
    <div style={{ padding: 24, minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Barbershop</div>
      <button onClick={() => setChoice('owner')} style={{ padding: 16, borderRadius: 14, border: 'none', background: '#7C5CFC', color: '#fff', fontWeight: 700 }}>
        I'm the Owner
      </button>
      <button onClick={() => setChoice('provider')} style={{ padding: 16, borderRadius: 14, border: '1px solid #7C5CFC', background: '#fff', color: '#7C5CFC', fontWeight: 700 }}>
        I'm a Service Provider
      </button>
    </div>
  )
}
