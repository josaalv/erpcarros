-- ERP Vehículos — esquema inicial en Supabase (Postgres + RLS real)
-- MVP: catálogos, vehículo, compra, gasto, socio, aportación.
-- Traducido del diseño original en docs/analisis-fuente/01-esquema-base-datos.txt,
-- adaptado a Postgres/RLS en vez de MySQL/autorización en la aplicación.

create table perfil (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('admin','gerencia','comisionista','demo')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.current_rol()
returns text
language sql security definer stable
set search_path = public
as $$
  select rol from perfil where id = auth.uid() and activo = true
$$;

create or replace function public.es_admin()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select rol = 'admin' from perfil where id = auth.uid() and activo = true), false) $$;

create or replace function public.es_admin_o_gerencia()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select rol in ('admin','gerencia') from perfil where id = auth.uid() and activo = true), false) $$;

create or replace function public.es_demo_actual()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select rol = 'demo' from perfil where id = auth.uid() and activo = true), false) $$;

grant execute on function public.current_rol() to authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.es_admin_o_gerencia() to authenticated;
grant execute on function public.es_demo_actual() to authenticated;

-- El primer usuario que se registra se vuelve admin automaticamente
-- (bootstrap sin acceso manual a la base). Los siguientes entran como
-- gerencia por default; el admin los reclasifica despues.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfil (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    case when (select count(*) from public.perfil) = 0 then 'admin' else 'gerencia' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table perfil enable row level security;
create policy perfil_select_propio on perfil for select to authenticated
  using (id = auth.uid() or es_admin());
create policy perfil_update_admin on perfil for update to authenticated
  using (es_admin());

-- ── Catálogos configurables ──
create table estado_proceso (
  id bigserial primary key, clave text unique not null, nombre text not null,
  orden smallint not null, es_final boolean not null default false, activo boolean not null default true
);
create table ubicacion (
  id bigserial primary key, clave text unique not null, nombre text not null,
  es_externa boolean not null default false, activo boolean not null default true
);
create table categoria_gasto (
  id bigserial primary key, clave text unique not null, nombre text not null,
  grupo text not null, es_interno boolean not null default false,
  orden smallint not null default 100, activo boolean not null default true
);

alter table estado_proceso enable row level security;
alter table ubicacion enable row level security;
alter table categoria_gasto enable row level security;
create policy catalogo_select on estado_proceso for select to authenticated using (true);
create policy catalogo_select on ubicacion for select to authenticated using (true);
create policy catalogo_select on categoria_gasto for select to authenticated using (true);
create policy catalogo_admin on estado_proceso for all to authenticated using (es_admin()) with check (es_admin());
create policy catalogo_admin on ubicacion for all to authenticated using (es_admin()) with check (es_admin());
create policy catalogo_admin on categoria_gasto for all to authenticated using (es_admin()) with check (es_admin());

-- ── Socios ──
create table socio (
  id bigserial primary key, nombre text not null, telefono text, correo text,
  activo boolean not null default true, es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table socio enable row level security;
create policy socio_admin on socio for all to authenticated
  using (es_admin() and es_demo = es_demo_actual()) with check (es_admin());

-- ── Vehículo (centro del sistema) ──
create table vehiculo (
  id bigserial primary key,
  id_interno text unique not null,
  vin text unique,
  marca text not null, modelo text not null, version text, anio smallint not null,
  kilometraje integer, color text, transmision text,
  estado_proceso_id bigint not null references estado_proceso(id),
  ubicacion_id bigint not null references ubicacion(id),
  estado_comercial text not null default 'no_publicado'
    check (estado_comercial in ('no_publicado','publicado','en_consignacion','con_referidos','apartado','vendido')),
  estado_documental text not null default 'incompleto'
    check (estado_documental in ('incompleto','en_tramite','completo')),
  fecha_compra date,
  precio_minimo numeric(12,2),
  precio_autorizado numeric(12,2),
  precio_lote numeric(12,2),
  canal_venta text,
  es_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table vehiculo enable row level security;
create policy vehiculo_select on vehiculo for select to authenticated
  using (es_demo = es_demo_actual());
create policy vehiculo_write on vehiculo for all to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual())
  with check (es_admin_o_gerencia());

-- ── Compra (costo de adquisición, SOLO admin) ──
create table compra (
  id bigserial primary key,
  vehiculo_id bigint unique not null references vehiculo(id),
  precio numeric(12,2) not null,
  comision numeric(12,2) not null default 5000,
  impuestos numeric(12,2) not null default 0,
  iva numeric(12,2) not null default 0,
  es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table compra enable row level security;
create policy compra_admin on compra for all to authenticated
  using (es_admin() and es_demo = es_demo_actual()) with check (es_admin());

-- ── Gasto (la tabla mas importante: RN-01, RN-12) ──
create table gasto (
  id bigserial primary key,
  vehiculo_id bigint not null references vehiculo(id),
  categoria_id bigint not null references categoria_gasto(id),
  descripcion text not null,
  importe numeric(12,2) not null check (importe >= 0),
  fecha date not null,
  pagador_tipo text not null default 'empresa' check (pagador_tipo in ('empresa','socio')),
  pagador_socio_id bigint references socio(id),
  es_demo boolean not null default false,
  created_at timestamptz not null default now(),
  constraint ck_gasto_pagador check (
    (pagador_tipo = 'socio' and pagador_socio_id is not null) or
    (pagador_tipo = 'empresa' and pagador_socio_id is null)
  )
);
alter table gasto enable row level security;
create policy gasto_admin on gasto for all to authenticated
  using (es_admin() and es_demo = es_demo_actual()) with check (es_admin());

-- ── Aportación ──
create table aportacion (
  id bigserial primary key,
  vehiculo_id bigint not null references vehiculo(id),
  socio_id bigint not null references socio(id),
  monto numeric(12,2) not null check (monto > 0),
  fecha date not null,
  es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table aportacion enable row level security;
create policy aportacion_admin on aportacion for all to authenticated
  using (es_admin() and es_demo = es_demo_actual()) with check (es_admin());

-- ── Vista: costo acumulado por unidad (compra + gastos vivos) ──
create view v_costo_vehiculo with (security_invoker = true) as
select v.id as vehiculo_id,
  coalesce(c.precio,0) + coalesce(c.comision,0) + coalesce(c.impuestos,0) + coalesce(c.iva,0) as costo_adquisicion,
  coalesce(g.total_gastos,0) as total_gastos,
  coalesce(c.precio,0) + coalesce(c.comision,0) + coalesce(c.impuestos,0) + coalesce(c.iva,0) + coalesce(g.total_gastos,0) as costo_total
from vehiculo v
left join compra c on c.vehiculo_id = v.id
left join (select vehiculo_id, sum(importe) as total_gastos from gasto group by vehiculo_id) g on g.vehiculo_id = v.id;

-- ── Vista: ficha del vehículo con campos financieros redactados por rol ──
-- RN-12: precio_minimo jamas sale del admin. Costo/utilidad/margen: solo
-- admin (Tabla 2). security_invoker=true: respeta el RLS de 'vehiculo' del
-- usuario que consulta, no del dueño de la vista.
create view v_vehiculo_ficha with (security_invoker = true) as
select
  v.id, v.id_interno, v.vin, v.marca, v.modelo, v.version, v.anio, v.kilometraje,
  v.color, v.transmision, v.estado_proceso_id, v.ubicacion_id, v.estado_comercial,
  v.estado_documental, v.fecha_compra, v.precio_autorizado, v.precio_lote,
  v.canal_venta, v.es_demo,
  case when es_admin() then v.precio_minimo else null end as precio_minimo,
  case when es_admin() then cv.costo_total else null end as costo_total,
  case when es_admin() and v.precio_autorizado is not null
    then v.precio_autorizado - cv.costo_total else null end as utilidad,
  case when es_admin() and v.precio_autorizado is not null and v.precio_autorizado > 0
    then round(((v.precio_autorizado - cv.costo_total) / v.precio_autorizado)::numeric, 4) else null end as margen
from vehiculo v
left join v_costo_vehiculo cv on cv.vehiculo_id = v.id;

grant select on v_costo_vehiculo to authenticated;
grant select on v_vehiculo_ficha to authenticated;
