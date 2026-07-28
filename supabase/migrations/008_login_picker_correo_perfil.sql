-- Selector de perfiles en el login (como en robsen-salon): necesita mostrar
-- nombre/rol de las cuentas activas ANTES de autenticar (contexto anon), y
-- el correo para poder llamar signInWithPassword una vez que la persona
-- eligió su perfil y escribió su contraseña.
--
-- perfil no guardaba correo (vivía solo en auth.users, que anon no puede
-- leer). Se agrega la columna, se backfillea desde auth.users, y el
-- trigger de alta la mantiene sincronizada. La exposición a anon se hace
-- con una función SECURITY DEFINER de columnas curadas (mismo patrón ya
-- probado en robsen-salon: primero se intentó con una vista, pero el
-- advisor de seguridad la marca como riesgo si no declara
-- security_invoker, y con security_invoker el picker queda vacío porque
-- anon no tiene policy de SELECT sobre perfil) — una función evita ambos
-- problemas.

alter table perfil add column correo text;

update perfil p set correo = u.email
from auth.users u
where u.id = p.id and p.correo is null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfil (id, nombre, rol, correo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    case when (select count(*) from public.perfil) = 0 then 'admin' else 'gerencia' end,
    new.email
  );
  return new;
end;
$$;

create or replace function public.listar_perfiles_publicos()
returns table(id uuid, nombre text, rol text, correo text)
language sql security definer stable
set search_path = public
as $$
  select p.id, p.nombre, p.rol, p.correo
  from perfil p
  where p.activo = true
$$;

grant execute on function public.listar_perfiles_publicos() to anon;
