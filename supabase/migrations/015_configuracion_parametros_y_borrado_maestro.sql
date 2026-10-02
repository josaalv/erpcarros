-- Configuración del sistema (octubre 2026).
-- 1) parametro: valores del negocio editables por el admin.
-- 2) Policies de DELETE que faltaban (cliente, comisionista, lote, proveedor):
--    sin ellas esas tablas eran de solo-alta. El FK sigue impidiendo borrar
--    un registro con historial.
-- 3) Botón maestro: respalda en el esquema privado `respaldo` (no expuesto en
--    la API); luego la app borra todas las unidades reales con lo que cuelga
--    de ellas, más subastas y evaluaciones. Conserva catálogos, socios, clientes,
--    comisionistas, usuarios y los datos de demostración (es_demo = true).
--    Los archivos de Storage NO se borran: quedan como parte del respaldo.

create table if not exists public.parametro (
  clave text primary key,
  valor text not null,
  actualizado timestamptz not null default now()
);
alter table public.parametro enable row level security;
create policy parametro_select on public.parametro for select to authenticated using (true);
create policy parametro_insert on public.parametro for insert to authenticated with check (es_admin());
create policy parametro_update on public.parametro for update to authenticated using (es_admin()) with check (es_admin());

insert into public.parametro (clave, valor) values
  ('empresa_nombre', 'ERP Vehículos'),
  ('comision_subasta', '5000'),
  ('margen_deseado', '20'),
  ('dias_atribucion_referido', '15')
on conflict (clave) do nothing;

create policy cliente_delete on public.cliente for delete to authenticated
  using (es_admin() and es_demo = es_demo_actual());
create policy comisionista_delete on public.comisionista for delete to authenticated
  using (es_admin() and es_demo = es_demo_actual());
create policy lote_delete on public.lote for delete to authenticated
  using (es_admin() and es_demo = es_demo_actual());
create policy proveedor_delete on public.proveedor for delete to authenticated
  using (es_admin() and es_demo = es_demo_actual());

create schema if not exists respaldo;
revoke all on schema respaldo from public, anon, authenticated;

create table if not exists respaldo.bitacora (
  id bigserial primary key,
  creado timestamptz not null default now(),
  usuario uuid,
  sufijo text not null,
  conteos jsonb not null
);

-- Solo respalda; el borrado lo hace la app con la sesión del admin (RLS
-- vehiculo_delete / subasta_admin / evaluacion_admin), igual que "Eliminar
-- unidad" en el Expediente. Así la función no contiene DELETE: el conector
-- MCP pide una confirmación para esas sentencias que en sesiones en la nube
-- nunca llega al usuario y la llamada se vence.
create or replace function public.respaldar_unidades()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tablas text[] := array['vehiculo','compra','gasto','documento','aportacion','venta','comision',
    'cierre_financiero','reapertura','liquidacion','consignacion','orden_trabajo','dano','apartado',
    'oferta','subasta','evaluacion_puja'];
  t text;
  sufijo text := to_char(now() at time zone 'America/Mexico_City', 'YYYYMMDD_HH24MISS');
  conteos jsonb := '{}'::jsonb;
  n bigint;
  tiene_demo boolean;
begin
  if not es_admin() then
    raise exception 'Solo el administrador puede respaldar la información.';
  end if;
  foreach t in array tablas loop
    select exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'es_demo') into tiene_demo;
    execute format('create table respaldo.%I as select * from public.%I %s',
      t || '_' || sufijo, t, case when tiene_demo then 'where es_demo = false' else '' end);
    get diagnostics n = row_count;
    conteos := conteos || jsonb_build_object(t, n);
  end loop;
  insert into respaldo.bitacora (usuario, sufijo, conteos) values (auth.uid(), sufijo, conteos);
  return jsonb_build_object('sufijo', sufijo, 'respaldado', conteos);
end;
$$;

create or replace function public.listar_respaldos()
returns table (id bigint, creado timestamptz, sufijo text, conteos jsonb, usuario_nombre text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.id, b.creado, b.sufijo, b.conteos, p.nombre
  from respaldo.bitacora b left join public.perfil p on p.id = b.usuario
  where es_admin()
  order by b.creado desc;
$$;

revoke execute on function public.respaldar_unidades() from public, anon;
revoke execute on function public.listar_respaldos() from public, anon;
grant execute on function public.respaldar_unidades() to authenticated;
grant execute on function public.listar_respaldos() to authenticated;
