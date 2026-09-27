import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AppShell } from './components/AppShell'
import { LoadingState } from './components/ui'
import './App.css'

const OverviewPage = lazy(() => import('./pages').then((module) => ({ default: module.OverviewPage })))
const FarmPage = lazy(() => import('./pages').then((module) => ({ default: module.FarmPage })))
const NdviPage = lazy(() => import('./pages').then((module) => ({ default: module.NdviPage })))
const AlertsPage = lazy(() => import('./pages').then((module) => ({ default: module.AlertsPage })))
const ExtensionDashboardPage = lazy(() => import('./pages').then((module) => ({ default: module.ExtensionDashboardPage })))
const NotificationsPage = lazy(() => import('./pages').then((module) => ({ default: module.NotificationsPage })))
const WeatherPage = lazy(() => import('./pages').then((module) => ({ default: module.WeatherPage })))
const AdvisoriesPage = lazy(() => import('./pages').then((module) => ({ default: module.AdvisoriesPage })))
const ProfilePage = lazy(() => import('./pages').then((module) => ({ default: module.ProfilePage })))
const MapPage = lazy(() => import('./pages/ToolsPages').then((module) => ({ default: module.MapPage })))
const ScannerPage = lazy(() => import('./pages/ToolsPages').then((module) => ({ default: module.ScannerPage })))
const AssistantPage = lazy(() => import('./pages/ToolsPages').then((module) => ({ default: module.AssistantPage })))

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<div className="route-loading"><LoadingState label="Opening workspace" /></div>}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<OverviewPage />} />
            <Route path="farm" element={<FarmPage />} />
            <Route path="map" element={<MapPage />} />
            <Route path="ndvi" element={<NdviPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="extension" element={<ExtensionDashboardPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="weather" element={<WeatherPage />} />
            <Route path="advisories" element={<AdvisoriesPage />} />
            <Route path="scanner" element={<ScannerPage />} />
            <Route path="assistant" element={<AssistantPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<OverviewPage />} />
          </Route>
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
