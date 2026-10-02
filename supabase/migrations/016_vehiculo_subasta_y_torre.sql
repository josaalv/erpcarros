-- Alta completa de unidad (octubre 2026): cada unidad guarda en qué subasta se
-- compró y su torre. El FK no lleva acción al borrar: una subasta con
-- unidades ligadas no se puede eliminar (el borrado maestro borra primero
-- las unidades y después las subastas).
alter table public.vehiculo add column if not exists subasta_id bigint references public.subasta(id);
alter table public.vehiculo add column if not exists torre text;
create index if not exists ix_vehiculo_subasta on public.vehiculo (subasta_id);

-- Columnas nuevas al final: CREATE OR REPLACE VIEW no permite reordenar.
create or replace view public.v_vehiculo_ficha with (security_invoker = true) as
 SELECT v.id, v.id_interno, v.vin, v.marca, v.modelo, v.version, v.anio, v.kilometraje, v.color, v.transmision,
    v.estado_proceso_id, v.ubicacion_id, v.estado_comercial, v.estado_documental, v.fecha_compra,
    v.precio_autorizado, v.precio_lote, v.canal_venta, v.es_demo,
    CASE WHEN es_admin() THEN v.precio_minimo ELSE NULL::numeric END AS precio_minimo,
    CASE WHEN es_admin() THEN cv.costo_total ELSE NULL::numeric END AS costo_total,
    CASE WHEN es_admin() AND v.precio_autorizado IS NOT NULL THEN v.precio_autorizado - cv.costo_total ELSE NULL::numeric END AS utilidad,
    CASE WHEN es_admin() AND v.precio_autorizado IS NOT NULL AND v.precio_autorizado > 0::numeric
      THEN round((v.precio_autorizado - cv.costo_total) / v.precio_autorizado, 4) ELSE NULL::numeric END AS margen,
    v.kilometraje_final, v.descripcion_breve, v.indicaciones_comisionista, v.comision_ofrecida,
    v.subasta_id, v.torre
   FROM vehiculo v
     LEFT JOIN v_costo_vehiculo cv ON cv.vehiculo_id = v.id;
