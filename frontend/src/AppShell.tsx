import { ReactNode } from 'react'
import { Menu, Bell, LogOut, Search } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useUI, useSession } from './lib/store'
export default function AppShell({children}:{children:ReactNode}){
  const {sidebarOpen,setSidebarOpen}=useUI(); const {user,logout}=useSession()
  return(<div className='min-h-screen flex'>
    <aside className={`bg-white border-r w-72 p-4 md:block ${sidebarOpen?'block':'hidden'} md:relative fixed z-40`}>
      <div className='flex items-center gap-2 mb-6'><div className='h-9 w-9 rounded-xl bg-brand-600 text-white grid place-items-center font-bold'>Q</div><div><div className='text-sm text-gray-500'>Quantum Finance</div><div className='font-semibold -mt-0.5'>Portfolio Manager</div></div></div>
      <nav className='space-y-1'>
        <S t='Workspace'/><Item to='/dashboard' l='Dashboard'/><Item to='/clients' l='Clients'/><Item to='/jobs' l='Jobs'/>
        <S t='Analytics'/><Item to='/options' l='Option Pricing'/><Item to='/optimization' l='Portfolio Optimization'/>
        <S t='Admin'/><Item to='/audit' l='Audit Log'/><Item to='/settings' l='Settings'/>
      </nav>
    </aside>
    <div className='flex-1 flex flex-col'>
      <header className='h-16 bg-white border-b px-4 flex items-center justify-between'>
        <div className='flex items-center gap-2'><button className='md:hidden p-2 rounded-lg hover:bg-gray-100' onClick={()=>setSidebarOpen(!sidebarOpen)}><Menu className='h-5 w-5'/></button>
          <div className='relative'><Search className='h-4 w-4 absolute left-2 top-2.5 text-gray-400'/><input placeholder='Search clients, portfolios, jobs...' className='pl-8 pr-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-brand-600 w-72'/></div>
        </div>
        <div className='flex items-center gap-3'><button className='p-2 rounded-lg hover:bg-gray-100 relative'><Bell className='h-5 w-5'/></button><div className='text-sm text-gray-600'>{user?.name}</div><button className='p-2 rounded-lg hover:bg-gray-100' title='Logout' onClick={logout}><LogOut className='h-5 w-5'/></button></div>
      </header>
      <main className='p-4'>{children}</main>
    </div>
  </div>)}
function S({t}:{t:string}){return <div className='px-2 pt-5 pb-1 text-[11px] uppercase tracking-wider text-gray-400'>{t}</div>}
function Item({to,l}:{to:string,l:string}){return <NavLink to={to} className={({isActive})=>'block px-3 py-2 rounded-lg font-medium '+(isActive?'bg-brand-50 text-brand-700':'text-gray-700 hover:bg-gray-100')}>{l}</NavLink>}