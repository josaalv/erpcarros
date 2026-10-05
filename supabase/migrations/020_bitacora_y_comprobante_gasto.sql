-- Bitácora de cambios + proveedor y comprobante en cada gasto.
--
-- bitacora: una fila por alta / cambio / baja en las tablas donde se mueve
-- dinero o datos de la unidad. Para cambios guarda solo los campos que
-- cambiaron como {campo: [antes, después]}; para altas y bajas, la fila
-- completa. La escribe un trigger security definer (los usuarios no pueden
-- insertar, editar ni borrar en ella: no tiene policies de escritura) y solo
-- el admin la lee.
--
-- El trigger de BAJAS se instala aparte (020b_bitacora_bajas.sql): el
-- conector MCP no puede aplicar sentencias que contengan la palabra de
-- borrado, así que ese archivo se pega a mano en el SQL Editor.

create table if not exists public.bitacora (
  id            bigint generated always as identity primary key,
  tabla         text not null,
  registro_id   bigint,
  vehiculo_id   bigint,
  accion        text not null check (accion in ('alta', 'cambio', 'baja')),
  cambios       jsonb not null,
  usuario_id    uuid,
  usuario_nombre text,
  es_demo       boolean not null default false,
  ocurrido      timestamptz not null default now()
);

create index if not exists bitacora_vehiculo_idx on public.bitacora (vehiculo_id, ocurrido desc);
create index if not exists bitacora_ocurrido_idx on public.bitacora (ocurrido desc);

alter table public.bitacora enable row level security;

create policy bitacora_select_admin on public.bitacora
  for select to authenticated
  using (es_admin() and es_demo = es_demo_actual());

create or replace function public.registrar_bitacora()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuevo   jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_viejo   jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_fila    jsonb := coalesce(v_nuevo, v_viejo);
  v_cambios jsonb;
  v_veh     bigint;
  v_uid     uuid := (select auth.uid());
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_array(v_viejo -> n.key, n.value))
      into v_cambios
      from jsonb_each(v_nuevo) n
     where n.key not in ('created_at', 'actualizado')
       and (v_viejo -> n.key) is distinct from n.value;
    if v_cambios is null then
      return null;  -- update sin cambios reales: no ensucia la bitácora
    end if;
  else
    v_cambios := v_fila - 'created_at';
  end if;

  v_veh := case
    when tg_table_name = 'vehiculo' then (v_fila ->> 'id')::bigint
    when v_fila ? 'vehiculo_id' then (v_fila ->> 'vehiculo_id')::bigint
    when tg_table_name = 'comision' then (select vehiculo_id from venta where id = (v_fila ->> 'venta_id')::bigint)
  end;

  insert into bitacora (tabla, registro_id, vehiculo_id, accion, cambios, usuario_id, usuario_nombre, es_demo)
  values (
    tg_table_name,
    (v_fila ->> 'id')::bigint,
    v_veh,
    case tg_op when 'INSERT' then 'alta' when 'UPDATE' then 'cambio' else 'baja' end,
    v_cambios,
    v_uid,
    (select nombre from perfil where id = v_uid),
    coalesce((v_fila ->> 'es_demo')::boolean, false)
  );
  return null;
end;
$$;

revoke execute on function public.registrar_bitacora() from public, anon, authenticated;

-- Altas y cambios (las bajas: ver 020b).
do $$
declare t text;
begin
  foreach t in array array['vehiculo', 'compra', 'gasto', 'aportacion', 'venta', 'comision', 'cierre_financiero', 'liquidacion', 'socio']
  loop
    execute format('create or replace trigger bitacora_%1$s after insert or update on public.%1$I for each row execute function public.registrar_bitacora()', t);
  end loop;
end $$;

-- Gasto: a quién se le pagó y su comprobante (foto o PDF en Storage, mismo
-- bucket privado que la documentación: documentos-vehiculo/<vehiculo>/gastos/...).
alter table public.gasto add column if not exists proveedor_id bigint references public.proveedor (id);
alter table public.gasto add column if not exists comprobante_path text;
create index if not exists gasto_proveedor_idx on public.gasto (proveedor_id);
