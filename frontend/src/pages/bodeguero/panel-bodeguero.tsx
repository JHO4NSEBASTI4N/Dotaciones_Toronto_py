// src/pages/bodeguero/panel.tsx
//
// "Mi bodega": existencias, productos bajo mínimo y los últimos movimientos.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardCheck, Package, RefreshCw, SlidersHorizontal, TriangleAlert } from "../../components/iconos";

import { inventario, traerTodo } from "../../services/api";
import { useSesion } from "../../context/sesion-contexto";
import {
  Aviso,
  BarraListado,
  EncabezadoModulo,
  EtiquetaEstado,
  FilaIndicadores,
  Indicador,
  TablaCargando,
  TablaVacia,
  fecha,
} from "../../components/indicadores";
import type { MovimientoInventario, StockPorProducto } from "../../types";

export default function PanelBodeguero() {
  const { usuario } = useSesion();

  const [stock, setStock] = useState<StockPorProducto[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const [existencias, movs] = await Promise.all([
        traerTodo((saltar, limite) => inventario.stock(saltar, limite)),
        inventario.movimientos(0, 8),
      ]);

      setStock(existencias.items);
      setMovimientos(movs.items);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cargar la bodega.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const resumen = useMemo(() => {
    const activos = stock.filter((fila) => !fila.inhabilitado);

    return {
      productos: activos.length,
      unidades: activos.reduce((suma, fila) => suma + fila.stock_total, 0),
      bajoMinimo: activos.filter((fila) => fila.bajo_minimo).length,
      agotados: activos.filter((fila) => fila.stock_total === 0).length,
    };
  }, [stock]);

  const criticos = useMemo(
    () => stock.filter((fila) => fila.bajo_minimo).slice(0, 6),
    [stock]
  );

  const iconoMovimiento = (tipo: string | null) => {
    if (tipo === "ENTRADA") return <ArrowDownToLine size={14} />;
    if (tipo === "SALIDA") return <ArrowUpFromLine size={14} />;
    return <SlidersHorizontal size={14} />;
  };

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Bodega"
        titulo="Mi bodega"
        descripcion="Cuánto hay, qué falta y qué se movió. Las salidas se descuentan cuando se entrega un pedido."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "bodeguero" } : undefined}
        accion={
          <button
            type="button"
            className="dt-accion-principal"
            onClick={() => void cargarDatos()}
            disabled={cargando}
          >
            <RefreshCw size={15} className={cargando ? "dt-girando" : ""} />
            Actualizar
          </button>
        }
      />

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}

      <FilaIndicadores>
        <Indicador etiqueta="Productos" valor={resumen.productos} descripcion="Con inventario activo" icono={Package} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Unidades" valor={resumen.unidades} descripcion="Total en bodega" icono={Boxes} tono="verde" cargando={cargando} />
        <Indicador etiqueta="Bajo mínimo" valor={resumen.bajoMinimo} descripcion="Hay que reponer" icono={AlertTriangle} tono={resumen.bajoMinimo > 0 ? "rojo" : "ambar"} cargando={cargando} />
        <Indicador etiqueta="Agotados" valor={resumen.agotados} descripcion="Sin unidades" icono={TriangleAlert} tono="rojo" cargando={cargando} />
      </FilaIndicadores>

      <div className="dt-grid-dashboard">
        <section className="dt-panel">
          <div className="dt-panel-encabezado">
            <AlertTriangle size={17} />
            <div>
              <h2>Productos bajo mínimo</h2>
              <p>Prioridad de reposición</p>
            </div>
          </div>

          <div className="dt-panel-cuerpo">
            {cargando ? (
              <TablaCargando mensaje="Revisando existencias…" />
            ) : criticos.length === 0 ? (
              <TablaVacia
                titulo="Todo con stock suficiente"
                mensaje="Ningún producto está por debajo de su mínimo."
                Icono={ClipboardCheck}
              />
            ) : (
              <div className="dt-lista-actividad">
                {criticos.map((fila) => (
                  <div key={fila.id_producto} className="dt-actividad">
                    <span className="dt-avatar-fila">
                      <Package size={15} />
                    </span>

                    <div>
                      <strong>{fila.nombre}</strong>
                      <span>
                        {fila.categoria ?? "Sin categoría"} · mínimo {fila.stock_minimo}
                      </span>
                    </div>

                    <span className="dt-actividad-valor">{fila.stock_total} u.</span>

                    <EtiquetaEstado
                      tipo={fila.stock_total === 0 ? "inactivo" : "pendiente"}
                      texto={fila.stock_total === 0 ? "Agotado" : "Bajo mínimo"}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="dt-panel">
          <div className="dt-panel-encabezado">
            <SlidersHorizontal size={17} />
            <div>
              <h2>Últimos movimientos</h2>
              <p>Entradas, salidas y ajustes</p>
            </div>
          </div>

          <div className="dt-panel-cuerpo">
            {cargando ? (
              <TablaCargando mensaje="Consultando movimientos…" />
            ) : movimientos.length === 0 ? (
              <TablaVacia
                titulo="Sin movimientos"
                mensaje="Aún no se registran entradas ni salidas."
                Icono={SlidersHorizontal}
              />
            ) : (
              <div className="dt-lista-actividad">
                {movimientos.map((movimiento) => (
                  <div key={movimiento.id} className="dt-actividad">
                    <span className="dt-avatar-fila">
                      {iconoMovimiento(movimiento.tipo_movimiento)}
                    </span>

                    <div>
                      <strong>{movimiento.nombre_producto ?? "Producto"}</strong>
                      <span>
                        {movimiento.tipo_movimiento} · {fecha(movimiento.fecha_hora)}
                      </span>
                    </div>

                    <span className="dt-actividad-valor">
                      {movimiento.cantidad} u.
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section style={{ marginTop: 14 }}>
        <BarraListado
          titulo="Ir al inventario completo"
          descripcion="Registrar entradas, salidas y ajustes"
          Icono={Boxes}
        >
          <Link to="/bodeguero/inventario" className="dt-boton-secundario">
            Abrir inventario
          </Link>
          <Link to="/bodeguero/alertas" className="dt-boton-secundario">
            Ver alertas
          </Link>
        </BarraListado>
      </section>
    </section>
  );
}
