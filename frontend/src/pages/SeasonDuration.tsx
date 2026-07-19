import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Sun, Leaf, Snowflake, Calendar,
  Edit2, Check, X, AlertCircle, CheckCircle2
} from 'lucide-react'
import { api, apiError } from '../lib/api'
import { PageTitle, GlassCard, Spinner } from '../components/ui'

interface Season {
  id: number;
  name: string;
  start_month: number;
  start_day: number;
  end_month: number;
  end_day: number;
  created_at?: string;
  updated_at?: string;
}

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
]

const SEASON_ICONS: Record<string, any> = {
  Spring: Sparkles,
  Summer: Sun,
  Autumn: Leaf,
  Winter: Snowflake
}

const SEASON_COLORS: Record<string, string> = {
  Spring: 'text-emerald-500 bg-emerald-50 border border-emerald-100',
  Summer: 'text-amber-500 bg-amber-50 border border-amber-100',
  Autumn: 'text-orange-500 bg-orange-50 border border-orange-100',
  Winter: 'text-sky-500 bg-sky-50 border border-sky-100'
}

const SEASON_THEME_GRADIENTS: Record<string, string> = {
  Spring: 'from-emerald-500/10 to-teal-500/5',
  Summer: 'from-amber-500/10 to-orange-500/5',
  Autumn: 'from-orange-500/10 to-red-500/5',
  Winter: 'from-sky-500/10 to-blue-500/5'
}

export default function SeasonDuration() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Edit states
  const [editingId, setEditingId] = useState<number | null>(null)
  const [startMonth, setStartMonth] = useState(1)
  const [startDay, setStartDay] = useState(1)
  const [endMonth, setEndMonth] = useState(1)
  const [endDay, setEndDay] = useState(1)
  const [saving, setSaving] = useState(false)

  const fetchSeasons = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await api.get('/seasons')
      setSeasons(r.data.data)
    } catch (e: any) {
      setError(apiError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSeasons()
  }, [])

  const startEdit = (season: Season) => {
    setEditingId(season.id)
    setStartMonth(season.start_month)
    setStartDay(season.start_day)
    setEndMonth(season.end_month)
    setEndDay(season.end_day)
    setSuccess('')
    setError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const handleSave = async (id: number) => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const r = await api.put(`/seasons/${id}`, {
        start_month: startMonth,
        start_day: startDay,
        end_month: endMonth,
        end_day: endDay
      })
      setSuccess('Season duration saved successfully.')
      setSeasons(seasons.map(s => s.id === id ? r.data.data : s))
      setEditingId(null)
    } catch (e: any) {
      setError(apiError(e))
    } finally {
      setSaving(false)
    }
  }

  const getDaysInMonth = (month: number) => {
    if ([4, 6, 9, 11].includes(month)) return 30
    if (month === 2) return 29 // Allow 29 for leap year possibilities
    return 31
  }

  // Generate days based on month selection
  const startDays = Array.from({ length: getDaysInMonth(startMonth) }, (_, i) => i + 1)
  const endDays = Array.from({ length: getDaysInMonth(endMonth) }, (_, i) => i + 1)

  // Ensure day selections don't exceed the month days limits
  useEffect(() => {
    const maxStart = getDaysInMonth(startMonth)
    if (startDay > maxStart) setStartDay(maxStart)
  }, [startMonth])

  useEffect(() => {
    const maxEnd = getDaysInMonth(endMonth)
    if (endDay > maxEnd) setEndDay(maxEnd)
  }, [endMonth])

  const getMonthName = (m: number) => MONTHS.find(item => item.value === m)?.label || ''

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <PageTitle
        title="Season Duration"
        subtitle="Configure the date ranges for billing seasons"
        icon={<Calendar size={22} className="text-amber-500" />}
      />

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-[20px] text-rose-700 text-sm">
          <AlertCircle size={18} className="shrink-0 text-rose-500" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-[20px] text-emerald-700 text-sm">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
          <span className="font-semibold">{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {seasons.map((season) => {
          const Icon = SEASON_ICONS[season.name] || Calendar
          const colorClass = SEASON_COLORS[season.name] || 'text-slate-500 bg-slate-50 border border-slate-100'
          const bgGradient = SEASON_THEME_GRADIENTS[season.name] || 'from-slate-500/10 to-slate-500/5'
          const isEditing = editingId === season.id

          return (
            <GlassCard key={season.id} className="relative overflow-hidden flex flex-col justify-between h-full">
              {/* Season decorative top bar gradient */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${bgGradient}`} />

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorClass}`}>
                    <Icon size={22} />
                  </div>
                  <div>
                    <h3 className="text-[#003164] text-lg leading-tight">{season.name}</h3>
                    <p className="text-xs text-slate-400 tracking-wide mt-0.5">Season Period</p>
                  </div>
                </div>

                {!isEditing && (
                  <button
                    onClick={() => startEdit(season)}
                    className="p-2 border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-600 rounded-xl transition-all shadow-sm flex items-center justify-center active:scale-95"
                    title="Edit duration"
                  >
                    <Edit2 size={15} />
                  </button>
                )}
              </div>

              <div className="mt-6 flex-1">
                <AnimatePresence mode="wait">
                  {!isEditing ? (
                    <motion.div
                      key="display"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-3">
                          <span className="text-[10px] text-slate-400 tracking-wider block">Starts</span>
                          <span className="text-sm text-[#003164] mt-0.5 block">
                            {getMonthName(season.start_month)} {season.start_day}
                          </span>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-3">
                          <span className="text-[10px] text-slate-400 tracking-wider block">Ends</span>
                          <span className="text-sm text-[#003164] mt-0.5 block">
                            {getMonthName(season.end_month)} {season.end_day}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="space-y-4"
                    >
                      <div className="space-y-3">
                        {/* Start Selector */}
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1">Start Date</label>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={startMonth}
                              onChange={(e) => setStartMonth(parseInt(e.target.value))}
                              className="input py-2.5"
                            >
                              {MONTHS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </select>
                            <select
                              value={startDay}
                              onChange={(e) => setStartDay(parseInt(e.target.value))}
                              className="input py-2.5"
                            >
                              {startDays.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* End Selector */}
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1">End Date</label>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={endMonth}
                              onChange={(e) => setEndMonth(parseInt(e.target.value))}
                              className="input py-2.5"
                            >
                              {MONTHS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </select>
                            <select
                              value={endDay}
                              onChange={(e) => setEndDay(parseInt(e.target.value))}
                              className="input py-2.5"
                            >
                              {endDays.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => handleSave(season.id)}
                          disabled={saving}
                          className="btn-primary py-2 px-4 rounded-xl flex items-center gap-2 text-xs font-normal"
                        >
                          <Check size={14} />
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="btn-ghost py-2 px-4 rounded-xl flex items-center gap-2 text-xs border border-slate-200 text-slate-600 font-normal"
                        >
                          <X size={14} />
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </GlassCard>
          )
        })}
      </div>
    </div>
  )
}
