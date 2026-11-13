// src/pages/vendedor/panel.tsx
//
// "Mi jornada": lo que el vendedor necesita ver al entrar — pedidos por
// despachar, ventas del día y devoluciones pendientes.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, CheckCircle2, ClipboardList, Clock, CreditCard, RefreshCw, Truck } from "../../components/iconos";

import { numero, pedidos, pesos, traerTodo, ventas, devoluciones } from "../../services/api";
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
  tonoDeEstado,
} from "../../components/indicadores";
import type { Pedido } from "../../types";

export default function PanelVendedor() {
  const { usuario } = useSesion();

  const [pendientes, setPendientes] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [resumen, setResumen] = useState({
    porDespachar: 0,
    ventasHoy: 0,
    ingresosHoy: 0,
    devolucionesPendientes: 0,
  });

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const [todosPedidos, todasVentas, todasDevoluciones] = await Promise.all([
        traerTodo((saltar, limite) => pedidos.listar({ saltar, limite })),
        traerTodo((saltar, limite) => ventas.listar({ saltar, limite })),
        traerTodo((saltar, limite) => devoluciones.listar({ saltar, limite })),
      ]);

      const abiertos = todosPedidos.items.filter(
        (pedido) => pedido.estado === "Pendiente" || pedido.estado === "Enviado"
      );

      const hoy = new Date().toDateString();
      const ventasDeHoy = todasVentas.items.filter(
        (venta) =>
          venta.estado === "Completada" &&
          venta.fecha_venta &&
          new Date(venta.fecha_venta).toDateString() === hoy
      );

      setPendientes(abiertos.slice(0, 6));
      setResumen({
        porDespachar: abiertos.length,
        ventasHoy: ventasDeHoy.length,
        ingresosHoy: ventasDeHoy.reduce((suma, v) => suma + numero(v.total_pagado), 0),
        devolucionesPendientes: todasDevoluciones.items.filter(
          (d) => d.estado === "Pendiente"
        ).length,
      });
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cargar la jornada.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const ingresos = useMemo(() => pesos(resumen.ingresosHoy), [resumen.ingresosHoy]);

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Ventas"
        titulo="Mi jornada"
        descripcion="Pedidos por despachar, ventas del día y devoluciones en espera de revisión."
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

      <FilaIndicadores>
        <Indicador etiqueta="Por despachar" valor={resumen.porDespachar} descripcion="Pendientes y enviados" icono={Truck} tono="ambar" cargando={cargando} />
        <Indicador etiqueta="Ventas de hoy" valor={resumen.ventasHoy} descripcion="Completadas en el día" icono={CheckCircle2} tono="verde" cargando={cargando} />
        <Indicador etiqueta="Cobrado hoy" valor={ingresos} descripcion="Suma del día" icono={CreditCard} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Devoluciones" valor={resumen.devolucionesPendientes} descripcion="Esperando revisión" icono={ArrowLeftRight} tono="rojo" cargando={cargando} />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Pedidos por atender"
          descripcion="Los seis más antiguos sin despachar"
          Icono={ClipboardList}
        >
          <Link to="/vendedor/pedidos" className="dt-boton-secundario">
            Ver todos los pedidos
          </Link>
        </BarraListado>

        {cargando ? (
          <TablaCargando mensaje="Consultando los pedidos abiertos…" />
        ) : pendientes.length === 0 ? (
          <TablaVacia
            titulo="Todo al día"
            mensaje="No hay pedidos pendientes de despacho en este momento."
            Icono={CheckCircle2}
          />
        ) : (
          <div className="dt-tabla-scroll">
            <table className="dt-tabla">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Fecha</th>
                  <th>Unidades</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th className="dt-columna-acciones">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {pendientes.map((pedido) => (
                  <tr key={pedido.id_pedido}>
                    <td>
                      <span className="dt-fila-principal">Pedido #{pedido.id_pedido}</span>
                      <span className="dt-fila-secundaria">
                        Cliente #{pedido.id_usuario_fk ?? "—"}
                      </span>
                    </td>

                    <td>{fecha(pedido.fecha_pedido)}</td>
                    <td>{pedido.total_unidades}</td>
                    <td>
                      <span className="dt-fila-principal">{pesos(pedido.total)}</span>
                    </td>

                    <td>
                      <EtiquetaEstado
                        tipo={tonoDeEstado(pedido.estado ?? "")}
                        texto={pedido.estado ?? "—"}
                      />
                    </td>

                    <td>
                      <div className="dt-acciones-fila">
                        <Link to="/vendedor/pedidos" className="dt-boton-secundario">
                          <Clock size={13} /> Gestionar
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
