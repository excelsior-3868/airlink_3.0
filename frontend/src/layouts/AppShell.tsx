import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Package, Users2, Store, Wallet as WalletIcon,
  Database, Ticket, BarChart3, LogOut, Wifi, Router, ShieldCheck, Shield,
  ChevronDown, ChevronRight, Key, Gauge
} from 'lucide-react'
import { Role, useAuth } from '../lib/auth'
import ChangePasswordModal from '../components/ChangePasswordModal'

interface NavItem {
  to?: string;
  label: string;
  icon: any;
  roles: Role[];
  color: string;
  children?: { to: string; label: string; roles: Role[]; icon: any; color: string }[];
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'reseller', 'seller'], color: 'text-blue-500' },
  {
    label: 'Plan',
    icon: Package,
    roles: ['admin', 'reseller', 'seller'],
    color: 'text-indigo-500',
    children: [
      { to: '/plans/hotspot', label: 'Hotspot Plans', roles: ['admin', 'reseller', 'seller'], icon: Wifi, color: 'text-sky-500' },
      { to: '/plans/pppoe', label: 'PPPOE Plans', roles: ['admin', 'reseller', 'seller'], icon: Router, color: 'text-indigo-500' },
      { to: '/plans/bandwidth', label: 'Bandwidth Plan', roles: ['admin', 'reseller', 'seller'], icon: Gauge, color: 'text-violet-500' },
    ]
  },
  { to: '/resellers', label: 'Resellers', icon: Users2, roles: ['admin'], color: 'text-purple-500' },
  { to: '/sellers', label: 'Sellers', icon: Store, roles: ['admin', 'reseller'], color: 'text-amber-500' },
  { to: '/wallet', label: 'Wallet', icon: WalletIcon, roles: ['admin', 'reseller', 'seller'], color: 'text-emerald-500' },
  { to: '/gb', label: 'GB Allocation', icon: Database, roles: ['admin', 'reseller', 'seller'], color: 'text-cyan-500' },
  { to: '/vouchers', label: 'Vouchers', icon: Ticket, roles: ['admin', 'reseller', 'seller'], color: 'text-rose-500' },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'reseller', 'seller'], color: 'text-teal-500' },
  { to: '/nas', label: 'NAS / Routers', icon: Router, roles: ['admin'], color: 'text-violet-500' },
  { to: '/logs', label: 'Login Logs', icon: ShieldCheck, roles: ['admin'], color: 'text-pink-500' },
  { to: '/permissions', label: 'Permissions', icon: Shield, roles: ['admin'], color: 'text-rose-600' },
]

export default function AppShell() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const [plansExpanded, setPlansExpanded] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  if (!user) return null
  const items = NAV.filter((n) => n.roles.includes(user.role))

  const doLogout = async () => {
    await logout()
    nav('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 lg:p-5 flex gap-4">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 app-sidebar-panel p-4 sticky top-4 h-[calc(100vh-2rem)]">
        <div className="flex items-center gap-3 px-2 py-2 mb-4">
          <div className="bg-[#003164] text-white rounded-2xl p-2.5 shadow-sm"><Wifi size={18} /></div>
          <div>
            <p className="font-medium text-2xl tracking-tight text-[#003164] leading-none">Airlink</p>
            <p className="text-[10px] text-slate-400 font-bold tracking-wider mt-1 uppercase">Billing v3.0</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1">
          {items.map((it) => {
            if (it.children) {
              const hasActiveChild = it.children.some((c) => location.pathname === c.to)
              return (
                <div key={it.label} className="flex flex-col">
                  <button
                    onClick={() => setPlansExpanded(!plansExpanded)}
                    className={`app-sidebar-nav-item w-full flex items-center justify-between group ${
                      hasActiveChild ? 'app-sidebar-nav-item-active' : 'app-sidebar-nav-item-idle'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <it.icon size={18} className={`transition-transform group-hover:scale-110 ${it.color}`} />
                      <span className="font-bold">{it.label}</span>
                    </div>
                    {plansExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {plansExpanded && (
                    <div className="pl-4 flex flex-col gap-1 mt-1 border-l border-slate-100 ml-4">
                      {it.children
                        .filter((c) => c.roles.includes(user.role))
                        .map((c) => (
                          <NavLink
                            key={c.to}
                            to={c.to}
                            className={({ isActive }) =>
                              `app-sidebar-nav-item text-sm group ${
                                isActive ? 'app-sidebar-nav-item-active' : 'app-sidebar-nav-item-idle'
                              }`
                            }
                          >
                            <c.icon size={16} className={`transition-transform group-hover:scale-110 ${c.color}`} />
                            <span>{c.label}</span>
                          </NavLink>
                        ))}
                    </div>
                  )}
                </div>
              )
            }
            return (
              <NavLink
                key={it.to}
                to={it.to!}
                end={it.to === '/'}
                className={({ isActive }) =>
                  `app-sidebar-nav-item group ${isActive ? 'app-sidebar-nav-item-active' : 'app-sidebar-nav-item-idle'}`
                }
              >
                <it.icon size={18} className={`transition-transform group-hover:scale-110 ${it.color}`} />
                {it.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Profile Card Dropdown Container */}
        <div ref={profileRef} className="relative mt-3 pt-3 border-t border-slate-100">
          {profileOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute bottom-[calc(100%+0.5rem)] left-0 w-full bg-white border border-slate-200/80 rounded-[24px] shadow-2xl p-2 z-40 flex flex-col gap-1"
            >
              <button
                onClick={() => {
                  setProfileOpen(false)
                  setPasswordOpen(true)
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all text-sm font-semibold text-left"
              >
                <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Key size={14} />
                </div>
                Change Password
              </button>

              <button
                onClick={() => {
                  setProfileOpen(false)
                  doLogout()
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-rose-50/50 text-slate-700 hover:text-rose-600 transition-all text-sm font-semibold text-left"
              >
                <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <LogOut size={14} />
                </div>
                Log Out
              </button>
            </motion.div>
          )}

          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-full flex items-center justify-between p-2 rounded-2xl border border-slate-200/80 hover:bg-slate-50 bg-white transition-all text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 text-rose-700 flex items-center justify-center font-extrabold text-sm shrink-0 shadow-inner uppercase">
                {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-sm text-[#003164] whitespace-normal break-words leading-tight select-none">{user.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 select-none">{user.role}</p>
              </div>
            </div>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''} shrink-0 ml-1`} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Outlet />
        </motion.main>
      </div>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  )
}
