import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, ShieldAlert, Search } from 'lucide-react'
import { api } from '../lib/api'
import { date } from '../lib/format'
import { GlassCard, PageTitle, Pill, EmptyState, Pagination, CustomSelect } from '../components/ui'

export default function LoginLogs() {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [successFilter, setSuccessFilter] = useState('')

  const load = () => {
    const params: any = { page }
    if (search) params.search = search
    if (successFilter !== '') params.successful = successFilter === '1' ? 1 : 0
    api.get('/login-logs', { params }).then((r) => setData(r.data.data))
  }

  useEffect(() => { load() }, [page])

  return (
    <div>
      <PageTitle title="Login Logs" subtitle="Security audit trail for user authentication" icon={<ShieldCheck size={22} className="text-pink-500" />} />

      {/* Filters */}
      <GlassCard className="mb-4 flex flex-wrap gap-3 items-end relative z-10">
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 mb-1">Status</label>
          <CustomSelect
            value={successFilter}
            onChange={(val) => setSuccessFilter(val)}
            options={[
              { value: '', label: 'All Attempts' },
              { value: '1', label: 'Success' },
              { value: '0', label: 'Failure' }
            ]}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">Username</label>
          <div className="relative mt-1">
            <input 
              className="input pr-8" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Filter by username" 
            />
            <Search size={15} className="absolute right-3 top-3 text-muted-foreground" />
          </div>
        </div>
        <button className="btn-primary" onClick={() => { setPage(1); load() }}>Apply</button>
      </GlassCard>

      <GlassCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>Username</th>
                <th>IP Address</th>
                <th>User Agent</th>
                <th>Status</th>
                <th>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data || []).map((l: any, idx: number) => (
                <motion.tr 
                  key={l.id} 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: idx * 0.02 }} 
                  className="hover:bg-secondary/30"
                >
                  <td className="font-semibold">{l.username}</td>
                  <td className="font-mono text-xs">{l.ip_address}</td>
                  <td className="text-xs text-muted-foreground max-w-xs truncate" title={l.user_agent}>
                    {l.user_agent}
                  </td>
                  <td>
                    <Pill tone={l.successful ? 'success' : 'danger'} className="gap-1 flex items-center inline-flex">
                      {l.successful ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                      {l.successful ? 'Success' : 'Failure'}
                    </Pill>
                  </td>
                  <td className="text-xs">{date(l.created_at)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {(data?.data || []).length === 0 && <EmptyState>No login logs found.</EmptyState>}
        </div>
        <div className="p-4"><Pagination meta={data} onPage={setPage} /></div>
      </GlassCard>
    </div>
  )
}
