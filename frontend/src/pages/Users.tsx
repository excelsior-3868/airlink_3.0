import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Wallet, Database, UserPlus, Save, Users2, Store } from 'lucide-react'
import { api, apiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { rs, gb } from '../lib/format'
import { GlassCard, PageTitle, Modal, Pill, Pagination, EmptyState } from '../components/ui'

export default function Users({ role }: { role: 'reseller' | 'seller' }) {
  const { user, refresh } = useAuth()
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [resellers, setResellers] = useState<any[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<any>({ name: '', username: '', email: '', phone: '', password: '', parent_id: '', gb_rate: '' })
  const [fundUser, setFundUser] = useState<any>(null)
  const [fund, setFund] = useState({ amount: '', gb_amount: '' })
  const [rateUser, setRateUser] = useState<any>(null)
  const [customRate, setCustomRate] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const label = role === 'reseller' ? 'Reseller' : 'Seller'

  const load = () => {
    api.get('/users', { params: { role, page } }).then((r) => setData(r.data.data))
  }

  useEffect(() => {
    load()
    if (role === 'seller' && user?.role === 'admin') {
      api.get('/users', { params: { role: 'reseller', per_page: 100 } }).then((r) => setResellers(r.data.data.data))
    }
  }, [role, page])

  const openEditRate = (u: any) => {
    setRateUser(u)
    setCustomRate(String(u.gb_rate))
    setErr('')
  }

  const saveRate = async () => {
    setBusy(true)
    setErr('')
    try {
      await api.patch(`/users/${rateUser.id}/gb-rate`, { gb_rate: +customRate })
      setRateUser(null)
      setCustomRate('')
      load()
    } catch (e) {
      setErr(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  const saveUser = async () => {
    setBusy(true)
    setErr('')
    try {
      const pid = role === 'seller' ? (user?.role === 'reseller' ? user.id : form.parent_id) : user!.id
      const payload = { ...form }
      if (user?.role !== 'admin') {
        delete payload.gb_rate
      }
      await api.post(`/${role}s`, { ...payload, parent_id: pid })
      setCreateOpen(false)
      setForm({ name: '', username: '', email: '', phone: '', password: '', parent_id: '', gb_rate: '' })
      load()
    } catch (e) {
      setErr(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (u: any) => {
    const status = u.status === 'active' ? 'disabled' : 'active'
    try { await api.patch(`/users/${u.id}/status`, { status }); load() } catch (e) { alert(apiError(e)) }
  }

  const saveFund = async () => {
    setBusy(true)
    setErr('')
    try {
      if (fund.amount) await api.post('/wallet/load', { user_id: fundUser.id, amount: +fund.amount })
      if (fund.gb_amount) await api.post('/gb/allocate', { user_id: fundUser.id, gb_amount: +fund.gb_amount })
      setFundUser(null); setFund({ amount: '', gb_amount: '' }); load(); refresh()
    } catch (e) { setErr(apiError(e)) } finally { setBusy(false) }
  }

  return (
    <div>
      <PageTitle title={`${label}s`} subtitle={`Manage your ${label.toLowerCase()} network`}
        icon={role === 'reseller' ? <Users2 size={22} className="text-purple-500" /> : <Store size={22} className="text-amber-500" />}
        action={<motion.button whileTap={{ scale: 0.95 }} className="btn-primary flex items-center gap-2" onClick={() => { setErr(''); setCreateOpen(true) }}><Plus size={16} /> New {label}</motion.button>} />

      <GlassCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                {role !== 'reseller' && <th>Wallet Balance</th>}
                <th>Wallet Due</th>
                <th>GB Balance</th>
                <th>GB Rate</th>
                {role === 'reseller' && <th>Sellers</th>}
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data?.data || []).map((u: any, idx: number) => (
                <motion.tr key={u.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }} className="hover:bg-secondary/30">
                  <td className="font-semibold">{u.name}</td>
                  <td className="font-mono text-xs">{u.username}</td>
                  {role !== 'reseller' && <td>{rs(u.wallet_balance)}</td>}
                  <td className="text-rose-600 font-semibold">{rs(u.wallet_due)}</td>
                  <td>{gb(u.gb_balance)}</td>
                  <td>{rs(u.gb_rate)}/GB</td>
                  {role === 'reseller' && <td>{u.children_count ?? 0}</td>}
                  <td><Pill tone={u.status === 'active' ? 'success' : 'danger'}>{u.status}</Pill></td>
                  <td className="text-right pr-6 whitespace-nowrap">
                    {user?.role === 'admin' && (
                      <button className="text-xs font-bold text-teal-600 hover:underline mr-3" onClick={() => openEditRate(u)}>Rate</button>
                    )}
                    <button className="text-xs font-bold text-primary hover:underline mr-3" onClick={() => { setFundUser(u); setErr(''); setFund({ amount: '', gb_amount: '' }) }}>Fund</button>
                    <button className="text-xs font-bold text-slate-500 hover:underline" onClick={() => toggle(u)}>{u.status === 'active' ? 'Disable' : 'Enable'}</button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {(data?.data || []).length === 0 && <EmptyState>No {label.toLowerCase()}s yet.</EmptyState>}
        </div>
        <div className="p-4"><Pagination meta={data} onPage={setPage} /></div>
      </GlassCard>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={`Create New ${label}`}
        subtitle={`Add a new ${label.toLowerCase()} account to the network without leaving management view.`}
        icon={<UserPlus size={22} />}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Full Name</label>
              <input className="input" placeholder="e.g. John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Username</label>
              <input className="input" placeholder="e.g. johndoe" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Email Address</label>
              <input className="input" type="email" placeholder="e.g. john@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Phone Number</label>
              <input className="input" placeholder="e.g. +977-98..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>

            {role === 'seller' && user?.role === 'admin' && (
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Parent Reseller</label>
                <select className="input" value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
                  <option value="">Select parent reseller…</option>
                  {resellers.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.username})</option>)}
                </select>
              </div>
            )}

            {user?.role === 'admin' && (
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">GB Rate (Rs. per GB)</label>
                <input className="input" type="number" min="0.01" step="0.01" placeholder="e.g. 100.00" value={form.gb_rate} onChange={(e) => setForm({ ...form, gb_rate: e.target.value })} />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Password</label>
              <input className="input" type="password" placeholder="••••••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>

          {err && <div className="pill danger w-full justify-center py-2">{err}</div>}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button className="btn-ghost !border-slate-200 !text-slate-700 hover:!bg-slate-50 py-2.5 px-6 rounded-2xl font-bold transition-all" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="btn-primary flex items-center gap-2 py-2.5 px-6 rounded-2xl font-bold shadow-md transition-all"
              disabled={busy}
              onClick={saveUser}
            >
              <Save size={16} />
              {busy ? 'Saving...' : `Save ${label}`}
            </motion.button>
          </div>
        </div>
      </Modal>

      <Modal open={!!fundUser} onClose={() => setFundUser(null)} title={`Fund ${fundUser?.name || ''}`}>
        <div className="space-y-3">
          {role !== 'reseller' && (
            <div className="relative">
              <Wallet size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-10" type="number" placeholder="Wallet amount (Rs)" value={fund.amount} onChange={(e) => setFund({ ...fund, amount: e.target.value })} />
            </div>
          )}
          <div className="relative">
            <Database size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10" type="number" placeholder="GB amount" value={fund.gb_amount} onChange={(e) => setFund({ ...fund, gb_amount: e.target.value })} />
          </div>
          <p className="text-xs text-muted-foreground">
            {role === 'reseller' ? (
              <>GB Wallet: {gb(user!.gb_balance)}</>
            ) : (
              <>Your balance: {rs(user!.wallet_balance)} · {gb(user!.gb_balance)}</>
            )}
          </p>
          {err && <div className="pill danger w-full justify-center py-2">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setFundUser(null)}>Cancel</button>
            <motion.button whileTap={{ scale: 0.95 }} className="btn-primary" disabled={busy} onClick={saveFund}>{busy ? 'Processing…' : 'Fund'}</motion.button>
          </div>
        </div>
      </Modal>

      <Modal open={!!rateUser} onClose={() => setRateUser(null)} title={`Edit GB Rate: ${rateUser?.name || ''}`}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">GB Rate (Rs per GB)</label>
            <input
              className="input"
              type="number"
              min="0.01"
              step="0.01"
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
            />
          </div>
          {err && <div className="pill danger w-full justify-center py-2">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setRateUser(null)}>Cancel</button>
            <motion.button whileTap={{ scale: 0.95 }} className="btn-primary" disabled={busy} onClick={saveRate}>{busy ? 'Saving…' : 'Save Rate'}</motion.button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
