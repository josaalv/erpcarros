-- Semillas de demo para el esquema de taller, comercial y cierre
-- (tabla tipo_documento, subestado_taller, lote, documento, orden_trabajo,
-- consignacion, comisionista, cliente, prospecto). Todo es_demo = true.

insert into tipo_documento (clave, nombre, obligatorio, confidencial, orden) values
('factura','Factura original',true,true,10),
('endosos','Endoso o cadena de facturas',true,true,20),
('tarjeta','Tarjeta de circulación',true,true,30),
('tenencias','Tenencias y refrendos pagados',true,true,40),
('placas','Alta y placas nuevas',true,true,50),
('contrato','Contrato de compraventa',true,true,60),
('reporte_subasta','Reporte de subasta',false,true,70),
('otros','Otro documento',false,true,900)
on conflict (clave) do nothing;

insert into subestado_taller (clave, nombre) values
('hojalateria','Hojalatería'),('laminado','Laminado'),('pintura','Pintura'),
('servicio_externo','Servicio externo'),('espera_piezas','Espera de piezas'),('retrabajo','Retrabajo')
on conflict (clave) do nothing;

insert into lote (nombre, contacto, es_demo) values ('Lote Guadalajara Sur', 'Encargado de piso', true);

-- Documentos: V-0142 en tramite (faltan 2), el resto completos.
insert into documento (vehiculo_id, tipo_documento_id, estado, es_demo)
select v.id, td.id,
  case when v.id_interno = 'V-0142' and td.orden > 40 then 'faltante' else 'completo' end,
  true
from vehiculo v
cross join tipo_documento td
where v.es_demo = true and td.obligatorio = true;

-- Orden de trabajo: V-0142 esta en reparacion.
insert into orden_trabajo (folio, vehiculo_id, tipo, descripcion, estado, es_demo)
select 'OT-0001', v.id, 'interna', 'Pintura general', 'en_proceso', true
from vehiculo v where v.id_interno = 'V-0142';

-- Consignacion para las unidades con canal_venta = consignacion.
insert into consignacion (vehiculo_id, lote_id, precio_asignado, fecha_envio, estado, es_demo)
select v.id, (select id from lote where es_demo = true limit 1), v.precio_autorizado, v.fecha_compra,
  case when v.id_interno = 'V-0149' then 'en_consignacion' else 'en_consignacion' end, true
from vehiculo v where v.canal_venta = 'consignacion';

-- Comisionista, cliente y prospecto de demo.
insert into comisionista (nombre, ver_comisiones, es_demo) values ('Daniel', true, true);

insert into cliente (nombre, telefono, origen, es_demo) values
('Familia Rentería', '3312345678', 'referido', true),
('Cliente del lote', null, 'lote', true);

insert into prospecto (cliente_id, vehiculo_id, comisionista_id, etapa, fecha_registro, vence_atribucion, es_demo)
select c.id, v.id, com.id, 'cita', current_date - 9, current_date + 6, true
from cliente c, vehiculo v, comisionista com
where c.nombre = 'Familia Rentería' and v.id_interno = 'V-0142' and com.nombre = 'Daniel';
