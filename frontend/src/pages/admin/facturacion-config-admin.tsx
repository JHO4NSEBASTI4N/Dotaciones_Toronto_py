// src/pages/admin/facturacion-config-admin.tsx
//
// facturacion_config_admin.html del proyecto Java.
// Muestra las resoluciones de numeración autorizadas por la DIAN y el
// consecutivo que lleva cada una. Es solo lectura: la configuración real vive
// en el backend (application.properties / tabla resolucion_facturacion).

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, RefreshCw, ShieldCheck } from "../../components/iconos";
import { facturas, traerTodo } from "../../services/api";
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
import type { Resolucion } from "../../facturacion/entity/ResolucionFacturacion";

export default function FacturacionConfigAdmin() {
  const { usuario } = useSesion();

  const [resoluciones, setResoluciones] = useState<Resolucion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const datos = await traerTodo((saltar, limite) => facturas.resoluciones(saltar, limite));
      setResoluciones(datos.items);
    } catch (fallo) {
      setError(
        fallo instanceof Error ? fallo.message : "No se pudieron cargar las resoluciones."
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const vigentes = resoluciones.filter((resolucion) => resolucion.vigente).length;

  return (
    <section className="dt-modulo">
      <EncabezadoModulo
        seccion="Administración"
        titulo="Resoluciones DIAN"
        descripcion="Rangos de numeración autorizados, prefijo y consecutivo actual de cada resolución."
        rol={usuario ? { nombre: usuario.nombre_rol, clase: "admin" } : undefined}
        accion={
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/admin/facturacion" className="dt-boton-secundario">
              <ArrowLeft size={14} /> Volver a facturas
            </Link>
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

      <FilaIndicadores>
        <Indicador etiqueta="Resoluciones" valor={resoluciones.length} descripcion="Registradas" icono={FileText} tono="azul" cargando={cargando} />
        <Indicador etiqueta="Vigentes" valor={vigentes} descripcion="Se pueden usar" icono={ShieldCheck} tono="verde" cargando={cargando} />
      </FilaIndicadores>

      <section className="dt-listado">
        <BarraListado
          titulo="Numeración autorizada"
          descripcion="Cada factura toma el siguiente consecutivo de su resolución"
          Icono={ShieldCheck}
        />

        {cargando ? (
          <TablaCargando mensaje="Consultando las resoluciones…" />
        ) : resoluciones.length === 0 ? (
          <TablaVacia
            titulo="Sin resoluciones cargadas"
            mensaje="El backend todavía no tiene una resolución de numeración registrada."
            Icono={FileText}
          />
        ) : (
          <div className="dt-tabla-scroll">
            <table className="dt-tabla">
              <thead>
                <tr>
                  <th>Resolución</th>
                  <th>Tipo</th>
                  <th>Prefijo</th>
                  <th>Rango</th>
                  <th>Consecutivo</th>
                  <th>Vigencia</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {resoluciones.map((resolucion) => (
                  <tr key={resolucion.id_resolucion}>
                    <td>
                      <span className="dt-fila-principal">{resolucion.numero_resolucion}</span>
                      <span className="dt-fila-secundaria">
                        Clave técnica {resolucion.clave_tecnica.slice(0, 12)}…
                      </span>
                    </td>
                    <td>{resolucion.tipo_documento}</td>
                    <td>{resolucion.prefijo}</td>
                    <td>
                      {resolucion.rango_desde} — {resolucion.rango_hasta}
                    </td>
                    <td>
                      <span className="dt-fila-principal">{resolucion.consecutivo_actual}</span>
                    </td>
                    <td>
                      <span className="dt-fila-secundaria">
                        {fecha(resolucion.vigencia_desde)} → {fecha(resolucion.vigencia_hasta)}
                      </span>
                    </td>
                    <td>
                      <EtiquetaEstado
                        tipo={resolucion.vigente ? "activo" : "inactivo"}
                        texto={resolucion.vigente ? "Vigente" : "Vencida"}
                      />
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
