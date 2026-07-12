import { useState } from 'react'
import { motion } from 'framer-motion'
import { Wallet, Database, PlusCircle, AlertCircle, FileText } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { PageTitle, GlassCard } from '../components/ui'

export default function SystemLoad() {
  const { user, refresh } = useAuth()
  const [walletAmount, setWalletAmount] = useState('')
  const [gbAmount, setGbAmount] = useState('')
  const [note, setNote] = useState('')
  
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')

  const handleSystemLoad = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setSuccess('')
    setBusy(true)

    try {
      const payload: any = {}
      if (walletAmount) payload.wallet_amount = parseFloat(walletAmount)
      if (gbAmount) payload.gb_amount = parseFloat(gbAmount)
      if (note) payload.note = note

      const r = await api.post('/admin/system-load', payload)
      setSuccess('System load processed successfully. Your balance has been updated.')
      setWalletAmount('')
      setGbAmount('')
      setNote('')
      // Refresh the context user balance shown in the top-bar
      refresh()
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Failed to process system load.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="System Load"
        subtitle="Load additional master credits directly into the root Admin account"
        icon={<PlusCircle size={22} className="text-emerald-500" />}
      />

      <GlassCard>
        <div className="p-4 border-b border-slate-100/60 mb-6">
          <h2 className="text-lg font-bold text-[#003164] flex items-center gap-2">
            <AlertCircle size={20} className="text-amber-500" />
            Master Vault Load
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            As the master administrator account, loading balance here increments your pool. You can then distribute this balance to resellers and sellers.
          </p>
        </div>

        <form onSubmit={handleSystemLoad} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5 flex items-center gap-1.5">
                <Wallet size={14} className="text-emerald-500" />
                Wallet Load (Rs.)
              </label>
              <input
                className="input py-3"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 500000"
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5 flex items-center gap-1.5">
                <Database size={14} className="text-purple-500" />
                GB Load (Quota)
              </label>
              <input
                className="input py-3"
                type="number"
                min="0"
                step="0.001"
                placeholder="e.g. 10000"
                value={gbAmount}
                onChange={(e) => setGbAmount(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5 flex items-center gap-1.5">
              <FileText size={14} className="text-slate-400" />
              Note / Reference
            </label>
            <input
              className="input py-3"
              placeholder="e.g. Initial master allocation / server deposit"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {err && <div className="pill danger w-full justify-center py-3 text-xs font-semibold">{err}</div>}
          {success && <div className="pill success w-full justify-center py-3 text-xs font-semibold">{success}</div>}

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <motion.button
              whileTap={{ scale: 0.96 }}
              disabled={busy || (!walletAmount && !gbAmount)}
              type="submit"
              className="btn-primary py-3 px-6 flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle size={18} />
              {busy ? 'Processing Load...' : 'Submit System Load'}
            </motion.button>
          </div>
        </form>
      </GlassCard>
    </div>
  )
}
