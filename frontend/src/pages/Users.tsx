import { useEffect, useState, Fragment } from 'react'
import { motion } from 'framer-motion'
import { Plus, Wallet, Database, UserPlus, Save, Users2, Store, FileText, CreditCard, CheckCircle2, RefreshCw, ChevronDown, ChevronUp, Percent, Coins, PlusCircle, Power } from 'lucide-react'
import { api, apiError } from '../lib/api'
import { useQuery, invalidateCache } from '../lib/cache'
import { useAuth } from '../lib/auth'
import { rs, gb, date, datet } from '../lib/format'
import { GlassCard, PageTitle, Modal, Pill, Pagination, EmptyState, Spinner } from '../components/ui'

export default function Users({ role }: { role: 'reseller' | 'seller' }) {
  const { user, refresh, can } = useAuth()
  const [page, setPage] = useState(1)

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<any>({ name: '', username: '', email: '', phone: '', password: '', parent_id: '', gb_rate: '' })
  const [fundUser, setFundUser] = useState<any>(null)
  const [fund, setFund] = useState({ amount: '', gb_amount: '', gb_paid: '' })
  const [collectUser, setCollectUser] = useState<any>(null)
  const [collectAmount, setCollectAmount] = useState('')
  const [collectNote, setCollectNote] = useState('')
  const [rateUser, setRateUser] = useState<any>(null)
  const [customRate, setCustomRate] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const [expandedUserId, setExpandedUserId] = useState<number | null>(null)
  const [historyData, setHistoryData] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const toggleExpand = (u: any) => {
    if (expandedUserId === u.id) {
      setExpandedUserId(null)
      setHistoryData([])
      return
    }

    setExpandedUserId(u.id)
    setLoadingHistory(true)
    setHistoryData([])
    Promise.all([
      api.get('/wallet/transactions', { params: { user_id: u.id, per_page: 100 } }),
      api.get('/billing/invoices', { params: { user_id: u.id, per_page: 100 } }),
      api.get('/billing/payments', { params: { user_id: u.id, per_page: 100 } })
    ]).then(([wRes, iRes, pRes]) => {
      const wList = (wRes.data.data?.data || wRes.data.data || []).map((t: any) => ({
        id: t.id,
        kind: 'wallet',
        title: t.type === 'load' ? 'Wallet Loaded' : (t.type === 'refund' ? 'Wallet Refunded' : 'Wallet Transaction'),
        reference: `TX-${t.id}`,
        subtext: `By: ${t.from_user?.username || 'System'} → ${t.to_user?.username || t.user?.username || 'User'}`,
        note: t.note,
        amountLabel: rs(t.amount),
        amountColor: t.type === 'refund' ? 'text-rose-600' : 'text-emerald-600',
        statusBadge: t.type.toUpperCase(),
        statusTone: t.type === 'load' ? 'success' : 'secondary',
        created_at: t.created_at,
        dateObj: new Date(t.created_at),
        sender_id: t.from_user_id,
        receiver_id: t.to_user_id || t.user_id,
      }))

      const iList = (iRes.data.data?.data || iRes.data.data || []).map((t: any) => ({
        id: t.id,
        kind: 'invoice',
        title: `GB Allocation (${gb(t.gb_amount)})`,
        reference: t.invoice_number,
        subtext: `Rate: Rs ${t.rate}/GB · Total: Rs ${t.total_amount} · By: ${t.sender?.username || 'System'}`,
        note: t.status === 'due' && t.paid_amount > 0 ? `Paid: Rs ${t.paid_amount} · Due: Rs ${t.total_amount - t.paid_amount}` : null,
        amountLabel: rs(t.total_amount),
        amountColor: 'text-purple-600',
        dueLabel: t.status !== 'paid' && (t.total_amount - (t.paid_amount || 0)) > 0 ? rs(t.total_amount - (t.paid_amount || 0)) : null,
        statusBadge: t.status.toUpperCase(),
        statusTone: t.status === 'paid' ? 'success' : 'danger',
        created_at: t.created_at,
        dateObj: new Date(t.created_at),
        sender_id: t.sender_id,
        receiver_id: t.receiver_id,
      }))

      const pList = (pRes.data.data?.data || pRes.data.data || []).map((t: any) => ({
        id: t.id,
        kind: 'payment',
        title: 'Payment Received',
        reference: `PAY-${t.id}`,
        subtext: `Collected by: ${t.receiver?.username || 'System'} · From: ${t.sender?.username || 'User'}`,
        note: t.note,
        amountLabel: rs(t.amount),
        amountColor: 'text-emerald-600',
        statusBadge: 'PAID',
        statusTone: 'success',
        created_at: t.payment_date || t.created_at,
        dateObj: new Date(t.payment_date || t.created_at),
        sender_id: t.sender_id,
        receiver_id: t.receiver_id,
      }))

      let filteredW = wList;
      let filteredI = iList;
      let filteredP = pList;

      if (role === 'reseller') {
        // Reseller page: show only transactions between Admin and Reseller
        filteredI = iList.filter((t: any) => t.receiver_id === u.id);
        filteredP = pList.filter((t: any) => t.receiver_id === user?.id || t.receiver_id === 1); // target receiver is Admin (user.id or 1)
      } else if (role === 'seller') {
        // Seller page: show only transactions between Reseller/Admin and Seller
        filteredI = iList.filter((t: any) => t.receiver_id === u.id);
        filteredP = pList.filter((t: any) => t.sender_id === u.id);
      }

      const merged = [...filteredW, ...filteredI, ...filteredP].sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())
      setHistoryData(merged)
    }).catch(() => {
      setHistoryData([])
    }).finally(() => {
      setLoadingHistory(false)
    })
  }

  const label = role === 'reseller' ? 'Reseller' : 'Seller'

  const { data, refetch } = useQuery<any>(
    `users?role=${role}&page=${page}`,
    () => api.get('/users', { params: { role, page } }).then((r) => r.data.data),
  )
  const { data: resellers = [] } = useQuery<any[]>(
    'users?role=reseller&per_page=100',
    () => api.get('/users', { params: { role: 'reseller', per_page: 100 } }).then((r) => r.data.data.data),
    { enabled: role === 'seller' && user?.role === 'admin' },
  )

  // Refresh this list plus balances/dashboard that a fund/status change affects.
  const load = () => {
    refetch()
    invalidateCache('users'); invalidateCache('dashboard'); invalidateCache('wallet'); invalidateCache('gb')
  }

  useEffect(() => { setPage(1) }, [role])
  useEffect(() => { setExpandedUserId(null); setHistoryData([]) }, [role, page])

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
      if (fund.gb_amount) await api.post('/gb/allocate', {
        user_id: fundUser.id,
        gb_amount: +fund.gb_amount,
        paid_amount: fund.gb_paid ? +fund.gb_paid : 0,
      })
      setFundUser(null); setFund({ amount: '', gb_amount: '', gb_paid: '' }); setExpandedUserId(null); setHistoryData([]); load(); refresh()
    } catch (e) { setErr(apiError(e)) } finally { setBusy(false) }
  }

  const savePayment = async () => {
    if (!collectUser) return
    setBusy(true)
    setErr('')
    try {
      await api.post('/billing/payments/collect', {
        user_id: collectUser.id,
        amount: +collectAmount,
        note: collectNote || undefined
      })
      setCollectUser(null)
      setCollectAmount('')
      setCollectNote('')
      load()
      refresh()
    } catch (e) {
      setErr(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageTitle title={`${label}s`} subtitle={`Manage your ${label.toLowerCase()} network`}
        icon={role === 'reseller' ? <Users2 size={22} className="text-purple-500" /> : <Store size={22} className="text-amber-500" />}
        action={<motion.button whileTap={{ scale: 0.95 }} className="btn-primary flex items-center gap-2" onClick={() => { setErr(''); setCreateOpen(true) }}><Plus size={16} /> New {label}</motion.button>} />

      {/* Action Guide / Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3.5 px-4 py-2.5 bg-slate-50 border border-slate-200/50 rounded-2xl text-xs text-slate-500 shadow-sm">
        <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Action Guide:</span>
        {user?.role === 'admin' && (
          <span className="flex items-center gap-1.5">
            <span className="p-1 rounded-md bg-teal-50 text-teal-600 inline-flex"><Percent size={12} /></span>
            <span>Edit GB Rate</span>
          </span>
        )}
        {can('wallet_load') && (
          <span className="flex items-center gap-1.5">
            <span className="p-1 rounded-md bg-emerald-50 text-emerald-600 inline-flex"><Coins size={12} /></span>
            <span>Collect Payment</span>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="p-1 rounded-md bg-slate-100 text-primary inline-flex"><PlusCircle size={12} /></span>
          <span>Load Wallet/GB</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="p-1 rounded-md bg-rose-50 text-rose-500 inline-flex"><Power size={12} /></span>
          <span>Enable/Disable</span>
        </span>
      </div>

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
              {(data?.data || []).map((u: any, idx: number) => {
                const isExpanded = expandedUserId === u.id;
                return (
                  <Fragment key={u.id}>
                    <motion.tr 
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      transition={{ delay: idx * 0.03 }} 
                      className="hover:bg-secondary/30 cursor-pointer select-none"
                      onClick={() => toggleExpand(u)}
                    >
                      <td className="font-semibold text-slate-800">{u.name}</td>
                      <td className="font-mono text-xs">{u.username}</td>
                      {role !== 'reseller' && <td>{rs(u.wallet_balance)}</td>}
                      <td className="text-rose-600 font-semibold">{rs(u.wallet_due)}</td>
                      <td>{gb(u.gb_balance)}</td>
                      <td>{rs(u.gb_rate)}/GB</td>
                      {role === 'reseller' && <td>{u.children_count ?? 0}</td>}
                      <td><Pill tone={u.status === 'active' ? 'success' : 'danger'}>{u.status === 'active' ? 'Active' : 'Disabled'}</Pill></td>
                      <td className="text-right pr-6 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {user?.role === 'admin' && (
                          <button className="text-teal-600 hover:text-teal-800 p-1.5 rounded-lg hover:bg-teal-50 transition-all inline-flex items-center justify-center mr-1" title="Rate" onClick={() => openEditRate(u)}>
                            <Percent size={14} />
                          </button>
                        )}
                        {+u.wallet_due > 0 && can('wallet_load') && (
                          <button className="text-emerald-600 hover:text-emerald-800 p-1.5 rounded-lg hover:bg-emerald-50 transition-all inline-flex items-center justify-center mr-1" title="Payment" onClick={() => { setCollectUser(u); setErr(''); setCollectAmount(''); setCollectNote(''); }}>
                            <Coins size={14} />
                          </button>
                        )}
                        <button className="text-primary hover:text-indigo-800 p-1.5 rounded-lg hover:bg-slate-100/80 transition-all inline-flex items-center justify-center mr-1" title="Load Wallet/GB" onClick={() => { setFundUser(u); setErr(''); setFund({ amount: '', gb_amount: '', gb_paid: '' }); }}>
                          <PlusCircle size={14} />
                        </button>
                        <button className={`${u.status === 'active' ? 'text-rose-500 hover:text-rose-700 hover:bg-rose-50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'} p-1.5 rounded-lg transition-all inline-flex items-center justify-center mr-1`} title={u.status === 'active' ? 'Disable' : 'Enable'} onClick={() => toggle(u)}>
                          <Power size={14} />
                        </button>
                        <button className="text-slate-500 hover:text-primary p-1.5 rounded-lg hover:bg-slate-100/80 transition-all inline-flex items-center justify-center" onClick={() => toggleExpand(u)}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </motion.tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/40">
                        <td colSpan={role === 'reseller' ? 9 : 8} className="py-4 px-6 border-b border-slate-200/60">
                          <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg shadow-sm border border-purple-200/50 shrink-0">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-800 text-sm">{u.name}</h4>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                  {u.phone || 'No phone'} · {u.username} · Rate: Rs {u.gb_rate}/GB
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                                {historyData.length} Transactions
                              </span>
                              {historyData[0] && (
                                <span className="text-xs text-slate-400">
                                  Last: {datet(historyData[0].created_at)}
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Transaction History</p>

                          {loadingHistory ? (
                            <div className="flex justify-center items-center py-8"><Spinner /></div>
                          ) : historyData.length === 0 ? (
                            <EmptyState>No transaction history found for this user.</EmptyState>
                          ) : (
                            <div className="relative border-l border-slate-200 pl-6 ml-4 my-2 space-y-3">
                              {historyData.map((t, i) => {
                                let iconBg = 'bg-blue-500';
                                let iconNode = <CreditCard size={10} className="text-white" />;
                                if (t.kind === 'wallet') {
                                  iconBg = 'bg-emerald-500';
                                  iconNode = <Wallet size={10} className="text-white" />;
                                } else if (t.kind === 'invoice') {
                                  iconBg = 'bg-purple-500';
                                  iconNode = <FileText size={10} className="text-white" />;
                                }

                                return (
                                  <div key={i} className="relative pl-2">
                                    <div className={`absolute -left-[35px] top-3.5 w-5 h-5 rounded-full border border-slate-100 ${iconBg} shadow-sm flex items-center justify-center z-10`}>
                                      {iconNode}
                                    </div>

                                    <div className="bg-white hover:bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 flex justify-between gap-4 transition-colors text-xs items-center shadow-sm">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-bold text-slate-800 text-xs">{t.title}</span>
                                          {i === 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold border border-emerald-200 uppercase tracking-wide">
                                              Latest
                                            </span>
                                          )}
                                          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-bold border border-slate-200 font-mono">
                                            {t.reference}
                                          </span>
                                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                                            t.statusTone === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                            t.statusTone === 'danger' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                            'bg-slate-50 text-slate-700 border-slate-100'
                                          }`}>
                                            {t.statusBadge}
                                          </span>
                                        </div>

                                        <div className="mt-1 text-slate-500 flex items-center gap-1.5 flex-wrap text-[11px]">
                                          <span>{t.subtext}</span>
                                          {t.note && (
                                            <>
                                              <span className="text-slate-300">|</span>
                                              <span className="text-slate-400 italic">"{t.note}"</span>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      <div className="text-right shrink-0 flex flex-col justify-between py-0.5">
                                        <p className="text-[10px] text-slate-400">
                                          {datet(t.created_at)}
                                        </p>
                                        <p className={`text-sm font-extrabold mt-1.5 ${t.amountColor}`}>
                                          {t.amountLabel}
                                        </p>
                                        {t.dueLabel && (
                                          <p className="text-[10px] font-bold text-rose-500 mt-0.5">
                                            Due: {t.dueLabel}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
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

      <Modal open={!!fundUser} onClose={() => setFundUser(null)} title={`Load Wallet/GB — ${fundUser?.name || ''}`}>
        <div className="space-y-3">
          <div className="relative">
            <Wallet size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10" type="number" placeholder="Wallet amount (Rs)" value={fund.amount} onChange={(e) => setFund({ ...fund, amount: e.target.value })} />
          </div>
          <div className="relative">
            <Database size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10" type="number" placeholder="GB amount" value={fund.gb_amount} onChange={(e) => setFund({ ...fund, gb_amount: e.target.value })} />
          </div>

          {+fund.gb_amount > 0 && (() => {
            const total = +fund.gb_amount * +(fundUser?.gb_rate || 0)
            const paid = Math.min(+fund.gb_paid || 0, total)
            const due = Math.max(total - paid, 0)
            return (
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Allocation cost</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{rs(total)}</span>
                    <span className="text-[10px] text-rose-500 font-semibold">Due: {rs(due)}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">@ {rs(fundUser?.gb_rate)}/GB</span>
                </div>
                <div className="relative">
                  <Wallet size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input pl-10"
                    type="number"
                    min="0"
                    max={total}
                    step="0.01"
                    placeholder="Paid now (Rs) — optional"
                    value={fund.gb_paid}
                    onChange={(e) => setFund({ ...fund, gb_paid: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/70">
                  <span className="text-slate-500 font-semibold">Remaining due (added)</span>
                  <span className={`font-bold ${due > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{rs(due)}</span>
                </div>
              </div>
            )
          })()}

          <p className="text-xs text-muted-foreground">
            Your balance: {rs(user!.wallet_balance)} · {gb(user!.gb_balance)}
          </p>
          {err && <div className="pill danger w-full justify-center py-2">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setFundUser(null)}>Cancel</button>
            <motion.button whileTap={{ scale: 0.95 }} className="btn-primary" disabled={busy} onClick={saveFund}>{busy ? 'Processing…' : 'Load'}</motion.button>
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

      <Modal open={!!collectUser} onClose={() => setCollectUser(null)} title={`Collect Payment — ${collectUser?.name || ''}`}>
        <div className="space-y-4">
          <div className="bg-slate-50/50 border border-slate-200/50 p-3 rounded-2xl text-xs flex justify-between items-center">
            <div>
              <p className="text-slate-400 font-semibold">Current Wallet Due:</p>
              <p className="text-rose-600 font-extrabold text-sm mt-0.5">{rs(collectUser?.wallet_due)}</p>
            </div>
            {+collectAmount > 0 && (
              <div className="text-right">
                <p className="text-slate-400 font-semibold">Remaining Due:</p>
                <p className="text-slate-800 font-bold mt-0.5">{rs(Math.max(+(collectUser?.wallet_due || 0) - +collectAmount, 0))}</p>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5 flex items-center gap-1">
              <Wallet size={14} className="text-emerald-500" />
              Payment Amount (Rs)
            </label>
            <input
              className="input"
              type="number"
              min="0.01"
              step="0.01"
              max={collectUser?.wallet_due}
              placeholder="e.g. 1000"
              value={collectAmount}
              onChange={(e) => setCollectAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">
              Note / Reference
            </label>
            <input
              className="input"
              placeholder="e.g. Cash collection"
              value={collectNote}
              onChange={(e) => setCollectNote(e.target.value)}
            />
          </div>

          {err && <div className="pill danger w-full justify-center py-2">{err}</div>}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button className="btn-ghost" onClick={() => setCollectUser(null)}>Cancel</button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="btn-primary"
              disabled={busy || !collectAmount || +collectAmount <= 0}
              onClick={savePayment}
            >
              {busy ? 'Processing…' : 'Collect'}
            </motion.button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
