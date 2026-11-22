import { useRef, useState } from "react";
import { api, BASE_URL } from "../services/api";
import "../assets/style/carga-masiva.css";

type Tipo = "productos" | "inventario" | "usuarios";
type Resultado = { total: number; validos: number; guardados: number; errores: { fila: number; mensaje: string }[] };

export function CargaMasiva({ tipo, alGuardar }: { tipo: Tipo; alGuardar: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const entrada = useRef<HTMLInputElement>(null);
  const descripcion = {
    productos: "Cada fila crea un producto nuevo; no actualiza productos existentes.",
    inventario: "Las cantidades se SUMAN al stock. No vuelvas a cargar el mismo archivo o se sumarán otra vez.",
    usuarios: "No incluyas contraseñas en el Excel. Después de cargar, el administrador puede asignar una contraseña individual o el usuario puede recuperarla desde el login con su correo. Los roles deben existir y estar activos.",
  }[tipo];

  async function descargar() {
    setOcupado(true); setMensaje("");
    try {
      const token = localStorage.getItem("token");
      const r = await fetch(`${BASE_URL}/cargas-masivas/${tipo}/plantilla`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!r.ok) throw new Error("No se pudo descargar la plantilla. Verifica tu sesión de administrador.");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a"); a.href = url; a.download = `plantilla_${tipo}.xlsx`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setMensaje(e instanceof Error ? e.message : "No se pudo descargar la plantilla."); }
    finally { setOcupado(false); }
  }

  async function procesar(guardar: boolean) {
    if (!archivo) return;
    setOcupado(true); setMensaje("");
    try {
      const datos = new FormData(); datos.append("archivo", archivo);
      const r = await api.post<Resultado>(`/cargas-masivas/${tipo}?guardar=${guardar}`, datos, { redirigirEnError: false });
      setResultado(r);
      if (r.errores.length) setMensaje("Corrige los errores indicados y vuelve a validar. No se guardó ninguna fila.");
      else if (guardar) {
        setMensaje(`Carga completada: ${r.guardados} filas guardadas.${tipo === "usuarios" ? " Asigna una contraseña desde Usuarios o indica a cada persona que la recupere desde el login." : ""}`);
        setArchivo(null); if (entrada.current) entrada.current.value = "";
        alGuardar();
      } else setMensaje(`${r.validos} filas válidas. Revisa y confirma para guardar.`);
    } catch (e) {
      setResultado(null);
      setMensaje(e instanceof Error ? e.message : "No se pudo procesar el archivo.");
      if (guardar) setMensaje("No se pudo confirmar el resultado. Antes de reintentar, revisa el listado o los movimientos para evitar duplicados.");
    } finally { setOcupado(false); }
  }

  return (
    <section className="carga-masiva">
      <button
        type="button"
        className="carga-masiva__cabecera"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        aria-controls={`carga-masiva-${tipo}`}
      >
        <span className="carga-masiva__icono" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4M9 13h6M9 17h6"/>
          </svg>
        </span>
        <span className="carga-masiva__titulo">
          <strong>Carga masiva desde Excel</strong>
          <small>Importa tus datos de forma sencilla y segura</small>
        </span>
        <span className="carga-masiva__flecha" aria-hidden="true">⌄</span>
      </button>

      {abierto && (
        <div className="carga-masiva__contenido" id={`carga-masiva-${tipo}`}>
          <p className="carga-masiva__descripcion">{descripcion}</p>
          <p className="carga-masiva__instrucciones">
            Descarga la plantilla, llena la hoja <strong>Datos</strong> y guarda el archivo en formato .xlsx.
            <span>Máximo 500 filas y 2 MB.</span>
          </p>

          <div className="carga-masiva__pasos">
            <button type="button" className="carga-masiva__boton carga-masiva__boton--secundario" onClick={() => void descargar()} disabled={ocupado}>
              Descargar plantilla
            </button>
            <label className="carga-masiva__archivo">
              <span>Selecciona tu archivo Excel</span>
              <input ref={entrada} type="file" accept=".xlsx" disabled={ocupado} onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setResultado(null); setMensaje(""); }} />
            </label>
          </div>

          <div className="carga-masiva__acciones">
            <button type="button" className="carga-masiva__boton carga-masiva__boton--secundario" disabled={!archivo || ocupado} onClick={() => void procesar(false)}>Validar archivo</button>
            <button type="button" className="carga-masiva__boton carga-masiva__boton--principal" disabled={!archivo || ocupado || !resultado || resultado.errores.length > 0 || resultado.guardados > 0} onClick={() => void procesar(true)}>Confirmar y guardar</button>
          </div>

          {ocupado && (
            <div className="carga-masiva__progreso" role="status" aria-live="polite">
              <span className="carga-masiva__spinner" aria-hidden="true" />
              <span><strong>Procesando…</strong><small>Espera un momento y no cierres esta página.</small></span>
            </div>
          )}
          {mensaje && <p className="carga-masiva__mensaje" role="status">{mensaje}</p>}
          {!!resultado?.errores.length && (
            <ul className="carga-masiva__errores">
              {resultado.errores.map((e, i) => <li key={i}><strong>Fila {e.fila}:</strong> {e.mensaje}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
