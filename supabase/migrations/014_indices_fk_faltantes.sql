-- Hallazgo de get_advisors (performance), octubre 2026: FKs sin índice en las
-- tablas agregadas desde la migración 005 (la 003 solo cubrió las del esquema
-- inicial). Aplicado vía execute_sql en bloques (apply_migration se vencía).

create index if not exists ix_documento_tipo_documento on public.documento (tipo_documento_id);
create index if not exists ix_orden_trabajo_proveedor on public.orden_trabajo (proveedor_id);
create index if not exists ix_evaluacion_puja_subasta on public.evaluacion_puja (subasta_id);
create index if not exists ix_evaluacion_puja_vehiculo on public.evaluacion_puja (vehiculo_id);
create index if not exists ix_consignacion_lote on public.consignacion (lote_id);
create index if not exists ix_comisionista_perfil on public.comisionista (perfil_id);
create index if not exists ix_prospecto_vehiculo on public.prospecto (vehiculo_id);
create index if not exists ix_interaccion_prospecto on public.interaccion (prospecto_id);
create index if not exists ix_cita_prospecto on public.cita (prospecto_id);
create index if not exists ix_cita_vehiculo on public.cita (vehiculo_id);
create index if not exists ix_oferta_prospecto on public.oferta (prospecto_id);
create index if not exists ix_oferta_vehiculo on public.oferta (vehiculo_id);
create index if not exists ix_apartado_cliente on public.apartado (cliente_id);
create index if not exists ix_apartado_comisionista on public.apartado (comisionista_id);
create index if not exists ix_apartado_vehiculo on public.apartado (vehiculo_id);
create index if not exists ix_venta_cliente on public.venta (cliente_id);
create index if not exists ix_venta_comisionista on public.venta (comisionista_id);
create index if not exists ix_venta_consignacion on public.venta (consignacion_id);
create index if not exists ix_venta_veh_tomado on public.venta (veh_tomado_id);
create index if not exists ix_comision_comisionista on public.comision (comisionista_id);
create index if not exists ix_cierre_financiero_cerrado_por on public.cierre_financiero (cerrado_por);
create index if not exists ix_cierre_financiero_venta on public.cierre_financiero (venta_id);
create index if not exists ix_reapertura_cierre on public.reapertura (cierre_id);
create index if not exists ix_reapertura_usuario on public.reapertura (usuario_id);
create index if not exists ix_liquidacion_socio on public.liquidacion (socio_id);
create index if not exists ix_liquidacion_vehiculo on public.liquidacion (vehiculo_id);
