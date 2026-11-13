// src/pages/cliente/panel.tsx
//
// "Mi resumen": lo que el cliente necesita — su carrito, sus pedidos y un
// acceso directo al catálogo.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Package, RefreshCw, ShoppingBag, ShoppingCart, Store, Truck, UserRound } from "../../components/iconos";

import { carrito, numero, pedidos, pesos, traerTodo } from "../../services/api";
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
import type { Carrito, Pedido } from "../../types";

export default function PanelCliente() {
  const { usuario } = useSesion();

  const [carritoActual, setCarritoActual] = useState<Carrito | null>(null);
  const [misPedidos, setMisPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargarDatos = useCallback(async () => {
    if (!usuario) return;

    setCargando(true);
    setError("");

    try {
      const [carro, lista] = await Promise.all([
        carrito.obtener(),
        traerTodo((saltar, limite) =>
          pedidos.listar({ saltar, limite, id_usuario: usuario.id_usuario })
        ),
      ]);

      setCarritoActual(carro);
      setMisPedidos(lista.items);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cargar tu resumen.");
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const resumen = useMemo(() => {
    const activos = misPedidos.filter(
      (pedido) => pedido.estado === "Pendiente" || pedido.estado === "Enviado"
    );

    return {
      unidadesCarrito: carritoActual?.total_unidades ?? 0,
      totalCarrito: carritoActual?.total ?? "0",
      pedidos: misPedidos.length,
      enCamino: activos.length,
      comprado: misPedidos
        .filter((pedido) => pedido.estado === "Entregado")
        .reduce((suma, pedido) => suma + numero(pedido.total), 0),
    };
  }, [carritoActual, misPedidos]);

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Mi cuenta"
        titulo={`Hola, ${usuario?.nombre.split(" ")[0] ?? ""}`}
        descripcion="Aquí ves tu carrito, tus pedidos y lo que has comprado."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "cliente" } : undefined}
        accion={
          <Link to="/cliente/productos" className="dt-accion-principal">
            <Store size={15} />
            Ver catálogo
          </Link>
        }
      />

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}

      <FilaIndicadores>
        <Indicador etiqueta="Mi carrito" valor={resumen.unidadesCarrito} descripcion={`${pesos(resumen.totalCarrito)} en total`} icono={ShoppingCart} tono="ambar" cargando={cargando} />
        <Indicador etiqueta="Mis pedidos" valor={resumen.pedidos} descripcion="Desde que te registraste" icono={ClipboardList} tono="azul" cargando={cargando} />
        <Indicador etiqueta="En camino" valor={resumen.enCamino} descripcion="Pendientes o enviados" icono={Truck} tono="morado" cargando={cargando} />
        <Indicador etiqueta="Comprado" valor={pesos(resumen.comprado)} descripcion="Pedidos entregados" icono={ShoppingBag} tono="verde" cargando={cargando} />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Mis últimos pedidos"
          descripcion="El estado de tus solicitudes"
          Icono={ClipboardList}
        >
          <button
            type="button"
            className="dt-boton-icono"
            onClick={() => void cargarDatos()}
            disabled={cargando}
            title="Refrescar"
          >
            <RefreshCw size={15} className={cargando ? "dt-girando" : ""} />
          </button>

          <Link to="/cliente/pedidos" className="dt-boton-secundario">
            Ver todos
          </Link>
        </BarraListado>

        {cargando ? (
          <TablaCargando mensaje="Consultando tus pedidos…" />
        ) : misPedidos.length === 0 ? (
          <TablaVacia
            titulo="Todavía no has pedido"
            mensaje="Explora el catálogo y arma tu primer pedido de dotación."
            Icono={Package}
            accion={
              <Link to="/cliente/productos" className="dt-accion-principal">
                <Store size={15} /> Ver catálogo
              </Link>
            }
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
                </tr>
              </thead>

              <tbody>
                {misPedidos.slice(0, 5).map((pedido) => (
                  <tr key={pedido.id_pedido}>
                    <td>
                      <span className="dt-fila-principal">Pedido #{pedido.id_pedido}</span>
                      <span className="dt-fila-secundaria">{pedido.items.length} productos</span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="dt-grid-dashboard" style={{ marginTop: 14 }}>
        <section className="dt-panel">
          <div className="dt-panel-encabezado">
            <Store size={17} />
            <div>
              <h2>Atajos</h2>
              <p>Lo que más se usa</p>
            </div>
          </div>

          <div className="dt-panel-cuerpo">
            <div className="dt-accesos">
              <Link to="/cliente/productos" className="dt-acceso">
                <span className="dt-acceso-icono"><Store size={18} /></span>
                <strong>Catálogo</strong>
                <span>Dotaciones disponibles</span>
              </Link>

              <Link to="/cliente/carrito" className="dt-acceso">
                <span className="dt-acceso-icono"><ShoppingCart size={18} /></span>
                <strong>Mi carrito</strong>
                <span>{resumen.unidadesCarrito} unidades</span>
              </Link>

              <Link to="/cliente/perfil" className="dt-acceso">
                <span className="dt-acceso-icono"><UserRound size={18} /></span>
                <strong>Mi perfil</strong>
                <span>Datos de contacto</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
