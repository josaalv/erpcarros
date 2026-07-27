<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Codigo 12 del esquema: el bloqueo de gastos tras el cierre no puede
     * vivir solo en la aplicacion (RN-20, RN-21). Un script, una
     * importacion o un error lo saltarian; el disparador lo impide siempre.
     * El mismo patron se replica en venta y liquidacion.
     */
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            CREATE TRIGGER trg_gasto_bloqueo_cierre
            BEFORE INSERT ON gasto FOR EACH ROW
            BEGIN
                IF EXISTS (SELECT 1 FROM cierre_financiero c
                    WHERE c.vehiculo_id = NEW.vehiculo_id
                    AND c.estado = 'cerrado'
                    AND c.deleted_at IS NULL) THEN
                    SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'Vehiculo con cierre financiero: reabrir antes de gastar';
                END IF;
            END
        SQL);

        DB::unprepared(<<<'SQL'
            CREATE TRIGGER trg_gasto_bloqueo_cierre_upd
            BEFORE UPDATE ON gasto FOR EACH ROW
            BEGIN
                IF EXISTS (SELECT 1 FROM cierre_financiero c
                    WHERE c.vehiculo_id = NEW.vehiculo_id
                    AND c.estado = 'cerrado'
                    AND c.deleted_at IS NULL)
                    AND (NEW.importe <> OLD.importe OR NEW.categoria_id <> OLD.categoria_id) THEN
                    SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'Cierre financiero activo: importe inmutable';
                END IF;
            END
        SQL);

        DB::unprepared(<<<'SQL'
            CREATE TRIGGER trg_venta_bloqueo_cierre_upd
            BEFORE UPDATE ON venta FOR EACH ROW
            BEGIN
                IF EXISTS (SELECT 1 FROM cierre_financiero c
                    WHERE c.vehiculo_id = NEW.vehiculo_id
                    AND c.estado = 'cerrado'
                    AND c.deleted_at IS NULL)
                    AND (NEW.precio_acordado <> OLD.precio_acordado) THEN
                    SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'Cierre financiero activo: precio acordado inmutable';
                END IF;
            END
        SQL);

        DB::unprepared(<<<'SQL'
            CREATE TRIGGER trg_liquidacion_bloqueo_cierre_upd
            BEFORE UPDATE ON liquidacion FOR EACH ROW
            BEGIN
                IF EXISTS (SELECT 1 FROM cierre_financiero c
                    WHERE c.id = NEW.cierre_id
                    AND c.estado = 'cerrado'
                    AND c.deleted_at IS NULL)
                    AND (NEW.utilidad_asignada <> OLD.utilidad_asignada
                        OR NEW.monto_a_pagar <> OLD.monto_a_pagar
                        OR NEW.participacion <> OLD.participacion) THEN
                    SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'Cierre financiero activo: liquidacion inmutable, solo pagado/fecha_pago';
                END IF;
            END
        SQL);
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS trg_liquidacion_bloqueo_cierre_upd');
        DB::unprepared('DROP TRIGGER IF EXISTS trg_venta_bloqueo_cierre_upd');
        DB::unprepared('DROP TRIGGER IF EXISTS trg_gasto_bloqueo_cierre_upd');
        DB::unprepared('DROP TRIGGER IF EXISTS trg_gasto_bloqueo_cierre');
    }
};
