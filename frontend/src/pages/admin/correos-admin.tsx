import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { EncabezadoModulo } from "../../components/indicadores";
import { useSesion } from "../../context/sesion-contexto";
import { correosAdmin, type CorreoContacto, type ResultadoCorreo } from "../../services/api";
import "../../assets/style/admin/correos.css";

const asuntoRespuesta = (asunto: string) => (/^re:/i.test(asunto) ? asunto : `Re: ${asunto}`).slice(0, 180);

const ESTADO: Record<ResultadoCorreo["estado"], string> = {
  aceptado: "Aceptado por Gmail (entrega final no garantizada)",
  rechazado: "Rechazado por Gmail",
  desconocido: "Resultado desconocido: revisa Gmail antes de reenviar",
  no_enviado: "No enviado",
};

export default function CorreosAdmin() {
  const { usuario } = useSesion();
  const [mensajes, setMensajes] = useState<CorreoContacto[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [siguiente, setSiguiente] = useState<number | null>(null);
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [asunto, setAsunto] = useState("Re: Nuevo mensaje desde la página de Dotaciones Toronto");
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [error, setError] = useState("");
  const [resultados, setResultados] = useState<ResultadoCorreo[]>([]);
  const elegidos = useMemo(() => mensajes.filter(m => seleccion.includes(m.uid)), [mensajes, seleccion]);

  const cargar = useCallback(async (antes?: number) => {
    setCargando(true); setError("");
    try {
      const datos = await correosAdmin.listar(antes);
      if (antes !== undefined && version !== datos.uidvalidity) {
        setMensajes([]); setSeleccion([]); setVersion(null); setSiguiente(null);
        setError("La bandeja cambió. Actualiza la lista desde el principio."); return;
      }
      setVersion(datos.uidvalidity);
      setMensajes(prev => antes === undefined ? datos.items : [...prev, ...datos.items]);
      setSiguiente(datos.siguiente_antes);
      if (antes === undefined) setSeleccion([]);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo consultar Gmail."); }
    finally { setCargando(false); }
  }, [version]);

  useEffect(() => { void cargar(); /* solo al entrar, no al cambiar UIDVALIDITY */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (seleccion.length || texto || enviando || bloqueado || mensajes.length > 50) return;
    const intervalo = window.setInterval(() => { void cargar(); }, 60_000);
    return () => window.clearInterval(intervalo);
  }, [cargar, seleccion.length, texto, enviando, bloqueado, mensajes.length]);

  const alternar = (uid: number) => {
    setError("");
    if (seleccion.includes(uid)) { setSeleccion(prev => prev.filter(id => id !== uid)); return; }
    if (seleccion.length >= 25) { setError("Puedes seleccionar hasta 25 mensajes por envío."); return; }
    if (!seleccion.length) {
      const elegido = mensajes.find(m => m.uid === uid);
      if (elegido) setAsunto(asuntoRespuesta(elegido.asunto));
    }
    setSeleccion(prev => [...prev, uid]);
  };
  const enviar = async (e: FormEvent) => {
    e.preventDefault(); setError("");
    if (!version || !elegidos.length || !asunto.trim() || !texto.trim()) {
      setError("Selecciona al menos un mensaje y escribe asunto y respuesta."); return;
    }
    if (new Set(elegidos.map(m => m.correo?.toLowerCase())).size !== elegidos.length) {
      setError("Hay varios mensajes del mismo correo. Selecciona solo uno por destinatario."); return;
    }
    if (!window.confirm(`¿Enviar este mensaje a ${elegidos.length} destinatario(s)? Cada persona recibirá un correo separado.`)) return;
    setEnviando(true); setBloqueado(true); setResultados([]);
    try {
      const respuesta = await correosAdmin.responder({ uids: seleccion, uidvalidity: version, asunto: asunto.trim(), mensaje: texto.trim() });
      setResultados(respuesta.resultados);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "No se pudo completar el envío."} Si se perdió la conexión, revisa Gmail antes de reenviar: el resultado podría ser desconocido.`);
    } finally { setEnviando(false); }
  };
  const nuevoEnvio = () => { setBloqueado(false); setSeleccion([]); setResultados([]); setTexto(""); setError(""); };

  return <section className="dt-modulo dt-correos">
    <EncabezadoModulo seccion="Administración" titulo="Correos de contacto" descripcion="Consulta la bandeja de entrada de Gmail y responde a uno o varios remitentes." rol={usuario ? { nombre: usuario.nombre_rol, clase: "admin" } : undefined} />
    <div className="dt-correo-aviso">Se muestran todos los correos de Recibidos de Gmail, incluidas respuestas y mensajes privados. Los envíos múltiples se hacen por separado. Consulta Gmail para ver adjuntos, archivados o spam.</div>
    {error && <p role="alert" className="dt-correo-error">{error}</p>}
    <div className="dt-correos-layout">
      <div className="dt-correo-panel">
        <div className="dt-correo-titulo"><div><h2>Bandeja de entrada</h2><p>Selecciona hasta 25 mensajes, uno por destinatario.</p></div><button type="button" onClick={() => void cargar()} disabled={cargando || enviando || bloqueado}>Actualizar</button></div>
        {cargando && <p role="status">Consultando Gmail…</p>}
        {!cargando && !mensajes.length && !error && <p>No hay mensajes en la bandeja de entrada.</p>}
        {seleccion.length > 0 && <div className="dt-correo-controles">
          <button type="button" disabled={enviando || bloqueado} onClick={() => setSeleccion([])}>Limpiar selección</button>
        </div>}
        <div className="dt-correo-lista">
          {mensajes.map(m => <article className="dt-correo-item" key={m.uid}>
            <label className="dt-correo-cabecera"><input type="checkbox" checked={seleccion.includes(m.uid)} onChange={() => alternar(m.uid)} disabled={enviando || bloqueado || !m.correo} /><span><strong>{m.nombre}</strong><br /><small>De: {m.remitente ?? "desconocido"} · {m.fecha}</small><br /><small>Responder a: {m.correo ?? "dirección no disponible"}</small></span></label>
            <p className="dt-correo-asunto"><strong>Asunto:</strong> {m.asunto} {m.tipo === "formulario" && <span> · Formulario web</span>}</p>
            <p className="dt-correo-mensaje">{m.mensaje}</p>
            <button type="button" disabled={enviando || bloqueado || !m.correo} onClick={() => { setSeleccion([m.uid]); setAsunto(asuntoRespuesta(m.asunto)); setError(""); }}>Responder a este correo</button>
          </article>)}
        </div>
        {siguiente !== null && <button type="button" onClick={() => void cargar(siguiente)} disabled={cargando || enviando || bloqueado}>Cargar anteriores</button>}
      </div>
      <div className="dt-correo-panel dt-correo-redactar">
        <h2>Redactar respuesta</h2>
        <p><strong>{elegidos.length}</strong> destinatario(s) seleccionado(s)</p>
        {elegidos.length > 0 && <ul className="dt-correo-destinos">{elegidos.map(m => <li key={m.uid}>{m.nombre} — {m.correo}</li>)}</ul>}
        <form onSubmit={enviar}>
          <label htmlFor="correo-asunto">Asunto</label><input id="correo-asunto" value={asunto} maxLength={180} onChange={e => setAsunto(e.target.value)} disabled={bloqueado || enviando} required />
          <label htmlFor="correo-respuesta">Mensaje</label><textarea id="correo-respuesta" value={texto} maxLength={5000} rows={10} onChange={e => setTexto(e.target.value)} disabled={bloqueado || enviando} required />
          <small>Verifica los destinatarios y el contenido antes de enviar. No uses este formulario para publicidad sin la autorización aplicable.</small>
          <button className="dt-accion-principal" type="submit" disabled={enviando || bloqueado || !seleccion.length}>{enviando ? "Enviando…" : `Enviar respuesta${seleccion.length > 1 ? "s" : ""}`}</button>
        </form>
        {bloqueado && !enviando && <div className="dt-correo-resultados" aria-live="polite"><h3>Resultado del envío</h3>{resultados.length > 0 ? <ul>{resultados.map(r => <li key={r.uid}><strong>{r.correo}:</strong> {ESTADO[r.estado]}</li>)}</ul> : <p>El resultado no está disponible. Revisa Gmail antes de volver a enviar.</p>}<button type="button" onClick={nuevoEnvio}>Preparar otro envío</button></div>}
      </div>
    </div>
  </section>;
}
