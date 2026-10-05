-- Registra en la bitácora cuando se BORRA un cobro (complemento de 022).
-- Se pega a mano en Supabase → SQL Editor (el conector MCP no aplica
-- sentencias que mencionen borrados). Se puede correr más de una vez.
create or replace trigger bitacora_baja_cobro after delete on public.cobro
  for each row execute function public.registrar_bitacora();
