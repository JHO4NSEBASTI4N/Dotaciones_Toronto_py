// src/App.tsx
//
// Rutas y layout del sistema. Las rutas siguen el mismo esquema que usaba el
// proyecto Java: /admin, /vendedor, /bodeguero, /cliente, y fuera de ellos
// /index (portada), /login, /registro, /seleccionar-rol y /error/*.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowLeftRight,
  ArrowRight,
  BadgeCheck,
  Boxes,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tag,
  UserRound,
  Users,
  X,
} from "./components/iconos";

import {
  CLASE_ROL,
  MODULOS_POR_ROL,
  NOMBRE_ROL,
  ProveedorSesion,
  useSesion,
} from "./context/sesion-contexto";

import { LimiteErrores } from "./components/limite-errores";
import { EVENTO_ERROR_HTTP, type EventoPaginaError } from "./services/api";
import { autenticacion } from "./services/autenticacion";

// Pantallas fuera de los roles
import Portada from "./pages/index";
import Login from "./pages/login";
import RecuperarPassword from "./pages/recuperar-password";
import Registro from "./pages/registro";
import SeleccionarRol from "./pages/seleccionar-rol";
import Error403 from "./pages/error/403";
import Error404 from "./pages/error/404";
import Error500 from "./pages/error/500";
import ErrorGeneral from "./pages/error/general";

// Administrador
import PanelAdmin from "./pages/admin/panel-admin";
import UsuariosAdmin from "./pages/admin/usuarios-admin";
import EditarUsuarioAdmin from "./pages/admin/editar-usuario-admin";
import RolesAdmin from "./pages/admin/roles-admin";
import ProductosAdmin from "./pages/admin/productos-admin";
import PromocionesAdmin from "./pages/admin/promociones-admin";
import InventarioAdmin from "./pages/admin/inventario-admin";
import PedidosAdmin from "./pages/admin/pedidos-admin";
import VentasAdmin from "./pages/admin/ventas-admin";
import DevolucionesAdmin from "./pages/admin/devoluciones-admin";
import FacturacionAdmin from "./pages/admin/facturacion-admin";
import FacturacionConfigAdmin from "./pages/admin/facturacion-config-admin";
import PerfilAdmin from "./pages/admin/perfil-admin";

// Vendedor
import PanelVendedor from "./pages/vendedor/panel-vendedor";
import PedidosVendedor from "./pages/vendedor/pedidos-vendedor";
import ReportesVendedor from "./pages/vendedor/reportes-vendedor";
import VentasVendedor from "./pages/vendedor/ventas-vendedor";
import DevolucionesVendedor from "./pages/vendedor/devoluciones-vendedor";
import PerfilVendedor from "./pages/vendedor/perfil-vendedor";

// Bodeguero
import PanelBodeguero from "./pages/bodeguero/panel-bodeguero";
import InventarioBodeguero from "./pages/bodeguero/inventario-bodeguero";
import AlertasBodeguero from "./pages/bodeguero/alertas-bodeguero";
import PerfilBodeguero from "./pages/bodeguero/perfil-bodeguero";

// Cliente
import PanelCliente from "./pages/cliente/panel-cliente";
import ProductosCliente from "./pages/cliente/productos-cliente";
import CarritoCliente from "./pages/cliente/carrito-cliente";
import PedidosCliente from "./pages/cliente/pedidos-cliente";
import DevolucionesCliente from "./pages/cliente/devoluciones-cliente";
import PerfilCliente from "./pages/cliente/perfil-cliente";

/* =========================================================
   MENÚ
========================================================= */

interface EnlaceMenu {
  modulo: string;
  texto: string;
  ruta: string;
  Icono: typeof LayoutDashboard;
}

const MENU: Record<number, EnlaceMenu[]> = {
  1: [
    { modulo: "dashboard", texto: "Panel", ruta: "/admin/panel", Icono: LayoutDashboard },
    { modulo: "usuarios", texto: "Usuarios", ruta: "/admin/usuarios", Icono: Users },
    { modulo: "roles", texto: "Roles y permisos", ruta: "/admin/roles", Icono: ShieldCheck },
    { modulo: "productos", texto: "Productos", ruta: "/admin/productos", Icono: Package },
    { modulo: "promociones", texto: "Promociones y descuentos", ruta: "/admin/promociones", Icono: Tag },
    { modulo: "pedidos", texto: "Pedidos", ruta: "/admin/pedidos", Icono: ClipboardList },
    { modulo: "ventas", texto: "Ventas", ruta: "/admin/ventas", Icono: CreditCard },
    { modulo: "devoluciones", texto: "Devoluciones", ruta: "/admin/devoluciones", Icono: ArrowLeftRight },
    { modulo: "inventario", texto: "Inventario", ruta: "/admin/inventario", Icono: Boxes },
    { modulo: "facturacion", texto: "Facturación DIAN", ruta: "/admin/facturacion", Icono: FileText },
    { modulo: "perfil", texto: "Mi perfil", ruta: "/admin/perfil", Icono: UserRound },
  ],
  2: [
    { modulo: "dashboard", texto: "Mi resumen", ruta: "/cliente/panel", Icono: LayoutDashboard },
    { modulo: "catalogo", texto: "Productos", ruta: "/cliente/productos", Icono: Store },
    { modulo: "mis-pedidos", texto: "Mis pedidos", ruta: "/cliente/pedidos", Icono: ClipboardList },
    { modulo: "devoluciones", texto: "Mis devoluciones", ruta: "/cliente/devoluciones", Icono: ArrowLeftRight },
    { modulo: "perfil", texto: "Mi perfil", ruta: "/cliente/perfil", Icono: UserRound },
  ],
  3: [
    { modulo: "dashboard", texto: "Mi jornada", ruta: "/vendedor/panel", Icono: LayoutDashboard },
    { modulo: "pedidos", texto: "Pedidos", ruta: "/vendedor/pedidos", Icono: ClipboardList },
    { modulo: "ventas", texto: "Ventas", ruta: "/vendedor/ventas", Icono: CreditCard },
    { modulo: "reportes", texto: "Reportes", ruta: "/vendedor/reportes", Icono: FileText },
    { modulo: "devoluciones", texto: "Devoluciones", ruta: "/vendedor/devoluciones", Icono: ArrowLeftRight },
    { modulo: "perfil", texto: "Mi perfil", ruta: "/vendedor/perfil", Icono: UserRound },
  ],
  4: [
    { modulo: "dashboard", texto: "Mi bodega", ruta: "/bodeguero/panel", Icono: LayoutDashboard },
    { modulo: "inventario", texto: "Inventario", ruta: "/bodeguero/inventario", Icono: Boxes },
    { modulo: "alertas", texto: "Alertas de stock", ruta: "/bodeguero/alertas", Icono: ShieldCheck },
    { modulo: "perfil", texto: "Mi perfil", ruta: "/bodeguero/perfil", Icono: UserRound },
  ],
};

const RUTA_INICIO: Record<number, string> = {
  1: "/admin/panel",
  2: "/cliente/panel",
  3: "/vendedor/panel",
  4: "/bodeguero/panel",
};

const DESCRIPCION_MODULO: Record<string, string> = {
  dashboard: "indicadores y atajos de tu rol",
  usuarios: "cuentas, roles asignados y estado",
  roles: "qué puede hacer cada rol del sistema",
  productos: "catálogo de dotaciones y sus precios",
  promociones: "descuentos y promociones programadas",
  pedidos: "solicitudes pendientes de despacho",
  ventas: "facturas emitidas y su estado",
  devoluciones: "solicitudes de cambio o devolución",
  inventario: "existencias por bodega y movimientos",
  alertas: "productos por debajo del mínimo",
  facturacion: "firma, envío a la DIAN y anulación",
  catalogo: "dotaciones disponibles para pedir",
  carrito: "lo que vas a solicitar",
  "mis-pedidos": "el estado de tus solicitudes",
  perfil: "tus datos de contacto",
};

/* =========================================================
   GUARDAS
========================================================= */

function PantallaCargando() {
  return (
    <div className="dt-pantalla-carga">
      <span className="dt-spinner dt-spinner-grande" />
      <span>Validando tu sesión…</span>
    </div>
  );
}

const NOMBRE_AREA: Record<string, string> = {
  admin: "Administrador",
  cliente: "Cliente",
  vendedor: "Vendedor",
  bodeguero: "Bodeguero",
};

/** Si la subruta de un área no existe: 403 si es de otro rol, 404 si es del propio. */
function SubrutaAreaNoEncontrada({ rolEsperado }: { rolEsperado: number }) {
  const { usuario } = useSesion();
  if (usuario && usuario.id_rol !== rolEsperado) {
    return <Navigate to="/error/403" replace />;
  }
  return <Error404 />;
}

function urlLoginDenegado(ruta: string): { to: string; avisoAcceso: string } {
  const area = ruta.split("/")[1] ?? "";
  const rol = NOMBRE_AREA[area];
  const codigo = rol ? area : "panel";
  const avisoAcceso = rol
    ? `Debes iniciar sesión para ingresar al panel de ${rol}.`
    : "Debes iniciar sesión para ingresar a esta sección.";
  return {
    to: `/login?denegado=${encodeURIComponent(codigo)}`,
    avisoAcceso,
  };
}

function RutaProtegida() {
  const { usuario, cargando, cambioRolEnCurso, cierreSesionEnCurso } = useSesion();
  const ubicacion = useLocation();

  if (cargando || cambioRolEnCurso) return <PantallaCargando />;
  if (!usuario) {
    if (cierreSesionEnCurso) {
      return <Navigate to="/login" replace />;
    }
    const { to, avisoAcceso } = urlLoginDenegado(ubicacion.pathname);
    return <Navigate to={to} replace state={{ avisoAcceso }} />;
  }

  return <Outlet />;
}

/** Exige que el rol activo tenga ese módulo; si no, manda a /error/403. */
function RutaConModulo({ modulo }: { modulo: string }) {
  const { usuario, cargando, cierreSesionEnCurso, puedeVer } = useSesion();
  const ubicacion = useLocation();

  if (cargando) return <PantallaCargando />;
  if (!usuario) {
    if (cierreSesionEnCurso) {
      return <Navigate to="/login" replace />;
    }
    const { to, avisoAcceso } = urlLoginDenegado(ubicacion.pathname);
    return <Navigate to={to} replace state={{ avisoAcceso }} />;
  }
  if (!puedeVer(modulo)) return <Navigate to="/error/403" replace />;

  return <Outlet />;
}

/** Protege /seleccionar-rol cuando alguien entra directo por URL sin sesión. */
function RutaSeleccionarRol() {
  const { usuario, cargando, cierreSesionEnCurso } = useSesion();

  if (cargando) return <PantallaCargando />;
  if (!usuario && !autenticacion.estaAutenticado()) {
    if (cierreSesionEnCurso) {
      return <Navigate to="/login" replace />;
    }
    return (
      <Navigate
        to="/login?denegado=rol"
        replace
        state={{ avisoAcceso: "Debes iniciar sesión para seleccionar un rol." }}
      />
    );
  }

  return <SeleccionarRol />;
}

/** Si ya hay sesión, el login y el registro no tienen sentido. */
function RutaPublica({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useSesion();

  if (cargando) return <PantallaCargando />;
  if (usuario) return <Navigate to={RUTA_INICIO[usuario.id_rol] ?? "/login"} replace />;

  return <>{children}</>;
}

/* =========================================================
   LAYOUT DEL PANEL
========================================================= */

function BannerRol({
  rutaActual,
  alAbrirCarrito,
}: {
  rutaActual: string;
  alAbrirCarrito: () => void;
}) {
  const { usuario } = useSesion();
  if (!usuario) return null;

  const modulo =
    Object.keys(DESCRIPCION_MODULO).find((clave) => rutaActual.includes(`/${clave}`)) ??
    "dashboard";

  const clase = CLASE_ROL[usuario.id_rol] ?? "cliente";
  const ICONO_ROL: Record<number, typeof ShieldCheck> = {
    1: ShieldCheck,
    2: UserRound,
    3: BadgeCheck,
    4: Boxes,
  };
  const Icono = ICONO_ROL[usuario.id_rol] ?? BadgeCheck;

  return (
    <div className={`dt-banner-modulo dt-banner-${clase}`}>
      <div className="dt-banner-contenido">
        <span className="dt-banner-icono">
          <Icono size={18} />
        </span>

        <div>
          <strong>Estás dentro como {usuario.nombre_rol}</strong>
          <span>
            {DESCRIPCION_MODULO[modulo] ?? "usa el menú de la izquierda para moverte"}
          </span>
        </div>
      </div>

      {usuario.id_rol === 2 && (
        <button
          type="button"
          className="dt-banner-carrito"
          onClick={alAbrirCarrito}
          aria-label="Abrir mi carrito"
          aria-haspopup="dialog"
        >
          <ShoppingCart size={17} />
          <span>Mi carrito</span>
        </button>
      )}
    </div>
  );
}

/** Cada carpeta de primer nivel (admin, vendedor…) pertenece a UN rol. */
const ROL_DE_AREA: Record<string, number> = {
  admin: 1,
  cliente: 2,
  vendedor: 3,
  bodeguero: 4,
};

function EstructuraPanel() {
  const { usuario, salir, cambiarRol } = useSesion();
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [errorCambioRol, setErrorCambioRol] = useState("");
  const rutaAnterior = useRef(ubicacion.pathname);

  useEffect(() => {
    const cambioRuta = rutaAnterior.current !== ubicacion.pathname;
    rutaAnterior.current = ubicacion.pathname;
    const estado = ubicacion.state as { abrirCarrito?: boolean } | null;

    if (usuario?.id_rol === 2 && estado?.abrirCarrito) {
      setCarritoAbierto(true);
      navegar(ubicacion.pathname, { replace: true, state: null });
    } else if (cambioRuta) {
      setCarritoAbierto(false);
    }
  }, [ubicacion.pathname, ubicacion.state, usuario?.id_rol, navegar]);

  useEffect(() => {
    if (!carritoAbierto) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setCarritoAbierto(false);
    };
    window.addEventListener("keydown", cerrarConEscape);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", cerrarConEscape);
    };
  }, [carritoAbierto]);

  const claseRol = CLASE_ROL[usuario?.id_rol ?? 2] ?? "cliente";
  const enlaces = MENU[usuario?.id_rol ?? 2] ?? [];
  const rolesDisponibles = useMemo(
    () => (usuario?.roles ?? []).filter((rol) => rol.id_rol !== usuario?.id_rol),
    [usuario]
  );

  if (!usuario) return null;

  // Si la dirección es de otra área (ej. /vendedor/... con sesión de Cliente),
  // se manda a la pantalla 403. Antes se veía la pantalla del otro rol con el
  // menú del rol actual, y eso confundía al cambiar de rol.
  const area = ubicacion.pathname.split("/")[1] ?? "";
  const rolDelArea = ROL_DE_AREA[area];

  if (rolDelArea !== undefined && rolDelArea !== usuario.id_rol) {
    return <Navigate to="/error/403" replace />;
  }

  const entrarConRol = async (idRol: number) => {
    setCambiando(true);
    setErrorCambioRol("");
    try {
      await cambiarRol(idRol);
    } catch (fallo) {
      setErrorCambioRol(
        fallo instanceof Error
          ? `No se pudo cambiar de rol: ${fallo.message}`
          : "No se pudo cambiar de rol. Vuelve a intentarlo."
      );
    } finally {
      setCambiando(false);
      setMenuAbierto(false);
    }
  };

  return (
    <div className={`dt-layout dt-layout-${claseRol}`}>
      {menuAbierto && (
        <button
          type="button"
          className="dt-fondo-movil"
          aria-label="Cerrar menú"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      <aside className={`dt-sidebar ${menuAbierto ? "dt-sidebar-abierto" : ""}`}>
        <div className="dt-marca">
          <span className="dt-marca-icono">
            <Package size={21} />
          </span>
          <span>
            Dotaciones <span>Toronto</span>
          </span>

          <button
            type="button"
            className="dt-cerrar-menu"
            onClick={() => setMenuAbierto(false)}
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`dt-identidad-rol dt-identidad-${claseRol}`}>
          <span className="dt-identidad-avatar">
            {usuario.nombre.charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>{usuario.nombre}</strong>
            <span>{usuario.nombre_rol}</span>
          </div>
        </div>

        <p className="dt-menu-titulo">MENÚ</p>

        <nav className="dt-nav">
          {enlaces.map((enlace) => (
            <NavLink
              key={enlace.ruta}
              to={enlace.ruta}
              className={({ isActive }) =>
                `dt-nav-enlace ${isActive ? "dt-nav-activo" : ""}`
              }
              onClick={() => setMenuAbierto(false)}
            >
              <enlace.Icono size={17} />
              {enlace.texto}
            </NavLink>
          ))}

          {rolesDisponibles.length > 0 && (
            <div className="dt-nav-roles-disponibles">
              <p>
                <ArrowLeftRight size={12} /> Roles disponibles
              </p>

              {rolesDisponibles.map((rol) => (
                <button
                  key={rol.id_rol}
                  type="button"
                  className={`dt-nav-rol-disponible dt-nav-rol-disponible-${
                    CLASE_ROL[rol.id_rol] ?? "cliente"
                  }`}
                  onClick={() => void entrarConRol(rol.id_rol)}
                  disabled={cambiando}
                  title={`Cambiar al rol ${NOMBRE_ROL[rol.id_rol] ?? rol.nombre_rol}`}
                >
                  <span className="dt-nav-rol-disponible-punto" />
                  {NOMBRE_ROL[rol.id_rol] ?? rol.nombre_rol}
                  <ArrowRight
                    size={13}
                    className="dt-nav-rol-disponible-arrow"
                  />
                </button>
              ))}
              {errorCambioRol && (
                <span className="dt-error-cambio-rol" role="alert">
                  {errorCambioRol}
                </span>
              )}
            </div>
          )}
        </nav>

        <div className="dt-sidebar-pie">
          <div className="dt-seguridad">
            <ShieldCheck size={17} />
            <div>
              <strong>Sesión protegida</strong>
              <span>{MODULOS_POR_ROL[usuario.id_rol]?.length ?? 0} módulos activos</span>
            </div>
          </div>

          <button type="button" className="dt-boton-salir" onClick={salir}>
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="dt-contenido">
        <button
          type="button"
          className="dt-menu-movil"
          onClick={() => setMenuAbierto(true)}
          aria-label="Abrir menú"
        >
          <Menu size={18} />
        </button>

        <BannerRol
          rutaActual={ubicacion.pathname}
          alAbrirCarrito={() => setCarritoAbierto(true)}
        />
        <Outlet />
      </main>

      {carritoAbierto && usuario.id_rol === 2 && (
        <div
          className="dt-modal-fondo dt-carrito-modal-fondo"
          onClick={() => setCarritoAbierto(false)}
        >
          <div
            className="dt-modal dt-modal-carrito"
            role="dialog"
            aria-modal="true"
            aria-label="Mi carrito"
            onClick={(evento) => evento.stopPropagation()}
          >
            <button
              type="button"
              className="dt-boton-cerrar-modal dt-carrito-modal-cerrar"
              onClick={() => setCarritoAbierto(false)}
              aria-label="Cerrar carrito"
            >
              <X size={17} />
            </button>
            <CarritoCliente />
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   RUTAS
========================================================= */

/** Escucha errores HTTP/red (403, 404, 5xx) y lleva a su pantalla con imagen. */
function RutasConManejoErrores() {
  const navegar = useNavigate();
  const ubicacion = useLocation();

  useEffect(() => {
    const manejarError = (evento: Event) => {
      const detalle = (evento as CustomEvent<EventoPaginaError>).detail;
      if (!detalle?.codigo) return;

      const destino = `/error/${detalle.codigo}`;
      if (window.location.pathname === destino) return;

      navegar(destino, {
        replace: true,
        state: {
          origen: detalle.origen,
          mensaje: detalle.mensaje,
        },
      });
    };

    window.addEventListener(EVENTO_ERROR_HTTP, manejarError);
    return () => window.removeEventListener(EVENTO_ERROR_HTTP, manejarError);
  }, [navegar]);

  return (
    <LimiteErrores key={ubicacion.pathname}>
      <Routes>
        {/* ---------- Públicas ---------- */}
        <Route path="/" element={<Portada />} />
        <Route path="/index" element={<Portada />} />
        <Route
          path="/login"
          element={
            <RutaPublica>
              <Login />
            </RutaPublica>
          }
        />
        <Route path="/recuperar-password" element={<RutaPublica><RecuperarPassword /></RutaPublica>} />
        <Route
          path="/registro"
          element={
            <RutaPublica>
              <Registro />
            </RutaPublica>
          }
        />
        <Route path="/seleccionar-rol" element={<RutaSeleccionarRol />} />
        <Route path="/error/403" element={<Error403 />} />
        <Route path="/error/404" element={<Error404 />} />
        <Route path="/error/500" element={<Error500 />} />
        <Route path="/error/general" element={<ErrorGeneral />} />

          {/* ---------- Panel (requiere sesión) ---------- */}
          <Route element={<RutaProtegida />}>
            <Route element={<EstructuraPanel />}>
              {/* Atajos raíz por área */}
              <Route path="/admin" element={<Navigate to="/admin/panel" replace />} />
              <Route path="/vendedor" element={<Navigate to="/vendedor/panel" replace />} />
              <Route path="/bodeguero" element={<Navigate to="/bodeguero/panel" replace />} />
              <Route path="/cliente" element={<Navigate to="/cliente/panel" replace />} />

              {/* Administrador */}
              <Route element={<RutaConModulo modulo="dashboard" />}>
                <Route path="/admin/panel" element={<PanelAdmin />} />
              </Route>
              <Route element={<RutaConModulo modulo="usuarios" />}>
                <Route path="/admin/usuarios" element={<UsuariosAdmin />} />
                <Route path="/admin/usuarios/:id/editar" element={<EditarUsuarioAdmin />} />
              </Route>
              <Route element={<RutaConModulo modulo="roles" />}>
                <Route path="/admin/roles" element={<RolesAdmin />} />
              </Route>
              <Route element={<RutaConModulo modulo="productos" />}>
                <Route path="/admin/productos" element={<ProductosAdmin />} />
              </Route>
              <Route element={<RutaConModulo modulo="promociones" />}>
                <Route path="/admin/promociones" element={<PromocionesAdmin />} />
              </Route>
              <Route element={<RutaConModulo modulo="pedidos" />}>
                <Route path="/admin/pedidos" element={<PedidosAdmin />} />
              </Route>
              <Route element={<RutaConModulo modulo="ventas" />}>
                <Route path="/admin/ventas" element={<VentasAdmin />} />
              </Route>
              <Route element={<RutaConModulo modulo="devoluciones" />}>
                <Route path="/admin/devoluciones" element={<DevolucionesAdmin />} />
              </Route>
              <Route element={<RutaConModulo modulo="inventario" />}>
                <Route path="/admin/inventario" element={<InventarioAdmin />} />
              </Route>
              <Route element={<RutaConModulo modulo="facturacion" />}>
                <Route path="/admin/facturacion" element={<FacturacionAdmin />} />
                <Route path="/admin/facturacion/config" element={<FacturacionConfigAdmin />} />
              </Route>
              <Route element={<RutaConModulo modulo="perfil" />}>
                <Route path="/admin/perfil" element={<PerfilAdmin />} />
              </Route>

              {/* Vendedor */}
              <Route element={<RutaConModulo modulo="dashboard" />}>
                <Route path="/vendedor/panel" element={<PanelVendedor />} />
              </Route>
              <Route element={<RutaConModulo modulo="pedidos" />}>
                <Route path="/vendedor/pedidos" element={<PedidosVendedor />} />
              </Route>
              <Route element={<RutaConModulo modulo="ventas" />}>
                <Route path="/vendedor/ventas" element={<VentasVendedor />} />
                <Route path="/vendedor/reportes" element={<ReportesVendedor />} />
              </Route>
              <Route element={<RutaConModulo modulo="devoluciones" />}>
                <Route path="/vendedor/devoluciones" element={<DevolucionesVendedor />} />
              </Route>
              <Route element={<RutaConModulo modulo="perfil" />}>
                <Route path="/vendedor/perfil" element={<PerfilVendedor />} />
              </Route>

              {/* Bodeguero */}
              <Route element={<RutaConModulo modulo="dashboard" />}>
                <Route path="/bodeguero/panel" element={<PanelBodeguero />} />
              </Route>
              <Route element={<RutaConModulo modulo="inventario" />}>
                <Route path="/bodeguero/inventario" element={<InventarioBodeguero />} />
              </Route>
              <Route element={<RutaConModulo modulo="alertas" />}>
                <Route path="/bodeguero/alertas" element={<AlertasBodeguero />} />
              </Route>
              <Route element={<RutaConModulo modulo="perfil" />}>
                <Route path="/bodeguero/perfil" element={<PerfilBodeguero />} />
              </Route>

              {/* Cliente */}
              <Route element={<RutaConModulo modulo="dashboard" />}>
                <Route path="/cliente/panel" element={<PanelCliente />} />
              </Route>
              <Route element={<RutaConModulo modulo="catalogo" />}>
                <Route path="/cliente/productos" element={<ProductosCliente />} />
              </Route>
              <Route element={<RutaConModulo modulo="carrito" />}>
                <Route
                  path="/cliente/carrito"
                  element={<Navigate to="/cliente/panel" replace state={{ abrirCarrito: true }} />}
                />
              </Route>
              <Route element={<RutaConModulo modulo="mis-pedidos" />}>
                <Route path="/cliente/pedidos" element={<PedidosCliente />} />
              </Route>
              <Route element={<RutaConModulo modulo="devoluciones" />}>
                <Route path="/cliente/devoluciones" element={<DevolucionesCliente />} />
              </Route>
              <Route element={<RutaConModulo modulo="perfil" />}>
                <Route path="/cliente/perfil" element={<PerfilCliente />} />
              </Route>
            </Route>

            {/* Cualquier otra subruta de un rol exige sesión primero */}
            <Route path="/admin/*" element={<SubrutaAreaNoEncontrada rolEsperado={1} />} />
            <Route path="/cliente/*" element={<SubrutaAreaNoEncontrada rolEsperado={2} />} />
            <Route path="/vendedor/*" element={<SubrutaAreaNoEncontrada rolEsperado={3} />} />
            <Route path="/bodeguero/*" element={<SubrutaAreaNoEncontrada rolEsperado={4} />} />
          </Route>

          {/* ---------- Sin ruta ---------- */}
          <Route path="*" element={<Error404 />} />
      </Routes>
    </LimiteErrores>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ProveedorSesion>
        <RutasConManejoErrores />
      </ProveedorSesion>
    </BrowserRouter>
  );
}