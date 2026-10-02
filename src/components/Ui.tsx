import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Etiqueta, Tono } from '../lib/helpers'

export function Modal({ titulo, subtitulo, children, onClose, ancho = 460 }: {
  titulo: string
  subtitulo?: ReactNode
  children: ReactNode
  onClose: () => void
  ancho?: number
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-fondo" onMouseDown={onClose}>
      <div className="modal" style={{ maxWidth: ancho }} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={titulo}>
        <h3>{titulo}</h3>
        {subtitulo ? <p className="modal-sub">{subtitulo}</p> : <div style={{ height: 14 }} />}
        {children}
      </div>
    </div>
  )
}

export function FormBotones({ onClose, guardando, textoGuardar = 'Guardar', deshabilitado = false }: {
  onClose: () => void
  guardando: boolean
  textoGuardar?: string
  deshabilitado?: boolean
}) {
  return (
    <div className="form-acciones">
      <button type="button" className="btn btn-secundario" onClick={onClose}>Cancelar</button>
      <button type="submit" className="btn btn-primario" disabled={guardando || deshabilitado}>
        {guardando ? 'Guardando…' : textoGuardar}
      </button>
    </div>
  )
}

export function PageHeader({ titulo, descripcion, acciones, volver }: {
  titulo: ReactNode
  descripcion?: ReactNode
  acciones?: ReactNode
  volver?: { to: string; label: string }
}) {
  return (
    <>
      {volver && <Link to={volver.to} className="volver">← {volver.label}</Link>}
      <div className="page-header">
        <div>
          <h1>{titulo}</h1>
          {descripcion && <p>{descripcion}</p>}
        </div>
        {acciones && <div className="acciones">{acciones}</div>}
      </div>
    </>
  )
}

export function Seccion({ titulo, descripcion, acciones, children }: {
  titulo: string
  descripcion?: ReactNode
  acciones?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="seccion">
      <div className="seccion-header">
        <div>
          <h2>{titulo}</h2>
          {descripcion && <p>{descripcion}</p>}
        </div>
        {acciones}
      </div>
      {children}
    </section>
  )
}

export function Campo({ label, ayuda, children }: { label: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="campo">
      {label}
      {children}
      {ayuda && <span className="ayuda">{ayuda}</span>}
    </label>
  )
}

export function Badge({ tono = 'neutral', children }: { tono?: Tono; children: ReactNode }) {
  return <span className={`badge badge-${tono}`}>{children}</span>
}

export function EtiquetaBadge({ etiqueta }: { etiqueta: Etiqueta }) {
  return <Badge tono={etiqueta.tono}>{etiqueta.label}</Badge>
}

export function Alerta({ tipo = 'error', children }: { tipo?: 'error' | 'ok' | 'info' | 'aviso'; children: ReactNode }) {
  return <div className={`alerta alerta-${tipo}`} role={tipo === 'error' ? 'alert' : undefined}>{children}</div>
}

export function Kpi({ label, valor, nota }: { label: string; valor: string; nota?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-valor">{valor}</div>
      {nota && <div className="kpi-nota">{nota}</div>}
    </div>
  )
}

export function Dato({ label, valor }: { label: string; valor: ReactNode }) {
  return (
    <div>
      <div className="dato-label">{label}</div>
      <div className="dato-valor">{valor}</div>
    </div>
  )
}

export function Cargando() {
  return <div className="cargando">Cargando…</div>
}

export function NombreUnidad({ v, link = true }: {
  v: { id: number; marca: string; modelo: string; anio: number; id_interno: string }
  link?: boolean
}) {
  const nombre = `${v.marca} ${v.modelo} ${v.anio}`
  return (
    <>
      {link ? <Link to={`/vehiculo/${v.id}`} className="unidad-nombre">{nombre}</Link> : <span className="unidad-nombre">{nombre}</span>}
      <span className="unidad-folio">{v.id_interno}</span>
    </>
  )
}
