import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Ticket, Download, Zap, Printer, Layers } from 'lucide-react'
import { api, apiError } from '../lib/api'
import { useQuery } from '../lib/cache'
import { useAuth } from '../lib/auth'
import { rs, gb, date } from '../lib/format'
import { statusPill } from '../lib/format'
import { GlassCard, PageTitle, Pagination, Pill, Modal, EmptyState, CustomSelect, Spinner } from '../components/ui'

export default function Vouchers() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'vouchers' | 'batches'>('vouchers')
  const [loadingAction, setLoadingAction] = useState(false)
  const [progress, setProgress] = useState(0)
  
  // Vouchers state
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<any>({ status: '', code: '', batch: '' })
  // Applied filter signature — only changes on Apply, so typing doesn't refetch.
  const [appliedVoucherKey, setAppliedVoucherKey] = useState('{}')

  // Batches state
  const [batchesPage, setBatchesPage] = useState(1)
  const [batchFilters, setBatchFilters] = useState<any>({ plan_id: '', batch_code: '' })
  const [appliedBatchKey, setAppliedBatchKey] = useState('{}')

  // Sell state
  const [sellVoucher, setSellVoucher] = useState<any>(null)
  const [customerUsername, setCustomerUsername] = useState('')
  const [selling, setSelling] = useState(false)

  const cleanFilters = () => Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  const cleanBatchFilters = () => Object.fromEntries(Object.entries(batchFilters).filter(([, v]) => v))

  const { data: plans = [] } = useQuery<any[]>('plans?active_only=1', () => api.get('/plans', { params: { active_only: 1 } }).then((r) => r.data.data))

  const { data, refetch: load } = useQuery<any>(
    `vouchers?page=${page}&${appliedVoucherKey}`,
    () => api.get('/vouchers', { params: { page, ...cleanFilters() } }).then((r) => r.data.data),
  )

  const { data: batchesData } = useQuery<any>(
    `batches?page=${batchesPage}&${appliedBatchKey}`,
    () => api.get('/batches', { params: { page: batchesPage, ...cleanBatchFilters() } }).then((r) => r.data.data),
    { enabled: activeTab === 'batches' },
  )

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
    setLoadingAction(true)
    setProgress(0)
    
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95
        const increment = Math.floor(Math.random() * 8) + 3
        return Math.min(95, prev + increment)
      })
    }, 150)

    try {
      const res = await api.get(path, { params, responseType: 'blob' })
      clearInterval(interval)
      setProgress(100)
      
      await new Promise((r) => setTimeout(r, 200))
      
      const url = URL.createObjectURL(res.data)
      window.open(url, '_blank')
    } catch (e) {
      clearInterval(interval)
      alert(apiError(e))
    } finally {
      setLoadingAction(false)
    }
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
      <PageTitle 
        title="Vouchers" 
        subtitle="Generate & manage voucher cards"
        icon={<Ticket size={22} className="text-rose-500" />}
        action={
          <div className="flex gap-2">
            <button className="btn-ghost flex items-center gap-1.5" onClick={() => download('export')}><Download size={15} /> CSV</button>
            <button className="btn-ghost flex items-center gap-1.5" onClick={() => download('export-xlsx')}><Download size={15} /> Excel</button>
            <motion.button whileTap={{ scale: 0.95 }} className="btn-primary flex items-center gap-2" onClick={() => navigate('/vouchers/generate')}>
              <Zap size={16} /> Generate
            </motion.button>
          </div>
        } 
      />

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
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Status</label>
              <CustomSelect
                value={filters.status}
                onChange={(val) => setFilters({ ...filters, status: val })}
                options={[
                  { value: '', label: 'All Statuses' },
                  ...['new', 'sold', 'active', 'expired', 'disabled'].map((s) => ({ value: s, label: s.toUpperCase() }))
                ]}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Code</label>
              <input className="input mt-1" value={filters.code} onChange={(e) => setFilters({ ...filters, code: e.target.value })} placeholder="Search code" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Batch</label>
              <input className="input mt-1" value={filters.batch} onChange={(e) => setFilters({ ...filters, batch: e.target.value })} placeholder="Batch code" />
            </div>
            <button className="btn-primary" onClick={() => { setPage(1); setAppliedVoucherKey(JSON.stringify(cleanFilters())) }}>Apply</button>
          </GlassCard>

          <GlassCard className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Plan</th>
                    <th>Data</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Expires</th>
                    <th></th>
                  </tr>
                </thead>
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
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 mb-1">Plan</label>
              <CustomSelect
                value={batchFilters.plan_id ? +batchFilters.plan_id : ''}
                onChange={(val) => setBatchFilters({ ...batchFilters, plan_id: val })}
                options={[
                  { value: '', label: 'All Plans' },
                  ...plans.map((p) => ({ value: p.id, label: p.name }))
                ]}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Batch Code</label>
              <input className="input mt-1" value={batchFilters.batch_code} onChange={(e) => setBatchFilters({ ...batchFilters, batch_code: e.target.value })} placeholder="Search batch" />
            </div>
            <button className="btn-primary" onClick={() => { setBatchesPage(1); setAppliedBatchKey(JSON.stringify(cleanBatchFilters())) }}>Apply</button>
          </GlassCard>

          <GlassCard className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Batch Code</th>
                    <th>Plan</th>
                    <th>Quantity</th>
                    <th>Generated By</th>
                    <th>Created At</th>
                    <th></th>
                  </tr>
                </thead>
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

      {/* Progress Bar Overlay */}
      {loadingAction && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/45 backdrop-blur-sm select-none">
          <div className="bg-white p-6 rounded-[24px] shadow-2xl flex flex-col items-center gap-4 border border-slate-100 max-w-xs text-center w-80">
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative">
              <div 
                className="absolute top-0 left-0 h-full bg-[#003164] rounded-full transition-all duration-150 ease-out" 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <div className="mt-1">
              <p className="text-sm font-extrabold text-slate-800">Generating Card Document ({progress}%)</p>
              <p className="text-xs text-slate-400 font-semibold mt-1">Please wait a moment while we render your cards.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
