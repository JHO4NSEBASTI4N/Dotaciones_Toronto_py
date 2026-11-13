// src/pages/admin/panel.tsx
//
// Resumen general del administrador: indicadores, accesos rápidos y los
// últimos pedidos que entraron.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Boxes, ClipboardList, CreditCard, ExternalLink, Package, RefreshCw, ShieldCheck, TrendingUp, Users } from "../../components/iconos";

import { pedidos, pesos } from "../../services/api";
import { dashboard, type ResumenDashboard } from "../../services/dashboard";
import { useSesion } from "../../context/sesion-contexto";
import {
  Aviso,
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

const ACCESOS = [
  { ruta: "/admin/usuarios", texto: "Usuarios", detalle: "Cuentas y roles asignados", Icono: Users },
  { ruta: "/admin/roles", texto: "Roles", detalle: "Permisos por rol", Icono: ShieldCheck },
  { ruta: "/admin/productos", texto: "Productos", detalle: "Catálogo y precios", Icono: Package },
  { ruta: "/vendedor/pedidos", texto: "Pedidos", detalle: "Despachos pendientes", Icono: ClipboardList },
  { ruta: "/vendedor/ventas", texto: "Ventas", detalle: "Facturas emitidas", Icono: CreditCard },
  { ruta: "/bodeguero/inventario", texto: "Inventario", detalle: "Existencias por bodega", Icono: Boxes },
];

export default function PanelAdministrador() {
  const { usuario } = useSesion();

  const [resumen, setResumen] = useState<ResumenDashboard | null>(null);
  const [ultimos, setUltimos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const [datos, lista] = await Promise.all([
        dashboard.resumen(),
        pedidos.listar({ saltar: 0, limite: 5 }),
      ]);
      setResumen(datos);
      setUltimos(lista.items);
    } catch (fallo) {
      setError(
        fallo instanceof Error ? fallo.message : "No se pudo cargar el resumen."
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const totales = useMemo(
    () => ({
      ingresos: pesos(resumen?.ingresos_totales ?? 0),
      ventas: resumen?.total_ventas ?? 0,
      pedidos: resumen?.total_pedidos ?? 0,
      pendientes: resumen?.pedidos_pendientes ?? 0,
      clientes: resumen?.total_clientes ?? 0,
      bajoStock: resumen?.productos_bajo_stock ?? 0,
    }),
    [resumen]
  );

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Administración"
        titulo="Resumen general"
        descripcion="Estado del negocio: ventas, pedidos, clientes y existencias críticas."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "admin" } : undefined}
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
        <Indicador
          etiqueta="Ingresos cobrados"
          valor={totales.ingresos}
          descripcion={`${totales.ventas} venta(s) completada(s)`}
          icono={TrendingUp}
          tono="verde"
          cargando={cargando}
        />
        <Indicador
          etiqueta="Pedidos"
          valor={totales.pedidos}
          descripcion={`${totales.pendientes} sin cerrar`}
          icono={ClipboardList}
          tono="azul"
          cargando={cargando}
        />
        <Indicador
          etiqueta="Clientes"
          valor={totales.clientes}
          descripcion="Cuentas con rol Cliente"
          icono={Users}
          tono="morado"
          cargando={cargando}
        />
        <Indicador
          etiqueta="Bajo mínimo"
          valor={totales.bajoStock}
          descripcion="Productos por reponer"
          icono={AlertTriangle}
          tono={totales.bajoStock > 0 ? "rojo" : "ambar"}
          cargando={cargando}
        />
      </FilaIndicadores>

      <div className="dt-grid-dashboard">
        <section className="dt-panel">
          <div className="dt-panel-encabezado">
            <ClipboardList size={17} />
            <div>
              <h2>Últimos pedidos</h2>
              <p>Los 5 más recientes del sistema</p>
            </div>
          </div>

          <div className="dt-panel-cuerpo">
            {cargando ? (
              <TablaCargando mensaje="Consultando los pedidos recientes…" />
            ) : ultimos.length === 0 ? (
              <TablaVacia
                titulo="Todavía no hay pedidos"
                mensaje="Cuando un cliente arme su pedido aparecerá aquí."
                Icono={ClipboardList}
              />
            ) : (
              <div className="dt-lista-actividad">
                {ultimos.map((pedido) => (
                  <div key={pedido.id_pedido} className="dt-actividad">
                    <span className="dt-avatar-fila">
                      <ClipboardList size={15} />
                    </span>

                    <div>
                      <strong>Pedido #{pedido.id_pedido}</strong>
                      <span>{fecha(pedido.fecha_pedido)}</span>
                    </div>

                    <span className="dt-actividad-valor">
                      {pesos(pedido.total ?? 0)}
                    </span>

                    <EtiquetaEstado
                      tipo={tonoDeEstado(pedido.estado ?? "")}
                      texto={pedido.estado ?? "—"}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="dt-panel">
          <div className="dt-panel-encabezado">
            <ExternalLink size={17} />
            <div>
              <h2>Accesos rápidos</h2>
              <p>Módulos que administras</p>
            </div>
          </div>

          <div className="dt-panel-cuerpo">
            <div className="dt-accesos">
              {ACCESOS.map((acceso) => (
                <Link key={acceso.ruta} to={acceso.ruta} className="dt-acceso">
                  <span className="dt-acceso-icono">
                    <acceso.Icono size={18} />
                  </span>
                  <strong>{acceso.texto}</strong>
                  <span>{acceso.detalle}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
