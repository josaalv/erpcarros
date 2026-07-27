<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Codigo 13 del esquema: los totales que nunca se almacenan. Al ser
     * vistas y no columnas, no pueden desincronizarse.
     */
    public function up(): void
    {
        // Costo acumulado por unidad: compra + todos los gastos vivos.
        DB::statement(<<<'SQL'
            CREATE OR REPLACE VIEW v_costo_vehiculo AS
            SELECT v.id AS vehiculo_id,
                COALESCE(c.precio,0) + COALESCE(c.comision,0)
                    + COALESCE(c.impuestos,0) + COALESCE(c.iva,0) AS costo_adquisicion,
                COALESCE(g.total_gastos,0) AS total_gastos,
                COALESCE(c.precio,0) + COALESCE(c.comision,0)
                    + COALESCE(c.impuestos,0) + COALESCE(c.iva,0)
                    + COALESCE(g.total_gastos,0) AS costo_total,
                COALESCE(g.pendientes,0) AS gastos_pendientes
            FROM vehiculo v
            LEFT JOIN compra c ON c.vehiculo_id = v.id AND c.deleted_at IS NULL
            LEFT JOIN (
                SELECT vehiculo_id,
                    SUM(importe) AS total_gastos,
                    SUM(CASE WHEN estado_pago = 'pendiente' THEN 1 ELSE 0 END) AS pendientes
                FROM gasto WHERE deleted_at IS NULL
                GROUP BY vehiculo_id
            ) g ON g.vehiculo_id = v.id
            WHERE v.deleted_at IS NULL
        SQL);

        // Dias de inventario: desde la compra, no desde el ingreso (RN-04).
        DB::statement(<<<'SQL'
            CREATE OR REPLACE VIEW v_inventario_dias AS
            SELECT v.id AS vehiculo_id,
                v.id_interno, v.marca, v.modelo, v.anio,
                v.fecha_compra,
                COALESCE(v.fecha_entrega, CURDATE()) AS hasta,
                DATEDIFF(COALESCE(v.fecha_entrega, CURDATE()), v.fecha_compra) AS dias,
                cv.costo_total,
                CASE WHEN DATEDIFF(COALESCE(v.fecha_entrega, CURDATE()), v.fecha_compra) > 0
                    THEN cv.costo_total /
                        DATEDIFF(COALESCE(v.fecha_entrega, CURDATE()), v.fecha_compra)
                    ELSE NULL END AS costo_por_dia
            FROM vehiculo v
            JOIN v_costo_vehiculo cv ON cv.vehiculo_id = v.id
            WHERE v.deleted_at IS NULL AND v.fecha_compra IS NOT NULL
        SQL);

        // Participacion de socios por unidad, recalculada siempre (RN-07).
        DB::statement(<<<'SQL'
            CREATE OR REPLACE VIEW v_participacion_socio AS
            SELECT a.vehiculo_id, a.socio_id,
                SUM(a.monto) AS capital_aportado,
                SUM(a.monto) / SUM(SUM(a.monto)) OVER (PARTITION BY a.vehiculo_id)
                    AS participacion
            FROM aportacion a
            WHERE a.deleted_at IS NULL
            GROUP BY a.vehiculo_id, a.socio_id
        SQL);

        // ROI historico por segmento: alimenta la advertencia de puja (RN-05).
        DB::statement(<<<'SQL'
            CREATE OR REPLACE VIEW v_roi_segmento AS
            SELECT marca, modelo,
                CASE WHEN costo_total < 110000 THEN 'baja'
                    WHEN costo_total < 180000 THEN 'media'
                    ELSE 'alta' END AS banda,
                COUNT(*) AS unidades,
                AVG(margen) AS margen_promedio,
                AVG(roi) AS roi_promedio,
                AVG(dias_inventario) AS dias_promedio
            FROM cierre_financiero cf
            JOIN vehiculo v ON v.id = cf.vehiculo_id
            WHERE cf.deleted_at IS NULL
            GROUP BY marca, modelo, banda
        SQL);
    }

    public function down(): void
    {
        DB::statement('DROP VIEW IF EXISTS v_roi_segmento');
        DB::statement('DROP VIEW IF EXISTS v_participacion_socio');
        DB::statement('DROP VIEW IF EXISTS v_inventario_dias');
        DB::statement('DROP VIEW IF EXISTS v_costo_vehiculo');
    }
};
