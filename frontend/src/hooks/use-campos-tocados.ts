import { useCallback, useState } from "react";

/** Registra qué campos han recibido interacción para no mostrar errores al abrir un formulario. */
export function useCamposTocados() {
  const [campos, setCampos] = useState<Record<string, boolean>>({});

  const tocar = useCallback((campo: string) => {
    setCampos((actuales) => ({ ...actuales, [campo]: true }));
  }, []);

  const tocarVarios = useCallback((nombres: string[]) => {
    setCampos((actuales) => ({
      ...actuales,
      ...Object.fromEntries(nombres.map((nombre) => [nombre, true])),
    }));
  }, []);

  const mostrar = useCallback((campo: string) => Boolean(campos[campo]), [campos]);
  const reiniciar = useCallback(() => setCampos({}), []);

  return { tocar, tocarVarios, mostrar, reiniciar };
}
