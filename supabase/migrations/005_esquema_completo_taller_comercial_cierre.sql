-- ── Documentación (RN-11) ──
create table tipo_documento (
  id bigserial primary key, clave text unique not null, nombre text not null,
  obligatorio boolean not null default false, confidencial boolean not null default true,
  orden smallint not null default 100, activo boolean not null default true
);
alter table tipo_documento enable row level security;
create policy catalogo_select on tipo_documento for select to authenticated using (true);
create policy catalogo_admin on tipo_documento for insert to authenticated with check (es_admin());
create policy catalogo_admin_upd on tipo_documento for update to authenticated using (es_admin()) with check (es_admin());

create table documento (
  id bigserial primary key,
  vehiculo_id bigint not null references vehiculo(id),
  tipo_documento_id bigint not null references tipo_documento(id),
  estado text not null default 'faltante' check (estado in ('faltante','en_tramite','completo')),
  fecha_obtencion date,
  observaciones text,
  es_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (vehiculo_id, tipo_documento_id)
);
alter table documento enable row level security;
create policy documento_rw on documento for all to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual()) with check (es_admin_o_gerencia());
create policy documento_select_demo on documento for select to authenticated
  using (es_demo_actual() and es_demo = true);

-- ── Proveedores ──
create table proveedor (
  id bigserial primary key, nombre text not null, empresa text, especialidad text,
  telefono text, correo text, es_gestor boolean not null default false,
  activo boolean not null default true, es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table proveedor enable row level security;
create policy proveedor_select on proveedor for select to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual());
create policy proveedor_write on proveedor for insert to authenticated with check (es_admin_o_gerencia());
create policy proveedor_update on proveedor for update to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual()) with check (es_admin_o_gerencia());

-- ── Taller ──
create table subestado_taller (
  id bigserial primary key, clave text unique not null, nombre text not null, activo boolean not null default true
);
alter table subestado_taller enable row level security;
create policy catalogo_select on subestado_taller for select to authenticated using (true);

create table orden_trabajo (
  id bigserial primary key,
  folio text unique not null,
  vehiculo_id bigint not null references vehiculo(id),
  tipo text not null check (tipo in ('interna','externa')),
  especialidad text,
  proveedor_id bigint references proveedor(id),
  descripcion text not null,
  prioridad text not null default 'normal' check (prioridad in ('baja','normal','alta')),
  fecha_inicio date, fecha_estimada date, fecha_real date,
  estado text not null default 'abierta' check (estado in ('abierta','en_proceso','espera_piezas','terminada','cancelada')),
  es_retrabajo boolean not null default false,
  observaciones text,
  es_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table orden_trabajo enable row level security;
create policy ot_select on orden_trabajo for select to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual());
create policy ot_write on orden_trabajo for insert to authenticated with check (es_admin_o_gerencia());
create policy ot_update on orden_trabajo for update to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual()) with check (es_admin_o_gerencia());

-- ── Daños ──
create table dano (
  id bigserial primary key,
  vehiculo_id bigint not null references vehiculo(id),
  zona text not null, tipo text,
  severidad text not null default 'medio' check (severidad in ('leve','medio','grave')),
  detectado_en text not null check (detectado_en in ('subasta','recepcion','diagnostico','posterior')),
  descripcion text, resuelto boolean not null default false,
  es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table dano enable row level security;
create policy dano_select on dano for select to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual());
create policy dano_write on dano for insert to authenticated with check (es_admin_o_gerencia());
create policy dano_update on dano for update to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual()) with check (es_admin_o_gerencia());

-- ── Subasta y calculadora de puja (RN-05) ──
create table subasta (
  id bigserial primary key, plataforma text not null default 'Prosubastas',
  fecha date not null, lote text, patio_origen text,
  es_demo boolean not null default false, created_at timestamptz not null default now()
);
alter table subasta enable row level security;
create policy subasta_admin on subasta for all to authenticated
  using (es_admin() and es_demo = es_demo_actual()) with check (es_admin());

create table evaluacion_puja (
  id bigserial primary key,
  subasta_id bigint references subasta(id),
  vehiculo_id bigint references vehiculo(id),
  marca text not null, modelo text not null, anio smallint not null,
  danos_observados text,
  costo_reparacion_estimado numeric(12,2) not null default 0,
  precio_venta_esperado numeric(12,2) not null default 0,
  techo_puja numeric(12,2),
  roi_proyectado numeric(7,4),
  roi_historico_segmento numeric(7,4),
  resultado text not null default 'pendiente' check (resultado in ('pendiente','ganada','perdida','descartada')),
  es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table evaluacion_puja enable row level security;
create policy evaluacion_admin on evaluacion_puja for all to authenticated
  using (es_admin() and es_demo = es_demo_actual()) with check (es_admin());

-- ── Consignación (RN-27 a RN-30) ──
create table lote (
  id bigserial primary key, nombre text not null, contacto text, telefono text,
  activo boolean not null default true, es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table lote enable row level security;
create policy lote_select on lote for select to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual());
create policy lote_admin_write on lote for insert to authenticated with check (es_admin());
create policy lote_admin_update on lote for update to authenticated using (es_admin()) with check (es_admin());

create table consignacion (
  id bigserial primary key,
  vehiculo_id bigint not null references vehiculo(id),
  lote_id bigint not null references lote(id),
  precio_asignado numeric(12,2) not null check (precio_asignado > 0),
  fecha_envio date not null, fecha_retiro date,
  estado text not null default 'en_consignacion' check (estado in ('en_consignacion','retirada','vendida_por_lote','conciliada')),
  fecha_venta_reportada date, fecha_pago_recibido date,
  observaciones text,
  es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table consignacion enable row level security;
create policy consignacion_select on consignacion for select to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual());
create policy consignacion_write on consignacion for insert to authenticated with check (es_admin_o_gerencia());
create policy consignacion_update on consignacion for update to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual()) with check (es_admin_o_gerencia());

-- ── Comercial: comisionista, cliente, prospecto, interaccion, cita, oferta ──
create table comisionista (
  id bigserial primary key,
  perfil_id uuid references perfil(id),
  nombre text not null, telefono text, correo text,
  ver_comisiones boolean not null default false,
  activo boolean not null default true,
  es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table comisionista enable row level security;
create policy comisionista_select on comisionista for select to authenticated
  using ((es_admin_o_gerencia() and es_demo = es_demo_actual()) or perfil_id = (select auth.uid()));
create policy comisionista_admin_write on comisionista for insert to authenticated with check (es_admin());
create policy comisionista_admin_update on comisionista for update to authenticated using (es_admin()) with check (es_admin());

create or replace function public.mi_comisionista_id()
returns bigint language sql security definer stable set search_path = public
as $$ select id from comisionista where perfil_id = auth.uid() and activo = true limit 1 $$;
revoke execute on function public.mi_comisionista_id() from anon, public;
grant execute on function public.mi_comisionista_id() to authenticated;

create table cliente (
  id bigserial primary key, nombre text not null, telefono text unique, correo text,
  origen text not null default 'directo' check (origen in ('referido','lote','anuncio','directo','otro')),
  notas text, es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table cliente enable row level security;
create policy cliente_select on cliente for select to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual());
create policy cliente_insert on cliente for insert to authenticated
  with check (es_admin_o_gerencia() or current_rol() = 'comisionista');
create policy cliente_update on cliente for update to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual()) with check (es_admin_o_gerencia());

create table prospecto (
  id bigserial primary key,
  cliente_id bigint not null references cliente(id),
  vehiculo_id bigint references vehiculo(id),
  comisionista_id bigint references comisionista(id),
  etapa text not null default 'nuevo' check (etapa in
    ('nuevo','contactado','interesado','cita','visito','prueba','oferta','negociacion','apartado','vendido','perdido','cancelado')),
  fecha_registro date not null default current_date,
  vence_atribucion date,
  motivo_perdida text,
  es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table prospecto enable row level security;
create policy prospecto_select on prospecto for select to authenticated
  using (
    (es_admin_o_gerencia() and es_demo = es_demo_actual())
    or (current_rol() = 'comisionista' and comisionista_id = mi_comisionista_id())
  );
create policy prospecto_insert on prospecto for insert to authenticated
  with check (es_admin_o_gerencia() or (current_rol() = 'comisionista' and comisionista_id = mi_comisionista_id()));
create policy prospecto_update on prospecto for update to authenticated
  using (
    (es_admin_o_gerencia() and es_demo = es_demo_actual())
    or (current_rol() = 'comisionista' and comisionista_id = mi_comisionista_id())
  );

create table interaccion (
  id bigserial primary key,
  prospecto_id bigint not null references prospecto(id) on delete cascade,
  tipo text not null check (tipo in ('llamada','mensaje','visita','prueba_manejo','otro')),
  ocurrido timestamptz not null default now(),
  nota text
);
alter table interaccion enable row level security;
create policy interaccion_all on interaccion for all to authenticated
  using (exists (select 1 from prospecto p where p.id = prospecto_id and
    ((es_admin_o_gerencia() and p.es_demo = es_demo_actual()) or (current_rol()='comisionista' and p.comisionista_id = mi_comisionista_id()))))
  with check (exists (select 1 from prospecto p where p.id = prospecto_id and
    (es_admin_o_gerencia() or (current_rol()='comisionista' and p.comisionista_id = mi_comisionista_id()))));

create table cita (
  id bigserial primary key,
  prospecto_id bigint not null references prospecto(id),
  vehiculo_id bigint references vehiculo(id),
  cuando timestamptz not null,
  lugar text,
  estado text not null default 'programada' check (estado in ('programada','asistio','no_asistio','cancelada')),
  es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table cita enable row level security;
create policy cita_all on cita for all to authenticated
  using (exists (select 1 from prospecto p where p.id = prospecto_id and
    ((es_admin_o_gerencia() and p.es_demo = es_demo_actual()) or (current_rol()='comisionista' and p.comisionista_id = mi_comisionista_id()))))
  with check (exists (select 1 from prospecto p where p.id = prospecto_id and
    (es_admin_o_gerencia() or (current_rol()='comisionista' and p.comisionista_id = mi_comisionista_id()))));

-- RN-14: SOLO admin captura ofertas.
create table oferta (
  id bigserial primary key,
  prospecto_id bigint not null references prospecto(id),
  vehiculo_id bigint not null references vehiculo(id),
  monto numeric(12,2) not null,
  fecha date not null default current_date,
  estado text not null default 'recibida' check (estado in ('recibida','aceptada','rechazada','contraoferta')),
  nota text,
  es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table oferta enable row level security;
create policy oferta_admin on oferta for all to authenticated
  using (es_admin() and es_demo = es_demo_actual()) with check (es_admin());

-- ── Apartado ──
create table apartado (
  id bigserial primary key,
  vehiculo_id bigint not null references vehiculo(id),
  cliente_id bigint not null references cliente(id),
  comisionista_id bigint references comisionista(id),
  monto numeric(12,2) not null,
  fecha date not null default current_date,
  vence date not null,
  estado text not null default 'activo' check (estado in ('activo','aplicado','vencido','cancelado')),
  motivo_cancelacion text,
  es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table apartado enable row level security;
create policy apartado_select on apartado for select to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual());
create policy apartado_write on apartado for insert to authenticated with check (es_admin_o_gerencia());
create policy apartado_update on apartado for update to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual()) with check (es_admin_o_gerencia());

-- ── Venta, comisión, cierre financiero, liquidación ──
create table venta (
  id bigserial primary key,
  vehiculo_id bigint unique not null references vehiculo(id),
  cliente_id bigint references cliente(id),
  comisionista_id bigint references comisionista(id),
  consignacion_id bigint references consignacion(id),
  canal text not null check (canal in ('directa','consignacion','comisionista','anuncio')),
  precio_acordado numeric(12,2) not null,
  forma_pago text not null check (forma_pago in ('efectivo','transferencia','financiera','toma_a_cuenta','mixto')),
  fecha_venta date not null default current_date,
  fecha_entrega date,
  veh_tomado_id bigint references vehiculo(id),
  valor_toma numeric(12,2),
  estado text not null default 'en_proceso' check (estado in ('en_proceso','completada','entregada','cancelada')),
  observaciones text,
  es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table venta enable row level security;
create policy venta_select on venta for select to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual());
create policy venta_write on venta for insert to authenticated with check (es_admin_o_gerencia());
create policy venta_update on venta for update to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual()) with check (es_admin_o_gerencia());

create table comision (
  id bigserial primary key,
  venta_id bigint not null references venta(id),
  comisionista_id bigint not null references comisionista(id),
  esquema text not null default 'fijo' check (esquema in ('fijo','porcentaje_venta','porcentaje_utilidad','especial')),
  monto_estimado numeric(12,2),
  monto_autorizado numeric(12,2),
  fecha_autorizacion date,
  monto_pagado numeric(12,2),
  fecha_pago date,
  es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table comision enable row level security;
create policy comision_admin on comision for all to authenticated
  using (es_admin() and es_demo = es_demo_actual()) with check (es_admin());
create policy comision_select_propia on comision for select to authenticated
  using (current_rol() = 'comisionista' and comisionista_id = mi_comisionista_id()
    and exists (select 1 from comisionista c where c.id = comisionista_id and c.ver_comisiones));

create table cierre_financiero (
  id bigserial primary key,
  vehiculo_id bigint unique not null references vehiculo(id),
  venta_id bigint references venta(id),
  costo_total numeric(12,2) not null,
  precio_final numeric(12,2) not null,
  utilidad_bruta numeric(12,2) not null,
  margen numeric(7,4) not null,
  roi numeric(7,4) not null,
  dias_inventario smallint not null,
  canal_venta text not null check (canal_venta in ('directa','consignacion','comisionista','anuncio')),
  estado text not null default 'cerrado' check (estado in ('cerrado','reabierto')),
  cerrado_por uuid not null references perfil(id),
  fecha_cierre timestamptz not null default now(),
  es_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table cierre_financiero enable row level security;
create policy cierre_admin on cierre_financiero for all to authenticated
  using (es_admin() and es_demo = es_demo_actual()) with check (es_admin());

create table reapertura (
  id bigserial primary key,
  cierre_id bigint not null references cierre_financiero(id),
  motivo text not null,
  usuario_id uuid not null references perfil(id),
  ocurrido timestamptz not null default now()
);
alter table reapertura enable row level security;
create policy reapertura_admin on reapertura for all to authenticated using (es_admin()) with check (es_admin());

create table liquidacion (
  id bigserial primary key,
  cierre_id bigint not null references cierre_financiero(id),
  vehiculo_id bigint not null references vehiculo(id),
  socio_id bigint not null references socio(id),
  capital_aportado numeric(12,2) not null,
  participacion numeric(7,4) not null,
  utilidad_asignada numeric(12,2) not null,
  monto_a_pagar numeric(12,2) not null,
  pagado boolean not null default false,
  fecha_pago date,
  es_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (cierre_id, socio_id)
);
alter table liquidacion enable row level security;
create policy liquidacion_admin on liquidacion for all to authenticated
  using (es_admin() and es_demo = es_demo_actual()) with check (es_admin());

-- ── Vistas requeridas: participación de socios y ROI histórico por segmento ──
create view v_participacion_socio with (security_invoker = true) as
select a.vehiculo_id, a.socio_id,
  sum(a.monto) as capital_aportado,
  sum(a.monto) / sum(sum(a.monto)) over (partition by a.vehiculo_id) as participacion
from aportacion a
group by a.vehiculo_id, a.socio_id;
grant select on v_participacion_socio to authenticated;

create view v_roi_segmento with (security_invoker = true) as
select marca, modelo,
  case when costo_total < 110000 then 'baja' when costo_total < 180000 then 'media' else 'alta' end as banda,
  count(*) as unidades,
  avg(margen) as margen_promedio,
  avg(roi) as roi_promedio,
  avg(dias_inventario) as dias_promedio
from cierre_financiero cf
join vehiculo v on v.id = cf.vehiculo_id
group by marca, modelo, banda;
grant select on v_roi_segmento to authenticated;

-- Indices de FK mas usados
create index ix_documento_veh on documento(vehiculo_id);
create index ix_ot_veh on orden_trabajo(vehiculo_id);
create index ix_dano_veh on dano(vehiculo_id);
create index ix_consignacion_veh on consignacion(vehiculo_id);
create index ix_prospecto_comisionista on prospecto(comisionista_id);
create index ix_prospecto_cliente on prospecto(cliente_id);
create index ix_venta_veh on venta(vehiculo_id);
create index ix_comision_venta on comision(venta_id);
create index ix_liquidacion_cierre on liquidacion(cierre_id);
