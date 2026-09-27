import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CloudRain,
  Droplets,
  Loader2,
  LogOut,
  MapPinned,
  ShieldCheck,
  Sprout,
  User,
  Wind,
} from 'lucide-react'
import { api, setAccessToken } from './api/client'
import type { AlertRecord, Hillside, Terrace, WeatherForecast } from './api/types'
import './App.css'

const STORAGE_KEY = 'umusaruro:access-token'

type AuthMode = 'signin' | 'register'
type UserSession = {
  id: number
  username: string
  email: string
  role: string
  first_name: string
  last_name: string
}

function getStoredAccessToken() {
  if (typeof window === 'undefined') return ''
  return window.sessionStorage.getItem(STORAGE_KEY) || ''
}

function normalizeRole(role?: string): 'guest' | 'farmer' | 'extension_worker' | 'agronomist' | 'admin' | 'rab' | 'trainer' {
  switch (role) {
    case 'admin':
      return 'admin'
    case 'extension_worker':
      return 'extension_worker'
    case 'agronomist':
    case 'trainer':
      return 'agronomist'
    case 'rab':
      return 'rab'
    case 'guest':
      return 'guest'
    default:
      return 'farmer'
  }
}

function badgeLabel(role: string) {
  switch (role) {
    case 'admin':
      return 'Administrator'
    case 'extension_worker':
      return 'Extension worker'
    case 'agronomist':
      return 'Agronomist'
    case 'rab':
      return 'RAB officer'
    case 'trainer':
      return 'Trainer'
    case 'guest':
      return 'Guest'
    default:
      return 'Farmer'
  }
}

function App() {
  const [token, setToken] = useState<string | null>(() => getStoredAccessToken() || null)
  const [user, setUser] = useState<UserSession | null>(null)
  const [hillsides, setHillsides] = useState<Hillside[]>([])
  const [selectedHillsideId, setSelectedHillsideId] = useState<number | null>(null)
  const [terraces, setTerraces] = useState<Terrace[]>([])
  const [alerts, setAlerts] = useState<AlertRecord[]>([])
  const [forecast, setForecast] = useState<WeatherForecast | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [authOpen, setAuthOpen] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authForm, setAuthForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    username: '',
  })
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [assistantReply, setAssistantReply] = useState('')

  const isAuthenticated = Boolean(token)

  useEffect(() => {
    setAccessToken(token)
    if (!token) {
      setUser(null)
      return
    }

    void api.me().then((profile) => {
      setUser({
        id: profile.id,
        username: profile.username,
        email: profile.email,
        role: profile.role,
        first_name: profile.first_name,
        last_name: profile.last_name,
      })
    }).catch(() => {
      handleLogout()
    })
  }, [token])

  useEffect(() => {
    let cancelled = false

    const fetchDashboard = async () => {
      setLoading(true)
      setError('')
      try {
        const [hillsideData, warningData] = await Promise.all([
          api.hillsides(),
          api.alerts(),
        ])

        if (cancelled) return

        setHillsides(hillsideData)
        setAlerts(warningData)

        const firstHillsideId = hillsideData[0]?.id ?? null
        if (firstHillsideId) {
          setSelectedHillsideId(firstHillsideId)
        }
      } catch (requestError) {
        if (cancelled) return
        setError(requestError instanceof Error ? requestError.message : 'Unable to load the dashboard data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchDashboard()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedHillsideId) return

    let cancelled = false

    const fetchHillsideContext = async () => {
      try {
        const [terraceData, weatherData] = await Promise.all([
          api.terraces(selectedHillsideId),
          api.weather(selectedHillsideId),
        ])

        if (!cancelled) {
          setTerraces(terraceData)
          setForecast(weatherData.data)
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load the selected hillside details.')
        }
      }
    }

    void fetchHillsideContext()
    return () => {
      cancelled = true
    }
  }, [selectedHillsideId])

  const summaryCards = useMemo(() => [
    { label: 'Active hillsides', value: String(hillsides.length), icon: MapPinned, tone: 'green' },
    { label: 'Terraces tracked', value: String(terraces.length), icon: Sprout, tone: 'leaf' },
    { label: 'Open alerts', value: String(alerts.length), icon: AlertTriangle, tone: 'amber' },
    { label: 'AI access', value: isAuthenticated ? 'Enabled' : 'Sign in', icon: Bot, tone: 'sky' },
  ], [alerts.length, hillsides.length, isAuthenticated, terraces.length])

  const topAlerts = alerts.slice(0, 3)

  const handleLogout = () => {
    setToken(null)
    setAccessToken(null)
    setUser(null)
    window.sessionStorage.removeItem(STORAGE_KEY)
  }

  const persistToken = (newToken: string) => {
    setToken(newToken)
    setAccessToken(newToken)
    window.sessionStorage.setItem(STORAGE_KEY, newToken)
  }

  const handleAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setAuthError('')
    setAuthBusy(true)

    try {
      if (authMode === 'signin') {
        const result = await api.login({
          email: authForm.email || undefined,
          username: authForm.email || undefined,
          password: authForm.password,
        })
        persistToken(result.access)
        setUser({
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          role: result.user.role,
          first_name: result.user.first_name,
          last_name: result.user.last_name,
        })
      } else {
        if (registerForm.password.length < 8) {
          throw new Error('Password must be at least 8 characters long.')
        }
        const result = await api.register({
          first_name: registerForm.first_name,
          last_name: registerForm.last_name,
          email: registerForm.email,
          password: registerForm.password,
          username: registerForm.username || registerForm.email,
        })
        persistToken(result.access)
        setUser({
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          role: result.user.role,
          first_name: result.user.first_name,
          last_name: result.user.last_name,
        })
      }
      setAuthForm({ email: '', password: '' })
      setRegisterForm({ first_name: '', last_name: '', email: '', password: '', username: '' })
      setAuthOpen(false)
    } catch (requestError) {
      setAuthError(requestError instanceof Error ? requestError.message : 'Authentication failed.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleAssistantQuestion = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!assistantInput.trim() || !isAuthenticated) return

    setAssistantBusy(true)
    setAssistantReply('')
    try {
      const response = await api.askAssistant(assistantInput.trim())
      setAssistantReply(response.answer)
      setAssistantInput('')
    } catch (requestError) {
      setAssistantReply(requestError instanceof Error ? requestError.message : 'The assistant could not answer that request right now.')
    } finally {
      setAssistantBusy(false)
    }
  }

  const selectedHillside = hillsides.find((hillside) => hillside.id === selectedHillsideId) ?? null

  return (
    <div className="umusaruro-app">
      <header className="topbar">
        <div className="brand-group">
          <div className="brand-icon"><Sprout size={18} /></div>
          <div>
            <div className="brand-name">UMUSARURO-SMART</div>
            <div className="brand-tag">Precision agriculture • Rwanda</div>
          </div>
        </div>

        <div className="topbar-actions">
          <button type="button" className="secondary-button" onClick={() => setAuthOpen(true)}>
            {isAuthenticated ? 'Account' : 'Sign in'}
          </button>
          {user ? (
            <div className="user-pill">
              <User size={15} />
              {user.first_name || user.username}
            </div>
          ) : (
            <div className="user-pill offline">
              <ShieldCheck size={15} />
              Secure sign-in required
            </div>
          )}
        </div>
      </header>

      <main className="dashboard-shell">
        <section className="hero-panel panel">
          <div>
            <p className="eyebrow">Backend-first operations</p>
            <h1>Terrace intelligence for Rwanda’s hillside farms</h1>
            <p className="hero-copy">
              Monitor erosion risk, public weather conditions, and agronomic guidance through secure Django API endpoints.
            </p>
            <div className="hero-actions">
              <button type="button" className="primary-button" onClick={() => setAuthOpen(true)}>
                {isAuthenticated ? 'Open account' : 'Secure sign in'}
              </button>
              <button type="button" className="secondary-button" onClick={() => setAssistantInput('Describe the current hillside risk and recommended actions.') }>
                Ask the assistant
              </button>
            </div>
          </div>

          <div className="hero-side">
            <div className="status-card">
              <span className="tiny-label">Current user</span>
              <strong>{user ? `${user.first_name || user.username} • ${badgeLabel(user.role)}` : 'Guest access'}</strong>
              <small>{user ? user.email : 'Create an account or sign in to use the protected features.'}</small>
            </div>
          </div>
        </section>

        <section className="summary-grid">
          {summaryCards.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="stats-panel panel">
              <div className={`metric-icon ${tone}`}><Icon size={18} /></div>
              <div>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            </div>
          ))}
        </section>

        {error ? <div className="alert-banner error">{error}</div> : null}

        <section className="content-grid">
          <aside className="panel sidebar-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Field portfolio</p>
                <h2>Hillsides</h2>
              </div>
            </div>

            <div className="hillside-list">
              {loading ? (
                <div className="loading-box"><Loader2 className="spin" size={18} /> Loading hillsides…</div>
              ) : hillsides.length === 0 ? (
                <div className="empty-state">No hillsides are available yet.</div>
              ) : (
                hillsides.map((hillside) => (
                  <button
                    key={hillside.id}
                    type="button"
                    className={`hillside-item ${selectedHillsideId === hillside.id ? 'selected' : ''}`}
                    onClick={() => setSelectedHillsideId(hillside.id)}
                  >
                    <div>
                      <strong>{hillside.name}</strong>
                      <small>{hillside.district} • {hillside.sector}</small>
                    </div>
                    <ArrowRight size={16} />
                  </button>
                ))
              )}
            </div>
          </aside>

          <div className="panel detail-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Weather and risk</p>
                <h2>{selectedHillside ? selectedHillside.name : 'Select a hillside'}</h2>
              </div>
              {selectedHillside ? (
                <span className="pill">{selectedHillside.district}</span>
              ) : null}
            </div>

            {forecast ? (
              <>
                <div className="weather-summary">
                  <div className="weather-chip">
                    <CloudRain size={18} />
                    <span>{forecast.current.weather || 'Weather data available'}</span>
                  </div>
                  <div className="weather-chip accent">
                    <Droplets size={18} />
                    <span>{forecast.current.relative_humidity_pct ?? '--'}% humidity</span>
                  </div>
                </div>

                <div className="weather-grid">
                  <div className="weather-stat">
                    <Wind size={16} />
                    <div>
                      <small>Temperature</small>
                      <strong>{forecast.current.temperature_c !== null ? `${forecast.current.temperature_c}°C` : 'Not available'}</strong>
                    </div>
                  </div>
                  <div className="weather-stat">
                    <CloudRain size={16} />
                    <div>
                      <small>Rain chance</small>
                      <strong>{forecast.daily[0]?.precipitation_probability_pct ?? '--'}%</strong>
                    </div>
                  </div>
                  <div className="weather-stat">
                    <Activity size={16} />
                    <div>
                      <small>Wind</small>
                      <strong>{forecast.current.wind_speed_kmh !== null ? `${forecast.current.wind_speed_kmh} km/h` : 'Not available'}</strong>
                    </div>
                  </div>
                </div>

                <div className="advisory-box">
                  <h3>Field guidance</h3>
                  <p>{forecast.weather_advice || forecast.advice_note || 'The platform has no advisory note yet for this hillside.'}</p>
                </div>

                <div className="forecast-row">
                  {forecast.daily.slice(0, 3).map((day) => (
                    <div key={day.date} className="day-card">
                      <span>{day.date}</span>
                      <strong>{day.weather || 'Forecast'}</strong>
                      <small>{day.temperature_max_c ?? '--'}° / {day.temperature_min_c ?? '--'}°</small>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">Select a hillside to view the live weather forecast.</div>
            )}
          </div>
        </section>

        <section className="bottom-grid">
          <div className="panel alert-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Operational review</p>
                <h2>Recent alerts</h2>
              </div>
            </div>

            <div className="alert-list">
              {topAlerts.length === 0 ? (
                <div className="empty-state">No alerts yet for the current hillside portfolio.</div>
              ) : (
                topAlerts.map((alert) => (
                  <article key={alert.id} className="alert-item">
                    <div className="alert-head">
                      <span className={`status-pill ${alert.status}`}>{alert.status}</span>
                      <span className="small-muted">{alert.hillside_name}</span>
                    </div>
                    <h3>{alert.notification_title || alert.message}</h3>
                    <p>{alert.message}</p>
                    <small>{alert.recommended_action || 'Review the terrace details and field notes.'}</small>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="panel assistant-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">AI advisor</p>
                <h2>Ask about field conditions</h2>
              </div>
            </div>

            <form className="assistant-form" onSubmit={handleAssistantQuestion}>
              <textarea
                value={assistantInput}
                onChange={(event) => setAssistantInput(event.target.value)}
                placeholder={isAuthenticated ? 'Ask about soil risk, weather, terraces, or disease patterns…' : 'Sign in to use the backend AI advisor'}
                disabled={!isAuthenticated}
                rows={4}
              />
              <button type="submit" className="primary-button" disabled={!isAuthenticated || assistantBusy || !assistantInput.trim()}>
                {assistantBusy ? 'Thinking…' : 'Send to assistant'}
              </button>
            </form>

            <div className="assistant-output">
              {assistantReply ? (
                <p>{assistantReply}</p>
              ) : (
                <p className="muted-copy">The assistant uses the secure Django proxy and approved agricultural guidance stored in the backend.</p>
              )}
            </div>
          </div>
        </section>
      </main>

      {authOpen ? (
        <div className="modal-backdrop" onClick={() => setAuthOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Authentication</p>
                <h2>{authMode === 'signin' ? 'Secure sign in' : 'Create account'}</h2>
              </div>
              <button type="button" className="close-button" onClick={() => setAuthOpen(false)}>×</button>
            </div>

            <div className="mode-switch">
              <button type="button" className={authMode === 'signin' ? 'selected' : ''} onClick={() => setAuthMode('signin')}>Sign in</button>
              <button type="button" className={authMode === 'register' ? 'selected' : ''} onClick={() => setAuthMode('register')}>Register</button>
            </div>

            <form onSubmit={handleAuthSubmit} className="auth-form">
              {authMode === 'signin' ? (
                <>
                  <label>
                    <span>Email or username</span>
                    <input
                      type="text"
                      value={authForm.email}
                      onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="you@example.com"
                    />
                  </label>
                  <label>
                    <span>Password</span>
                    <input
                      type="password"
                      value={authForm.password}
                      onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                      placeholder="Enter your password"
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="inline-fields">
                    <label>
                      <span>First name</span>
                      <input
                        type="text"
                        value={registerForm.first_name}
                        onChange={(event) => setRegisterForm((current) => ({ ...current, first_name: event.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Last name</span>
                      <input
                        type="text"
                        value={registerForm.last_name}
                        onChange={(event) => setRegisterForm((current) => ({ ...current, last_name: event.target.value }))}
                      />
                    </label>
                  </div>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={registerForm.email}
                      onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Username</span>
                    <input
                      type="text"
                      value={registerForm.username}
                      onChange={(event) => setRegisterForm((current) => ({ ...current, username: event.target.value }))}
                      placeholder="Optional, defaults to email prefix"
                    />
                  </label>
                  <label>
                    <span>Password</span>
                    <input
                      type="password"
                      value={registerForm.password}
                      onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                    />
                  </label>
                </>
              )}

              {authError ? <div className="auth-error">{authError}</div> : null}

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setAuthOpen(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={authBusy}>
                  {authBusy ? 'Processing…' : authMode === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              </div>

              {isAuthenticated ? (
                <div className="modal-actions logout-row">
                  <button type="button" className="secondary-button" onClick={handleLogout}>
                    <LogOut size={15} /> Log out
                  </button>
                </div>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
