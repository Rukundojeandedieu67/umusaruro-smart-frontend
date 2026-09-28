import { type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Camera,
  Cpu,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  ImagePlus,
  Layers,
  LogOut,
  MessageCircle,
  Mountain,
  RefreshCw,
  Scissors,
  Send,
  Shovel,
  Sprout,
  SprayCan,
  Sparkles,
  Thermometer,
  Volume2,
  Wind,
} from 'lucide-react'
import { api, getApiBaseUrl, setAccessToken } from './api/client'
import type { AIEngineStatus, AlertRecord, Hillside, Terrace, WeatherForecast } from './api/types'
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

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  source?: 'knowledge_base' | 'groq'
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g)

  return tokens.filter(Boolean).map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={index}>{token.slice(2, -2)}</strong>
    }
    if (token.startsWith('__') && token.endsWith('__')) {
      return <strong key={index}>{token.slice(2, -2)}</strong>
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return <code key={index}>{token.slice(1, -1)}</code>
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return <em key={index}>{token.slice(1, -1)}</em>
    }
    if (token.startsWith('_') && token.endsWith('_')) {
      return <em key={index}>{token.slice(1, -1)}</em>
    }
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
    if (link) {
      return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>
    }
    return <span key={index}>{token}</span>
  })
}

function AssistantMarkdown({ content }: { content: string }) {
  const blocks: ReactNode[] = []
  const paragraph: string[] = []
  const listItems: string[] = []
  let listKind: 'ul' | 'ol' | null = null
  let codeLines: string[] | null = null

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push(<p key={`p-${blocks.length}`}>{renderInlineMarkdown(paragraph.join(' '))}</p>)
    paragraph.length = 0
  }

  const flushList = () => {
    if (!listKind || !listItems.length) return
    const List = listKind
    blocks.push(
      <List key={`list-${blocks.length}`}>
        {listItems.map((item, index) => <li key={index}>{renderInlineMarkdown(item)}</li>)}
      </List>,
    )
    listItems.length = 0
    listKind = null
  }

  content.split(/\r?\n/).forEach((line) => {
    if (line.trim().startsWith('```')) {
      flushParagraph()
      flushList()
      if (codeLines) {
        blocks.push(<pre key={`code-${blocks.length}`}><code>{codeLines.join('\n')}</code></pre>)
        codeLines = null
      } else {
        codeLines = []
      }
      return
    }
    if (codeLines) {
      codeLines.push(line)
      return
    }
    if (!line.trim()) {
      flushParagraph()
      flushList()
      return
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      flushList()
      const Heading = heading[1].length === 1 ? 'h3' : heading[1].length === 2 ? 'h4' : 'h5'
      blocks.push(<Heading key={`heading-${blocks.length}`}>{renderInlineMarkdown(heading[2])}</Heading>)
      return
    }

    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      flushParagraph()
      flushList()
      blocks.push(<blockquote key={`quote-${blocks.length}`}>{renderInlineMarkdown(quote[1])}</blockquote>)
      return
    }

    const bullet = line.match(/^\s*[-*+]\s+(.+)$/)
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/)
    if (bullet || ordered) {
      flushParagraph()
      const nextKind = bullet ? 'ul' : 'ol'
      if (listKind && listKind !== nextKind) flushList()
      listKind = nextKind
      listItems.push((bullet || ordered)![1])
      return
    }

    flushList()
    paragraph.push(line.trim())
  })

  if (codeLines) blocks.push(<pre key={`code-${blocks.length}`}><code>{codeLines.join('\n')}</code></pre>)
  flushParagraph()
  flushList()

  return <div className="assistant-markdown">{blocks}</div>
}

function getStoredAccessToken() {
  if (typeof window === 'undefined') return ''
  return window.sessionStorage.getItem(STORAGE_KEY) || ''
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [photoTerraceId, setPhotoTerraceId] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [photoResult, setPhotoResult] = useState<Awaited<ReturnType<typeof api.classifyPhoto>> | null>(null)
  const [aiStatus, setAiStatus] = useState<AIEngineStatus | null>(null)
  const [aiStatusLoading, setAiStatusLoading] = useState(false)
  const [aiStatusError, setAiStatusError] = useState(false)

  const isAuthenticated = Boolean(token)
  const selectedHillside = hillsides.find((hillside) => hillside.id === selectedHillsideId) ?? null
  const apiBaseUrl = getApiBaseUrl()
  const swaggerHref = apiBaseUrl.startsWith('http')
    ? apiBaseUrl.replace(/\/api\/v1\/?$/, '/api/docs/')
    : '/api/docs/'

  const handleSpeak = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.lang = 'rw-RW'
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    setAccessToken(token)
    if (!token) {
      setUser(null)
      setAiStatus(null)
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
    if (!token) {
      setAiStatusLoading(false)
      setAiStatusError(false)
      return
    }
    let cancelled = false
    setAiStatusLoading(true)
    setAiStatusError(false)
    void api.aiStatus().then((status) => {
      if (!cancelled) setAiStatus(status)
    }).catch(() => {
      if (!cancelled) {
        setAiStatus(null)
        setAiStatusError(true)
      }
    }).finally(() => {
      if (!cancelled) setAiStatusLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!token) {
      setHillsides([])
      setTerraces([])
      setAlerts([])
      setForecast(null)
      setSelectedHillsideId(null)
      setLoading(false)
      setError('')
      return
    }

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
  }, [token])

  useEffect(() => {
    if (!token || !selectedHillsideId) {
      setTerraces([])
      setForecast(null)
      return
    }

    let cancelled = false

    const fetchHillsideContext = async () => {
      try {
        const [terraceData, weatherData] = await Promise.all([
          api.terraces(selectedHillsideId),
          api.weather(selectedHillsideId),
        ])

        if (!cancelled) {
          setTerraces(terraceData)
          setPhotoTerraceId((current) => terraceData.some((terrace) => terrace.id === Number(current))
            ? current
            : String(terraceData.find((terrace) => terrace.hillside === selectedHillsideId)?.id || ''))
          setForecast(weatherData.data)
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load the selected hillside details.')
        }
      }
    }

    void fetchHillsideContext()
    const refreshWeather = window.setInterval(() => {
      void api.weather(selectedHillsideId).then(({ data }) => {
        if (!cancelled) setForecast(data)
      }).catch((requestError: unknown) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Weather update failed.')
        }
      })
    }, 5 * 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(refreshWeather)
    }
  }, [selectedHillsideId, token])

  useEffect(() => {
    if (!selectedPhoto) {
      setPhotoPreview('')
      return
    }

    const previewUrl = URL.createObjectURL(selectedPhoto)
    setPhotoPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [selectedPhoto])

  const weatherStats = useMemo(() => {
    const rainChance = forecast?.hourly?.[0]?.precipitation_probability_pct
    const temperature = forecast?.current?.temperature_c
    const humidity = forecast?.current?.relative_humidity_pct
    const wind = forecast?.current?.wind_speed_kmh

    return [
      { label: 'Imvura (Rain Risk)', value: rainChance == null ? 'Nta makuru' : `${rainChance}%`, hint: 'Isaha iri imbere', tone: 'sky', icon: CloudDrizzle },
      { label: 'Ubushyuhe (Temp)', value: temperature == null ? 'Nta makuru' : `${temperature}°C`, hint: 'Ubu', tone: 'amber', icon: Thermometer },
      { label: 'Ubuhehere (Humidity)', value: humidity == null ? 'Nta makuru' : `${humidity}%`, hint: forecast?.current?.weather || 'Ubu', tone: 'indigo', icon: CloudFog },
      { label: 'Umuyaga (Wind)', value: wind == null ? 'Nta makuru' : `${wind} km/h`, hint: 'Ubu', tone: 'emerald', icon: Wind },
    ]
  }, [forecast])

  const actionSteps = [
    { number: '1', title: '1. KATA AMABABI', label: 'Katisha umupanga amababi arwaye uyatwike mu nsi y\'umurima.', icon: Scissors, tone: 'amber', speech: 'Intambwe ya 1: Katisha umupanga amababi arwaye uyatwike.' },
    { number: '2', title: '2. CUKURA IMFEREGE', label: 'Fata isuka uyobore amazi kure y\'imizi y\'ibirayi.', icon: Shovel, tone: 'blue', speech: 'Intambwe ya 2: Fata isuka ucukure imferege y amazi.' },
    { number: '3', title: '3. TERA IMITI', label: 'Saba Agronome imiti yakugenewe ufurize ku mababi.', icon: SprayCan, tone: 'emerald', speech: 'Intambwe ya 3: Tera imiti yaragagajwe na Extension worker.' },
  ]

  const currentRegion = selectedHillside?.district ? `${selectedHillside.district}` : 'Synthetic demo data'
  const aiStatusLabel = !isAuthenticated
    ? 'Sign in to check'
    : aiStatusLoading
      ? 'Checking…'
      : aiStatusError
        ? 'API unavailable'
        : aiStatus?.groq_configured
          ? 'Mujyanama AI'
          : 'Reviewed guidance only'
  const photoStatusLabel = !isAuthenticated
    ? 'Sign in to check'
    : aiStatusLoading
      ? 'Checking…'
      : aiStatusError
        ? 'API unavailable'
        : aiStatus?.photo_configured
          ? aiStatus.photo_engine === 'groq_vision' ? 'Groq Vision' : aiStatus.photo_engine.replace('_', ' ')
          : 'Not configured'

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

  const handleDemoLogin = async () => {
    setAuthError('')
    setAuthBusy(true)

    try {
      const result = await api.login({ username: 'demo_farmer', password: 'Password123' })
      persistToken(result.access)
      setUser({
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        role: result.user.role,
        first_name: result.user.first_name,
        last_name: result.user.last_name,
      })
      setAuthOpen(false)
    } catch (requestError) {
      setAuthError(requestError instanceof Error ? requestError.message : 'Demo login failed.')
    } finally {
      setAuthBusy(false)
    }
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

    const question = assistantInput.trim()
    const context = [
      selectedHillside ? `Hillside: ${selectedHillside.name}, ${selectedHillside.district}, ${selectedHillside.sector}.` : '',
      forecast ? `Weather now: ${forecast.current.weather}, ${forecast.current.temperature_c ?? 'unknown'} C, humidity ${forecast.current.relative_humidity_pct ?? 'unknown'}%, wind ${forecast.current.wind_speed_kmh ?? 'unknown'} km/h. Rain probability next hour: ${forecast.hourly?.[0]?.precipitation_probability_pct ?? 'unknown'}%.` : '',
      alerts.length ? `Current alerts: ${alerts.slice(0, 5).map((alert) => `${alert.notification_title}: ${alert.message}`).join(' | ')}` : 'No active alerts loaded.',
    ].filter(Boolean).join('\n').slice(0, 3900)

    setChatMessages((messages) => [...messages, { role: 'user', content: question }])
    setAssistantInput('')
    setAssistantBusy(true)
    try {
      const response = await api.askAssistant(question, context)
      setChatMessages((messages) => [...messages, { role: 'assistant', content: response.answer, source: response.source }])
    } catch (requestError) {
      setChatMessages((messages) => [...messages, {
        role: 'assistant',
        content: requestError instanceof Error ? requestError.message : 'The assistant could not answer that request right now.',
      }])
    } finally {
      setAssistantBusy(false)
    }
  }

  const handlePhotoSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedPhoto || !selectedHillsideId || !isAuthenticated) return

    const terrace = terraces.find((item) => item.hillside === selectedHillsideId)
    if (!terrace) {
      setPhotoError('Add a terrace to this hillside before submitting a leaf photo.')
      return
    }

    setPhotoError('')
    setPhotoResult(null)
    setPhotoBusy(true)
    try {
      setPhotoResult(await api.classifyPhoto(selectedPhoto, terrace.id))
    } catch (requestError) {
      setPhotoError(requestError instanceof Error ? requestError.message : 'Photo analysis failed.')
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <div className="umusaruro-app">
      <header className="umusa-header">
        <div className="umusa-header-inner">
          <div className="brand-group">
            <div className="brand-icon">
              <Sprout size={28} />
            </div>
            <div className="brand-copy">
              <h1>UMUSARURO-SMART</h1>
              <p>{currentRegion} • {user ? `${user.first_name || user.username}` : 'Igihingwa cy\'Ibirayi (Terraced Hillside)'}</p>
            </div>
          </div>

          <button type="button" className="audio-button" onClick={() => handleSpeak('Murakaza neza kuri Umusaruro Smart. Hano hari apareye ebyiri zikurikirana umurima wawe n ibipimo by ikirere mu minota itanu gusa.') }>
            <Volume2 size={18} />
            <span>SOMA ZOSE (Audio)</span>
          </button>
          <a className="docs-link" href={swaggerHref} target="_blank" rel="noreferrer" aria-label="Open API Swagger documentation" title="API documentation">
            <BookOpen size={17} />
            <span>API docs</span>
          </a>
          <button type="button" className="account-button" onClick={() => setAuthOpen(true)}>
            {isAuthenticated ? `${user?.first_name || user?.username || 'Account'} · ${badgeLabel(user?.role || 'farmer')}` : 'Sign in'}
          </button>
        </div>
      </header>

      <main className="umusa-main">
        {error ? <div className="system-error" role="alert">{error}</div> : null}
        <section className="weather-panel">
          <div className="panel-header">
            <div className="panel-heading-wrap">
              <div className="icon-box sky">
                <CloudRain size={24} />
              </div>
              <div>
                <div className="headline-row">
                  <span className="live-badge"><span className="live-dot" /> {forecast ? 'LIVE WEATHER' : 'WEATHER OFFLINE'}</span>
                  <span className="eyebrow-label">Refresh every 5 minutes</span>
                </div>
                <h2>Gukurikirana Imvura n'Ikirere (Weather Tracker)</h2>
                <p className="weather-location">{selectedHillside ? `${selectedHillside.name} · ${selectedHillside.district}` : 'Sign in to load your hillside weather'}</p>
              </div>
            </div>

            <button type="button" className="weather-audio-button" onClick={() => handleSpeak('Ikirere mu minota itanu iri mbele. Ubu hari imvura n igihu cyinshi ku musozi. Imvura irakaza mu minota cumi n itanu.') }>
              <Volume2 size={16} />
              <span>Umva Ikirere (Audio)</span>
            </button>
          </div>

          <div className="weather-grid">
            {weatherStats.map(({ label, value, hint, tone, icon: Icon }) => (
              <div key={label} className={`weather-card ${tone}`}>
                <Icon size={28} />
                <span>{label}</span>
                <p>{value}</p>
                <small>{hint}</small>
              </div>
            ))}
          </div>

          <div className="timeline-wrap">
            <div className="timeline-label-row">
              <span>Forecast by hour · Open-Meteo</span>
              <small>{forecast?.retrieved_at ? `Updated ${new Date(forecast.retrieved_at).toLocaleTimeString()}` : 'Forecast unavailable'}</small>
            </div>

            <div className="weather-scroll">
              {forecast?.hourly?.length ? forecast.hourly.slice(0, 8).map((hour, index) => {
                const Icon = hour.weather_code != null && hour.weather_code >= 45 && hour.weather_code <= 48
                  ? CloudFog
                  : hour.weather_code != null && hour.weather_code >= 95
                    ? CloudLightning
                    : hour.precipitation_probability_pct != null && hour.precipitation_probability_pct >= 50
                      ? CloudRain
                      : CloudDrizzle
                const time = hour.time.includes('T') ? hour.time.split('T')[1].slice(0, 5) : hour.time
                const speech = `${time}: ${hour.weather}. ${hour.temperature_c ?? 'Nta makuru'} degrees. Rain probability ${hour.precipitation_probability_pct ?? 'unknown'} percent.`
                return (
                  <button key={hour.time} type="button" className={`timeline-card ${index === 0 ? 'active' : ''} ${hour.precipitation_probability_pct != null && hour.precipitation_probability_pct >= 80 ? 'danger' : ''}`} onClick={() => handleSpeak(speech)}>
                    <span className={`time-badge ${hour.precipitation_probability_pct != null && hour.precipitation_probability_pct >= 80 ? 'danger' : ''}`}>{index === 0 ? `UBU ${time}` : time}</span>
                    <Icon size={22} />
                    <p>{hour.temperature_c == null ? '—' : `${hour.temperature_c}°C`} · {hour.weather}</p>
                    <small>Imvura: {hour.precipitation_probability_pct ?? '—'}%</small>
                  </button>
                )
              }) : <div className="forecast-empty">Hourly forecast is not available for this hillside.</div>}
            </div>
          </div>
        </section>

        <div className="two-engine-banner">
          <h2>Apareye Ebyiri Z'Ubwenge (Two AI Engines)</h2>
          <p>Umusaruro-Smart ukoresha Apareye 2 zibona ibiba ku mucanga no ku mababi bitaraba bibi cyane:</p>

          <div className="engine-badges">
            <div className="engine-badge blue">
              <div className="engine-badge-icon">
                <Mountain size={28} />
              </div>
              <div>
                <span>Engine 1 (Ibipimo by'Umucanga)</span>
                <h3>Amazi n'Isuri mu Bikingi</h3>
                <p>Ikora ku bipimo by'imvura n'amazi atemba downhill</p>
              </div>
            </div>

            <div className="engine-badge rose">
              <div className="engine-badge-icon">
                <Camera size={28} />
              </div>
              <div>
                <span>Engine 2 (Isusuma ry'Amababi)</span>
                <h3>Indwara n'Ibyonyo ku Mababi</h3>
                <p>Isuzuma amafoto y'amababi ikoresheje Camera</p>
              </div>
            </div>
          </div>

          <div className="ai-engine-status" aria-live="polite">
            <div className="ai-engine-status-item">
              <Sparkles size={17} />
              <span>Mujyanama AI</span>
              <strong>{aiStatusLabel}</strong>
            </div>
            <div className="ai-engine-status-item">
              <Cpu size={17} />
              <span>Leaf analysis</span>
              <strong>{photoStatusLabel}</strong>
            </div>
          </div>
        </div>

        <section className="engine-section">
          <div className="panel-header low">
            <div className="panel-heading-wrap">
              <div className="icon-box blue">
                <Layers size={22} />
              </div>
              <div>
                <span className="engine-tag blue-tag">ENGINE 1</span>
                <h2>Umucanga n'Amazi ku Bikingi (Terrain Risk)</h2>
              </div>
            </div>

            <button type="button" className="engine-audio-button blue" onClick={() => handleSpeak('Engine ya mbere ireba uko amazi n isuri bimanuka ku bikingi. Umucingi wo mu kibaya C1 ufite amazi menshi cyane.') }>
              <Volume2 size={16} />
              <span>Umva Ibi (Audio)</span>
            </button>
          </div>

          <div className="terrace-list">
            {loading ? <div className="forecast-empty"><RefreshCw size={16} className="spin" /> Loading field records…</div> : alerts.length ? alerts.slice(0, 8).map((alert) => {
              const terrace = terraces.find((item) => item.id === alert.terrace)
              const tone = alert.alert_type === 'leaf_disease' ? 'rose' : alert.alert_type === 'waterlogging' || alert.alert_type === 'moisture_accumulation' ? 'blue' : 'amber'
              return (
                <article key={alert.id} className={`terrace-card ${tone}`}>
                  <div className="terrace-mark">{alert.terrace_identifier || '—'}</div>
                  <div className="terrace-copy">
                    <span>{terrace?.name || alert.hillside_name} · {alert.status}</span>
                    <h4>{alert.notification_title}</h4>
                    <p>{alert.message}</p>
                    <small>{alert.recommended_action}</small>
                  </div>
                  <button className="speak-icon-button" type="button" aria-label={`Read ${alert.notification_title}`} onClick={() => handleSpeak(`${alert.notification_title}. ${alert.message}. ${alert.recommended_action}`)}><Volume2 size={17} /></button>
                </article>
              )
            }) : <div className="forecast-empty">{isAuthenticated ? 'No terrain or crop alerts are recorded for this hillside yet.' : 'Sign in to view your hillside risk records.'}</div>}
          </div>
        </section>

        <section className="engine-section">
          <div className="panel-header low">
            <div className="panel-heading-wrap">
              <div className="icon-box rose">
                <Camera size={22} />
              </div>
              <div>
                <span className="engine-tag rose-tag">ENGINE 2</span>
                <h2>Isuzumaw'Ibibabi ku Foto (Leaf AI Diagnostic)</h2>
              </div>
            </div>

            <button type="button" className="engine-audio-button rose" onClick={() => handleSpeak('Engine ya kabiri ifata ifoto y amababi ikamenya indwara. Hano yabonye indwara y ibirayi. Reba amashusho yo gukora below.') }>
              <Volume2 size={16} />
              <span>Umva Ibi (Audio)</span>
            </button>
          </div>

          <form className="photo-analysis" onSubmit={handlePhotoSubmit}>
            <label className="photo-dropzone">
              {photoPreview ? <img src={photoPreview} alt="Selected crop leaf" /> : <ImagePlus size={32} />}
              <span>{selectedPhoto?.name || 'Select a clear leaf photo'}</span>
              <small>JPEG, PNG or WebP · max 5 MB</small>
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={!isAuthenticated} onChange={(event) => {
                setSelectedPhoto(event.target.files?.[0] || null)
                setPhotoResult(null)
                setPhotoError('')
              }} />
            </label>
            <div className="photo-controls">
              <label className="field-label" htmlFor="photo-terrace">Terrace
                <select id="photo-terrace" value={photoTerraceId} onChange={(event) => setPhotoTerraceId(event.target.value)} disabled={!isAuthenticated || terraces.length === 0}>
                  <option value="">Choose a terrace</option>
                  {terraces.filter((terrace) => terrace.hillside === selectedHillsideId).map((terrace) => <option key={terrace.id} value={terrace.id}>{terrace.identifier} · {terrace.name}</option>)}
                </select>
              </label>
              <button type="submit" className="diagnosis-listen" disabled={!isAuthenticated || !selectedPhoto || !photoTerraceId || photoBusy}>
                {photoBusy ? <RefreshCw size={16} className="spin" /> : <Camera size={16} />}
                <span>{photoBusy ? 'Analyzing photo…' : 'Analyze leaf photo'}</span>
              </button>
              {!isAuthenticated ? <small className="form-note">Sign in to submit a photo for protected analysis.</small> : null}
              {photoError ? <p className="inline-error" role="alert">{photoError}</p> : null}
              {photoResult ? (
                <div className={`classification-result ${photoResult.is_disease ? 'risk' : 'clear'}`} role="status">
                  <strong><Sparkles size={15} /> {photoResult.classification_label.replaceAll('_', ' ')}</strong>
                  <span>{Math.round(Number(photoResult.confidence) * 100)}% confidence · {photoResult.outcome.replaceAll('_', ' ')}</span>
                  {photoResult.classifier_mode === 'stub' ? <small>Classifier is in stub mode. Configure the ONNX model and label manifest to enable real inference.</small> : <small>AI screening only; have an extension worker confirm before treatment.</small>}
                  {photoResult.classifier_mode !== 'stub' ? <small>Analysis engine: {photoResult.classifier_mode === 'groq' ? 'Groq Vision' : 'ONNX model'} · Assessment #{photoResult.photo_assessment_id}</small> : null}
                </div>
              ) : null}
            </div>
          </form>

          <div className="action-block">
            <h3>Ibintu 3 Utegetswe Gukora Ubu (Picture Action Steps):</h3>

            <div className="action-grid">
              {actionSteps.map(({ number, title, label, icon: Icon, tone, speech }) => (
                <button key={number} type="button" className={`action-card ${tone}`} onClick={() => handleSpeak(speech)}>
                  <div className="action-number">{number}</div>
                  <Icon size={28} />
                  <h4>{title}</h4>
                  <p>{label}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="engine-section chatbot-section">
          <div className="panel-header low">
            <div className="panel-heading-wrap">
              <div className="icon-box emerald"><MessageCircle size={22} /></div>
              <div>
                <span className="engine-tag emerald-tag">MUJYANAMA AI</span>
                <h2>Mujyanama AI <span className="assistant-subtitle">(Umujyanama w'Ubuhinzi)</span></h2>
              </div>
            </div>
            <span className="chat-source-note">Powered by umujyanama AI· Reviewed guidance first</span>
          </div>

          <div className="chat-messages" aria-live="polite">
            {chatMessages.length ? chatMessages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
                <strong>{message.role === 'user' ? 'You' : `Mujyanama AI${message.source === 'groq' ? ' · Groq API' : message.source === 'knowledge_base' ? ' · Reviewed guidance' : ''}`}</strong>
                {message.role === 'assistant'
                  ? <AssistantMarkdown content={message.content} />
                  : <p>{message.content}</p>}
              </article>
            )) : <p className="chat-empty">Ask about your hillside, weather, terrace alerts, or crop symptoms.</p>}
            {assistantBusy ? <p className="chat-thinking"><RefreshCw size={14} className="spin" /> Checking field context…</p> : null}
          </div>

          {isAuthenticated ? (
            <form className="chat-form" onSubmit={handleAssistantQuestion}>
              <textarea value={assistantInput} onChange={(event) => setAssistantInput(event.target.value)} placeholder="Ask about crop, weather, or terrace risk…" rows={2} maxLength={1000} disabled={assistantBusy} />
              <button type="submit" aria-label="Send message" disabled={assistantBusy || assistantInput.trim().length < 4}><Send size={17} /></button>
            </form>
          ) : <button type="button" className="chat-signin" onClick={() => setAuthOpen(true)}>Sign in to chat with Mujyanama AI</button>}
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

              {authMode === 'signin' ? (
                <div className="demo-login-row">
                  <button type="button" className="secondary-button" onClick={handleDemoLogin} disabled={authBusy}>
                    Use demo farmer account
                  </button>
                  <span>demo_farmer / Password123</span>
                </div>
              ) : null}

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
