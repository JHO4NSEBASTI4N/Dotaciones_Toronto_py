// src/pages/cliente/devoluciones-cliente.tsx
//
// devoluciones_cliente.html del proyecto Java.
// El cliente ve las devoluciones de SUS ventas y puede pedir una nueva sobre un
// producto que ya le entregaron. Aprobar o rechazar es del vendedor.

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, Check, Plus, RefreshCw, X } from "../../components/iconos";
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
import type { Devolucion, Venta } from "../../entity";
import { FeedbackValidacion } from "../../components/feedback-validacion";
import { useCamposTocados } from "../../hooks/use-campos-tocados";

export default function DevolucionesCliente() {
  const { usuario } = useSesion();

  const [lista, setLista] = useState<Devolucion[]>([]);
  const [misVentas, setMisVentas] = useState<Venta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [idVenta, setIdVenta] = useState("");
  const [idDetalle, setIdDetalle] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("");
  const { tocar, tocarVarios, mostrar, reiniciar } = useCamposTocados();

  const cargarDatos = useCallback(async () => {
    if (!usuario) return;

    setCargando(true);
    setError("");

    try {
      const [todas, mis] = await Promise.all([
        traerTodo((saltar, limite) => devoluciones.listar({ saltar, limite })),
        traerTodo((saltar, limite) =>
          ventas.listar({ saltar, limite, id_usuario: usuario.id_usuario })
        ),
      ]);

      setMisVentas(mis.items);

      // Solo las devoluciones que pertenecen a una venta mía.
      const ids = new Set(mis.items.map((venta) => venta.id_venta));
      setLista(todas.items.filter((d) => d.id_venta && ids.has(d.id_venta)));
    } catch (fallo) {
      setError(
        fallo instanceof Error ? fallo.message : "No se pudieron cargar tus devoluciones."
      );
    } finally {
      setCargando(false);
    }
  }, [usuario]);

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

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return lista.filter((devolucion) => {
      const coincideTexto =
        !texto ||
        (devolucion.nombre_producto ?? "").toLowerCase().includes(texto) ||
        (devolucion.motivo ?? "").toLowerCase().includes(texto);

      const coincideEstado = !filtroEstado || devolucion.estado === filtroEstado;
      return coincideTexto && coincideEstado;
    });
  }, [lista, busqueda, filtroEstado]);

  const ventaElegida = misVentas.find((v) => String(v.id_venta) === idVenta) ?? null;
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
    venta: misVentas.some((venta) => String(venta.id_venta) === idVenta && venta.estado === "Completada")
      ? null
      : "Selecciona una venta completada.",
    producto: detalleElegido ? null : "Selecciona una línea de venta válida.",
    cantidad: !detalleElegido
      ? "Selecciona primero una línea de venta."
      : !Number.isInteger(Number(cantidad)) || Number(cantidad) < 1
        ? "La cantidad debe ser un número entero mayor que cero."
        : Number(cantidad) > disponibleDevolver
        ? `Solo puedes solicitar ${disponibleDevolver} unidad(es) de esta línea.`
        : null,
    motivo: motivo.trim().length < 5
      ? "Describe el motivo con al menos 5 caracteres."
      : motivo.trim().length > 255
        ? "El motivo no puede superar 255 caracteres."
        : null,
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

      setMensaje("Solicitud enviada. El vendedor la revisará.");
      setModalAbierto(false);
      await cargarDatos();
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo enviar la solicitud.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Mi cuenta"
        titulo="Mis devoluciones"
        descripcion="Cambios y devoluciones de productos que ya te entregaron."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "cliente" } : undefined}
        accion={
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/cliente/pedidos" className="dt-boton-secundario">
              <ArrowLeftRight size={14} /> Mis pedidos
            </Link>
            <button
              type="button"
              className="dt-accion-principal"
              onClick={() => { reiniciar(); setModalAbierto(true); }}
            >
              <Plus size={15} /> Pedir devolución
            </button>
          </div>
        }
      />

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}
      {mensaje && <Aviso tipo="exito" mensaje={mensaje} onCerrar={() => setMensaje("")} />}

      <FilaIndicadores>
        <Indicador etiqueta="Solicitudes" valor={resumen.total} descripcion="En tu historial" icono={ArrowLeftRight} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Pendientes" valor={resumen.pendientes} descripcion="En revisión" icono={ArrowLeftRight} tono="ambar" cargando={cargando} />
        <Indicador etiqueta="Aprobadas" valor={resumen.aprobadas} descripcion="Aceptadas" icono={Check} tono="verde" cargando={cargando} />
        <Indicador etiqueta="Rechazadas" valor={resumen.rechazadas} descripcion="No procedieron" icono={X} tono="rojo" cargando={cargando} />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Historial"
          descripcion={`${filtradas.length} de ${lista.length} solicitudes`}
          Icono={ArrowLeftRight}
        >
          <CajaBusqueda valor={busqueda} onCambio={setBusqueda} marcador="Producto o motivo" />

          <FiltroEstado
            valor={filtroEstado}
            onCambio={setFiltroEstado}
            opciones={[
              { valor: "", texto: "Todas" },
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
          <TablaCargando mensaje="Consultando tus devoluciones…" />
        ) : filtradas.length === 0 ? (
          <TablaVacia
            titulo="No tienes devoluciones"
            mensaje="Si un producto te llegó con problemas, pide la devolución desde aquí."
            Icono={ArrowLeftRight}
            accion={
              <button
                type="button"
                className="dt-accion-principal"
                onClick={() => { reiniciar(); setModalAbierto(true); }}
              >
                <Plus size={15} /> Pedir devolución
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
                  <th>Valor</th>
                  <th>Motivo</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {filtradas.map((devolucion) => (
                  <tr key={devolucion.id_devolucion}>
                    <td>
                      <span className="dt-fila-principal">
                        {devolucion.nombre_producto ?? "—"}
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
                <ArrowLeftRight size={21} />
              </span>

              <div className="dt-modal-titulo-grupo">
                <span className="dt-migas">Devolución</span>
                <h2>Pedir devolución</h2>
                <p>Elige la venta y el producto que quieres devolver.</p>
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
                      aria-describedby="devolucion-venta-feedback"
                      required
                    >
                      <option value="">Selecciona una de tus ventas</option>
                      {misVentas
                        .filter((venta) => venta.estado === "Completada")
                        .map((venta) => (
                          <option key={venta.id_venta} value={venta.id_venta}>
                            Venta #{venta.id_venta} · {fecha(venta.fecha_venta)} ·{" "}
                            {pesos(venta.total_pagado)}
                          </option>
                        ))}
                    </select>
                    <FeedbackValidacion id="devolucion-venta-feedback" error={erroresCampos.venta} mostrar={mostrar("venta")} valido="Venta completada seleccionada." />
                  </label>

                  <label className="dt-campo-ancho">
                    Producto <span>*</span>
                    <select
                      value={idDetalle}
                      onChange={(e) => { setIdDetalle(e.target.value); tocar("producto"); }}
                      onBlur={() => tocar("producto")}
                      aria-invalid={mostrar("producto") && Boolean(erroresCampos.producto)}
                      aria-describedby="devolucion-producto-feedback"
                      disabled={!ventaElegida}
                      required
                    >
                      <option value="">Selecciona el producto</option>
                      {(ventaElegida?.items ?? []).map((item) => (
                        <option key={item.id_detalle_venta} value={item.id_detalle_venta}>
                          {item.nombre_producto} · {item.cantidad} compradas ·{" "}
                          {item.cantidad_devuelta} devueltas
                        </option>
                      ))}
                    </select>
                    <FeedbackValidacion id="devolucion-producto-feedback" error={erroresCampos.producto} mostrar={mostrar("producto")} valido="Línea de venta válida." />
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
                      aria-describedby="devolucion-cantidad-feedback"
                      required
                    />
                    <FeedbackValidacion id="devolucion-cantidad-feedback" error={erroresCampos.cantidad} mostrar={mostrar("cantidad")} valido="Cantidad disponible." />
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
                      aria-describedby="devolucion-motivo-feedback"
                      placeholder="Talla equivocada, defecto…"
                    />
                    <FeedbackValidacion id="devolucion-motivo-feedback" error={erroresCampos.motivo} mostrar={mostrar("motivo")} valido="Motivo válido." />
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
                  {guardando ? <span className="dt-spinner" /> : <Check size={15} />}
                  Enviar solicitud
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
