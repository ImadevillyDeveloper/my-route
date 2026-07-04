import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'

import Login from './pages/Login'
import DriverLayout from './components/driver/Layout'
import EntrepreneurLayout from './components/entrepreneur/Layout'

// Driver pages
import DriverMap          from './pages/driver/Map'
import DriverProfile      from './pages/driver/Profile'
import DriverReport       from './pages/driver/Report'
import DriverReportDetail from './pages/driver/ReportDetail'
import DriverShifts       from './pages/driver/Shifts'
import DriverSettings     from './pages/driver/Settings'
import DriverChat         from './pages/driver/Chat'

// Entrepreneur pages
import EntMap        from './pages/entrepreneur/Map'
import EntProfile    from './pages/entrepreneur/Profile'
import EntVehicles   from './pages/entrepreneur/Vehicles'
import EntVehicleDetail from './pages/entrepreneur/VehicleDetail'
import EntVehicleAdd from './pages/entrepreneur/VehicleAdd'
import EntVehicleReminders from './pages/entrepreneur/VehicleReminders'
import EntDrivers    from './pages/entrepreneur/Drivers'
import EntDriverDetail from './pages/entrepreneur/DriverDetail'
import EntDriverAdd  from './pages/entrepreneur/DriverAdd'
import EntRoutes     from './pages/entrepreneur/Routes'
import EntRouteDetail from './pages/entrepreneur/RouteDetail'
import EntRouteAdd   from './pages/entrepreneur/RouteAdd'
import EntReports    from './pages/entrepreneur/Reports'
import EntReportDetail from './pages/entrepreneur/ReportDetail'
import EntSettings   from './pages/entrepreneur/Settings'
import EntChat       from './pages/entrepreneur/Chat'

function ProtectedDriver({ children }: { children: React.ReactNode }) {
  const { token, role } = useAuthStore()
  if (!token) return <Navigate to="/" replace />
  if (role !== 'driver') return <Navigate to="/entrepreneur/map" replace />
  return <>{children}</>
}
function ProtectedEntrepreneur({ children }: { children: React.ReactNode }) {
  const { token, role } = useAuthStore()
  if (!token) return <Navigate to="/" replace />
  if (role !== 'entrepreneur') return <Navigate to="/driver/map" replace />
  return <>{children}</>
}
function RootRedirect() {
  const { token, role } = useAuthStore()
  if (!token) return <Login />
  if (role === 'driver') return <Navigate to="/driver/map" replace />
  return <Navigate to="/entrepreneur/map" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />

        <Route path="/driver" element={<ProtectedDriver><DriverLayout /></ProtectedDriver>}>
          <Route index element={<Navigate to="map" replace />} />
          <Route path="map"           element={<DriverMap />} />
          <Route path="profile"       element={<DriverProfile />} />
          <Route path="report"        element={<DriverReport />} />
          <Route path="report/:id"    element={<DriverReportDetail />} />
          <Route path="shifts"        element={<DriverShifts />} />
          <Route path="settings"      element={<DriverSettings />} />
          <Route path="chat"          element={<DriverChat />} />
        </Route>

        <Route path="/entrepreneur" element={<ProtectedEntrepreneur><EntrepreneurLayout /></ProtectedEntrepreneur>}>
          <Route index element={<Navigate to="map" replace />} />
          <Route path="map"             element={<EntMap />} />
          <Route path="profile"         element={<EntProfile />} />
          <Route path="vehicles"        element={<EntVehicles />} />
          <Route path="vehicles/add"              element={<EntVehicleAdd />} />
          <Route path="vehicles/:id"            element={<EntVehicleDetail />} />
          <Route path="vehicles/:id/reminders"  element={<EntVehicleReminders />} />
          <Route path="drivers"         element={<EntDrivers />} />
          <Route path="drivers/add"     element={<EntDriverAdd />} />
          <Route path="drivers/:id"     element={<EntDriverDetail />} />
          <Route path="routes"          element={<EntRoutes />} />
          <Route path="routes/add"      element={<EntRouteAdd />} />
          <Route path="routes/:id"      element={<EntRouteDetail />} />
          <Route path="reports"         element={<EntReports />} />
          <Route path="reports/:id"     element={<EntReportDetail />} />
          <Route path="settings"        element={<EntSettings />} />
          <Route path="chat"            element={<EntChat />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
