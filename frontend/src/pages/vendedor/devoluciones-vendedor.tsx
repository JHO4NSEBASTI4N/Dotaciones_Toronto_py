// src/pages/vendedor/devoluciones.tsx
//
// Devoluciones: se aprueban o se rechazan. Aprobar NO devuelve stock
// automáticamente; solo cambia el estado del registro.

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeftRight, Check, MessageSquare, Plus, RefreshCw, RotateCcw, X } from "../../components/iconos";

import { devoluciones, pesos, traerTodo, ventas } from "../../services/api";
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
import type { Devolucion, Venta } from "../../types";

export default function DevolucionesVendedor() {
  const { usuario } = useSesion();

  const [lista, setLista] = useState<Devolucion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [ventasLista, setVentasLista] = useState<Venta[]>([]);
  const [idVenta, setIdVenta] = useState("");
  const [idDetalle, setIdDetalle] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("");

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const datos = await traerTodo((saltar, limite) =>
        devoluciones.listar({ saltar, limite })
      );
      setLista(datos.items);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudieron cargar las devoluciones.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const resumen = useMemo(
    () => ({
      total: lista.length,
      pendientes: lista.filter((d) => d.estado === "Pendiente").length,
      aprobadas: lista.filter((d) => d.estado === "Aprobada").length,
      rechazadas: lista.filter((d) => d.estado === "Rechazada").length,
    }),
    [lista]
  );

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return lista.filter((devolucion) => {
      const coincideTexto =
        !texto ||
        (devolucion.nombre_producto ?? "").toLowerCase().includes(texto) ||
        String(devolucion.id_venta ?? "").includes(texto) ||
        (devolucion.motivo ?? "").toLowerCase().includes(texto);

      const coincideEstado = !filtroEstado || devolucion.estado === filtroEstado;

      return coincideTexto && coincideEstado;
    });
  }, [lista, busqueda, filtroEstado]);

  const ventaElegida = useMemo(
    () => ventasLista.find((venta) => String(venta.id_venta) === idVenta) ?? null,
    [ventasLista, idVenta]
  );

  const abrirRegistro = async () => {
    setModalAbierto(true);
    setError("");
    setMotivo("");
    setCantidad("1");
    setIdVenta("");
    setIdDetalle("");

    try {
      const datos = await traerTodo((saltar, limite) =>
        ventas.listar({ saltar, limite, estado: "Completada" })
      );
      setVentasLista(datos.items);
    } catch {
      setVentasLista([]);
    }
  };

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    setGuardando(true);
    setError("");

    try {
      await devoluciones.crear({
        id_detalle_venta: Number(idDetalle),
        cantidad: Number(cantidad),
        motivo: motivo || null,
      });

      setMensaje("Devolución registrada como Pendiente.");
      setModalAbierto(false);
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo registrar la devolución.");
    } finally {
      setGuardando(false);
    }
  };

  const resolver = async (devolucion: Devolucion, aprobar: boolean) => {
    const confirmado = window.confirm(
      aprobar
        ? `¿Aprobar la devolución #${devolucion.id_devolucion} de ${devolucion.cantidad} unidad(es)?`
        : `¿Rechazar la devolución #${devolucion.id_devolucion}?`
    );
    if (!confirmado) return;

    setGuardando(true);
    setError("");

    try {
      if (aprobar) await devoluciones.aprobar(devolucion.id_devolucion);
      else await devoluciones.rechazar(devolucion.id_devolucion);

      setMensaje(
        aprobar
          ? `Devolución #${devolucion.id_devolucion} aprobada.`
          : `Devolución #${devolucion.id_devolucion} rechazada.`
      );
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo resolver la devolución.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Ventas"
        titulo="Devoluciones"
        descripcion="Cambios y devoluciones de productos vendidos. Aprobar no altera el stock: solo deja constancia."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "vendedor" } : undefined}
        accion={
          <button type="button" className="dt-accion-principal" onClick={() => void abrirRegistro()}>
            <Plus size={15} />
            Registrar devolución
          </button>
        }
      />

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}
      {mensaje && <Aviso tipo="exito" mensaje={mensaje} onCerrar={() => setMensaje("")} />}

      <FilaIndicadores>
        <Indicador etiqueta="Devoluciones" valor={resumen.total} descripcion="Registradas" icono={ArrowLeftRight} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Pendientes" valor={resumen.pendientes} descripcion="Por revisar" icono={RotateCcw} tono="ambar" cargando={cargando} />
        <Indicador etiqueta="Aprobadas" valor={resumen.aprobadas} descripcion="Aceptadas al cliente" icono={Check} tono="verde" cargando={cargando} />
        <Indicador etiqueta="Rechazadas" valor={resumen.rechazadas} descripcion="No procedieron" icono={X} tono="rojo" cargando={cargando} />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Listado de devoluciones"
          descripcion={`${filtrados.length} de ${lista.length} registros`}
          Icono={ArrowLeftRight}
        >
          <CajaBusqueda valor={busqueda} onCambio={setBusqueda} marcador="Producto, venta o motivo" />

          <FiltroEstado
            valor={filtroEstado}
            onCambio={setFiltroEstado}
            opciones={[
              { valor: "", texto: "Todos los estados" },
              { valor: "Pendiente", texto: "Pendientes" },
              { valor: "Aprobada", texto: "Aprobadas" },
              { valor: "Rechazada", texto: "Rechazadas" },
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
          <TablaCargando mensaje="Consultando las devoluciones…" />
        ) : filtrados.length === 0 ? (
          <TablaVacia
            titulo="No hay devoluciones"
            mensaje="Cuando un cliente devuelva un producto, el registro aparecerá aquí."
            Icono={ArrowLeftRight}
            accion={
              <button type="button" className="dt-accion-principal" onClick={() => void abrirRegistro()}>
                <Plus size={15} /> Registrar devolución
              </button>
            }
          />
        ) : (
          <div className="dt-tabla-scroll">
            <table className="dt-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Venta</th>
                  <th>Cantidad</th>
                  <th>Valor devuelto</th>
                  <th>Motivo</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th className="dt-columna-acciones">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filtrados.map((devolucion) => (
                  <tr key={devolucion.id_devolucion}>
                    <td>
                      <span className="dt-fila-principal">
                        {devolucion.nombre_producto ?? "—"}
                      </span>
                      <span className="dt-fila-secundaria">
                        Vendidas {devolucion.cantidad_vendida ?? "—"} · devueltas{" "}
                        {devolucion.cantidad_devuelta ?? 0}
                      </span>
                    </td>

                    <td>{devolucion.id_venta ? `#${devolucion.id_venta}` : "—"}</td>
                    <td>{devolucion.cantidad}</td>
                    <td>{pesos(devolucion.valor_devuelto ?? 0)}</td>

                    <td>
                      <span className="dt-fila-secundaria">
                        {devolucion.motivo ?? "Sin motivo"}
                      </span>
                    </td>

                    <td>{fecha(devolucion.fecha_devolucion)}</td>

                    <td>
                      <EtiquetaEstado
                        tipo={tonoDeEstado(devolucion.estado)}
                        texto={devolucion.estado}
                      />
                    </td>

                    <td>
                      <div className="dt-acciones-fila">
                        {devolucion.estado === "Pendiente" ? (
                          <>
                            <button
                              type="button"
                              className="dt-boton-icono"
                              title="Aprobar"
                              disabled={guardando}
                              onClick={() => void resolver(devolucion, true)}
                            >
                              <Check size={14} />
                            </button>

                            <button
                              type="button"
                              className="dt-boton-icono dt-boton-peligro"
                              title="Rechazar"
                              disabled={guardando}
                              onClick={() => void resolver(devolucion, false)}
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <span className="dt-fila-secundaria">Resuelta</span>
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

      {modalAbierto && (
        <div
          className="dt-modal-fondo"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setModalAbierto(false);
          }}
        >
          <section className="dt-modal" role="dialog" aria-modal="true">
            <header className="dt-modal-encabezado">
              <span className="dt-modal-icono">
                <RotateCcw size={21} />
              </span>

              <div className="dt-modal-titulo-grupo">
                <span className="dt-migas">Devolución</span>
                <h2>Registrar devolución</h2>
                <p>Se elige la venta, el producto y cuántas unidades vuelven.</p>
              </div>

              <button
                type="button"
                className="dt-boton-cerrar-modal"
                onClick={() => setModalAbierto(false)}
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={guardar}>
              <div className="dt-formulario-contenido">
                <div className="dt-formulario-grid">
                  <label className="dt-campo-ancho">
                    Venta <span>*</span>
                    <select
                      value={idVenta}
                      onChange={(e) => {
                        setIdVenta(e.target.value);
                        setIdDetalle("");
                      }}
                      required
                    >
                      <option value="">Selecciona una venta completada</option>
                      {ventasLista.map((venta) => (
                        <option key={venta.id_venta} value={venta.id_venta}>
                          Venta #{venta.id_venta} · {fecha(venta.fecha_venta)} ·{" "}
                          {pesos(venta.total_pagado)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="dt-campo-ancho">
                    Producto <span>*</span>
                    <select
                      value={idDetalle}
                      onChange={(e) => setIdDetalle(e.target.value)}
                      disabled={!ventaElegida}
                      required
                    >
                      <option value="">Selecciona el producto</option>
                      {(ventaElegida?.items ?? []).map((item) => (
                        <option key={item.id_detalle_venta} value={item.id_detalle_venta}>
                          {item.nombre_producto} · {item.cantidad} vendidas · {item.cantidad_devuelta} devueltas
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Cantidad <span>*</span>
                    <input
                      type="number"
                      min={1}
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      required
                    />
                  </label>

                  <label>
                    Motivo
                    <input
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Talla equivocada, defecto…"
                    />
                  </label>
                </div>
              </div>

              <footer className="dt-modal-acciones">
                <button
                  type="button"
                  className="dt-boton-secundario"
                  onClick={() => setModalAbierto(false)}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button type="submit" className="dt-accion-principal" disabled={guardando}>
                  {guardando ? <span className="dt-spinner" /> : <MessageSquare size={15} />}
                  Registrar
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
