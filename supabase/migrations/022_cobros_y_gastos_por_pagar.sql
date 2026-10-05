-- Cuentas por cobrar y por pagar, derivadas de lo que ya está en el sistema.
--
-- POR COBRAR: una venta puede estar registrada (incluso cerrada) sin que haya
-- entrado todo el dinero — p. ej. la parte que paga la financiera. Cada
-- entrada de dinero es un `cobro` (cliente, financiera, otro). El saldo sale
-- solo: precio acordado − valor de la toma a cuenta − cobros. Vista
-- v_saldo_venta.
--
-- POR PAGAR: un gasto de reparación ya cuenta en el costo de la unidad en
-- cuanto se registra, pero puede no haberse pagado todavía al taller.
-- gasto.pagado (default true: todo lo capturado antes ya estaba pagado),
-- fecha_pago y fecha_vencimiento.
--
-- cobro.venta_id es FK sin acción al borrar (el conector MCP no aplica
-- sentencias con la palabra de borrado): la app borra los cobros antes de
-- borrar una unidad, igual que con los archivos de Storage. El trigger de
-- bitácora para BAJAS de cobro va en 022b (se pega en el SQL Editor).

create table if not exists public.cobro (
  id          bigint generated always as identity primary key,
  venta_id    bigint not null references public.venta (id),
  vehiculo_id bigint not null,
  fecha       date not null default current_date,
  monto       numeric(12,2) not null check (monto > 0),
  origen      text not null default 'cliente' check (origen in ('cliente', 'financiera', 'otro')),
  referencia  text,
  es_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists cobro_venta_idx on public.cobro (venta_id);
create index if not exists cobro_vehiculo_idx on public.cobro (vehiculo_id);

alter table public.cobro enable row level security;

-- Mismo permiso que venta: admin y gerencia registran y corrigen cobros.
create policy cobro_admin_gerencia on public.cobro
  for all to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual())
  with check (es_admin_o_gerencia() and es_demo = es_demo_actual());

-- Cuándo se espera que se liquide el saldo (p. ej. fecha que dio la financiera).
alter table public.venta add column if not exists fecha_liquidacion_esperada date;

create or replace view public.v_saldo_venta with (security_invoker = true) as
select
  ve.id as venta_id,
  ve.vehiculo_id,
  ve.estado,
  ve.precio_acordado,
  coalesce(ve.valor_toma, 0) as valor_toma,
  coalesce(c.cobrado, 0) as cobrado,
  ve.precio_acordado - coalesce(ve.valor_toma, 0) - coalesce(c.cobrado, 0) as saldo,
  c.ultimo_cobro,
  ve.fecha_liquidacion_esperada,
  ve.es_demo
from venta ve
left join (
  select venta_id, sum(monto) as cobrado, max(fecha) as ultimo_cobro
  from cobro group by venta_id
) c on c.venta_id = ve.id
where ve.estado <> 'cancelada';

alter table public.gasto add column if not exists pagado boolean not null default true;
alter table public.gasto add column if not exists fecha_pago date;
alter table public.gasto add column if not exists fecha_vencimiento date;
create index if not exists gasto_pendiente_idx on public.gasto (vehiculo_id) where not pagado;

-- Bitácora: altas y cambios de cobros (bajas en 022b).
create or replace trigger bitacora_cobro after insert or update on public.cobro
  for each row execute function public.registrar_bitacora();

-- El respaldo del botón maestro también copia los cobros.
create or replace function public.respaldar_unidades()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tablas text[] := array['vehiculo','compra','gasto','documento','aportacion','venta','cobro','comision',
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
