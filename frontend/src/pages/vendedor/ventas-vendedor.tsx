// src/pages/vendedor/ventas.tsx
//
// Ventas emitidas. No se crean a mano (nacen al entregar un pedido); solo se
// consultan y, si hay un error, se anulan.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, CreditCard, Eye, FileText, RefreshCw, Receipt, TrendingUp, X } from "../../components/iconos";

import { numero, pesos, traerTodo, ventas } from "../../services/api";
import { useSesion } from "../../context/sesion-contexto";
import {
  Aviso,
  BarraListado,
  CajaBusqueda,
  EncabezadoModulo,
  EtiquetaEstado,
  FiltroEstado,
  FilaIndicadores,
  Indicador,
  TablaCargando,
  TablaVacia,
  fecha,
  tonoDeEstado,
} from "../../components/indicadores";
import GraficaIngresos from "../../components/grafica-ingresos";
import type { IngresoPorMes, Venta } from "../../types";

export default function VentasVendedor() {
  const { usuario } = useSesion();

  const [lista, setLista] = useState<Venta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ingresos, setIngresos] = useState<IngresoPorMes[]>([]);
  const [graficaCargando, setGraficaCargando] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [detalle, setDetalle] = useState<Venta | null>(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const datos = await traerTodo((saltar, limite) => ventas.listar({ saltar, limite }));
      setLista(datos.items);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudieron cargar las ventas.");
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarGrafica = useCallback(async () => {
    setGraficaCargando(true);
    try {
      const datos = await ventas.ingresosPorMes();
      setIngresos(datos);
    } catch {
      setIngresos([]);
    } finally {
      setGraficaCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
    void cargarGrafica();
  }, [cargarDatos, cargarGrafica]);

  const resumen = useMemo(() => {
    const completadas = lista.filter((venta) => venta.estado === "Completada");

    return {
      total: lista.length,
      completadas: completadas.length,
      anuladas: lista.filter((venta) => venta.estado === "Anulada").length,
      recaudado: completadas.reduce((suma, venta) => suma + numero(venta.total_pagado), 0),
    };
  }, [lista]);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return lista.filter((venta) => {
      const coincideTexto =
        !texto ||
        String(venta.id_venta).includes(texto) ||
        String(venta.id_pedido_fk ?? "").includes(texto) ||
        String(venta.factura?.id_factura ?? "").includes(texto);

      const coincideEstado = !filtroEstado || venta.estado === filtroEstado;

      return coincideTexto && coincideEstado;
    });
  }, [lista, busqueda, filtroEstado]);

  const anular = async (venta: Venta) => {
    const confirmado = window.confirm(
      `¿Anular la venta #${venta.id_venta}? La venta no se borra: queda marcada como Anulada.`
    );
    if (!confirmado) return;

    setGuardando(true);
    setError("");

    try {
      await ventas.anular(venta.id_venta);
      setMensaje(`Venta #${venta.id_venta} anulada.`);
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo anular la venta.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Ventas"
        titulo="Ventas"
        descripcion="Cada pedido entregado genera su venta y su factura. Aquí se consultan y se anulan."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "vendedor" } : undefined}
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
      {mensaje && <Aviso tipo="exito" mensaje={mensaje} onCerrar={() => setMensaje("")} />}

      <FilaIndicadores>
        <Indicador etiqueta="Recaudado" valor={pesos(resumen.recaudado)} descripcion="Solo ventas completadas" icono={TrendingUp} tono="verde" cargando={cargando} />
        <Indicador etiqueta="Ventas" valor={resumen.total} descripcion="Registradas" icono={CreditCard} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Completadas" valor={resumen.completadas} descripcion="Con factura vigente" icono={Receipt} tono="morado" cargando={cargando} />
        <Indicador etiqueta="Anuladas" valor={resumen.anuladas} descripcion="No cuentan en ingresos" icono={Ban} tono="rojo" cargando={cargando} />
      </FilaIndicadores>

      <div style={{ marginBottom: 22 }}>
        <GraficaIngresos datos={ingresos} cargando={graficaCargando} />
      </div>

      <section className="dt-listado">
        <BarraListado
          titulo="Listado de ventas"
          descripcion={`${filtrados.length} de ${lista.length} ventas`}
          Icono={Receipt}
        >
          <CajaBusqueda valor={busqueda} onCambio={setBusqueda} marcador="Venta, pedido o factura" />

          <FiltroEstado
            valor={filtroEstado}
            onCambio={setFiltroEstado}
            opciones={[
              { valor: "", texto: "Todos los estados" },
              { valor: "Completada", texto: "Completadas" },
              { valor: "Anulada", texto: "Anuladas" },
            ]}
          />

          <button
            type="button"
            className="dt-boton-icono"
            onClick={() => void cargarDatos()}
            disabled={cargando}
            title="Refrescar"
          >
            <RefreshCw size={15} className={cargando ? "dt-girando" : ""} />
          </button>
        </BarraListado>

        {cargando ? (
          <TablaCargando mensaje="Consultando las ventas…" />
        ) : filtrados.length === 0 ? (
          <TablaVacia
            titulo="No hay ventas"
            mensaje="Las ventas aparecen cuando un pedido se marca como Entregado."
            Icono={Receipt}
          />
        ) : (
          <div className="dt-tabla-scroll">
            <table className="dt-tabla">
              <thead>
                <tr>
                  <th>Venta</th>
                  <th>Fecha</th>
                  <th>Pedido</th>
                  <th>Factura</th>
                  <th>Total pagado</th>
                  <th>Estado</th>
                  <th className="dt-columna-acciones">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filtrados.map((venta) => (
                  <tr key={venta.id_venta}>
                    <td>
                      <span className="dt-fila-principal">Venta #{venta.id_venta}</span>
                      <span className="dt-fila-secundaria">
                        {venta.total_unidades} unidades
                      </span>
                    </td>

                    <td>{fecha(venta.fecha_venta)}</td>
                    <td>{venta.id_pedido_fk ? `#${venta.id_pedido_fk}` : "—"}</td>
                    <td>
                      <span className="dt-fila-secundaria">
                        {venta.factura ? `F-${venta.factura.id_factura}` : "Sin factura"}
                      </span>
                    </td>

                    <td>
                      <span className="dt-fila-principal">{pesos(venta.total_pagado)}</span>
                      {Number(venta.descuento_total) > 0 && (
                        <span className="dt-fila-secundaria">
                          Descuento {pesos(venta.descuento_total)}
                        </span>
                      )}
                    </td>

                    <td>
                      <EtiquetaEstado
                        tipo={tonoDeEstado(venta.estado)}
                        texto={venta.estado}
                      />
                    </td>

                    <td>
                      <div className="dt-acciones-fila">
                        <button
                          type="button"
                          className="dt-boton-icono"
                          title="Ver detalle"
                          onClick={() => setDetalle(venta)}
                        >
                          <Eye size={14} />
                        </button>

                        {venta.estado === "Completada" && (
                          <button
                            type="button"
                            className="dt-boton-icono dt-boton-peligro"
                            title="Anular venta"
                            disabled={guardando}
                            onClick={() => void anular(venta)}
                          >
                            <Ban size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detalle && (
        <div
          className="dt-modal-fondo"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setDetalle(null);
          }}
        >
          <section className="dt-modal" role="dialog" aria-modal="true">
            <header className="dt-modal-encabezado">
              <span className="dt-modal-icono">
                <FileText size={21} />
              </span>

              <div className="dt-modal-titulo-grupo">
                <span className="dt-migas">Venta</span>
                <h2>Venta #{detalle.id_venta}</h2>
                <p>
                  {fecha(detalle.fecha_venta)} · {detalle.estado}
                  {detalle.factura ? ` · Factura F-${detalle.factura.id_factura}` : ""}
                </p>
              </div>

              <button
                type="button"
                className="dt-boton-cerrar-modal"
                onClick={() => setDetalle(null)}
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </header>

            <div className="dt-formulario-contenido">
              <div className="dt-tabla-scroll">
                <table className="dt-tabla">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cant.</th>
                      <th>Precio</th>
                      <th>Devuelto</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>

                  <tbody>
                    {detalle.items.map((item) => (
                      <tr key={item.id_detalle_venta}>
                        <td>{item.nombre_producto ?? `Producto ${item.id_producto}`}</td>
                        <td>{item.cantidad}</td>
                        <td>{pesos(item.precio_unitario)}</td>
                        <td>{item.cantidad_devuelta}</td>
                        <td>{pesos(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="dt-listado-contexto" style={{ marginTop: 12, borderRadius: 10 }}>
                <span>
                  <span className="dt-punto-contexto" />
                  Total pagado
                </span>
                <strong>{pesos(detalle.total_pagado)}</strong>
              </div>
            </div>

            <footer className="dt-modal-acciones">
              <button
                type="button"
                className="dt-boton-secundario"
                onClick={() => setDetalle(null)}
              >
                Cerrar
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
