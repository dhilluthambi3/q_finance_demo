// frontend/src/features/OptionsPage.tsx
import { useEffect, useState } from 'react'
import { listClients, listPortfolios, submitJob, optionExpirations, optionChain, marketLookup } from '../lib/api'
import type { Client, Portfolio } from '../lib/types'

type Leg = { ticker:string; expiry:string; strike:number|string; option_type:'CALL'|'PUT'; qty:number|string; spot?:number }

export default function OptionsPage(){
    const [clients,setClients]=useState<Client[]>([])
    const [clientId,setClientId]=useState<string>("")
    const [ports,setPorts]=useState<Portfolio[]>([])
    const [portfolioId,setPortfolioId]=useState<string>("")

    const [product,setProduct]=useState<'European'|'American'|'Asian'|'Barrier'|'Basket'>('European')
    const [algo,setAlgo]=useState<'BlackScholes'|'MonteCarlo'|'QAE'>('BlackScholes')

    // mode
    const [useChain,setUseChain]=useState(true)

    // chain mode
    const [legs,setLegs]=useState<Leg[]>([{ticker:'AAPL',expiry:'',strike:'',option_type:'CALL',qty:1}])
    const [expiriesByTicker,setExpiriesByTicker]=useState<Record<string,string[]>>({})
    const [strikesByKey,setStrikesByKey]=useState<Record<string,number[]>>({})

    // historical mode (single instrument)
    const [hTicker,setHTicker]=useState('AAPL')
    const [hK,setHK]=useState<number|''>('')
    const [hOtype,setHOtype]=useState<'CALL'|'PUT'>('CALL')
    const [hMaturity,setHMaturity]=useState<string>('') // YYYY-MM-DD or blank (then use T)
    const [hT,setHT]=useState<number|''>('') // in years if no date
    const [hR,setHR]=useState<number|''>(0.01)
    const [hQ,setHQ]=useState<number|''>(0.0)
    const [hSigma,setHSigma]=useState<number|''>('') // optional; if blank backend estimates from 1y hist
    const [hSteps,setHSteps]=useState(252)
    const [hPaths,setHPaths]=useState(50000)
    const [hSpot,setHSpot]=useState<number|undefined>(undefined)

// load clients/ports
useEffect(()=>{ (async()=>{
const cs=await listClients(); setClients(cs)
if(cs.length){ setClientId(cs[0].id); setPorts(await listPortfolios(cs[0].id)) }
})()},[])
useEffect(()=>{ (async()=>{
if(clientId){ setPorts(await listPortfolios(clientId)); setPortfolioId('') }
})()},[clientId])

// ------------------------
// Chain mode helpers
// ------------------------
const addLeg = ()=> setLegs([...legs, {ticker:'AAPL',expiry:'',strike:'',option_type:'CALL',qty:1}])
const removeLeg = (i:number)=> setLegs(legs.filter((_,idx)=>idx!==i))
const updateLeg = (i:number, patch: Partial<Leg>)=>{
setLegs(prev=>{
    const next = prev.slice()
    const merged = {...next[i], ...patch}
    // avoid useless re-renders: only commit if changed
    if(JSON.stringify(next[i]) !== JSON.stringify(merged)){
    next[i] = merged
    return next
    }
    return prev
})
}

const fetchExpiries = async (tkr:string)=>{
if(!tkr) return
const r = await optionExpirations(tkr).catch(()=>({expirations:[]}))
setExpiriesByTicker(s=>({...s,[tkr]: r.expirations||[]}))
}
const fetchStrikes = async (tkr:string, exp:string, i:number)=>{
if(!tkr || !exp) return
const ch = await optionChain(tkr, exp).catch(()=>({calls:[],puts:[]}))
const arr = (ch.calls||[]).map((c:any)=>c.strike).concat((ch.puts||[]).map((p:any)=>p.strike))
const uniq = Array.from(new Set(arr)).sort((a:number,b:number)=>a-b)
setStrikesByKey(s=>({...s,[`${tkr}|${exp}`]: uniq}))
// set default strike once (if empty)
if(!legs[i].strike && uniq.length){
    updateLeg(i,{strike: uniq[Math.floor(uniq.length/2)]})
}
}
const fetchSpot = async (tkr:string, i?:number)=>{
if(!tkr) return
const info = await marketLookup(tkr).catch(()=>null)
if(info?.price!=null){
    if(i==null) setHSpot(info.price)
    else updateLeg(i,{spot: info.price})
}
}

// NOTE: remove aggressive useEffect loops; fetch on BLUR instead
const onTickerBlur = (i:number, t:string)=>{
const T = t.trim().toUpperCase().replace(/^\$/,'')
updateLeg(i,{ticker:T})
fetchExpiries(T); fetchSpot(T, i)
}
const onExpiryChange = (i:number, exp:string)=>{
updateLeg(i,{expiry:exp, strike:''})
const T = legs[i].ticker
if(T) fetchStrikes(T, exp, i)
}

// ------------------------
// Submit
// ------------------------
const submit=async(e:React.FormEvent)=>{ 
e.preventDefault()
if(product==='European' && useChain){
    const params:any = {
    r: 0.01, q: 0.0, save_paths: true, num_paths: 50000, num_steps: 252,
    legs: legs.map(l=>({ ...l, strike: Number(l.strike||0), qty: Number(l.qty||1) }))
    }
    await submitJob({type:'OptionPricing', product, algo, priority:'Normal', clientId, portfolioId, submitter:'You', params})
    alert('Submitted multi-leg option-chain job.')
    return
}

// Historical (no option-chain). Single leg classical pricing.
if(product==='European' && !useChain){
    const params:any = {
    use_chain: false,
    ticker: hTicker.trim().toUpperCase().replace(/^\$/,''),
    option_type: hOtype,
    strike: Number(hK),
    r: Number(hR), q: Number(hQ),
    num_steps: Number(hSteps), num_paths: Number(hPaths),
    }
    if(hSigma!=='') params.sigma = Number(hSigma)
    if(hMaturity) params.expiry = hMaturity
    else if(hT!=='') params.T = Number(hT)

    await submitJob({type:'OptionPricing', product, algo, priority:'Normal', clientId, portfolioId, submitter:'You', params})
    alert('Submitted historical (no chain) pricing job.')
    return
}

alert('This page currently supports European pricing (chain or historical). Use other pages for American/Asian/Barrier.')
}

return(
<div className='space-y-4'>
    <h1 className='text-xl font-semibold'>Run Option Pricing</h1>
    <div className='card'>
    <form onSubmit={submit} className='space-y-4'>

        {/* context */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        <div><label className='label'>Client</label>
            <select className='input' value={clientId} onChange={e=>setClientId(e.target.value)}>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>
        <div><label className='label'>Portfolio</label>
            <select className='input' value={portfolioId} onChange={e=>setPortfolioId(e.target.value)}>
            <option value=''>— optional —</option>
            {ports.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
        </div>
        <div><label className='label'>Product</label>
            <select className='input' value={product} onChange={e=>setProduct(e.target.value as any)}>
            <option>European</option><option>American</option><option>Asian</option><option>Barrier</option><option>Basket</option>
            </select>
        </div>
        <div><label className='label'>Algorithm</label>
            <select className='input' value={algo} onChange={e=>setAlgo(e.target.value as any)}>
            <option>BlackScholes</option><option>MonteCarlo</option><option>QAE</option>
            </select>
        </div>
        </div>

        {/* mode toggle */}
        <div className='flex items-center gap-4 text-sm'>
        <label className='flex items-center gap-2'>
            <input type='radio' name='mode' checked={useChain} onChange={()=>setUseChain(true)} />
            Use yfinance option chain (multi-leg)
        </label>
        <label className='flex items-center gap-2'>
            <input type='radio' name='mode' checked={!useChain} onChange={()=>setUseChain(false)} />
            Use historical prices (no chain)
        </label>
        </div>

        {/* CHAIN MODE */}
        {useChain && (
        <div className='space-y-3'>
            {legs.map((l,i)=>{
            const exps = expiriesByTicker[l.ticker]||[]
            const strikes = strikesByKey[`${l.ticker}|${l.expiry}`]||[]
            return (
                <div key={i} className='border rounded-lg p-3'>
                <div className='grid grid-cols-2 md:grid-cols-6 gap-3 items-end'>
                    <div><label className='label'>Ticker</label>
                    <input className='input' value={l.ticker}
                        onChange={e=>updateLeg(i,{ticker:e.target.value})}
                        onBlur={e=>onTickerBlur(i, e.target.value)} />
                    {l.spot!=null && <div className='text-xs text-gray-500 mt-1'>Spot: {l.spot}</div>}
                    </div>
                    <div><label className='label'>Expiry</label>
                    <select className='input' value={l.expiry} onChange={e=>onExpiryChange(i, e.target.value)}>
                        <option value=''>Select…</option>
                        {exps.map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                    </div>
                    <div><label className='label'>Strike</label>
                    <select className='input' value={String(l.strike)} onChange={e=>updateLeg(i,{strike:Number(e.target.value)})}>
                        <option value=''>—</option>
                        {strikes.map(s=><option key={s} value={s}>{s}</option>)}
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

        {/* HISTORICAL MODE */}
        {!useChain && (
        <div className='border rounded-lg p-3 space-y-3'>
            <div className='grid grid-cols-2 md:grid-cols-6 gap-3 items-end'>
            <div><label className='label'>Ticker</label>
                <input className='input' value={hTicker} onChange={e=>setHTicker(e.target.value)} onBlur={()=>fetchSpot(hTicker)} />
                {hSpot!=null && <div className='text-xs text-gray-500 mt-1'>Spot: {hSpot}</div>}
            </div>
            <div><label className='label'>Strike</label>
                <input className='input' type='number' value={hK} onChange={e=>setHK(e.target.value===''? '': Number(e.target.value))} />
            </div>
            <div><label className='label'>Type</label>
                <select className='input' value={hOtype} onChange={e=>setHOtype(e.target.value as any)}>
                <option>CALL</option><option>PUT</option>
                </select>
            </div>
            <div><label className='label'>Maturity date</label>
                <input className='input' type='date' value={hMaturity} onChange={e=>{ setHMaturity(e.target.value); setHT('') }} />
                <div className='text-xs text-gray-500'>or T (years) below</div>
            </div>
            <div><label className='label'>T (years)</label>
                <input className='input' type='number' step='0.01' value={hT} onChange={e=>{ setHT(e.target.value===''? '': Number(e.target.value)); setHMaturity('') }} />
            </div>
            <div><label className='label'>Sigma (optional)</label>
                <input className='input' type='number' step='0.001' value={hSigma} onChange={e=>setHSigma(e.target.value===''? '': Number(e.target.value))} />
            </div>
            </div>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
            <div><label className='label'>r</label><input className='input' type='number' step='0.001' value={hR} onChange={e=>setHR(Number(e.target.value))}/></div>
            <div><label className='label'>q</label><input className='input' type='number' step='0.001' value={hQ} onChange={e=>setHQ(Number(e.target.value))}/></div>
            <div><label className='label'>MC steps</label><input className='input' type='number' value={hSteps} onChange={e=>setHSteps(Number(e.target.value))}/></div>
            <div><label className='label'>MC paths</label><input className='input' type='number' value={hPaths} onChange={e=>setHPaths(Number(e.target.value))}/></div>
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
