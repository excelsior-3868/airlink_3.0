import { motion } from 'framer-motion'
import { ReactNode, useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { rs, gb } from '../lib/format'
import { Check, ChevronDown } from 'lucide-react'

export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass-card p-5 sm:p-6 ${className}`}>{children}</div>
}

export function Pill({ tone = 'secondary', children, className = '' }: { tone?: string; children: ReactNode; className?: string }) {
  return <span className={`pill ${tone} ${className}`}>{children}</span>
}

export function StatCard({ label, value, icon, sub, iconColorClass = 'text-primary bg-primary/10' }: { label: string; value: ReactNode; icon?: ReactNode; sub?: ReactNode; iconColorClass?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass-card p-5 flex items-start justify-between"
    >
      <div>
        <p className="text-muted-foreground text-xs sm:text-sm font-medium">{label}</p>
        <p className="text-2xl lg:text-3xl font-bold mt-1 tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
      {icon && <div className={`rounded-2xl p-2.5 shrink-0 flex items-center justify-center ${iconColorClass}`}>{icon}</div>}
    </motion.div>
  )
}

export function PageTitle({ title, subtitle, action, icon }: { title: string; subtitle?: string; action?: ReactNode; icon?: ReactNode }) {
  const { user } = useAuth()
  return (
    <div className="flex items-start justify-between mb-6 flex-wrap gap-4 pt-4">
      <div className="flex items-start gap-4">
        {icon && (
          <div className="p-3 rounded-2xl shrink-0 bg-white border border-slate-200/80 shadow-sm flex items-center justify-center">
            {icon}
          </div>
        )}
        <div className="pt-1">
          <h1 className="text-lg sm:text-2xl font-medium tracking-tight text-[#003164] flex items-center gap-2">
            {title}
          </h1>
          {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
        </div>
      </div>
      
      <div className="flex items-center gap-3 flex-wrap">
        {/* Wallet & GB Balance glass-badges */}
        {user && (
          <div className="flex items-center gap-2.5 bg-white/70 backdrop-blur-md border border-white/80 rounded-2xl p-2 px-3.5 shadow-sm text-xs select-none">
            <div className="flex items-center gap-1.5 border-r border-slate-200/80 pr-2.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Wallet:</span>
              <span className="font-extrabold text-slate-800">{rs(user.wallet_balance)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">GB:</span>
              <span className="font-extrabold text-slate-800">{gb(user.gb_balance)}</span>
            </div>
          </div>
        )}
        {action}
      </div>
    </div>
  )
}

export function Pagination({ meta, onPage }: { meta: any; onPage: (p: number) => void }) {
  if (!meta) return null
  const { current_page, last_page, from, to, total } = meta
  return (
    <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
      <p className="text-xs font-semibold text-slate-500">
        Showing {from ?? 0} to {to ?? 0} of {total} items
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPage(current_page - 1)}
          disabled={current_page <= 1}
          className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Prev
        </button>
        <span className="w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg border bg-primary border-primary text-white shadow-md shadow-primary/20 scale-105">
          {current_page}
        </span>
        <span className="text-xs text-slate-400 px-1">/ {last_page}</span>
        <button
          onClick={() => onPage(current_page + 1)}
          disabled={current_page >= last_page}
          className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Next
        </button>
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, subtitle, icon, children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; icon?: ReactNode; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="bg-white w-full max-w-2xl rounded-[28px] relative shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 bg-white select-none">
          <div className="flex items-center gap-3.5 min-w-0">
            {icon && (
              <div className="bg-blue-50 text-[#003164] p-3 rounded-2xl shrink-0 border border-blue-100/50 flex items-center justify-center shadow-sm">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight leading-none truncate">{title}</h2>
              {subtitle && <p className="text-xs text-slate-400 font-semibold mt-1.5 leading-normal tracking-wide truncate max-w-lg">{subtitle}</p>}
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-700 transition-all cursor-pointer shrink-0 ml-4"
          >
            <span className="text-lg font-light leading-none">&times;</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto max-h-[calc(85vh-8rem)]">
          {children}
        </div>
      </motion.div>
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="text-center text-muted-foreground text-sm py-12">{children}</div>
}

export interface SelectOption {
  value: any;
  label: string;
  icon?: ReactNode;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  className = ''
}: {
  value: any;
  onChange: (val: any) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className={`relative inline-block text-left min-w-[180px] ${open ? 'z-30' : 'z-0'} ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 transition-all text-sm font-semibold text-slate-700 shadow-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          {selected?.icon && (
            <div className="shrink-0 flex items-center justify-center">
              {selected.icon}
            </div>
          )}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Options Dropdown list */}
      {open && (
        <div className="absolute left-0 mt-1.5 w-full min-w-[200px] bg-white border border-slate-200/80 rounded-2xl shadow-xl p-1.5 z-50 flex flex-col gap-0.5 max-h-60 overflow-y-auto">
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-all text-sm font-semibold text-left ${
                  isSelected ? 'bg-slate-50/50 text-[#003164]' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {opt.icon && (
                    <div className="shrink-0 flex items-center justify-center">
                      {opt.icon}
                    </div>
                  )}
                  <span className="truncate">{opt.label}</span>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-[#003164]" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
