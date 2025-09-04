// frontend/src/features/PortfolioDetail.tsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { listClients, listPortfolios, listAssets, upsertAsset, deleteAsset, submitJob, marketLookup, optionExpirations, optionChain } from '../lib/api'
import type { Client, Portfolio, Asset } from '../lib/types'

export default function PortfolioDetail(){
  const {id:clientId,pid:portfolioId}=useParams();
  const[client,setClient]=useState<Client|null>(null);
  const[portfolio,setPortfolio]=useState<Portfolio|null>(null);
  const[assets,setAssets]=useState<Asset[]>([]);
  const[showAsset,setShowAsset]=useState(false);
  const[showPricer,setShowPricer]=useState(false);
  const[showOpt,setShowOpt]=useState(false);

  // pricer - option chain state
  const[useChain,setUseChain]=useState(false)
  const[ticker,setTicker]=useState("")
  const[expiries,setExpiries]=useState<string[]>([])
  const[expiry,setExpiry]=useState("")
  const[strikes,setStrikes]=useState<number[]>([])
  const[strike,setStrike]=useState<number|''>('')

  const refresh=async()=>{
    const cs=await listClients(); const c=cs.find(x=>x.id===clientId)||null; setClient(c);
    if(c){const ps=await listPortfolios(c.id); const p=ps.find(x=>x.id===portfolioId)||null; setPortfolio(p); if(p) setAssets(await listAssets(p.id))}
  }
  useEffect(()=>{refresh()},[clientId,portfolioId])

  const onUpsert=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault(); const f=new FormData(e.currentTarget);
    await upsertAsset(portfolio!.id,{ id:String(f.get('id')||''), ticker:String(f.get('ticker')), type:String(f.get('type')||'Equity') as any, quantity:Number(f.get('quantity')), avgPrice:Number(f.get('avgPrice')) } as any);
    setShowAsset(false); refresh()
  }

  const yfFill = async (form: HTMLFormElement) => {
    const t = String((new FormData(form)).get('ticker')||'').trim()
    if(!t) return
    const info = await marketLookup(t)
    if(info?.price!=null){
      (form.querySelector('input[name=avgPrice]') as HTMLInputElement).value = String(info.price)
    }
    const nameEl = form.querySelector('[data-asset-name]') as HTMLDivElement
    if(nameEl) nameEl.textContent = info?.name ? `Name: ${info.name}` : ''
  }

  const onPrice=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault(); const f=new FormData(e.currentTarget);
    const params=Object.fromEntries(f.entries());
    if(useChain){
      params['use_chain']='true'
      params['ticker']=ticker
      params['expiry']=expiry
      params['strike']=String(strike)
    }
    await submitJob({type:'OptionPricing',product:String(f.get('product')||'European') as any, algo:String(f.get('algo')||'MonteCarlo') as any, priority:String(f.get('priority')||'Normal') as any, submitter:'You', clientId:clientId!, portfolioId:portfolioId!, params});
    setShowPricer(false); alert('Pricing job submitted for this portfolio.')
  }

  const onOptimize=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault(); const f=new FormData(e.currentTarget);
    const params = { target: Number(f.get('target')||0.0), constraint: String(f.get('constraint')||'None'), portfolioId: portfolioId! }
    await submitJob({type:'PortfolioOptimization', product:'European', algo:String(f.get('algo')||'MeanVariance') as any, priority:String(f.get('priority')||'Normal') as any, submitter:'You', clientId:clientId!, portfolioId:portfolioId!, params})
    setShowOpt(false); alert('Optimization job submitted for this portfolio.')
  }

  const loadExpiries = async () => {
    if(!ticker) return
    const res = await optionExpirations(ticker)
    setExpiries(res.expirations||[])
    setExpiry(res.expirations?.[0]||"")
  }
  useEffect(()=>{ if(useChain) loadExpiries() },[useChain, ticker])

  const loadStrikes = async () => {
    if(!ticker || !expiry) return
    const ch = await optionChain(ticker, expiry)
    const arr = (ch.calls||[]).map((c:any)=>c.strike).concat((ch.puts||[]).map((p:any)=>p.strike))
    const unique = Array.from(new Set(arr)).sort((a:number,b:number)=>a-b)
    setStrikes(unique); setStrike(unique[Math.floor(unique.length/2)]||'')
  }
  useEffect(()=>{ if(useChain) loadStrikes() },[expiry])

  if(!client||!portfolio) return <div className='text-gray-500'>Loading...</div>

  return(
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-semibold'>{portfolio.name}</h1>
          <div className='text-sm text-gray-600'>{client.name} • {portfolio.baseCurrency} • {portfolio.mandate}</div>
        </div>
        <div className='flex gap-2'>
          <button className='btn' onClick={()=>setShowOpt(true)}>Run Optimization</button>
          <button className='btn' onClick={()=>setShowPricer(true)}>Run Option Pricing</button>
          <button className='btn' onClick={()=>setShowAsset(true)}>Add / Edit asset</button>
        </div>
      </div>

      <div className='card p-0 overflow-hidden'>
        <table className='min-w-full'>
          <thead className='bg-gray-50 text-left text-sm text-gray-600'>
            <tr><th className='px-4 py-3'>Ticker</th><th className='px-4 py-3'>Type</th><th className='px-4 py-3'>Qty</th><th className='px-4 py-3'>Avg Price</th><th className='px-4 py-3'></th></tr>
          </thead>
          <tbody>
            {assets.map(a=>(
              <tr key={a.id} className='border-t'>
                <td className='px-4 py-3'>{a.ticker}</td>
                <td className='px-4 py-3'>{a.type}</td>
                <td className='px-4 py-3'>{a.quantity}</td>
                <td className='px-4 py-3'>{a.avgPrice}</td>
                <td className='px-4 py-3 text-right'><button className='text-sm text-red-600' onClick={async()=>{await deleteAsset(a.id); refresh()}}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Asset modal */}
      {showAsset&&(
        <div className='fixed inset-0 bg-black/40 grid place-items-center' onClick={()=>setShowAsset(false)}>
          <div className='card w-full max-w-lg' onClick={e=>e.stopPropagation()}>
            <div className='text-lg font-semibold mb-3'>Add / Edit asset</div>
            <form onSubmit={onUpsert} className='space-y-3'>
              <input type='hidden' name='id'/>
              <div className='grid grid-cols-3 gap-3'>
                <div className='col-span-2'><label className='label'>Ticker</label><input name='ticker' className='input' required/></div>
                <div className='flex items-end'><button type='button' className='btn' onClick={(e)=>yfFill(e.currentTarget.form!)}>Fetch from yfinance</button></div>
              </div>
              <div className='text-xs text-gray-600' data-asset-name></div>
              <div className='grid grid-cols-2 gap-3'>
                <div><label className='label'>Type</label><select name='type' className='input'><option>Equity</option><option>ETF</option><option>Bond</option><option>Option</option><option>Crypto</option></select></div>
                <div><label className='label'>Quantity</label><input name='quantity' className='input' type='number' step='1' required/></div>
              </div>
              <div><label className='label'>Average Price</label><input name='avgPrice' className='input' type='number' step='0.01' required/></div>
              <div className='flex justify-end gap-2'>
                <button type='button' className='px-3 py-2 rounded-lg border' onClick={()=>setShowAsset(false)}>Cancel</button>
                <button className='btn'>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pricer modal */}
      {showPricer&&(
        <div className='fixed inset-0 bg-black/40 grid place-items-center' onClick={()=>setShowPricer(false)}>
          <div className='card w-full max-w-2xl' onClick={e=>e.stopPropagation()}>
            <div className='text-lg font-semibold mb-3'>Option Pricing (portfolio scope)</div>
            <form onSubmit={onPrice} className='space-y-3'>
              <div className='grid grid-cols-3 gap-3'>
                <div><label className='label'>Product</label><select name='product' className='input'><option>European</option><option>American</option><option>Asian</option><option>Barrier</option><option>Basket</option></select></div>
                <div><label className='label'>Algorithm</label><select name='algo' className='input'><option>BlackScholes</option><option>MonteCarlo</option><option>QAE</option></select></div>
                <div><label className='label'>Priority</label><select name='priority' className='input'><option>Normal</option><option>High</option><option>Urgent</option></select></div>
              </div>

              <div className='flex items-center gap-2'>
                <input id='useChain' type='checkbox' checked={useChain} onChange={e=>setUseChain(e.target.checked)} />
                <label htmlFor='useChain' className='text-sm'>Use yfinance option chain (European only)</label>
              </div>

              {!useChain && (
                <>
                  <div className='grid grid-cols-3 gap-3'>
                    <div><label className='label'>Option Type</label><select name='option_type' className='input'><option>CALL</option><option>PUT</option></select></div>
                    <div><label className='label'>S0</label><input name='S0' className='input' placeholder='100' required/></div>
                    <div><label className='label'>K (strike)</label><input name='K' className='input' type='number' step='0.01' defaultValue='100' required/></div>
                  </div>
                  <div className='grid grid-cols-3 gap-3'>
                    <div><label className='label'>T (years)</label><input name='T' className='input' type='number' step='0.01' defaultValue='1'/></div>
                    <div><label className='label'>r</label><input name='r' className='input' type='number' step='0.0001' defaultValue='0.01'/></div>
                    <div><label className='label'>sigma</label><input name='sigma' className='input' placeholder='0.2' defaultValue='0.2'/></div>
                  </div>
                </>
              )}

              {useChain && (
                <div className='grid grid-cols-3 gap-3'>
                  <div><label className='label'>Ticker</label><input className='input' value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} placeholder='AAPL' required/></div>
                  <div><label className='label'>Expiry</label>
                    <select className='input' value={expiry} onChange={e=>setExpiry(e.target.value)}>{expiries.map(d=><option key={d} value={d}>{d}</option>)}</select>
                  </div>
                  <div><label className='label'>Strike</label>
                    <select className='input' value={String(strike)} onChange={e=>setStrike(Number(e.target.value))}>
                      {strikes.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className='grid grid-cols-2 gap-3'>
                <div><label className='label'>q (dividend, optional)</label><input name='q' className='input' type='number' step='0.0001'/></div>
                <div><label className='label'>Paths (MC) / Steps (Binomial)</label><input name='num_paths' className='input' type='number' placeholder='100000 (MC) or steps' defaultValue={100000}/></div>
              </div>
              <div className='flex items-center gap-2'>
                <input id='savePaths' name='save_paths' type='checkbox' defaultChecked />
                <label htmlFor='savePaths' className='text-sm'>Store Monte-Carlo paths for analysis</label>
              </div>

              <div className='flex justify-end gap-2'>
                <button type='button' className='px-3 py-2 rounded-lg border' onClick={()=>setShowPricer(false)}>Cancel</button>
                <button className='btn'>Submit Job</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Optimization modal */}
      {showOpt&&(
        <div className='fixed inset-0 bg-black/40 grid place-items-center' onClick={()=>setShowOpt(false)}>
          <div className='card w-full max-w-xl' onClick={e=>e.stopPropagation()}>
            <div className='text-lg font-semibold mb-3'>Portfolio Optimization (this portfolio)</div>
            <form onSubmit={onOptimize} className='space-y-3'>
              <div className='grid grid-cols-3 gap-3'>
                <div><label className='label'>Algorithm</label><select name='algo' className='input'><option>MeanVariance</option><option>QAOA</option></select></div>
                <div><label className='label'>Priority</label><select name='priority' className='input'><option>Normal</option><option>High</option><option>Urgent</option></select></div>
                <div><label className='label'>Target return (optional)</label><input name='target' className='input' type='number' step='0.001' placeholder='e.g., 0.08'/></div>
              </div>
              <div>
                <label className='label'>Constraint</label>
                <select name='constraint' className='input'>
                  <option value="None">None</option>
                  <option value="Long-only">Long-only</option>
                  <option value="Gross<=1">Gross&lt;=1</option>
                  <option value="Max weight 20%">Max weight 20%</option>
                  <option value="Cardinality=5">Cardinality=5</option>
                </select>
              </div>
              <div className='flex justify-end gap-2'>
                <button type='button' className='px-3 py-2 rounded-lg border' onClick={()=>setShowOpt(false)}>Cancel</button>
                <button className='btn'>Submit Job</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
