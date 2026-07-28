-- Hasta ahora no había forma de eliminar una unidad del inventario: el FK
-- de vehiculo_id en cada tabla dependiente no tenía ON DELETE, así que
-- Postgres rechazaba el borrado en cuanto existía un solo gasto/compra/
-- documento ligado (o sea, siempre — toda unidad real tiene al menos su
-- compra). Regla básica de cualquier ERP: si algo se puede agregar,
-- también se debe poder quitar.
--
-- Cascada (se borran junto con la unidad — son datos que no tienen
-- sentido sin ella):
alter table apartado drop constraint apartado_vehiculo_id_fkey,
  add constraint apartado_vehiculo_id_fkey foreign key (vehiculo_id) references vehiculo(id) on delete cascade;
alter table aportacion drop constraint aportacion_vehiculo_id_fkey,
  add constraint aportacion_vehiculo_id_fkey foreign key (vehiculo_id) references vehiculo(id) on delete cascade;
alter table cierre_financiero drop constraint cierre_financiero_vehiculo_id_fkey,
  add constraint cierre_financiero_vehiculo_id_fkey foreign key (vehiculo_id) references vehiculo(id) on delete cascade;
alter table cierre_financiero drop constraint cierre_financiero_venta_id_fkey,
  add constraint cierre_financiero_venta_id_fkey foreign key (venta_id) references venta(id) on delete cascade;
alter table compra drop constraint compra_vehiculo_id_fkey,
  add constraint compra_vehiculo_id_fkey foreign key (vehiculo_id) references vehiculo(id) on delete cascade;
alter table consignacion drop constraint consignacion_vehiculo_id_fkey,
  add constraint consignacion_vehiculo_id_fkey foreign key (vehiculo_id) references vehiculo(id) on delete cascade;
alter table dano drop constraint dano_vehiculo_id_fkey,
  add constraint dano_vehiculo_id_fkey foreign key (vehiculo_id) references vehiculo(id) on delete cascade;
alter table documento drop constraint documento_vehiculo_id_fkey,
  add constraint documento_vehiculo_id_fkey foreign key (vehiculo_id) references vehiculo(id) on delete cascade;
alter table gasto drop constraint gasto_vehiculo_id_fkey,
  add constraint gasto_vehiculo_id_fkey foreign key (vehiculo_id) references vehiculo(id) on delete cascade;
alter table liquidacion drop constraint liquidacion_vehiculo_id_fkey,
  add constraint liquidacion_vehiculo_id_fkey foreign key (vehiculo_id) references vehiculo(id) on delete cascade;
alter table liquidacion drop constraint liquidacion_cierre_id_fkey,
  add constraint liquidacion_cierre_id_fkey foreign key (cierre_id) references cierre_financiero(id) on delete cascade;
alter table oferta drop constraint oferta_vehiculo_id_fkey,
  add constraint oferta_vehiculo_id_fkey foreign key (vehiculo_id) references vehiculo(id) on delete cascade;
alter table orden_trabajo drop constraint orden_trabajo_vehiculo_id_fkey,
  add constraint orden_trabajo_vehiculo_id_fkey foreign key (vehiculo_id) references vehiculo(id) on delete cascade;
alter table venta drop constraint venta_vehiculo_id_fkey,
  add constraint venta_vehiculo_id_fkey foreign key (vehiculo_id) references vehiculo(id) on delete cascade;
alter table comision drop constraint comision_venta_id_fkey,
  add constraint comision_venta_id_fkey foreign key (venta_id) references venta(id) on delete cascade;
alter table reapertura drop constraint reapertura_cierre_id_fkey,
  add constraint reapertura_cierre_id_fkey foreign key (cierre_id) references cierre_financiero(id) on delete cascade;

-- SET NULL (el registro relacionado sigue siendo válido sin esa unidad
-- puntual — un prospecto/cita no deja de existir porque el carro que le
-- interesaba se dio de baja, y una venta no deja de ser real porque el
-- vehículo tomado a cuenta se elimine después por separado):
alter table evaluacion_puja drop constraint evaluacion_puja_vehiculo_id_fkey,
  add constraint evaluacion_puja_vehiculo_id_fkey foreign key (vehiculo_id) references vehiculo(id) on delete set null;
alter table cita drop constraint cita_vehiculo_id_fkey,
  add constraint cita_vehiculo_id_fkey foreign key (vehiculo_id) references vehiculo(id) on delete set null;
alter table prospecto drop constraint prospecto_vehiculo_id_fkey,
  add constraint prospecto_vehiculo_id_fkey foreign key (vehiculo_id) references vehiculo(id) on delete set null;
alter table venta drop constraint venta_veh_tomado_id_fkey,
  add constraint venta_veh_tomado_id_fkey foreign key (veh_tomado_id) references vehiculo(id) on delete set null;

-- La policy vehiculo_delete (solo admin, migración 003) ya existía y ya
-- restringía el borrado correctamente — lo único que faltaba era que los
-- FK de arriba lo dejaban rechazar siempre por tener filas dependientes.
