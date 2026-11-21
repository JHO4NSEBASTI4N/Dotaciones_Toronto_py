import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Mail, Package, ShieldCheck } from "../components/iconos";
import { api } from "../services/api";

type Paso = "correo" | "codigo" | "password";

export default function RecuperarPassword() {
  const navegar = useNavigate();
  const [paso, setPaso] = useState<Paso>("correo");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ticket, setTicket] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function solicitar(e?: FormEvent) {
    e?.preventDefault(); setOcupado(true); setError(""); setMensaje("");
    try {
      const r = await api.post<{ mensaje: string }>("/auth/recuperacion/solicitar", { correo: correo.trim() }, { redirigirEnError: false });
      setCodigo(""); setTicket(""); setPaso("codigo"); setMensaje(r.mensaje);
    } catch (e) { setError(e instanceof Error ? e.message : "No fue posible enviar la solicitud."); }
    finally { setOcupado(false); }
  }

  async function verificar(e: FormEvent) {
    e.preventDefault(); setOcupado(true); setError(""); setMensaje("");
    try {
      const r = await api.post<{ ticket: string }>("/auth/recuperacion/verificar", { correo: correo.trim(), codigo }, { redirigirEnError: false });
      setTicket(r.ticket); setCodigo(""); setPaso("password");
    } catch (e) { setError(e instanceof Error ? e.message : "No fue posible verificar el código."); }
    finally { setOcupado(false); }
  }

  async function cambiar(e: FormEvent) {
    e.preventDefault(); setError("");
    if (password !== confirmar) { setError("Las contraseñas no coinciden."); return; }
    if (new TextEncoder().encode(password).length > 72) { setError("La contraseña supera el tamaño permitido. Usa menos caracteres."); return; }
    setOcupado(true);
    try {
      await api.post("/auth/recuperacion/cambiar", { correo: correo.trim(), ticket, password_nueva: password }, { redirigirEnError: false });
      setTicket(""); setPassword(""); setConfirmar("");
      navegar("/login?recuperada=1", { replace: true });
    } catch (e) { setError(e instanceof Error ? e.message : "No fue posible cambiar la contraseña."); }
    finally { setOcupado(false); }
  }

  return <div className="login-pagina">
    <section className="login-presentacion">
      <div className="marca"><span className="marca-icono"><Package size={23} /></span>Dotaciones <span className="marca-verde">Toronto</span></div>
      <div className="presentacion-contenido"><span className="etiqueta">SEGURIDAD DE TU CUENTA</span><h1>Recupera el acceso a tu cuenta.</h1><p>Te enviaremos un código al correo registrado. No lo compartas con nadie.</p></div>
      <div className="presentacion-pie"><ShieldCheck size={14} /></div>
    </section>
    <section className="login-formulario-lado"><div className="login-formulario-contenido">
      <Link to="/login" className="auth-volver-inicio"><ArrowLeft size={16} /> Volver a iniciar sesión</Link>
      <div className="login-caja">
        <h2>{paso === "correo" ? "Recuperar contraseña" : paso === "codigo" ? "Ingresa el código" : "Crea tu nueva contraseña"}</h2>
        <p>{paso === "correo" ? "Escribe el correo con el que te registraste." : paso === "codigo" ? "Revisa tu correo y la carpeta de spam. El código dura 10 minutos." : "Escribe y confirma tu nueva contraseña."}</p>
        {paso === "correo" && <form className="login-formulario" onSubmit={solicitar}>
          <label className="campo"><span>Correo electrónico</span><div className="campo-caja"><Mail size={16}/><input type="email" autoComplete="email" required value={correo} onChange={e => setCorreo(e.target.value)} placeholder="tu.correo@ejemplo.com" /></div></label>
          {error && <p className="mensaje-error" role="alert">{error}</p>}
          <button className="boton-principal" disabled={ocupado}>{ocupado ? "Enviando…" : "Enviar código"}</button>
        </form>}
        {paso === "codigo" && <form className="login-formulario" onSubmit={verificar}>
          {mensaje && <p role="status">{mensaje}</p>}
          <label className="campo"><span>Código de 6 dígitos</span><div className="campo-caja"><Lock size={16}/><input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={codigo} onChange={e => setCodigo(e.target.value.replace(/[^0-9]/g, ""))} placeholder="000000" /></div></label>
          {error && <p className="mensaje-error" role="alert">{error}</p>}
          <button className="boton-principal" disabled={ocupado}>{ocupado ? "Verificando…" : "Verificar código"}</button>
          <button type="button" className="dt-boton-secundario" disabled={ocupado} onClick={() => void solicitar()}>Solicitar otro código</button>
          <button type="button" className="dt-boton-secundario" disabled={ocupado} onClick={() => { setPaso("correo"); setError(""); setMensaje(""); }}>Cambiar correo</button>
          <small>Para solicitar otro código espera al menos un minuto.</small>
        </form>}
        {paso === "password" && <form className="login-formulario" onSubmit={cambiar}>
          <label className="campo"><span>Nueva contraseña</span><div className="campo-caja"><Lock size={16}/><input type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={e => setPassword(e.target.value)} /></div></label>
          <label className="campo"><span>Confirmar contraseña</span><div className="campo-caja"><Lock size={16}/><input type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={confirmar} onChange={e => setConfirmar(e.target.value)} /></div></label>
          {error && <p className="mensaje-error" role="alert">{error}</p>}
          <button className="boton-principal" disabled={ocupado}>{ocupado ? "Guardando…" : "Confirmar contraseña"}</button>
          <p>Si el código expira, vuelve a solicitar uno desde el inicio.</p>
          <button type="button" className="dt-boton-secundario" disabled={ocupado} onClick={() => { setPaso("correo"); setTicket(""); setPassword(""); setConfirmar(""); setError(""); }}>Solicitar otro código</button>
        </form>}
      </div>
    </div></section>
  </div>;
}
