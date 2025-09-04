// frontend/src/features/JobDetail.tsx
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getJob, getJobPaths } from '../lib/api'
import type { Job } from '../lib/types'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function JobDetail(){
  const { id } = useParams()
  const [job, setJob] = useState<Job | undefined>()
  const [limit, setLimit] = useState(50)
  const [stride, setStride] = useState(1)
  const [paths, setPaths] = useState<{t:number[]; series:number[][]; n_total:number; steps_total:number} | null>(null)

  const hasPaths = useMemo(()=> {
    const r:any = job?.result
    return Boolean(r?.paths?.gridfs_id || (Array.isArray(r?.legs) && r.legs.some((l:any)=>l?.paths?.gridfs_id)))
  },[job])

  useEffect(()=>{
    if(!id) return
    const run = async ()=>{
      const j = await getJob(id)
      setJob(j)
      if(hasPaths){
        // If multi-leg, backend saves MC paths only for the first leg to save space
        const p = await getJobPaths(id, limit, stride).catch(()=>null)
        if(p) setPaths(p)
      } else {
        setPaths(null)
      }
    }
    run()
    const t = setInterval(run, 1200)
    return ()=>clearInterval(t)
  },[id, limit, stride, hasPaths])

  if(!job) return <div className='text-gray-500'>Loading...</div>

  const r:any = job.result || {}
  const isMultiLeg = Array.isArray(r.legs) && r.legs.length>0
  const rows = paths ? buildChartData(paths.t, paths.series) : []

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-semibold'>Job {job.id.slice(-8)}</h1>
        <span className={'px-2 py-1 rounded-full text-xs ' + badge(job.status)}>{job.status}</span>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div className='card'>
          <div className='font-medium mb-2'>Metadata</div>
          <div className='text-sm space-y-1'>
            <div><b>Type:</b> {job.type}</div>
            <div><b>Product:</b> {job.product || '-'}</div>
            <div><b>Algo:</b> {job.algo}</div>
            <div><b>Client:</b> {job.clientName || job.clientId || '-'}</div>
            <div><b>Portfolio:</b> {job.portfolioName || job.portfolioId || '-'}</div>
            <div><b>Created:</b> {fmtDt(job.createdAt)}</div>
            <div><b>Updated:</b> {fmtDt(job.updatedAt)}</div>
            {(job as any).durationSec!=null && <div><b>Duration:</b> {(job as any).durationSec}s</div>}
          </div>
        </div>

        <div className='card'>
          <div className='font-medium mb-2'>Parameters</div>
          <pre className='text-sm bg-gray-50 p-3 rounded-lg overflow-auto'>{JSON.stringify(job.params, null, 2)}</pre>
        </div>

        {/* Results */}
        <div className='card md:col-span-2'>
          <div className='font-medium mb-2'>Result</div>

          {/* Single-instrument summary (price/stderr) */}
          {!isMultiLeg && (r.price!=null || r.stderr!=null) && (
            <div className='mb-3'>
              <div className='text-lg font-semibold'>
                Price: {fmtNum(r.price)}
                {r.stderr!=null && <span className='text-sm text-gray-600'> (± {fmtNum(r.stderr)})</span>}
              </div>
            </div>
          )}

          {/* Multi-leg table */}
          {isMultiLeg && (
            <div className='mb-4'>
              <div className='text-sm text-gray-600 mb-1'>Legs</div>
              <div className='overflow-x-auto'>
                <table className='min-w-full text-sm border'>
                  <thead className='bg-gray-50'>
                    <tr>
                      <th className='px-3 py-2 text-left'>#</th>
                      <th className='px-3 py-2 text-left'>Ticker</th>
                      <th className='px-3 py-2 text-left'>Expiry</th>
                      <th className='px-3 py-2 text-left'>Type</th>
                      <th className='px-3 py-2 text-right'>Strike</th>
                      <th className='px-3 py-2 text-right'>Qty</th>
                      <th className='px-3 py-2 text-right'>Spot</th>
                      <th className='px-3 py-2 text-right'>IV</th>
                      <th className='px-3 py-2 text-right'>T</th>
                      <th className='px-3 py-2 text-right'>Price</th>
                      <th className='px-3 py-2 text-right'>SE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.legs.map((leg:any)=>(
                      <tr key={leg.leg} className='border-t'>
                        <td className='px-3 py-2'>{leg.leg}</td>
                        <td className='px-3 py-2'>{leg.ticker}</td>
                        <td className='px-3 py-2'>{leg.expiry}</td>
                        <td className='px-3 py-2'>{leg.otype}</td>
                        <td className='px-3 py-2 text-right'>{fmtNum(leg.strike)}</td>
                        <td className='px-3 py-2 text-right'>{fmtNum(leg.qty)}</td>
                        <td className='px-3 py-2 text-right'>{fmtNum(leg.S0)}</td>
                        <td className='px-3 py-2 text-right'>{fmtNum(leg.sigma)}</td>
                        <td className='px-3 py-2 text-right'>{fmtNum(leg.T)}</td>
                        <td className='px-3 py-2 text-right'>{fmtNum(leg.price)}</td>
                        <td className='px-3 py-2 text-right'>{fmtNum(leg.stderr)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {r.totals && (
                    <tfoot>
                      <tr className='border-t bg-gray-50'>
                        <td className='px-3 py-2' colSpan={9}>Totals</td>
                        <td className='px-3 py-2 text-right'>{fmtNum(r.totals?.notional)}</td>
                        <td className='px-3 py-2 text-right text-gray-600'>WA: {fmtNum(r.totals?.weightedAvg)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Raw JSON (collapsible could be nicer later) */}
          <pre className='text-xs bg-gray-50 p-3 rounded-lg overflow-auto'>{JSON.stringify(r, null, 2)}</pre>
        </div>

        {/* MC paths */}
        {hasPaths && (
          <div className='card md:col-span-2'>
            <div className='flex items-center justify-between mb-3'>
              <div className='font-medium'>Monte-Carlo Paths (subset)</div>
              <div className='flex items-center gap-3 text-sm'>
                <label>Show paths</label>
                <input type='number' className='input w-24' min={1} value={limit} onChange={e=>setLimit(Math.max(1, Number(e.target.value)||1))}/>
                <label>Stride</label>
                <input type='number' className='input w-20' min={1} value={stride} onChange={e=>setStride(Math.max(1, Number(e.target.value)||1))}/>
                {paths && <div className='text-gray-500'>Total: {paths.n_total} paths, {paths.steps_total} steps</div>}
              </div>
            </div>
            <div style={{width:'100%', height:360}}>
              <ResponsiveContainer>
                <LineChart data={rows}>
                  <XAxis dataKey="t" />
                  <YAxis />
                  <Tooltip />
                  {paths?.series.map((_,i)=><Line key={i} dataKey={`p${i}`} dot={false} />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {job.error && (
          <div className='card md:col-span-2'>
            <div className='font-medium mb-2'>Error</div>
            <pre className='text-sm bg-red-50 p-3 rounded-lg overflow-auto text-red-700'>{String(job.error)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

function buildChartData(t: number[], series: number[][]){
  return t.map((tt, idx)=> {
    const row: any = { t: Number((tt as any).toFixed ? (tt as any).toFixed(4) : tt) }
    for(let j=0;j<series.length;j++){ row[`p${j}`] = series[j][idx] }
    return row
  })
}

function badge(status?:string){
  if(status==='Succeeded') return 'bg-green-100 text-green-700'
  if(status==='Running') return 'bg-blue-100 text-blue-700'
  if(status==='Failed') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-700'
}
function fmtDt(s?:string){ return s? new Date(s).toLocaleString(): '-' }
function fmtNum(x:any){
  if(x==null) return '-'
  const n = Number(x)
  return Number.isFinite(n) ? (Math.abs(n) >= 1e4 ? n.toFixed(2) : n.toFixed(4)) : String(x)
}
