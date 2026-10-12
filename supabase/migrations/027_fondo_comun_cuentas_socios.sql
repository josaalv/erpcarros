-- 027 · Fondo común y cuenta de cada socio (parte 2 del diseño de socios;
-- ver docs/HISTORIAL_DISENO.md, "propiedad, socios y fondo común").
--
-- El fondo líquido de cada socio NO se guarda como saldo: se calcula de sus
-- movimientos (v_movimiento_socio), así nunca se desincroniza:
--   + saldo inicial, aportes, préstamos recibidos, préstamos que le pagan
--   − retiros, compras y gastos pagados "del fondo", préstamos que da o paga
--   ± ajustes
-- Lo pagado "de su bolsa" no toca el fondo, pero sí cuenta como capital
-- invertido en la unidad (v_capital_socio_vehiculo).
-- Sin acciones de borrado en las FK (el conector MCP no aplica SQL con esa
-- palabra): la app quita los préstamos de una unidad antes de borrarla.

-- Compra pagada del fondo o de la bolsa del socio (como en gasto_pago).
alter table public.aportacion
  add column origen text not null default 'fondo' check (origen in ('fondo', 'bolsa'));

-- ── Movimientos directos del fondo ──
create table public.movimiento_fondo (
  id bigserial primary key,
  socio_id bigint not null references public.socio(id),
  fecha date not null default current_date,
  tipo text not null check (tipo in ('saldo_inicial', 'aporte', 'retiro', 'ajuste')),
  -- Positivo siempre, salvo en ajuste (que puede restar).
  monto numeric(12,2) not null,
  -- De dónde vino el dinero de un aporte (p. ej. "crédito"); solo informativo.
  origen_dinero text,
  nota text,
  es_demo boolean not null default false,
  created_at timestamptz not null default now(),
  constraint ck_movimiento_monto check ((tipo = 'ajuste' and monto <> 0) or (tipo <> 'ajuste' and monto > 0))
);
create index movimiento_fondo_socio_idx on public.movimiento_fondo (socio_id, fecha);
alter table public.movimiento_fondo enable row level security;
create policy movimiento_fondo_admin on public.movimiento_fondo for all to authenticated
  using (es_admin() and es_demo = es_demo_actual()) with check (es_admin());

-- ── Préstamos entre socios (sin interés; se pagan al vender la unidad) ──
create table public.prestamo_socio (
  id bigserial primary key,
  prestamista_id bigint not null references public.socio(id),
  deudor_id bigint not null references public.socio(id),
  vehiculo_id bigint references public.vehiculo(id),
  monto numeric(12,2) not null check (monto > 0),
  fecha date not null default current_date,
  pagado boolean not null default false,
  fecha_pago date,
  nota text,
  es_demo boolean not null default false,
  created_at timestamptz not null default now(),
  constraint ck_prestamo_personas check (prestamista_id <> deudor_id),
  constraint ck_prestamo_pago check (pagado = (fecha_pago is not null))
);
create index prestamo_socio_prestamista_idx on public.prestamo_socio (prestamista_id);
create index prestamo_socio_deudor_idx on public.prestamo_socio (deudor_id);
create index prestamo_socio_vehiculo_idx on public.prestamo_socio (vehiculo_id);
alter table public.prestamo_socio enable row level security;
create policy prestamo_socio_admin on public.prestamo_socio for all to authenticated
  using (es_admin() and es_demo = es_demo_actual()) with check (es_admin());

-- ── Estado de cuenta: todos los movimientos de cada socio ──
-- efecto = cuánto cambia su fondo líquido (0 si fue de su bolsa).
create view public.v_movimiento_socio with (security_invoker = true) as
select m.socio_id, m.fecha, m.tipo, abs(m.monto)::numeric(12,2) as monto,
  (case when m.tipo = 'retiro' then -m.monto else m.monto end)::numeric(12,2) as efecto,
  null::bigint as vehiculo_id, coalesce(m.nota, m.origen_dinero) as detalle,
  'movimiento_fondo'::text as fuente, m.id as fuente_id
from public.movimiento_fondo m
union all
select a.socio_id, a.fecha, 'compra', a.monto,
  (case when a.origen = 'fondo' then -a.monto else 0 end)::numeric(12,2),
  a.vehiculo_id, case when a.origen = 'bolsa' then 'De su bolsa' end, 'aportacion', a.id
from public.aportacion a
union all
select p.socio_id, g.fecha, 'gasto', round(g.importe * p.porcentaje, 2),
  (case when p.origen = 'fondo' then -round(g.importe * p.porcentaje, 2) else 0 end)::numeric(12,2),
  g.vehiculo_id, g.descripcion || case when p.origen = 'bolsa' then ' (de su bolsa)' else '' end, 'gasto_pago', p.id
from public.gasto_pago p join public.gasto g on g.id = p.gasto_id
union all
select ps.prestamista_id, ps.fecha, 'prestamo_dado', ps.monto, -ps.monto, ps.vehiculo_id, ps.nota, 'prestamo_socio', ps.id
from public.prestamo_socio ps
union all
select ps.deudor_id, ps.fecha, 'prestamo_recibido', ps.monto, ps.monto, ps.vehiculo_id, ps.nota, 'prestamo_socio', ps.id
from public.prestamo_socio ps
union all
select ps.prestamista_id, ps.fecha_pago, 'prestamo_cobrado', ps.monto, ps.monto, ps.vehiculo_id, ps.nota, 'prestamo_socio', ps.id
from public.prestamo_socio ps where ps.pagado
union all
select ps.deudor_id, ps.fecha_pago, 'prestamo_pagado', ps.monto, -ps.monto, ps.vehiculo_id, ps.nota, 'prestamo_socio', ps.id
from public.prestamo_socio ps where ps.pagado;
grant select on public.v_movimiento_socio to authenticated;

-- ── Cuenta de cada socio ──
-- liquido: su parte del fondo disponible · invertido: su capital en unidades
-- que aún no se venden · debe / le_deben: préstamos pendientes ·
-- patrimonio = liquido + invertido + le_deben − debe · pertenencia = su
-- patrimonio / patrimonio total (define cuánto del fondo líquido puede retirar).
create view public.v_cuenta_socio with (security_invoker = true) as
with liq as (
  select socio_id, sum(efecto) as liquido from public.v_movimiento_socio group by socio_id
), inv as (
  select c.socio_id, sum(c.capital) as invertido
  from public.v_capital_socio_vehiculo c join public.vehiculo v on v.id = c.vehiculo_id
  where v.estado_comercial <> 'vendido'
  group by c.socio_id
), deu as (
  select deudor_id as socio_id, sum(monto) as debe from public.prestamo_socio where not pagado group by deudor_id
), pre as (
  select prestamista_id as socio_id, sum(monto) as le_deben from public.prestamo_socio where not pagado group by prestamista_id
), base as (
  select s.id as socio_id, s.nombre, s.activo,
    coalesce(liq.liquido, 0)::numeric(12,2) as liquido,
    coalesce(inv.invertido, 0)::numeric(12,2) as invertido,
    coalesce(deu.debe, 0)::numeric(12,2) as debe,
    coalesce(pre.le_deben, 0)::numeric(12,2) as le_deben
  from public.socio s
  left join liq on liq.socio_id = s.id
  left join inv on inv.socio_id = s.id
  left join deu on deu.socio_id = s.id
  left join pre on pre.socio_id = s.id
)
select b.*,
  (b.liquido + b.invertido + b.le_deben - b.debe)::numeric(12,2) as patrimonio,
  round((b.liquido + b.invertido + b.le_deben - b.debe)
    / nullif(sum(b.liquido + b.invertido + b.le_deben - b.debe) over (), 0), 4)::numeric(7,4) as pertenencia
from base b;
grant select on public.v_cuenta_socio to authenticated;

-- El respaldo previo al botón maestro incluye las tablas nuevas.
create or replace function public.respaldar_unidades()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tablas text[] := array['vehiculo','compra','gasto','gasto_pago','vehiculo_reparto','documento','aportacion',
    'movimiento_fondo','prestamo_socio',
    'venta','cobro','comision','cierre_financiero','reapertura','liquidacion','consignacion','orden_trabajo',
    'dano','apartado','oferta','subasta','subasta_listado','subasta_unidad','evaluacion_puja'];
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
