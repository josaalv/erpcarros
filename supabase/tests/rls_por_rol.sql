-- Pruebas negativas de permisos (RLS) por rol. Todo corre dentro de una
-- transacción que se deshace al final: no deja datos.
--
-- Cómo correrlo: pegar completo en Supabase → SQL Editor, o vía MCP
-- execute_sql. Si algo falla, termina con un error que lista TODAS las fallas;
-- si todo pasa, devuelve una fila con resultado = 'OK'.
--
-- Usa la cuenta de demostración (rol demo) y le cambia el rol dentro de la
-- transacción para probar gerencia y comisionista (no hace falta tener
-- cuentas reales con esos roles). No usa borrados a propósito: el conector
-- MCP no puede ejecutar sentencias que los contengan.

begin;

-- ── Datos de prueba (como dueño de la base; se deshacen al final) ─────
insert into vehiculo (id_interno, marca, modelo, anio, estado_proceso_id, ubicacion_id, precio_minimo, precio_autorizado)
values ('PRUEBA-RLS', 'Prueba', 'RLS', 2022,
        (select id from estado_proceso where clave = 'comprado'),
        (select id from ubicacion where clave = 'traslado'), 90000, 120000);
insert into compra (vehiculo_id, precio, comision)
  select id, 80000, 5000 from vehiculo where id_interno = 'PRUEBA-RLS';
insert into gasto (vehiculo_id, categoria_id, descripcion, importe, fecha, pagador_tipo)
  select v.id, (select id from categoria_gasto order by id limit 1), 'Prueba RLS', 1000, current_date, 'empresa'
  from vehiculo v where id_interno = 'PRUEBA-RLS';
insert into socio (nombre) values ('Socio prueba RLS');
insert into aportacion (vehiculo_id, socio_id, monto, fecha)
  select v.id, s.id, 85000, current_date from vehiculo v, socio s
  where v.id_interno = 'PRUEBA-RLS' and s.nombre = 'Socio prueba RLS';
update compra set precio = 81000 where vehiculo_id = (select id from vehiculo where id_interno = 'PRUEBA-RLS');  -- deja una fila en bitacora

create temporary table prueba_resultado (rol text, falla text);
grant insert on prueba_resultado to authenticated, anon;

-- Cuenta que se usará para gerencia / comisionista / demo.
create temporary table prueba_cuenta as select id from perfil where rol = 'demo' order by id limit 1;
grant select on prueba_cuenta to authenticated, anon;

-- Bloque de comprobaciones que no deben ver nada de dinero (gerencia,
-- comisionista, demo). Se repite por rol con la misma lista.
-- ── GERENCIA ──────────────────────────────────────────────────────────
update perfil set rol = 'gerencia' where id = (select id from prueba_cuenta);
select set_config('request.jwt.claims', json_build_object('sub', (select id from prueba_cuenta), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r text := 'gerencia';
begin
  if not exists (select 1 from v_vehiculo_ficha where id_interno = 'PRUEBA-RLS') then
    insert into prueba_resultado values (r, 'no ve la unidad en v_vehiculo_ficha (debería verla)');
  end if;
  if exists (select 1 from v_vehiculo_ficha where precio_minimo is not null or costo_total is not null or utilidad is not null or margen is not null) then
    insert into prueba_resultado values (r, 've precio mínimo / costo / utilidad en v_vehiculo_ficha');
  end if;
  begin
    if exists (select 1 from vehiculo where precio_minimo is not null) then
      insert into prueba_resultado values (r, 'lee precio_minimo directo de la tabla vehiculo');
    end if;
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from compra) then insert into prueba_resultado values (r, 've compra'); end if;
  if exists (select 1 from gasto) then insert into prueba_resultado values (r, 've gasto'); end if;
  if exists (select 1 from aportacion) then insert into prueba_resultado values (r, 've aportacion'); end if;
  if exists (select 1 from socio) then insert into prueba_resultado values (r, 've socio'); end if;
  if exists (select 1 from cierre_financiero) then insert into prueba_resultado values (r, 've cierre_financiero'); end if;
  if exists (select 1 from liquidacion) then insert into prueba_resultado values (r, 've liquidacion'); end if;
  if exists (select 1 from bitacora) then insert into prueba_resultado values (r, 've bitacora'); end if;
  if exists (select 1 from v_costo_vehiculo where costo_total > 0) then insert into prueba_resultado values (r, 've costos en v_costo_vehiculo'); end if;
  if exists (select 1 from v_participacion_socio where capital_aportado > 0) then insert into prueba_resultado values (r, 've capital en v_participacion_socio'); end if;
  if exists (select 1 from v_roi_segmento) then insert into prueba_resultado values (r, 've v_roi_segmento'); end if;
  begin
    insert into compra (vehiculo_id, precio) select id, 1 from vehiculo where id_interno = 'PRUEBA-RLS';
    insert into prueba_resultado values (r, 'pudo insertar en compra');
  exception when insufficient_privilege then null;
  end;
  begin
    perform cerrar_financiero(0);
    insert into prueba_resultado values (r, 'pudo llamar cerrar_financiero');
  exception when others then
    if sqlerrm not like 'Solo el administrador%' then
      insert into prueba_resultado values (r, 'cerrar_financiero falló por otra razón: ' || sqlerrm);
    end if;
  end;
end $$;
reset role;

-- ── COMISIONISTA ──────────────────────────────────────────────────────
update perfil set rol = 'comisionista' where id = (select id from prueba_cuenta);
set local role authenticated;
do $$
declare r text := 'comisionista';
begin
  if exists (select 1 from v_vehiculo_ficha where precio_minimo is not null or costo_total is not null or utilidad is not null or margen is not null) then
    insert into prueba_resultado values (r, 've precio mínimo / costo / utilidad en v_vehiculo_ficha');
  end if;
  begin
    if exists (select 1 from vehiculo where precio_minimo is not null) then
      insert into prueba_resultado values (r, 'lee precio_minimo directo de la tabla vehiculo');
    end if;
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from compra) then insert into prueba_resultado values (r, 've compra'); end if;
  if exists (select 1 from gasto) then insert into prueba_resultado values (r, 've gasto'); end if;
  if exists (select 1 from aportacion) then insert into prueba_resultado values (r, 've aportacion'); end if;
  if exists (select 1 from socio) then insert into prueba_resultado values (r, 've socio'); end if;
  if exists (select 1 from venta) then insert into prueba_resultado values (r, 've venta'); end if;
  if exists (select 1 from cliente) then insert into prueba_resultado values (r, 've clientes que no refirió'); end if;
  if exists (select 1 from bitacora) then insert into prueba_resultado values (r, 've bitacora'); end if;
  if exists (select 1 from v_costo_vehiculo where costo_total > 0) then insert into prueba_resultado values (r, 've costos en v_costo_vehiculo'); end if;
  if exists (select 1 from v_participacion_socio where capital_aportado > 0) then insert into prueba_resultado values (r, 've capital en v_participacion_socio'); end if;
  begin
    update vehiculo set precio_autorizado = 1 where id_interno = 'PRUEBA-RLS';
    if found then insert into prueba_resultado values (r, 'pudo cambiar el precio de una unidad'); end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ── DEMO (no debe ver datos reales) ───────────────────────────────────
update perfil set rol = 'demo' where id = (select id from prueba_cuenta);
set local role authenticated;
do $$
declare r text := 'demo';
begin
  if exists (select 1 from v_vehiculo_ficha where id_interno = 'PRUEBA-RLS') then
    insert into prueba_resultado values (r, 've una unidad real');
  end if;
  if exists (select 1 from vehiculo where not es_demo) then insert into prueba_resultado values (r, 've unidades reales en vehiculo'); end if;
  if exists (select 1 from compra) then insert into prueba_resultado values (r, 've compra'); end if;
end $$;
reset role;

-- ── ANÓNIMO (sin sesión) ──────────────────────────────────────────────
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare r text := 'anon';
begin
  begin
    if exists (select 1 from vehiculo) then insert into prueba_resultado values (r, 've vehiculo'); end if;
  exception when insufficient_privilege then null;
  end;
  begin
    if exists (select 1 from v_vehiculo_ficha) then insert into prueba_resultado values (r, 've v_vehiculo_ficha'); end if;
  exception when insufficient_privilege then null;
  end;
  begin
    if exists (select 1 from v_costo_vehiculo) then insert into prueba_resultado values (r, 've v_costo_vehiculo'); end if;
  exception when insufficient_privilege then null;
  end;
  begin
    if exists (select 1 from perfil) then insert into prueba_resultado values (r, 've perfil'); end if;
  exception when insufficient_privilege then null;
  end;
  begin
    if exists (select 1 from compra) then insert into prueba_resultado values (r, 've compra'); end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ── ADMIN (control: sí debe ver todo) ─────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', (select id from perfil where rol = 'admin' and activo order by id limit 1), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r text := 'admin';
begin
  if not exists (select 1 from v_vehiculo_ficha where id_interno = 'PRUEBA-RLS' and precio_minimo = 90000 and costo_total = 87000) then
    insert into prueba_resultado values (r, 'no ve precio mínimo / costo correcto (control)');
  end if;
  begin
    perform precio_minimo from vehiculo limit 1;
    insert into prueba_resultado values (r, 'lee precio_minimo directo de la tabla (debería ser solo por la vista)');
  exception when insufficient_privilege then null;
  end;
  if not exists (select 1 from bitacora where tabla = 'compra') then
    insert into prueba_resultado values (r, 'no ve la bitácora (control)');
  end if;
end $$;
reset role;

do $$
declare fallas text;
begin
  select string_agg(rol || ': ' || falla, E'\n' order by rol) into fallas from prueba_resultado;
  if fallas is not null then
    raise exception E'Pruebas de RLS con fallas:\n%', fallas;
  end if;
end $$;

select 'OK' as resultado;
rollback;
