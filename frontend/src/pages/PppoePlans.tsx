import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Package } from 'lucide-react'
import { api, apiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { rs, gb } from '../lib/format'
import { GlassCard, PageTitle, Modal, Pill, EmptyState } from '../components/ui'

const blank = { name: '', type: 'pppoe', plan_type: 'data', bandwidth_id: '', data_gb: '', time_limit: '', validity_days: 1, base_price: 0, selling_price: 0, status: 'active' }

export default function PppoePlans() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [plans, setPlans] = useState<any[]>([])
  const [bandwidths, setBandwidths] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>(blank)
  const [editId, setEditId] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const [rPlans, rBws] = await Promise.all([
        api.get('/plans?type=pppoe'),
        api.get('/bandwidths')
      ])
      setPlans(rPlans.data.data)
      setBandwidths(rBws.data.data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openNew = () => {
    setForm({ ...blank, bandwidth_id: bandwidths[0]?.id || '' })
    setEditId(null)
    setErr('')
    setOpen(true)
  }

  const openEdit = (p: any) => {
    setForm({
      ...p,
      bandwidth_id: p.bandwidth_id ?? '',
      data_gb: p.data_gb ?? '',
      time_limit: p.time_limit ?? ''
    })
    setEditId(p.id)
    setErr('')
    setOpen(true)
  }

  const save = async () => {
    setBusy(true)
    setErr('')
    try {
      const payload = {
        ...form,
        type: 'pppoe',
        bandwidth_id: form.bandwidth_id || null,
        data_gb: form.data_gb || null,
        time_limit: form.time_limit || null
      }
      if (editId) {
        await api.put(`/plans/${editId}`, payload)
      } else {
        await api.post('/plans', payload)
      }
      setOpen(false)
      load()
    } catch (e) {
      setErr(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  const del = async (p: any) => {
    if (!confirm(`Delete PPPOE plan "${p.name}"?`)) return
    try {
      await api.delete(`/plans/${p.id}`)
      load()
    } catch (e) {
      alert(apiError(e))
    }
  }

  return (
    <div>
      <PageTitle
        title="PPPOE Plans"
        subtitle="Broadband connection packages"
        icon={<Package size={22} className="text-indigo-500" />}
        action={
          isAdmin && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="btn-primary flex items-center gap-2"
              onClick={openNew}
            >
              <Plus size={16} /> New Plan
            </motion.button>
          )
        }
      />

      <GlassCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Bandwidth</th>
                <th>Data</th>
                <th>Validity</th>
                <th>Price</th>
                <th>Status</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {plans.map((p, idx) => (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="hover:bg-secondary/30 transition-all"
                >
                  <td className="font-semibold">{p.name}</td>
                  <td className="capitalize">{p.plan_type}</td>
                  <td>{p.bandwidth || '—'}</td>
                  <td>{p.data_gb ? gb(p.data_gb) : '—'}</td>
                  <td>{p.validity_days}d</td>
                  <td>{rs(p.selling_price)}</td>
                  <td>
                    <Pill tone={p.status === 'active' ? 'success' : 'secondary'}>{p.status}</Pill>
                  </td>
                  {isAdmin && (
                    <td className="text-right whitespace-nowrap">
                      <button className="text-xs font-bold text-primary hover:underline mr-3" onClick={() => openEdit(p)}>
                        Edit
                      </button>
                      <button className="text-xs font-bold text-rose-500 hover:underline" onClick={() => del(p)}>
                        Delete
                      </button>
                    </td>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
          {plans.length === 0 && <EmptyState>No PPPOE plans yet.</EmptyState>}
        </div>
      </GlassCard>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit PPPOE Plan' : 'New PPPOE Plan'}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Plan name</label>
            <input
              className="input"
              placeholder="e.g. PPPOE 10Mbps Unlimited"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Quota Type</label>
              <select
                className="input"
                value={form.plan_type}
                onChange={(e) => setForm({ ...form, plan_type: e.target.value })}
              >
                <option value="data">Data</option>
                <option value="time">Time</option>
                <option value="unlimited">Unlimited</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Bandwidth Limit</label>
              <select
                className="input"
                value={form.bandwidth_id}
                onChange={(e) => setForm({ ...form, bandwidth_id: e.target.value })}
              >
                <option value="">— Select Bandwidth —</option>
                {bandwidths.map((bw) => (
                  <option key={bw.id} value={bw.id}>
                    {bw.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Data GB</label>
              <input
                className="input"
                type="number"
                placeholder="Data GB"
                value={form.data_gb}
                disabled={form.plan_type === 'time' || form.plan_type === 'unlimited'}
                onChange={(e) => setForm({ ...form, data_gb: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Time Limit (min)</label>
              <input
                className="input"
                type="number"
                placeholder="Time limit (min)"
                value={form.time_limit}
                disabled={form.plan_type === 'data' || form.plan_type === 'unlimited'}
                onChange={(e) => setForm({ ...form, time_limit: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Validity Days</label>
              <input
                className="input"
                type="number"
                placeholder="Validity days"
                value={form.validity_days}
                onChange={(e) => setForm({ ...form, validity_days: +e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Base Price</label>
              <input
                className="input"
                type="number"
                placeholder="Base price"
                value={form.base_price}
                onChange={(e) => setForm({ ...form, base_price: +e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Selling Price</label>
              <input
                className="input"
                type="number"
                placeholder="Selling price"
                value={form.selling_price}
                onChange={(e) => setForm({ ...form, selling_price: +e.target.value })}
              />
            </div>
          </div>

          {err && <div className="pill danger w-full justify-center py-2">{err}</div>}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-5">
            <button className="btn-ghost !border-slate-200 !text-slate-700 hover:!bg-slate-50 py-2.5 px-6 rounded-2xl font-bold transition-all" onClick={() => setOpen(false)}>Cancel</button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="btn-primary py-2.5 px-6 rounded-2xl font-bold transition-all shadow-md"
              disabled={busy}
              onClick={save}
            >
              {busy ? 'Saving…' : 'Save Plan'}
            </motion.button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
