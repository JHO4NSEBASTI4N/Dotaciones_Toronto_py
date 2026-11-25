import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Mail, Package, ShieldCheck } from "../components/iconos";
import { api } from "../services/api";
import { FeedbackValidacion } from "../components/feedback-validacion";
import { useCamposTocados } from "../hooks/use-campos-tocados";
import { validarCorreo, validarPasswordSegura } from "../utils/validaciones";

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
  const { tocar, tocarVarios, mostrar, reiniciar } = useCamposTocados();
  const erroresCampos = {
    correo: validarCorreo(correo),
    codigo: /^\d{6}$/.test(codigo) ? null : "El código debe contener exactamente 6 dígitos.",
    password: validarPasswordSegura(password),
    confirmar: !confirmar
      ? "Confirma la nueva contraseña."
      : password !== confirmar
        ? "Las contraseñas no coinciden."
        : null,
  };

  async function solicitar(e?: FormEvent) {
    e?.preventDefault();
    const validacionCorreo = erroresCampos.correo;
    if (validacionCorreo) { tocar("correo"); setError(validacionCorreo); return; }
    setOcupado(true); setError(""); setMensaje("");
    try {
      const r = await api.post<{ mensaje: string }>("/auth/recuperacion/solicitar", { correo: correo.trim() }, { redirigirEnError: false });
      setCodigo(""); setTicket(""); reiniciar(); setPaso("codigo"); setMensaje(r.mensaje);
    } catch (e) { setError(e instanceof Error ? e.message : "No fue posible enviar la solicitud."); }
    finally { setOcupado(false); }
  }

  async function verificar(e: FormEvent) {
    e.preventDefault();
    if (erroresCampos.codigo) { tocar("codigo"); setError(erroresCampos.codigo); return; }
    setOcupado(true); setError(""); setMensaje("");
    try {
      const r = await api.post<{ ticket: string }>("/auth/recuperacion/verificar", { correo: correo.trim(), codigo }, { redirigirEnError: false });
      setTicket(r.ticket); setCodigo(""); reiniciar(); setPaso("password");
    } catch (e) { setError(e instanceof Error ? e.message : "No fue posible verificar el código."); }
    finally { setOcupado(false); }
  }

  async function cambiar(e: FormEvent) {
    e.preventDefault(); setError("");
    const validacionPassword = erroresCampos.password ?? erroresCampos.confirmar;
    if (validacionPassword) {
      tocarVarios(["password", "confirmar"]);
      setError(validacionPassword);
      return;
    }
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
        <p>{paso === "correo" ? "Escribe el correo con el que te registraste." : paso === "codigo" ? "Revisa tu correo y la carpeta de spam. El código dura 10 minutos." : "Usa 8 o más caracteres, una letra, un número y un símbolo; luego confirma la contraseña."}</p>
        {paso === "correo" && <form className="login-formulario" noValidate onSubmit={solicitar}>
          <label className="campo"><span>Correo electrónico</span><div className="campo-caja"><Mail size={16}/><input type="email" autoComplete="email" maxLength={254} required value={correo} onChange={e => { setCorreo(e.target.value); tocar("correo"); }} onBlur={() => tocar("correo")} aria-invalid={mostrar("correo") && Boolean(erroresCampos.correo)} aria-describedby="recuperar-correo-feedback" placeholder="tu.correo@ejemplo.com" /></div><FeedbackValidacion id="recuperar-correo-feedback" error={erroresCampos.correo} mostrar={mostrar("correo")} /></label>
          {error && <p className="mensaje-error" role="alert">{error}</p>}
          <button className="boton-principal" disabled={ocupado}>{ocupado ? "Enviando…" : "Enviar código"}</button>
        </form>}
        {paso === "codigo" && <form className="login-formulario" noValidate onSubmit={verificar}>
          {mensaje && <p role="status">{mensaje}</p>}
          <label className="campo"><span>Código de 6 dígitos</span><div className="campo-caja"><Lock size={16}/><input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={codigo} onChange={e => { setCodigo(e.target.value.replace(/[^0-9]/g, "")); tocar("codigo"); }} onBlur={() => tocar("codigo")} aria-invalid={mostrar("codigo") && Boolean(erroresCampos.codigo)} aria-describedby="recuperar-codigo-feedback" placeholder="000000" /></div><FeedbackValidacion id="recuperar-codigo-feedback" error={erroresCampos.codigo} mostrar={mostrar("codigo")} /></label>
          {error && <p className="mensaje-error" role="alert">{error}</p>}
          <button className="boton-principal" disabled={ocupado}>{ocupado ? "Verificando…" : "Verificar código"}</button>
          <button type="button" className="dt-boton-secundario" disabled={ocupado} onClick={() => void solicitar()}>Solicitar otro código</button>
          <button type="button" className="dt-boton-secundario" disabled={ocupado} onClick={() => { reiniciar(); setPaso("correo"); setError(""); setMensaje(""); }}>Cambiar correo</button>
          <small>Para solicitar otro código espera al menos un minuto.</small>
        </form>}
        {paso === "password" && <form className="login-formulario" noValidate onSubmit={cambiar}>
          <label className="campo"><span>Nueva contraseña</span><div className="campo-caja"><Lock size={16}/><input type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={e => { setPassword(e.target.value); tocar("password"); }} onBlur={() => tocar("password")} aria-invalid={mostrar("password") && Boolean(erroresCampos.password)} aria-describedby="recuperar-password-feedback" /></div><FeedbackValidacion id="recuperar-password-feedback" error={erroresCampos.password} mostrar={mostrar("password")} valido="Cumple la política de contraseña." /></label>
          <label className="campo"><span>Confirmar contraseña</span><div className="campo-caja"><Lock size={16}/><input type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={confirmar} onChange={e => { setConfirmar(e.target.value); tocar("confirmar"); }} onBlur={() => tocar("confirmar")} aria-invalid={mostrar("confirmar") && Boolean(erroresCampos.confirmar)} aria-describedby="recuperar-confirmar-feedback" /></div><FeedbackValidacion id="recuperar-confirmar-feedback" error={erroresCampos.confirmar} mostrar={mostrar("confirmar")} valido="Las contraseñas coinciden." /></label>
          {error && <p className="mensaje-error" role="alert">{error}</p>}
          <button className="boton-principal" disabled={ocupado}>{ocupado ? "Guardando…" : "Confirmar contraseña"}</button>
          <p>Si el código expira, vuelve a solicitar uno desde el inicio.</p>
          <button type="button" className="dt-boton-secundario" disabled={ocupado} onClick={() => { setPaso("correo"); setTicket(""); setPassword(""); setConfirmar(""); setError(""); }}>Solicitar otro código</button>
        </form>}
      </div>
    </div></section>
  </div>;
}
