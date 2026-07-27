revoke execute on function public.current_rol() from anon, public;
revoke execute on function public.es_admin() from anon, public;
revoke execute on function public.es_admin_o_gerencia() from anon, public;
revoke execute on function public.es_demo_actual() from anon, public;

-- handle_new_user() es un trigger, no una funcion de uso publico: nadie
-- (ni admin, ni anon) debe poder invocarla directo via RPC.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
