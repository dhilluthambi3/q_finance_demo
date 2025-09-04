// frontend/src/features/ClientDetail.tsx
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { listClients, listPortfolios, createPortfolio, deletePortfolio } from '../lib/api'
import type { Client, Portfolio } from '../lib/types'

export default function ClientDetail(){
  const {id}=useParams(); 
  const[client,setClient]=useState<Client|null>(null); 
  const[portfolios,setPortfolios]=useState<Portfolio[]>([]); 
  const[showP,setShowP]=useState(false)

  const refresh=async()=>{
    const cs=await listClients(); 
    const c=cs.find(x=>x.id===id)||null; 
    setClient(c); 
    if(c) setPortfolios(await listPortfolios(c.id))
  }
  useEffect(()=>{refresh()},[id])

  const onCreateP=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault(); 
    const f=new FormData(e.currentTarget);
    await createPortfolio(id!,{
      name:String(f.get('name')),
      baseCurrency:String(f.get('baseCurrency')||'USD') as any,
      mandate:String(f.get('mandate')||'Balanced') as any,
      benchmark:String(f.get('benchmark')||'')
    } as any); 
    setShowP(false); 
    refresh()
  }

  if(!client) return <div className='text-gray-500'>Loading...</div>

  return(
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-semibold'>{client.name}</h1>
          <div className='text-sm text-gray-600'>{client.segment} • Owner: {client.owner}</div>
        </div>
        <div className='flex gap-2'>
          <button className='btn' onClick={()=>setShowP(true)}>New portfolio</button>
        </div>
      </div>

      <div className='card p-0 overflow-hidden'>
        <table className='min-w-full'>
          <thead className='bg-gray-50 text-left text-sm text-gray-600'>
            <tr><th className='px-4 py-3'>Name</th><th className='px-4 py-3'>Currency</th><th className='px-4 py-3'>Mandate</th><th className='px-4 py-3'>Benchmark</th><th className='px-4 py-3'></th></tr>
          </thead>
          <tbody>
            {portfolios.map(p=>(
              <tr key={p.id} className='border-t'>
                <td className='px-4 py-3'>
                  <Link className='text-brand-700 font-medium' to={`/clients/${client.id}/portfolios/${p.id}`}>{p.name}</Link>
                </td>
                <td className='px-4 py-3'>{p.baseCurrency}</td>
                <td className='px-4 py-3'>{p.mandate}</td>
                <td className='px-4 py-3'>{p.benchmark}</td>
                <td className='px-4 py-3 text-right'>
                  <button className='text-sm text-red-600 mr-3' onClick={async()=>{await deletePortfolio(p.id); refresh()}}>Delete</button>
                  <Link to={`/clients/${client.id}/portfolios/${p.id}`} className='text-sm text-brand-700 hover:underline'>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showP&&(
        <div className='fixed inset-0 bg-black/40 grid place-items-center' onClick={()=>setShowP(false)}>
          <div className='card w-full max-w-lg' onClick={e=>e.stopPropagation()}>
            <div className='text-lg font-semibold mb-3'>New portfolio</div>
            <form onSubmit={onCreateP} className='space-y-3'>
              <div><label className='label'>Name</label><input name='name' className='input' required/></div>
              <div className='grid grid-cols-3 gap-3'>
                <div><label className='label'>Base currency</label><select name='baseCurrency' className='input'><option>USD</option><option>EUR</option><option>INR</option><option>JPY</option><option>GBP</option></select></div>
                <div><label className='label'>Mandate</label><select name='mandate' className='input'><option>Aggressive</option><option>Balanced</option><option>Conservative</option></select></div>
                <div><label className='label'>Benchmark</label><input name='benchmark' className='input' placeholder='e.g., S&P 500'/></div>
              </div>
              <div className='flex justify-end gap-2'>
                <button type='button' className='px-3 py-2 rounded-lg border' onClick={()=>setShowP(false)}>Cancel</button>
                <button className='btn'>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
