import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import AppShell from './layouts/AppShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import HotspotPlans from './pages/HotspotPlans'
import PppoePlans from './pages/PppoePlans'
import Bandwidths from './pages/Bandwidths'
import Users from './pages/Users'
import Wallet from './pages/Wallet'
import Gb from './pages/Gb'
import Vouchers from './pages/Vouchers'
import Reports from './pages/Reports'
import Nas from './pages/Nas'
import LoginLogs from './pages/LoginLogs'
import Permissions from './pages/Permissions'

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/plans" element={<Navigate to="/plans/hotspot" replace />} />
        <Route path="/plans/hotspot" element={<HotspotPlans />} />
        <Route path="/plans/pppoe" element={<PppoePlans />} />
        <Route path="/plans/bandwidth" element={<Bandwidths />} />
        <Route path="/resellers" element={<Users role="reseller" />} />
        <Route path="/sellers" element={<Users role="seller" />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/gb" element={<Gb />} />
        <Route path="/vouchers" element={<Vouchers />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/nas" element={<Nas />} />
        <Route path="/logs" element={<LoginLogs />} />
        <Route path="/permissions" element={<Permissions />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
