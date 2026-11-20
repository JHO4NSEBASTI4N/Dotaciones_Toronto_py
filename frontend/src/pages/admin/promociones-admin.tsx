import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, RefreshCw, Tag, X } from "../../components/iconos";
import { Aviso, BarraListado, CajaBusqueda, EncabezadoModulo, EtiquetaEstado, FiltroEstado, FilaIndicadores, Indicador, TablaCargando, TablaVacia } from "../../components/indicadores";
import { useSesion } from "../../context/sesion-contexto";
import { descuentos, pesos, productos, traerTodo } from "../../services/api";
import type { Descuento, Producto } from "../../types";

type Formulario = { producto: string; tipo: "PORCENTAJE" | "FIJO"; valor: string; inicio: string; fin: string };
const VACIO: Formulario = { producto: "", tipo: "PORCENTAJE", valor: "", inicio: "", fin: "" };

function estado(d: Descuento): "Desactivada" | "Programada" | "Finalizada" | "Vigente" {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  const hoy = `${parte("year")}-${parte("month")}-${parte("day")}`;
  if (!d.activo) return "Desactivada";
  if (d.fecha_inicio && d.fecha_inicio > hoy) return "Programada";
  if (d.fecha_fin && d.fecha_fin < hoy) return "Finalizada";
  return "Vigente";
}

export default function PromocionesAdmin() {
  const { usuario } = useSesion();
  const [lista, setLista] = useState<Descuento[]>([]);
  const [catalogo, setCatalogo] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<Descuento | null>(null);
  const [form, setForm] = useState<Formulario>(VACIO);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [d, p] = await Promise.all([
        traerTodo((saltar, limite) => descuentos.listar(saltar, limite)),
        traerTodo((saltar, limite) => productos.listar({ saltar, limite, incluir_inhabilitados: true })),
      ]);
      setLista(d.items); setCatalogo(p.items);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudieron cargar las promociones."); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const nombres = useMemo(() => Object.fromEntries(catalogo.map((p) => [p.id_producto, p.nombre])), [catalogo]);
  const filtrados = lista.filter((d) => (!filtro || estado(d) === filtro) &&
    `${nombres[d.id_producto_fk] ?? ""} ${d.id_producto_fk}`.toLowerCase().includes(busqueda.trim().toLowerCase()));
  const abrir = (d?: Descuento) => {
    setEditando(d ?? null);
    setForm(d ? { producto: String(d.id_producto_fk), tipo: d.tipo_descuento, valor: String(d.valor_descuento), inicio: d.fecha_inicio ?? "", fin: d.fecha_fin ?? "" } : VACIO);
    setError(""); setAbierto(true);
  };
  const guardar = async (e: FormEvent) => {
    e.preventDefault(); setError("");
    if (form.fin < form.inicio) { setError("La fecha final no puede ser anterior al inicio."); return; }
    setGuardando(true);
    try {
      const datos = { tipo_descuento: form.tipo, valor_descuento: Number(form.valor), fecha_inicio: form.inicio, fecha_fin: form.fin };
      if (editando) await descuentos.actualizar(editando.id_descuento, datos);
      else await descuentos.crear({ ...datos, id_producto_fk: Number(form.producto) });
      setAbierto(false); setMensaje(editando ? "Promoción actualizada." : "Promoción creada."); await cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar la promoción."); }
    finally { setGuardando(false); }
  };
  const alternar = async (d: Descuento) => {
    if (!d.activo && (!d.fecha_inicio || !d.fecha_fin)) {
      setError("Edita la promoción y asigna ambas fechas antes de activarla.");
      return;
    }
    if (!window.confirm(`${d.activo ? "¿Desactivar" : "¿Activar"} esta promoción?`)) return;
    setGuardando(true); setError("");
    try {
      if (d.activo) await descuentos.desactivar(d.id_descuento); else await descuentos.activar(d.id_descuento);
      setMensaje(d.activo ? "Promoción desactivada." : "Promoción habilitada."); await cargar();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cambiar el estado."); }
    finally { setGuardando(false); }
  };

  return <section className="dt-modulo">
    <EncabezadoModulo seccion="Administración" titulo="Promociones y descuentos" descripcion="Programa ofertas por producto. Las fechas incluyen el día inicial y final, hora de Colombia." rol={usuario ? { nombre: usuario.nombre_rol, clase: "admin" } : undefined} accion={<button type="button" className="dt-accion-principal" onClick={() => abrir()}><Plus size={15} /> Nueva promoción</button>} />
    {error && !abierto && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}
    {mensaje && <Aviso tipo="exito" mensaje={mensaje} onCerrar={() => setMensaje("")} />}
    <FilaIndicadores>
      <Indicador etiqueta="Promociones" valor={lista.length} descripcion="Registradas" icono={Tag} tono="azul" cargando={cargando} />
      <Indicador etiqueta="Vigentes" valor={lista.filter((d) => estado(d) === "Vigente").length} descripcion="Disponibles para clientes" icono={Tag} tono="verde" cargando={cargando} />
      <Indicador etiqueta="Programadas" valor={lista.filter((d) => estado(d) === "Programada").length} descripcion="Empiezan más adelante" icono={Tag} tono="ambar" cargando={cargando} />
    </FilaIndicadores>
    <section className="dt-listado">
      <BarraListado titulo="Promociones" descripcion={`${filtrados.length} de ${lista.length} registradas`} Icono={Tag}>
        <CajaBusqueda valor={busqueda} onCambio={setBusqueda} marcador="Producto o código" />
        <FiltroEstado valor={filtro} onCambio={setFiltro} opciones={[{ valor: "", texto: "Todos los estados" }, ...["Vigente", "Programada", "Finalizada", "Desactivada"].map((valor) => ({ valor, texto: valor }))]} />
        <button type="button" className="dt-boton-icono" aria-label="Actualizar" onClick={() => void cargar()} disabled={cargando}><RefreshCw size={15} /></button>
      </BarraListado>
      {cargando ? <TablaCargando mensaje="Consultando promociones…" /> : filtrados.length === 0 ? <TablaVacia titulo="No hay promociones" mensaje="Crea una promoción o cambia los filtros." Icono={Tag} /> :
        <div className="dt-tabla-scroll"><table className="dt-tabla"><thead><tr><th>Producto</th><th>Descuento</th><th>Inicio</th><th>Final</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
          {filtrados.map((d) => { const actual = estado(d); return <tr key={d.id_descuento}>
            <td>{nombres[d.id_producto_fk] ?? `Producto #${d.id_producto_fk}`} <small>#{d.id_producto_fk}</small></td>
            <td>{d.tipo_descuento === "PORCENTAJE" ? `${Number(d.valor_descuento)} %` : pesos(d.valor_descuento)}</td>
            <td>{d.fecha_inicio ?? "Sin límite"}</td><td>{d.fecha_fin ?? "Sin límite"}</td>
            <td><EtiquetaEstado tipo={actual === "Vigente" ? "activo" : actual === "Programada" ? "pendiente" : "inactivo"} texto={actual} /></td>
            <td><div className="dt-acciones-fila"><button type="button" className="dt-boton-icono" aria-label={`Editar promoción ${d.id_descuento}`} title="Editar" onClick={() => abrir(d)}><Pencil size={15} /></button><button type="button" className="dt-boton-secundario" disabled={guardando} onClick={() => void alternar(d)}>{d.activo ? "Desactivar" : "Activar"}</button></div></td>
          </tr>; })}
        </tbody></table></div>}
    </section>
    {abierto && <div className="dt-modal-fondo"><section className="dt-modal" role="dialog" aria-modal="true" aria-labelledby="titulo-promocion">
      <header className="dt-modal-encabezado"><span className="dt-modal-icono"><Tag size={21} /></span><div className="dt-modal-titulo-grupo"><h2 id="titulo-promocion">{editando ? "Editar promoción" : "Nueva promoción"}</h2><p>Las fechas son inclusivas. No se permiten promociones habilitadas con fechas cruzadas para el mismo producto.</p></div><button type="button" className="dt-boton-cerrar-modal" onClick={() => setAbierto(false)} disabled={guardando} aria-label="Cerrar"><X size={16} /></button></header>
      {error && <Aviso tipo="error" mensaje={error} onCerrar={() => setError("")} />}
      <form onSubmit={(e) => void guardar(e)}><div className="dt-formulario-contenido"><div className="dt-formulario-grid">
        <label className="dt-campo-ancho">Producto <span>*</span><select required value={form.producto} disabled={!!editando} onChange={(e) => setForm({ ...form, producto: e.target.value })}><option value="">Selecciona un producto</option>{catalogo.filter((p) => !p.inhabilitado || p.id_producto === editando?.id_producto_fk).map((p) => <option key={p.id_producto} value={p.id_producto}>{p.nombre} · #{p.id_producto} · {pesos(p.precio)}</option>)}</select></label>
        <label>Tipo <span>*</span><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Formulario["tipo"] })}><option value="PORCENTAJE">Porcentaje (%)</option><option value="FIJO">Valor fijo (COP)</option></select></label>
        <label>Valor <span>*</span><input required type="number" min="0.01" step="0.01" max={form.tipo === "PORCENTAJE" ? 100 : undefined} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></label>
        <label>Fecha de inicio <span>*</span><input required type="date" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} /></label>
        <label>Fecha final <span>*</span><input required type="date" min={form.inicio} value={form.fin} onChange={(e) => setForm({ ...form, fin: e.target.value })} /></label>
      </div></div><footer className="dt-modal-acciones"><button type="button" className="dt-boton-secundario" disabled={guardando} onClick={() => setAbierto(false)}>Cancelar</button><button type="submit" className="dt-accion-principal" disabled={guardando}>{guardando ? "Guardando…" : "Guardar promoción"}</button></footer></form>
    </section></div>}
  </section>;
}
