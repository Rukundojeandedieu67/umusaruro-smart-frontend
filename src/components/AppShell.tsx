import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity, Bell, Bot, CloudSun, Home, Layers3, Leaf, LogIn, LogOut, Map,
  MapPinned, Menu, ShieldCheck, Sprout, Tractor, UserRound, X,
} from 'lucide-react'
import { getApiBaseUrl } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useNetworkState } from '../hooks'

const desktopLinks = [
  { to: '/', label: 'Overview', icon: Home, end: true },
  { to: '/farm', label: 'Hillsides & terraces', icon: Layers3 },
  { to: '/map', label: 'Map', icon: Map },
  { to: '/ndvi', label: 'Vegetation', icon: Activity },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/extension', label: 'Extension desk', icon: Tractor },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/weather', label: 'Weather', icon: CloudSun },
  { to: '/advisories', label: 'Advisories', icon: ShieldCheck },
  { to: '/scanner', label: 'Crop scanner', icon: Leaf },
  { to: '/assistant', label: 'Assistant', icon: Bot },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

const mobileLinks = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/farm', label: 'Farm', icon: Sprout },
  { to: '/map', label: 'Map', icon: Map },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

const titles: Record<string, string> = {
  '/': 'Pilot overview', '/farm': 'Hillsides & terraces', '/map': 'Pilot map',
  '/ndvi': 'Vegetation health', '/alerts': 'Alert center', '/notifications': 'Notifications',
  '/weather': 'Weather & advice', '/advisories': 'Advisories', '/scanner': 'Crop scanner',
  '/assistant': 'Umusaruro Assistant', '/profile': 'Account & settings',
  '/extension': 'Extension-worker desk',
}

function NavBrand() {
  return <NavLink to="/" className="brand-lockup" aria-label="Umusaruro-Smart home">
    <span className="brand-mark"><Sprout size={20} strokeWidth={2} /></span>
    <span><strong>Umusaruro</strong><small>SMART · RWANDA PILOT</small></span>
  </NavLink>
}

function SidebarLinks({ close }: { close?: () => void }) {
  return <nav className="sidebar-nav">
    {desktopLinks.map(({ to, label, icon: Icon, end }) => (
      <NavLink key={to} to={to} end={end} onClick={close} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
        <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
      </NavLink>
    ))}
  </nav>
}

export function AppShell() {
  const { token, isTrainer, disconnect } = useAuth()
  const online = useNetworkState()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{ stale: boolean; cachedAt: number } | null>(null)
  const currentTitle = titles[location.pathname] || 'Hillside details'

  useEffect(() => {
    const update = (event: Event) => setSyncStatus((event as CustomEvent<{ stale: boolean; cachedAt: number }>).detail)
    window.addEventListener('umusaruro:sync', update)
    return () => window.removeEventListener('umusaruro:sync', update)
  }, [])

  const syncedAt = syncStatus?.cachedAt
    ? new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(syncStatus.cachedAt)
    : null

  return <div className="app-frame">
    <aside className="sidebar" aria-label="Main navigation">
      <NavBrand />
      <div className="sidebar-caption">PILOT WORKSPACE</div>
      <SidebarLinks />
      <div className="sidebar-footer">
        <div className="sidebar-status"><span className={`status-light ${online ? 'online' : 'offline'}`} />{online ? 'Connected' : 'Offline'}</div>
        <span className="sidebar-sync">{syncStatus?.stale ? `Cached · ${syncedAt || 'previous session'}` : syncedAt ? `Synced ${syncedAt}` : 'No sync yet'}</span>
      </div>
    </aside>

    <div className="main-column">
      <header className="topbar">
        <button className="icon-button menu-toggle" type="button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
        <div className="breadcrumb"><span>Umusaruro-Smart</span><span className="crumb-separator">/</span><strong>{currentTitle}</strong></div>
        <div className="topbar-actions">
          <div className={`connection-pill ${!online || syncStatus?.stale ? 'is-offline' : ''}`}>
            <span className="status-light" /><span>{!online ? 'Offline' : syncStatus?.stale ? 'Offline data' : 'Online'}</span>
          </div>
          {token ? <button className="account-chip" type="button" onClick={() => { disconnect(); navigate('/') }} title="Disconnect token">
            <span className="avatar"><UserRound size={15} /></span><span>{isTrainer ? 'Trainer' : 'Field team'}</span><LogOut size={15} />
          </button> : <button className="button button-small button-outline" type="button" onClick={() => navigate('/profile')}><LogIn size={15} />Connect</button>}
        </div>
      </header>

      {!online && <div className="offline-banner" role="status">Offline · showing cached read-only data where available.</div>}
      {syncStatus?.stale && online && <div className="offline-banner" role="status">Showing cached data · last sync {syncedAt || 'earlier'}.</div>}
      <main className="page-content"><Outlet /></main>
    </div>

    <nav className="mobile-nav" aria-label="Mobile navigation">
      {mobileLinks.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}>
        <Icon size={20} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
      </NavLink>)}
    </nav>

    {menuOpen && <div className="mobile-drawer-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setMenuOpen(false)
    }}>
      <aside className="mobile-drawer" aria-label="Navigation menu">
        <div className="drawer-top"><NavBrand /><button className="icon-button" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>
        <SidebarLinks close={() => setMenuOpen(false)} />
        <div className="drawer-endpoint"><MapPinned size={15} />{getApiBaseUrl()}</div>
      </aside>
    </div>}
  </div>
}