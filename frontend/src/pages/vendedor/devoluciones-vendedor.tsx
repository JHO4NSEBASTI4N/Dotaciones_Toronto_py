// src/pages/vendedor/devoluciones.tsx
//
// Devoluciones: se aprueban o se rechazan. Aprobar NO devuelve stock
// automáticamente; solo cambia el estado del registro.

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeftRight, Check, MessageSquare, Plus, RefreshCw, RotateCcw, X } from "../../components/iconos";

import { devoluciones, pesos, traerTodo, ventas } from "../../services/api";
import { BotonesReportesAdmin } from "../../components/botones-reportes-admin";
import { contarPorCategoria } from "../../services/analitica-reportes";
import type { ReporteAdmin } from "../../services/reportes";
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
import { FeedbackValidacion } from "../../components/feedback-validacion";
import { useCamposTocados } from "../../hooks/use-campos-tocados";

export default function DevolucionesVendedor() {
  const { usuario, esAdministrador } = useSesion();

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
  const { tocar, tocarVarios, mostrar, reiniciar } = useCamposTocados();

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

  const crearReporte = (): ReporteAdmin => ({
    modulo: "devoluciones",
    titulo: "Reporte de devoluciones",
    generado_por: usuario?.nombre ?? "Administrador",
    indicadores: [
      { etiqueta: "Devoluciones filtradas", valor: String(filtrados.length) },
      { etiqueta: "Pendientes", valor: String(filtrados.filter((d) => d.estado === "Pendiente").length) },
      { etiqueta: "Aprobadas", valor: String(filtrados.filter((d) => d.estado === "Aprobada").length) },
      { etiqueta: "Rechazadas", valor: String(filtrados.filter((d) => d.estado === "Rechazada").length) },
    ],
    columnas: [
      { clave: "id", titulo: "Devolución" },
      { clave: "producto", titulo: "Producto" },
      { clave: "venta", titulo: "Venta" },
      { clave: "fecha", titulo: "Fecha" },
      { clave: "cantidad", titulo: "Cantidad" },
      { clave: "valor_cop", titulo: "Valor devuelto COP" },
      { clave: "motivo", titulo: "Motivo" },
      { clave: "estado", titulo: "Estado" },
    ],
    filas: filtrados.map((d) => ({
      id: d.id_devolucion,
      producto: d.nombre_producto,
      venta: d.id_venta,
      fecha: d.fecha_devolucion,
      cantidad: d.cantidad,
      valor_cop: d.valor_devuelto === null ? null : Number(d.valor_devuelto),
      motivo: d.motivo,
      estado: d.estado,
    })),
    grafica: contarPorCategoria(filtrados.map((d) => d.estado), "Devoluciones por estado"),
  });

  const ventaElegida = useMemo(
    () => ventasLista.find((venta) => String(venta.id_venta) === idVenta) ?? null,
    [ventasLista, idVenta]
  );
  const detalleElegido = ventaElegida?.items.find(
    (item) => String(item.id_detalle_venta) === idDetalle
  ) ?? null;
  const solicitudesPendientes = detalleElegido
    ? lista
        .filter((devolucion) => devolucion.id_detalle_venta_fk === detalleElegido.id_detalle_venta && devolucion.estado === "Pendiente")
        .reduce((total, devolucion) => total + devolucion.cantidad, 0)
    : 0;
  const disponibleDevolver = detalleElegido
    ? Math.max(0, detalleElegido.cantidad - detalleElegido.cantidad_devuelta - solicitudesPendientes)
    : 0;
  const erroresCampos = {
    venta: ventaElegida ? null : "Selecciona una venta completada.",
    producto: detalleElegido ? null : "Selecciona una línea de venta válida.",
    cantidad: !detalleElegido
      ? "Selecciona primero una línea de venta."
      : !Number.isInteger(Number(cantidad)) || Number(cantidad) < 1
        ? "La cantidad debe ser un número entero mayor que cero."
        : Number(cantidad) > disponibleDevolver
        ? `Solo puedes registrar ${disponibleDevolver} unidad(es) de esta línea.`
        : null,
    motivo: motivo.trim().length < 5
      ? "Describe el motivo con al menos 5 caracteres."
      : motivo.trim().length > 255
        ? "El motivo no puede superar 255 caracteres."
        : null,
  };

  const abrirRegistro = async () => {
    reiniciar();
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
    const validacion = Object.values(erroresCampos).find(Boolean);
    if (validacion) {
      tocarVarios(Object.keys(erroresCampos));
      setError(validacion);
      return;
    }
    setGuardando(true);
    setError("");

    try {
      await devoluciones.crear({
        id_detalle_venta: Number(idDetalle),
        cantidad: Number(cantidad),
        motivo: motivo.trim(),
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
          <div className="dt-acciones-admin-encabezado">
            {esAdministrador && (
              <BotonesReportesAdmin crearReporte={crearReporte} alError={setError} deshabilitado={cargando} />
            )}
            <button type="button" className="dt-accion-principal" onClick={() => void abrirRegistro()}>
              <Plus size={15} />
              Registrar devolución
            </button>
          </div>
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

            <form onSubmit={guardar} noValidate>
              <div className="dt-formulario-contenido">
                <div className="dt-formulario-grid">
                  <label className="dt-campo-ancho">
                    Venta <span>*</span>
                    <select
                      value={idVenta}
                      onChange={(e) => {
                        setIdVenta(e.target.value);
                        setIdDetalle("");
                        tocar("venta");
                      }}
                      onBlur={() => tocar("venta")}
                      aria-invalid={mostrar("venta") && Boolean(erroresCampos.venta)}
                      aria-describedby="devolucion-vendedor-venta-feedback"
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
                    <FeedbackValidacion id="devolucion-vendedor-venta-feedback" error={erroresCampos.venta} mostrar={mostrar("venta")} valido="Venta completada seleccionada." />
                  </label>

                  <label className="dt-campo-ancho">
                    Producto <span>*</span>
                    <select
                      value={idDetalle}
                      onChange={(e) => { setIdDetalle(e.target.value); tocar("producto"); }}
                      onBlur={() => tocar("producto")}
                      aria-invalid={mostrar("producto") && Boolean(erroresCampos.producto)}
                      aria-describedby="devolucion-vendedor-producto-feedback"
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
                    <FeedbackValidacion id="devolucion-vendedor-producto-feedback" error={erroresCampos.producto} mostrar={mostrar("producto")} valido="Línea de venta válida." />
                  </label>

                  <label>
                    Cantidad <span>*</span>
                    <input
                      type="number"
                      min={1}
                      max={disponibleDevolver}
                      step={1}
                      disabled={!detalleElegido}
                      value={cantidad}
                      onChange={(e) => { setCantidad(e.target.value); tocar("cantidad"); }}
                      onBlur={() => tocar("cantidad")}
                      aria-invalid={mostrar("cantidad") && Boolean(erroresCampos.cantidad)}
                      aria-describedby="devolucion-vendedor-cantidad-feedback"
                      required
                    />
                    <FeedbackValidacion id="devolucion-vendedor-cantidad-feedback" error={erroresCampos.cantidad} mostrar={mostrar("cantidad")} valido="Cantidad disponible." />
                  </label>

                  <label>
                    Motivo <span>*</span>
                    <input
                      minLength={5}
                      maxLength={255}
                      value={motivo}
                      onChange={(e) => { setMotivo(e.target.value); tocar("motivo"); }}
                      onBlur={() => tocar("motivo")}
                      aria-invalid={mostrar("motivo") && Boolean(erroresCampos.motivo)}
                      aria-describedby="devolucion-vendedor-motivo-feedback"
                      placeholder="Talla equivocada, defecto…"
                    />
                    <FeedbackValidacion id="devolucion-vendedor-motivo-feedback" error={erroresCampos.motivo} mostrar={mostrar("motivo")} valido="Motivo válido." />
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
