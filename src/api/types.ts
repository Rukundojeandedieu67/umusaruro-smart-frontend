export interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Hillside {
  id: number
  name: string
  district: string
  sector: string
  latitude: string | null
  longitude: string | null
  description: string
  created_at: string
}

export interface Terrace {
  id: number
  hillside: number
  hillside_name: string
  identifier: string
  name: string
  boundary_geojson: GeoJSONPolygon | null
  zone: 'top' | 'middle' | 'bottom' | ''
  slope_degrees: string | null
  flow_accumulation: string | null
  created_at: string
}

export interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

export interface NdviReading {
  id: number
  terrace: number
  terrace_identifier: string
  hillside_id: number
  hillside_name: string
  observed_on: string
  mean_ndvi: string
  source: string
  created_at: string
}

export type AlertStatus = 'pending' | 'confirmed' | 'dismissed'

export interface AlertRecord {
  id: number
  terrace: number
  terrace_identifier: string
  hillside_id: number
  hillside_name: string
  source: 'terrain_model' | 'ndvi_anomaly' | 'leaf_classifier'
  alert_type:
    | 'runoff_erosion'
    | 'nutrient_leaching'
    | 'moisture_accumulation'
    | 'waterlogging'
    | 'vegetation_stress'
    | 'leaf_disease'
    | 'other'
  message: string
  notification_title: string
  recommended_action: string
  confidence: string | null
  observation_date: string | null
  status: AlertStatus
  created_at: string
  updated_at: string
  reviewed_at: string | null
  reviewed_by_username: string | null
}

export type NotificationRecord = AlertRecord

export interface FarmAdvisory {
  id: number
  hillside: number | null
  hillside_name: string | null
  crop: string
  title: string
  message: string
  status: 'draft' | 'published' | 'withdrawn'
  valid_until: string | null
  created_by: number | null
  published_by: number | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface WeatherDay {
  date: string
  weather_code: number | null
  weather: string
  temperature_max_c: number | null
  temperature_min_c: number | null
  precipitation_probability_pct: number | null
  precipitation_mm: number | null
}

export interface WeatherForecast {
  hillside_id: number
  hillside_name: string
  latitude: string
  longitude: string
  provider: string
  provider_url: string
  timezone: string | null
  retrieved_at: string
  is_stale: boolean
  current: {
    time: string | null
    temperature_c: number | null
    relative_humidity_pct: number | null
    precipitation_mm: number | null
    wind_speed_kmh: number | null
    weather_code: number | null
    weather: string
  }
  daily: WeatherDay[]
  weather_advice: string
  advice_note: string
  published_advisories: FarmAdvisory[]
}

export interface PhotoClassification {
  outcome: 'need_another_photo' | 'alert_created' | 'no_disease_alert'
  photo_assessment_id: number
  alert_id: number | null
  classification_label: string
  is_disease: boolean
  confidence: string
  classifier_mode: 'stub' | 'model'
}

export interface AssistantResponse {
  answer: string
  source: 'knowledge_base' | 'groq'
  knowledge_id: number
  review_status: 'unreviewed' | 'approved' | 'rejected'
  similarity: number | null
}

export interface CachedResponse<T> {
  data: T
  stale: boolean
  cachedAt: number | null
}