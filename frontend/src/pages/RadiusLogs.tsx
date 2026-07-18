import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, XCircle, HelpCircle, Activity, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import { GlassCard, PageTitle, Pill } from '../components/ui'

export default function RadiusLogs() {
  const [logData, setLogData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Diagnostics State
  const [diagCode, setDiagCode] = useState('')
  const [diagLoading, setDiagLoading] = useState(false)
  const [diagResults, setDiagResults] = useState<any>(null)

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/radius/server-log', { params: { limit: 500 } })
      setLogData(response.data.data)
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch Radius logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const runDiagnostics = async () => {
    if (!diagCode.trim()) return
    setDiagLoading(true)
    setDiagResults(null)

    try {
      // Step 1: Query the voucher database
      const vResponse = await api.get('/vouchers', { params: { code: diagCode.trim() } })
      const matchingVouchers = vResponse.data.data?.data || []
      const voucher = matchingVouchers.find((v: any) => v.code.toLowerCase() === diagCode.trim().toLowerCase())

      if (!voucher) {
        setDiagResults({
          status: 'error',
          code: diagCode.trim(),
          checks: {
            dbExists: false,
            dbActive: false,
            radiusAuth: false,
          },
          summary: 'Voucher code does not exist in the database. Please verify the code.'
        })
        setDiagLoading(false)
        return
      }

      // Step 2: Scan parsed logs for matching messages for this voucher
      const serverLogs = logData?.logs || []
      const matchedLogs = serverLogs.filter((l: any) => 
        l.username && l.username.toLowerCase() === diagCode.trim().toLowerCase()
      )
      const lastReject = matchedLogs.find((l: any) => l.type === 'reject')
      const lastOk = matchedLogs.find((l: any) => l.type === 'success')
      const latestLog = matchedLogs[0]

      // Step 3: Determine auth response from the logs
      let authStatus = 'No attempts'
      let isOk = false
      if (latestLog) {
        if (latestLog.type === 'success') {
          authStatus = 'Access-Accept'
          isOk = true
        } else if (latestLog.type === 'reject') {
          authStatus = 'Access-Reject'
        } else {
          authStatus = latestLog.status_message || 'Info'
        }
      }

      // Step 4: Compile summary logic
      let summary = ''
      
      if (voucher.status === 'disabled') {
        summary = 'The voucher is currently disabled. Please enable it in the Voucher Sales dashboard.'
      } else if (voucher.status === 'expired') {
        summary = 'The voucher has expired because its validity duration has passed.'
      } else if (authStatus === 'Access-Reject') {
        summary = `RADIUS auth rejected this voucher. Log error message: "${latestLog.status_message}" (logged on ${latestLog.timestamp || '—'}).`
      } else if (authStatus === 'Access-Accept') {
        summary = `RADIUS auth succeeded! The voucher authenticated successfully (logged on ${latestLog.timestamp || '—'}).`
      } else {
        summary = 'No recent authentication attempts found for this voucher in the server logs. Ask the user to try connecting.'
      }

      setDiagResults({
        status: isOk ? 'success' : 'warning',
        code: diagCode.trim(),
        voucher,
        authStatus,
        matchedLogs,
        lastReject,
        lastOk,
        latestLog,
        checks: {
          dbExists: true,
          dbStatus: voucher.status,
          planName: voucher.plan?.name,
          radiusAuth: authStatus === 'Access-Accept',
        },
        summary
      })

    } catch (err: any) {
      setDiagResults({
        status: 'error',
        code: diagCode.trim(),
        summary: 'Diagnostics failed: ' + (err.response?.data?.message || err.message)
      })
    } finally {
      setDiagLoading(false)
    }
  }

  return (
    <div className="w-full space-y-6 py-4">
      <PageTitle 
        title="Voucher Diagnostics" 
        subtitle="Troubleshoot authentication & authorization issues for voucher cards" 
        icon={<Activity size={22} className="text-primary" />} 
      />

      {error && (
        <div className="bg-rose-50 text-rose-800 border border-rose-200 rounded-2xl p-4 flex items-center gap-2">
          <AlertCircle size={18} className="shrink-0" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      <GlassCard className="space-y-6 p-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 block">Enter Voucher Code to Diagnose</label>
          <div className="flex gap-3">
            <input
              className="input text-base"
              placeholder="e.g. ASMRWRHR"
              value={diagCode}
              onChange={(e) => setDiagCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runDiagnostics()}
            />
            <button
              className="btn-primary px-6 flex items-center gap-2"
              onClick={runDiagnostics}
              disabled={diagLoading || !diagCode.trim()}
            >
              {diagLoading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Diagnosing...
                </>
              ) : 'Diagnose'}
            </button>
          </div>
        </div>

        {/* Diagnostics Output */}
        {diagResults ? (
          <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/50 space-y-4 text-sm leading-relaxed">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="font-bold text-slate-800 text-base">Voucher: "{diagResults.code}"</span>
              <Pill tone={diagResults.status === 'success' ? 'success' : (diagResults.status === 'error' ? 'danger' : 'warning')}>
                {diagResults.status.toUpperCase()}
              </Pill>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Database Record:</span>
                  {diagResults.checks.dbExists ? (
                    <span className="flex items-center gap-1 font-semibold text-emerald-600">
                      <CheckCircle size={15} /> Found ({diagResults.checks.dbStatus})
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-semibold text-rose-600">
                      <XCircle size={15} /> Missing
                    </span>
                  )}
                </div>

                {diagResults.checks.dbExists && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Plan Package:</span>
                      <span className="font-semibold text-slate-700">{diagResults.checks.planName || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Voucher Price:</span>
                      <span className="font-semibold text-slate-700">Rs. {diagResults.voucher?.price}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">RADIUS Auth Response:</span>
                  {diagResults.checks.radiusAuth ? (
                    <span className="flex items-center gap-1 font-semibold text-emerald-600">
                      <CheckCircle size={15} /> Access-Accept
                    </span>
                  ) : diagResults.authStatus === 'Access-Reject' ? (
                    <span className="flex items-center gap-1 font-semibold text-rose-600">
                      <XCircle size={15} /> Access-Reject
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-semibold text-slate-400">
                      <HelpCircle size={15} /> {diagResults.authStatus || 'Skipped'}
                    </span>
                  )}
                </div>

                {diagResults.matchedLogs?.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Server Log Matches:</span>
                    <span className="font-semibold text-slate-700">{diagResults.matchedLogs.length} events</span>
                  </div>
                )}
              </div>
            </div>

            {/* Diagnostic Summary */}
            <div className="pt-4 border-t bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
              <p className="font-bold text-slate-800 text-sm mb-1.5 flex items-center gap-2">
                <CheckCircle size={16} className="text-primary" />
                Diagnostic Summary:
              </p>
              <p className="text-slate-700 font-semibold text-sm leading-relaxed">
                {diagResults.summary}
              </p>
            </div>

            {/* Relevant logs detail list */}
            {diagResults.matchedLogs?.length > 0 && (
              <div className="space-y-2 mt-2">
                <p className="font-bold text-slate-700 text-xs">Recent Server Log Entries for this Voucher:</p>
                <div className="divide-y border border-slate-100 bg-white rounded-xl overflow-hidden max-h-[140px] overflow-y-auto">
                  {diagResults.matchedLogs.slice(0, 3).map((l: any, i: number) => (
                    <div key={i} className="p-3 text-xs flex items-start justify-between gap-3 hover:bg-slate-50/50">
                      <div className="flex gap-2 items-start">
                        {l.type === 'success' ? (
                          <ShieldCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-semibold text-slate-700">{l.status_message}</p>
                          {l.client && <p className="text-[10px] text-slate-400 font-mono">NAS: {l.client}</p>}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">{l.timestamp || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 italic">
            <Activity size={32} className="text-slate-300 mb-2" />
            <span>Enter a voucher code above and click Diagnose to start troubleshooting.</span>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
