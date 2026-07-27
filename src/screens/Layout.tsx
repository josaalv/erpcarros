import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ROL_LABEL } from '../lib/helpers'

const NAV = [
  { to: '/', label: 'Panel', fin: false },
  { to: '/inventario', label: 'Inventario', fin: false },
]

export default function Layout() {
  const { perfil, signOut } = useAuth()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '"IBM Plex Sans", system-ui, sans-serif' }}>
      <aside style={{ width: 220, background: '#1c231f', color: '#f3f1ec', padding: '18px 14px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ font: '600 10px/1 "IBM Plex Mono", monospace', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(0.7 0.1 190)', marginBottom: 20 }}>
          ERP Vehículos
        </div>

        {perfil?.rol === 'demo' && (
          <div style={{ background: 'oklch(0.55 0.13 85)', color: '#2a2410', fontSize: 10.5, fontWeight: 600, padding: '5px 8px', marginBottom: 14, textAlign: 'center' }}>
            MODO DEMOSTRACIÓN
          </div>
        )}

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => ({
                padding: '8px 10px', fontSize: 12.5, textDecoration: 'none',
                color: isActive ? '#f3f1ec' : 'rgba(243,241,236,0.62)',
                background: isActive ? 'rgba(255,255,255,0.09)' : 'transparent',
                fontWeight: isActive ? 500 : 400,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 12, marginTop: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{perfil?.nombre}</div>
          <div style={{ fontSize: 11, color: 'rgba(243,241,236,0.55)', marginBottom: 8 }}>
            {perfil ? ROL_LABEL[perfil.rol] : ''}
          </div>
          <button
            onClick={() => signOut()}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#f3f1ec', fontSize: 11.5, padding: '5px 9px', cursor: 'pointer' }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, background: '#faf9f6', padding: '24px 32px', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
