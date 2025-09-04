// frontend/src/features/Dashboard.tsx
import { useEffect, useState } from 'react'
import { clientsStats, jobsStats } from '../lib/api'
import type { Job } from '../lib/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Link } from 'react-router-dom'

export default function Dashboard(){
    const [cstats,setCstats]=useState<{clients:number,portfolios:number,assets:number}>({clients:0,portfolios:0,assets:0})
    const [jstats,setJstats]=useState<{total:number, byStatus:Record<string,number>, recent:Job[], running:Job[]}>({total:0,byStatus:{},recent:[],running:[]})

    const refresh=async()=>{ setCstats(await clientsStats()); setJstats(await jobsStats()) }
    useEffect(()=>{ refresh(); const t=setInterval(refresh,2000); return()=>clearInterval(t) },[])

    const chartData = Object.entries(jstats.byStatus||{}).map(([k,v])=>({status:k,count:v}))

    return(
        <div className='space-y-4'>
        <h1 className='text-xl font-semibold'>Dashboard</h1>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <Card title='Clients' value={cstats.clients} />
            <Card title='Portfolios' value={cstats.portfolios} />
            <Card title='Assets' value={cstats.assets} />
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
            <div className='card'>
            <div className='font-semibold mb-3'>Jobs by status</div>
            <div style={{width:'100%', height:260}}>
                <ResponsiveContainer>
                <BarChart data={chartData}>
                    <CartesianGrid vertical={false} strokeDasharray='3 3'/>
                    <XAxis dataKey="status" />
                    <YAxis allowDecimals={false}/>
                    <Tooltip />
                    <Bar dataKey="count" />
                </BarChart>
                </ResponsiveContainer>
            </div>
            </div>
            <div className='card'>
            <div className='font-semibold mb-3'>Currently running</div>
            <ul className='space-y-2 text-sm'>
                {jstats.running.map(j=>(<li key={j.id} className='flex justify-between'>
                <span>{j.type} {j.product?`• ${j.product}`:''} — {j.clientName||j.clientId} / {j.portfolioName||j.portfolioId||'-'}</span>
                <Link to={`/jobs/${j.id}`} className='text-brand-700'>view</Link>
                </li>))}
                {!jstats.running.length && <div className='text-gray-500'>No running jobs.</div>}
            </ul>
            </div>
        </div>

        <div className='card'>
            <div className='font-semibold mb-3'>Recent jobs</div>
            <div className='overflow-x-auto'>
            <table className='min-w-full text-sm'>
                <thead className='bg-gray-50 text-left text-gray-600'>
                <tr><th className='px-3 py-2'>Job</th><th className='px-3 py-2'>Type</th><th className='px-3 py-2'>Product</th><th className='px-3 py-2'>Client</th><th className='px-3 py-2'>Portfolio</th><th className='px-3 py-2'>Status</th><th className='px-3 py-2'>Duration</th><th className='px-3 py-2'></th></tr>
                </thead>
                <tbody>
                {jstats.recent.map(j=>(
                    <tr key={j.id} className='border-t'>
                    <td className='px-3 py-2 text-xs text-gray-500'>{j.id.slice(-8)}</td>
                    <td className='px-3 py-2'>{j.type}</td>
                    <td className='px-3 py-2'>{j.product||'-'}</td>
                    <td className='px-3 py-2'>{j.clientName||j.clientId||'-'}</td>
                    <td className='px-3 py-2'>{j.portfolioName||j.portfolioId||'-'}</td>
                    <td className='px-3 py-2'>{j.status}</td>
                    <td className='px-3 py-2'>{j.durationSec!=null ? `${j.durationSec}s` : '-'}</td>
                    <td className='px-3 py-2'><Link to={`/jobs/${j.id}`} className='text-brand-700'>details</Link></td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
        </div>
        </div>
    )
}

function Card({title,value}:{title:string,value:number|string}) {
    return <div className='card'>
        <div className='text-sm text-gray-500'>{title}</div>
        <div className='text-2xl font-semibold'>{value}</div>
    </div>
}
