import { useEffect, useMemo, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import { api, setAccessToken } from './api/client'
import type { AlertRecord, Hillside, NotificationRecord, Terrace } from './api/types'
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  Camera,
  CloudRain,
  FileImage,
  Flame,
  Gauge,
  Globe,
  Leaf,
  MapPinned,
  MessagesSquare,
  Mic,
  Microscope,
  ShieldCheck,
  Sprout,
  UserCircle2,
  Users,
  Waves,
  Zap,
} from 'lucide-react'
import './App.css'

Chart.register(...registerables)

type Role = 'guest' | 'farmer' | 'agronomist' | 'rab'
type Severity = 'danger' | 'warning' | 'info'

type ChatMessage = {
  id: number
  role: 'user' | 'assistant'
  text: string
}

type DiagnosisResult = {
  summary: string
  recommendation: string
  confidence: string
  risk: string
}

const STORAGE_KEY = 'umusaruro:access-token'

const roleLabels: Record<Role, string> = {
  guest: 'Guest / Public Visitor',
  farmer: 'Farmer (Umuhinzi)',
  agronomist: 'Agronomist',
  rab: 'RAB Technician',
}

const visibleRoles: Role[] = ['farmer', 'agronomist', 'rab']

const roleHighlights: Record<Role, { title: string; subtitle: string; accent: string }> = {
  guest: { title: 'Regional overview', subtitle: 'Explore public advisories and risk alerts.', accent: '#14b8a6' },
  farmer: { title: 'Field command center', subtitle: 'Weather, terrace risk and crop diagnosis in one place.', accent: '#16a34a' },
  agronomist: { title: 'Sector review', subtitle: 'Verify disease reports and coordinate response actions.', accent: '#f59e0b' },
  rab: { title: 'National monitoring', subtitle: 'Track outbreaks and district-scale erosion patterns.', accent: '#2563eb' },
}

const quickActions = [
  'Check Terrace Slope Risk',
  'Identify Maize Disease',
  'Best Fertilizer Schedule',
  'Summarize District Risk',
]

function normalizeRole(role?: string): Role {
  switch (role) {
    case 'rab':
      return 'rab'
    case 'agronomist':
    case 'trainer':
      return 'agronomist'
    case 'guest':
    default:
      return 'farmer'
  }
}

function getStoredAccessToken() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(STORAGE_KEY) || ''
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Unable to read the selected image.'))
    reader.readAsDataURL(file)
  })
}

function App() {
  const [selectedRole, setSelectedRole] = useState<Role>('farmer')
  const [assistantOpen, setAssistantOpen] = useState(true)
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantMessages, setAssistantMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: 'assistant',
      text: 'Welcome to UMUSARURO-SMART. Ask about terrace risk, crop health, or the next best field action.',
    },
  ])
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [showApiModal, setShowApiModal] = useState(false)
  const [authMode, setAuthMode] = useState<'jwt' | 'google'>('jwt')
  const [authTokenInput, setAuthTokenInput] = useState(getStoredAccessToken())
  const [googleCredentialInput, setGoogleCredentialInput] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getStoredAccessToken()))
  const [authEmail, setAuthEmail] = useState('')
  const [signInError, setSignInError] = useState('')
  const [leafFile, setLeafFile] = useState<File | null>(null)
  const [leafPreview, setLeafPreview] = useState<string | null>(null)
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null)
  const [diagnosisError, setDiagnosisError] = useState('')
  const [diagnosisBusy, setDiagnosisBusy] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'ready' | 'fallback' | 'error'>('fallback')
  const [liveCounts, setLiveCounts] = useState({ hillsides: 0, alerts: 0, notifications: 0 })
  const [liveAlerts, setLiveAlerts] = useState<AlertRecord[]>([])
  const [liveNotifications, setLiveNotifications] = useState<NotificationRecord[]>([])
  const [terraces, setTerraces] = useState<Terrace[]>([])
  const [selectedTerraceId, setSelectedTerraceId] = useState<number | null>(null)
  const riskChartRef = useRef<HTMLCanvasElement | null>(null)

  const currentRoleConfig = roleHighlights[selectedRole]

  const metricCards = useMemo(() => ({
    guest: [
      { label: 'Public risk alerts', value: String(liveCounts.alerts || 0), note: 'Live backend alerts', tone: 'green', icon: Bell },
      { label: 'Notifications', value: String(liveCounts.notifications || 0), note: 'Latest advisories', tone: 'amber', icon: Activity },
      { label: 'Hillsides tracked', value: String(liveCounts.hillsides || 0), note: 'Data points on record', tone: 'sky', icon: CloudRain },
      { label: 'AI guidance', value: backendStatus === 'ready' ? 'Live' : 'Pending', note: 'Backend-connected assistant', tone: 'forest', icon: Bot },
    ],
    farmer: [
      { label: 'Terraces', value: String(terraces.length || 0), note: 'Available field segments', tone: 'green', icon: Gauge },
      { label: 'Slope alerts', value: String(liveCounts.alerts || 0), note: 'Active risk notices', tone: 'amber', icon: Flame },
      { label: 'Erosion risk', value: liveCounts.alerts ? 'Track' : 'Low', note: liveCounts.alerts ? `${liveCounts.alerts} plot(s) flagged` : 'No open alerts', tone: 'sky', icon: Waves },
      { label: 'AI engine', value: backendStatus === 'ready' ? 'Online' : 'Offline', note: 'Leaf scanner status', tone: 'forest', icon: Microscope },
    ],
    agronomist: [
      { label: 'Sectors monitored', value: String(liveCounts.hillsides || 0), note: 'Backend hillside records', tone: 'green', icon: MapPinned },
      { label: 'Reports under review', value: String(liveAlerts.filter((alert) => alert.status === 'pending').length), note: 'Pending review queue', tone: 'amber', icon: ShieldCheck },
      { label: 'Alerts dispatched', value: String(liveAlerts.filter((alert) => alert.status === 'confirmed').length), note: 'Confirmed field events', tone: 'sky', icon: Zap },
      { label: 'AI confidence', value: backendStatus === 'ready' ? 'Synced' : 'Waiting', note: 'Backend data status', tone: 'forest', icon: Bot },
    ],
    rab: [
      { label: 'Districts active', value: String(new Set(liveAlerts.map((alert) => alert.hillside_id)).size || 0), note: 'Active hillside records', tone: 'green', icon: Globe },
      { label: 'Disease index', value: String(liveAlerts.filter((alert) => alert.alert_type === 'leaf_disease').length), note: 'Leaf disease alerts', tone: 'amber', icon: Activity },
      { label: 'Erosion hot spots', value: String(liveAlerts.filter((alert) => alert.alert_type === 'runoff_erosion').length), note: 'Runoff risk notices', tone: 'sky', icon: AlertTriangle },
      { label: 'System health', value: backendStatus === 'ready' ? '99.2%' : 'Pending', note: 'Live backend status', tone: 'forest', icon: Users },
    ],
  }), [backendStatus, liveAlerts, liveCounts, terraces.length])

  const featuredAlerts = useMemo(
    () => (liveAlerts.length ? liveAlerts.slice(0, 3).map((alert) => ({
      title: alert.notification_title || alert.message,
      district: alert.hillside_name || 'Hillside',
      severity: alert.status === 'confirmed' ? 'danger' : alert.status === 'pending' ? 'warning' : 'info',
      value: alert.confidence ? `${alert.confidence}` : 'Live',
    })) : [
      { title: 'No backend alerts yet', district: 'System', severity: 'info' as Severity, value: 'Waiting' },
      { title: 'Awaiting recorded hillside activity', district: 'Data sync', severity: 'warning' as Severity, value: 'Pending' },
      { title: 'Live monitoring will appear here', district: 'Backend', severity: 'info' as Severity, value: 'Stand by' },
    ]),
    [liveAlerts],
  )

  const newsFeed = useMemo(
    () => (liveNotifications.length ? liveNotifications.slice(0, 3).map((notification) => ({
      title: notification.notification_title || notification.message,
      time: new Date(notification.created_at).toLocaleDateString(),
      severity: notification.status === 'confirmed' ? 'danger' as Severity : notification.status === 'pending' ? 'warning' as Severity : 'info' as Severity,
      tag: notification.status === 'confirmed' ? 'Confirmed' : notification.status === 'pending' ? 'Review' : 'Update',
    })) : [
      { title: 'No recent backend notifications', time: 'Awaiting sync', severity: 'info' as Severity, tag: 'System' },
      { title: 'Backend advisories will populate automatically', time: 'After data arrives', severity: 'warning' as Severity, tag: 'Queue' },
      { title: 'Live feeds sync when the backend is active', time: 'Connected state', severity: 'info' as Severity, tag: 'Status' },
    ]),
    [liveNotifications],
  )

  useEffect(() => {
    if (!isAuthenticated) return
    setAccessToken(getStoredAccessToken())

    void api.me()
      .then((profile) => {
        const normalizedRole = normalizeRole(profile.role)
        setSelectedRole(normalizedRole)
        setAuthEmail(profile.email)
      })
      .catch(() => {
        handleLogout()
      })
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return

    void api.terraces()
      .then((items) => {
        setTerraces(items)
        setSelectedTerraceId((previous) => previous ?? items[0]?.id ?? null)
      })
      .catch(() => {
        setTerraces([])
        setSelectedTerraceId(null)
      })
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return

    let ignore = false

    async function loadLiveData() {
      try {
        const [hillsides, alerts, notifications] = await Promise.all([
          api.hillsides().catch(() => [] as Hillside[]),
          api.alerts().catch(() => [] as AlertRecord[]),
          api.notifications().catch(() => [] as NotificationRecord[]),
        ])

        if (ignore) return

        setLiveCounts({
          hillsides: hillsides.length,
          alerts: alerts.length,
          notifications: notifications.length,
        })
        setLiveAlerts(alerts)
        setLiveNotifications(notifications)
        setBackendStatus('ready')
      } catch {
        if (!ignore) {
          setBackendStatus('error')
          setLiveCounts({ hillsides: 0, alerts: 0, notifications: 0 })
          setLiveAlerts([])
          setLiveNotifications([])
        }
      }
    }

    void loadLiveData()
    return () => { ignore = true }
  }, [isAuthenticated])

  useEffect(() => {
    if (!riskChartRef.current) return

    const chart = new Chart(riskChartRef.current, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Slope runoff index',
            data: [42, 46, 51, 57, 63, 71],
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22, 163, 74, 0.18)',
            tension: 0.35,
            fill: true,
          },
          {
            label: 'Soil retention',
            data: [72, 69, 66, 74, 80, 76],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            tension: 0.35,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10 } },
        },
        scales: {
          x: { grid: { display: false } },
          y: { suggestedMin: 35, suggestedMax: 90, ticks: { callback: (value) => `${value}%` } },
        },
      },
    })

    return () => chart.destroy()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAssistantOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const statusDotClass = useMemo(() => {
    if (isAuthenticated) return 'status-dot ok'
    return 'status-dot warning'
  }, [isAuthenticated])

  async function handleSignIn() {
    const candidate = authMode === 'jwt' ? authTokenInput.trim() : googleCredentialInput.trim()
    if (!candidate) {
      setSignInError('Enter a valid JWT token or Google credential before signing in.')
      return
    }

    setAuthBusy(true)
    setSignInError('')

    try {
      if (authMode === 'google') {
        const response = await api.googleLogin(candidate)
        const accessToken = response.access
        window.localStorage.setItem(STORAGE_KEY, accessToken)
        setAccessToken(accessToken)
        setAuthEmail(response.user.email)
        setSelectedRole(normalizeRole(response.user.role))
        setIsAuthenticated(true)
        setAuthTokenInput(accessToken)
      } else {
        window.localStorage.setItem(STORAGE_KEY, candidate)
        setAccessToken(candidate)
        const profile = await api.me()
        setSelectedRole(normalizeRole(profile.role))
        setAuthEmail(profile.email)
        setIsAuthenticated(true)
      }
      setShowApiModal(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to connect to the secure backend.'
      setSignInError(message)
    } finally {
      setAuthBusy(false)
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(STORAGE_KEY)
    setAccessToken(null)
    setIsAuthenticated(false)
    setAuthEmail('')
    setSelectedRole('farmer')
    setTerraces([])
    setSelectedTerraceId(null)
    setAuthTokenInput('')
    setGoogleCredentialInput('')
  }

  const onAssistantSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault()
    const content = assistantInput.trim()
    if (!content || assistantBusy || !isAuthenticated) return

    const userMessage: ChatMessage = { id: Date.now(), role: 'user', text: content }
    setAssistantMessages((previous) => [...previous, userMessage])
    setAssistantInput('')
    setAssistantBusy(true)

    try {
      const response = await api.askAssistant(content)
      setAssistantMessages((previous) => [...previous, { id: Date.now() + 1, role: 'assistant', text: response.answer }])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The assistant could not respond.'
      setAssistantMessages((previous) => [...previous, { id: Date.now() + 2, role: 'assistant', text: `I could not answer this request. ${message}` }])
    } finally {
      setAssistantBusy(false)
    }
  }

  const handleLeafFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setDiagnosisError('Unsupported image format. Please upload JPG, PNG, or WebP.')
      return
    }

    setDiagnosisError('')
    setLeafFile(file)
    const preview = await fileToDataUrl(file)
    setLeafPreview(preview)
    setDiagnosis(null)
  }

  const runLeafDiagnosis = async () => {
    if (!leafFile) {
      setDiagnosisError('Select a leaf image first.')
      return
    }

    if (!selectedTerraceId) {
      setDiagnosisError('Select the terrace associated with this photo before submitting it.')
      return
    }

    setDiagnosisBusy(true)
    setDiagnosisError('')

    try {
      const result = await api.classifyPhoto(leafFile, selectedTerraceId)
      setDiagnosis({
        summary: result.classification_label,
        recommendation: result.outcome === 'alert_created'
          ? 'Review the generated alert and verify the affected terrace in the field.'
          : result.outcome === 'need_another_photo'
            ? 'Capture a clearer leaf photo in daylight and submit it again.'
            : 'No disease alert was raised. Continue routine monitoring.',
        confidence: result.confidence,
        risk: result.is_disease ? 'Needs review' : 'Low risk',
      })
    } catch (error) {
      setDiagnosisError(error instanceof Error ? error.message : 'The diagnosis could not be completed.')
    } finally {
      setDiagnosisBusy(false)
    }
  }

  const handleVoiceInput = () => {
    type SpeechRecognitionLike = {
      lang: string
      interimResults: boolean
      maxAlternatives: number
      onstart: (() => void) | null
      onend: (() => void) | null
      onerror: (() => void) | null
      onresult: ((event: SpeechRecognitionEvent) => void) | null
      start: () => void
    }

    type SpeechRecognitionCtor = new () => SpeechRecognitionLike

    const SpeechRecognitionCtor = (window as typeof window & {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }).SpeechRecognition || (window as typeof window & {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }).webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      setAssistantMessages((previous) => [...previous, { id: Date.now(), role: 'assistant', text: 'Voice input is not available in this browser. Use the keyboard to continue.' }])
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript || ''
      if (transcript) setAssistantInput(transcript)
    }
    recognition.start()
  }

  return (
    <div className="umusaruro-app">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark"><Sprout size={20} /></div>
          <div>
            <p className="brand-name">UMUSARURO-SMART</p>
            <span className="brand-subtitle">Precision agriculture • Rwanda</span>
          </div>
        </div>

        <div className="header-actions">
          <button className="secondary-button" type="button" onClick={() => setShowApiModal(true)}>
            <Zap size={15} /> {isAuthenticated ? 'Account' : 'Secure sign-in'}
          </button>
          <div className={`status-pill ${isAuthenticated ? 'ready' : 'missing'}`}>
            <span className={statusDotClass} /> {isAuthenticated ? `Signed in${authEmail ? ` • ${authEmail}` : ''}` : 'Sign in required'}
          </div>
        </div>
      </header>

      <main className="dashboard-shell">
        <aside className="role-sidebar">
          <div className="panel-card sidebar-card">
            <p className="eyebrow">Access mode</p>
            <h2>Role-based switcher</h2>
            <div className="role-buttons">
              {visibleRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`role-button ${selectedRole === role ? 'active' : ''}`}
                  onClick={() => setSelectedRole(role)}
                >
                  <span className="role-icon">
                    {role === 'farmer' && <Leaf size={16} />}
                    {role === 'agronomist' && <ShieldCheck size={16} />}
                    {role === 'rab' && <Activity size={16} />}
                  </span>
                  <span>{roleLabels[role]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel-card sidebar-card compact">
            <p className="eyebrow">System status</p>
            <ul className="mini-list">
              <li><span>Backend sync</span><strong>{backendStatus === 'ready' ? `Live (${liveCounts.hillsides} hillsides)` : backendStatus === 'error' ? 'Unavailable' : 'Checking…'}</strong></li>
              <li><span>Open alerts</span><strong>{liveCounts.alerts || 0} flagged</strong></li>
              <li><span>Notifications</span><strong>{liveCounts.notifications || 0} updates</strong></li>
            </ul>
          </div>
        </aside>

        <section className="main-panel">
          <div className="hero-card panel-card">
            <div className="hero-copy">
              <p className="eyebrow">{currentRoleConfig.title}</p>
              <h1>{roleHighlights[selectedRole].subtitle}</h1>
              <p className="hero-description">
                {selectedRole === 'guest' && 'Browse public crop intelligence, view hillside risk alerts, and access limited advisory support before you sign in.'}
                {selectedRole === 'farmer' && 'Track your terraced plots, review field weather, and scan leaf stress from the field using a mobile-first workflow.'}
                {selectedRole === 'agronomist' && 'Review validated disease signals, dispatch cooperative actions, and apply agronomic recommendations at the sector level.'}
                {selectedRole === 'rab' && 'Assess district-level disease spread, monitor terrace stability, and validate high-priority intervention areas.'}
              </p>
              <div className="hero-actions">
                <button className="primary-button" type="button">View recommendations</button>
                <button className="secondary-button" type="button" onClick={() => setAssistantOpen(true)}>
                  <Bot size={15} /> Live assistant
                </button>
              </div>
            </div>

            <div className="hero-metrics">
              {metricCards[selectedRole].map(({ label, value, note, tone, icon: Icon }) => (
                <div key={label} className={`metric`}
                  style={{ ['--metric-accent' as string]: tone === 'green' ? '#166534' : tone === 'amber' ? '#b45309' : tone === 'sky' ? '#1d4ed8' : '#14532d' }}
                >
                  <div className={`metric-icon ${tone}`}><Icon size={18} /></div>
                  <div>
                    <strong>{value}</strong>
                    <span>{label}</span>
                    <small>{note}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="stats-grid">
            {featuredAlerts.map((alert) => (
              <div key={`${alert.title}-${alert.district}`} className="panel-card alert-chip-card">
                <div className="alert-topline">
                  <span className={`severity severity-${alert.severity}`}>{alert.severity}</span>
                  <span>{alert.district}</span>
                </div>
                <h3>{alert.title}</h3>
                <strong>{alert.value}</strong>
              </div>
            ))}
          </div>

          <div className="content-grid">
            <div className="panel-card chart-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Terrace monitoring</p>
                  <h2>Hillside runoff & retention</h2>
                </div>
                <span className="pill success">Healthy trend</span>
              </div>
              <div className="chart-wrap">
                <canvas ref={riskChartRef} />
              </div>
            </div>

            <div className="panel-card feed-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Regional updates</p>
                  <h2>News & advisory feed</h2>
                </div>
                <span className="pill neutral">Live</span>
              </div>

              <div className="news-list">
                {newsFeed.map((item) => (
                  <article key={`${item.title}-${item.time}`} className="news-item">
                    <span className={`severity severity-${item.severity}`}>{item.tag}</span>
                    <div>
                      <h3>{item.title}</h3>
                      <time>{item.time}</time>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="bottom-grid">
            <div className="panel-card diagnostic-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Engine 2</p>
                  <h2>Leaf diagnostics</h2>
                </div>
                <span className="pill amber">Vision model</span>
              </div>

              {selectedRole === 'guest' ? (
                <div className="guest-gate">
                  <UserCircle2 size={32} />
                  <h3>Sign in to access leaf image diagnostics</h3>
                  <p>Guest access is limited to public advisory content. Farmers and agronomists can upload leaves and receive crop recommendations.</p>
                  <button className="primary-button" type="button" onClick={() => setShowApiModal(true)}>Secure sign-in</button>
                </div>
              ) : (
                <>
                  <div className="upload-box">
                    <label htmlFor="terrace-select" className="field-label" style={{ marginBottom: '0.75rem' }}>
                      <span>Terrace</span>
                      <select
                        id="terrace-select"
                        value={selectedTerraceId ?? ''}
                        onChange={(event) => setSelectedTerraceId(Number(event.target.value) || null)}
                        style={{ width: '100%' }}
                      >
                        <option value="">Select a terrace</option>
                        {terraces.map((terrace) => (
                          <option key={terrace.id} value={terrace.id}>{terrace.name}</option>
                        ))}
                      </select>
                    </label>

                    <input id="leaf-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLeafFile} />
                    <label htmlFor="leaf-upload" className="upload-label">
                      <Camera size={18} />
                      <span>{leafFile ? leafFile.name : 'Upload or capture leaf image'}</span>
                    </label>
                    {leafPreview && <img src={leafPreview} alt="Selected leaf preview" className="leaf-preview" />}
                  </div>

                  <div className="diagnostic-actions">
                    <button type="button" className="primary-button" onClick={runLeafDiagnosis} disabled={diagnosisBusy || !selectedTerraceId}>
                      <Microscope size={16} /> {diagnosisBusy ? 'Analyzing leaf...' : 'Run diagnosis'}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => {
                      setLeafFile(null)
                      setLeafPreview(null)
                      setDiagnosis(null)
                      setDiagnosisError('')
                    }}>
                      <FileImage size={15} /> Clear
                    </button>
                  </div>

                  {diagnosisError && <div className="inline-error">{diagnosisError}</div>}

                  {diagnosis && (
                    <div className="diagnosis-result">
                      <div className="result-header">
                        <span className="pill success">Confidence: {diagnosis.confidence}</span>
                        <span className="pill neutral">{diagnosis.risk}</span>
                      </div>
                      <h3>AI assessment</h3>
                      <p>{diagnosis.summary}</p>
                      <div className="recommendation-box">
                        <strong>Recommended action</strong>
                        <p>{diagnosis.recommendation}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="panel-card quick-actions-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Knowledge tools</p>
                  <h2>AI assistant actions</h2>
                </div>
              </div>
              <div className="quick-actions">
                {quickActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className="quick-action"
                    onClick={() => {
                      setAssistantOpen(true)
                      setAssistantInput(action)
                    }}
                  >
                    <MessagesSquare size={16} />
                    {action}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <div className={`assistant-widget ${assistantOpen ? 'open' : ''}`}>
        <button type="button" className="assistant-launcher" onClick={() => setAssistantOpen((value) => !value)}>
          <Bot size={22} />
        </button>

        {assistantOpen && (
          <div className="assistant-panel">
            <div className="assistant-header">
              <div>
                <p className="eyebrow">AI advisor</p>
                <h3>UMUSARURO assistant</h3>
              </div>
              <button type="button" className="close-button" onClick={() => setAssistantOpen(false)}>×</button>
            </div>

            <div className="assistant-stream">
              {assistantMessages.map((message) => (
                <div key={message.id} className={`message ${message.role}`}>
                  <span>{message.role === 'assistant' ? 'AI' : 'You'}</span>
                  <p>{message.text}</p>
                </div>
              ))}
              {assistantBusy && <div className="message assistant"><span>AI</span><p>Consulting the latest agronomic guidance…</p></div>}
            </div>

            <form className="assistant-form" onSubmit={(event) => { void onAssistantSubmit(event) }}>
              <button type="button" className={`voice-button ${isListening ? 'active' : ''}`} onClick={handleVoiceInput} aria-label="Use voice input">
                <Mic size={16} />
              </button>
              <input
                type="text"
                value={assistantInput}
                onChange={(event) => setAssistantInput(event.target.value)}
                placeholder={selectedRole === 'guest' ? 'Sign in to ask the assistant…' : 'Ask about field health, weather, or terraces…'}
                disabled={selectedRole === 'guest'}
              />
              <button type="submit" disabled={assistantBusy || !assistantInput.trim() || selectedRole === 'guest'}>
                Send
              </button>
            </form>
          </div>
        )}
      </div>

      {showApiModal && (
        <div className="api-modal-backdrop" onClick={() => setShowApiModal(false)}>
          <div className="api-modal" onClick={(event) => event.stopPropagation()}>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void handleSignIn()
              }}
            >
              <div className="section-header">
                <div>
                  <p className="eyebrow">Authentication</p>
                  <h2>Secure backend sign-in</h2>
                </div>
                <button type="button" className="close-button" onClick={() => setShowApiModal(false)}>×</button>
              </div>
              <p className="modal-copy">Use a valid Google identity token or a JWT access token from the backend to sign in securely. The Groq API is never called from the browser.</p>

              <div className="auth-toggle" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button type="button" className={authMode === 'jwt' ? 'primary-button' : 'secondary-button'} onClick={() => setAuthMode('jwt')}>
                  JWT token
                </button>
                <button type="button" className={authMode === 'google' ? 'primary-button' : 'secondary-button'} onClick={() => setAuthMode('google')}>
                  Google token
                </button>
              </div>

              {signInError && <div className="inline-error" style={{ marginBottom: '1rem' }}>{signInError}</div>}

              {authMode === 'jwt' ? (
                <label className="field-label">
                  <span>Access token</span>
                  <input
                    type="password"
                    value={authTokenInput}
                    onChange={(event) => setAuthTokenInput(event.target.value)}
                    placeholder="Paste your JWT access token"
                    autoComplete="off"
                    required
                  />
                </label>
              ) : (
                <label className="field-label">
                  <span>Google credential</span>
                  <input
                    type="password"
                    value={googleCredentialInput}
                    onChange={(event) => setGoogleCredentialInput(event.target.value)}
                    placeholder="Paste the Google ID token"
                    autoComplete="off"
                    required
                  />
                </label>
              )}

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowApiModal(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={authBusy}> {authBusy ? 'Connecting…' : 'Sign in'} </button>
              </div>

              {isAuthenticated && (
                <div className="modal-actions" style={{ marginTop: '1rem' }}>
                  <button type="button" className="secondary-button" onClick={handleLogout}>Log out</button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
