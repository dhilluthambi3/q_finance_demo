import { create } from 'zustand'
import type { User } from './types'
type UI = { sidebarOpen: boolean; setSidebarOpen: (v:boolean)=>void }
type Session = { user: User|null; login:(u:User)=>void; logout:()=>void }
export const useUI = create<UI>((set)=>({ sidebarOpen:true, setSidebarOpen:(v)=>set({sidebarOpen:v}) }))
export const useSession = create<Session>((set)=>({ user:null, login:(u)=>set({user:u}), logout:()=>set({user:null}) }))