import { useEffect, useState } from 'react'
import { Wallet, Database, Users2, Store, Ticket, TrendingUp, Wifi, WifiOff, History, UserCheck, LayoutDashboard, CreditCard, PlusCircle, Package } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { rs, gb, num, date } from '../lib/format'
import { StatCard, PageTitle, GlassCard, EmptyState, Modal, Spinner, VoucherStatCard } from '../components/ui'
import { motion } from 'framer-motion'

// Module-level cache so navigating away and back shows the dashboard instantly
// while it refreshes in the background, instead of a full loading state.
let dashboardCache: any = null

export default function Dashboard() {
  const { user } = useAuth()
  const [d, setD] = useState<any>(dashboardCache)
  const [loading, setLoading] = useState(!dashboardCache)

  const [collectOpen, setCollectOpen] = useState(false)
  const [downlines, setDownlines] = useState<any[]>([])
  const [collectForm, setCollectForm] = useState({ user_id: '', amount: '', note: '' })
  const [collectErr, setCollectErr] = useState('')
  const [collectBusy, setCollectBusy] = useState(false)

  const fetchDownlines = (currentD: any) => {
    const roleToFetch = currentD.role === 'admin' ? 'reseller' : 'seller'
    api.get('/users', { params: { role: roleToFetch, per_page: 100 } }).then((r) => {
      setDownlines(r.data.data.data)
    })
  }

  useEffect(() => {
    api.get('/dashboard').then((r) => {
      dashboardCache = r.data.data
      setD(r.data.data)
      if (r.data.data.role === 'admin' || r.data.data.role === 'reseller') {
        fetchDownlines(r.data.data)
      }
    }).finally(() => setLoading(false))
  }, [])

  const handleCollectPayment = async () => {
    setCollectBusy(true)
    setCollectErr('')
    try {
      await api.post('/billing/payments/collect', {
        user_id: +collectForm.user_id,
        amount: +collectForm.amount,
        note: collectForm.note || undefined,
      })
      const r = await api.get('/dashboard')
      dashboardCache = r.data.data
      setD(r.data.data)
      setCollectOpen(false)
      setCollectForm({ user_id: '', amount: '', note: '' })
    } catch (e: any) {
      setCollectErr(e.response?.data?.message || 'Failed to collect payment.')
    } finally {
      setCollectBusy(false)
    }
  }

  if (loading || !d) return <Spinner />

  return (
    <div>
      <PageTitle 
        title="Dashboard" 
        subtitle={`${d.role.charAt(0).toUpperCase() + d.role.slice(1)} account overview & billing metrics`} 
        icon={<LayoutDashboard size={22} className="text-blue-500" />} 
      />

      {/* Admin Dashboard */}
      {d.role === 'admin' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Today's Sales" value={<span className="text-emerald-600">{rs(d.today_sales)}</span>} icon={<TrendingUp size={22} />} iconColorClass="text-emerald-600 bg-emerald-50 border border-emerald-100/50" />
            <StatCard label="Wallet Distributed" value={<span className="text-blue-600">{rs(d.wallet_distributed)}</span>} icon={<Wallet size={22} />} iconColorClass="text-blue-600 bg-blue-50 border border-blue-100/50" />
            <StatCard label="GB Distributed" value={<span className="text-purple-600">{gb(d.gb_distributed)}</span>} icon={<Database size={22} />} iconColorClass="text-purple-600 bg-purple-50 border border-purple-100/50" />
            <StatCard label="Outstanding Reseller Due" value={<span className="text-rose-600">{rs(d.outstanding_due)}</span>} icon={<Wallet size={22} />} iconColorClass="text-rose-600 bg-rose-50 border border-rose-100/50" />
            <StatCard label="Online Users" value={<span className="text-sky-600">{num(d.online)}</span>} icon={<Wifi size={22} />} iconColorClass="text-sky-600 bg-sky-50 border border-sky-100/50" />
            <StatCard label="Offline Users" value={<span className="text-slate-600">{num(d.offline)}</span>} icon={<WifiOff size={22} />} iconColorClass="text-slate-500 bg-slate-50 border border-slate-200/50" />
            <VoucherStatCard title="Total Vouchers" vouchers={d.vouchers} icon={<Ticket size={22} />} iconColorClass="text-rose-600 bg-rose-50 border border-rose-100/50" />
            <StatCard label="Sales Revenue (All-Time)" value={<span className="text-teal-600">{rs(d.revenue)}</span>} icon={<TrendingUp size={22} />} iconColorClass="text-teal-600 bg-teal-50 border border-teal-100/50" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {d.top_resellers && (
              <GlassCard>
                <h3 className="font-bold mb-3 flex items-center gap-2 text-primary">
                  <TrendingUp size={18} /> Top Resellers
                </h3>
                {d.top_resellers.length === 0 ? (
                  <EmptyState>No reseller sales yet.</EmptyState>
                ) : (
                  <div className="space-y-2">
                    {d.top_resellers.map((t: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm hover:bg-secondary/20 p-2 rounded-lg transition-colors">
                        <span className="font-semibold text-slate-700">{t.user}</span>
                        <span className="text-slate-500 font-medium">
                          {num(t.vouchers)} vouchers · <span className="text-primary font-bold">{rs(t.revenue)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}

            {d.recent_transactions && (
              <GlassCard>
                <h3 className="font-bold mb-3 flex items-center gap-2 text-primary">
                  <History size={18} /> Recent Wallet Distributions
                </h3>
                {d.recent_transactions.length === 0 ? (
                  <EmptyState>No transaction history.</EmptyState>
                ) : (
                  <div className="space-y-2">
                    {d.recent_transactions.map((t: any) => (
                      <div key={t.id} className="flex justify-between items-center text-xs hover:bg-secondary/20 p-2 rounded-lg transition-colors">
                        <div>
                          <p className="font-semibold text-slate-700">{t.user || 'System'}</p>
                          <p className="text-muted-foreground mt-0.5">{t.note}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">+{rs(t.amount)}</p>
                          <p className="text-muted-foreground mt-0.5">{date(t.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}
          </div>
        </div>
      )}

      {/* Reseller Dashboard */}
      {d.role === 'reseller' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              label="GB Balance (Stock)" 
              value={<span className="text-cyan-600">{gb(d.balances.gb)}</span>} 
              icon={<Database size={22} />} 
              iconColorClass="text-cyan-600 bg-cyan-50 border border-cyan-100/50"
              sub={<span>Purchased: <strong className="text-slate-700">{gb(d.gb_purchased)}</strong></span>}
            />
            <StatCard label="My Wallet Due (Payable)" value={<span className="text-rose-600">{rs(d.balances.wallet_due)}</span>} icon={<Wallet size={22} />} iconColorClass="text-rose-600 bg-rose-50 border border-rose-100/50" />
            <StatCard 
              label="GB Allocated to Sellers" 
              value={<span className="text-purple-600">{gb(d.gb_allocated)}</span>} 
              icon={<Database size={22} />} 
              iconColorClass="text-purple-600 bg-purple-50 border border-purple-100/50" 
              sub={<span>Sellers: <strong className="text-slate-700">{num(d.counts.sellers)}</strong></span>}
            />
            <StatCard label="Revenue from Sellers" value={<span className="text-emerald-600">{rs(d.revenue_sellers)}</span>} icon={<TrendingUp size={22} />} iconColorClass="text-emerald-600 bg-emerald-50 border border-emerald-100/50" />
            
            <VoucherStatCard title="Total Vouchers" vouchers={d.vouchers} icon={<Ticket size={22} />} iconColorClass="text-rose-600 bg-rose-50 border border-rose-100/50" />
            <StatCard label="Voucher Sales" value={<span className="text-blue-600">{rs(d.voucher_sales)}</span>} icon={<TrendingUp size={22} />} iconColorClass="text-blue-600 bg-blue-50 border border-blue-100/50" />
            <StatCard label="Retail Profit" value={<span className="text-teal-600">{rs(d.retail_profit)}</span>} icon={<TrendingUp size={22} />} iconColorClass="text-teal-600 bg-teal-50 border border-teal-100/50" />
            <StatCard label="Packages" value={<span className="text-amber-600">{num(d.counts.packages)}</span>} icon={<Package size={22} />} iconColorClass="text-amber-600 bg-amber-50 border border-amber-100/50" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {d.top_sellers && (
              <GlassCard>
                <h3 className="font-bold mb-3 flex items-center gap-2 text-primary">
                  <Store size={18} /> Top Sellers
                </h3>
                {d.top_sellers.length === 0 ? (
                  <EmptyState>No seller sales yet.</EmptyState>
                ) : (
                  <div className="space-y-2">
                    {d.top_sellers.map((t: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm hover:bg-secondary/20 p-2 rounded-lg transition-colors">
                        <span className="font-semibold text-slate-700">{t.user}</span>
                        <span className="text-slate-500 font-medium">
                          {num(t.vouchers)} vouchers · <span className="text-primary font-bold">{rs(t.revenue)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}

            {d.recent_wallet_transfers && (
              <GlassCard>
                <h3 className="font-bold mb-3 flex items-center gap-2 text-primary">
                  <History size={18} /> Recent Transactions
                </h3>
                {d.recent_wallet_transfers.length === 0 ? (
                  <EmptyState>No recent transactions found.</EmptyState>
                ) : (
                  <div className="space-y-2">
                    {d.recent_wallet_transfers.map((t: any) => (
                      <div key={t.id} className="flex justify-between items-center text-xs hover:bg-secondary/20 p-2 rounded-lg transition-colors">
                        <div>
                          <p className="font-semibold text-slate-700 capitalize">{t.type} transaction</p>
                          <p className="text-muted-foreground mt-0.5">{t.note}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${t.type === 'load' || t.type === 'transfer' || t.is_positive ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {t.type === 'load' || t.type === 'transfer' || t.is_positive ? '+' : '-'}{rs(t.amount)}
                          </p>
                          <p className="text-muted-foreground mt-0.5">{date(t.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}
          </div>
        </div>
      )}

      {/* Seller Dashboard */}
      {d.role === 'seller' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Wallet Balance" value={<span className="text-emerald-600">{rs(d.balances.wallet)}</span>} icon={<Wallet size={22} />} iconColorClass="text-emerald-600 bg-emerald-50 border border-emerald-100/50" />
            <StatCard label="GB Balance (Stock)" value={<span className="text-cyan-600">{gb(d.balances.gb)}</span>} icon={<Database size={22} />} iconColorClass="text-cyan-600 bg-cyan-50 border border-cyan-100/50" />
            <StatCard label="My Wallet Due (Payable)" value={<span className="text-rose-600">{rs(d.balances.wallet_due)}</span>} icon={<Wallet size={22} />} iconColorClass="text-rose-600 bg-rose-50 border border-rose-100/50" />
            <StatCard label="Today's Sales" value={<span className="text-blue-600">{rs(d.today.sales)}</span>} icon={<TrendingUp size={22} />} iconColorClass="text-blue-600 bg-blue-50 border border-blue-100/50" />
            <VoucherStatCard title="Total Vouchers" vouchers={d.vouchers} icon={<Ticket size={22} />} iconColorClass="text-rose-600 bg-rose-50 border border-rose-100/50" />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {d.recent_customers && (
              <GlassCard>
                <h3 className="font-bold mb-3 flex items-center gap-2 text-primary">
                  <UserCheck size={18} /> Recent Customers
                </h3>
                {d.recent_customers.length === 0 ? (
                  <EmptyState>No customer logins yet.</EmptyState>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th>Voucher Code</th>
                          <th>Customer Username</th>
                          <th>Price</th>
                          <th>Activated At</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.recent_customers.map((v: any) => (
                          <tr key={v.code} className="hover:bg-secondary/20 transition-colors">
                            <td className="font-mono font-semibold">{v.code}</td>
                            <td className="font-semibold text-slate-700">{v.customer_username || '—'}</td>
                            <td className="font-bold text-primary">{rs(v.price)}</td>
                            <td className="text-xs text-muted-foreground">{v.activated_at ? date(v.activated_at) : (v.sold_at ? date(v.sold_at) : '—')}</td>
                            <td>
                              <span className={`pill text-[10px] uppercase font-bold ${v.status === 'active' ? 'success' : (v.status === 'sold' ? 'info' : 'secondary')}`}>
                                {v.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>
            )}
          </div>
        </div>
      )}

      {/* Collect Payment Modal */}
      <Modal open={collectOpen} onClose={() => setCollectOpen(false)} title="Collect Payment" subtitle="Record cash payment received from a downline user. This immediately reduces their wallet due.">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Select User</label>
            <select 
              className="input" 
              value={collectForm.user_id} 
              onChange={(e) => {
                const uId = e.target.value
                const chosen = downlines.find((u) => u.id === +uId)
                setCollectForm({ 
                  ...collectForm, 
                  user_id: uId, 
                  amount: chosen ? String(chosen.wallet_due) : '' 
                })
              }}
            >
              <option value="">Choose a user...</option>
              {downlines.map((dl) => (
                <option key={dl.id} value={dl.id}>
                  {dl.name} ({dl.username}) — Due: {rs(dl.wallet_due)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Amount (Rs.)</label>
            <input 
              className="input" 
              type="number" 
              min="0.01" 
              step="0.01" 
              placeholder="e.g. 5000" 
              value={collectForm.amount} 
              onChange={(e) => setCollectForm({ ...collectForm, amount: e.target.value })} 
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Payment Note</label>
            <input 
              className="input" 
              placeholder="e.g. Received via cash / bank transfer" 
              value={collectForm.note} 
              onChange={(e) => setCollectForm({ ...collectForm, note: e.target.value })} 
            />
          </div>

          {collectErr && <div className="pill danger w-full justify-center py-2">{collectErr}</div>}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-5">
            <button className="btn-ghost" onClick={() => setCollectOpen(false)}>Cancel</button>
            <motion.button 
              whileTap={{ scale: 0.95 }} 
              className="btn-primary" 
              disabled={collectBusy || !collectForm.user_id || !collectForm.amount} 
              onClick={handleCollectPayment}
            >
              {collectBusy ? 'Processing...' : 'Collect Payment'}
            </motion.button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
