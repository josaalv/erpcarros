insert into estado_proceso (clave, nombre, orden, es_final) values
('evaluacion','Evaluación en subasta',10,false),
('comprado','Comprado',20,false),
('traslado','En traslado',30,false),
('diagnostico','Diagnóstico',40,false),
('reparacion','En reparación',50,false),
('preparacion','En preparación',60,false),
('listo','Listo para venta',70,false),
('apartado','Apartado',80,false),
('vendido','Vendido / entregado',90,false),
('cerrado','Operación cerrada',100,true),
('cancelado','Cancelado',110,true)
on conflict (clave) do nothing;

insert into ubicacion (clave, nombre, es_externa) values
('subasta','Patio de subasta',true),
('traslado','En traslado',true),
('taller','Taller propio',false),
('exhibicion_taller','Exhibición afuera del taller',false),
('lote_consignacion','Lote a consignación',true),
('proveedor','Proveedor externo',true),
('con_cliente','Con cliente, prueba autorizada',true),
('entregado','Entregado',true),
('temporal','Otra ubicación temporal',true)
on conflict (clave) do nothing;

insert into categoria_gasto (clave, nombre, grupo, es_interno, orden) values
('grua','Grúa y traslado','logistica',false,40),
('almacenaje','Almacenaje','logistica',false,50),
('hojalateria','Hojalatería','taller',true,60),
('laminado','Laminado','taller',true,70),
('pintura','Pintura y materiales','taller',true,80),
('pulida','Pulida y detallado','taller',true,90),
('destajo','Destajo a personal','taller',true,100),
('refacciones','Refacciones y piezas','refacciones',false,110),
('llantas','Llantas y rines','refacciones',false,120),
('cristales','Cristales','refacciones',false,130),
('bateria','Batería','refacciones',false,140),
('mecanica','Servicio mecánico externo','servicios',false,150),
('transmision','Transmisión','servicios',false,160),
('suspension','Suspensión y dirección','servicios',false,170),
('electrico','Eléctrico y diagnóstico','servicios',false,180),
('tapiceria','Tapicería','servicios',false,190),
('placas','Placas y emplacamiento','documentacion',false,200),
('gestoria','Trámites y gestoría','documentacion',false,210),
('tenencias','Tenencias y adeudos','documentacion',false,220),
('kilometraje','Kilometraje','otros',false,230),
('gasolina','Gasolina','otros',false,240),
('comision_venta','Comisión de venta','comercial',false,250),
('gasto_lote','Gasto de lote / piso','comercial',false,260),
('otros','Otros gastos','otros',false,900)
on conflict (clave) do nothing;

-- ── Datos de demostración (es_demo = true), tomados del prototipo de
-- frontend, para que el rol 'demo' tenga algo real que ver.
with v as (
  insert into vehiculo (id_interno, marca, modelo, anio, kilometraje, color, transmision,
    estado_proceso_id, ubicacion_id, estado_comercial, estado_documental, fecha_compra,
    precio_minimo, precio_autorizado, canal_venta, es_demo)
  values
  ('V-0142','Mitsubishi','Mirage',2022,62400,'Blanco','automatica',
    (select id from estado_proceso where clave='reparacion'),
    (select id from ubicacion where clave='taller'),
    'no_publicado','en_tramite','2026-06-02', 168000, 180000, null, true),
  ('V-0143','Mitsubishi','L200',2018,118000,'Gris','manual',
    (select id from estado_proceso where clave='listo'),
    (select id from ubicacion where clave='lote_consignacion'),
    'en_consignacion','completo','2026-05-14', 250000, 268000, 'consignacion', true),
  ('V-0146','Toyota','Avanza',2021,88000,'Gris','manual',
    (select id from estado_proceso where clave='listo'),
    (select id from ubicacion where clave='lote_consignacion'),
    'en_consignacion','completo','2026-01-19', 218000, 232000, 'consignacion', true),
  ('V-0149','Nissan','March',2024,18000,'Rojo','automatica',
    (select id from estado_proceso where clave='apartado'),
    (select id from ubicacion where clave='lote_consignacion'),
    'apartado','completo','2026-07-03', 228000, 238000, 'consignacion', true),
  ('V-0152','Chevrolet','Beat',2020,68000,'Rojo','manual',
    (select id from estado_proceso where clave='vendido'),
    (select id from ubicacion where clave='taller'),
    'vendido','en_tramite','2026-06-26', 132000, 141000, 'comisionista', true)
  returning id, id_interno
)
insert into compra (vehiculo_id, precio, comision, es_demo)
select v.id,
  case v.id_interno
    when 'V-0142' then 95000 when 'V-0143' then 205000 when 'V-0146' then 186000
    when 'V-0149' then 216000 when 'V-0152' then 70000 end,
  5000, true
from v;

insert into gasto (vehiculo_id, categoria_id, descripcion, importe, fecha, es_demo)
select v.id, cg.id, g.descripcion, g.importe::numeric, g.fecha::date, true
from (values
  ('V-0142','pintura','Pintura general','10000','2026-06-18'),
  ('V-0142','laminado','Laminado','3000','2026-06-16'),
  ('V-0142','llantas','Rodado y birlos','6500','2026-06-20'),
  ('V-0142','electrico','Eléctrico','2500','2026-06-11'),
  ('V-0142','placas','Placas y gestoría','6500','2026-06-28'),
  ('V-0142','refacciones','Fascia delantera','2100','2026-06-14'),
  ('V-0142','refacciones','Fascia trasera','1500','2026-06-14'),
  ('V-0142','pulida','Pulida general','2000','2026-07-02'),
  ('V-0142','refacciones','Estéreo','1500','2026-06-19'),
  ('V-0142','bateria','Batería','1400','2026-06-09'),
  ('V-0142','otros','Resto de partidas menores','5580','2026-06-30'),
  ('V-0143','placas','Placas y gestoría','13500','2026-06-05'),
  ('V-0143','pintura','Pintada tapa de cajón','500','2026-05-22'),
  ('V-0143','pulida','Detallado','600','2026-05-30'),
  ('V-0143','refacciones','Tolvas','800','2026-05-24'),
  ('V-0143','mecanica','Cambio de aceite','800','2026-05-26'),
  ('V-0143','gasolina','Gasolina','600','2026-06-01'),
  ('V-0146','placas','Placas y gestoría','10000','2026-02-28'),
  ('V-0146','pintura','Pintura 3 piezas','4500','2026-02-10'),
  ('V-0146','mecanica','Varillaje','3000','2026-02-14'),
  ('V-0146','refacciones','Llaves','3000','2026-02-20'),
  ('V-0146','pulida','Pulida y detallado','2500','2026-03-02'),
  ('V-0146','gasolina','Gasolina','200','2026-02-01'),
  ('V-0152','pintura','Pintura y laminado','12000','2026-07-05'),
  ('V-0152','placas','Placas y gestoría','9800','2026-07-16'),
  ('V-0152','refacciones','Salpicadero y fascia','2530','2026-07-02'),
  ('V-0152','otros','Resto de partidas','12310','2026-07-01')
) as g(id_interno, cat_clave, descripcion, importe, fecha)
join vehiculo v on v.id_interno = g.id_interno and v.es_demo = true
join categoria_gasto cg on cg.clave = g.cat_clave;
