import { useRef, useState } from "react";
import { api, BASE_URL } from "../services/api";

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

  return <section style={{ margin: "16px 0", padding: 16, background: "white", border: "1px solid #dce5e1", borderRadius: 12 }}>
    <button type="button" className="dt-boton-secundario" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>📄 Carga masiva desde Excel</button>
    {abierto && <div style={{ marginTop: 12 }}>
      <p>{descripcion}</p>
      <p>Descarga la plantilla, llena la hoja Datos y guarda el archivo en formato .xlsx (máximo 500 filas y 2 MB).</p>
      <button type="button" className="dt-boton-secundario" onClick={() => void descargar()} disabled={ocupado}>Descargar plantilla</button>{" "}
      <label>Archivo: <input ref={entrada} type="file" accept=".xlsx" disabled={ocupado} onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setResultado(null); setMensaje(""); }} /></label>{" "}
      <button type="button" className="dt-boton-secundario" disabled={!archivo || ocupado} onClick={() => void procesar(false)}>Validar archivo</button>{" "}
      <button type="button" className="dt-accion-principal" disabled={!archivo || ocupado || !resultado || resultado.errores.length > 0 || resultado.guardados > 0} onClick={() => void procesar(true)}>Confirmar y guardar</button>
      {ocupado && <p>Procesando…</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      {!!resultado?.errores.length && <ul style={{ maxHeight: 200, overflow: "auto", color: "#9f2020" }}>{resultado.errores.map((e, i) => <li key={i}>Fila {e.fila}: {e.mensaje}</li>)}</ul>}
    </div>}
  </section>;
}
