// frontend/src/lib/api.ts
import { http } from './http'
import type { Client, Portfolio, Asset, Job, UUID, User } from './types'

export const login = async (email: string): Promise<User> => http('/api/auth/login', { method:'POST', body: JSON.stringify({ email }) })

export const listClients = (): Promise<Client[]> => http('/api/clients')
export const createClient = (payload: Omit<Client,'id'|'createdAt'|'updatedAt'>): Promise<Client> => http('/api/clients',{method:'POST',body:JSON.stringify(payload)})
export const updateClient = (id: UUID, patch: Partial<Client>): Promise<Client> => http(`/api/clients/${id}`,{method:'PATCH',body:JSON.stringify(patch)})
export const deleteClient = (id: UUID): Promise<void> => http(`/api/clients/${id}`,{method:'DELETE'})
export const clientsStats = (): Promise<{clients:number,portfolios:number,assets:number}> => http('/api/clients/stats')

export const listPortfolios = (clientId: UUID): Promise<Portfolio[]> => http(`/api/clients/${clientId}/portfolios`)
export const createPortfolio = (clientId: UUID, payload: Omit<Portfolio,'id'|'clientId'|'createdAt'|'updatedAt'>): Promise<Portfolio> => http(`/api/clients/${clientId}/portfolios`,{method:'POST',body:JSON.stringify(payload)})
export const updatePortfolio = (id: UUID, patch: Partial<Portfolio>): Promise<Portfolio> => http(`/api/portfolios/${id}`,{method:'PATCH',body:JSON.stringify(patch)})
export const deletePortfolio = (id: UUID): Promise<void> => http(`/api/portfolios/${id}`,{method:'DELETE'})

export const listAssets = (portfolioId: UUID): Promise<Asset[]> => http(`/api/portfolios/${portfolioId}/assets`)
export const upsertAsset = (portfolioId: UUID, payload: Omit<Asset,'portfolioId'>): Promise<Asset> => http(`/api/portfolios/${portfolioId}/assets`,{method:'POST',body:JSON.stringify(payload)})
export const deleteAsset = (assetId: UUID): Promise<void> => http(`/api/assets/${assetId}`,{method:'DELETE'})

export const submitJob = (payload: Omit<Job,'id'|'createdAt'|'updatedAt'|'status'>): Promise<Job> => http('/api/jobs',{method:'POST',body:JSON.stringify(payload)})
export const listJobs = (q?:{clientId?:UUID,portfolioId?:UUID}): Promise<Job[]> => http(`/api/jobs${q?.clientId||q?.portfolioId?`?${new URLSearchParams(q as any).toString()}`:''}`)
export const getJob = (id: UUID): Promise<Job> => http(`/api/jobs/${id}`)
export const jobsStats = (): Promise<{total:number, byStatus:Record<string,number>, recent:Job[], running:Job[]}> => http('/api/jobs/stats')
export const getJobPaths = (id: UUID, limit=100, stride=1) => http(`/api/jobs/${id}/paths?${new URLSearchParams({limit:String(limit), stride:String(stride)})}`)

// Market / yfinance helpers
export const marketLookup = (ticker: string) => http(`/api/market/lookup?ticker=${encodeURIComponent(ticker)}`)
export const optionExpirations = (ticker: string) => http(`/api/market/options/expirations?ticker=${encodeURIComponent(ticker)}`)
export const optionChain = (ticker: string, expiry: string) => http(`/api/market/options/chain?ticker=${encodeURIComponent(ticker)}&expiry=${encodeURIComponent(expiry)}`)
