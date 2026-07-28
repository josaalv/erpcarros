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
// Taller y Consignación desactivadas (ver Layout.tsx) — los archivos
// siguen en src/screens/, solo se quitó la ruta y el import.
import Comisionista from './screens/Comisionista'
import Ventas from './screens/Ventas'
import Calculadora from './screens/Calculadora'
import MiCuenta from './screens/MiCuenta'

function Protegido({ children }: { children: React.ReactNode }) {
  const { session, cargando } = useAuth()
  if (cargando) return <div style={{ padding: 40 }}>Cargando…</div>
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Rutas() {
  const { session, passwordRecovery } = useAuth()

  // Un enlace de "olvidé mi contraseña" deja una sesión válida y un
  // fragmento #access_token=...&type=recovery en la URL. Con HashRouter ese
  // fragmento no coincide con ninguna ruta definida, así que se revisa
  // passwordRecovery ANTES de intentar hacer match de rutas — si no, la
  // pantalla de "pon tu nueva contraseña" nunca llegaría a montarse.
  if (passwordRecovery) return <Login />

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
        <Route path="socios" element={<Socios />} />
        <Route path="ventas" element={<Ventas />} />
        <Route path="calculadora" element={<Calculadora />} />
        <Route path="comisionista" element={<Comisionista />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="mi-cuenta" element={<MiCuenta />} />
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
