-- 026 · Propiedad del vehículo y quién pagó cada gasto (parte 1 del diseño
-- de socios; ver docs/HISTORIAL_DISENO.md, "propiedad, socios y fondo común").
--
-- Modalidades:
--   unica       un dueño (propietario_id) cubre todo; es el pagador por default.
--   copropiedad varios dueños; % = capital de cada uno (compra + gastos que
--               pagó) / capital total, calculado al final.
--   excepcion   el reparto se fija a mano como % del TOTAL de la venta
--               (vehiculo_reparto); registrar quién pagó gastos es opcional.
--
-- Sin acciones de borrado en las FK (el conector MCP no aplica SQL con esa
-- palabra): la app quita gasto_pago / vehiculo_reparto antes de borrar el
-- gasto o la unidad, igual que con cobro.

alter table public.vehiculo
  add column modalidad_propiedad text not null default 'unica'
    check (modalidad_propiedad in ('unica', 'copropiedad', 'excepcion')),
  add column propietario_id bigint references public.socio(id);
create index if not exists vehiculo_propietario_idx on public.vehiculo (propietario_id);
grant select (modalidad_propiedad, propietario_id) on public.vehiculo to authenticated;

-- ── Quién pagó cada gasto (uno o varios, con %) y con qué dinero ──
create table public.gasto_pago (
  id bigserial primary key,
  gasto_id bigint not null references public.gasto(id),
  socio_id bigint not null references public.socio(id),
  porcentaje numeric(7,4) not null check (porcentaje > 0 and porcentaje <= 1),
  -- fondo: sale de su parte del fondo común · bolsa: dinero propio (aporte nuevo)
  origen text not null default 'fondo' check (origen in ('fondo', 'bolsa')),
  es_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (gasto_id, socio_id)
);
create index gasto_pago_socio_idx on public.gasto_pago (socio_id);
alter table public.gasto_pago enable row level security;
create policy gasto_pago_admin on public.gasto_pago for all to authenticated
  using (es_admin() and es_demo = es_demo_actual()) with check (es_admin());

-- ── Reparto acordado (solo modalidad excepción): % del total de la venta ──
create table public.vehiculo_reparto (
  id bigserial primary key,
  vehiculo_id bigint not null references public.vehiculo(id),
  socio_id bigint not null references public.socio(id),
  porcentaje numeric(7,4) not null check (porcentaje > 0 and porcentaje <= 1),
  es_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (vehiculo_id, socio_id)
);
create index vehiculo_reparto_socio_idx on public.vehiculo_reparto (socio_id);
alter table public.vehiculo_reparto enable row level security;
create policy vehiculo_reparto_admin on public.vehiculo_reparto for all to authenticated
  using (es_admin() and es_demo = es_demo_actual()) with check (es_admin());

-- Los % de un mismo gasto / vehículo no pueden pasar de 100%.
create or replace function public.validar_suma_porcentajes()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  suma numeric;
begin
  if tg_table_name = 'gasto_pago' then
    select coalesce(sum(porcentaje), 0) into suma from public.gasto_pago where gasto_id = new.gasto_id;
  else
    select coalesce(sum(porcentaje), 0) into suma from public.vehiculo_reparto where vehiculo_id = new.vehiculo_id;
  end if;
  if suma > 1.0001 then
    raise exception 'Los porcentajes suman % por ciento; no pueden pasar de 100.', round(suma * 100, 2);
  end if;
  return null;
end;
$$;
create trigger gasto_pago_suma after insert or update on public.gasto_pago
  for each row execute function public.validar_suma_porcentajes();
create trigger vehiculo_reparto_suma after insert or update on public.vehiculo_reparto
  for each row execute function public.validar_suma_porcentajes();

-- ── Capital de cada socio en cada vehículo ──
-- aportado_compra: aportaciones a la compra · aportado_gastos: su parte de
-- los gastos que pagó · participacion_capital: su capital / capital total ·
-- participacion_acordada: % de la venta si la unidad es excepción.
create view public.v_capital_socio_vehiculo with (security_invoker = true) as
with compra as (
  select vehiculo_id, socio_id, sum(monto) as monto
  from public.aportacion group by vehiculo_id, socio_id
), gastos as (
  select g.vehiculo_id, p.socio_id, sum(round(g.importe * p.porcentaje, 2)) as monto
  from public.gasto g join public.gasto_pago p on p.gasto_id = g.id
  group by g.vehiculo_id, p.socio_id
), socios as (
  select vehiculo_id, socio_id from compra
  union select vehiculo_id, socio_id from gastos
  union select vehiculo_id, socio_id from public.vehiculo_reparto
), base as (
  select s.vehiculo_id, s.socio_id,
    coalesce(c.monto, 0)::numeric(12,2) as aportado_compra,
    coalesce(g.monto, 0)::numeric(12,2) as aportado_gastos
  from socios s
  left join compra c on c.vehiculo_id = s.vehiculo_id and c.socio_id = s.socio_id
  left join gastos g on g.vehiculo_id = s.vehiculo_id and g.socio_id = s.socio_id
)
select b.vehiculo_id, b.socio_id, b.aportado_compra, b.aportado_gastos,
  (b.aportado_compra + b.aportado_gastos)::numeric(12,2) as capital,
  round((b.aportado_compra + b.aportado_gastos)
    / nullif(sum(b.aportado_compra + b.aportado_gastos) over (partition by b.vehiculo_id), 0), 4)::numeric(7,4) as participacion_capital,
  r.porcentaje as participacion_acordada
from base b
left join public.vehiculo_reparto r on r.vehiculo_id = b.vehiculo_id and r.socio_id = b.socio_id;
grant select on public.v_capital_socio_vehiculo to authenticated;

-- Parte de los gastos que todavía no tiene pagador asignado, por vehículo.
create view public.v_gasto_sin_pagador with (security_invoker = true) as
select g.vehiculo_id,
  sum(round(g.importe * (1 - coalesce(p.suma, 0)), 2))::numeric(12,2) as monto,
  count(*) filter (where coalesce(p.suma, 0) < 0.9999) as gastos
from public.gasto g
left join (select gasto_id, sum(porcentaje) as suma from public.gasto_pago group by gasto_id) p on p.gasto_id = g.id
where coalesce(p.suma, 0) < 0.9999
group by g.vehiculo_id;
grant select on public.v_gasto_sin_pagador to authenticated;

-- El respaldo previo al botón maestro incluye las tablas nuevas.
create or replace function public.respaldar_unidades()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tablas text[] := array['vehiculo','compra','gasto','gasto_pago','vehiculo_reparto','documento','aportacion',
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
