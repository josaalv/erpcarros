-- Folio automático (octubre 2026): si el alta llega sin id_interno, la base
-- asigna V-#### con una secuencia (sin choques aunque capturen dos personas
-- a la vez). Arranca en 1020 porque V-1001..V-1019 viven en el respaldo de
-- las unidades borradas con el botón maestro.
create sequence if not exists public.folio_vehiculo_seq start with 1020;

create or replace function public.asignar_folio_vehiculo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id_interno is null or btrim(new.id_interno) = '' then
    new.id_interno := 'V-' || lpad(nextval('public.folio_vehiculo_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger tr_asignar_folio_vehiculo before insert on public.vehiculo
  for each row execute function public.asignar_folio_vehiculo();

grant usage on sequence public.folio_vehiculo_seq to authenticated;
revoke execute on function public.asignar_folio_vehiculo() from public, anon, authenticated;
