-- v_vehiculo_ficha necesita exponer los campos nuevos de la migración 012
-- (kilometraje_final, descripcion_breve, indicaciones_comisionista,
-- comision_ofrecida) para que las pantallas (Expediente, catálogo del
-- portal de comisionista) puedan leerlos. Ninguno es financieramente
-- sensible al nivel de precio_minimo/costo_total (comision_ofrecida es
-- justo la información que el comisionista debe ver), así que no llevan
-- redacción por rol.
create or replace view v_vehiculo_ficha with (security_invoker = true) as
select v.id,
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
    case when es_admin() then v.precio_minimo else null::numeric end as precio_minimo,
    case when es_admin() then cv.costo_total else null::numeric end as costo_total,
    case when es_admin() and v.precio_autorizado is not null then v.precio_autorizado - cv.costo_total else null::numeric end as utilidad,
    case when es_admin() and v.precio_autorizado is not null and v.precio_autorizado > 0::numeric
      then round((v.precio_autorizado - cv.costo_total) / v.precio_autorizado, 4) else null::numeric end as margen,
    v.kilometraje_final,
    v.descripcion_breve,
    v.indicaciones_comisionista,
    v.comision_ofrecida
from vehiculo v
left join v_costo_vehiculo cv on cv.vehiculo_id = v.id;

grant select on v_vehiculo_ficha to authenticated;
