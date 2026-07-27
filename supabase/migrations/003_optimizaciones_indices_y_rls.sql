-- Indices para las FK que el advisor de performance senalo.
create index if not exists ix_aportacion_socio on aportacion(socio_id);
create index if not exists ix_aportacion_vehiculo on aportacion(vehiculo_id);
create index if not exists ix_gasto_categoria on gasto(categoria_id);
create index if not exists ix_gasto_socio on gasto(pagador_socio_id);
create index if not exists ix_gasto_vehiculo on gasto(vehiculo_id);
create index if not exists ix_vehiculo_estado on vehiculo(estado_proceso_id);
create index if not exists ix_vehiculo_ubicacion on vehiculo(ubicacion_id);

-- auth.uid() envuelto en (select ...) para que el planner lo evalue una
-- sola vez por consulta, no por fila.
drop policy perfil_select_propio on perfil;
create policy perfil_select_propio on perfil for select to authenticated
  using (id = (select auth.uid()) or es_admin());

-- Colapsar policies permisivas duplicadas (SELECT ya cubierto por 'for all').
drop policy catalogo_admin on estado_proceso;
create policy catalogo_admin on estado_proceso for insert to authenticated with check (es_admin());
create policy catalogo_admin_upd on estado_proceso for update to authenticated using (es_admin()) with check (es_admin());
create policy catalogo_admin_del on estado_proceso for delete to authenticated using (es_admin());

drop policy catalogo_admin on ubicacion;
create policy catalogo_admin on ubicacion for insert to authenticated with check (es_admin());
create policy catalogo_admin_upd on ubicacion for update to authenticated using (es_admin()) with check (es_admin());
create policy catalogo_admin_del on ubicacion for delete to authenticated using (es_admin());

drop policy catalogo_admin on categoria_gasto;
create policy catalogo_admin on categoria_gasto for insert to authenticated with check (es_admin());
create policy catalogo_admin_upd on categoria_gasto for update to authenticated using (es_admin()) with check (es_admin());
create policy catalogo_admin_del on categoria_gasto for delete to authenticated using (es_admin());

drop policy vehiculo_write on vehiculo;
create policy vehiculo_insert on vehiculo for insert to authenticated with check (es_admin_o_gerencia());
create policy vehiculo_update on vehiculo for update to authenticated
  using (es_admin_o_gerencia() and es_demo = es_demo_actual()) with check (es_admin_o_gerencia());
create policy vehiculo_delete on vehiculo for delete to authenticated
  using (es_admin() and es_demo = es_demo_actual());
