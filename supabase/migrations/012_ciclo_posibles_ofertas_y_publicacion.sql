-- Ciclo completo de 4 etapas que definió el usuario:
-- 1) Posibles ofertas (pre-compra, evaluacion_puja) → 2) Inventario/taller
-- (ya existente) → 3) Publicación para venta (info de comisionistas) →
-- 4) Venta (ya existente, tablas venta/comision).
--
-- evaluacion_puja necesitaba más campos para reflejar cómo se evalúa una
-- unidad ANTES de comprarla: versión, kilometraje de llegada (a veces
-- viene alterado), torre de la subasta (para agrupar junto con marca) y
-- el margen deseado que el usuario captura directamente (antes se
-- calculaba con una utilidad objetivo en pesos, ahora es una fracción
-- como el resto de los márgenes del sistema).
alter table evaluacion_puja add column version text;
alter table evaluacion_puja add column kilometraje_llegada integer;
alter table evaluacion_puja add column torre text;
alter table evaluacion_puja add column margen_deseado numeric(7,4);

-- vehiculo: kilometraje_final se captura al terminar la reparación
-- (corrige el de llegada, que en algunos casos viene alterado desde la
-- subasta) — kilometraje sigue siendo el de llegada, no se sobreescribe.
alter table vehiculo add column kilometraje_final integer;

-- Campos de la etapa "publicación para venta": lo que un comisionista
-- necesita ver del vehículo ya listo, más la comisión que se ofrece por
-- esa unidad en particular (distinta de la comisión real que se liquida
-- al cerrar una venta específica, que ya vive en la tabla comision).
alter table vehiculo add column descripcion_breve text;
alter table vehiculo add column indicaciones_comisionista text;
alter table vehiculo add column comision_ofrecida numeric(12,2);
