-- Datos que trae el contrato de compraventa de Prosubastas y que no tenían
-- dónde guardarse: número de motor, stock de la subasta y la "información
-- adicional" del contrato (estado de papeles, tenencias, llaves...).
alter table public.vehiculo add column if not exists numero_motor text;
alter table public.vehiculo add column if not exists stock_subasta text;
alter table public.vehiculo add column if not exists notas text;
create index if not exists ix_vehiculo_vin on public.vehiculo (vin);

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
    v.subasta_id, v.torre,
    v.numero_motor, v.stock_subasta, v.notas
   FROM vehiculo v
     LEFT JOIN v_costo_vehiculo cv ON cv.vehiculo_id = v.id;
