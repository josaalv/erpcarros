-- 028 · Cierre de venta por modalidad de propiedad, abonado a la cuenta de
-- cada socio (parte 3 del diseño de socios; ver docs/HISTORIAL_DISENO.md).
--
-- Reglas (validadas con el usuario):
--   · Una venta solo se cierra cuando se cobró completa (saldo de
--     v_saldo_venta = 0; la toma a cuenta cuenta como pago). Antes es abierta.
--   · unica:       al dueño le toca todo (capital = costo, utilidad completa).
--   · copropiedad: capital de cada uno (compra + gastos que pagó) / total; a
--                  cada uno su capital + su % de la utilidad (o pérdida).
--   · excepcion:   a cada uno su % acordado del TOTAL de la venta.
--   · Los préstamos de la unidad se marcan pagados al cerrar.
--   · Lo liquidado se abona a la cuenta del socio y queda reinvertido en el
--     fondo (v_movimiento_socio tipo 'liquidacion'); sacarlo es un retiro.

-- ── Reparto de una venta (también sirve de vista previa antes de cerrar) ──
create or replace function public.liquidacion_de_venta(p_venta_id bigint)
returns table (socio_id bigint, capital numeric, participacion numeric, utilidad numeric, monto numeric)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_venta     venta%rowtype;
  v_modalidad text;
  v_dueno     bigint;
  v_costo     numeric(12,2);
  v_util      numeric(12,2);
  v_capital   numeric(12,2);
  v_sin_pagar numeric(12,2);
  v_reparto   numeric;
  v_n         integer;
begin
  if not es_admin() then
    raise exception 'Solo el administrador puede ver el reparto de una venta.';
  end if;
  select * into v_venta from venta where id = p_venta_id;
  if not found then
    raise exception 'No se encontró la venta.';
  end if;
  select modalidad_propiedad, propietario_id into v_modalidad, v_dueno from vehiculo where id = v_venta.vehiculo_id;
  select coalesce(costo_total, 0) into v_costo from v_costo_vehiculo where vehiculo_id = v_venta.vehiculo_id;
  v_costo := coalesce(v_costo, 0);
  v_util  := v_venta.precio_acordado - v_costo;

  if v_modalidad = 'excepcion' then
    select coalesce(sum(porcentaje), 0) into v_reparto from vehiculo_reparto where vehiculo_id = v_venta.vehiculo_id;
    if abs(v_reparto - 1) > 0.0001 then
      raise exception 'La unidad es excepción de propiedad y su reparto acordado suma % por ciento; debe sumar 100 (Expediente, pestaña Socios).', round(v_reparto * 100, 2);
    end if;
    return query
      select r.socio_id, coalesce(c.capital, 0)::numeric(12,2), r.porcentaje::numeric,
             round(r.porcentaje * v_venta.precio_acordado - coalesce(c.capital, 0), 2),
             round(r.porcentaje * v_venta.precio_acordado, 2)
      from vehiculo_reparto r
      left join v_capital_socio_vehiculo c on c.vehiculo_id = r.vehiculo_id and c.socio_id = r.socio_id
      where r.vehiculo_id = v_venta.vehiculo_id;
    return;
  end if;

  if v_modalidad = 'unica' then
    if v_dueno is null then
      select count(*), min(c.socio_id) into v_n, v_dueno
      from v_capital_socio_vehiculo c where c.vehiculo_id = v_venta.vehiculo_id and c.capital > 0;
      if v_n <> 1 then
        raise exception 'La unidad es propiedad única pero no tiene dueño asignado (Expediente, pestaña Socios).';
      end if;
    end if;
    if exists (select 1 from v_capital_socio_vehiculo c
               where c.vehiculo_id = v_venta.vehiculo_id and c.socio_id <> v_dueno and c.capital > 0) then
      raise exception 'La unidad es propiedad única, pero otro socio puso dinero en ella: cámbiala a copropiedad o registra ese dinero como préstamo.';
    end if;
    -- El dueño cubre todo: su capital es el costo completo de la unidad.
    return query select v_dueno, v_costo::numeric, 1::numeric, v_util::numeric, v_venta.precio_acordado::numeric;
    return;
  end if;

  -- Copropiedad
  select coalesce(sum(monto), 0) into v_sin_pagar from v_gasto_sin_pagador where vehiculo_id = v_venta.vehiculo_id;
  if v_sin_pagar > 0.005 then
    raise exception 'Hay $% en gastos sin indicar quién los pagó; asígnalos para poder repartir la copropiedad.', v_sin_pagar;
  end if;
  select coalesce(sum(c.capital), 0) into v_capital from v_capital_socio_vehiculo c where c.vehiculo_id = v_venta.vehiculo_id;
  if v_capital <= 0 then
    raise exception 'Ningún socio tiene capital registrado en esta unidad.';
  end if;
  if abs(v_capital - v_costo) > 1 then
    raise exception 'El capital de los socios ($%) no coincide con el costo de la unidad ($%); revisa las aportaciones a la compra y quién pagó cada gasto.', v_capital, v_costo;
  end if;
  return query
    select c.socio_id, c.capital::numeric, round(c.capital / v_capital, 4),
           round(c.capital / v_capital * v_util, 2),
           round(c.capital + c.capital / v_capital * v_util, 2)
    from v_capital_socio_vehiculo c
    where c.vehiculo_id = v_venta.vehiculo_id and c.capital > 0;
end;
$$;
revoke execute on function public.liquidacion_de_venta(bigint) from anon;

-- ── Cerrar: solo con el pago completo; liquida por modalidad ──
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
  v_saldo    numeric(12,2);
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
  select saldo into v_saldo from v_saldo_venta where venta_id = v_venta.id;
  if coalesce(v_saldo, 0) > 0.005 then
    raise exception 'Falta cobrar $% de esta venta: se cierra cuando se recibe el pago completo (Por cobrar).', v_saldo;
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

  -- Reparto por modalidad (lanza error claro si falta información: no se guarda nada).
  insert into liquidacion (cierre_id, vehiculo_id, socio_id, capital_aportado, participacion, utilidad_asignada, monto_a_pagar, es_demo)
  select v_cierre, v_venta.vehiculo_id, l.socio_id, l.capital, round(l.participacion, 4), l.utilidad, l.monto, v_es_demo
  from liquidacion_de_venta(v_venta.id) l;

  -- Los préstamos de la unidad se pagan con la venta.
  update prestamo_socio set pagado = true, fecha_pago = current_date
  where vehiculo_id = v_venta.vehiculo_id and not pagado;

  if v_venta.comisionista_id is not null and not exists (select 1 from comision where venta_id = v_venta.id) then
    insert into comision (venta_id, comisionista_id, esquema, es_demo)
    values (v_venta.id, v_venta.comisionista_id, 'fijo', v_es_demo);
  end if;

  update venta set estado = 'completada' where id = v_venta.id;
  update vehiculo set estado_comercial = 'vendido' where id = v_venta.vehiculo_id;

  return jsonb_build_object('cierre_id', v_cierre, 'costo_total', v_costo, 'utilidad', v_util);
end;
$$;

-- ── Recalcular (gastos después de vender, corrección de precio) ──
create or replace function public.recalcular_cierre(p_venta_id bigint, p_motivo text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venta    venta%rowtype;
  v_fecha_compra date;
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
  select fecha_compra into v_fecha_compra from vehiculo where id = v_venta.vehiculo_id;

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

  -- Quien ya no participa queda en 0 (no se borra: el MCP no aplica borrados).
  update liquidacion l set capital_aportado = 0, participacion = 0, utilidad_asignada = 0, monto_a_pagar = 0
  where l.cierre_id = v_cierre.id
    and not exists (select 1 from liquidacion_de_venta(p_venta_id) n where n.socio_id = l.socio_id);

  insert into liquidacion (cierre_id, vehiculo_id, socio_id, capital_aportado, participacion, utilidad_asignada, monto_a_pagar, es_demo)
  select v_cierre.id, v_venta.vehiculo_id, n.socio_id, n.capital, round(n.participacion, 4), n.utilidad, n.monto, v_cierre.es_demo
  from liquidacion_de_venta(p_venta_id) n
  on conflict (cierre_id, socio_id) do update set
    capital_aportado  = excluded.capital_aportado,
    participacion     = excluded.participacion,
    utilidad_asignada = excluded.utilidad_asignada,
    monto_a_pagar     = excluded.monto_a_pagar;

  return jsonb_build_object('cierre_id', v_cierre.id, 'costo_total', v_costo, 'utilidad', v_util);
end;
$$;

-- ── Lo liquidado se abona a la cuenta del socio (queda en el fondo) ──
create or replace view public.v_movimiento_socio with (security_invoker = true) as
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
from public.prestamo_socio ps where ps.pagado
union all
select l.socio_id, (cf.fecha_cierre at time zone 'America/Mexico_City')::date, 'liquidacion', l.monto_a_pagar, l.monto_a_pagar,
  l.vehiculo_id, 'Capital ' || to_char(l.capital_aportado, 'FM999,999,990.00') || ' + utilidad ' || to_char(l.utilidad_asignada, 'FM999,999,990.00'),
  'liquidacion', l.id
from public.liquidacion l join public.cierre_financiero cf on cf.id = l.cierre_id
where l.monto_a_pagar <> 0;
