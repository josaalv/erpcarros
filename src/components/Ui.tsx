import type { ReactNode } from 'react'

export function Modal({ children, onClose, ancho = 340 }: { children: ReactNode; onClose: () => void; ancho?: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', padding: 22, width: ancho, maxHeight: '85vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

export function FormBotones({ onClose, guardando, textoGuardar = 'Guardar' }: { onClose: () => void; guardando: boolean; textoGuardar?: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
      <button type="button" onClick={onClose} style={{ flex: 1, padding: 10, background: '#f4f1ea', border: 'none', cursor: 'pointer' }}>Cancelar</button>
      <button type="submit" disabled={guardando} style={{ flex: 1, padding: 10, background: '#26302f', color: '#f3f1ec', border: 'none', cursor: 'pointer' }}>
        {guardando ? 'Guardando…' : textoGuardar}
      </button>
    </div>
  )
}
