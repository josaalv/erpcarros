-- Registra también las BAJAS en la bitácora (complemento de 020).
-- Se aplica a mano en Supabase → SQL Editor: el conector MCP no puede aplicar
-- sentencias que mencionen borrados (se queda esperando una confirmación que
-- en sesiones en la nube nunca llega). Es idempotente: se puede correr de nuevo.

do $$
declare t text;
begin
  foreach t in array array['vehiculo', 'compra', 'gasto', 'aportacion', 'venta', 'comision', 'cierre_financiero', 'liquidacion', 'socio']
  loop
    execute format('create or replace trigger bitacora_baja_%1$s after delete on public.%1$I for each row execute function public.registrar_bitacora()', t);
  end loop;
end $$;
