// Conserva temporalmente la selección anónima hecha en la portada y la
// transfiere al carrito del cliente después de iniciar sesión.

import { carrito as apiCarrito } from "./api";

export const CLAVE_CARRITO_PORTADA = "carrito_portada";

interface ItemCarritoPortadaGuardado {
  producto?: { id_producto?: number; nombre?: string };
  cantidad?: number;
}

function leerCarritoPortada(): ItemCarritoPortadaGuardado[] {
  try {
    const guardado = localStorage.getItem(CLAVE_CARRITO_PORTADA);
    if (!guardado) return [];

    const datos: unknown = JSON.parse(guardado);
    return Array.isArray(datos) ? (datos as ItemCarritoPortadaGuardado[]) : [];
  } catch {
    return [];
  }
}

/** Indica si existe una selección de la portada pendiente por importar. */
export function hayCarritoPortadaPendiente(): boolean {
  return leerCarritoPortada().length > 0;
}

/**
 * Agrega la selección anónima al carrito asociado al token del cliente.
 * Cada elemento se retira del almacenamiento local solo después de que el
 * backend lo acepta; si hay un fallo, el elemento y los siguientes quedan
 * guardados para poder reintentar sin duplicar los ya transferidos.
 */
let migracionEnCurso: Promise<number> | null = null;

export function migrarCarritoPortada(): Promise<number> {
  // React StrictMode ejecuta dos veces los efectos en desarrollo. Compartir
  // la misma promesa evita enviar dos veces el mismo producto al backend.
  if (migracionEnCurso) return migracionEnCurso;

  migracionEnCurso = ejecutarMigracion().finally(() => {
    migracionEnCurso = null;
  });
  return migracionEnCurso;
}

async function ejecutarMigracion(): Promise<number> {
  const pendientes = leerCarritoPortada();
  let transferidos = 0;

  while (pendientes.length > 0) {
    const item = pendientes[0];
    const idProducto = Number(item?.producto?.id_producto);
    const cantidad = Number(item?.cantidad);

    if (!Number.isInteger(idProducto) || idProducto <= 0 || !Number.isInteger(cantidad) || cantidad <= 0) {
      const nombre = item?.producto?.nombre ?? "un producto";
      throw new Error(`No se pudo transferir ${nombre}: la selección guardada no es válida.`);
    }

    try {
      await apiCarrito.agregar(idProducto, cantidad);
    } catch (fallo) {
      const detalle = fallo instanceof Error ? fallo.message : "revisa el stock y vuelve a intentarlo";
      const nombre = item?.producto?.nombre ?? "el producto seleccionado";
      throw new Error(`No se pudo agregar ${nombre} a tu carrito: ${detalle}`);
    }

    pendientes.shift();
    if (pendientes.length > 0) {
      localStorage.setItem(CLAVE_CARRITO_PORTADA, JSON.stringify(pendientes));
    } else {
      localStorage.removeItem(CLAVE_CARRITO_PORTADA);
    }
    transferidos += 1;
  }

  return transferidos;
}
