-- Cierre financiero y su recálculo como funciones de Postgres.
--
-- Antes vivían en el navegador (Ventas.tsx / Vendidos.tsx) como 5-6 escrituras
-- sueltas: si se caía la conexión a la mitad quedaba un cierre sin liquidación
-- de socios o una venta "en proceso" con cierre ya hecho, y dos admins podían
-- cerrar la misma venta a la vez. Una llamada RPC es una sola transacción: o se
-- guarda todo o nada, y el `for update` sobre la venta serializa cierres
-- simultáneos.
--
-- security invoker: corren con los permisos de quien llama, así que las
-- policies RLS (admin + es_demo) siguen aplicando igual que antes. El chequeo
-- de es_admin() al inicio solo da un mensaje claro en vez de un error de RLS.
--
-- De paso:
--  * dias_inventario es NOT NULL y el cliente mandaba null si la unidad no
--    tenía fecha de compra (el cierre fallaba). Ahora 0 en ese caso.
--  * cierre/liquidación/comisión heredan es_demo de la unidad (antes siempre
--    false, y en modo demo el cierre quedaba como dato real).
--  * El recálculo conserva pagado/fecha_pago de cada socio (antes se borraban
--    y regeneraban las liquidaciones y se perdía qué ya se había pagado).

create or replace function public.cerrar_financiero(p_venta_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venta    venta%rowtype;
  v_veh      vehiculo%rowtype;
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

  select * into v_veh from vehiculo where id = v_venta.vehiculo_id for update;

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
    greatest(coalesce(v_venta.fecha_venta - v_veh.fecha_compra, 0), 0),
    v_venta.canal, (select auth.uid()), v_veh.es_demo
  ) returning id into v_cierre;

  insert into liquidacion (cierre_id, vehiculo_id, socio_id, capital_aportado, participacion, utilidad_asignada, monto_a_pagar, es_demo)
  select v_cierre, p.vehiculo_id, p.socio_id, p.capital_aportado, round(p.participacion, 4),
         round(p.participacion * v_util, 2), round(p.capital_aportado + p.participacion * v_util, 2), v_veh.es_demo
  from v_participacion_socio p
  where p.vehiculo_id = v_venta.vehiculo_id;

  if v_venta.comisionista_id is not null and not exists (select 1 from comision where venta_id = v_venta.id) then
    insert into comision (venta_id, comisionista_id, esquema, es_demo)
    values (v_venta.id, v_venta.comisionista_id, 'fijo', v_veh.es_demo);
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
  v_veh      vehiculo%rowtype;
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
  select * into v_veh from vehiculo where id = v_venta.vehiculo_id;

  -- Constancia primero: queda ligada al mismo cierre, que se actualiza en su
  -- lugar (borrarlo se llevaría la reapertura por la cascada).
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
    dias_inventario = greatest(coalesce(v_venta.fecha_venta - v_veh.fecha_compra, 0), 0),
    canal_venta     = v_venta.canal,
    estado          = 'reabierto',
    cerrado_por     = (select auth.uid())
  where id = v_cierre.id;

  -- Socios que ya no tienen aportación en la unidad quedan en cero (no se
  -- borran: el conector MCP no puede aplicar SQL con borrados, y la fila en
  -- cero deja constancia de que participaban antes del recálculo).
  update liquidacion l set capital_aportado = 0, participacion = 0, utilidad_asignada = 0, monto_a_pagar = 0
  where l.cierre_id = v_cierre.id
    and not exists (select 1 from v_participacion_socio p where p.vehiculo_id = v_venta.vehiculo_id and p.socio_id = l.socio_id);

  -- El resto se actualiza en su lugar (conserva pagado / fecha_pago).
  insert into liquidacion (cierre_id, vehiculo_id, socio_id, capital_aportado, participacion, utilidad_asignada, monto_a_pagar, es_demo)
  select v_cierre.id, p.vehiculo_id, p.socio_id, p.capital_aportado, round(p.participacion, 4),
         round(p.participacion * v_util, 2), round(p.capital_aportado + p.participacion * v_util, 2), v_veh.es_demo
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

revoke execute on function public.cerrar_financiero(bigint) from public, anon;
revoke execute on function public.recalcular_cierre(bigint, text) from public, anon;
grant execute on function public.cerrar_financiero(bigint) to authenticated;
grant execute on function public.recalcular_cierre(bigint, text) to authenticated;
