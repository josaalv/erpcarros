-- Fotos de la unidad y tipo de documento REPUVE (integración con Dropbox de
-- la subasta).
--
-- vehiculo.fotos: rutas en Storage (bucket documentos-vehiculo,
-- <vehiculo>/fotos/...), la primera es la portada. Arreglo en la misma fila
-- y no tabla aparte: así se va con la unidad al borrarla sin depender de un
-- FK con borrado en cascada (el conector MCP no aplica sentencias con esa
-- palabra). Los archivos de Storage los borra la app, igual que documentos.
--
-- vehiculo tiene SELECT por columna desde la 021: la columna nueva necesita
-- su grant o nadie la podría leer.

alter table public.vehiculo add column if not exists fotos text[] not null default '{}';
grant select (fotos) on public.vehiculo to authenticated;

-- La hoja de inspección de Prosubastas va como "Cotización de daños subasta"
-- (ya existe); el REPUVE no tenía tipo.
insert into public.tipo_documento (clave, nombre, obligatorio, confidencial, orden, activo, es_personalizado)
values ('repuve', 'Consulta REPUVE', false, false, 15, true, false)
on conflict (clave) do nothing;
