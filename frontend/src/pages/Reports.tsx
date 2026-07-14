import { useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart3 } from 'lucide-react'
import { api } from '../lib/api'
import { useQuery } from '../lib/cache'
import { useAuth } from '../lib/auth'
import { num, rs, date, statusPill } from '../lib/format'
import { GlassCard, PageTitle, Pill, StatCard, EmptyState, Pagination, CustomSelect } from '../components/ui'

export default function Reports() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<any>({
    from: '', to: '', status: '',
    plan_id: '', reseller_id: '', seller_id: '',
    code: '', customer_username: ''
  })
  const [drill, setDrill] = useState<{ plan: any; data: any; page: number } | null>(null)

  const { data: plans = [] } = useQuery<any[]>('reports/plans', () => api.get('/plans').then((r) => r.data.data))
  const { data: resellers = [] } = useQuery<any[]>('users/resellers', () => api.get('/users/resellers').then((r) => r.data.data.data), { enabled: user?.role === 'admin' })
  const { data: sellers = [] } = useQuery<any[]>('users/sellers', () => api.get('/users/sellers').then((r) => r.data.data.data), { enabled: user?.role === 'admin' || user?.role === 'reseller' })

  const { data: summary, refetch: load } = useQuery<any>(
    `reports/summary?${JSON.stringify(filters)}`,
    () => api.get('/reports/summary', { params: filters }).then((r) => r.data.data),
  )

  const drillDown = (plan: any, pageNum = 1) => {
    api.get(`/reports/drill-down/${plan.id}`, { params: { ...filters, page: pageNum } })
      .then((r) => setDrill({ plan, data: r.data.data, page: pageNum }))
  }

  return (
    <div>
      <PageTitle title="Used Voucher Report" subtitle="Package summary & drill-down" icon={<BarChart3 size={22} className="text-teal-500" />} />

      {/* Advanced Filters */}
      <GlassCard className="mb-4 space-y-3 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500">From</label>
            <input type="date" className="input mt-1" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">To</label>
            <input type="date" className="input mt-1" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block">Status</label>
            <CustomSelect
              className="w-full mt-1"
              value={filters.status}
              onChange={(val) => setFilters({ ...filters, status: val })}
              options={[
                { value: '', label: 'All Statuses' },
                ...['new', 'sold', 'active', 'expired', 'disabled'].map((s) => ({ value: s, label: s.toUpperCase() }))
              ]}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block">Package</label>
            <CustomSelect
              className="w-full mt-1"
              value={filters.plan_id ? +filters.plan_id : ''}
              onChange={(val) => setFilters({ ...filters, plan_id: val })}
              options={[
                { value: '', label: 'All Packages' },
                ...plans.map((p) => ({ value: p.id, label: p.name }))
              ]}
            />
          </div>
          {user?.role === 'admin' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 block">Reseller</label>
              <CustomSelect
                className="w-full mt-1"
                value={filters.reseller_id ? +filters.reseller_id : ''}
                onChange={(val) => setFilters({ ...filters, reseller_id: val })}
                options={[
                  { value: '', label: 'All Resellers' },
                  ...resellers.map((r) => ({ value: r.id, label: r.name || r.username }))
                ]}
              />
            </div>
          )}
          {(user?.role === 'admin' || user?.role === 'reseller') && (
            <div>
              <label className="text-xs font-semibold text-slate-500 block">Seller</label>
              <CustomSelect
                className="w-full mt-1"
                value={filters.seller_id ? +filters.seller_id : ''}
                onChange={(val) => setFilters({ ...filters, seller_id: val })}
                options={[
                  { value: '', label: 'All Sellers' },
                  ...sellers.map((s) => ({ value: s.id, label: s.name || s.username }))
                ]}
              />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-500">Voucher Code</label>
            <input className="input mt-1" value={filters.code} onChange={(e) => setFilters({ ...filters, code: e.target.value })} placeholder="Search code" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Customer Username</label>
            <input className="input mt-1" value={filters.customer_username} onChange={(e) => setFilters({ ...filters, customer_username: e.target.value })} placeholder="Search customer" />
          </div>
        </div>
        <div className="flex justify-end pt-1">
          <button className="btn-primary" onClick={() => { setDrill(null); load() }}>Apply Filters</button>
        </div>
      </GlassCard>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Generated" value={num(summary.totals.generated)} />
          <StatCard label="Used" value={num(summary.totals.used)} />
          <StatCard label="Remaining" value={num(summary.totals.remaining)} />
          <StatCard label="Revenue" value={rs(summary.totals.revenue)} />
        </div>
      )}

      <GlassCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th>Package</th><th>Generated</th><th>Used</th><th>Remaining</th><th>Revenue</th><th></th></tr></thead>
            <tbody>
              {(summary?.packages || []).map((p: any, idx: number) => (
                <motion.tr key={p.plan_id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }} className="hover:bg-secondary/30">
                  <td className="font-semibold">{p.plan}</td>
                  <td>{num(p.generated)}</td>
                  <td>{num(p.used)}</td>
                  <td>{num(p.remaining)}</td>
                  <td>{rs(p.revenue)}</td>
                  <td className="text-right"><button className="text-xs font-bold text-primary hover:underline" onClick={() => drillDown(p)}>View</button></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {(summary?.packages || []).length === 0 && <EmptyState>No data for these filters.</EmptyState>}
        </div>
      </GlassCard>

      {drill && (
        <GlassCard className="!p-0 overflow-hidden mt-4">
          <div className="p-4 flex items-center justify-between">
            <h3 className="font-bold">Package: {drill.plan.plan}</h3>
            <button className="text-xs font-bold text-slate-500 hover:underline" onClick={() => setDrill(null)}>Close</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th>Voucher Code</th><th>User</th><th>Login Date</th><th>Reseller</th><th>Seller</th><th>Status</th></tr></thead>
              <tbody>
                {(drill.data.data || []).map((v: any) => (
                  <tr key={v.id} className="hover:bg-secondary/30">
                    <td className="font-mono font-semibold">{v.code}</td>
                    <td>{v.customer_username || '—'}</td>
                    <td className="text-xs">{v.activated_at ? date(v.activated_at) : '—'}</td>
                    <td>{v.reseller?.username || '—'}</td>
                    <td>{v.seller?.username || '—'}</td>
                    <td><Pill tone={statusPill[v.status] || 'secondary'}>{v.status}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(drill.data.data || []).length === 0 && <EmptyState>No vouchers.</EmptyState>}
          </div>
          <div className="p-4"><Pagination meta={drill.data} onPage={(p) => drillDown(drill.plan, p)} /></div>
        </GlassCard>
      )}
    </div>
  )
}
