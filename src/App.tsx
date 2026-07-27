import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Login from './screens/Login'
import Layout from './screens/Layout'
import Panel from './screens/Panel'
import Inventario from './screens/Inventario'
import VehiculoNuevo from './screens/VehiculoNuevo'
import Expediente from './screens/Expediente'

function Protegido({ children }: { children: React.ReactNode }) {
  const { session, cargando } = useAuth()
  if (cargando) return <div style={{ padding: 40 }}>Cargando…</div>
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Rutas() {
  const { session } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <Protegido>
            <Layout />
          </Protegido>
        }
      >
        <Route index element={<Panel />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="vehiculo/nuevo" element={<VehiculoNuevo />} />
        <Route path="vehiculo/:id" element={<Expediente />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Rutas />
      </HashRouter>
    </AuthProvider>
  )
}
