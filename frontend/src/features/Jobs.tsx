import { useEffect, useState } from 'react'
import { listJobs, submitJob } from '../lib/api'
import type { Job } from '../lib/types'
import { Link } from 'react-router-dom'

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [showForm, setShowForm] = useState(false)

  const refresh = async () => setJobs(await listJobs())
  useEffect(() => { refresh(); const t = setInterval(refresh, 1500); return () => clearInterval(t) }, [])

  const onSubmitJob = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    await submitJob({
      type: f.get('type') as any,
      algo: f.get('algo') as any,
      priority: f.get('priority') as any,
      submitter: 'You',
      params: Object.fromEntries(f.entries())
    } as any)
    setShowForm(false); refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Jobs</h1>
        <button className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-2 rounded-lg" onClick={() => setShowForm(true)}>New job</button>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 text-left text-sm text-gray-600">
            <tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Algo</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id} className="border-t">
                <td className="px-4 py-3 text-xs text-gray-500">{j.id.slice(-8)}</td>
                <td className="px-4 py-3">{j.type}</td>
                <td className="px-4 py-3">{j.algo}</td>
                <td className="px-4 py-3">{j.priority}</td>
                <td className="px-4 py-3"><span className={"px-2 py-1 rounded-full text-xs " + (j.status === 'Succeeded' ? 'bg-green-100 text-green-700' : j.status === 'Running' ? 'bg-blue-100 text-blue-700' : j.status === 'Failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700')}>{j.status}</span></td>
                <td className="px-4 py-3">{new Date(j.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-right"><Link to={`/jobs/${j.id}`} className="text-sm text-brand-700 hover:underline">Details</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center" onClick={() => setShowForm(false)}>
          <div className="card w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-semibold mb-3">Submit new job</div>
            <form onSubmit={onSubmitJob} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Type</label><select name="type" className="input"><option>OptionPricing</option><option>PortfolioOptimization</option></select></div>
                <div><label className="label">Algorithm</label><select name="algo" className="input"><option>BlackScholes</option><option>MonteCarlo</option><option>QAE</option><option>MeanVariance</option><option>QUBO</option><option>QAOA</option></select></div>
                <div><label className="label">Priority</label><select name="priority" className="input"><option>Normal</option><option>High</option><option>Urgent</option><option>Low</option></select></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Ticker (opt.)</label><input name="ticker" className="input" placeholder="AAPL, INFY.NS"/></div>
                <div><label className="label">Strike K (opt.)</label><input name="K" type="number" step="0.01" className="input"/></div>
                <div><label className="label">Monte Carlo paths (opt.)</label><input name="num_paths" type="number" step="1" className="input"/></div>
              </div>
              <div className="flex justify-end gap-2"><button type="button" className="px-3 py-2 rounded-lg border" onClick={() => setShowForm(false)}>Cancel</button><button className="px-3 py-2 rounded-lg bg-brand-600 text-white">Submit</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}