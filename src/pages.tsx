import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Check, CheckCircle2,
  CloudRain, CloudSun, Droplets, ExternalLink, Layers3, Leaf, LogIn, LogOut,
  MapPin, Mountain, RefreshCw, Search, ShieldAlert, ShieldCheck, Sprout, UserRound,
  Wind, X,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import 'leaflet/dist/leaflet.css'
import { api, getApiBaseUrl } from './api/client'
import { useAuth } from './auth/useAuth'
import type {
  AlertRecord, AlertStatus, FarmAdvisory, Hillside, NdviReading,
  NotificationRecord, Terrace, WeatherForecast,
} from './api/types'
import {
  EmptyState, ErrorState, LoadingState, PageHeading, RelativeDate, RiskBadge,
  Skeleton, StatusBadge,
} from './components/ui'
import { useResource } from './hooks'

const pctFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 0 })

function numberOrNull(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function showNumber(value: string | number | null | undefined, digits = 1) {
  const number = numberOrNull(value)
  return number === null ? 'Unavailable' : number.toFixed(digits)
}

function useOverviewData() {
  const hillsides = useResource('overview-hillsides', () => api.hillsides())
  const hillsideIds = (hillsides.data || []).map((hillside) => hillside.id).join(',')
  const terraces = useResource(`overview-terraces:${hillsideIds}`, async () =>
    (await Promise.all((hillsides.data || []).map((hillside) => api.terraces(hillside.id)))).flat(),
  )
  const alerts = useResource('overview-alerts', () => api.alerts())
  const readings = useResource('overview-ndvi', () => api.ndvi())
  const notifications = useResource('overview-notifications', () => api.notifications())
  const weatherHillside = (hillsides.data || []).find((item) => item.latitude && item.longitude)
  const weather = useResource(`overview-weather:${weatherHillside?.id || 'none'}`, async () =>
    weatherHillside ? api.weather(weatherHillside.id) : null,
  )
  return { hillsides, terraces, alerts, readings, notifications, weather, weatherHillside }
}

export function OverviewPage() {
  const { hillsides, terraces, alerts, readings, notifications, weather, weatherHillside } = useOverviewData()
  const pendingAlerts = (alerts.data || []).filter((alert) => alert.status === 'pending')
  const latestAlerts = (alerts.data || []).slice(0, 3)
  const latestNotifications = (notifications.data || []).slice(0, 3)
  const chartData = [...(readings.data || [])]
    .sort((a, b) => a.observed_on.localeCompare(b.observed_on))
    .slice(-14)
    .map((reading) => ({ date: reading.observed_on, ndvi: numberOrNull(reading.mean_ndvi) }))
  const loading = hillsides.loading || terraces.loading || alerts.loading
  const hasData = (hillsides.data?.length || 0) > 0

  return <div className="page-stack">
    <PageHeading eyebrow="RWANDA · PILOT HILLSIDE" title="Pilot overview" description="Field signals and review work from the data currently available." action={<Link className="button button-primary" to="/farm"><Mountain size={17} />View hillsides</Link>} />

    {loading && <div className="metric-grid"><Skeleton className="metric-skeleton" /><Skeleton className="metric-skeleton" /><Skeleton className="metric-skeleton" /><Skeleton className="metric-skeleton" /></div>}
    {!loading && !hasData && !hillsides.error && <EmptyState title="No hillsides available" detail="No pilot hillside records have been returned by the backend yet." />}
    {hillsides.error && <ErrorState message={hillsides.error} retry={hillsides.reload} />}

    {hasData && <>
      <section className="metric-grid" aria-label="Pilot summary">
        <MetricCard label="Hillsides" value={hillsides.data?.length ?? 0} icon={<Mountain />} tone="green" note="Available in API" />
          <MetricCard label="Terraces" value={terraces.data?.length ?? '—'} icon={<Layers3 size={18} />} tone="soil" note="Across listed hillsides" />
        <MetricCard label="Pending alerts" value={pendingAlerts.length} icon={<ShieldAlert />} tone="orange" note="Awaiting trainer review" />
        <MetricCard label="Confirmed notices" value={notifications.data?.length ?? '—'} icon={<Bell />} tone="blue" note="Trainer-confirmed only" />
      </section>

      <section className="hero-grid">
        <article className="surface hillside-hero">
          <div className="surface-heading"><div><p className="eyebrow">HILLSIDE SNAPSHOT</p><h2>{hillsides.data?.[0]?.name}</h2><p className="muted">{locationLabel(hillsides.data?.[0])}</p></div><span className="hero-mark"><Sprout size={25} /></span></div>
          <div className="hero-stats"><div><strong>{terraces.data?.length ?? '—'}</strong><span>terraces</span></div><div><strong>{readings.data?.length ?? '—'}</strong><span>NDVI readings</span></div><div><strong>{alerts.data?.length ?? '—'}</strong><span>alert records</span></div></div>
          <div className="hero-note"><ShieldCheck size={17} /><span>Pilot risk indicators need field verification; no data is treated as a diagnosis.</span></div>
          <Link className="text-link" to={`/farm?hillside=${hillsides.data?.[0]?.id}`}>Open hillside details <ArrowRight size={15} /></Link>
        </article>

        <WeatherSummary forecast={weather.data?.data ?? null} loading={weather.loading} error={weather.error} hillside={weatherHillside} />
      </section>

      <section className="content-grid overview-lower">
        <article className="surface chart-surface">
          <div className="surface-heading"><div><p className="eyebrow">SATELLITE SIGNAL</p><h2>Recent NDVI readings</h2></div><Link className="text-link" to="/ndvi">View history <ArrowRight size={15} /></Link></div>
          {chartData.length < 2 ? <EmptyState title="Not enough NDVI history" detail="At least two dated readings are needed to show a trend." /> : <div className="chart-wrap chart-wrap-large">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid vertical={false} stroke="#e4e9e3" strokeDasharray="3 5" />
              <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} tickLine={false} axisLine={false} />
              <YAxis domain={[-1, 1]} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => [showNumber(value as number, 3), 'NDVI']} />
              <Line type="monotone" dataKey="ndvi" stroke="#3f7958" strokeWidth={2.5} dot={{ r: 3, fill: '#3f7958' }} activeDot={{ r: 5 }} connectNulls />
            </LineChart></ResponsiveContainer>
          </div>}
          <p className="chart-footnote">NDVI indicates vegetation condition; it does not by itself establish disease.</p>
        </article>

        <article className="surface attention-surface">
          <div className="surface-heading"><div><p className="eyebrow">REVIEW QUEUE</p><h2>Attention required</h2></div><Link className="text-link" to="/alerts">All alerts <ArrowRight size={15} /></Link></div>
          {alerts.loading && <LoadingState label="Loading alerts" />}
          {alerts.error && <ErrorState message={alerts.error} retry={alerts.reload} />}
          {!alerts.loading && latestAlerts.length === 0 && <EmptyState title="No alerts yet" detail="The API has not returned any alerts for this pilot." />}
          <div className="compact-list">{latestAlerts.map((alert) => <CompactAlert key={alert.id} alert={alert} />)}</div>
        </article>
      </section>

      <section className="content-grid bottom-grid">
        <article className="surface"><div className="surface-heading"><div><p className="eyebrow">TERRACE INVENTORY</p><h2>Hillside coverage</h2></div><Link className="text-link" to="/farm">Explore <ArrowRight size={15} /></Link></div>
          {terraces.loading && <LoadingState label="Loading terraces" />}
          {!terraces.loading && (terraces.data?.length || 0) === 0 && <EmptyState title="No terraces available" detail="Terrace records will appear here when the backend has them." />}
          <TerracePreview terraces={(terraces.data || []).slice(0, 5)} alerts={alerts.data || []} readings={readings.data || []} />
        </article>
        <article className="surface"><div className="surface-heading"><div><p className="eyebrow">FIELD NOTICES</p><h2>Confirmed notifications</h2></div><Link className="text-link" to="/notifications">Feed <ArrowRight size={15} /></Link></div>
          {notifications.loading && <LoadingState label="Loading notices" />}
          {!notifications.loading && latestNotifications.length === 0 && <EmptyState title="No confirmed notifications" detail="Only trainer-confirmed alerts are included in this feed." />}
          <div className="compact-list">{latestNotifications.map((item) => <CompactNotification key={item.id} item={item} />)}</div>
        </article>
      </section>
    </>}
  </div>
}

function MetricCard({ label, value, icon, tone, note }: { label: string; value: string | number; icon: React.ReactNode; tone: string; note: string }) {
  return <article className="metric-card"><span className={`metric-icon tone-${tone}`}>{icon}</span><div className="metric-main"><span className="metric-value">{value}</span><span className="metric-label">{label}</span></div><span className="metric-note">{note}</span></article>
}

function locationLabel(hillside?: Hillside) {
  if (!hillside) return 'Location unavailable'
  const parts = [hillside.sector, hillside.district].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Location not provided'
}

function WeatherSummary({ forecast, loading, error, hillside }: { forecast: WeatherForecast | null; loading: boolean; error: string | null; hillside?: Hillside }) {
  return <article className="surface weather-summary">
    <div className="surface-heading"><div><p className="eyebrow">FIELD CONDITIONS</p><h2>Weather</h2></div><CloudSun className="weather-sun" size={23} /></div>
    {loading && <LoadingState label="Checking forecast" />}
    {!loading && error && <ErrorState message={error} />}
    {!loading && !error && !forecast && <EmptyState title="No weather location configured" detail="A hillside needs latitude and longitude before a forecast is available." action={<Link className="text-link" to="/farm">Check hillside locations <ArrowRight size={15} /></Link>} />}
    {forecast && <>
      <div className="weather-now"><div><strong>{forecast.current.temperature_c === null ? '—' : `${showNumber(forecast.current.temperature_c, 0)}°`}</strong><span>{forecast.current.weather}</span><small>{forecast.hillside_name}</small></div><span className="weather-water"><CloudRain size={19} />{forecast.daily[0]?.precipitation_probability_pct ?? '—'}%</span></div>
      <div className="forecast-row">{forecast.daily.slice(0, 3).map((day) => <div className="forecast-day" key={day.date}><span>{new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`))}</span><strong>{day.temperature_max_c === null ? '—' : `${showNumber(day.temperature_max_c, 0)}°`}</strong><small><Droplets size={12} />{day.precipitation_probability_pct ?? '—'}%</small></div>)}</div>
      <div className="weather-advice"><CloudRain size={16} /><p><strong>Automated weather reminder</strong>{forecast.weather_advice}</p></div>
      {forecast.is_stale && <p className="stale-note">Showing cached weather data.</p>}
      <Link className="text-link" to={`/weather?hillside=${forecast.hillside_id}`}>Full forecast <ArrowRight size={15} /></Link>
    </>}
    {!forecast && hillside?.latitude && <span className="sr-only">Forecast not loaded.</span>}
  </article>
}

function CompactAlert({ alert }: { alert: AlertRecord }) {
  return <Link className="compact-item" to={`/alerts?selected=${alert.id}`}>
    <span className={`list-marker marker-${alert.status}`}><ShieldAlert size={16} /></span>
    <span className="compact-copy"><strong>{alert.notification_title}</strong><small>{alert.hillside_name} · {alert.terrace_identifier}</small><small>{alert.message}</small></span>
    <StatusBadge status={alert.status} />
  </Link>
}

function CompactNotification({ item }: { item: NotificationRecord }) {
  return <Link className="compact-item" to={`/alerts?selected=${item.id}`}>
    <span className="list-marker marker-confirmed"><Bell size={16} /></span>
    <span className="compact-copy"><strong>{item.notification_title}</strong><small>{item.terrace_identifier} · {item.hillside_name}</small><small>{item.recommended_action}</small></span>
    <RelativeDate value={item.observation_date || item.created_at} />
  </Link>
}

function TerracePreview({ terraces, alerts, readings }: { terraces: Terrace[]; alerts: AlertRecord[]; readings: NdviReading[] }) {
  return <div className="terrace-preview">{terraces.map((terrace) => {
    const latest = readings.find((reading) => reading.terrace === terrace.id)
    const open = alerts.filter((alert) => alert.terrace === terrace.id && alert.status === 'pending').length
    return <Link to={`/farm?terrace=${terrace.id}`} key={terrace.id} className="terrace-preview-card">
      <span className={`zone-marker zone-${terrace.zone || 'unknown'}`}><Layers3 size={16} /></span>
      <span className="terrace-preview-main"><strong>{terrace.identifier}</strong><small>{terrace.zone ? `${terrace.zone} zone` : 'Zone unavailable'}</small></span>
      <span className="terrace-preview-metrics"><small>NDVI</small><strong>{latest ? showNumber(latest.mean_ndvi, 2) : '—'}</strong></span>
      <span className={`count-chip ${open ? 'count-attention' : ''}`}>{open} pending</span>
    </Link>
  })}</div>
}

export function FarmPage() {
  const hillsideList = useResource('farm-hillsides', () => api.hillsides())
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedId = Number(searchParams.get('hillside'))
  const [selection, setSelection] = useState<number | null>(requestedId || null)
  const [query, setQuery] = useState('')
  const hillsides = hillsideList.data || []
  const selectedId = hillsides.some((item) => item.id === selection)
    ? selection
    : hillsides.some((item) => item.id === requestedId)
      ? requestedId
      : hillsides[0]?.id ?? null
  const selected = hillsides.find((item) => item.id === selectedId)
  const terraces = useResource(`farm-terraces:${selectedId}`, () => selectedId ? api.terraces(selectedId) : Promise.resolve([]))
  const readings = useResource(`farm-ndvi:${selectedId}`, () => selectedId ? api.ndvi(selectedId) : Promise.resolve([]))
  const alerts = useResource(`farm-alerts:${selectedId}`, () => selectedId ? api.alerts(selectedId) : Promise.resolve([]))
  const weather = useResource(`farm-weather:${selected?.id || 'none'}`, () => selected?.latitude && selected.longitude ? api.weather(selected.id) : Promise.resolve(null))
  const filteredTerraces = (terraces.data || []).filter((terrace) => `${terrace.identifier} ${terrace.name} ${terrace.zone}`.toLowerCase().includes(query.toLowerCase()))

  if (hillsideList.loading) return <div className="page-stack"><PageHeading title="Hillsides & terraces" /><LoadingState label="Loading hillside records" /></div>
  if (hillsideList.error) return <div className="page-stack"><PageHeading title="Hillsides & terraces" /><ErrorState message={hillsideList.error} retry={hillsideList.reload} /></div>
  if (!hillsides.length) return <div className="page-stack"><PageHeading title="Hillsides & terraces" description="Explore terrain and vegetation data by hillside." /><EmptyState title="No hillsides available" detail="The backend has not returned hillside records yet." /></div>

  return <div className="page-stack">
    <PageHeading eyebrow="FARM INTELLIGENCE" title="Hillsides & terraces" description="Explore observed terrain, NDVI history, and candidate alert conditions." />
    <div className="farm-layout">
      <aside className="surface hillside-picker"><label className="field-label" htmlFor="hillside-search">Find a hillside</label><div className="input-with-icon"><Search size={17} /><input id="hillside-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or district" /></div>
        <div className="hillside-options">{hillsides.filter((item) => `${item.name} ${item.district} ${item.sector}`.toLowerCase().includes(query.toLowerCase())).map((item) => <button type="button" key={item.id} className={`hillside-option ${selectedId === item.id ? 'selected' : ''}`} onClick={() => setSelection(item.id)}><span className="hillside-option-icon"><Mountain size={18} /></span><span><strong>{item.name}</strong><small>{locationLabel(item)}</small></span><ArrowRight size={15} /></button>)}</div>
      </aside>
      {selected && <section className="farm-detail">
        <article className="surface detail-banner"><div><p className="eyebrow">HILLSIDE OVERVIEW</p><h2>{selected.name}</h2><p className="muted">{locationLabel(selected)}</p>{selected.description && <p className="detail-description">{selected.description}</p>}</div><div className="detail-banner-actions"><span className="count-chip">ID {selected.id}</span><button className="button button-outline" type="button" onClick={() => navigate(`/map?hillside=${selected.id}`)}><MapPin size={16} />Open map</button></div></article>
        <div className="metric-grid metric-grid-three">
          <MetricCard label="Terraces" value={terraces.data?.length ?? '—'} icon={<Layers3 />} tone="green" note="On this hillside" />
          <MetricCard label="NDVI readings" value={readings.data?.length ?? '—'} icon={<Activity />} tone="soil" note="Dated observations" />
          <MetricCard label="Alert history" value={alerts.data?.length ?? '—'} icon={<ShieldAlert />} tone="orange" note="Candidate conditions" />
        </div>
        <article className="surface"><div className="surface-heading"><div><p className="eyebrow">TERRACE INVENTORY</p><h2>Observed conditions</h2></div><div className="input-with-icon compact-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter terraces" aria-label="Filter terraces" /></div></div>
          {terraces.loading && <LoadingState label="Loading terraces" />}{terraces.error && <ErrorState message={terraces.error} retry={terraces.reload} />}
          {!terraces.loading && filteredTerraces.length === 0 && <EmptyState title="No terraces available" detail="This hillside has no terrace records matching the current filter." />}
          <TerraceTable terraces={filteredTerraces} readings={readings.data || []} alerts={alerts.data || []} />
        </article>
        <div className="content-grid">
          <NdviChart readings={readings.data || []} title="Vegetation health" loading={readings.loading} />
          <WeatherSummary forecast={weather.data?.data ?? null} loading={weather.loading} error={weather.error} hillside={selected} />
        </div>
        <article className="surface"><div className="surface-heading"><div><p className="eyebrow">ALERT HISTORY</p><h2>Review records</h2></div><Link className="text-link" to={`/alerts?hillside=${selected.id}`}>Open alert center <ArrowRight size={15} /></Link></div>
          {(alerts.data || []).length === 0 ? <EmptyState title="No alerts for this hillside" detail="No alert records have been returned for this hillside." /> : <div className="compact-list">{(alerts.data || []).slice(0, 8).map((alert) => <CompactAlert key={alert.id} alert={alert} />)}</div>}
        </article>
      </section>}
    </div>
  </div>
}

function TerraceTable({ terraces, readings, alerts }: { terraces: Terrace[]; readings: NdviReading[]; alerts: AlertRecord[] }) {
  return <div className="terrace-table-wrap"><table className="data-table"><thead><tr><th>Terrace</th><th>Zone</th><th>Slope</th><th>Flow accumulation</th><th>Latest NDVI</th><th>Risk indicator</th></tr></thead><tbody>
    {terraces.map((terrace) => {
      const ndvi = readings.find((reading) => reading.terrace === terrace.id)
      const alert = alerts.find((item) => item.terrace === terrace.id && item.status !== 'dismissed')
      return <tr key={terrace.id}><td><strong>{terrace.identifier}</strong><small>{terrace.name}</small></td><td>{terrace.zone || 'Unavailable'}</td><td>{terrace.slope_degrees ? `${showNumber(terrace.slope_degrees, 1)}°` : 'Unavailable'}</td><td>{showNumber(terrace.flow_accumulation, 1)}</td><td>{ndvi ? <>{showNumber(ndvi.mean_ndvi, 3)}<small><RelativeDate value={ndvi.observed_on} /></small></> : 'No reading'}</td><td>{alert ? <RiskBadge level={alert.status === 'pending' ? 'orange' : 'yellow'} label={alert.status === 'pending' ? 'Needs review' : 'Field verification'} /> : <RiskBadge level="muted" label="No active alert" />}</td></tr>
    })}
  </tbody></table><div className="terrace-mobile-list">{terraces.map((terrace) => {
    const ndvi = readings.find((reading) => reading.terrace === terrace.id)
    const alert = alerts.find((item) => item.terrace === terrace.id && item.status !== 'dismissed')
    return <article className="terrace-mobile-card" key={terrace.id}><div className="row-between"><strong>{terrace.identifier} · {terrace.name}</strong><RiskBadge level={alert ? alert.status === 'pending' ? 'orange' : 'yellow' : 'muted'} label={alert ? alert.status === 'pending' ? 'Needs review' : 'Field verification' : 'No active alert'} /></div><div className="mobile-terrain-grid"><span>Zone<strong>{terrace.zone || 'Unavailable'}</strong></span><span>Slope<strong>{terrace.slope_degrees ? `${showNumber(terrace.slope_degrees, 1)}°` : 'Unavailable'}</strong></span><span>Flow<strong>{showNumber(terrace.flow_accumulation)}</strong></span><span>Latest NDVI<strong>{ndvi ? showNumber(ndvi.mean_ndvi, 3) : 'No reading'}</strong></span></div>{ndvi && <small>Observed <RelativeDate value={ndvi.observed_on} /></small>}</article>
  })}</div></div>
}

function NdviChart({ readings, title, loading }: { readings: NdviReading[]; title: string; loading?: boolean }) {
  const data = [...readings].sort((a, b) => a.observed_on.localeCompare(b.observed_on)).map((reading) => ({ date: reading.observed_on, ndvi: numberOrNull(reading.mean_ndvi) }))
  const latest = data[data.length - 1]?.ndvi ?? null
  return <article className="surface chart-surface"><div className="surface-heading"><div><p className="eyebrow">NDVI HISTORY</p><h2>{title}</h2></div>{latest !== null && <span className="chart-latest">Latest <strong>{latest.toFixed(3)}</strong></span>}</div>
    {loading && <LoadingState label="Loading NDVI readings" />}
    {!loading && data.length < 2 && <EmptyState title="No NDVI history available yet" detail="The API needs at least two dated readings before a vegetation trend can be drawn." />}
    {!loading && data.length >= 2 && <div className="chart-wrap chart-wrap-large"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}><defs><linearGradient id="ndviFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6a9a70" stopOpacity={0.22} /><stop offset="100%" stopColor="#6a9a70" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e4e9e3" strokeDasharray="3 5" /><XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} tickLine={false} axisLine={false} /><YAxis domain={[-1, 1]} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => [showNumber(value as number, 3), 'NDVI']} /><Area type="monotone" dataKey="ndvi" stroke="#427c59" strokeWidth={2.5} fill="url(#ndviFill)" connectNulls /></AreaChart></ResponsiveContainer></div>}
    <p className="chart-footnote">NDVI indicates vegetation condition. It does not by itself prove disease.</p>
  </article>
}

function EmptyCollection({ label }: { label: string }) { return <EmptyState title={`No ${label} available`} detail="The backend has not returned records for this view." /> }

export function NdviPage() {
  const hillsides = useResource('ndvi-hillsides', () => api.hillsides())
  const [hillsideSelection, setHillsideSelection] = useState<number | null>(null)
  const hillsideId = hillsides.data?.some((item) => item.id === hillsideSelection)
    ? hillsideSelection
    : hillsides.data?.[0]?.id ?? null
  const terraces = useResource(`ndvi-terraces:${hillsideId}`, () => hillsideId ? api.terraces(hillsideId) : Promise.resolve([]))
  const [terraceSelection, setTerraceSelection] = useState<number | null>(null)
  const terraceId = terraces.data?.some((item) => item.id === terraceSelection)
    ? terraceSelection
    : terraces.data?.[0]?.id ?? null
  const readings = useResource(`ndvi-reading:${terraceId}`, () => terraceId ? api.ndvi(undefined, terraceId) : Promise.resolve([]))
  const selected = (terraces.data || []).find((item) => item.id === terraceId)
  const ordered = [...(readings.data || [])].sort((a, b) => a.observed_on.localeCompare(b.observed_on))
  const baselineValues = ordered.slice(0, -1).slice(-4).map((reading) => Number(reading.mean_ndvi)).filter(Number.isFinite)
  const baseline = baselineValues.length ? baselineValues.reduce((sum, value) => sum + value, 0) / baselineValues.length : null
  const latest = ordered.at(-1)
  const change = baseline && latest ? ((Number(latest.mean_ndvi) - baseline) / Math.abs(baseline)) * 100 : null

  return <div className="page-stack"><PageHeading eyebrow="VEGETATION SIGNALS" title="Vegetation health" description="Explore dated NDVI readings. This signal is not a disease diagnosis." />
    <div className="filter-bar surface"><label className="select-field"><span>Hillside</span><select value={hillsideId || ''} onChange={(event) => { setHillsideSelection(Number(event.target.value)); setTerraceSelection(null) }}><option value="" disabled>Select hillside</option>{(hillsides.data || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="select-field"><span>Terrace</span><select value={terraceId || ''} onChange={(event) => setTerraceSelection(Number(event.target.value))}><option value="" disabled>Select terrace</option>{(terraces.data || []).map((item) => <option key={item.id} value={item.id}>{item.identifier} · {item.name}</option>)}</select></label>
    </div>
    {!selected && <EmptyCollection label="terraces" />}
    {selected && <><div className="metric-grid metric-grid-three"><MetricCard label="Latest NDVI" value={latest ? showNumber(latest.mean_ndvi, 3) : '—'} icon={<Leaf />} tone="green" note={latest ? `Observed ${latest.observed_on}` : 'No dated readings'} /><MetricCard label="Previous readings" value={Math.max(0, ordered.length - 1)} icon={<Activity />} tone="blue" note="Available history" /><MetricCard label="Change vs recent average" value={change === null ? '—' : `${change > 0 ? '+' : ''}${pctFormat.format(change)}%`} icon={change !== null && change < 0 ? <ArrowDownRight /> : <ArrowUpRight />} tone="soil" note="Previous four readings · frontend estimate" /></div>
      <NdviChart readings={ordered} title={`${selected.identifier} · ${selected.name}`} loading={readings.loading} />
      <article className="surface"><p className="eyebrow">OBSERVATION RECORDS</p><h2>Reading history</h2>{ordered.length === 0 ? <EmptyState title="No NDVI readings available" detail="No observation dates or values have been returned for this terrace." /> : <div className="reading-list">{[...ordered].reverse().map((reading) => <div className="reading-row" key={reading.id}><span className="reading-date"><RelativeDate value={reading.observed_on} /></span><span className="reading-bar"><i style={{ width: `${Math.max(0, Math.min(100, (Number(reading.mean_ndvi) + 1) * 50))}%` }} /></span><strong>{showNumber(reading.mean_ndvi, 3)}</strong><small>{reading.source || 'Source unavailable'}</small></div>)}</div>}</article>
      <div className="notice-line"><Activity size={17} /><span>NDVI indicates vegetation condition; it does not by itself establish crop disease or treatment needs.</span></div>
    </>}
  </div>
}

export function AlertsPage() {
  const auth = useAuth()
  const params = new URLSearchParams(window.location.search)
  const hillsideFilter = Number(params.get('hillside')) || undefined
  const initialSelected = Number(params.get('selected')) || null
  const alerts = useResource(`alerts:${hillsideFilter || 'all'}`, () => api.alerts(hillsideFilter))
  const [tab, setTab] = useState<'all' | AlertStatus>('all')
  const [selectedId, setSelectedId] = useState<number | null>(initialSelected)
  const [advice, setAdvice] = useState<Record<number, string>>({})
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const filtered = (alerts.data || []).filter((alert) => tab === 'all' || alert.status === tab)
  const selected = filtered.find((alert) => alert.id === selectedId)

  async function review(alert: AlertRecord, status: 'confirmed' | 'dismissed') {
    setWorkingId(alert.id)
    setActionError(null)
    try {
      await api.reviewAlert(alert.id, status, advice[alert.id]?.trim() || undefined)
      setSelectedId(null)
      alerts.reload()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The review could not be saved.')
    } finally {
      setWorkingId(null)
    }
  }

  return <div className="page-stack"><PageHeading eyebrow="FIELD REVIEW" title="Alert center" description="Evidence-backed pilot alerts. Confirm findings in the field before giving agronomic advice." />
    <div className="tab-row" role="tablist" aria-label="Filter alerts">{(['all', 'pending', 'confirmed', 'dismissed'] as const).map((status) => <button key={status} type="button" role="tab" aria-selected={tab === status} className={`tab-button ${tab === status ? 'active' : ''}`} onClick={() => setTab(status)}>{status === 'all' ? 'All' : titleCase(status)}<span>{status === 'all' ? alerts.data?.length ?? '—' : (alerts.data || []).filter((item) => item.status === status).length}</span></button>)}</div>
    {alerts.loading && <LoadingState label="Loading alerts" />}{alerts.error && <ErrorState message={alerts.error} retry={alerts.reload} />}
    {!alerts.loading && filtered.length === 0 && <EmptyState title={tab === 'all' ? 'No alerts yet' : `No ${tab} alerts`} detail="Only alert records returned by the backend appear here." />}
    <div className="alerts-layout"><div className="alert-feed">{filtered.map((alert) => <button type="button" className={`alert-card ${selectedId === alert.id ? 'selected' : ''}`} key={alert.id} onClick={() => setSelectedId(selectedId === alert.id ? null : alert.id)}>
      <div className="alert-card-top"><span className={`alert-symbol symbol-${alert.alert_type}`}><ShieldAlert size={17} /></span><StatusBadge status={alert.status} /><RelativeDate value={alert.observation_date || alert.created_at} /></div>
      <div className="alert-card-title"><h3>{alert.notification_title}</h3>{alert.confidence && <span className="confidence-chip">{pctFormat.format(Number(alert.confidence) * 100)}% model confidence</span>}</div>
      <p>{alert.message}</p><div className="alert-card-meta"><span><Layers3 size={14} />{alert.terrace_identifier} · {alert.hillside_name}</span><small>{titleCase(alert.source.replaceAll('_', ' '))}</small></div>
    </button>)}</div>
    {selected && <aside className="surface alert-detail" aria-label="Alert evidence"><button className="detail-close icon-button" type="button" aria-label="Close alert evidence" onClick={() => setSelectedId(null)}><X size={18} /></button><p className="eyebrow">EVIDENCE & NEXT STEP</p><h2>{selected.notification_title}</h2><StatusBadge status={selected.status} />
      <dl className="detail-list"><div><dt>Hillside</dt><dd>{selected.hillside_name}</dd></div><div><dt>Terrace</dt><dd>{selected.terrace_identifier}</dd></div><div><dt>Observed</dt><dd><RelativeDate value={selected.observation_date || selected.created_at} /></dd></div><div><dt>Source</dt><dd>{titleCase(selected.source.replaceAll('_', ' '))}</dd></div>{selected.confidence && <div><dt>Model confidence</dt><dd>{pctFormat.format(Number(selected.confidence) * 100)}%</dd></div>}</dl>
      <div className="evidence-box"><strong>Why this alert?</strong><p>{selected.message}</p></div><div className="action-box"><strong>Recommended field action</strong><p>{selected.recommended_action}</p><small>Advisory only. Confirm conditions with an authorized extension worker.</small></div>
      {auth.isTrainer && selected.status === 'pending' && <div className="review-form"><label className="field-label" htmlFor="farmer-advice">Farmer advice <span>Optional, trainer-published on confirmation</span></label><textarea id="farmer-advice" maxLength={2000} value={advice[selected.id] || ''} onChange={(event) => setAdvice({ ...advice, [selected.id]: event.target.value })} placeholder="Add field-verified advice…" /><div className="button-row"><button className="button button-primary" type="button" disabled={workingId === selected.id} onClick={() => review(selected, 'confirmed')}><Check size={16} />Confirm</button><button className="button button-outline" type="button" disabled={workingId === selected.id} onClick={() => review(selected, 'dismissed')}><X size={16} />Dismiss</button></div>{actionError && <ErrorState message={actionError} />}</div>}
      {!auth.token && selected.status === 'pending' && <p className="permission-note"><ShieldCheck size={15} />Connect an authorized trainer token to review alerts.</p>}
      {auth.token && !auth.isTrainer && selected.status === 'pending' && <p className="permission-note"><ShieldCheck size={15} />Review controls are available only to trainer-group accounts.</p>}
    </aside>}</div>
  </div>
}

export function ExtensionDashboardPage() {
  const auth = useAuth()
  const { hillsides, terraces, alerts } = useOverviewData()
  const [focus, setFocus] = useState<'pending' | 'recent' | 'field'>('pending')
  const items = alerts.data || []
  const pending = items.filter((item) => item.status === 'pending')
  const fieldFollowUp = items.filter((item) => item.status === 'confirmed')
  const attention = focus === 'pending' ? pending : focus === 'field' ? fieldFollowUp : [...items]
  const sorted = [...attention].sort((first, second) => {
    if (focus === 'recent') return second.created_at.localeCompare(first.created_at)
    return Number(second.status === 'pending') - Number(first.status === 'pending') || second.created_at.localeCompare(first.created_at)
  })
  const loading = hillsides.loading || terraces.loading || alerts.loading

  return <div className="page-stack"><PageHeading eyebrow="EXTENSION-WORKER WORKSPACE" title="Extension desk" description="Review alerts and prioritize field verification from the pilot data available." action={<Link className="button button-primary" to="/alerts"><ShieldCheck size={16} />Review alerts</Link>} />
    <section className="metric-grid" aria-label="Extension-work summary">
      <MetricCard label="Hillsides monitored" value={hillsides.data?.length ?? '—'} icon={<Mountain size={18} />} tone="green" note="Returned by API" />
      <MetricCard label="Terraces monitored" value={terraces.data?.length ?? '—'} icon={<Layers3 size={18} />} tone="soil" note="Current pilot records" />
      <MetricCard label="Pending review" value={pending.length} icon={<ShieldAlert size={18} />} tone="orange" note="Awaiting trainer decision" />
      <MetricCard label="Confirmed · field follow-up" value={fieldFollowUp.length} icon={<MapPin size={18} />} tone="blue" note="Verify on the hillside" />
    </section>
    {alerts.error && <ErrorState message={alerts.error} retry={alerts.reload} />}
    <article className="surface"><div className="surface-heading"><div><p className="eyebrow">TRIAGE</p><h2>Attention required</h2></div><span className="muted">Pending first · then newest</span></div>
      <div className="tab-row" role="tablist" aria-label="Filter extension alerts">{([['pending', 'Pending review'], ['field', 'Field follow-up'], ['recent', 'Recent activity']] as const).map(([key, label]) => <button key={key} className={`tab-button ${focus === key ? 'active' : ''}`} type="button" role="tab" aria-selected={focus === key} onClick={() => setFocus(key)}>{label}<span>{key === 'pending' ? pending.length : key === 'field' ? fieldFollowUp.length : items.length}</span></button>)}</div>
      {loading && <LoadingState label="Loading hillside attention queue" />}
      {!loading && sorted.length === 0 && <EmptyState title={focus === 'pending' ? 'No pending alerts' : focus === 'field' ? 'No field follow-up records' : 'No alert activity'} detail="The queue reflects alert records returned by the backend; no sample items are added." />}
      <div className="attention-queue">{sorted.map((alert) => <article className="attention-row" key={alert.id}><span className={`alert-symbol symbol-${alert.alert_type}`}><ShieldAlert size={17} /></span><div className="attention-main"><div className="row-between"><h3>{alert.notification_title}</h3><StatusBadge status={alert.status} /></div><p>{alert.hillside_name} · {alert.terrace_identifier}</p><small>{alert.message}</small><div className="attention-meta"><RelativeDate value={alert.observation_date || alert.created_at} /><span>{titleCase(alert.source.replaceAll('_', ' '))}</span></div></div><div className="attention-actions"><Link className="button button-outline button-small" to={`/farm?hillside=${alert.hillside_id}&terrace=${alert.terrace}`}>View terrace</Link><Link className="button button-primary button-small" to={`/alerts?selected=${alert.id}`}>Review</Link></div></article>)}</div>
    </article>
    {(!auth.token || !auth.isTrainer) && <div className="notice-line"><ShieldCheck size={16} /><span>Review and farmer-advice actions are only available with a trainer-group token. The backend enforces this permission.</span><Link className="text-link" to="/profile">Connect <ArrowRight size={14} /></Link></div>}
  </div>
}

function titleCase(value: string) { return value.replace(/\b\w/g, (letter) => letter.toUpperCase()) }

export function NotificationsPage() {
  const notifications = useResource('notifications', () => api.notifications())
  return <div className="page-stack"><PageHeading eyebrow="TRAINER-CONFIRMED ONLY" title="Notifications" description="This feed includes only confirmed alert records returned by the backend." />
    {notifications.loading && <LoadingState label="Loading confirmed notifications" />}{notifications.error && <ErrorState message={notifications.error} retry={notifications.reload} />}
    {!notifications.loading && !notifications.data?.length && <EmptyState title="No confirmed notifications" detail="Pending and dismissed alerts are not included in this feed." />}
    <div className="notification-feed">{(notifications.data || []).map((item) => <article className="surface notification-card" key={item.id}><div className="notification-date"><span className="notification-dot" />{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(item.created_at))}</div><div className="notification-body"><div className="row-between"><h2>{item.notification_title}</h2><StatusBadge status={item.status} /></div><strong>{item.terrace_identifier} · {item.hillside_name}</strong><p>{item.message}</p><div className="action-box"><strong>Recommended next step</strong><p>{item.recommended_action}</p></div><Link className="text-link" to={`/alerts?selected=${item.id}`}>View alert evidence <ArrowRight size={15} /></Link></div></article>)}</div>
  </div>
}

export function ProfilePage() {
  const auth = useAuth()
  const [candidate, setCandidate] = useState('')
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function connect(event: FormEvent) {
    event.preventDefault()
    setWorking(true)
    setError(null)
    setMessage(null)
    try {
      const isTrainer = await auth.connect(candidate)
      setCandidate('')
      setMessage(isTrainer ? 'Trainer token connected.' : 'Token connected. Review and publishing actions require trainer-group membership.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Token verification failed.')
    } finally {
      setWorking(false)
    }
  }
  return <div className="page-stack"><PageHeading eyebrow="ACCOUNT & SETTINGS" title="Profile" description="Connect with the existing Django token authentication." />
    <div className="profile-grid"><article className="surface profile-card"><div className="profile-heading"><span className="profile-avatar"><UserRound size={24} /></span><div><h2>{auth.token ? auth.isTrainer ? 'Trainer account connected' : 'Field account connected' : 'Not connected'}</h2><p>{auth.token ? 'This token is held in memory only for this tab.' : 'Public hillside and alert data can still be viewed.'}</p></div></div>
      {auth.token ? <button className="button button-outline" type="button" onClick={auth.disconnect}><LogOut size={16} />Disconnect token</button> : <form className="connect-form" onSubmit={connect}><label className="field-label" htmlFor="api-token">Existing API token</label><input id="api-token" type="password" autoComplete="off" value={candidate} onChange={(event) => setCandidate(event.target.value)} placeholder="Paste token for this session" required /><small>Paste the token value; a leading “Token ” is accepted. It is verified against the API and not saved to storage.</small><button className="button button-primary" type="submit" disabled={working || !candidate.trim()}>{working ? 'Checking…' : 'Connect account'}<ArrowRight size={16} /></button>{error && <ErrorState message={error} />}{message && <p className="success-message"><CheckCircle2 size={16} />{message}</p>}</form>}
      <div className="api-endpoint"><span>API base</span><code>{getApiBaseUrl()}</code></div>
    </article><aside className="surface profile-card"><p className="eyebrow">ACCESS NOTES</p><h2>Existing backend roles</h2><p className="muted">The backend authenticates API tokens. Trainer-only actions are also checked on every request by the server.</p><ul className="access-list"><li><CheckCircle2 size={16} />Read hillsides, terraces, alerts, NDVI, and published advisories without a token.</li><li><ShieldCheck size={16} />Connect a trainer-group token to review alerts and manage advisories.</li><li><LogIn size={16} />Create or issue tokens through Django admin/management commands; the frontend does not implement passwords.</li></ul><Link to="/" className="text-link">Return to overview <ArrowRight size={15} /></Link></aside></div>
  </div>
}

export function WeatherPage() {
  const hillsides = useResource('weather-hillsides', () => api.hillsides())
  const [hillsideSelection, setHillsideSelection] = useState<number | null>(null)
  const hillsideId = hillsides.data?.some((item) => item.id === hillsideSelection)
    ? hillsideSelection
    : hillsides.data?.[0]?.id ?? null
  const hillside = hillsides.data?.find((item) => item.id === hillsideId)
  const weather = useResource(`weather:${hillsideId}`, () => hillsideId ? api.weather(hillsideId) : Promise.resolve(null))
  return <div className="page-stack"><PageHeading eyebrow="WEATHER & TRAINER ADVICE" title="Weather" description="Provider forecast, automated reminders, and trainer-published advisories remain distinct." />
    <div className="filter-bar surface"><label className="select-field"><span>Hillside</span><select value={hillsideId || ''} onChange={(event) => setHillsideSelection(Number(event.target.value))}><option value="" disabled>Select hillside</option>{(hillsides.data || []).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><span className="muted">Coordinates are required by the weather API.</span></div>
    {weather.loading && <LoadingState label="Loading hillside forecast" />}{weather.error && <ErrorState message={weather.error} retry={weather.reload} />}
    {!hillsides.loading && !hillside && <EmptyState title="No hillside available" detail="The backend has not returned a hillside to forecast." />}
    {hillside && !hillside.latitude && <EmptyState title="No weather location configured" detail="This hillside has no latitude/longitude in the API, so no forecast can be requested." />}
    {weather.data && <WeatherDetail weather={weather.data.data} />}
  </div>
}

function WeatherDetail({ weather }: { weather: WeatherForecast }) {
  return <div className="page-stack"><div className="weather-detail-grid"><article className="surface weather-current"><p className="eyebrow">CURRENT CONDITIONS · {weather.provider}</p><div className="weather-current-main"><div><span className="weather-temp">{weather.current.temperature_c === null ? '—' : `${showNumber(weather.current.temperature_c, 0)}°`}</span><h2>{weather.current.weather}</h2><p>{weather.hillside_name} · {weather.timezone || 'Local timezone unavailable'}</p></div><CloudSun size={54} strokeWidth={1.2} /></div><div className="weather-facts"><WeatherFact icon={<Droplets />} label="Humidity" value={weather.current.relative_humidity_pct === null ? 'Unavailable' : `${weather.current.relative_humidity_pct}%`} /><WeatherFact icon={<CloudRain />} label="Precipitation" value={weather.current.precipitation_mm === null ? 'Unavailable' : `${weather.current.precipitation_mm} mm`} /><WeatherFact icon={<Wind />} label="Wind" value={weather.current.wind_speed_kmh === null ? 'Unavailable' : `${weather.current.wind_speed_kmh} km/h`} /></div>{weather.is_stale && <div className="stale-banner"><RefreshCw size={15} />Showing cached weather data · last retrieved {new Date(weather.retrieved_at).toLocaleString('en')}</div>}<a href={weather.provider_url} target="_blank" rel="noreferrer" className="text-link">Weather provider details <ExternalLink size={14} /></a></article>
    <article className="surface weather-reminder"><span className="weather-reminder-icon"><CloudRain size={20} /></span><p className="eyebrow">AUTOMATED WEATHER REMINDER</p><h2>Field conditions</h2><p>{weather.weather_advice}</p><small>{weather.advice_note}</small></article></div>
    <article className="surface"><div className="surface-heading"><div><p className="eyebrow">NEXT THREE DAYS</p><h2>Forecast</h2></div><span className="muted">From {weather.provider}</span></div><div className="forecast-grid">{weather.daily.map((day) => <article className="forecast-card" key={day.date}><span>{new Intl.DateTimeFormat('en', { weekday: 'long' }).format(new Date(`${day.date}T12:00:00`))}</span><strong>{day.weather}</strong><span className="forecast-temp-range">{day.temperature_min_c ?? '—'}° <b>{day.temperature_max_c ?? '—'}°</b></span><div className="forecast-rain"><CloudRain size={15} />{day.precipitation_probability_pct ?? '—'}% chance · {day.precipitation_mm ?? '—'} mm</div></article>)}</div></article>
    <article className="surface"><div className="surface-heading"><div><p className="eyebrow">TRAINER-PUBLISHED</p><h2>Farm advisories</h2></div><Link className="text-link" to="/advisories">All advisories <ArrowRight size={15} /></Link></div>{weather.published_advisories.length === 0 ? <EmptyState title="No published advisories" detail="No active trainer-published advisory applies to this hillside." /> : <div className="advisory-list">{weather.published_advisories.map((item) => <AdvisoryCard key={item.id} advisory={item} />)}</div>}</article></div>
}

function WeatherFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="weather-fact"><span>{icon}</span><small>{label}</small><strong>{value}</strong></div>
}

function AdvisoryCard({ advisory }: { advisory: FarmAdvisory }) {
  return <article className="advisory-card"><div className="row-between"><span className="advisory-crop">{advisory.crop}</span>{advisory.valid_until && <small>Valid until {advisory.valid_until}</small>}</div><h3>{advisory.title}</h3><p>{advisory.message}</p><small>{advisory.hillside_name || 'All hillsides'}</small></article>
}

export function AdvisoriesPage() {
  const auth = useAuth()
  const advisories = useResource(`advisories:${auth.isTrainer ? 'trainer' : 'public'}`, () => api.advisories())
  const hillsides = useResource('advisory-hillsides', () => api.hillsides())
  const [tab, setTab] = useState<'published' | 'draft' | 'expired' | 'withdrawn'>('published')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', message: '', crop: 'potato', hillside: '', valid_until: '' })
  const today = new Date().toISOString().slice(0, 10)
  const visible = (advisories.data || []).filter((item) => {
    if (tab === 'expired') return item.status === 'published' && item.valid_until !== null && item.valid_until < today
    if (tab === 'published') return item.status === 'published' && (!item.valid_until || item.valid_until >= today)
    return item.status === tab
  })

  async function saveDraft(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload = { ...form, hillside: form.hillside ? Number(form.hillside) : null, valid_until: form.valid_until || null }
      if (editingId) await api.updateAdvisory(editingId, payload)
      else await api.createAdvisory(payload)
      setForm({ title: '', message: '', crop: 'potato', hillside: '', valid_until: '' })
      setEditingId(null)
      setFormOpen(false)
      advisories.reload()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Draft could not be saved.')
    } finally { setSaving(false) }
  }

  function editDraft(item: FarmAdvisory) {
    setEditingId(item.id)
    setForm({
      title: item.title,
      message: item.message,
      crop: item.crop,
      hillside: item.hillside ? String(item.hillside) : '',
      valid_until: item.valid_until || '',
    })
    setFormOpen(true)
    setTab('draft')
    setFormError(null)
  }

  function closeEditor() {
    setFormOpen(false)
    setEditingId(null)
    setForm({ title: '', message: '', crop: 'potato', hillside: '', valid_until: '' })
    setFormError(null)
  }

  async function mutate(item: FarmAdvisory, action: 'publish' | 'withdraw' | 'delete') {
    setFormError(null)
    try {
      if (action === 'publish') await api.publishAdvisory(item.id)
      if (action === 'withdraw') await api.withdrawAdvisory(item.id)
      if (action === 'delete') await api.deleteAdvisory(item.id)
      advisories.reload()
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Advisory action failed.') }
  }

  return <div className="page-stack"><PageHeading eyebrow="FIELD GUIDANCE" title="Advisories" description="Published guidance comes from trainers; drafts are visible only to authorized trainer accounts." action={auth.isTrainer ? <button className="button button-primary" type="button" onClick={() => formOpen ? closeEditor() : setFormOpen(true)}><ShieldCheck size={16} />{formOpen ? 'Close editor' : 'New draft'}</button> : undefined} />
    {!auth.token && <div className="notice-line"><ShieldCheck size={16} /><span>Published advisories are public. Connect a trainer token to draft, publish, or withdraw guidance.</span></div>}
    {auth.token && !auth.isTrainer && <div className="notice-line"><ShieldCheck size={16} /><span>Trainer actions are hidden. The backend did not authorize this token for trainer operations.</span></div>}
    {formOpen && auth.isTrainer && <form className="surface advisory-editor" onSubmit={saveDraft}><div className="surface-heading"><div><p className="eyebrow">DRAFT ONLY</p><h2>{editingId ? 'Edit draft' : 'New advisory'}</h2></div></div><div className="form-grid"><label className="field-label">Title<input required maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="field-label">Crop<input required value={form.crop} onChange={(event) => setForm({ ...form, crop: event.target.value })} /></label><label className="field-label">Hillside<select value={form.hillside} onChange={(event) => setForm({ ...form, hillside: event.target.value })}><option value="">All hillsides</option>{(hillsides.data || []).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label className="field-label">Expiry date<input type="date" min={today} value={form.valid_until} onChange={(event) => setForm({ ...form, valid_until: event.target.value })} /></label><label className="field-label form-span">Message<textarea required value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} rows={4} /></label></div>{formError && <ErrorState message={formError} />}<button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update draft' : 'Save draft'}<ArrowRight size={16} /></button></form>}
    <div className="tab-row" role="tablist" aria-label="Filter advisories">{(['published', 'draft', 'expired', 'withdrawn'] as const).map((item) => <button className={`tab-button ${tab === item ? 'active' : ''}`} role="tab" aria-selected={tab === item} key={item} type="button" onClick={() => setTab(item)}>{titleCase(item)}<span>{(advisories.data || []).filter((entry) => item === 'expired' ? entry.status === 'published' && entry.valid_until && entry.valid_until < today : entry.status === item && (item !== 'published' || !entry.valid_until || entry.valid_until >= today)).length}</span></button>)}</div>
    {advisories.loading && <LoadingState label="Loading advisories" />}{advisories.error && <ErrorState message={advisories.error} retry={advisories.reload} />}
    {!advisories.loading && visible.length === 0 && <EmptyState title={`No ${tab} advisories`} detail={tab === 'published' ? 'No active trainer-published advisory is available.' : `No ${tab} advisory records are available to this account.`} />}
    <div className="advisory-list">{visible.map((item) => <article className="surface advisory-card" key={item.id}><div className="row-between"><span className="advisory-crop">{item.crop}</span><StatusBadge status={item.status} /></div><h3>{item.title}</h3><p>{item.message}</p><div className="advisory-meta"><span>{item.hillside_name || 'All hillsides'}</span><span>{item.valid_until ? `Valid until ${item.valid_until}` : 'No expiry provided'}</span></div>{auth.isTrainer && <div className="button-row">{item.status === 'draft' && <><button className="button button-outline" type="button" onClick={() => editDraft(item)}>Edit draft</button><button className="button button-primary" type="button" onClick={() => mutate(item, 'publish')}><Check size={15} />Publish</button><button className="button button-outline" type="button" onClick={() => mutate(item, 'delete')}><X size={15} />Delete draft</button></>}{item.status === 'published' && <button className="button button-outline" type="button" onClick={() => mutate(item, 'withdraw')}><X size={15} />Withdraw</button>}</div>}</article>)}</div>
  </div>
}

export function FarmPlaceholder() { return <EmptyCollection label="farm records" /> }
