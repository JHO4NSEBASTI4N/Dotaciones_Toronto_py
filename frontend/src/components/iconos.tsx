// src/components/iconos.tsx
//
// Iconos del sistema: son SVG dentro del propio proyecto.
// No hacen falta librerías externas ni conexión a internet, y el ícono se
// pinta del color del texto (usa `currentColor`), así que hereda el color
// de cada botón o etiqueta.
//
// Uso:  <Package size={18} />   o   <Truck size={14} className="algo" />

import type { CSSProperties, ReactNode } from "react";

export interface PropsIcono {
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
  /** Texto alternativo; si se omite el ícono se considera decorativo. */
  title?: string;
}

/** Envoltura común: mismo viewBox y mismos trazos para todos los íconos. */
function Icono({
  size = 24,
  className,
  style,
  strokeWidth = 2,
  title,
  children,
}: PropsIcono & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export function AlertTriangle(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /> <path d="M12 9v4" /> <path d="M12 17h.01" />
    </Icono>
  );
}

export function ArrowDownToLine(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M12 17V3" /> <path d="m6 11 6 6 6-6" /> <path d="M19 21H5" />
    </Icono>
  );
}

export function ArrowLeftRight(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M8 3 4 7l4 4" /> <path d="M4 7h16" /> <path d="m16 21 4-4-4-4" /> <path d="M20 17H4" />
    </Icono>
  );
}

export function ArrowRight(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M5 12h14" /> <path d="m12 5 7 7-7 7" />
    </Icono>
  );
}

export function ArrowUpFromLine(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="m18 9-6-6-6 6" /> <path d="M12 3v14" /> <path d="M5 21h14" />
    </Icono>
  );
}

export function BadgeCheck(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /> <path d="m16 9-5.5 5.5L8 12" />
    </Icono>
  );
}

export function Ban(props: PropsIcono) {
  return (
    <Icono {...props}>
      <circle cx="12" cy="12" r="10" /> <path d="M4.929 4.929 19.07 19.071" />
    </Icono>
  );
}

export function Bell(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M10.268 21a2 2 0 0 0 3.464 0" /> <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </Icono>
  );
}

export function BellRing(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M10.268 21a2 2 0 0 0 3.464 0" /> <path d="M22 8c0-2.3-.8-4.3-2-6" /> <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" /> <path d="M4 2C2.8 3.7 2 5.7 2 8" />
    </Icono>
  );
}

export function Boxes(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z" /> <path d="m7 16.5-4.74-2.85" /> <path d="m7 16.5 5-3" /> <path d="M7 16.5v5.17" /> <path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z" /> <path d="m17 16.5-5-3" /> <path d="m17 16.5 4.74-2.85" /> <path d="M17 16.5v5.17" /> <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z" /> <path d="M12 8 7.26 5.15" /> <path d="m12 8 4.74-2.85" /> <path d="M12 13.5V8" />
    </Icono>
  );
}

export function Check(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Icono>
  );
}

export function CheckCircle2(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M21.801 10A10 10 0 1 1 17 3.335" /> <path d="m9 11 3 3L22 4" />
    </Icono>
  );
}

export function ClipboardCheck(props: PropsIcono) {
  return (
    <Icono {...props}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /> <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /> <path d="m9 14 2 2 4-4" />
    </Icono>
  );
}

export function ClipboardList(props: PropsIcono) {
  return (
    <Icono {...props}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /> <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /> <path d="M12 11h4" /> <path d="M12 16h4" /> <path d="M8 11h.01" /> <path d="M8 16h.01" />
    </Icono>
  );
}

export function Clock(props: PropsIcono) {
  return (
    <Icono {...props}>
      <circle cx="12" cy="12" r="10" /> <path d="M12 6v6l4 2" />
    </Icono>
  );
}

export function CreditCard(props: PropsIcono) {
  return (
    <Icono {...props}>
      <rect width="20" height="14" x="2" y="5" rx="2" /> <line x1="2" x2="22" y1="10" y2="10" /> <path d="M6 14h2" />
    </Icono>
  );
}

export function ExternalLink(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M15 3h6v6" /> <path d="M10 14 21 3" /> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </Icono>
  );
}

export function Eye(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /> <circle cx="12" cy="12" r="3" />
    </Icono>
  );
}

export function EyeOff(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /> <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /> <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /> <path d="m2 2 20 20" />
    </Icono>
  );
}

export function FileText(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /> <path d="M14 2v5a1 1 0 0 0 1 1h5" /> <path d="M10 9H8" /> <path d="M16 13H8" /> <path d="M16 17H8" />
    </Icono>
  );
}

export function KeyRound(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" /> <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
    </Icono>
  );
}

export function LayoutDashboard(props: PropsIcono) {
  return (
    <Icono {...props}>
      <rect width="7" height="9" x="3" y="3" rx="1" /> <rect width="7" height="5" x="14" y="3" rx="1" /> <rect width="7" height="9" x="14" y="12" rx="1" /> <rect width="7" height="5" x="3" y="16" rx="1" />
    </Icono>
  );
}

export function Lock(props: PropsIcono) {
  return (
    <Icono {...props}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /> <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icono>
  );
}

export function LogOut(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="m16 17 5-5-5-5" /> <path d="M21 12H9" /> <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </Icono>
  );
}

export function Mail(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /> <rect x="2" y="4" width="20" height="16" rx="2" />
    </Icono>
  );
}

export function MapPin(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /> <circle cx="12" cy="10" r="3" />
    </Icono>
  );
}

export function Menu(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M4 5h16" /> <path d="M4 12h16" /> <path d="M4 19h16" />
    </Icono>
  );
}

export function MessageSquare(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
    </Icono>
  );
}

export function Minus(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M5 12h14" />
    </Icono>
  );
}

export function Package(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" /> <path d="M12 22V12" /> <polyline points="3.29 7 12 12 20.71 7" /> <path d="m7.5 4.27 9 5.15" />
    </Icono>
  );
}

export function PackageCheck(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M12 22V12" /> <path d="m16 17 2 2 4-4" /> <path d="M21 11.127V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.729l7 4a2 2 0 0 0 2 .001l1.32-.753" /> <path d="M3.29 7 12 12l8.71-5" /> <path d="m7.5 4.27 8.997 5.148" />
    </Icono>
  );
}

export function PackageMinus(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M12 22V12" /> <path d="M16 17h6" /> <path d="M21 13V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.729l7 4a2 2 0 0 0 2 .001l1.675-.955" /> <path d="M3.29 7 12 12l8.71-5" /> <path d="m7.5 4.27 8.997 5.148" />
    </Icono>
  );
}

export function PackagePlus(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M12 22V12" /> <path d="M16 17h6" /> <path d="M19 14v6" /> <path d="M21 10.535V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.729l7 4a2 2 0 0 0 2 .001l1.675-.955" /> <path d="M3.29 7 12 12l8.71-5" /> <path d="m7.5 4.27 8.997 5.148" />
    </Icono>
  );
}

export function Pencil(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /> <path d="m15 5 4 4" />
    </Icono>
  );
}

export function Phone(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
    </Icono>
  );
}

export function Plus(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M5 12h14" /> <path d="M12 5v14" />
    </Icono>
  );
}

export function Receipt(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M12 17V7" /> <path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8" /> <path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" />
    </Icono>
  );
}

export function RefreshCw(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /> <path d="M21 3v5h-5" /> <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /> <path d="M8 16H3v5" />
    </Icono>
  );
}

export function RotateCcw(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> <path d="M3 3v5h5" />
    </Icono>
  );
}

export function Save(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /> <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /> <path d="M7 3v4a1 1 0 0 0 1 1h7" />
    </Icono>
  );
}

export function Search(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="m21 21-4.34-4.34" /> <circle cx="11" cy="11" r="8" />
    </Icono>
  );
}

export function ShieldCheck(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /> <path d="m9 12 2 2 4-4" />
    </Icono>
  );
}

export function ShieldHalf(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /> <path d="M12 22V2" />
    </Icono>
  );
}

export function Shirt(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
    </Icono>
  );
}

export function ShoppingBag(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M16 10a4 4 0 0 1-8 0" /> <path d="M3.103 6.034h17.794" /> <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />
    </Icono>
  );
}

export function ShoppingCart(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="m2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18" /> <path d="M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25" /> <circle cx="18" cy="20" r="2" /> <circle cx="8" cy="20" r="2" />
    </Icono>
  );
}

export function SlidersHorizontal(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M10 5H3" /> <path d="M12 19H3" /> <path d="M14 3v4" /> <path d="M16 17v4" /> <path d="M21 12h-9" /> <path d="M21 19h-5" /> <path d="M21 5h-7" /> <path d="M8 10v4" /> <path d="M8 12H3" />
    </Icono>
  );
}

export function Store(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5" /> <path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244" /> <path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05" />
    </Icono>
  );
}

export function Tag(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /> <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </Icono>
  );
}

export function ToggleLeft(props: PropsIcono) {
  return (
    <Icono {...props}>
      <circle cx="9" cy="12" r="3" /> <rect width="20" height="14" x="2" y="5" rx="7" />
    </Icono>
  );
}

export function ToggleRight(props: PropsIcono) {
  return (
    <Icono {...props}>
      <circle cx="15" cy="12" r="3" /> <rect width="20" height="14" x="2" y="5" rx="7" />
    </Icono>
  );
}

export function Trash2(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M10 11v6" /> <path d="M14 11v6" /> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /> <path d="M3 6h18" /> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Icono>
  );
}

export function TrendingUp(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M16 7h6v6" /> <path d="m22 7-8.5 8.5-5-5L2 17" />
    </Icono>
  );
}

export function TriangleAlert(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /> <path d="M12 9v4" /> <path d="M12 17h.01" />
    </Icono>
  );
}

export function Truck(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /> <path d="M15 18H9" /> <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /> <circle cx="17" cy="18" r="2" /> <circle cx="7" cy="18" r="2" />
    </Icono>
  );
}

export function UserCheck(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="m16 11 2 2 4-4" /> <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /> <circle cx="9" cy="7" r="4" />
    </Icono>
  );
}

export function UserMinus(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /> <circle cx="9" cy="7" r="4" /> <line x1="22" x2="16" y1="11" y2="11" />
    </Icono>
  );
}

export function UserRound(props: PropsIcono) {
  return (
    <Icono {...props}>
      <circle cx="12" cy="8" r="5" /> <path d="M20 21a8 8 0 0 0-16 0" />
    </Icono>
  );
}

export function Users(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /> <path d="M16 3.128a4 4 0 0 1 0 7.744" /> <path d="M22 21v-2a4 4 0 0 0-3-3.87" /> <circle cx="9" cy="7" r="4" />
    </Icono>
  );
}

export function X(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M18 6 6 18" /> <path d="m6 6 12 12" />
    </Icono>
  );
}

export function ArrowLeft(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="m12 19-7-7 7-7" /> <path d="M19 12H5" />
    </Icono>
  );
}

export function Send(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /> <path d="m21.854 2.147-10.94 10.939" />
    </Icono>
  );
}
