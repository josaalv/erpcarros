-- Subida de archivos en Documentación + categorías (tipo_documento)
-- personalizadas creadas desde la propia pantalla.

alter table tipo_documento add column es_personalizado boolean not null default false;
alter table documento add column archivo_path text;

-- catalogo_admin/catalogo_admin_upd eran admin-only; se amplía a
-- admin_o_gerencia para que coincida con quién puede editar el checklist
-- de documentos (documento_rw ya usa ese mismo nivel).
drop policy if exists catalogo_admin on tipo_documento;
drop policy if exists catalogo_admin_upd on tipo_documento;
create policy catalogo_admin on tipo_documento for insert to authenticated with check (es_admin_o_gerencia());
create policy catalogo_admin_upd on tipo_documento for update to authenticated using (es_admin_o_gerencia()) with check (es_admin_o_gerencia());

-- Borrar categoría: solo las personalizadas (las 8 originales del
-- checklist obligatorio no se tocan desde la UI). Si hay documentos
-- ligados, el FK de documento.tipo_documento_id lo impide solo — no hace
-- falta lógica extra para no dejar archivos huérfanos.
create policy catalogo_admin_del on tipo_documento for delete to authenticated
  using (es_admin_o_gerencia() and es_personalizado = true);

-- Bucket privado para los archivos. admin/gerencia son quienes editan el
-- checklist (documento_rw), así que son quienes suben/ven/borran archivos.
insert into storage.buckets (id, name, public)
values ('documentos-vehiculo', 'documentos-vehiculo', false)
on conflict (id) do nothing;

create policy documentos_vehiculo_select on storage.objects for select to authenticated
  using (bucket_id = 'documentos-vehiculo' and es_admin_o_gerencia());
create policy documentos_vehiculo_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos-vehiculo' and es_admin_o_gerencia());
create policy documentos_vehiculo_update on storage.objects for update to authenticated
  using (bucket_id = 'documentos-vehiculo' and es_admin_o_gerencia())
  with check (bucket_id = 'documentos-vehiculo' and es_admin_o_gerencia());
create policy documentos_vehiculo_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documentos-vehiculo' and es_admin_o_gerencia());
