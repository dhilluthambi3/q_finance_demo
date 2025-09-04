export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
export async function http<T=any>(path:string, init?:RequestInit):Promise<T>{
  const res = await fetch(`${API_BASE}${path}`,{
    headers:{'Content-Type':'application/json',...(init?.headers||{})}, ...init
  })
  if(!res.ok) throw new Error(await res.text())
  return res.status===204?(undefined as any):res.json()
}
