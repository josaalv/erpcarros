-- El catálogo de tipo_documento original (factura/endosos/tarjeta/
-- tenencias/placas/contrato/reporte_subasta/otros) era un supuesto
-- razonable pero no la lista real del negocio. Se reemplaza por las 8
-- categorías que el usuario confirmó como las que de verdad se usan.
-- Los documento rows que colgaban del catálogo viejo eran todos de demo
-- (es_demo=true, sembrados en 006) o de una unidad de prueba suelta — se
-- limpian junto con el catálogo, no hay nada real que preservar.

delete from documento where tipo_documento_id in (
  select id from tipo_documento where clave in
  ('factura','endosos','tarjeta','tenencias','placas','contrato','reporte_subasta','otros')
);
delete from tipo_documento where clave in
  ('factura','endosos','tarjeta','tenencias','placas','contrato','reporte_subasta','otros');

insert into tipo_documento (clave, nombre, obligatorio, confidencial, orden) values
('cotizacion_danos_subasta','Cotización de daños subasta', false, true, 10),
('contrato_compraventa','Contrato de compraventa', false, true, 20),
('contrato_marca','Contrato de marca', false, true, 30),
('factura_original','Factura original', false, true, 40),
('secuencia_facturas','Secuencia de facturas', false, true, 50),
('documentacion_adicional','Documentación adicional', false, true, 60),
('refactura_venta','Refactura de venta', false, true, 70),
('compraventa_venta','Compraventa de venta', false, true, 80)
on conflict (clave) do nothing;

-- El tipo de documentación varía mucho de un carro a otro (RN-11 ya no
-- aplica igual a todas las unidades) — cada vehículo prende/apaga qué
-- categorías le aplican, en vez de heredar un "obligatorio" global fijo.
alter table documento add column activo boolean not null default true;

-- Ahora cualquier categoría se puede renombrar o borrar desde la
-- pantalla (antes solo las personalizadas) — el FK de
-- documento.tipo_documento_id sigue bloqueando el borrado si ya tiene
-- archivos, así que no hace falta restringir por es_personalizado.
drop policy if exists catalogo_admin_del on tipo_documento;
create policy catalogo_admin_del on tipo_documento for delete to authenticated
  using (es_admin_o_gerencia());
