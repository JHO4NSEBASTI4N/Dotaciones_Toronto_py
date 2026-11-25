interface FeedbackValidacionProps {
  id: string;
  error: string | null | undefined;
  mostrar: boolean;
  valido?: string;
}

/** Mensaje de campo que se actualiza conforme cambia el valor introducido. */
export function FeedbackValidacion({ id, error, mostrar, valido = "Formato válido." }: FeedbackValidacionProps) {
  return (
    <small
      id={id}
      aria-live="polite"
      aria-atomic="true"
      className={error ? "dt-validacion-error" : "dt-validacion-correcta"}
      style={{
        display: mostrar ? "block" : "none",
        marginTop: 4,
        fontSize: "0.78rem",
        color: error ? "#b42318" : "#16805b",
      }}
    >
      {mostrar ? error ?? valido : ""}
    </small>
  );
}
