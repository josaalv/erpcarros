-- Catálogo histórico de subastas: TODAS las unidades que salen en los
-- listados de Prosubastas (no solo las que nos interesan), ligadas a su
-- empresa vendedora y a su archivo, para poder consultarlas después.
--
--   subasta          = una fecha + un patio (GDL, TOL, MID…), con el enlace
--                      de fotos del patio (Dropbox).
--   subasta_listado  = el PDF de una empresa dentro de esa subasta
--                      (01.-FC = Ford Credit…), con su URL de origen y su
--                      carpeta de Dropbox ("/01 FC").
--   subasta_unidad   = cada renglón del listado. "Me interesa" crea la
--                      evaluacion_puja (Posibles ofertas) que apunta aquí.
--
-- Los FK no llevan acción al borrar (el conector MCP no aplica sentencias con
-- esa palabra): la app borra en orden unidades → listados → subasta, igual
-- que el botón maestro. Solo admin (como subasta/evaluacion_puja).

alter table public.subasta add column if not exists url_origen text;

create table if not exists public.subasta_listado (
  id              bigint generated always as identity primary key,
  subasta_id      bigint not null references public.subasta (id),
  orden           text,
  codigo          text not null,
  vendedor        text,
  url             text,
  fecha_reporte   date,
  unidades        integer not null default 0,
  carpeta_fotos text,
  es_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (subasta_id, codigo)
);

create table if not exists public.subasta_unidad (
  id               bigint generated always as identity primary key,
  subasta_id       bigint not null references public.subasta (id),
  listado_id       bigint references public.subasta_listado (id),
  torre            text not null,
  stock            text,
  vin              text,
  marca            text not null,
  modelo           text not null,
  anio             smallint,
  version          text,
  puertas          smallint,
  color            text,
  kilometraje      integer,
  equipamiento     text,
  transmision      text,
  vendedor         text,
  valor_factura    numeric(12,2),
  fecha_factura    date,
  info_documentos  text,
  carpeta_fotos  text,
  fotos_total      integer,
  portada_path     text,
  -- Para el histórico: a cuánto se vendió en la subasta, si se sabe.
  precio_cierre    numeric(12,2),
  es_demo          boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (subasta_id, torre)
);

create index if not exists subasta_listado_subasta_idx on public.subasta_listado (subasta_id);
create index if not exists subasta_unidad_subasta_idx on public.subasta_unidad (subasta_id);
create index if not exists subasta_unidad_listado_idx on public.subasta_unidad (listado_id);
create index if not exists subasta_unidad_vin_idx on public.subasta_unidad (vin);
create index if not exists subasta_unidad_stock_idx on public.subasta_unidad (stock);
create index if not exists subasta_unidad_marca_modelo_idx on public.subasta_unidad (marca, modelo);

alter table public.evaluacion_puja add column if not exists subasta_unidad_id bigint references public.subasta_unidad (id);
create index if not exists evaluacion_puja_subasta_unidad_idx on public.evaluacion_puja (subasta_unidad_id);

alter table public.subasta_listado enable row level security;
alter table public.subasta_unidad enable row level security;

create policy subasta_listado_admin on public.subasta_listado for all to authenticated
  using (es_admin() and es_demo = es_demo_actual()) with check (es_admin() and es_demo = es_demo_actual());
create policy subasta_unidad_admin on public.subasta_unidad for all to authenticated
  using (es_admin() and es_demo = es_demo_actual()) with check (es_admin() and es_demo = es_demo_actual());

-- El respaldo del botón maestro también copia el catálogo.
create or replace function public.respaldar_unidades()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tablas text[] := array['vehiculo','compra','gasto','documento','aportacion','venta','cobro','comision',
    'cierre_financiero','reapertura','liquidacion','consignacion','orden_trabajo','dano','apartado',
    'oferta','subasta','subasta_listado','subasta_unidad','evaluacion_puja'];
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
