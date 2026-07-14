import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Ticket, Download, Zap, AlertTriangle, Printer, Layers, Eye, ShieldAlert } from 'lucide-react'
import { api, apiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { rs, gb, date, num } from '../lib/format'
import { statusPill } from '../lib/format'
import { GlassCard, PageTitle, Pagination, Pill, Modal, EmptyState, CustomSelect } from '../components/ui'

export default function Vouchers() {
  const { user, refresh } = useAuth()
  const [activeTab, setActiveTab] = useState<'vouchers' | 'batches'>('vouchers')
  
  // Vouchers state
  const [plans, setPlans] = useState<any[]>([])
  const [bandwidths, setBandwidths] = useState<any[]>([])
  const [permissions, setPermissions] = useState<any[]>([])
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<any>({ status: '', code: '', batch: '' })

  // Batches state
  const [batchesData, setBatchesData] = useState<any>(null)
  const [batchesPage, setBatchesPage] = useState(1)
  const [batchFilters, setBatchFilters] = useState<any>({ plan_id: '', batch_code: '' })

  // Generator state
  const [genOpen, setGenOpen] = useState(false)
  const [gen, setGen] = useState<any>({
    plan_id: '', quantity: 1, validity_days: '', custom_price: '', custom_base_price: '',
    custom_name: '', custom_plan_type: 'data', custom_bandwidth_id: '', custom_data_gb: '',
    custom_validity_days: '', custom_selling_price: '', custom_base_price_val: '', custom_purchase_source: 'gb',
    reseller_id: '', seller_id: ''
  })
  const [result, setResult] = useState<any>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // Sell state
  const [sellVoucher, setSellVoucher] = useState<any>(null)
  const [customerUsername, setCustomerUsername] = useState('')
  const [selling, setSelling] = useState(false)

  // Quick Sales Portal downline mapping / Generate Vouchers downline selection
  const [allResellers, setAllResellers] = useState<any[]>([])
  const [allSellers, setAllSellers] = useState<any[]>([])
  const [filteredSellersMap, setFilteredSellersMap] = useState<Record<number, any[]>>({})

  // Fetch reference on load
  useEffect(() => {
    api.get('/plans', { params: { active_only: 1 } }).then((r) => setPlans(r.data.data))
    api.get('/bandwidths').then((r) => setBandwidths(r.data.data))
    api.get('/permissions').then((r) => setPermissions(r.data.data))
  }, [])

  useEffect(() => {
    if (!user) return
    if (user.role === 'admin') {
      api.get('/users', { params: { role: 'reseller', per_page: 100 } }).then((r) => setAllResellers(r.data.data.data))
      api.get('/users', { params: { role: 'seller', per_page: 500 } }).then((r) => {
        setAllSellers(r.data.data.data)
        const map: any = {}
        r.data.data.data.forEach((s: any) => {
          if (!map[s.parent_id]) map[s.parent_id] = []
          map[s.parent_id].push(s)
        })
        setFilteredSellersMap(map)
      })
    } else if (user.role === 'reseller') {
      api.get('/users', { params: { role: 'seller', per_page: 100 } }).then((r) => setAllSellers(r.data.data.data))
    }
  }, [user])

  const canCustomize = (feature: string) => {
    if (user?.role === 'admin') return true
    const perm = permissions.find((p) => p.feature === feature)
    return perm ? !!perm[user!.role] : false
  }

  const load = () => api.get('/vouchers', { params: { page, ...cleanFilters() } }).then((r) => setData(r.data.data))
  const cleanFilters = () => Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  useEffect(() => { load() }, [page])

  const loadBatches = () => api.get('/batches', { params: { page: batchesPage, ...cleanBatchFilters() } }).then((r) => setBatchesData(r.data.data))
  const cleanBatchFilters = () => Object.fromEntries(Object.entries(batchFilters).filter(([, v]) => v))
  useEffect(() => { 
    if (activeTab === 'batches') loadBatches() 
  }, [batchesPage, activeTab])

  const selectedPlan = useMemo(() => plans.find((p) => p.id === +gen.plan_id), [plans, gen.plan_id])

  const targetUser = useMemo(() => {
    if (gen.seller_id) {
      return allSellers.find((s) => s.id === +gen.seller_id)
    }
    if (gen.reseller_id) {
      return allResellers.find((r) => r.id === +gen.reseller_id)
    }
    return user
  }, [gen.reseller_id, gen.seller_id, allResellers, allSellers, user])

  const targetGbBalance = targetUser ? +targetUser.gb_balance : 0
  const targetWalletBalance = targetUser ? +targetUser.wallet_balance : 0

  const customPlanGb = gen.custom_plan_type === 'data' ? (+gen.custom_data_gb || 0) : 0
  const genTotalGb = gen.plan_id === 'custom' 
    ? customPlanGb * gen.quantity 
    : (selectedPlan ? (selectedPlan.data_gb || 0) * gen.quantity : 0)
  
  const isGenShortGb = gen.plan_id === 'custom' 
    ? (gen.custom_purchase_source === 'gb' && genTotalGb > targetGbBalance)
    : (genTotalGb > targetGbBalance)

  const isGenShortWallet = gen.plan_id === 'custom' && gen.custom_purchase_source === 'wallet' && ((+gen.custom_base_price_val || 0) * gen.quantity) > targetWalletBalance

  const generate = async () => {
    setBusy(true); setErr('')
    try {
      let finalPlanId = gen.plan_id
      
      if (gen.plan_id === 'custom') {
        const payloadPlan: any = {
          name: gen.custom_name,
          type: 'hotspot',
          plan_type: gen.custom_plan_type || 'data',
          bandwidth_id: gen.custom_bandwidth_id || null,
          data_gb: gen.custom_plan_type === 'data' ? (+gen.custom_data_gb || null) : null,
          validity_days: +gen.custom_validity_days || 30,
          base_price: +gen.custom_base_price_val || 0,
          selling_price: +gen.custom_selling_price || 0,
          status: 'active'
        }
        const { data: planRes } = await api.post('/plans', payloadPlan)
        finalPlanId = planRes.data.id
        // reload plans
        const rPl = await api.get('/plans', { params: { active_only: 1 } })
        setPlans(rPl.data.data)
      }

      const payload: any = {
        plan_id: +finalPlanId,
        quantity: +gen.quantity,
        purchase_source: gen.plan_id === 'custom' ? (gen.custom_purchase_source || 'gb') : 'gb',
      }
      if (gen.validity_days) payload.validity_days = +gen.validity_days
      if (gen.custom_price) payload.custom_price = +gen.custom_price
      if (gen.custom_base_price) payload.custom_base_price = +gen.custom_base_price
      if (gen.seller_id) {
        payload.owner_id = +gen.seller_id
      } else if (gen.reseller_id) {
        payload.owner_id = +gen.reseller_id
      }
      
      const { data } = await api.post('/vouchers/generate', payload)
      setResult(data.data); refresh(); load()
    } catch (e) { setErr(apiError(e)) } finally { setBusy(false) }
  }

  const download = async (kind: 'export' | 'export-xlsx', extraParams?: any) => {
    const res = await api.get(`/vouchers/${kind}`, { params: { ...cleanFilters(), ...extraParams }, responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = kind === 'export' ? 'vouchers.csv' : 'vouchers.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const openBlob = async (path: string, params?: any) => {
    const res = await api.get(path, { params, responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    window.open(url, '_blank')
  }

  const handleSell = async () => {
    if (!sellVoucher) return
    setSelling(true)
    try {
      await api.post(`/vouchers/${sellVoucher.id}/sell`, { customer_username: customerUsername })
      setSellVoucher(null)
      setCustomerUsername('')
      load()
      refresh()
    } catch (e) { alert(apiError(e)) } finally { setSelling(false) }
  }

  const toggleDisable = async (v: any) => {
    try {
      const endpoint = v.status === 'disabled' ? `/vouchers/${v.id}/enable` : `/vouchers/${v.id}/disable`
      await api.patch(endpoint)
      load()
    } catch (e) {
      alert(apiError(e))
    }
  }

  return (
    <div>
      <PageTitle title="Vouchers" subtitle="Generate & manage voucher cards"
        icon={<Ticket size={22} className="text-rose-500" />}
        action={
          <div className="flex gap-2">
            <button className="btn-ghost flex items-center gap-1.5" onClick={() => download('export')}><Download size={15} /> CSV</button>
            <button className="btn-ghost flex items-center gap-1.5" onClick={() => download('export-xlsx')}><Download size={15} /> Excel</button>
            <motion.button whileTap={{ scale: 0.95 }} className="btn-primary flex items-center gap-2" onClick={() => { setGen({ plan_id: '', quantity: 1, validity_days: '', custom_price: '', custom_base_price: '', custom_name: '', custom_plan_type: 'data', custom_bandwidth_id: '', custom_data_gb: '', custom_validity_days: '', custom_selling_price: '', custom_base_price_val: '', custom_purchase_source: 'gb', reseller_id: '', seller_id: '' }); setResult(null); setErr(''); setGenOpen(true) }}>
              <Zap size={16} /> Generate
            </motion.button>
          </div>
        } />

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-slate-200 pb-2">
        <button 
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-xl border-b-2 transition-all ${activeTab === 'vouchers' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          onClick={() => setActiveTab('vouchers')}
        >
          <Ticket size={16} /> Vouchers List
        </button>
        <button 
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-xl border-b-2 transition-all ${activeTab === 'batches' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          onClick={() => setActiveTab('batches')}
        >
          <Layers size={16} /> Batches List
        </button>
      </div>

      {activeTab === 'vouchers' ? (
        <>
          {/* Filters */}
          <GlassCard className="mb-4 flex flex-wrap gap-3 items-end relative z-10">
            <div className="flex flex-col"><label className="text-xs font-semibold text-slate-500 mb-1">Status</label>
              <CustomSelect
                value={filters.status}
                onChange={(val) => setFilters({ ...filters, status: val })}
                options={[
                  { value: '', label: 'All Statuses' },
                  ...['new', 'sold', 'active', 'expired', 'disabled'].map((s) => ({ value: s, label: s.toUpperCase() }))
                ]}
              /></div>
            <div><label className="text-xs font-semibold text-slate-500">Code</label><input className="input mt-1" value={filters.code} onChange={(e) => setFilters({ ...filters, code: e.target.value })} placeholder="Search code" /></div>
            <div><label className="text-xs font-semibold text-slate-500">Batch</label><input className="input mt-1" value={filters.batch} onChange={(e) => setFilters({ ...filters, batch: e.target.value })} placeholder="Batch code" /></div>
            <button className="btn-primary" onClick={() => { setPage(1); load() }}>Apply</button>
          </GlassCard>

          <GlassCard className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><th>Code</th><th>Plan</th><th>Data</th><th>Price</th><th>Status</th><th>Expires</th><th></th></tr></thead>
                <tbody>
                  {(data?.data || []).map((v: any, idx: number) => (
                    <motion.tr key={v.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }} className="hover:bg-secondary/30">
                      <td className="font-mono font-semibold">{v.code}</td>
                      <td>{v.plan?.name || '—'}</td>
                      <td>{v.data_gb ? gb(v.data_gb) : '—'}</td>
                      <td>{rs(v.price)}</td>
                      <td><Pill tone={statusPill[v.status] || 'secondary'}>{v.status}</Pill></td>
                      <td className="text-xs">{date(v.expires_at)}</td>
                      <td className="text-right whitespace-nowrap">
                        {v.status === 'new' && (
                          <button className="text-xs font-bold text-emerald-600 hover:underline mr-3" onClick={() => { setSellVoucher(v); setCustomerUsername(''); setSelling(false) }}>Sell</button>
                        )}
                        <button 
                          className={`text-xs font-bold hover:underline mr-3 ${v.status === 'disabled' ? 'text-sky-600' : 'text-slate-500'}`} 
                          onClick={() => toggleDisable(v)}
                        >
                          {v.status === 'disabled' ? 'Enable' : 'Disable'}
                        </button>
                        <button className="text-xs font-bold text-primary hover:underline" onClick={() => openBlob(`/vouchers/${v.id}/card`)}>Card</button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {(data?.data || []).length === 0 && <EmptyState>No vouchers match.</EmptyState>}
            </div>
            <div className="p-4"><Pagination meta={data} onPage={setPage} /></div>
          </GlassCard>
        </>
      ) : (
        <>
          {/* Batch Filters */}
          <GlassCard className="mb-4 flex flex-wrap gap-3 items-end relative z-10">
            <div className="flex flex-col"><label className="text-xs font-semibold text-slate-500 mb-1">Plan</label>
              <CustomSelect
                value={batchFilters.plan_id ? +batchFilters.plan_id : ''}
                onChange={(val) => setBatchFilters({ ...batchFilters, plan_id: val })}
                options={[
                  { value: '', label: 'All Plans' },
                  ...plans.map((p) => ({ value: p.id, label: p.name }))
                ]}
              /></div>
            <div><label className="text-xs font-semibold text-slate-500">Batch Code</label><input className="input mt-1" value={batchFilters.batch_code} onChange={(e) => setBatchFilters({ ...batchFilters, batch_code: e.target.value })} placeholder="Search batch" /></div>
            <button className="btn-primary" onClick={() => { setBatchesPage(1); loadBatches() }}>Apply</button>
          </GlassCard>

          <GlassCard className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><th>Batch Code</th><th>Plan</th><th>Quantity</th><th>Generated By</th><th>Created At</th><th></th></tr></thead>
                <tbody>
                  {(batchesData?.data || []).map((b: any, idx: number) => (
                    <motion.tr key={b.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }} className="hover:bg-secondary/30">
                      <td className="font-mono font-semibold">{b.batch_code}</td>
                      <td>{b.plan?.name || '—'}</td>
                      <td>{b.quantity}</td>
                      <td>{b.generated_by?.username || '—'}</td>
                      <td className="text-xs">{date(b.created_at)}</td>
                      <td className="text-right whitespace-nowrap">
                        <button className="text-xs font-bold text-emerald-600 hover:underline mr-3 flex items-center inline-flex gap-1" onClick={() => openBlob('/vouchers/print', { batch: b.batch_code })}><Printer size={13} /> Print Cards</button>
                        <button className="text-xs font-bold text-primary hover:underline mr-3 flex items-center inline-flex gap-1" onClick={() => download('export', { batch: b.batch_code })}><Download size={13} /> CSV</button>
                        <button className="text-xs font-bold text-primary hover:underline flex items-center inline-flex gap-1" onClick={() => download('export-xlsx', { batch: b.batch_code })}><Download size={13} /> Excel</button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {(batchesData?.data || []).length === 0 && <EmptyState>No batches found.</EmptyState>}
            </div>
            <div className="p-4"><Pagination meta={batchesData} onPage={setBatchesPage} /></div>
          </GlassCard>
        </>
      )}

      {/* Sell Voucher Modal */}
      <Modal open={!!sellVoucher} onClose={() => setSellVoucher(null)} title={`Sell Voucher: ${sellVoucher?.code}`}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500">Customer Username (Optional)</label>
            <input 
              className="input mt-1" 
              placeholder="e.g. hotel_room_101" 
              value={customerUsername} 
              onChange={(e) => setCustomerUsername(e.target.value)} 
            />
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="font-bold">{sellVoucher?.plan?.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="font-bold">{rs(sellVoucher?.price)}</span></div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-5">
            <button className="btn-ghost !border-slate-200 !text-slate-700 hover:!bg-slate-50 py-2.5 px-6 rounded-2xl font-bold transition-all" onClick={() => setSellVoucher(null)}>Cancel</button>
            <motion.button 
              whileTap={{ scale: 0.95 }} 
              className="btn-primary py-2.5 px-6 rounded-2xl font-bold transition-all shadow-md" 
              disabled={selling} 
              onClick={handleSell}
            >
              {selling ? 'Selling…' : 'Mark as Sold'}
            </motion.button>
          </div>
        </div>
      </Modal>

      {/* Generate Vouchers Modal */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate Vouchers">
        {result ? (
          <div className="space-y-3 text-center">
            <div className="bg-emerald-50 text-emerald-700 rounded-2xl p-4">
              <Ticket className="mx-auto mb-2" />
              <p className="font-bold">{result.message}</p>
              <p className="text-sm">Batch <span className="font-mono">{result.batch_code}</span> · {result.plan}</p>
            </div>
            <div className="text-xs text-left bg-slate-50 rounded-xl p-3 font-mono">{result.sample?.join(', ')}{result.quantity > 5 ? ' …' : ''}</div>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => openBlob('/vouchers/print', { batch: result.batch_code })}>Print cards</button>
              <button className="btn-primary flex-1" onClick={() => { setGenOpen(false) }}>Done</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* On Behalf Of (only if admin or reseller) */}
            {(user?.role === 'admin' || user?.role === 'reseller') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-slate-50/50 border border-slate-200/50 rounded-2xl">
                {user?.role === 'admin' && (
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5">Reseller</label>
                    <CustomSelect
                      className="w-full"
                      value={gen.reseller_id || ''}
                      onChange={(val) => setGen({ ...gen, reseller_id: val, seller_id: '' })}
                      placeholder="Myself (Admin)"
                      options={[
                        { value: '', label: 'Myself (Admin)' },
                        ...allResellers.map((r) => ({
                          value: String(r.id),
                          label: `${r.name} (${r.username})`,
                          badge: <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full uppercase shrink-0">{gb(r.gb_balance)}</span>
                        }))
                      ]}
                    />
                  </div>
                )}

                {/* Seller combo box */}
                {((user?.role === 'admin' && gen.reseller_id) || user?.role === 'reseller') && (
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5">Seller</label>
                    <CustomSelect
                      className="w-full"
                      value={gen.seller_id || ''}
                      onChange={(val) => setGen({ ...gen, seller_id: val })}
                      placeholder={user?.role === 'admin' ? "Reseller Balance" : "Myself (Reseller)"}
                      options={[
                        { value: '', label: user?.role === 'admin' ? 'Reseller Balance' : 'Myself (Reseller)' },
                        ...(user?.role === 'admin' ? (filteredSellersMap[+gen.reseller_id] || []) : allSellers).map((s) => ({
                          value: String(s.id),
                          label: `${s.name} (${s.username})`,
                          badge: <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full uppercase shrink-0">{gb(s.gb_balance)}</span>
                        }))
                      ]}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col"><label className="text-xs font-bold text-slate-500 uppercase mb-1.5">Select Plan</label>
              <CustomSelect
                className="w-full"
                value={gen.plan_id ? String(gen.plan_id) : ''}
                onChange={(val) => setGen({ ...gen, plan_id: val })}
                placeholder="Select plan..."
                options={[
                  { value: 'custom', label: '+ Create Custom Package' },
                  ...plans.map((p) => ({
                    value: String(p.id),
                    label: `${p.name}${p.data_gb ? ` — ${gb(p.data_gb)}` : ''}`,
                    badge: (() => {
                      const creator = p.creator
                      if (!creator || creator.role === 'admin') {
                        return <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full uppercase shrink-0">Admin</span>
                      }
                      if (creator.role === 'reseller') {
                        return <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full uppercase shrink-0">Reseller</span>
                      }
                      return <span className="text-[10px] bg-amber-50 text-amber-600 font-bold px-2 py-0.5 rounded-full uppercase shrink-0">Seller: {creator.username}</span>
                    })()
                  }))
                ]}
              /></div>

            {gen.plan_id === 'custom' && (
              <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/50">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-2">Custom Package Configuration</h4>
                
                <div>
                  <label className="text-xs font-semibold text-slate-500">Package Name</label>
                  <input className="input mt-1" value={gen.custom_name} onChange={(e) => setGen({ ...gen, custom_name: e.target.value })} placeholder="e.g. Hotel 2GB" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-500 mb-1">Package Type</label>
                    <CustomSelect
                      className="w-full"
                      value={gen.custom_plan_type}
                      onChange={(val) => setGen({ ...gen, custom_plan_type: val })}
                      options={[
                        { value: 'data', label: 'Data Limit (GB)' },
                        { value: 'unlimited', label: 'Unlimited' }
                      ]}
                    />
                  </div>
                  {gen.custom_plan_type === 'data' && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500">Data Limit (GB)</label>
                      <input className="input mt-1" type="number" min={0} disabled={!canCustomize('customize_plan_data_limit')} value={gen.custom_data_gb} onChange={(e) => setGen({ ...gen, custom_data_gb: e.target.value })} placeholder="e.g. 5" />
                      {!canCustomize('customize_plan_data_limit') && <span className="text-[10px] text-rose-500 font-bold">Locked by Admin</span>}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-500 mb-1">Bandwidth Speed</label>
                    <CustomSelect
                      className="w-full"
                      disabled={!canCustomize('customize_plan_bandwidth')}
                      value={gen.custom_bandwidth_id ? String(gen.custom_bandwidth_id) : ''}
                      onChange={(val) => setGen({ ...gen, custom_bandwidth_id: val })}
                      placeholder="No speed limit"
                      options={[
                        { value: '', label: 'No speed limit' },
                        ...bandwidths.map((b) => ({
                          value: String(b.id),
                          label: `${b.name} (${b.rate_down}${b.rate_down_unit}/${b.rate_up}${b.rate_up_unit})`
                        }))
                      ]}
                    />
                    {!canCustomize('customize_plan_bandwidth') && <span className="text-[10px] text-rose-500 font-bold">Locked by Admin</span>}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Validity (Days)</label>
                    <input className="input mt-1" type="number" min={1} disabled={!canCustomize('customize_plan_validity')} value={gen.custom_validity_days} onChange={(e) => setGen({ ...gen, custom_validity_days: e.target.value })} placeholder="e.g. 30" />
                    {!canCustomize('customize_plan_validity') && <span className="text-[10px] text-rose-500 font-bold">Locked by Admin</span>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Retail Price (Selling Price)</label>
                    <input className="input mt-1" type="number" min={0} value={gen.custom_selling_price} onChange={(e) => setGen({ ...gen, custom_selling_price: e.target.value })} placeholder="Rs. 300" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Base Price (Wholesale Cost)</label>
                    <input className="input mt-1" type="number" min={0} value={gen.custom_base_price_val} onChange={(e) => setGen({ ...gen, custom_base_price_val: e.target.value })} placeholder="Rs. 100" />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold text-slate-500 mb-1">Purchase Source</label>
                    <CustomSelect
                      className="w-full"
                      value={gen.custom_purchase_source}
                      onChange={(val) => setGen({ ...gen, custom_purchase_source: val })}
                      options={[
                        { value: 'gb', label: 'GB Allocation' },
                        { value: 'wallet', label: 'Wallet Balance' }
                      ]}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Quick Quantities */}
            <div>
              <label className="text-xs font-semibold text-slate-500">Quick Quantity</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {[500, 1000, 2000, 5000, 10000, 20000].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    className={`btn-ghost !py-1 !px-2.5 text-xs transition-all ${gen.quantity === qty ? 'bg-primary text-white border-primary' : 'hover:bg-slate-100'}`}
                    onClick={() => setGen({ ...gen, quantity: qty })}
                  >
                    {qty.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div><label className="text-xs font-semibold text-slate-500">Quantity</label><input className="input mt-1" type="number" min={1} max={20000} value={gen.quantity} onChange={(e) => setGen({ ...gen, quantity: +e.target.value })} /></div>
              <div><label className="text-xs font-semibold text-slate-500">Validity (days, optional)</label><input className="input mt-1" type="number" disabled={gen.plan_id === 'custom'} value={gen.validity_days} onChange={(e) => setGen({ ...gen, validity_days: e.target.value })} placeholder="Plan default" /></div>
              <div><label className="text-xs font-semibold text-slate-500">Retail Price (Rs., optional)</label><input className="input mt-1" type="number" min={0.00} step="0.01" disabled={gen.plan_id === 'custom'} value={gen.custom_price} onChange={(e) => setGen({ ...gen, custom_price: e.target.value })} placeholder={selectedPlan ? `${selectedPlan.selling_price}` : "Plan default"} /></div>
              <div><label className="text-xs font-semibold text-slate-500">Base Price (Rs., optional)</label><input className="input mt-1" type="number" min={0.00} step="0.01" disabled={gen.plan_id === 'custom'} value={gen.custom_base_price} onChange={(e) => setGen({ ...gen, custom_base_price: e.target.value })} placeholder={selectedPlan ? `${selectedPlan.base_price}` : "Plan default"} /></div>
            </div>

            {gen.plan_id !== 'custom' && selectedPlan && (
              <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Estimated Retail Value</span><span className="font-bold">{rs(Number(gen.custom_price !== '' ? gen.custom_price : selectedPlan.selling_price) * (gen.quantity || 0))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total GB Required</span><span className={`font-bold ${isGenShortGb ? 'text-rose-500' : ''}`}>{gb(genTotalGb)}</span></div>
                <div className="flex justify-between border-t border-slate-200/60 pt-1 mt-1 text-xs"><span className="text-muted-foreground">Available GB Balance ({targetUser?.name || 'Myself'})</span><span className="font-semibold text-slate-700">{gb(targetGbBalance)}</span></div>
              </div>
            )}

            {gen.plan_id === 'custom' && (
              <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
                {gen.custom_purchase_source === 'gb' ? (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total GB Required</span><span className={`font-bold ${isGenShortGb ? 'text-rose-500' : ''}`}>{gb(genTotalGb)}</span></div>
                    <div className="flex justify-between border-t border-slate-200/60 pt-1 mt-1 text-xs"><span className="text-muted-foreground">Available GB Balance ({targetUser?.name || 'Myself'})</span><span className="font-semibold text-slate-700">{gb(targetGbBalance)}</span></div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Total Wallet Cost (Wholesale)</span><span className="font-bold">{rs((+gen.custom_base_price_val || 0) * gen.quantity)}</span></div>
                    <div className="flex justify-between border-t border-slate-200/60 pt-1 mt-1 text-xs"><span className="text-muted-foreground">Available Wallet Balance ({targetUser?.name || 'Myself'})</span><span className="font-semibold text-slate-700">{rs(targetWalletBalance)}</span></div>
                  </>
                )}
              </div>
            )}

            {isGenShortGb && gen.plan_id !== 'custom' && (
              <div className="pill danger w-full justify-center py-2 gap-1"><AlertTriangle size={14} /> Not enough GB balance</div>
            )}
            {isGenShortGb && gen.plan_id === 'custom' && (
              <div className="pill danger w-full justify-center py-2 gap-1"><AlertTriangle size={14} /> Not enough GB balance</div>
            )}
            {isGenShortWallet && (
              <div className="pill danger w-full justify-center py-2 gap-1"><AlertTriangle size={14} /> Not enough wallet balance</div>
            )}
            {err && <div className="pill danger w-full justify-center py-2">{err}</div>}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-5">
              <button className="btn-ghost !border-slate-200 !text-slate-700 hover:!bg-slate-50 py-2.5 px-6 rounded-2xl font-bold transition-all" onClick={() => setGenOpen(false)}>Cancel</button>
              <motion.button whileTap={{ scale: 0.95 }} className="btn-primary py-2.5 px-6 rounded-2xl font-bold transition-all shadow-md" disabled={busy || !gen.plan_id || isGenShortGb || isGenShortWallet} onClick={generate}>{busy ? 'Generating…' : 'Generate Vouchers'}</motion.button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
