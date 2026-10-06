// Proxy de solo lectura hacia prosubastas.com.mx/subastas/ (su servidor no
// manda encabezados CORS, así que el navegador no puede leer los listados
// directo). Solo acepta esa ruta y requiere sesión (verify_jwt): no es un
// proxy abierto (además se exige un usuario con sesión, no la llave anon). Devuelve el archivo (PDF) o la página del índice tal cual.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // verify_jwt valida la firma, pero la llave pública (anon) también es un
  // JWT válido: aquí se exige una sesión de usuario real.
  try {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    const datos = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (datos.role !== 'authenticated') throw new Error('sin sesión')
  } catch {
    return new Response('Inicia sesión para usar esta función', { status: 401, headers: CORS })
  }

  const pedido = new URL(req.url).searchParams.get('url') ?? ''
  let destino: URL
  try {
    destino = new URL(pedido)
  } catch {
    return new Response('URL inválida', { status: 400, headers: CORS })
  }
  if (destino.protocol !== 'https:' || destino.hostname !== 'prosubastas.com.mx' || !destino.pathname.startsWith('/subastas/')) {
    return new Response('Solo se aceptan enlaces de https://prosubastas.com.mx/subastas/', { status: 400, headers: CORS })
  }

  // Sin seguir redirecciones: así no se puede usar para llegar a otro sitio.
  const r = await fetch(destino.toString(), { redirect: 'manual' })
  if (r.status >= 300 && r.status < 400) return new Response('El enlace redirige a otro lugar', { status: 502, headers: CORS })
  const tamano = Number(r.headers.get('content-length') ?? 0)
  if (tamano > 25 * 1024 * 1024) return new Response('Archivo demasiado grande', { status: 413, headers: CORS })

  return new Response(r.body, {
    status: r.status,
    headers: { ...CORS, 'Content-Type': r.headers.get('content-type') ?? 'application/octet-stream' },
  })
})
