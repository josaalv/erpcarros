import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Login from './screens/Login'
import Layout from './screens/Layout'
import Panel from './screens/Panel'
import Inventario from './screens/Inventario'
import VehiculoNuevo from './screens/VehiculoNuevo'
import Expediente from './screens/Expediente'
import Usuarios from './screens/Usuarios'
import EnProceso from './screens/EnProceso'
import EnVenta from './screens/EnVenta'
import Socios from './screens/Socios'
import Taller from './screens/Taller'
import Consignacion from './screens/Consignacion'
import Comisionista from './screens/Comisionista'
import Ventas from './screens/Ventas'
import Calculadora from './screens/Calculadora'

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
        <Route path="en-proceso" element={<EnProceso />} />
        <Route path="en-venta" element={<EnVenta />} />
        <Route path="taller" element={<Taller />} />
        <Route path="consignacion" element={<Consignacion />} />
        <Route path="socios" element={<Socios />} />
        <Route path="ventas" element={<Ventas />} />
        <Route path="calculadora" element={<Calculadora />} />
        <Route path="comisionista" element={<Comisionista />} />
        <Route path="usuarios" element={<Usuarios />} />
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
