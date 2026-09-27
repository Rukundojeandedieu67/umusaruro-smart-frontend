import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight, Bot, CheckCircle2, CloudSun, Copy, Leaf, LoaderCircle, MapPin,
  Send, ShieldAlert, Sparkles, Upload, UserRound,
} from 'lucide-react'
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer } from 'react-leaflet'
import type { GeoJsonObject } from 'geojson'
import { api, ApiError } from '../api/client'
import type { AlertRecord, AssistantResponse, PhotoClassification, Terrace } from '../api/types'
import { useAuth } from '../auth/useAuth'
import { EmptyState, ErrorState, LoadingState, PageHeading, RiskBadge } from '../components/ui'
import { useResource } from '../hooks'

type MapLayer = 'terrain' | 'risk' | 'ndvi' | 'alerts' | 'weather'

export function MapPage() {
  const [params, setParams] = useSearchParams()
  const hillsides = useResource('map-hillsides', () => api.hillsides())
  const requestedId = Number(params.get('hillside')) || null
  const [selection, setSelection] = useState<number | null>(requestedId)
  const [selectedTerraceId, setSelectedTerraceId] = useState<number | null>(null)
  const [layers, setLayers] = useState<Record<MapLayer, boolean>>({ terrain: true, risk: true, ndvi: false, alerts: true, weather: false })

  const hills = hillsides.data || []
  const locations = hills.filter((hillside) => hillside.latitude && hillside.longitude)
  const selectedHillsideId = hills.some((item) => item.id === selection)
    ? selection
    : hills.some((item) => item.id === requestedId)
      ? requestedId
      : locations[0]?.id ?? null
  const selectedHillside = hills.find((hillside) => hillside.id === selectedHillsideId)
  const terraces = useResource(`map-terraces:${selectedHillsideId}`, () => selectedHillsideId ? api.terraces(selectedHillsideId) : Promise.resolve([]))
  const alerts = useResource(`map-alerts:${selectedHillsideId}`, () => selectedHillsideId ? api.alerts(selectedHillsideId) : Promise.resolve([]))
  const readings = useResource(`map-readings:${selectedHillsideId}`, () => selectedHillsideId ? api.ndvi(selectedHillsideId) : Promise.resolve([]))

  const activeTerrace = terraces.data?.find((terrace) => terrace.id === selectedTerraceId)
  const activeAlert = activeTerrace ? (alerts.data || []).find((alert) => alert.terrace === activeTerrace.id && alert.status !== 'dismissed') : null
  const activeReading = activeTerrace ? (readings.data || []).find((reading) => reading.terrace === activeTerrace.id) : null
  const center = selectedHillside?.latitude && selectedHillside.longitude
    ? [Number(selectedHillside.latitude), Number(selectedHillside.longitude)] as [number, number]
    : locations[0]?.latitude && locations[0].longitude
      ? [Number(locations[0].latitude), Number(locations[0].longitude)] as [number, number]
      : null

  function selectHillside(id: number) {
    setSelection(id)
    setSelectedTerraceId(null)
    setParams({ hillside: String(id) }, { replace: true })
  }

  function toggleLayer(layer: MapLayer) {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }))
  }

  return <div className="page-stack map-page"><PageHeading eyebrow="REAL LOCATION DATA ONLY" title="Pilot map" description="Map markers use coordinates and terrace boundaries returned by the backend." action={
    <label className="select-field map-hillside-select"><span>Hillside</span><select value={selectedHillsideId || ''} onChange={(event) => selectHillside(Number(event.target.value))}><option value="" disabled>Select hillside</option>{hills.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
  } />
    {hillsides.error && <ErrorState message={hillsides.error} retry={hillsides.reload} />}
    {!hillsides.loading && locations.length === 0 && <EmptyState title="No hillside coordinates available" detail="The backend has no latitude/longitude for the returned hillsides. The map will not invent positions." action={<Link className="button button-outline" to="/farm">Review hillside records</Link>} />}
    {center && <div className="map-workspace">
      <aside className="surface map-sidebar"><p className="eyebrow">LAYERS</p><div className="layer-controls">{([
        ['terrain', 'Terrain', 'Observed terrace shapes'], ['risk', 'Risk', 'Alert-backed indicators'], ['ndvi', 'NDVI', 'Latest readings'], ['alerts', 'Alerts', 'Active alert points'], ['weather', 'Weather', 'Forecast availability'],
      ] as [MapLayer, string, string][]).map(([id, label, description]) => <label className="layer-option" key={id}><input type="checkbox" checked={layers[id]} onChange={() => toggleLayer(id)} /><span className={`layer-swatch swatch-${id}`} /><span><strong>{label}</strong><small>{description}</small></span></label>)}</div>
        <div className="map-legend"><p className="eyebrow">INDICATORS</p><RiskBadge level="green" label="No active alert" /><RiskBadge level="orange" label="Pending review" /><RiskBadge level="yellow" label="Confirmed · verify in field" /></div>
        <div className="map-place-list"><p className="eyebrow">HILLSIDES WITH COORDINATES</p>{locations.map((item) => <button type="button" key={item.id} className={`place-row ${selectedHillsideId === item.id ? 'selected' : ''}`} onClick={() => selectHillside(item.id)}><MapPin size={16} /><span><strong>{item.name}</strong><small>{[item.sector, item.district].filter(Boolean).join(', ') || 'Location provided'}</small></span></button>)}</div>
      </aside>
      <div className="map-canvas-wrap">
        <MapContainer center={center} zoom={13} scrollWheelZoom className="map-canvas">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {locations.map((item) => <CircleMarker key={`hill-${item.id}`} center={[Number(item.latitude), Number(item.longitude)]} radius={8} pathOptions={{ color: '#244b35', fillColor: '#79a581', fillOpacity: 0.92, weight: 2 }} eventHandlers={{ click: () => selectHillside(item.id) }}><Popup><strong>{item.name}</strong><br />{[item.sector, item.district].filter(Boolean).join(', ') || 'Location provided'}</Popup></CircleMarker>)}
          {layers.terrain && (terraces.data || []).filter((terrace) => terrace.boundary_geojson).map((terrace) => <GeoJSON key={`boundary-${terrace.id}`} data={terrace.boundary_geojson as unknown as GeoJsonObject} style={{ color: alertColor(alerts.data?.find((alert) => alert.terrace === terrace.id)), fillOpacity: 0.16, weight: 2 }} eventHandlers={{ click: () => setSelectedTerraceId(terrace.id) }} />)}
          {(terraces.data || []).map((terrace) => {
            const alert = (alerts.data || []).find((item) => item.terrace === terrace.id && item.status !== 'dismissed')
            const centerOfBoundary = getBoundaryCenter(terrace)
            if (!centerOfBoundary) return null
            const color = layers.risk ? alertColor(alert) : '#427c59'
            return <CircleMarker key={`terrace-${terrace.id}`} center={centerOfBoundary} radius={layers.ndvi ? 9 : 7} pathOptions={{ color, fillColor: color, fillOpacity: 0.84, weight: 2 }} eventHandlers={{ click: () => setSelectedTerraceId(terrace.id) }}><Popup><strong>{terrace.identifier} · {terrace.name}</strong><br />{terrace.zone || 'Zone unavailable'} zone<br />{alert ? alert.notification_title : 'No active alert'}</Popup></CircleMarker>
          })}
        </MapContainer>
        <div className="map-key"><span><i className="map-key-dot hillside-dot" />Hillside</span><span><i className="map-key-dot terrace-dot" />Terrace</span>{layers.weather && <span><CloudSun size={13} /> Weather is shown in hillside details</span>}</div>
        {activeTerrace && <div className="map-feature-card"><button className="icon-button map-card-close" type="button" onClick={() => setSelectedTerraceId(null)} aria-label="Close terrace summary">×</button><p className="eyebrow">SELECTED TERRACE</p><h3>{activeTerrace.identifier} · {activeTerrace.name}</h3><p>{selectedHillside?.name} · {activeTerrace.zone || 'Zone unavailable'} zone</p><div className="map-feature-facts"><span>Slope<strong>{activeTerrace.slope_degrees ? `${activeTerrace.slope_degrees}°` : 'Unavailable'}</strong></span><span>Flow<strong>{activeTerrace.flow_accumulation || 'Unavailable'}</strong></span><span>NDVI<strong>{activeReading?.mean_ndvi || 'Unavailable'}</strong></span></div><RiskBadge level={activeAlert ? activeAlert.status === 'pending' ? 'orange' : 'yellow' : 'muted'} label={activeAlert ? activeAlert.status === 'pending' ? 'Candidate condition · pending review' : 'Confirmed alert · verify in field' : 'No active alert returned'} />{activeAlert && <p className="map-feature-evidence">{activeAlert.message}</p>}<Link className="text-link" to={`/farm?hillside=${selectedHillsideId}&terrace=${activeTerrace.id}`}>View hillside details <ArrowRight size={14} /></Link></div>}
      </div>
    </div>}
    <p className="map-note">Basemap © OpenStreetMap contributors. Only backend-supplied hillside coordinates and terrace polygons are drawn.</p>
  </div>
}

function getBoundaryCenter(terrace: Terrace): [number, number] | null {
  const positions = terrace.boundary_geojson?.coordinates?.[0]
  if (!positions?.length) return null
  const points = positions.slice(0, -1)
  if (!points.length) return null
  const longitude = points.reduce((sum, point) => sum + point[0], 0) / points.length
  const latitude = points.reduce((sum, point) => sum + point[1], 0) / points.length
  return [latitude, longitude]
}

function alertColor(alert?: AlertRecord) {
  if (!alert) return '#568564'
  return alert.status === 'pending' ? '#d18a32' : '#9c743e'
}

export function ScannerPage() {
  const auth = useAuth()
  const hillsides = useResource('scanner-hillsides', () => api.hillsides())
  const [terraceId, setTerraceId] = useState<number | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<PhotoClassification | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const cameraInput = useRef<HTMLInputElement>(null)
  const uploadInput = useRef<HTMLInputElement>(null)
  const terraces = useResource(`scanner-terraces:${terraceId}`, () => terraceId ? api.terraces(terraceId) : Promise.resolve([]))
  const [hillsideId, setHillsideId] = useState<number | null>(null)

  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview)
  }, [preview])

  function chooseFile(next: File | undefined) {
    if (!next) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(next)
    setPreview(URL.createObjectURL(next))
    setResult(null)
    setError(null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!auth.token) { setError('Connect an API token before submitting a photo.'); return }
    if (!file || !terraceId) { setError('Choose a photo and terrace first.'); return }
    setWorking(true)
    setError(null)
    setResult(null)
    try {
      setResult(await api.classifyPhoto(file, terraceId))
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 503 ? reason.message : reason instanceof Error ? reason.message : 'The photo could not be classified.')
    } finally { setWorking(false) }
  }

  async function copySummary() {
    if (!result) return
    const text = `Leaf photo assessment ${result.photo_assessment_id}: ${result.classification_label}, ${Math.round(Number(result.confidence) * 100)}% confidence, terrace ${terraceId}. Status: ${result.outcome}. Please review in the extension-worker workflow.`
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 2000) }
    catch { setError('Clipboard access is unavailable. You can share the assessment ID with an extension worker.') }
  }

  const selectedHillside = hillsides.data?.find((item) => item.id === hillsideId)
  const reviewNeeded = result?.outcome === 'need_another_photo'

  return <div className="page-stack"><PageHeading eyebrow="AUTHENTICATED PHOTO ASSESSMENT" title="Crop health scanner" description="Model output is advisory. It is not a confirmed disease diagnosis." />
    {!auth.token && <div className="notice-line"><ShieldAlert size={17} /><span>Connect a token to upload. The server requires an authenticated account.</span><Link className="text-link" to="/profile">Connect <ArrowRight size={14} /></Link></div>}
    {hillsides.error && <ErrorState message={hillsides.error} retry={hillsides.reload} />}
    <div className="scanner-layout"><form className="surface scanner-form" onSubmit={submit}>
      <div className="surface-heading"><div><p className="eyebrow">PHOTO INTAKE</p><h2>Capture a clear leaf image</h2></div><Leaf size={23} /></div>
      <label className="select-field"><span>Hillside</span><select value={hillsideId || ''} onChange={(event) => { const id = Number(event.target.value); setHillsideId(id); setTerraceId(null) }} required><option value="" disabled>Select hillside</option>{(hillsides.data || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="select-field"><span>Terrace</span><select value={terraceId || ''} onChange={(event) => setTerraceId(Number(event.target.value))} required disabled={!hillsideId}><option value="" disabled>Select terrace</option>{(terraces.data || []).map((item) => <option key={item.id} value={item.id}>{item.identifier} · {item.name}</option>)}</select></label>
      <input ref={cameraInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => chooseFile(event.target.files?.[0])} />
      <input ref={uploadInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(event.target.files?.[0])} />
      <div className="scanner-actions"><button className="button button-primary" type="button" onClick={() => cameraInput.current?.click()}><Leaf size={16} />Use camera</button><button className="button button-outline" type="button" onClick={() => uploadInput.current?.click()}><Upload size={16} />Choose image</button></div>
      <p className="form-help">JPEG, PNG, or WebP · 5 MiB maximum · use a well-lit, focused leaf photo.</p>
      {file && <div className="selected-file"><CheckCircle2 size={16} /><span>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(2)} MiB</small></div>}
      {error && <ErrorState message={error} />}
      <button className="button button-primary scanner-submit" type="submit" disabled={!auth.token || !file || !terraceId || working}>{working ? <><LoaderCircle className="spin" size={16} />Uploading and classifying…</> : <>Submit for assessment <ArrowRight size={16} /></>}</button>
      {working && <div className="upload-progress" role="progressbar" aria-label="Uploading photo"><span /></div>}
    </form>
    <aside className="scanner-preview surface"><p className="eyebrow">ASSESSMENT</p>{preview ? <img className="photo-preview" src={preview} alt="Selected leaf for classification" /> : <div className="photo-empty"><Leaf size={35} strokeWidth={1.4} /><span>Photo preview</span><small>No image selected</small></div>}
      {result ? <div className={`result-panel ${reviewNeeded ? 'result-caution' : ''}`}><div className="row-between"><span className="eyebrow">MODEL CLASSIFICATION</span><span className="confidence-chip">{Math.round(Number(result.confidence) * 100)}%</span></div><h2>{reviewNeeded ? 'Another photo is recommended' : result.is_disease ? 'Possible disease' : 'No disease alert from this photo'}</h2><p><strong>{titleCase(result.classification_label.replaceAll('_', ' '))}</strong> · {result.classifier_mode === 'model' ? 'ONNX model' : 'Safe stub'} · {selectedHillside?.name || 'Hillside'} · {new Date().toLocaleDateString('en')}</p>{reviewNeeded && <div className="notice-line"><ShieldAlert size={16} /><span>Confidence is below the configured review threshold. A clearer photo may help; this result needs field review.</span></div>}{result.classifier_mode === 'stub' && <p className="muted">No trained model artifact is configured. This is the backend's safe placeholder result.</p>}{result.alert_id && <Link className="button button-outline" to={`/alerts?selected=${result.alert_id}`}>View linked alert <ArrowRight size={15} /></Link>}<div className="button-row"><button className="button button-outline" type="button" onClick={() => { setFile(null); setResult(null); setPreview(null) }}>Take another photo</button><button className="button button-primary" type="button" onClick={copySummary}><Copy size={15} />{copied ? 'Copied' : 'Copy review summary'}</button></div><small>Assessment ID {result.photo_assessment_id}. Share this with an extension worker; direct review requests are not available in the API.</small></div> : <div className="scanner-guidance"><div><CheckCircle2 size={16} /><span>Keep the whole leaf in frame.</span></div><div><CheckCircle2 size={16} /><span>Use daylight and avoid blur.</span></div><div><CheckCircle2 size={16} /><span>Model output is not a diagnosis.</span></div></div>}
    </aside></div>
  </div>
}

interface ChatMessage { role: 'user' | 'assistant'; content: string; source?: AssistantResponse['source']; reviewStatus?: AssistantResponse['review_status'] }

export function AssistantPage() {
  const auth = useAuth()
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const conversationEnd = useRef<HTMLDivElement>(null)

  useEffect(() => { conversationEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, working])

  async function sendQuestion(event: FormEvent) {
    event.preventDefault()
    const text = question.trim()
    if (!text || !auth.token || working) return
    setQuestion('')
    setError(null)
    setMessages((items) => [...items, { role: 'user', content: text }])
    setWorking(true)
    try {
      const answer = await api.askAssistant(text)
      setMessages((items) => [...items, { role: 'assistant', content: answer.answer, source: answer.source, reviewStatus: answer.review_status }])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The assistant could not answer right now.')
    } finally { setWorking(false) }
  }

  return <div className="page-stack assistant-page"><PageHeading eyebrow="KNOWLEDGE-BASE FIRST" title="Umusaruro Assistant" description="Answers from approved guidance are preferred; Groq fallback replies remain unreviewed until a trainer approves them." />
    {!auth.token && <div className="notice-line"><ShieldAlert size={17} /><span>Connect an API token to ask a question.</span><Link className="text-link" to="/profile">Connect account <ArrowRight size={14} /></Link></div>}
    <section className="assistant-window surface"><div className="assistant-header"><span className="assistant-avatar"><Bot size={19} /></span><div><strong>Field support assistant</strong><small>Scoped to Umusaruro-Smart agriculture workflows</small></div><span className="assistant-indicator"><span className="status-light online" />Ready</span></div>
      <div className="chat-history" aria-live="polite">{messages.length === 0 && <div className="assistant-welcome"><span className="welcome-spark"><Sparkles size={19} /></span><h2>What would you like to check?</h2><p>Ask about terrace conditions, NDVI, alerts, or field observation steps.</p><div className="suggestion-chips">{['How should I assess waterlogging?', 'What does an NDVI change mean?', 'What should I include in a leaf photo?'].map((sample) => <button key={sample} type="button" disabled={!auth.token} onClick={() => setQuestion(sample)}>{sample}</button>)}</div></div>}
        {messages.map((message, index) => <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><span className="chat-avatar">{message.role === 'user' ? <UserRound size={15} /> : <Bot size={15} />}</span><div className="chat-bubble"><p>{message.content}</p>{message.role === 'assistant' && message.source && <div className="source-row"><span className={`source-pill source-${message.source}`}>{message.source === 'knowledge_base' ? <><CheckCircle2 size={13} />Approved knowledge base</> : <><Sparkles size={13} />Groq · not trainer-approved</>}</span>{message.reviewStatus && <span className="muted">{titleCase(message.reviewStatus)}</span>}</div>}</div></article>)}
        {working && <div className="chat-message assistant"><span className="chat-avatar"><Bot size={15} /></span><div className="chat-bubble"><LoadingState label="Checking approved guidance" /></div></div>}
        {error && <ErrorState message={error} />}
        <div ref={conversationEnd} />
      </div>
      <form className="chat-composer" onSubmit={sendQuestion}><label className="visually-hidden" htmlFor="assistant-question">Ask the assistant</label><textarea id="assistant-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={auth.token ? 'Ask a field-work question…' : 'Connect to ask a question'} maxLength={1000} rows={1} disabled={!auth.token || working} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} /><button className="button button-primary" type="submit" aria-label="Send question" disabled={!auth.token || !question.trim() || working}><Send size={17} /></button></form>
      <p className="assistant-disclaimer">Do not include farmer-identifying information. Groq fallback responses are drafts for trainer review, not official agronomic advice.</p>
    </section>
  </div>
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase())
}
