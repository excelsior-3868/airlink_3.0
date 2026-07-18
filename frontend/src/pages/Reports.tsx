import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { api } from '../lib/api'
import { useQuery } from '../lib/cache'
import { useAuth } from '../lib/auth'
import { num, date, statusPill } from '../lib/format'
import { GlassCard, PageTitle, Pill, StatCard, EmptyState, Pagination, CustomSelect } from '../components/ui'

export default function Reports() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<any>({
    from: '', to: '', status: '',
    plan_id: '', reseller_id: '', seller_id: '',
    code: '', batch: ''
  })
  const [appliedFilters, setAppliedFilters] = useState<any>({ ...filters })
  const [page, setPage] = useState(1)

  const { data: plans = [] } = useQuery<any[]>('reports/plans', () => api.get('/plans').then((r) => r.data.data))
  const { data: resellers = [] } = useQuery<any[]>('users/resellers', () => api.get('/users/resellers').then((r) => r.data.data.data), { enabled: user?.role === 'admin' })
  const { data: sellers = [] } = useQuery<any[]>('users/sellers', () => api.get('/users/sellers').then((r) => r.data.data.data), { enabled: user?.role === 'admin' || user?.role === 'reseller' })

  // Summary totals for cards
  const { data: summary } = useQuery<any>(
    `reports/package-summary?${JSON.stringify(appliedFilters)}`,
    () => api.get('/reports/package-summary', { params: appliedFilters }).then((r) => r.data.data),
  )

  // Vouchers list for the main table
  const { data: vouchersData } = useQuery<any>(
    `reports/vouchers?${JSON.stringify(appliedFilters)}&page=${page}`,
    () => api.get('/vouchers', { params: { ...appliedFilters, page } }).then((r) => r.data.data),
  )

  const applyFilters = () => {
    setPage(1)
    setAppliedFilters({ ...filters })
  }

  const clearFilters = () => {
    const reset = {
      from: '', to: '', status: '',
      plan_id: '', reseller_id: '', seller_id: '',
      code: '', batch: ''
    }
    setFilters(reset)
    setPage(1)
    setAppliedFilters(reset)
  }

  return (
    <div>
      <PageTitle title="Voucher Usage Report" subtitle="Voucher history & usage summary" icon={<BarChart3 size={22} className="text-teal-500" />} />

      {/* Advanced Filters */}
      <GlassCard className="mb-4 space-y-3 relative z-10">
        {/* Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 block">From</label>
            <input type="date" className="input mt-1" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block">To</label>
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
                ...['active', 'used', 'sold', 'expired', 'disabled'].map((s) => ({ value: s, label: s.toUpperCase() }))
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
                ...plans
                  .filter((p) => {
                    if (user?.role === 'seller') {
                      return p.package_type === 'gb' && (p.created_by === user?.id || p.owner_id === user?.id);
                    }
                    return true;
                  })
                  .map((p) => ({ value: p.id, label: p.name }))
              ]}
            />
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex flex-col md:flex-row md:items-end gap-3 flex-wrap pt-1">
          {user?.role === 'admin' && (
            <div className="flex-1 min-w-[140px] max-w-[250px]">
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
            <div className="flex-1 min-w-[140px] max-w-[250px]">
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
          <div className="flex-1 min-w-[140px] max-w-[250px]">
            <label className="text-xs font-semibold text-slate-500 block">Batch</label>
            <input className="input mt-1" value={filters.batch} onChange={(e) => setFilters({ ...filters, batch: e.target.value })} placeholder="Search batch" />
          </div>
          <div className="flex-1 min-w-[140px] max-w-[250px]">
            <label className="text-xs font-semibold text-slate-500 block">Username</label>
            <input className="input mt-1" value={filters.code} onChange={(e) => setFilters({ ...filters, code: e.target.value })} placeholder="Search username" />
          </div>
          <div className="md:ml-auto flex gap-2 shrink-0 w-full md:w-auto">
            <button className="btn-ghost flex-1 md:flex-initial" onClick={clearFilters}>Clear</button>
            <button className="btn-primary flex-1 md:flex-initial" onClick={applyFilters}>Apply Filters</button>
          </div>
        </div>
      </GlassCard>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <StatCard label="Generated" value={<span className="text-indigo-600 font-bold">{num(summary.totals.generated)}</span>} />
          <StatCard label="Sold" value={<span className="text-blue-600 font-bold">{num(summary.totals.by_status?.sold || 0)}</span>} />
          <StatCard label="Active" value={<span className="text-emerald-600 font-bold">{num(summary.totals.by_status?.active || 0)}</span>} />
          <StatCard label="Used" value={<span className="text-cyan-600 font-bold">{num(summary.totals.by_status?.used || 0)}</span>} />
          <StatCard label="Expired" value={<span className="text-amber-600 font-bold">{num(summary.totals.by_status?.expired || 0)}</span>} />
          <StatCard label="Disabled" value={<span className="text-rose-600 font-bold">{num(summary.totals.by_status?.disabled || 0)}</span>} />
        </div>
      )}

      <GlassCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>Username</th>
                <th>Batch</th>
                <th>Package</th>
                <th>Generated Date</th>
                <th>Login Date</th>
                <th>Customer Name</th>
                {user?.role !== 'seller' && <th>Reseller</th>}
                {user?.role !== 'seller' && <th>Seller</th>}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(vouchersData?.data || []).map((v: any) => (
                <tr key={v.id} className="hover:bg-secondary/30">
                  <td className="font-mono font-semibold">{v.code}</td>
                  <td className="font-mono text-xs">{v.batch?.batch_code || '—'}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{v.plan?.name || '—'}</span>
                      {v.plan?.package_type && (
                        <Pill tone={v.plan.package_type === 'gb' ? 'success' : 'info'} className="text-[10px] px-1.5 py-0.5 font-bold">
                          {v.plan.package_type === 'gb' ? 'GB' : 'Wallet'}
                        </Pill>
                      )}
                    </div>
                  </td>
                  <td className="text-xs">{v.created_at ? date(v.created_at) : '—'}</td>
                  <td className="text-xs">{v.activated_at ? date(v.activated_at) : '—'}</td>
                  <td className="font-semibold text-slate-700">{v.customer_username || '—'}</td>
                  {user?.role !== 'seller' && <td>{v.reseller?.username || '—'}</td>}
                  {user?.role !== 'seller' && <td>{v.seller?.username || '—'}</td>}
                  <td><Pill tone={statusPill[v.status] || 'secondary'}>{v.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
          {(vouchersData?.data || []).length === 0 && <EmptyState>No vouchers found.</EmptyState>}
        </div>
        {vouchersData && (
          <div className="p-4">
            <Pagination meta={vouchersData} onPage={(p) => setPage(p)} />
          </div>
        )}
      </GlassCard>
    </div>
  )
}
