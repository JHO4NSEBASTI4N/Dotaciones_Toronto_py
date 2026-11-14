// src/pages/bodeguero/panel.tsx
//
// "Mi bodega": Centro de control automatizado con analíticas avanzadas,
// gráficas de distribución, flujo operativo, auto-refresco y acciones rápidas.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { 
  AlertTriangle, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  Boxes, 
  ClipboardCheck, 
  Package, 
  RefreshCw, 
  SlidersHorizontal, 
  TrendingUp,
  Clock,
  Plus
} from "../../components/iconos";

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
  
  // Estados para automatización
  const [autoRefresco, setAutoRefresco] = useState<number>(30); // en segundos (0 = desactivado)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date>(new Date());

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const [existencias, movs] = await Promise.all([
        traerTodo((saltar, limite) => inventario.stock(saltar, limite)),
        inventario.movimientos(0, 15),
      ]);

      setStock(existencias.items);
      setMovimientos(movs.items);
      setUltimaActualizacion(new Date());
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo cargar la bodega.");
    } finally {
      setCargando(false);
    }
  }, []);

  // Automatización: Efecto de auto-refresco periódico
  useEffect(() => {
    if (autoRefresco <= 0) return;

    const intervalo = setInterval(() => {
      void cargarDatos();
    }, autoRefresco * 1000);

    return () => clearInterval(intervalo);
  }, [autoRefresco, cargarDatos]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const resumen = useMemo(() => {
    const activos = stock.filter((fila) => !fila.inhabilitado);
    const bajo = activos.filter((fila) => fila.bajo_minimo).length;
    const agotados = activos.filter((fila) => fila.stock_total === 0).length;
    const optimos = activos.length - bajo;

    return {
      productos: activos.length,
      unidades: activos.reduce((suma, fila) => suma + fila.stock_total, 0),
      bajoMinimo: bajo,
      agotados: agotados,
      optimos: optimos,
      porcentajeSalud: activos.length > 0 ? Math.round((optimos / activos.length) * 100) : 100,
    };
  }, [stock]);

  // Contador de movimientos del día actual
  const movimientosHoy = useMemo(() => {
    const hoy = new Date().toDateString();
    return movimientos.filter((m) => {
      if (!m.fecha_hora) return false;
      return new Date(m.fecha_hora).toDateString() === hoy;
    }).length;
  }, [movimientos]);

  // Gráfica 1: Distribución por categoría
  const porCategoria = useMemo(() => {
    const mapa: Record<string, number> = {};
    stock
      .filter((fila) => !fila.inhabilitado)
      .forEach((fila) => {
        const cat = fila.categoria?.trim() || "General";
        mapa[cat] = (mapa[cat] || 0) + fila.stock_total;
      });
    
    const totalUnidades = resumen.unidades || 1;
    return Object.entries(mapa).map(([categoria, unidades]) => ({
      categoria,
      unidades,
      porcentaje: Math.round((unidades / totalUnidades) * 100),
    })).sort((a, b) => b.unidades - a.unidades);
  }, [stock, resumen.unidades]);

  // Gráfica 2: Resumen de flujo operativo
  const flujoOperativo = useMemo(() => {
    const conteo = { ENTRADA: 0, SALIDA: 0, AJUSTE: 0 };
    movimientos.forEach((m) => {
      const tipo = m.tipo_movimiento?.toUpperCase() as keyof typeof conteo;
      if (tipo && tipo in conteo) {
        conteo[tipo] += Math.abs(m.cantidad ?? 0);
      } else {
        conteo.AJUSTE += Math.abs(m.cantidad ?? 0);
      }
    });
    const totalMovs = (conteo.ENTRADA + conteo.SALIDA + conteo.AJUSTE) || 1;
    return {
      ...conteo,
      totalMovs,
      pEntrada: Math.round((conteo.ENTRADA / totalMovs) * 100),
      pSalida: Math.round((conteo.SALIDA / totalMovs) * 100),
      pAjuste: Math.round((conteo.AJUSTE / totalMovs) * 100),
    };
  }, [movimientos]);

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
        descripcion="Centro de control automatizado de existencias, métricas de flujo y alertas críticas."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "bodeguero" } : undefined}
        accion={
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", background: "#f8fafc", padding: "4px 10px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <Clock size={14} style={{ color: "#64748b" }} />
              <span style={{ color: "#475569" }}>Auto:</span>
              <select 
                value={autoRefresco} 
                onChange={(e) => setAutoRefresco(Number(e.target.value))}
                style={{ background: "transparent", border: "none", color: "#0f172a", fontWeight: 600, cursor: "pointer", outline: "none" }}
              >
                <option value={0}>Desactivado</option>
                <option value={15}>Cada 15s</option>
                <option value={30}>Cada 30s</option>
                <option value={60}>Cada 1 min</option>
              </select>
            </div>

            <button
              type="button"
              className="dt-accion-principal"
              onClick={() => void cargarDatos()}
              disabled={cargando}
            >
              <RefreshCw size={15} className={cargando ? "dt-girando" : ""} />
              Actualizar
            </button>
          </div>
        }
      />

      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}

      <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: autoRefresco > 0 ? "#10b981" : "#94a3b8", display: "inline-block" }} />
          Sincronizado a las {ultimaActualizacion.toLocaleTimeString()} {autoRefresco > 0 ? `(Actualización automática cada ${autoRefresco}s)` : ""}
        </div>
        <div style={{ background: "#f1f5f9", padding: "2px 10px", borderRadius: 6, fontSize: "0.8rem", color: "#334155", fontWeight: 500 }}>
          Movimientos hoy: <strong>{movimientosHoy}</strong>
        </div>
      </div>

      <FilaIndicadores>
        <Indicador etiqueta="Productos" valor={resumen.productos} descripcion="Con inventario activo" icono={Package} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Unidades" valor={resumen.unidades} descripcion="Total en bodega" icono={Boxes} tono="verde" cargando={cargando} />
        <Indicador etiqueta="Salud de Stock" valor={`${resumen.porcentajeSalud}%`} descripcion="Productos en nivel óptimo" icono={TrendingUp} tono="morado" cargando={cargando} />
        <Indicador etiqueta="Bajo mínimo" valor={resumen.bajoMinimo} descripcion="Hay que reponer" icono={AlertTriangle} tono={resumen.bajoMinimo > 0 ? "rojo" : "ambar"} cargando={cargando} />
      </FilaIndicadores>

      <div className="dt-grid-dashboard" style={{ marginBottom: 20 }}>
        {/* Gráfica 1: Distribución por Categoría */}
        <section className="dt-panel">
          <div className="dt-panel-encabezado">
            <TrendingUp size={17} />
            <div>
              <h2>Distribución por categoría</h2>
              <p>Participación de unidades en inventario</p>
            </div>
          </div>
          <div className="dt-panel-cuerpo" style={{ padding: "18px 24px" }}>
            {cargando ? (
              <TablaCargando mensaje="Calculando distribución…" />
            ) : porCategoria.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: "0.9rem" }}>No hay categorías registradas.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "#f1f5f9", width: "100%", gap: 2 }}>
                  {porCategoria.map((item, idx) => {
                    const colores = ["#881337", "#e11d48", "#f43f5e", "#fb7185", "#0f172a", "#334155"];
                    return (
                      <div 
                        key={item.categoria} 
                        style={{ width: `${item.porcentaje}%`, background: colores[idx % colores.length], height: "100%" }}
                        title={`${item.categoria}: ${item.unidades} u. (${item.porcentaje}%)`}
                      />
                    );
                  })}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px" }}>
                  {porCategoria.map((item, idx) => {
                    const colores = ["#881337", "#e11d48", "#f43f5e", "#fb7185", "#0f172a", "#334155"];
                    return (
                      <div key={item.categoria} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: colores[idx % colores.length], display: "inline-block" }} />
                        <strong style={{ color: "#0f172a" }}>{item.categoria}:</strong>
                        <span style={{ color: "#64748b" }}>{item.unidades} u. ({item.porcentaje}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Gráfica 2: Flujo Operativo */}
        <section className="dt-panel">
          <div className="dt-panel-encabezado">
            <Boxes size={17} />
            <div>
              <h2>Flujo operativo reciente</h2>
              <p>Volumen de unidades movilizadas (Entradas / Salidas)</p>
            </div>
          </div>
          <div className="dt-panel-cuerpo" style={{ padding: "18px 24px" }}>
            {cargando ? (
              <TablaCargando mensaje="Analizando movimientos…" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "#f1f5f9", width: "100%", gap: 2 }}>
                  <div style={{ width: `${flujoOperativo.pEntrada}%`, background: "#10b981", height: "100%" }} title={`Entradas: ${flujoOperativo.ENTRADA} u.`} />
                  <div style={{ width: `${flujoOperativo.pSalida}%`, background: "#ef4444", height: "100%" }} title={`Salidas: ${flujoOperativo.SALIDA} u.`} />
                  <div style={{ width: `${flujoOperativo.pAjuste}%`, background: "#f59e0b", height: "100%" }} title={`Ajustes: ${flujoOperativo.AJUSTE} u.`} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                    <strong style={{ color: "#0f172a" }}>Entradas:</strong>
                    <span style={{ color: "#64748b" }}>{flujoOperativo.ENTRADA} u.</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                    <strong style={{ color: "#0f172a" }}>Salidas:</strong>
                    <span style={{ color: "#64748b" }}>{flujoOperativo.SALIDA} u.</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                    <strong style={{ color: "#0f172a" }}>Ajustes:</strong>
                    <span style={{ color: "#64748b" }}>{flujoOperativo.AJUSTE} u.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="dt-grid-dashboard">
        <section className="dt-panel">
          <div className="dt-panel-encabezado">
            <AlertTriangle size={17} />
            <div>
              <h2>Productos bajo mínimo</h2>
              <p>Prioridad de reposición inmediata</p>
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
                {criticos.map((fila) => {
                  const porcentajeStock = fila.stock_minimo > 0 ? Math.min(Math.round((fila.stock_total / fila.stock_minimo) * 100), 100) : 0;
                  // Espaciado limpio para categoría y talla
                  const detalles = [fila.categoria, fila.talla ? `Talla ${fila.talla}` : null, `mínimo ${fila.stock_minimo}`].filter(Boolean).join(" · ");

                  return (
                    <div key={fila.id_producto} className="dt-actividad" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                          <span className="dt-avatar-fila" style={{ flexShrink: 0 }}>
                            <Package size={15} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fila.nombre}</strong>
                            <span style={{ display: "block", color: "#64748b", fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {detalles}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          <span className="dt-actividad-valor">{fila.stock_total} u.</span>
                          <EtiquetaEstado
                            tipo={fila.stock_total === 0 ? "inactivo" : "pendiente"}
                            texto={fila.stock_total === 0 ? "Agotado" : "Bajo mínimo"}
                          />
                          <Link 
                            to="/bodeguero/inventario" 
                            className="dt-boton-icono" 
                            title="Ir a reponer en inventario"
                            style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 6, width: 26, height: 26, display: "inline-grid", placeItems: "center" }}
                          >
                            <Plus size={14} />
                          </Link>
                        </div>
                      </div>
                      <div style={{ width: "100%", background: "#f1f5f9", height: 6, borderRadius: 3, overflow: "hidden" }}>
                        <div 
                          style={{ 
                            width: `${porcentajeStock}%`, 
                            background: fila.stock_total === 0 ? "#ef4444" : "#f59e0b", 
                            height: "100%", 
                            borderRadius: 3 
                          }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="dt-panel">
          <div className="dt-panel-encabezado">
            <SlidersHorizontal size={17} />
            <div>
              <h2>Últimos movimientos</h2>
              <p>Entradas, salidas y ajustes recientes</p>
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

                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{movimiento.nombre_producto ?? "Producto"}</strong>
                      <span style={{ display: "block", fontSize: "0.82rem", color: "#64748b" }}>
                        {movimiento.tipo_movimiento} · {fecha(movimiento.fecha_hora)}
                      </span>
                    </div>

                    <span className="dt-actividad-valor" style={{ color: movimiento.tipo_movimiento === "ENTRADA" ? "#10b981" : movimiento.tipo_movimiento === "SALIDA" ? "#ef4444" : "#64748b" }}>
                      {movimiento.tipo_movimiento === "SALIDA" ? `−${movimiento.cantidad}` : `+${movimiento.cantidad}`} u.
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
          descripcion="Gestionar existencias, registrar entradas o salidas y consultar alertas"
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