-- El comisionista puede crear cliente (cliente_insert) pero cliente_select
-- solo permitia admin/gerencia, lo que rompia el portal de comisionista:
-- no podia ver el nombre/telefono del cliente que el mismo referio via
-- prospecto. Se agrega acceso acotado a sus propios referidos.
create policy cliente_select_propio on cliente for select to authenticated
  using (
    current_rol() = 'comisionista'
    and exists (
      select 1 from prospecto p
      where p.cliente_id = cliente.id and p.comisionista_id = mi_comisionista_id()
    )
  );
