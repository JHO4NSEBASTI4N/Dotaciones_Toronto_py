export interface LineaFacturaImprimible {
  nombre: string | null | undefined;
  idProducto: number | null | undefined;
  cantidad: number;
  precioLista: string | number;
  descuentoUnitario: string | number;
  precioUnitario: string | number;
  subtotal: string | number;
}

export interface DatosFacturaImprimible {
  logoUrl: string;
  titulo: string;
  fecha: string;
  estado: string;
  cliente: string;
  correo: string;
  idPedido: number | null | undefined;
  unidades: number;
  subtotalLista: string | number;
  descuentoTotal: string | number;
  total: string | number;
  lineas: LineaFacturaImprimible[];
}

const escaparHtml = (valor: unknown): string =>
  String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const pesos = (valor: string | number): string =>
  (Number(valor) || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

/** Construye una única plantilla de factura para pedido de cliente y venta administrativa. */
export function crearHtmlFacturaImprimible(datos: DatosFacturaImprimible): string {
  const lineas = datos.lineas.length
    ? datos.lineas
        .map(
          (linea) => `
      <tr>
        <td>${escaparHtml(linea.nombre || `Producto #${linea.idProducto ?? "—"}`)}</td>
        <td class="numero">${escaparHtml(linea.cantidad)}</td>
        <td class="numero">${escaparHtml(pesos(linea.precioLista))}</td>
        <td class="numero">${escaparHtml(pesos(linea.descuentoUnitario))}</td>
        <td class="numero">${escaparHtml(pesos(linea.precioUnitario))}</td>
        <td class="numero">${escaparHtml(pesos(linea.subtotal))}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="6">No se encontraron productos en el detalle de este pedido.</td></tr>`;
  const pedido = datos.idPedido ? `#${datos.idPedido}` : "—";

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escaparHtml(datos.titulo)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 36px; }
    .cabecera { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
    .empresa p, .meta p { margin: 2px 0; font-size: 13px; color: #475569; }
    .meta { text-align: right; }
    .meta h2 { margin: 0 0 4px; font-size: 18px; color: #0f172a; }
    .caja { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 18px; }
    .caja h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; color: #64748b; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; }
    th { background: #f8fafc; color: #475569; font-weight: 600; }
    .numero { text-align: right; }
    .totales { margin-top: 18px; margin-left: auto; width: 280px; font-size: 14px; }
    .totales div { display: flex; justify-content: space-between; padding: 5px 0; }
    .totales .total { border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 8px; font-size: 16px; font-weight: 700; }
    .pie { margin-top: 28px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print { body { margin: 18px; } }
  </style>
</head>
<body>
  <div class="cabecera">
    <div class="empresa" style="display:flex;align-items:center;gap:12px;">
      <img src="${escaparHtml(datos.logoUrl)}" alt="Dotaciones Toronto" style="width:48px;height:48px;object-fit:contain;border-radius:8px;flex-shrink:0;" />
      <div>
        <h1 style="margin:0 0 2px;font-size:20px;">DOTACIONES TORONTO S.A.S.</h1>
        <p style="margin:2px 0;font-size:12.5px;color:#475569;">NIT: 900123456-8 · Régimen Común</p>
        <p style="margin:2px 0;font-size:12.5px;color:#475569;">Dotaciones Empresariales e Industriales · Bogotá D.C.</p>
      </div>
    </div>
    <div class="meta">
      <h2>${escaparHtml(datos.titulo)}</h2>
      <p>Fecha: ${escaparHtml(datos.fecha)}</p>
      <p>Estado: <strong>${escaparHtml(datos.estado)}</strong></p>
    </div>
  </div>

  <div class="caja">
    <h3>Datos del Cliente</h3>
    <div class="grid">
      <div><strong>Cliente:</strong> ${escaparHtml(datos.cliente || "Cliente")}</div>
      <div><strong>Correo:</strong> ${escaparHtml(datos.correo || "—")}</div>
      <div><strong>Pedido:</strong> ${escaparHtml(pedido)}</div>
      <div><strong>Unidades totales:</strong> ${escaparHtml(datos.unidades)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th class="numero">Cantidad</th>
        <th class="numero">Precio lista</th>
        <th class="numero">Descuento</th>
        <th class="numero">Precio final</th>
        <th class="numero">Subtotal</th>
      </tr>
    </thead>
    <tbody>${lineas}
    </tbody>
  </table>

  <div class="totales">
    <div><span>Subtotal lista</span><span>${escaparHtml(pesos(datos.subtotalLista))}</span></div>
    <div><span>Descuentos</span><span>−${escaparHtml(pesos(datos.descuentoTotal))}</span></div>
    <div class="total"><span>Total del pedido</span><span>${escaparHtml(pesos(datos.total))}</span></div>
  </div>

  <div class="pie"><p>Gracias por su compra · Dotaciones Toronto S.A.S.</p></div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}

export function abrirFacturaImprimible(datos: DatosFacturaImprimible): void {
  const ventana = window.open("", "_blank", "width=960,height=900");
  if (!ventana) return;
  ventana.document.open();
  ventana.document.write(crearHtmlFacturaImprimible(datos));
  ventana.document.close();
}
