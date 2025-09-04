import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AppShell from './AppShell'
import Login from './features/Login'
import Dashboard from './features/Dashboard'
import Clients from './features/Clients'
import ClientDetail from './features/ClientDetail'
import PortfolioDetail from './features/PortfolioDetail'
import Jobs from './features/Jobs'
import JobDetail from './features/JobDetail'
import OptionsPage from './features/OptionsPage'
import OptimPage from './features/OptimPage'
import Settings from './features/Settings'
import Audit from './features/Audit'
import { useSession } from './lib/store'
function RequireAuth({children}:{children:JSX.Element}){ const {user}=useSession(); const loc=useLocation(); if(!user) return <Navigate to='/login' state={{from:loc}} replace/>; return children }
export default function App(){
  return(<Routes>
    <Route path='/login' element={<Login/>}/>
    <Route path='/' element={<RequireAuth><AppShell><Dashboard/></AppShell></RequireAuth>}/>
    <Route path='/dashboard' element={<RequireAuth><AppShell><Dashboard/></AppShell></RequireAuth>}/>
    <Route path='/clients' element={<RequireAuth><AppShell><Clients/></AppShell></RequireAuth>}/>
    <Route path='/clients/:id' element={<RequireAuth><AppShell><ClientDetail/></AppShell></RequireAuth>}/>
    <Route path='/clients/:id/portfolios/:pid' element={<RequireAuth><AppShell><PortfolioDetail/></AppShell></RequireAuth>}/>
    <Route path='/jobs' element={<RequireAuth><AppShell><Jobs/></AppShell></RequireAuth>}/>
    <Route path='/jobs/:id' element={<RequireAuth><AppShell><JobDetail/></AppShell></RequireAuth>}/>
    <Route path='/options' element={<RequireAuth><AppShell><OptionsPage/></AppShell></RequireAuth>}/>
    <Route path='/optimization' element={<RequireAuth><AppShell><OptimPage/></AppShell></RequireAuth>}/>
    <Route path='/settings' element={<RequireAuth><AppShell><Settings/></AppShell></RequireAuth>}/>
    <Route path='/audit' element={<RequireAuth><AppShell><Audit/></AppShell></RequireAuth>}/>
  </Routes>)
}