import { useState } from 'react'
import { BarChart3, Calendar, Sparkles, Sun, Leaf, Snowflake } from 'lucide-react'
import { api } from '../lib/api'
import { useQuery } from '../lib/cache'
import { useAuth } from '../lib/auth'
import { num, date, statusPill } from '../lib/format'
import { GlassCard, PageTitle, Pill, StatCard, EmptyState, Pagination, CustomSelect, Spinner } from '../components/ui'
import { DualDatePicker } from '../components/DualDatePicker'

export default function Reports() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<any>({
    from: '', to: '', status: '',
    plan_id: '', reseller_id: '', seller_id: '',
    code: '', batch: '', season_id: ''
  })
  const [appliedFilters, setAppliedFilters] = useState<any>({ ...filters })
  const [page, setPage] = useState(1)

  const { data: plans = [] } = useQuery<any[]>('reports/plans', () => api.get('/plans').then((r) => r.data.data))
  const { data: seasons = [] } = useQuery<any[]>('reports/seasons', () => api.get('/seasons').then((r) => r.data.data))
  const { data: resellers = [] } = useQuery<any[]>('users/resellers', () => api.get('/users/resellers').then((r) => r.data.data.data), { enabled: user?.role === 'admin' })
  const { data: sellers = [] } = useQuery<any[]>('users/sellers', () => api.get('/users/sellers').then((r) => r.data.data.data), { enabled: user?.role === 'admin' || user?.role === 'reseller' })

  // Summary totals for cards
  const { data: summary, loading: summaryLoading } = useQuery<any>(
    `reports/package-summary?${JSON.stringify(appliedFilters)}`,
    () => api.get('/reports/package-summary', { params: appliedFilters }).then((r) => r.data.data),
  )

  // Vouchers list for the main table
  const { data: vouchersData, loading: reportsLoading } = useQuery<any>(
    `reports/vouchers?${JSON.stringify(appliedFilters)}&page=${page}`,
    () => api.get('/vouchers', { params: { ...appliedFilters, page } }).then((r) => r.data.data),
  )

  const handleSeasonChange = (seasonId: any) => {
    if (!seasonId) {
      const updated = {
        ...filters,
        season_id: '',
        from: '',
        to: ''
      }
      setFilters(updated)
      setPage(1)
      setAppliedFilters(updated)
      return
    }

    const season = seasons.find((s: any) => s.id === +seasonId)
    if (season) {
      const currentYear = new Date().getFullYear()
      const sm = season.start_month.toString().padStart(2, '0')
      const sd = season.start_day.toString().padStart(2, '0')
      const em = season.end_month.toString().padStart(2, '0')
      const ed = season.end_day.toString().padStart(2, '0')

      const fromDate = `${currentYear}-${sm}-${sd}`
      let toDate = ''
      if (season.start_month > season.end_month) {
        toDate = `${currentYear + 1}-${em}-${ed}`
      } else {
        toDate = `${currentYear}-${em}-${ed}`
      }

      const updated = {
        ...filters,
        season_id: seasonId,
        from: fromDate,
        to: toDate
      }
      setFilters(updated)
      setPage(1)
      setAppliedFilters(updated)
    }
  }

  const applyFilters = () => {
    setPage(1)
    setAppliedFilters({ ...filters })
  }

  const clearFilters = () => {
    const reset = {
      from: '', to: '', status: '',
      plan_id: '', reseller_id: '', seller_id: '',
      code: '', batch: '', season_id: ''
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <label className="text-xs text-slate-500 block">Season</label>
            <CustomSelect
              className="w-full mt-1"
              value={filters.season_id}
              onChange={handleSeasonChange}
              options={[
                { value: '', label: 'All Seasons', icon: <Calendar size={14} className="text-slate-400" /> },
                ...seasons.map((s: any) => {
                  let Icon = Calendar
                  let iconColor = 'text-slate-400'
                  if (s.name === 'Spring') { Icon = Sparkles; iconColor = 'text-emerald-500'; }
                  else if (s.name === 'Summer') { Icon = Sun; iconColor = 'text-amber-500'; }
                  else if (s.name === 'Autumn') { Icon = Leaf; iconColor = 'text-orange-500'; }
                  else if (s.name === 'Winter') { Icon = Snowflake; iconColor = 'text-sky-500'; }

                  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                  const sm = MONTH_NAMES[s.start_month - 1] || ''
                  const em = MONTH_NAMES[s.end_month - 1] || ''
                  const duration = `(${sm} ${s.start_day}-${em} ${s.end_day})`

                  return {
                    value: s.id,
                    label: `${s.name} ${duration}`,
                    icon: <Icon size={14} className={iconColor} />
                  }
                })
              ]}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 block mb-1">From Date</label>
            <DualDatePicker label="From Date" value={filters.from} onChange={(val) => setFilters({ ...filters, from: val })} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 block mb-1">To Date</label>
            <DualDatePicker label="To Date" value={filters.to} onChange={(val) => setFilters({ ...filters, to: val })} />
          </div>
          <div className="md:col-span-2">
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
          <div className="md:col-span-3">
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

      {summaryLoading && !summary ? (
        <div className="mb-6"><Spinner /></div>
      ) : null}
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
        {reportsLoading && !vouchersData ? <Spinner /> : null}
        <div className={`overflow-x-auto ${reportsLoading && !vouchersData ? 'hidden' : ''}`}>
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
