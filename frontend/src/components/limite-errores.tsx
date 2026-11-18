// src/components/limite-errores.tsx
//
// Captura cualquier fallo inesperado durante el renderizado de React y muestra
// la pantalla de error con su ilustración en lugar de dejar la página en blanco.

import { Component, type ErrorInfo, type ReactNode } from "react";
import ErrorGeneral from "../pages/error/general";

interface PropsLimiteErrores {
  children: ReactNode;
}

interface EstadoLimiteErrores {
  hayError: boolean;
}

export class LimiteErrores extends Component<
  PropsLimiteErrores,
  EstadoLimiteErrores
> {
  override state: EstadoLimiteErrores = { hayError: false };

  static getDerivedStateFromError(): EstadoLimiteErrores {
    return { hayError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Error inesperado en la interfaz:", error, info.componentStack);
  }

  private restablecer = (): void => {
    this.setState({ hayError: false });
  };

  override render(): ReactNode {
    if (this.state.hayError) {
      return <ErrorGeneral onReintentar={this.restablecer} />;
    }
    return this.props.children;
  }
}
