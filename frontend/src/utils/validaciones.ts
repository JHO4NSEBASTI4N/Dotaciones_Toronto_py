const CARACTERES_ESPECIALES_PASSWORD = new Set("!@#$%^&*()_+-=[]{};':\"\\|,.<>/?~`");

/** Acepta nombres reales con tildes y separadores habituales (O'Neil, Ana-María). */
export function validarNombrePersona(valor: string, maximo = 255): string | null {
  const limpio = valor.trim().replace(/\s+/g, " ");
  if (limpio.length < 2) return "Escribe un nombre de al menos 2 caracteres.";
  if (limpio.length > maximo) return `El nombre no puede superar ${maximo} caracteres.`;
  if (!/[\p{L}]/u.test(limpio) || /[^\p{L}\p{M} '\u2019.-]/u.test(limpio)) {
    return "Usa letras, espacios, apóstrofe, guion o punto; no incluyas números.";
  }
  return null;
}

/** Documento personal capturado por el sistema: dígitos, 6 a 12 caracteres. */
export function validarCorreo(valor: string): string | null {
  const correo = valor.trim();
  if (!correo) return "El correo es obligatorio.";
  if (correo.length > 254) return "El correo no puede superar 254 caracteres.";
  if (!/^[^\s@]+@(?:[^\s@.]+\.)+[^\s@.]+$/.test(correo)) {
    return "Escribe un correo electrónico válido.";
  }
  return null;
}

export function validarDocumento(valor: string): string | null {
  const limpio = valor.trim();
  if (!limpio) return null;
  if (!/^\d{6,12}$/.test(limpio)) return "El documento debe tener entre 6 y 12 dígitos.";
  return null;
}

/**
 * Acepta números nacionales o internacionales con presentación habitual.
 * Comprueba sintaxis y longitud, no que el número esté asignado o activo.
 */
export function validarTelefono(valor: string): string | null {
  const limpio = valor.trim();
  if (!limpio) return null;
  if (limpio.length > 32) return "El teléfono no puede superar 32 caracteres.";
  if (!/^[0-9+(). -]+$/.test(limpio)) {
    return "Usa números, + inicial, espacios, paréntesis, guiones o puntos.";
  }
  if (limpio.includes("+") && (!limpio.startsWith("+") || limpio.indexOf("+") !== limpio.lastIndexOf("+"))) {
    return "El signo + solo se permite una vez y al inicio, como prefijo internacional.";
  }
  let dentroDeParentesis = false;
  let digitosEnParentesis = 0;
  for (const caracter of limpio) {
    if (caracter === "(") {
      if (dentroDeParentesis) return "Revisa los paréntesis del teléfono.";
      dentroDeParentesis = true;
      digitosEnParentesis = 0;
    } else if (caracter === ")") {
      if (!dentroDeParentesis || digitosEnParentesis === 0) return "Revisa los paréntesis del teléfono.";
      dentroDeParentesis = false;
    } else if (dentroDeParentesis && /[0-9]/.test(caracter)) {
      digitosEnParentesis += 1;
    }
  }
  if (dentroDeParentesis) return "Cierra los paréntesis del teléfono.";
  const cantidadDigitos = limpio.replace(/[^0-9]/g, "").length;
  if (cantidadDigitos < 7 || cantidadDigitos > 15) {
    return "El teléfono debe contener entre 7 y 15 dígitos; el formato internacional admite hasta 15.";
  }
  if (/^\+0/.test(limpio)) return "Después de + escribe un código de país que empiece por un dígito distinto de 0.";
  return null;
}

export function validarDireccion(valor: string, maximo = 255): string | null {
  if (valor.trim().length > maximo) return `La dirección no puede superar ${maximo} caracteres.`;
  return null;
}

/** Política aplicada en registro, cambio, recuperación y restablecimiento. */
export function validarPasswordSegura(valor: string): string | null {
  if (valor.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (new TextEncoder().encode(valor).length > 72) return "La contraseña no puede superar 72 bytes.";
  if (!/[\p{L}]/u.test(valor)) return "La contraseña debe incluir una letra.";
  if (!/\d/.test(valor)) return "La contraseña debe incluir un número.";
  if (![...valor].some((caracter) => CARACTERES_ESPECIALES_PASSWORD.has(caracter))) {
    return "La contraseña debe incluir un carácter especial (por ejemplo, ! o #).";
  }
  return null;
}

export function validarTextoObligatorio(
  valor: string,
  etiqueta: string,
  minimo: number,
  maximo: number
): string | null {
  const limpio = valor.trim();
  if (limpio.length < minimo) return `${etiqueta} debe tener al menos ${minimo} caracteres.`;
  if (limpio.length > maximo) return `${etiqueta} no puede superar ${maximo} caracteres.`;
  return null;
}

export function validarMontoPositivo(valor: string, etiqueta = "El valor"): string | null {
  const monto = Number(valor);
  if (!valor.trim() || !Number.isFinite(monto) || monto <= 0) {
    return `${etiqueta} debe ser un número mayor que cero.`;
  }
  return null;
}
