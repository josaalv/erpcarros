import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Login from './screens/Login'
import Layout from './screens/Layout'
import Panel from './screens/Panel'
import Inventario from './screens/Inventario'
import VehiculoNuevo from './screens/VehiculoNuevo'
import Expediente from './screens/Expediente'
import Configuracion from './screens/Configuracion'
import EnProceso from './screens/EnProceso'
import EnVenta from './screens/EnVenta'
import Vendidos from './screens/Vendidos'
import Socios from './screens/Socios'
import Resultados from './screens/Resultados'
import PorCobrar from './screens/PorCobrar'
import PorPagar from './screens/PorPagar'
// Taller y Consignación desactivadas (ver Layout.tsx) — los archivos
// siguen en src/screens/, solo se quitó la ruta y el import.
import Comisionista from './screens/Comisionista'
import Ventas from './screens/Ventas'
// Calculadora desactivada: PosiblesOfertas.tsx la reemplaza con el flujo
// completo (subasta → evaluación → adquirir). El archivo sigue en
// src/screens/ sin tocar.
import MiCuenta from './screens/MiCuenta'
import PosiblesOfertas from './screens/PosiblesOfertas'

function Protegido({ children }: { children: React.ReactNode }) {
  const { session, perfil, cargando, signOut } = useAuth()
  if (cargando) return <div className="cargando">Cargando…</div>
  if (!session) return <Navigate to="/login" replace />
  if (!perfil || !perfil.activo) {
    return (
      <div className="login-pagina">
        <div className="login-tarjeta">
          <h1 style={{ fontSize: 22, marginBottom: 10 }}>Cuenta sin acceso</h1>
          <p className="texto-suave">
            {perfil ? 'Tu cuenta está desactivada.' : 'Tu cuenta no tiene un perfil asignado.'} Pídele a un
            administrador que la active.
          </p>
          <button className="btn btn-secundario" onClick={() => signOut()}>Cerrar sesión</button>
        </div>
      </div>
    )
  }
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
        <Route path="vendidos" element={<Vendidos />} />
        <Route path="socios" element={<Socios />} />
        <Route path="resultados" element={<Resultados />} />
        <Route path="por-cobrar" element={<PorCobrar />} />
        <Route path="por-pagar" element={<PorPagar />} />
        <Route path="ventas" element={<Ventas />} />
        <Route path="posibles-ofertas" element={<PosiblesOfertas />} />
        <Route path="comisionista" element={<Comisionista />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="usuarios" element={<Navigate to="/configuracion?tab=usuarios" replace />} />
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
