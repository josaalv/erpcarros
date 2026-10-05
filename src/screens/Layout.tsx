import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ROL_LABEL } from '../lib/helpers'
import { useParametros } from '../lib/parametros'
import type { Rol } from '../types'

interface ItemNav { to: string; label: string; roles?: Rol[] }
interface GrupoNav { titulo?: string; items: ItemNav[] }

const ADMIN: Rol[] = ['admin']
const ADMIN_GERENCIA: Rol[] = ['admin', 'gerencia']

// Taller y Consignación están desactivadas a propósito (ver CLAUDE.md); los
// archivos siguen en src/screens/. Posibles ofertas va justo debajo de Panel
// porque es la entrada al ciclo.
const GRUPOS: GrupoNav[] = [
  { items: [{ to: '/', label: 'Panel' }] },
  {
    titulo: 'Ciclo del vehículo',
    items: [
      { to: '/posibles-ofertas', label: 'Posibles ofertas', roles: ADMIN },
      { to: '/inventario', label: 'Inventario' },
      { to: '/en-proceso', label: 'En proceso', roles: ADMIN_GERENCIA },
      { to: '/en-venta', label: 'En venta', roles: ADMIN_GERENCIA },
      { to: '/ventas', label: 'Ventas', roles: ADMIN_GERENCIA },
      { to: '/vendidos', label: 'Vendidos', roles: ADMIN_GERENCIA },
    ],
  },
  {
    titulo: 'Dinero',
    items: [
      { to: '/por-cobrar', label: 'Por cobrar', roles: ADMIN_GERENCIA },
      { to: '/por-pagar', label: 'Por pagar', roles: ADMIN },
      { to: '/resultados', label: 'Resultados', roles: ADMIN },
      { to: '/socios', label: 'Socios', roles: ADMIN },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { to: '/configuracion', label: 'Configuración', roles: ADMIN },
    ],
  },
  { items: [{ to: '/comisionista', label: 'Mi portal', roles: ['comisionista'] }] },
]

export default function Layout() {
  const { perfil, signOut } = useAuth()
  const { empresa_nombre } = useParametros()
  const location = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [rutaMenu, setRutaMenu] = useState(location.pathname)

  if (rutaMenu !== location.pathname) {
    setRutaMenu(location.pathname)
    setMenuAbierto(false)
  }

  const rol = perfil?.rol
  const grupos = GRUPOS
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || (rol && i.roles.includes(rol))) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="app">
      <header className="topbar">
        <strong>{empresa_nombre}</strong>
        <button onClick={() => setMenuAbierto(true)}>Menú</button>
      </header>

      <aside className={`sidebar${menuAbierto ? ' abierto' : ''}`}>
        <div className="sidebar-marca" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{empresa_nombre.charAt(0).toUpperCase()}</span> {empresa_nombre}
          </div>
          {menuAbierto && (
            <button className="btn btn-chico" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }} onClick={() => setMenuAbierto(false)}>
              Cerrar
            </button>
          )}
        </div>

        {rol === 'demo' && <div className="demo-banner">MODO DEMOSTRACIÓN</div>}

        <nav className="nav">
          {grupos.map((g, i) => (
            <div key={g.titulo ?? i}>
              {g.titulo && <div className="nav-grupo">{g.titulo}</div>}
              {g.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-usuario">
          <NavLink to="/mi-cuenta">{perfil?.nombre}</NavLink>
          <small>{perfil ? ROL_LABEL[perfil.rol] : ''} · Mi cuenta</small>
          <button
            className="btn btn-chico"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
            onClick={() => signOut()}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="contenido">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
