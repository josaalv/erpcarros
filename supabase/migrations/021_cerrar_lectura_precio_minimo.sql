-- Cierra el hueco que encontraron las pruebas de RLS (supabase/tests/rls_por_rol.sql):
-- precio_minimo (RN-12, solo admin) se ocultaba en v_vehiculo_ficha, pero la
-- tabla vehiculo deja leer todas sus columnas a cualquier usuario con sesión:
-- gerencia o un comisionista podían pedir /rest/v1/vehiculo?select=precio_minimo.
--
-- Ahora:
--  * `authenticated` tiene SELECT por columna en vehiculo, en todas MENOS
--    precio_minimo (escribirlo no cambia: INSERT/UPDATE siguen igual).
--    OJO: una columna nueva en vehiculo NO queda legible sola; hay que
--    agregar `grant select (columna) on public.vehiculo to authenticated;`.
--  * v_vehiculo_ficha (security_invoker) ya no lee la columna directo — la
--    pide a precio_minimo_de(), security definer, que solo responde al admin.
--  * Las funciones de cierre leían `select * from vehiculo`; ahora solo las
--    columnas que usan.
--
-- (v_costo_vehiculo ya era security_invoker: quien no es admin ve el costo en
-- cero porque la RLS de compra/gasto le oculta las filas. No era hueco.)

create or replace function public.precio_minimo_de(p_vehiculo_id bigint)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select precio_minimo from vehiculo where id = p_vehiculo_id and es_admin();
$$;
revoke execute on function public.precio_minimo_de(bigint) from public, anon;
grant execute on function public.precio_minimo_de(bigint) to authenticated;

-- Misma vista, mismas columnas y orden; solo cambia de dónde sale precio_minimo.
create or replace view public.v_vehiculo_ficha with (security_invoker = true) as
 SELECT v.id,
    v.id_interno,
    v.vin,
    v.marca,
    v.modelo,
    v.version,
    v.anio,
    v.kilometraje,
    v.color,
    v.transmision,
    v.estado_proceso_id,
    v.ubicacion_id,
    v.estado_comercial,
    v.estado_documental,
    v.fecha_compra,
    v.precio_autorizado,
    v.precio_lote,
    v.canal_venta,
    v.es_demo,
        CASE
            WHEN es_admin() THEN precio_minimo_de(v.id)
            ELSE NULL::numeric
        END AS precio_minimo,
        CASE
            WHEN es_admin() THEN cv.costo_total
            ELSE NULL::numeric
        END AS costo_total,
        CASE
            WHEN (es_admin() AND (v.precio_autorizado IS NOT NULL)) THEN (v.precio_autorizado - cv.costo_total)
            ELSE NULL::numeric
        END AS utilidad,
        CASE
            WHEN (es_admin() AND (v.precio_autorizado IS NOT NULL) AND (v.precio_autorizado > (0)::numeric)) THEN round(((v.precio_autorizado - cv.costo_total) / v.precio_autorizado), 4)
            ELSE NULL::numeric
        END AS margen,
    v.kilometraje_final,
    v.descripcion_breve,
    v.indicaciones_comisionista,
    v.comision_ofrecida,
    v.subasta_id,
    v.torre,
    v.numero_motor,
    v.stock_subasta,
    v.notas
   FROM (vehiculo v
     LEFT JOIN v_costo_vehiculo cv ON ((cv.vehiculo_id = v.id)));

revoke select on public.vehiculo from anon, authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'vehiculo' and column_name <> 'precio_minimo';
  execute format('grant select (%s) on public.vehiculo to authenticated', cols);
end $$;

create or replace function public.cerrar_financiero(p_venta_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venta    venta%rowtype;
  v_fecha_compra date;
  v_es_demo  boolean;
  v_costo    numeric(12,2);
  v_util     numeric(12,2);
  v_cierre   bigint;
begin
  if not es_admin() then
    raise exception 'Solo el administrador puede cerrar ventas.';
  end if;

  select * into v_venta from venta where id = p_venta_id for update;
  if not found then
    raise exception 'No se encontró la venta.';
  end if;
  if v_venta.estado <> 'en_proceso' then
    raise exception 'Esta venta ya no está pendiente de cierre. Recarga la página.';
  end if;
  if exists (select 1 from cierre_financiero where vehiculo_id = v_venta.vehiculo_id) then
    raise exception 'Esta unidad ya tiene un cierre financiero. Recarga la página.';
  end if;

  select fecha_compra, es_demo into v_fecha_compra, v_es_demo from vehiculo where id = v_venta.vehiculo_id for update;

  select coalesce(costo_total, 0) into v_costo from v_costo_vehiculo where vehiculo_id = v_venta.vehiculo_id;
  v_costo := coalesce(v_costo, 0);
  v_util  := v_venta.precio_acordado - v_costo;

  insert into cierre_financiero (
    vehiculo_id, venta_id, costo_total, precio_final, utilidad_bruta, margen, roi,
    dias_inventario, canal_venta, cerrado_por, es_demo
  ) values (
    v_venta.vehiculo_id, v_venta.id, v_costo, v_venta.precio_acordado, v_util,
    case when v_venta.precio_acordado > 0 then round(v_util / v_venta.precio_acordado, 4) else 0 end,
    case when v_costo > 0 then round(v_util / v_costo, 4) else 0 end,
    greatest(coalesce(v_venta.fecha_venta - v_fecha_compra, 0), 0),
    v_venta.canal, (select auth.uid()), v_es_demo
  ) returning id into v_cierre;

  insert into liquidacion (cierre_id, vehiculo_id, socio_id, capital_aportado, participacion, utilidad_asignada, monto_a_pagar, es_demo)
  select v_cierre, p.vehiculo_id, p.socio_id, p.capital_aportado, round(p.participacion, 4),
         round(p.participacion * v_util, 2), round(p.capital_aportado + p.participacion * v_util, 2), v_es_demo
  from v_participacion_socio p
  where p.vehiculo_id = v_venta.vehiculo_id;

  if v_venta.comisionista_id is not null and not exists (select 1 from comision where venta_id = v_venta.id) then
    insert into comision (venta_id, comisionista_id, esquema, es_demo)
    values (v_venta.id, v_venta.comisionista_id, 'fijo', v_es_demo);
  end if;

  update venta set estado = 'completada' where id = v_venta.id;
  update vehiculo set estado_comercial = 'vendido' where id = v_venta.vehiculo_id;

  return jsonb_build_object('cierre_id', v_cierre, 'costo_total', v_costo, 'utilidad', v_util);
end;
$$;

create or replace function public.recalcular_cierre(p_venta_id bigint, p_motivo text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venta    venta%rowtype;
  v_fecha_compra date;
  v_es_demo  boolean;
  v_cierre   cierre_financiero%rowtype;
  v_costo    numeric(12,2);
  v_util     numeric(12,2);
begin
  if not es_admin() then
    raise exception 'Solo el administrador puede recalcular cierres.';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escribe el motivo del recálculo.';
  end if;

  select * into v_venta from venta where id = p_venta_id for update;
  if not found then
    raise exception 'No se encontró la venta.';
  end if;
  select * into v_cierre from cierre_financiero where venta_id = p_venta_id for update;
  if not found then
    raise exception 'Esta venta no tiene cierre financiero.';
  end if;
  select fecha_compra, es_demo into v_fecha_compra, v_es_demo from vehiculo where id = v_venta.vehiculo_id;

  insert into reapertura (cierre_id, motivo, usuario_id)
  values (v_cierre.id, trim(p_motivo), (select auth.uid()));

  select coalesce(costo_total, 0) into v_costo from v_costo_vehiculo where vehiculo_id = v_venta.vehiculo_id;
  v_costo := coalesce(v_costo, 0);
  v_util  := v_venta.precio_acordado - v_costo;

  update cierre_financiero set
    costo_total     = v_costo,
    precio_final    = v_venta.precio_acordado,
    utilidad_bruta  = v_util,
    margen          = case when v_venta.precio_acordado > 0 then round(v_util / v_venta.precio_acordado, 4) else 0 end,
    roi             = case when v_costo > 0 then round(v_util / v_costo, 4) else 0 end,
    dias_inventario = greatest(coalesce(v_venta.fecha_venta - v_fecha_compra, 0), 0),
    canal_venta     = v_venta.canal,
    estado          = 'reabierto',
    cerrado_por     = (select auth.uid())
  where id = v_cierre.id;

  update liquidacion l set capital_aportado = 0, participacion = 0, utilidad_asignada = 0, monto_a_pagar = 0
  where l.cierre_id = v_cierre.id
    and not exists (select 1 from v_participacion_socio p where p.vehiculo_id = v_venta.vehiculo_id and p.socio_id = l.socio_id);

  insert into liquidacion (cierre_id, vehiculo_id, socio_id, capital_aportado, participacion, utilidad_asignada, monto_a_pagar, es_demo)
  select v_cierre.id, p.vehiculo_id, p.socio_id, p.capital_aportado, round(p.participacion, 4),
         round(p.participacion * v_util, 2), round(p.capital_aportado + p.participacion * v_util, 2), v_es_demo
  from v_participacion_socio p
  where p.vehiculo_id = v_venta.vehiculo_id
  on conflict (cierre_id, socio_id) do update set
    capital_aportado  = excluded.capital_aportado,
    participacion     = excluded.participacion,
    utilidad_asignada = excluded.utilidad_asignada,
    monto_a_pagar     = excluded.monto_a_pagar;

  return jsonb_build_object('cierre_id', v_cierre.id, 'costo_total', v_costo, 'utilidad', v_util);
end;
$$;
