-- Carga rápida del "Listado de Unidades a Subastar" (Posibles ofertas).
-- El listado trae por unidad más de lo que guardaba evaluacion_puja: stock,
-- serie, color, puertas, equipamiento, vendedor y los datos de la factura de
-- origen. Se guardan para no tener que volver al PDF y para pasarlos a la
-- unidad al "Adquirir". Las fotos (Dropbox) se ligan por número de stock.

alter table public.evaluacion_puja add column if not exists stock text;
alter table public.evaluacion_puja add column if not exists vin text;
alter table public.evaluacion_puja add column if not exists color text;
alter table public.evaluacion_puja add column if not exists puertas smallint;
alter table public.evaluacion_puja add column if not exists equipamiento text;
alter table public.evaluacion_puja add column if not exists transmision text;
alter table public.evaluacion_puja add column if not exists vendedor text;
alter table public.evaluacion_puja add column if not exists valor_factura numeric(12,2);
alter table public.evaluacion_puja add column if not exists fecha_factura date;
alter table public.evaluacion_puja add column if not exists info_documentos text;

create index if not exists evaluacion_puja_subasta_stock_idx on public.evaluacion_puja (subasta_id, stock);

-- Enlace a la carpeta compartida de Dropbox con las fotos de la subasta.
alter table public.subasta add column if not exists enlace_fotos text;
