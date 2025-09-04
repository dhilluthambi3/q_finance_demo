// frontend/src/features/OptimPage.tsx
import { useEffect, useState } from 'react'
import { listClients, listPortfolios, submitJob } from '../lib/api'
import type { Client, Portfolio } from '../lib/types'

export default function OptimPage(){
  const [clients,setClients]=useState<Client[]>([])
  const [clientId,setClientId]=useState<string>("")
  const [ports,setPorts]=useState<Portfolio[]>([])
  const [portfolioId,setPortfolioId]=useState<string>("")
  const [algo,setAlgo]=useState<'MeanVariance'|'QUBO'|'QAOA'>('MeanVariance')

  useEffect(()=>{ (async()=>{ const cs=await listClients(); setClients(cs); if(cs.length){ setClientId(cs[0].id); setPorts(await listPortfolios(cs[0].id)) } })()},[])
  useEffect(()=>{ (async()=>{ if(clientId){ setPorts(await listPortfolios(clientId)); setPortfolioId('') } })()},[clientId])

  const submit=async(e:React.FormEvent)=>{ e.preventDefault()
    const f=new FormData(e.currentTarget as HTMLFormElement)
    const params = {
      target: Number(f.get('target')||0),
      constraint: String(f.get('constraint')||'None'),
    }
    await submitJob({type:'PortfolioOptimization', product:'European', algo, priority:String(f.get('priority')||'Normal') as any, clientId, portfolioId, submitter:'You', params})
    alert('Submitted optimization job.')
  }

  return(
    <div className='space-y-4'>
      <h1 className='text-xl font-semibold'>Run Portfolio Optimization</h1>
      <div className='card'>
        <form onSubmit={submit} className='space-y-3'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
            <div><label className='label'>Client</label>
              <select className='input' value={clientId} onChange={e=>setClientId(e.target.value)}>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <div><label className='label'>Portfolio</label>
              <select className='input' value={portfolioId} onChange={e=>setPortfolioId(e.target.value)}>
                <option value=''>— select —</option>
                {ports.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className='label'>Algorithm</label>
              <select className='input' value={algo} onChange={e=>setAlgo(e.target.value as any)}>
                <option>MeanVariance</option><option>QUBO</option><option>QAOA</option>
              </select>
            </div>
            <div><label className='label'>Priority</label><select name='priority' className='input'><option>Normal</option><option>High</option><option>Urgent</option></select></div>
          </div>

          <div className='grid grid-cols-3 gap-3'>
            <div><label className='label'>Target return</label><input name='target' className='input' type='number' step='0.001' placeholder='e.g., 0.08'/></div>
<div><label className='label'>Constraint</label><select name='constraint' className='input'><option>None</option><option>Long-only</option><option>Gross&le;1</option><option>Max weight 20%</option></select></div>          </div>

          <div className='flex justify-end gap-2'>
            <button type='reset' className='px-3 py-2 rounded-lg border'>Reset</button>
            <button className='btn'>Submit Job</button>
          </div>
        </form>
      </div>
    </div>
  )
}
