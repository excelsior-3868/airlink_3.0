import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Ticket, AlertTriangle, Printer, Zap, Plus, Pencil, Loader2 } from 'lucide-react'
import { api, apiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { rs, gb } from '../lib/format'
import { GlassCard, CustomSelect, SelectOption, Modal, Spinner } from '../components/ui'
import { VoucherCard, CardTemplate } from '../components/VoucherCard'

const generateDefaultBatchCode = () => {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let rand = ''
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `BAT${yy}${mm}${dd}${rand}`
}

interface VoucherPackageCardProps {
  p: any
  user: any
  allResellers: any[]
  allSellers: any[]
  onEdit: (plan: any) => void
  onSuccess: (result: any, plan: any) => void
  cardTemplate: CardTemplate | null
  refreshAuth: () => void
}

function VoucherPackageCard({
  p,
  user,
  allResellers,
  allSellers,
  onEdit,
  onSuccess,
  cardTemplate,
  refreshAuth
}: VoucherPackageCardProps) {
  const [quantity, setQuantity] = useState<number | ''>('')
  const [batchCode, setBatchCode] = useState(() => generateDefaultBatchCode())
  const [delegationId, setDelegationId] = useState('')
  const purchaseSource = 'gb'
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Auto-initialize delegation if the plan owner is a downline
  useEffect(() => {
    if (p.creator && p.creator.id !== user?.id) {
      setDelegationId(`${p.creator.role}-${p.creator.id}`)
    } else {
      setDelegationId('')
    }
  }, [p, user])

  // Resolve delegation user
  const targetUser = useMemo(() => {
    if (delegationId) {
      if (delegationId.startsWith('seller-')) {
        const id = +delegationId.replace('seller-', '')
        return allSellers.find((s) => s.id === id)
      }
      if (delegationId.startsWith('reseller-')) {
        const id = +delegationId.replace('reseller-', '')
        return allResellers.find((r) => r.id === id)
      }
    }
    return user
  }, [delegationId, allResellers, allSellers, user])

  // Delegation Options mapping for this card
  const delegationOptions = useMemo(() => {
    const opts: SelectOption[] = [{ value: '', label: 'Myself' }]
    if (user?.role === 'admin' || user?.role === 'reseller') {
      allResellers.forEach((r) => {
        opts.push({
          value: `reseller-${r.id}`,
          label: r.name,
          badge: <span className="text-[10px] bg-purple-50 text-purple-600 font-bold px-2 py-0.5 rounded-full border border-purple-100/50">Reseller</span>
        })
      })
    }
    allSellers.forEach((s) => {
      opts.push({
        value: `seller-${s.id}`,
        label: s.name,
        badge: <span className="text-[10px] bg-amber-50 text-amber-600 font-bold px-2 py-0.5 rounded-full border border-amber-100/50">Seller</span>
      })
    })
    return opts
  }, [allResellers, allSellers, user])

  const targetGbBalance = targetUser?.gb_balance || 0
  const targetWalletBalance = targetUser?.wallet_balance || 0

  const totalGbRequired = useMemo(() => {
    const dataGb = Number(p.data_gb || 0)
    return dataGb * (quantity || 0)
  }, [p.data_gb, quantity])

  const totalWalletCost = useMemo(() => {
    const basePrice = Number(p.base_price || 0)
    return basePrice * (quantity || 0)
  }, [p.base_price, quantity])

  const isShortGb = totalGbRequired > targetGbBalance
  const isShortWallet = false

  const handlePrint = async () => {
    if (!quantity || quantity <= 0) {
      setErr('Enter quantity.')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const payload: any = {
        plan_id: +p.id,
        quantity: +quantity,
        purchase_source: purchaseSource
      }
      if (batchCode) payload.batch_code = batchCode

      if (delegationId) {
        if (delegationId.startsWith('seller-')) {
          payload.owner_id = +delegationId.replace('seller-', '')
        } else if (delegationId.startsWith('reseller-')) {
          payload.owner_id = +delegationId.replace('reseller-', '')
        }
      }

      const { data } = await api.post('/vouchers/generate', payload)
      refreshAuth()
      setBatchCode(generateDefaultBatchCode())
      onSuccess(data.data, p)
    } catch (e) {
      setErr(apiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md relative">
      {/* Processing Cover overlay */}
      {busy && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 transition-all">
          <Loader2 className="animate-spin text-[#003164]" size={36} />
          <p className="text-xs font-extrabold text-[#003164] mt-3">Generating Vouchers...</p>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#003164] p-4 text-white text-center relative flex flex-col items-center justify-center min-h-[92px] shrink-0">
        <button
          onClick={() => onEdit(p)}
          className="absolute top-2 right-2 text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all"
          title="Edit Package"
        >
          <Pencil size={13} />
        </button>
        <div className="font-extrabold text-base tracking-wide truncate max-w-[85%]">{p.name}</div>
        <div className="text-xs text-slate-200 mt-1 font-semibold">{rs(p.selling_price)} / Voucher</div>
        <div className="text-[10px] text-slate-300 mt-0.5 flex gap-2">
          <span>{p.data_gb ? `${p.data_gb} GB` : '—'}</span>
          <span>·</span>
          <span>{p.validity_days ? `${p.validity_days} Days` : '—'}</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 space-y-3.5 flex flex-col justify-between">
        <div className="space-y-2.5">
          {/* Quantity */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500">No of Voucher :</span>
            <input
              type="number"
              min={1}
              max={20000}
              className="border border-[#005FA3]/30 rounded-lg px-2.5 py-1 text-sm text-[#003164] w-36 text-center font-bold outline-none focus:border-primary"
              value={quantity}
              onChange={(e) => setQuantity(+e.target.value)}
            />
          </div>

          {/* Batch Code */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500">Batch ID :</span>
            <input
              type="text"
              className="border border-[#005FA3]/30 rounded-lg px-2.5 py-1 text-sm text-[#003164] w-36 text-center font-mono font-bold outline-none focus:border-primary"
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
            />
          </div>

          {/* Generated For */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500">Generated For :</span>
            <CustomSelect
              value={delegationId}
              onChange={(val) => setDelegationId(val)}
              options={delegationOptions}
              searchable={true}
              className="min-w-[144px]"
            />
          </div>

        </div>

        {/* Dynamic Balance & Warning alerts */}
        <div className="pt-2">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold border-t border-slate-100 pt-2">
            <span>Required: {gb(totalGbRequired)}</span>
            <span className={isShortGb ? 'text-rose-500' : 'text-slate-500'}>
              Avail: {gb(targetGbBalance)}
            </span>
          </div>

          {isShortGb && (
            <div className="mt-2 text-[10px] text-rose-500 font-bold flex items-center justify-center gap-1 bg-rose-50 py-1 rounded-lg border border-rose-100">
              <AlertTriangle size={10} /> Insufficient GB Balance
            </div>
          )}
          {err && (
            <div className="mt-2 text-[10px] text-rose-500 font-bold text-center bg-rose-50 py-1 rounded-lg border border-rose-100 max-w-full truncate">
              {err}
            </div>
          )}
        </div>
      </div>

      {/* Print Footer Action button */}
      <button
        onClick={handlePrint}
        disabled={busy || isShortGb || isShortWallet}
        className="bg-[#005FA3] hover:bg-[#004C83] disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold py-3 text-center transition-all flex items-center justify-center gap-2 cursor-pointer border-t border-[#005FA3]/10 text-sm select-none"
      >
        <Printer size={15} /> Print
      </button>
    </div>
  )
}

interface VoucherGenerateTabProps {
  plans: any[]
  refetchPlans: () => void
}

export default function VoucherGenerateTab({ plans, refetchPlans }: VoucherGenerateTabProps) {
  const { user, refresh } = useAuth()

  // Configuration resources
  const [bandwidths, setBandwidths] = useState<any[]>([])
  const [cardTemplate, setCardTemplate] = useState<CardTemplate | null>(null)

  // Users lists for delegation
  const [allResellers, setAllResellers] = useState<any[]>([])
  const [allSellers, setAllSellers] = useState<any[]>([])

  useEffect(() => {
    api.get('/bandwidths').then((r) => setBandwidths(r.data.data))
    api.get('/voucher-template').then((r) => setCardTemplate(r.data.data))
  }, [])

  useEffect(() => {
    if (!user) return
    if (user.role === 'admin') {
      api.get('/users', { params: { role: 'reseller', per_page: 100 } }).then((r) => setAllResellers(r.data.data.data))
      api.get('/users', { params: { role: 'seller', per_page: 500 } }).then((r) => setAllSellers(r.data.data.data))
    } else if (user.role === 'reseller') {
      setAllResellers([user])
      api.get('/users', { params: { role: 'seller', per_page: 100 } }).then((r) => setAllSellers(r.data.data.data))
    }
  }, [user])

  const canDelegate = user?.role === 'admin' || user?.role === 'reseller'

  // Delegation Options mapping
  const delegationOptions = useMemo(() => {
    const opts: SelectOption[] = [{ value: '', label: 'Myself' }]
    if (user?.role === 'admin' || user?.role === 'reseller') {
      allResellers.forEach((r) => {
        opts.push({
          value: `reseller-${r.id}`,
          label: r.name,
          badge: <span className="text-[10px] bg-purple-50 text-purple-600 font-bold px-2 py-0.5 rounded-full border border-purple-100/50">Reseller</span>
        })
      })
    }
    allSellers.forEach((s) => {
      opts.push({
        value: `seller-${s.id}`,
        label: s.name,
        badge: <span className="text-[10px] bg-amber-50 text-amber-600 font-bold px-2 py-0.5 rounded-full border border-amber-100/50">Seller</span>
      })
    })
    return opts
  }, [allResellers, allSellers, user])

  const [selectedOwnerId, setSelectedOwnerId] = useState('')

  // Filter plans to show only GB package types created by the selected owner
  const filteredGbPackages = useMemo(() => {
    return plans.filter((p) => {
      if (p.package_type !== 'gb') return false
      if (!selectedOwnerId) {
        return p.created_by === user?.id
      } else {
        const [, idStr] = selectedOwnerId.split('-')
        return p.created_by === +idStr
      }
    })
  }, [plans, selectedOwnerId, user])

  // Create Package State
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [createErr, setCreateErr] = useState('')
  const [newPlan, setNewPlan] = useState<any>({
    name: '',
    data_gb: '',
    bandwidth_id: '',
    validity_days: '30',
    selling_price: '',
    base_price: '',
    delegation_id: ''
  })

  // Edit Package State
  const [editingPlan, setEditingPlan] = useState<any>(null)
  const [editBusy, setEditBusy] = useState(false)
  const [editErr, setEditErr] = useState('')
  const [editForm, setEditForm] = useState<any>({
    name: '',
    data_gb: '',
    bandwidth_id: '',
    validity_days: '',
    selling_price: '',
    base_price: '',
    delegation_id: ''
  })

  // Success Modal State
  const [successResult, setSuccessResult] = useState<any>(null)
  const [successPlan, setSuccessPlan] = useState<any>(null)
  const [progress, setProgress] = useState(0)
  const [loadingAction, setLoadingAction] = useState(false)

  // Open helper for print cards
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

  const openCreateModal = () => {
    setNewPlan({
      name: '',
      data_gb: '',
      bandwidth_id: '',
      validity_days: '30',
      selling_price: '',
      base_price: '',
      delegation_id: selectedOwnerId
    })
    setCreateErr('')
    setCreateBusy(false)
    setCreateModalOpen(true)
  }

  // Handle Create Submit
  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlan.name || !newPlan.data_gb || !newPlan.selling_price) {
      setCreateErr('Name, Data Limit, and Retail Price are required.')
      return
    }
    setCreateBusy(true)
    setCreateErr('')
    try {
      const payload: any = {
        via_voucher: true,
        name: newPlan.name,
        type: 'hotspot',
        plan_type: 'data',
        bandwidth_id: newPlan.bandwidth_id || null,
        data_gb: +newPlan.data_gb,
        validity_days: +newPlan.validity_days || 30,
        base_price: +newPlan.base_price || 0,
        selling_price: +newPlan.selling_price || 0,
        status: 'active'
      }

      if (newPlan.delegation_id) {
        if (newPlan.delegation_id.startsWith('seller-')) {
          payload.owner_id = +newPlan.delegation_id.replace('seller-', '')
        } else if (newPlan.delegation_id.startsWith('reseller-')) {
          payload.owner_id = +newPlan.delegation_id.replace('reseller-', '')
        }
      }

      await api.post('/plans', payload)
      refetchPlans()
      setCreateModalOpen(false)
      setNewPlan({
        name: '', data_gb: '', bandwidth_id: '', validity_days: '30', selling_price: '', base_price: '', delegation_id: ''
      })
    } catch (err) {
      setCreateErr(apiError(err))
    } finally {
      setCreateBusy(false)
    }
  }

  // Open Edit package Form
  const openEditModal = (plan: any) => {
    setEditingPlan(plan)
    setEditForm({
      name: plan.name,
      data_gb: plan.data_gb || '',
      bandwidth_id: plan.bandwidth_id || '',
      validity_days: plan.validity_days || '',
      selling_price: plan.selling_price || '',
      base_price: plan.base_price || '',
      delegation_id: plan.creator ? `${plan.creator.role}-${plan.creator.id}` : ''
    })
    setEditErr('')
    setEditBusy(false)
  }

  // Handle Edit Submit
  const handleEditPackage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPlan) return
    setEditBusy(true)
    setEditErr('')
    try {
      const payload: any = {
        via_voucher: true,
        name: editForm.name,
        type: 'hotspot',
        plan_type: 'data',
        bandwidth_id: editForm.bandwidth_id || null,
        data_gb: +editForm.data_gb || null,
        validity_days: +editForm.validity_days || null,
        selling_price: +editForm.selling_price || 0,
        base_price: +editForm.base_price || 0,
        status: 'active'
      }

      if (editForm.delegation_id) {
        if (editForm.delegation_id.startsWith('seller-')) {
          payload.owner_id = +editForm.delegation_id.replace('seller-', '')
        } else if (editForm.delegation_id.startsWith('reseller-')) {
          payload.owner_id = +editForm.delegation_id.replace('reseller-', '')
        }
      }

      await api.put(`/plans/${editingPlan.id}`, payload)
      refetchPlans()
      setEditingPlan(null)
    } catch (err) {
      setEditErr(apiError(err))
    } finally {
      setEditBusy(false)
    }
  }

  // Handle Card Generation success
  const handleGenerationSuccess = (resData: any, planObj: any) => {
    setSuccessPlan(planObj)
    setSuccessResult(resData)
    // Automatically trigger immediate card document rendering in background
    openBlob('/vouchers/print', { batch: resData.batch_code })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[#003164] whitespace-nowrap">Show Packages For:</span>
          <CustomSelect
            value={selectedOwnerId}
            onChange={(val) => setSelectedOwnerId(val)}
            options={delegationOptions}
            searchable={true}
            className="min-w-[220px]"
          />
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary flex items-center gap-2 py-2 px-4 rounded-xl font-bold shadow-sm"
        >
          <Plus size={16} /> Create a Package
        </button>
      </div>

      {/* Card Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredGbPackages.map((p) => (
          <VoucherPackageCard
            key={p.id}
            p={p}
            user={user}
            allResellers={allResellers}
            allSellers={allSellers}
            onEdit={openEditModal}
            onSuccess={handleGenerationSuccess}
            cardTemplate={cardTemplate}
            refreshAuth={refresh}
          />
        ))}
      </div>

      {filteredGbPackages.length === 0 && (
        <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-12 text-center text-slate-500 font-semibold">
          No custom GB packages found for this user. Click "Create a Package" to get started.
        </div>
      )}

      {/* Create Package Modal */}
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Custom Package Configuration">
        <form onSubmit={handleCreatePackage} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1.5 block">Package Name</label>
            <input
              required
              className="input w-full"
              placeholder="e.g. Hotel 2GB"
              value={newPlan.name}
              onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Package Type</label>
              <CustomSelect
                value="data"
                onChange={() => {}}
                options={[{ value: 'data', label: 'Data Limit (GB)' }]}
                disabled={true}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Data Limit (GB)</label>
              <input
                required
                type="number"
                min={1}
                className="input w-full"
                placeholder="e.g. 5"
                value={newPlan.data_gb}
                onChange={(e) => setNewPlan({ ...newPlan, data_gb: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Bandwidth Speed</label>
              <CustomSelect
                value={newPlan.bandwidth_id}
                onChange={(val) => setNewPlan({ ...newPlan, bandwidth_id: val })}
                options={[
                  { value: '', label: 'No speed limit' },
                  ...bandwidths.map((b) => ({ value: String(b.id), label: b.name }))
                ]}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Validity (Days)</label>
              <input
                required
                type="number"
                min={1}
                className="input w-full"
                placeholder="e.g. 30"
                value={newPlan.validity_days}
                onChange={(e) => setNewPlan({ ...newPlan, validity_days: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Retail Price (Selling Price)</label>
              <input
                required
                type="number"
                min={0}
                className="input w-full"
                placeholder="Rs. 300"
                value={newPlan.selling_price}
                onChange={(e) => setNewPlan({ ...newPlan, selling_price: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Base Price (Wholesale Cost)</label>
              <input
                type="number"
                min={0}
                className="input w-full"
                placeholder="Rs. 100"
                value={newPlan.base_price}
                onChange={(e) => setNewPlan({ ...newPlan, base_price: e.target.value })}
              />
            </div>
          </div>

          {canDelegate && (
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Plan Owner/Creator</label>
              <CustomSelect
                value={newPlan.delegation_id}
                onChange={(val) => setNewPlan({ ...newPlan, delegation_id: val })}
                options={delegationOptions}
              />
            </div>
          )}

          {createErr && <div className="pill danger w-full justify-center py-2">{createErr}</div>}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-5">
            <button
              type="button"
              className="btn-ghost !border-slate-200 !text-slate-700 hover:!bg-slate-50 py-2 px-5 rounded-xl font-bold"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createBusy}
              className="btn-primary py-2 px-5 rounded-xl font-bold flex items-center gap-1.5"
            >
              {createBusy ? 'Creating...' : 'Create Package'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Package Modal */}
      <Modal open={!!editingPlan} onClose={() => setEditingPlan(null)} title={`Edit Package: ${editingPlan?.name}`}>
        <form onSubmit={handleEditPackage} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1.5 block">Package Name</label>
            <input
              required
              className="input w-full"
              placeholder="e.g. Hotel 2GB"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Package Type</label>
              <CustomSelect
                value="data"
                onChange={() => {}}
                options={[{ value: 'data', label: 'Data Limit (GB)' }]}
                disabled={true}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Data Limit (GB)</label>
              <input
                required
                type="number"
                min={1}
                className="input w-full"
                placeholder="e.g. 5"
                value={editForm.data_gb}
                onChange={(e) => setEditForm({ ...editForm, data_gb: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Bandwidth Speed</label>
              <CustomSelect
                value={editForm.bandwidth_id}
                onChange={(val) => setEditForm({ ...editForm, bandwidth_id: val })}
                options={[
                  { value: '', label: 'No speed limit' },
                  ...bandwidths.map((b) => ({ value: String(b.id), label: b.name }))
                ]}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Validity (Days)</label>
              <input
                required
                type="number"
                min={1}
                className="input w-full"
                placeholder="e.g. 30"
                value={editForm.validity_days}
                onChange={(e) => setEditForm({ ...editForm, validity_days: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Retail Price (Selling Price)</label>
              <input
                required
                type="number"
                min={0}
                className="input w-full"
                placeholder="Rs. 300"
                value={editForm.selling_price}
                onChange={(e) => setEditForm({ ...editForm, selling_price: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Base Price (Wholesale Cost)</label>
              <input
                type="number"
                min={0}
                className="input w-full"
                placeholder="Rs. 100"
                value={editForm.base_price}
                onChange={(e) => setEditForm({ ...editForm, base_price: e.target.value })}
              />
            </div>
          </div>

          {canDelegate && (
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">Plan Owner/Creator</label>
              <CustomSelect
                value={editForm.delegation_id}
                onChange={(val) => setEditForm({ ...editForm, delegation_id: val })}
                options={delegationOptions}
              />
            </div>
          )}

          {editErr && <div className="pill danger w-full justify-center py-2">{editErr}</div>}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-5">
            <button
              type="button"
              className="btn-ghost !border-slate-200 !text-slate-700 hover:!bg-slate-50 py-2 px-5 rounded-xl font-bold"
              onClick={() => setEditingPlan(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editBusy}
              className="btn-primary py-2 px-5 rounded-xl font-bold flex items-center gap-1.5"
            >
              {editBusy ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Success Modal */}
      <Modal
        open={!!successResult}
        onClose={() => setSuccessResult(null)}
        title="Voucher Batch Generated"
        widthClassName="max-w-3xl"
      >
        {successResult && (
          <div className="space-y-5">
            <div className="bg-emerald-50 border border-emerald-100/60 rounded-2xl px-5 py-4 flex items-center gap-3">
              <Ticket className="text-emerald-500 shrink-0" size={28} />
              <div>
                <p className="font-extrabold text-emerald-800">{successResult.message}</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Batch <span className="font-mono font-bold bg-white/70 px-1.5 py-0.5 rounded-lg border border-emerald-100">{successResult.batch_code}</span> · {successResult.quantity} voucher(s) · {successResult.plan}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Preview (first {successResult.sample?.length})</p>
              <div className="flex gap-4 overflow-x-auto pb-3">
                {cardTemplate && successResult.sample?.map((code: string) => (
                  <VoucherCard
                    key={code}
                    code={code}
                    planName={successResult.plan}
                    price={successPlan?.selling_price}
                    size={200}
                    template={cardTemplate}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
              <button
                className="btn-ghost !border-slate-200 !text-slate-700 hover:!bg-slate-50 py-2 px-5 rounded-xl font-bold flex items-center gap-2"
                onClick={() => openBlob('/vouchers/print', { batch: successResult.batch_code })}
              >
                <Printer size={15} /> Print All Cards
              </button>
              <button className="btn-primary py-2 px-5 rounded-xl font-bold" onClick={() => setSuccessResult(null)}>Done</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Progress Bar Overlay */}
      {loadingAction && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/45 backdrop-blur-sm select-none animate-fade-in">
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
