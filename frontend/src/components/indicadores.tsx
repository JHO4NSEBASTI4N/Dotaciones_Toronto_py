import type { ElementType, ReactNode } from "react";

/* =========================================================================
   COMPONENTES COMPARTIDOS POR TODAS LAS VISTAS
   Mismo juego que el proyecto de referencia: encabezado, indicadores de
   resumen, avisos, barra del listado, estados de tabla y etiquetas.
========================================================================= */

/* ---------------------------------------------------------------
   ENCABEZADO DEL MÓDULO (migas + título + rol activo)
--------------------------------------------------------------- */

export function EncabezadoModulo({
  seccion,
  titulo,
  descripcion,
  accion,
  rol,
}: {
  seccion: string;
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
  rol?: { nombre: string; clase: string };
}) {
  return (
    <header className="dt-modulo-encabezado">
      <div className="dt-encabezado-texto">
        <div className="dt-migas">
          <span>Dotaciones Toronto</span>
          <span className="dt-migas-separador">/</span>
          <span>{seccion}</span>
          <span className="dt-migas-separador">/</span>
          <span>{titulo}</span>
        </div>

        <h1>{titulo}</h1>
        <p>{descripcion}</p>

        {rol && (
          <span className={`dt-modulo-rol dt-rol-${rol.clase}`} title="Rol con el que estás dentro">
            {rol.nombre}
          </span>
        )}
      </div>

      {accion}
    </header>
  );
}

/* ---------------------------------------------------------------
   INDICADORES DE RESUMEN
--------------------------------------------------------------- */

export type TonoIndicador = "azul" | "verde" | "ambar" | "morado" | "rojo";

export function Indicador({
  etiqueta,
  valor,
  descripcion,
  icono: Icono,
  tono = "verde",
  cargando = false,
}: {
  etiqueta: string;
  valor: ReactNode;
  descripcion?: string;
  icono: ElementType;
  tono?: TonoIndicador;
  cargando?: boolean;
}) {
  return (
    <article className={`dt-indicador dt-indicador-${tono}`}>
      <div className="dt-indicador-superior">
        <span className="dt-indicador-etiqueta">{etiqueta}</span>
        <span className="dt-indicador-icono">
          <Icono size={18} />
        </span>
      </div>

      <div className="dt-indicador-inferior">
        <strong>{cargando ? "—" : valor}</strong>
        {descripcion && (
          <span className="dt-indicador-descripcion">{descripcion}</span>
        )}
      </div>
    </article>
  );
}

export function FilaIndicadores({ children }: { children: ReactNode }) {
  return <div className="dt-resumen">{children}</div>;
}

/* ---------------------------------------------------------------
   AVISOS
--------------------------------------------------------------- */

export function Aviso({
  tipo,
  mensaje,
  onCerrar,
}: {
  tipo: "error" | "exito";
  mensaje: string;
  onCerrar?: () => void;
}) {
  if (!mensaje) return null;

  return (
    <div
      className={`dt-aviso ${tipo === "error" ? "dt-aviso-error" : "dt-aviso-exito"}`}
      role={tipo === "error" ? "alert" : "status"}
    >
      <span className="dt-aviso-punto" aria-hidden="true" />
      <span>{mensaje}</span>

      {onCerrar && (
        <button type="button" onClick={onCerrar} aria-label="Cerrar aviso">
          ×
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   BARRA DE HERRAMIENTAS DEL LISTADO
--------------------------------------------------------------- */

export function BarraListado({
  titulo,
  descripcion,
  Icono,
  children,
}: {
  titulo: string;
  descripcion: string;
  Icono: ElementType;
  children?: ReactNode;
}) {
  return (
    <div className="dt-toolbar">
      <div className="dt-tabla-titulo">
        <span className="dt-tabla-titulo-icono">
          <Icono size={19} />
        </span>

        <div>
          <h2>{titulo}</h2>
          <p>{descripcion}</p>
        </div>
      </div>

      {children && <div className="dt-controles">{children}</div>}
    </div>
  );
}

export function CajaBusqueda({
  valor,
  onCambio,
  marcador = "Buscar…",
}: {
  valor: string;
  onCambio: (texto: string) => void;
  marcador?: string;
}) {
  return (
    <label className="dt-busqueda">
      <span aria-hidden="true">⌕</span>
      <input
        type="search"
        value={valor}
        placeholder={marcador}
        onChange={(evento) => onCambio(evento.target.value)}
        aria-label={marcador}
      />
    </label>
  );
}

export function FiltroEstado({
  valor,
  onCambio,
  opciones,
  etiqueta = "Filtrar",
}: {
  valor: string;
  onCambio: (valor: string) => void;
  opciones: { valor: string; texto: string }[];
  etiqueta?: string;
}) {
  return (
    <label className="dt-filtro">
      <span aria-hidden="true">▾</span>
      <select
        value={valor}
        onChange={(evento) => onCambio(evento.target.value)}
        aria-label={etiqueta}
      >
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ---------------------------------------------------------------
   ESTADOS DE LA TABLA
--------------------------------------------------------------- */

export function TablaVacia({
  titulo,
  mensaje,
  Icono,
  accion,
}: {
  titulo: string;
  mensaje: string;
  Icono: ElementType;
  accion?: ReactNode;
}) {
  return (
    <div className="dt-tabla-vacia">
      <span className="dt-vacio-icono">
        <Icono size={28} />
      </span>

      <strong>{titulo}</strong>
      <span>{mensaje}</span>

      {accion}
    </div>
  );
}

export function TablaCargando({ mensaje }: { mensaje: string }) {
  return (
    <div className="dt-tabla-vacia">
      <span className="dt-vacio-icono">
        <span className="dt-spinner" />
      </span>

      <strong>Cargando información</strong>
      <span>{mensaje}</span>
    </div>
  );
}

/* ---------------------------------------------------------------
   ETIQUETAS DE ESTADO
--------------------------------------------------------------- */

export type TipoEtiqueta = "activo" | "inactivo" | "pendiente" | "neutro";

export function EtiquetaEstado({
  tipo,
  texto,
}: {
  tipo: TipoEtiqueta;
  texto: string;
}) {
  return (
    <span className={`dt-etiqueta-estado ${tipo}`}>
      <span className="dt-estado-punto" />
      {texto}
    </span>
  );
}

export function EtiquetaActivo({
  activo,
  textoActivo = "Activo",
  textoInactivo = "Inactivo",
}: {
  activo: boolean;
  textoActivo?: string;
  textoInactivo?: string;
}) {
  return (
    <EtiquetaEstado
      tipo={activo ? "activo" : "inactivo"}
      texto={activo ? textoActivo : textoInactivo}
    />
  );
}

/** Convierte un estado del backend ("Pendiente", "Anulada"…) en un tono. */
export function tonoDeEstado(estado: string): TipoEtiqueta {
  const texto = estado.toLowerCase();

  if (["pagado", "entregado", "aprobada", "activo", "activa", "completado"].includes(texto)) {
    return "activo";
  }
  if (["pendiente", "en proceso", "en camino", "parcial"].includes(texto)) {
    return "pendiente";
  }
  if (["cancelado", "cancelada", "anulada", "rechazada", "inactivo", "vencido"].includes(texto)) {
    return "inactivo";
  }
  return "neutro";
}

/* ---------------------------------------------------------------
   FORMATO DE DATOS (Colombia: fecha corta e iniciales)
--------------------------------------------------------------- */

export function fecha(valor: string | null | undefined): string {
  if (!valor) return "—";
  const fechaObjeto = new Date(valor);
  if (Number.isNaN(fechaObjeto.getTime())) return String(valor);
  return fechaObjeto.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function iniciales(nombre: string | null | undefined): string {
  if (!nombre) return "?";
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join("");
}
