// frontend/src/features/OptionsPage.tsx
import { useEffect, useState, useMemo } from 'react'
import {
  listClients, listPortfolios,
  optionExpirations, optionChain, marketLookup,
  submitJob, // uses existing jobs pipeline
} from '../lib/api'
import type { Client, Portfolio } from '../lib/types'

type Algo = 'BlackScholes'|'MonteCarlo'|'QAE'
type Product = 'European'|'American'|'Asian'|'Barrier'|'Basket'
type Leg = { ticker:string; expiry:string; strike:number|string; option_type:'CALL'|'PUT'; qty:number|string; spot?:number }

export default function OptionsPage(){
  // context
  const [clients,setClients]=useState<Client[]>([])
  const [clientId,setClientId]=useState<string>('')
  const [ports,setPorts]=useState<Portfolio[]>([])
  const [portfolioId,setPortfolioId]=useState<string>('')

  const [product,setProduct]=useState<Product>('European')
  const [algo,setAlgo]=useState<Algo>('BlackScholes')
  const [useChain,setUseChain]=useState(true) // chain vs historical

  // chain mode
  const [legs,setLegs]=useState<Leg[]>([{ticker:'AAPL',expiry:'',strike:'',option_type:'CALL',qty:1}])
  const [expiriesByTicker,setExpiriesByTicker]=useState<Record<string,string[]>>({})
  const [strikesByKey,setStrikesByKey]=useState<Record<string,number[]>>({})

  // historical mode (single instrument)
  const [hTicker,setHTicker]=useState('AAPL')
  const [hK,setHK]=useState<number|''>('')
  const [hOtype,setHOtype]=useState<'CALL'|'PUT'>('CALL')
  const [hMaturity,setHMaturity]=useState<string>('') // ISO date
  const [hT,setHT]=useState<number|''>('') // years
  const [hR,setHR]=useState<number>(0.01)
  const [hQ,setHQ]=useState<number>(0.0)
  const [hSigma,setHSigma]=useState<number|''>('') // optional
  const [hSteps,setHSteps]=useState<number>(252)
  const [hPaths,setHPaths]=useState<number>(100000)
  const [hSavePaths,setHSavePaths]=useState<'true'|'false'>('true')
  const [hQubits,setHQubits]=useState<number>(8)
  const [hShots,setHShots]=useState<number>(4096)
  const [hSampler,setHSampler]=useState<'terra'|'v2'|'aer'>('terra')
  const [hSpot,setHSpot]=useState<number|undefined>(undefined)

  // clients/ports
  useEffect(()=>{ (async()=>{
    const cs=await listClients(); setClients(cs)
    if(cs.length){ setClientId(cs[0].id); setPorts(await listPortfolios(cs[0].id)) }
  })()},[])
  useEffect(()=>{ (async()=>{
    if(clientId){ setPorts(await listPortfolios(clientId)); setPortfolioId('') }
  })()},[clientId])

  // helpers
  const addLeg = ()=> setLegs([...legs,{ticker:'AAPL',expiry:'',strike:'',option_type:'CALL',qty:1}])
  const removeLeg = (i:number)=> setLegs(legs.filter((_,idx)=>idx!==i))
  const updateLeg = (i:number, patch:Partial<Leg>)=> setLegs(prev=>{
    const n = prev.slice(); n[i] = {...n[i], ...patch}; return n
  })

  const fetchExpiries = async (tkr:string)=>{
    if(!tkr) return
    const r = await optionExpirations(tkr).catch(()=>({expirations:[]}))
    setExpiriesByTicker(s=>({...s,[tkr]: r.expirations||[]}))
  }
  const fetchStrikes = async (tkr:string, exp:string, i:number)=>{
    const ch = await optionChain(tkr, exp).catch(()=>({calls:[],puts:[]}))
    const arr = (ch.calls||[]).map((c:any)=>c.strike).concat((ch.puts||[]).map((p:any)=>p.strike))
    const uniq = Array.from(new Set(arr)).sort((a:number,b:number)=>a-b)
    setStrikesByKey(s=>({...s,[`${tkr}|${exp}`]: uniq}))
    if(!legs[i].strike && uniq.length){ updateLeg(i,{strike: uniq[Math.floor(uniq.length/2)]}) }
  }
  const fetchSpot = async (tkr:string, i?:number)=>{
    const info = await marketLookup(tkr).catch(()=>null)
    if(info?.price!=null){
      if(i==null) setHSpot(info.price)
      else updateLeg(i,{spot: info.price})
    }
  }
  const onTickerBlur = (i:number, t:string)=>{
    const T = t.trim().toUpperCase().replace(/^\$/,'')
    updateLeg(i,{ticker:T}); fetchExpiries(T); fetchSpot(T,i)
  }
  const onExpiryChange = (i:number, exp:string)=>{
    updateLeg(i,{expiry:exp, strike:''})
    const T = legs[i].ticker; if(T) fetchStrikes(T, exp, i)
  }

  const showBS = algo==='BlackScholes'
  const showMC = algo==='MonteCarlo'
  const showQAE = algo==='QAE'

  const submit=async(e:React.FormEvent)=>{ e.preventDefault()
    if(product!=='European'){ alert('For now, focus = European options.'); return }
    if(useChain){
      const params:any = {
        legs: legs.map(l=>({
          ticker: String(l.ticker||'').toUpperCase().replace(/^\$/,''),
          expiry: l.expiry,
          strike: Number(l.strike||0),
          option_type: l.option_type,
          qty: Number(l.qty||1)
        })),
        r: hR, q: hQ
      }
      if(showMC){ params.num_steps=hSteps; params.num_paths=hPaths; params.save_paths=hSavePaths }
      if(showQAE){ params.qubits=hQubits; params.shots=hShots; params.sampler=hSampler }
      await submitJob({ type:'OptionPricing', product, algo, priority:'Normal', submitter:'You', clientId, portfolioId, params } as any)
      alert('Submitted option-chain job.')
      return
    } else {
      // historical single instrument
      const params:any = {
        use_chain:false,
        ticker: hTicker.trim().toUpperCase().replace(/^\$/,''),
        option_type: hOtype,
        strike: Number(hK),
        r: hR, q: hQ
      }
      if(hMaturity) params.expiry=hMaturity; else if(hT!=='') params.T=Number(hT)
      if(hSigma!=='') params.sigma=Number(hSigma)
      if(showMC){ params.num_steps=hSteps; params.num_paths=hPaths; params.save_paths=hSavePaths }
      if(showQAE){ params.qubits=hQubits; params.shots=hShots; params.sampler=hSampler }
      await submitJob({ type:'OptionPricing', product, algo, priority:'Normal', submitter:'You', clientId, portfolioId, params } as any)
      alert('Submitted historical pricing job.')
      return
    }
  }

  return (
    <div className='space-y-4'>
      <h1 className='text-xl font-semibold'>European Option Pricing</h1>
      <div className='card'>
        <form onSubmit={submit} className='space-y-4'>
          {/* Context */}
          <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
            <div><label className='label'>Client</label>
              <select className='input' value={clientId} onChange={e=>setClientId(e.target.value)}>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className='label'>Portfolio</label>
              <select className='input' value={portfolioId} onChange={e=>setPortfolioId(e.target.value)}>
                <option value=''>— optional —</option>
                {ports.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className='label'>Algorithm</label>
              <select className='input' value={algo} onChange={e=>setAlgo(e.target.value as Algo)}>
                <option>BlackScholes</option><option>MonteCarlo</option><option>QAE</option>
              </select>
            </div>
            <div><label className='label'>Data source</label>
              <select className='input' value={useChain? 'chain':'historical'} onChange={e=>setUseChain(e.target.value==='chain')}>
                <option value='chain'>yfinance option chain</option>
                <option value='historical'>historical prices</option>
              </select>
            </div>
          </div>

          {/* CHAIN MODE (multi-leg) */}
          {useChain && (
            <div className='space-y-3'>
              {legs.map((l,i)=>{
                const exps = expiriesByTicker[l.ticker]||[]
                const strikes = strikesByKey[`${l.ticker}|${l.expiry}`]||[]
                return (
                  <div key={i} className='border rounded-lg p-3'>
                    <div className='grid grid-cols-2 md:grid-cols-6 gap-3 items-end'>
                      <div><label className='label'>Ticker</label>
                        <input className='input' value={l.ticker} onChange={e=>updateLeg(i,{ticker:e.target.value})} onBlur={e=>onTickerBlur(i,e.target.value)} />
                        {l.spot!=null && <div className='text-xs text-gray-500 mt-1'>Spot: {l.spot}</div>}
                      </div>
                      <div><label className='label'>Expiry</label>
                        <select className='input' value={l.expiry} onChange={e=>onExpiryChange(i, e.target.value)}>
                          <option value=''>Select…</option>{exps.map(d=><option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div><label className='label'>Strike</label>
                        <select className='input' value={String(l.strike)} onChange={e=>updateLeg(i,{strike:Number(e.target.value)})}>
                          <option value=''>—</option>{strikes.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div><label className='label'>Type</label>
                        <select className='input' value={l.option_type} onChange={e=>updateLeg(i,{option_type:e.target.value as any})}>
                          <option>CALL</option><option>PUT</option>
                        </select>
                      </div>
                      <div><label className='label'>Qty</label>
                        <input className='input' type='number' value={l.qty} onChange={e=>updateLeg(i,{qty:Number(e.target.value)})}/>
                      </div>
                      <div className='flex gap-2 justify-end'>
                        {legs.length>1 && <button type='button' className='px-3 py-2 rounded-lg border' onClick={()=>removeLeg(i)}>Remove</button>}
                        {i===legs.length-1 && <button type='button' className='btn' onClick={addLeg}>Add leg</button>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* HISTORICAL MODE (single) */}
          {!useChain && (
            <div className='border rounded-lg p-3 space-y-3'>
              <div className='grid grid-cols-2 md:grid-cols-6 gap-3 items-end'>
                <div><label className='label'>Ticker</label>
                  <input className='input' value={hTicker} onChange={e=>setHTicker(e.target.value)} onBlur={()=>fetchSpot(hTicker)} />
                  {hSpot!=null && <div className='text-xs text-gray-500 mt-1'>Spot: {hSpot}</div>}
                </div>
                <div><label className='label'>Strike</label>
                  <input className='input' type='number' value={hK} onChange={e=>setHK(e.target.value===''? '': Number(e.target.value))}/>
                </div>
                <div><label className='label'>Type</label>
                  <select className='input' value={hOtype} onChange={e=>setHOtype(e.target.value as any)}>
                    <option>CALL</option><option>PUT</option>
                  </select>
                </div>
                <div><label className='label'>Maturity date</label>
                  <input className='input' type='date' value={hMaturity} onChange={e=>{ setHMaturity(e.target.value); setHT('') }}/>
                  <div className='text-xs text-gray-500'>or set T (years)</div>
                </div>
                <div><label className='label'>T (years)</label>
                  <input className='input' type='number' step='0.01' value={hT} onChange={e=>{ setHT(e.target.value===''? '': Number(e.target.value)); setHMaturity('') }}/>
                </div>
                <div><label className='label'>Sigma (optional)</label>
                  <input className='input' type='number' step='0.001' value={hSigma} onChange={e=>setHSigma(e.target.value===''? '': Number(e.target.value))}/>
                </div>
              </div>
            </div>
          )}

          {/* Algo-specific fields */}
          {showBS && (
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
              <div><label className='label'>r</label><input className='input' type='number' step='0.001' value={hR} onChange={e=>setHR(Number(e.target.value))}/></div>
              <div><label className='label'>q</label><input className='input' type='number' step='0.001' value={hQ} onChange={e=>setHQ(Number(e.target.value))}/></div>
            </div>
          )}
          {showMC && (
            <div className='grid grid-cols-2 md:grid-cols-5 gap-3'>
              <div><label className='label'>r</label><input className='input' type='number' step='0.001' value={hR} onChange={e=>setHR(Number(e.target.value))}/></div>
              <div><label className='label'>q</label><input className='input' type='number' step='0.001' value={hQ} onChange={e=>setHQ(Number(e.target.value))}/></div>
              <div><label className='label'>Steps</label><input className='input' type='number' value={hSteps} onChange={e=>setHSteps(Number(e.target.value))}/></div>
              <div><label className='label'>Paths</label><input className='input' type='number' value={hPaths} onChange={e=>setHPaths(Number(e.target.value))}/></div>
              <div><label className='label'>Save paths</label>
                <select className='input' value={hSavePaths} onChange={e=>setHSavePaths(e.target.value as any)}>
                  <option value='true'>Yes</option><option value='false'>No</option>
                </select>
              </div>
            </div>
          )}
          {showQAE && (
            <div className='grid grid-cols-2 md:grid-cols-5 gap-3'>
              <div><label className='label'>Qubits</label><input className='input' type='number' value={hQubits} onChange={e=>setHQubits(Number(e.target.value))}/></div>
              <div><label className='label'>Shots</label><input className='input' type='number' value={hShots} onChange={e=>setHShots(Number(e.target.value))}/></div>
              <div><label className='label'>Sampler</label>
                <select className='input' value={hSampler} onChange={e=>setHSampler(e.target.value as any)}>
                  <option value='terra'>terra</option><option value='v2'>v2</option><option value='aer'>aer</option>
                </select>
              </div>
            </div>
          )}

          <div className='flex justify-end gap-2'>
            <button type='reset' className='px-3 py-2 rounded-lg border'>Reset</button>
            <button className='btn'>Submit Job</button>
          </div>
        </form>
      </div>
    </div>
  )
}
