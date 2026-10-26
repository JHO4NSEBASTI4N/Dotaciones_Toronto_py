-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 26-10-2026 a las 23:54:35
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `dotacionestoronto`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `alerta_stock`
--

CREATE TABLE `alerta_stock` (
  `id_alerta` int(11) NOT NULL,
  `id_producto_fk` bigint(20) DEFAULT NULL,
  `nivel_stock` int(11) DEFAULT NULL,
  `fecha_alerta` date DEFAULT NULL,
  `atendida` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `carrito`
--

CREATE TABLE `carrito` (
  `id_carrito` int(11) NOT NULL,
  `id_usuario_fk` bigint(20) DEFAULT NULL,
  `fecha_creacion` date DEFAULT NULL,
  `inhabilitado` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `descuento`
--

CREATE TABLE `descuento` (
  `id_descuento` int(11) NOT NULL,
  `id_producto_fk` bigint(20) DEFAULT NULL,
  `tipo_descuento` varchar(50) DEFAULT NULL,
  `valor_descuento` decimal(10,2) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `detalle_carrito`
--

CREATE TABLE `detalle_carrito` (
  `id_detalle_carrito` bigint(20) NOT NULL,
  `id_carrito_fk` int(11) DEFAULT NULL,
  `id_producto_fk` bigint(20) DEFAULT NULL,
  `cantidad` int(11) DEFAULT NULL,
  `inhabilitado` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `detalle_pedido`
--

CREATE TABLE `detalle_pedido` (
  `id_detalle_pedido` bigint(20) NOT NULL,
  `id_pedido_fk` bigint(20) DEFAULT NULL,
  `id_producto_fk` bigint(20) DEFAULT NULL,
  `precio_unitario` decimal(38,2) DEFAULT NULL,
  `cantidad` int(11) DEFAULT NULL,
  `inhabilitado` tinyint(1) NOT NULL DEFAULT 0,
  `precio_lista` decimal(38,2) DEFAULT NULL,
  `descuento_unitario` decimal(38,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `detalle_pedido`
--

INSERT INTO `detalle_pedido` (`id_detalle_pedido`, `id_pedido_fk`, `id_producto_fk`, `precio_unitario`, `cantidad`, `inhabilitado`, `precio_lista`, `descuento_unitario`) VALUES
(6, 6, 11, 45000.00, 5, 0, NULL, 0.00),
(7, 7, 12, 30000.00, 4, 0, NULL, 0.00),
(8, 8, 12, 30000.00, 4, 0, NULL, 0.00),
(9, 9, 12, 30000.00, 1, 0, NULL, 0.00),
(10, 9, 11, 45000.00, 1, 0, NULL, 0.00),
(11, 9, 10, 30000.00, 1, 0, NULL, 0.00),
(12, 9, 9, 5000.00, 1, 0, NULL, 0.00);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `detalle_venta`
--

CREATE TABLE `detalle_venta` (
  `id_detalle_venta` bigint(20) NOT NULL,
  `id_venta_fk` bigint(20) DEFAULT NULL,
  `id_producto_fk` bigint(20) DEFAULT NULL,
  `cantidad` int(11) DEFAULT NULL,
  `precio_unitario` decimal(38,2) DEFAULT NULL,
  `inhabilitado` tinyint(1) NOT NULL DEFAULT 0,
  `precio_lista` decimal(38,2) DEFAULT NULL,
  `descuento_unitario` decimal(38,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `detalle_venta`
--

INSERT INTO `detalle_venta` (`id_detalle_venta`, `id_venta_fk`, `id_producto_fk`, `cantidad`, `precio_unitario`, `inhabilitado`, `precio_lista`, `descuento_unitario`) VALUES
(1, 1, 12, 4, 30000.00, 0, NULL, 0.00),
(2, 2, 12, 1, 30000.00, 0, NULL, 0.00),
(3, 2, 11, 1, 45000.00, 0, NULL, 0.00),
(4, 2, 10, 1, 30000.00, 0, NULL, 0.00),
(5, 2, 9, 1, 5000.00, 0, NULL, 0.00);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `devolucion`
--

CREATE TABLE `devolucion` (
  `id_devolucion` bigint(20) NOT NULL,
  `id_detalle_venta_fk` bigint(20) DEFAULT NULL,
  `cantidad` int(11) DEFAULT NULL,
  `motivo` varchar(255) DEFAULT NULL,
  `fecha_devolucion` date DEFAULT NULL,
  `estado` varchar(255) DEFAULT 'Pendiente'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `devolucion`
--

INSERT INTO `devolucion` (`id_devolucion`, `id_detalle_venta_fk`, `cantidad`, `motivo`, `fecha_devolucion`, `estado`) VALUES
(1, 1, 1, 'Talla incorrecta: me lo probe y no me quedo', '2026-09-15', 'Aprobada');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `factura`
--

CREATE TABLE `factura` (
  `id_factura` int(11) NOT NULL,
  `id_venta_fk` bigint(20) DEFAULT NULL,
  `total_factura` decimal(10,2) DEFAULT NULL,
  `fecha_factura` datetime DEFAULT NULL,
  `estado` varchar(50) NOT NULL DEFAULT 'Vigente'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `factura_electronica`
--

CREATE TABLE `factura_electronica` (
  `id_factura` bigint(20) NOT NULL,
  `id_venta_fk` bigint(20) DEFAULT NULL,
  `id_pedido_fk` bigint(20) DEFAULT NULL,
  `id_cliente_fk` bigint(20) DEFAULT NULL,
  `tipo_documento` varchar(4) DEFAULT '01',
  `numero_factura` varchar(60) NOT NULL,
  `prefijo` varchar(10) DEFAULT NULL,
  `consecutivo` bigint(20) DEFAULT NULL,
  `fecha_emision` datetime DEFAULT NULL,
  `estado` varchar(20) DEFAULT 'BORRADOR',
  `cufe` varchar(128) DEFAULT NULL,
  `cadena_cufe` text DEFAULT NULL,
  `valor_bruto` decimal(19,2) DEFAULT 0.00,
  `descuento_total` decimal(19,2) DEFAULT 0.00,
  `total_iva` decimal(19,2) DEFAULT 0.00,
  `total_impuestos` decimal(19,2) DEFAULT 0.00,
  `total_factura` decimal(19,2) DEFAULT 0.00,
  `moneda` varchar(3) DEFAULT 'COP',
  `forma_pago` varchar(4) DEFAULT '1',
  `medio_pago` varchar(4) DEFAULT '10',
  `nit_emisor` varchar(20) DEFAULT NULL,
  `dv_emisor` varchar(2) DEFAULT NULL,
  `razon_social_emisor` varchar(200) DEFAULT NULL,
  `nombre_comercial_emisor` varchar(200) DEFAULT NULL,
  `direccion_emisor` varchar(200) DEFAULT NULL,
  `ciudad_emisor` varchar(100) DEFAULT NULL,
  `departamento_emisor` varchar(100) DEFAULT NULL,
  `telefono_emisor` varchar(40) DEFAULT NULL,
  `correo_emisor` varchar(150) DEFAULT NULL,
  `regimen_emisor` varchar(6) DEFAULT NULL,
  `responsabilidades_emisor` varchar(100) DEFAULT NULL,
  `actividad_economica_emisor` varchar(10) DEFAULT NULL,
  `tipo_doc_adquirente` varchar(4) DEFAULT '13',
  `nit_adquirente` varchar(30) DEFAULT NULL,
  `dv_adquirente` varchar(2) DEFAULT NULL,
  `razon_social_adquirente` varchar(200) DEFAULT NULL,
  `correo_adquirente` varchar(150) DEFAULT NULL,
  `direccion_adquirente` varchar(200) DEFAULT NULL,
  `telefono_adquirente` varchar(40) DEFAULT NULL,
  `ciudad_adquirente` varchar(100) DEFAULT NULL,
  `clave_tecnica` varchar(128) DEFAULT NULL,
  `resolucion_numero` varchar(40) DEFAULT NULL,
  `resolucion_desde` bigint(20) DEFAULT NULL,
  `resolucion_hasta` bigint(20) DEFAULT NULL,
  `resolucion_vigencia_desde` date DEFAULT NULL,
  `resolucion_vigencia_hasta` date DEFAULT NULL,
  `software_id` varchar(100) DEFAULT NULL,
  `software_security_code` varchar(128) DEFAULT NULL,
  `ambiente` varchar(2) DEFAULT '2',
  `qr_url` text DEFAULT NULL,
  `xml` longtext DEFAULT NULL,
  `firmado` tinyint(1) DEFAULT 0,
  `estado_dian` varchar(40) DEFAULT NULL,
  `mensaje_dian` text DEFAULT NULL,
  `track_id` varchar(100) DEFAULT NULL,
  `fecha_envio` datetime DEFAULT NULL,
  `fecha_respuesta` datetime DEFAULT NULL,
  `intentos` int(11) DEFAULT 0,
  `ultimo_error` text DEFAULT NULL,
  `simulado` tinyint(1) DEFAULT 0,
  `creado_en` datetime DEFAULT NULL,
  `actualizado_en` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `factura_electronica`
--

INSERT INTO `factura_electronica` (`id_factura`, `id_venta_fk`, `id_pedido_fk`, `id_cliente_fk`, `tipo_documento`, `numero_factura`, `prefijo`, `consecutivo`, `fecha_emision`, `estado`, `cufe`, `cadena_cufe`, `valor_bruto`, `descuento_total`, `total_iva`, `total_impuestos`, `total_factura`, `moneda`, `forma_pago`, `medio_pago`, `nit_emisor`, `dv_emisor`, `razon_social_emisor`, `nombre_comercial_emisor`, `direccion_emisor`, `ciudad_emisor`, `departamento_emisor`, `telefono_emisor`, `correo_emisor`, `regimen_emisor`, `responsabilidades_emisor`, `actividad_economica_emisor`, `tipo_doc_adquirente`, `nit_adquirente`, `dv_adquirente`, `razon_social_adquirente`, `correo_adquirente`, `direccion_adquirente`, `telefono_adquirente`, `ciudad_adquirente`, `clave_tecnica`, `resolucion_numero`, `resolucion_desde`, `resolucion_hasta`, `resolucion_vigencia_desde`, `resolucion_vigencia_hasta`, `software_id`, `software_security_code`, `ambiente`, `qr_url`, `xml`, `firmado`, `estado_dian`, `mensaje_dian`, `track_id`, `fecha_envio`, `fecha_respuesta`, `intentos`, `ultimo_error`, `simulado`, `creado_en`, `actualizado_en`) VALUES
(1, 2, 9, 13, '01', 'DT0001', 'DT', 1, '2026-10-23 18:44:26', 'ACEPTADA', '6625a6cb8d136920d3479b65e9210ba689c21ecd44cbde27af18fcc8b8435c32183beaea87ce25cdf3bf05e2b0d87f64', 'DT00012026-10-2313:44:26-05:0092436.970117563.03040.00030.00110000.0090012345646545454fc8eac422eba16e22ffd8c6f94b3f40a6e38162c2', 92436.97, 0.00, 17563.03, 17563.03, 110000.00, 'COP', '1', '10', '900123456', '8', 'DOTACIONES TORONTO S.A.S.', 'Dotaciones Toronto', 'CL 1 # 1 - 1', 'BogotÃ¡ D.C.', 'BogotÃ¡ D.C.', '3000000000', 'facturacion@dotacionestoronto.com', '48', 'O-13,O-15,O-23', '4641', '13', '46545454', NULL, 'jhoan', 'jhoan@gmail.com', 'calle', '65674654', 'BogotÃ¡ D.C.', 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c', '18760000001', 1, 5000, '2025-01-01', '2027-12-31', '00000000-0000-0000-0000-000000000000', '161eff9bf13064986e9e2ef72c883e8b7a83d8d73416565bc839b07d8792b76c5e52554a00f8c52bc8b84cdb3a058741', '2', 'https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=6625a6cb8d136920d3479b65e9210ba689c21ecd44cbde27af18fcc8b8435c32183beaea87ce25cdf3bf05e2b0d87f64', '<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?><Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\" xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\" xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\" xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\" xmlns:ext=\"urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2\" xmlns:sts=\"dian:gov:co:facturaelectronica:Structures-2-1\" xmlns:xades=\"http://uri.etsi.org/01903/v1.3.2#\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent><sts:DianExtensions><sts:InvoiceControl><sts:InvoiceAuthorization>18760000001</sts:InvoiceAuthorization><sts:AuthorizationPeriod><cbc:StartDate>2025-01-01</cbc:StartDate><cbc:EndDate>2027-12-31</cbc:EndDate></sts:AuthorizationPeriod><sts:AuthorizedInvoices><sts:Prefix>DT</sts:Prefix><sts:From>1</sts:From><sts:To>5000</sts:To></sts:AuthorizedInvoices></sts:InvoiceControl><sts:InvoiceSource><cbc:IdentificationCode listAgencyID=\"6\" listAgencyName=\"United Nations Economic Commission for Europe\" listSchemeURI=\"urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1\">CO</cbc:IdentificationCode></sts:InvoiceSource><sts:SoftwareProvider><sts:ProviderID schemeAgencyID=\"195\" schemeAgencyName=\"CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)\" schemeID=\"8\">900123456</sts:ProviderID><sts:SoftwareID schemeAgencyID=\"195\" schemeAgencyName=\"CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)\">00000000-0000-0000-0000-000000000000</sts:SoftwareID></sts:SoftwareProvider><sts:SoftwareSecurityCode schemeAgencyID=\"195\" schemeAgencyName=\"CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)\">161eff9bf13064986e9e2ef72c883e8b7a83d8d73416565bc839b07d8792b76c5e52554a00f8c52bc8b84cdb3a058741</sts:SoftwareSecurityCode><sts:AuthorizationProvider><sts:AuthorizationProviderID schemeAgencyID=\"195\" schemeAgencyName=\"CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)\" schemeID=\"4\">800197268</sts:AuthorizationProviderID></sts:AuthorizationProvider><sts:QRCode>https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=6625a6cb8d136920d3479b65e9210ba689c21ecd44cbde27af18fcc8b8435c32183beaea87ce25cdf3bf05e2b0d87f64</sts:QRCode></sts:DianExtensions></ext:ExtensionContent></ext:UBLExtension><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions><cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID><cbc:CustomizationID>10</cbc:CustomizationID><cbc:ProfileID>DIAN 2.1</cbc:ProfileID><cbc:ProfileExecutionID>2</cbc:ProfileExecutionID><cbc:ID>DT0001</cbc:ID><cbc:UUID schemeID=\"2\" schemeName=\"CUFE-SHA384\">6625a6cb8d136920d3479b65e9210ba689c21ecd44cbde27af18fcc8b8435c32183beaea87ce25cdf3bf05e2b0d87f64</cbc:UUID><cbc:IssueDate>2026-10-23</cbc:IssueDate><cbc:IssueTime>13:44:26-05:00</cbc:IssueTime><cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode><cbc:LineCountNumeric>4</cbc:LineCountNumeric><cac:OrderReference><cbc:ID>9</cbc:ID></cac:OrderReference><cac:AccountingSupplierParty><cbc:AdditionalAccountID schemeAgencyID=\"195\" schemeAgencyName=\"CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)\">1</cbc:AdditionalAccountID><cac:Party><cac:PartyIdentification><cbc:ID schemeAgencyID=\"195\" schemeAgencyName=\"CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)\" schemeID=\"31\" schemeName=\"31\">900123456</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>Dotaciones Toronto</cbc:Name></cac:PartyName><cac:PartyTaxScheme><cbc:RegistrationName>DOTACIONES TORONTO S.A.S.</cbc:RegistrationName><cbc:CompanyID schemeAgencyID=\"195\" schemeAgencyName=\"CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)\" schemeID=\"0\" schemeName=\"31\">900123456-8</cbc:CompanyID><cbc:TaxLevelCode listName=\"48\">O-13,O-15,O-23</cbc:TaxLevelCode><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>DOTACIONES TORONTO S.A.S.</cbc:RegistrationName><cbc:CompanyID schemeAgencyID=\"195\" schemeAgencyName=\"CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)\" schemeID=\"0\" schemeName=\"31\">900123456-8</cbc:CompanyID><cac:CorporateRegistrationScheme><cbc:ID>DT</cbc:ID><cbc:Name>18760000001</cbc:Name></cac:CorporateRegistrationScheme><cac:Address><cbc:ID>11001</cbc:ID><cbc:CityName>BogotÃ¡ D.C.</cbc:CityName><cbc:CountrySubentity>BogotÃ¡ D.C.</cbc:CountrySubentity><cbc:CountrySubentityCode>11001</cbc:CountrySubentityCode><cac:AddressLine><cbc:Line>CL 1 # 1 - 1</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode><cbc:Name languageID=\"es\">Colombia</cbc:Name></cac:Country></cac:Address></cac:PartyLegalEntity><cac:Contact><cbc:Name>Dotaciones Toronto</cbc:Name><cbc:Telephone>3000000000</cbc:Telephone><cbc:ElectronicMail>facturacion@dotacionestoronto.com</cbc:ElectronicMail></cac:Contact></cac:Party></cac:AccountingSupplierParty><cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeAgencyID=\"195\" schemeAgencyName=\"CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)\" schemeID=\"13\" schemeName=\"13\">46545454</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>jhoan</cbc:Name></cac:PartyName><cac:PartyTaxScheme><cbc:RegistrationName>jhoan</cbc:RegistrationName><cbc:CompanyID schemeAgencyID=\"195\" schemeAgencyName=\"CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)\" schemeID=\"13\" schemeName=\"13\">46545454</cbc:CompanyID><cbc:TaxLevelCode listName=\"ZZ\">R-99-PN</cbc:TaxLevelCode><cac:TaxScheme><cbc:ID>ZZ</cbc:ID><cbc:Name>No aplica</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>jhoan</cbc:RegistrationName><cbc:CompanyID schemeAgencyID=\"195\" schemeAgencyName=\"CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)\" schemeID=\"13\" schemeName=\"13\">46545454</cbc:CompanyID><cac:Address><cbc:ID>11001</cbc:ID><cbc:CityName>BogotÃ¡ D.C.</cbc:CityName><cbc:CountrySubentity>BogotÃ¡ D.C.</cbc:CountrySubentity><cbc:CountrySubentityCode>11001</cbc:CountrySubentityCode><cac:AddressLine><cbc:Line>calle</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode><cbc:Name languageID=\"es\">Colombia</cbc:Name></cac:Country></cac:Address></cac:PartyLegalEntity><cac:Contact><cbc:Telephone>65674654</cbc:Telephone><cbc:ElectronicMail>jhoan@gmail.com</cbc:ElectronicMail></cac:Contact></cac:Party></cac:AccountingCustomerParty><cac:PaymentMeans><cbc:ID>1</cbc:ID><cbc:PaymentMeansCode>10</cbc:PaymentMeansCode><cbc:PaymentDueDate>2026-10-23</cbc:PaymentDueDate><cbc:PaymentID>DT0001</cbc:PaymentID></cac:PaymentMeans><cac:TaxTotal><cbc:TaxAmount currencyID=\"COP\">17563.03</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID=\"COP\">92436.97</cbc:TaxableAmount><cbc:TaxAmount currencyID=\"COP\">17563.03</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>19.00</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID=\"COP\">92436.97</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID=\"COP\">92436.97</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID=\"COP\">110000.00</cbc:TaxInclusiveAmount><cbc:AllowanceTotalAmount currencyID=\"COP\">0.00</cbc:AllowanceTotalAmount><cbc:PayableAmount currencyID=\"COP\">110000.00</cbc:PayableAmount></cac:LegalMonetaryTotal><cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode=\"94\">1.00</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID=\"COP\">25210.08</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID=\"COP\">4789.92</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID=\"COP\">25210.08</cbc:TaxableAmount><cbc:TaxAmount currencyID=\"COP\">4789.92</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>19.00</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:Item><cbc:Description>Pantalón Jean - Talla M - Azul Oscuro</cbc:Description><cac:SellersItemIdentification><cbc:ID>12</cbc:ID></cac:SellersItemIdentification><cac:StandardItemIdentification><cbc:ID schemeID=\"999\">12</cbc:ID></cac:StandardItemIdentification></cac:Item><cac:Price><cbc:PriceAmount currencyID=\"COP\">25210.08</cbc:PriceAmount><cbc:BaseQuantity unitCode=\"94\">1.00</cbc:BaseQuantity></cac:Price></cac:InvoiceLine><cac:InvoiceLine><cbc:ID>2</cbc:ID><cbc:InvoicedQuantity unitCode=\"94\">1.00</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID=\"COP\">37815.13</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID=\"COP\">7184.87</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID=\"COP\">37815.13</cbc:TaxableAmount><cbc:TaxAmount currencyID=\"COP\">7184.87</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>19.00</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:Item><cbc:Description>Chaqueta  - Talla S - Azul</cbc:Description><cac:SellersItemIdentification><cbc:ID>11</cbc:ID></cac:SellersItemIdentification><cac:StandardItemIdentification><cbc:ID schemeID=\"999\">11</cbc:ID></cac:StandardItemIdentification></cac:Item><cac:Price><cbc:PriceAmount currencyID=\"COP\">37815.13</cbc:PriceAmount><cbc:BaseQuantity unitCode=\"94\">1.00</cbc:BaseQuantity></cac:Price></cac:InvoiceLine><cac:InvoiceLine><cbc:ID>3</cbc:ID><cbc:InvoicedQuantity unitCode=\"94\">1.00</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID=\"COP\">25210.08</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID=\"COP\">4789.92</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID=\"COP\">25210.08</cbc:TaxableAmount><cbc:TaxAmount currencyID=\"COP\">4789.92</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>19.00</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:Item><cbc:Description>Zapatos - Talla L - Azul</cbc:Description><cac:SellersItemIdentification><cbc:ID>10</cbc:ID></cac:SellersItemIdentification><cac:StandardItemIdentification><cbc:ID schemeID=\"999\">10</cbc:ID></cac:StandardItemIdentification></cac:Item><cac:Price><cbc:PriceAmount currencyID=\"COP\">25210.08</cbc:PriceAmount><cbc:BaseQuantity unitCode=\"94\">1.00</cbc:BaseQuantity></cac:Price></cac:InvoiceLine><cac:InvoiceLine><cbc:ID>4</cbc:ID><cbc:InvoicedQuantity unitCode=\"94\">1.00</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID=\"COP\">4201.68</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID=\"COP\">798.32</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID=\"COP\">4201.68</cbc:TaxableAmount><cbc:TaxAmount currencyID=\"COP\">798.32</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>19.00</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:Item><cbc:Description>Medias - Talla S - Azul</cbc:Description><cac:SellersItemIdentification><cbc:ID>9</cbc:ID></cac:SellersItemIdentification><cac:StandardItemIdentification><cbc:ID schemeID=\"999\">9</cbc:ID></cac:StandardItemIdentification></cac:Item><cac:Price><cbc:PriceAmount currencyID=\"COP\">4201.68</cbc:PriceAmount><cbc:BaseQuantity unitCode=\"94\">1.00</cbc:BaseQuantity></cac:Price></cac:InvoiceLine></Invoice>', 0, 'ACEPTADA', 'Consulta simulada: documento aceptado.', 'e773c5c2-f091-4b80-89b5-02f35fab1562', '2026-10-23 18:44:26', '2026-10-23 18:45:51', 1, NULL, 1, '2026-10-23 18:44:26', '2026-10-23 18:45:51');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `factura_electronica_detalle`
--

CREATE TABLE `factura_electronica_detalle` (
  `id_detalle_factura` bigint(20) NOT NULL,
  `id_factura_fk` bigint(20) NOT NULL,
  `numero_linea` int(11) DEFAULT NULL,
  `codigo_producto` varchar(60) DEFAULT NULL,
  `descripcion` varchar(300) DEFAULT NULL,
  `cantidad` decimal(19,2) DEFAULT NULL,
  `unidad_medida` varchar(6) DEFAULT '94',
  `precio_unitario` decimal(19,2) DEFAULT NULL,
  `descuento` decimal(19,2) DEFAULT 0.00,
  `iva_porcentaje` decimal(6,2) DEFAULT 0.00,
  `iva_valor` decimal(19,2) DEFAULT 0.00,
  `total_linea` decimal(19,2) DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `factura_electronica_detalle`
--

INSERT INTO `factura_electronica_detalle` (`id_detalle_factura`, `id_factura_fk`, `numero_linea`, `codigo_producto`, `descripcion`, `cantidad`, `unidad_medida`, `precio_unitario`, `descuento`, `iva_porcentaje`, `iva_valor`, `total_linea`) VALUES
(1, 1, 1, '12', 'Pantalón Jean - Talla M - Azul Oscuro', 1.00, '94', 25210.08, 0.00, 19.00, 4789.92, 25210.08),
(2, 1, 2, '11', 'Chaqueta  - Talla S - Azul', 1.00, '94', 37815.13, 0.00, 19.00, 7184.87, 37815.13),
(3, 1, 3, '10', 'Zapatos - Talla L - Azul', 1.00, '94', 25210.08, 0.00, 19.00, 4789.92, 25210.08),
(4, 1, 4, '9', 'Medias - Talla S - Azul', 1.00, '94', 4201.68, 0.00, 19.00, 798.32, 4201.68);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `factura_electronica_evento`
--

CREATE TABLE `factura_electronica_evento` (
  `id_evento` bigint(20) NOT NULL,
  `id_factura_fk` bigint(20) NOT NULL,
  `fecha` datetime DEFAULT NULL,
  `tipo` varchar(30) DEFAULT NULL,
  `estado` varchar(30) DEFAULT NULL,
  `mensaje` varchar(500) DEFAULT NULL,
  `payload` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `factura_electronica_evento`
--

INSERT INTO `factura_electronica_evento` (`id_evento`, `id_factura_fk`, `fecha`, `tipo`, `estado`, `mensaje`, `payload`) VALUES
(1, 1, '2026-10-23 18:44:26', 'GENERACION', 'GENERADA', 'Factura DT0001 generada. CUFE: 6625a6cb8d136920d3479b65e9210ba689c21ecd44cbde27af18fcc8b8435c32183beaea87ce25cdf3bf05e2b0d87f64', NULL),
(2, 1, '2026-10-23 18:44:26', 'RESPUESTA', 'ACEPTADA', 'Documento aceptado en MODO SIMULACIÓN (no fue transmitido a la DIAN).', '{\"simulado\":true,\"zipKey\":\"e773c5c2-f091-4b80-89b5-02f35fab1562\",\"statusCode\":\"00\",\"statusDescription\":\"Procesado correctamente (simulación)\"}'),
(3, 1, '2026-10-23 18:45:51', 'RESPUESTA', 'ACEPTADA', 'Consulta simulada: documento aceptado.', NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `inventario`
--

CREATE TABLE `inventario` (
  `id_inventario` bigint(20) NOT NULL,
  `id_producto_fk` bigint(20) DEFAULT NULL,
  `cantidad_actual` int(11) DEFAULT NULL,
  `stock_minimo` int(11) DEFAULT NULL,
  `inhabilitado` bit(1) DEFAULT b'0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `inventario`
--

INSERT INTO `inventario` (`id_inventario`, `id_producto_fk`, `cantidad_actual`, `stock_minimo`, `inhabilitado`) VALUES
(10, 7, 0, 20, b'0'),
(11, 9, 10, 5, b'0'),
(12, 8, 0, 40, b'0'),
(13, 10, 50, 20, b'0'),
(14, 6, 30, 10, b'0'),
(16, 11, 40, 20, b'0'),
(17, 12, 30, 31, b'0'),
(18, 10, 23, 40, b'0');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `movimientos_inventario`
--

CREATE TABLE `movimientos_inventario` (
  `id` bigint(20) NOT NULL,
  `id_inventario` bigint(20) DEFAULT NULL,
  `nombre_producto` varchar(255) DEFAULT NULL,
  `tipo_movimiento` varchar(50) DEFAULT NULL,
  `cantidad` int(11) DEFAULT NULL,
  `motivo` varchar(255) DEFAULT NULL,
  `usuario_responsable` varchar(255) DEFAULT NULL,
  `fecha_hora` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `movimientos_inventario`
--

INSERT INTO `movimientos_inventario` (`id`, `id_inventario`, `nombre_producto`, `tipo_movimiento`, `cantidad`, `motivo`, `usuario_responsable`, `fecha_hora`) VALUES
(1, 3, 'Camiseta - S - Rojo', 'SALIDA', 45, 'Porque si', 'suarez', '2026-09-02 20:36:13'),
(2, 6, 'Botas - M - Cafe', 'ENTRADA', 50, 'Registro inicial de inventario', 'suarez', '2026-09-02 21:12:13'),
(3, 7, 'Overol - XL - Verde', 'ENTRADA', 30, 'Registro inicial de inventario', 'suarez', '2026-09-02 21:17:05'),
(4, 7, 'Overol - XL - Verde', 'SALIDA', 30, 'Si', 'suarez', '2026-09-02 21:31:53'),
(5, 1, 'Camiseta - S - Rojo', 'AJUSTE', 0, 'Porque asi es la vida', 'suarez', '2026-09-02 22:16:59'),
(6, 8, 'Botas - M - Cafe', 'ENTRADA', 50, 'Registro inicial de inventario', 'suarez', '2026-09-02 22:32:27'),
(7, 6, 'Botas - M - Cafe', 'SALIDA', 30, 'Porque asi es la vida', 'suarez', '2026-09-08 18:10:19'),
(8, 9, 'Camisa - M - Rojo', 'ENTRADA', 20, 'Registro inicial de inventario', 'suarez', '2026-09-08 21:26:44'),
(9, 10, 'Overol - L - Azul', 'ENTRADA', 20, 'Registro inicial de inventario', 'suarez', '2026-09-08 21:27:08'),
(10, 11, 'Medias - S - Azul', 'ENTRADA', 10, 'Registro inicial de inventario', 'suarez', '2026-09-08 21:33:37'),
(11, 12, 'Casco - M - Cafe', 'ENTRADA', 50, 'Registro inicial de inventario', 'suarez', '2026-09-08 21:49:42'),
(12, 12, 'Casco - M - Cafe', 'SALIDA', 50, 'SIZAS', 'suarez', '2026-09-08 21:50:10'),
(13, 13, 'Zapatos - L - Azul', 'ENTRADA', 50, 'Registro inicial de inventario', 'suarez', '2026-09-10 17:33:07'),
(14, 10, 'Overol - L - Azul', 'ENTRADA', 10, 'SIZAS', 'benzema', '2026-09-10 18:32:51'),
(15, 10, 'Overol - L - Azul', 'SALIDA', 30, 'Situación actual del producto.', 'benzema', '2026-09-10 18:36:33'),
(16, 16, 'Chaqueta  - S - Azul', 'ENTRADA', 40, 'Registro inicial de inventario (Admin)', 'benzema', '2026-09-10 18:42:44'),
(17, 17, 'Pantalón Jean - M - Azul Oscuro', 'ENTRADA', 30, 'Registro inicial de inventario (Admin)', 'benzema', '2026-09-10 18:48:18'),
(18, 18, 'Zapatos - L - Azul', 'ENTRADA', 23, 'Registro inicial de inventario (Admin)', 'jefferson', '2026-09-16 17:26:56');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pedido`
--

CREATE TABLE `pedido` (
  `id_pedido` bigint(20) NOT NULL,
  `id_usuario_fk` bigint(20) DEFAULT NULL,
  `fecha_pedido` datetime(6) DEFAULT NULL,
  `estado` varchar(255) DEFAULT NULL,
  `oculto` bit(1) DEFAULT b'0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `pedido`
--

INSERT INTO `pedido` (`id_pedido`, `id_usuario_fk`, `fecha_pedido`, `estado`, `oculto`) VALUES
(6, 13, '2026-09-16 01:49:14.000000', 'Cancelado', b'0'),
(7, 13, '2026-09-16 01:49:21.000000', 'Entregado', b'1'),
(8, 13, '2026-09-16 16:49:47.000000', 'Cancelado', b'0'),
(9, 13, '2026-09-16 19:07:07.000000', 'Entregado', b'1');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `producto`
--

CREATE TABLE `producto` (
  `id_producto` bigint(20) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `precio` decimal(38,2) NOT NULL,
  `talla` varchar(255) DEFAULT NULL,
  `color` varchar(255) DEFAULT NULL,
  `imagen` varchar(255) DEFAULT NULL,
  `estado` varchar(255) DEFAULT NULL,
  `inhabilitado` bit(1) DEFAULT b'0',
  `categoria` varchar(100) DEFAULT 'General'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `producto`
--

INSERT INTO `producto` (`id_producto`, `nombre`, `precio`, `talla`, `color`, `imagen`, `estado`, `inhabilitado`, `categoria`) VALUES
(6, 'Camisa', 30000.00, 'M', 'Rojo', NULL, 'Disponible', b'0', 'Camisas/Polos'),
(7, 'Overol', 30000.00, 'L', 'Azul', NULL, 'Disponible', b'0', 'Protección Personal'),
(8, 'Casco', 20000.00, 'M', 'Cafe', NULL, 'Disponible', b'0', 'Protección Personal'),
(9, 'Medias', 5000.00, 'S', 'Azul', NULL, 'Disponible', b'0', 'Calzado'),
(10, 'Zapatos', 30000.00, 'L', 'Azul', NULL, 'Disponible', b'0', 'Calzado'),
(11, 'Chaqueta ', 45000.00, 'S', 'Azul', NULL, 'Disponible', b'0', 'Chaquetas'),
(12, 'Pantalón Jean', 30000.00, 'M', 'Azul Oscuro', NULL, 'Disponible', b'0', 'Pantalones');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `resolucion_facturacion`
--

CREATE TABLE `resolucion_facturacion` (
  `id_resolucion` int(11) NOT NULL,
  `tipo_documento` varchar(4) DEFAULT '01',
  `numero_resolucion` varchar(40) DEFAULT NULL,
  `prefijo` varchar(10) DEFAULT NULL,
  `rango_desde` bigint(20) DEFAULT NULL,
  `rango_hasta` bigint(20) DEFAULT NULL,
  `consecutivo_actual` bigint(20) DEFAULT NULL,
  `clave_tecnica` varchar(128) DEFAULT NULL,
  `vigencia_desde` date DEFAULT NULL,
  `vigencia_hasta` date DEFAULT NULL,
  `vigente` tinyint(1) DEFAULT 1,
  `notificacion` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `resolucion_facturacion`
--

INSERT INTO `resolucion_facturacion` (`id_resolucion`, `tipo_documento`, `numero_resolucion`, `prefijo`, `rango_desde`, `rango_hasta`, `consecutivo_actual`, `clave_tecnica`, `vigencia_desde`, `vigencia_hasta`, `vigente`, `notificacion`) VALUES
(1, '01', '18760000001', 'DT', 1, 5000, 1, 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c', '2025-01-01', '2027-12-31', 1, NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `rol`
--

CREATE TABLE `rol` (
  `id_rol` int(11) NOT NULL,
  `nombre_rol` varchar(50) DEFAULT NULL,
  `descripcion_rol` varchar(150) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `rol`
--

INSERT INTO `rol` (`id_rol`, `nombre_rol`, `descripcion_rol`, `activo`) VALUES
(1, 'Administrador', 'Control total del sistema', 1),
(2, 'Cliente', 'Usuario que compra productos', 1),
(3, 'Vendedor', 'Gestiona ventas', 1),
(4, 'Bodeguero', 'Administra inventario', 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuario`
--

CREATE TABLE `usuario` (
  `id_usuario` bigint(20) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `documento` varchar(255) DEFAULT NULL,
  `correo` varchar(255) NOT NULL,
  `telefono` varchar(255) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `estado` varchar(255) DEFAULT NULL,
  `id_rol_fk` int(11) DEFAULT 2
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuario`
--

INSERT INTO `usuario` (`id_usuario`, `nombre`, `documento`, `correo`, `telefono`, `password`, `direccion`, `estado`, `id_rol_fk`) VALUES
(12, 'jefferson', '7666465', 'jefferson@gmail.com', '646465', '$2a$10$i3Uvwzc3hYJ25T2MxRCfS.rNEVPYBS5atDcM8xUjMaX2sj2SWqvO6', 'calle', 'Habilitado', 1),
(13, 'jhoan', '46545454', 'jhoan@gmail.com', '65674654', '$2a$10$aLlx5NSUDEal6WbTtJsA5Opidu7PWXb3XG1Y/x4zIdnBieGIX6cou', 'calle', 'Habilitado', 1),
(14, 'david', '655454654', 'david@gmail.com', '67654646554', '$2a$10$LE4IXHoQjA4fz3q2BT5l.OzpNOWlGv2/a.HzzonCG1W5dMdI97Oca', 'calle', 'Habilitado', 3),
(15, 'cristian', '64664646', 'cristian@gmail.com', '6536564', '$2a$10$GPWxtHkSGLcHWJO1BOBIi.qQ3u.EXJKmS7eLm/vEyXS3sd5N3VD4S', 'calle', 'Habilitado', 4),
(16, 'Administrador', '0000000000', 'admin@dotacionestoronto.com', '0000000000', '$2a$10$nDWHoF9PA0oflPjxkkjK6.U5YcJQ/IDHhBoEoQABnixCEhS5sthny', 'Oficina principal', 'Habilitado', 1),
(17, 'bladimir', '10203040', 'bladimir@gmail.com', '001', '$2a$10$9Hvg9FtiJoH8tT8U9rT4Pe4Yj97OMo/I2ixgH8d6PlK3uCQN.XWVi', '1234567890', 'Habilitado', 2),
(18, 'dylan', '4573453', 'dylan@gmail.com', '32735437435', '$2a$10$UTzzHpiJk5pwPld2TYsKaOevB4Vqqo4LUgTSF.kKfgCldGgBbL/8y', 'calle', 'Habilitado', 2);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuario_rol`
--

CREATE TABLE `usuario_rol` (
  `id_usuario_rol` int(11) NOT NULL,
  `id_usuario_fk` bigint(20) NOT NULL,
  `id_rol_fk` int(11) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuario_rol`
--

INSERT INTO `usuario_rol` (`id_usuario_rol`, `id_usuario_fk`, `id_rol_fk`, `activo`) VALUES
(1, 12, 1, 1),
(2, 16, 1, 1),
(4, 17, 2, 1),
(5, 14, 3, 1),
(6, 15, 4, 1),
(8, 12, 3, 1),
(11, 13, 1, 1),
(12, 13, 2, 1),
(13, 13, 3, 1),
(14, 14, 2, 1),
(15, 15, 2, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `venta`
--

CREATE TABLE `venta` (
  `id_venta` bigint(20) NOT NULL,
  `id_usuario_fk` bigint(20) DEFAULT NULL,
  `id_pedido_fk` bigint(20) DEFAULT NULL,
  `fecha_venta` datetime(6) DEFAULT NULL,
  `total_pagado` double DEFAULT NULL,
  `estado` varchar(50) NOT NULL DEFAULT 'Completada'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `venta`
--

INSERT INTO `venta` (`id_venta`, `id_usuario_fk`, `id_pedido_fk`, `fecha_venta`, `total_pagado`, `estado`) VALUES
(1, 13, 7, '2026-09-16 01:49:59.000000', 120000, 'Completada'),
(2, 13, 9, '2026-10-23 18:44:25.000000', 110000, 'Completada');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `alerta_stock`
--
ALTER TABLE `alerta_stock`
  ADD PRIMARY KEY (`id_alerta`),
  ADD KEY `id_producto_fk` (`id_producto_fk`);

--
-- Indices de la tabla `carrito`
--
ALTER TABLE `carrito`
  ADD PRIMARY KEY (`id_carrito`),
  ADD KEY `id_usuario_fk` (`id_usuario_fk`);

--
-- Indices de la tabla `descuento`
--
ALTER TABLE `descuento`
  ADD PRIMARY KEY (`id_descuento`),
  ADD KEY `id_producto_fk` (`id_producto_fk`);

--
-- Indices de la tabla `detalle_carrito`
--
ALTER TABLE `detalle_carrito`
  ADD PRIMARY KEY (`id_detalle_carrito`),
  ADD KEY `id_carrito_fk` (`id_carrito_fk`),
  ADD KEY `id_producto_fk` (`id_producto_fk`);

--
-- Indices de la tabla `detalle_pedido`
--
ALTER TABLE `detalle_pedido`
  ADD PRIMARY KEY (`id_detalle_pedido`),
  ADD KEY `id_pedido_fk` (`id_pedido_fk`),
  ADD KEY `id_producto_fk` (`id_producto_fk`);

--
-- Indices de la tabla `detalle_venta`
--
ALTER TABLE `detalle_venta`
  ADD PRIMARY KEY (`id_detalle_venta`),
  ADD KEY `id_venta_fk` (`id_venta_fk`),
  ADD KEY `id_producto_fk` (`id_producto_fk`);

--
-- Indices de la tabla `devolucion`
--
ALTER TABLE `devolucion`
  ADD PRIMARY KEY (`id_devolucion`),
  ADD KEY `id_detalle_venta_fk` (`id_detalle_venta_fk`);

--
-- Indices de la tabla `factura`
--
ALTER TABLE `factura`
  ADD PRIMARY KEY (`id_factura`),
  ADD KEY `id_venta_fk` (`id_venta_fk`);

--
-- Indices de la tabla `factura_electronica`
--
ALTER TABLE `factura_electronica`
  ADD PRIMARY KEY (`id_factura`),
  ADD UNIQUE KEY `uk_factura_numero` (`numero_factura`),
  ADD KEY `idx_factura_venta` (`id_venta_fk`),
  ADD KEY `idx_factura_cliente` (`id_cliente_fk`),
  ADD KEY `idx_factura_estado` (`estado`),
  ADD KEY `idx_factura_cufe` (`cufe`);

--
-- Indices de la tabla `factura_electronica_detalle`
--
ALTER TABLE `factura_electronica_detalle`
  ADD PRIMARY KEY (`id_detalle_factura`),
  ADD KEY `idx_detalle_factura` (`id_factura_fk`);

--
-- Indices de la tabla `factura_electronica_evento`
--
ALTER TABLE `factura_electronica_evento`
  ADD PRIMARY KEY (`id_evento`),
  ADD KEY `idx_evento_factura` (`id_factura_fk`);

--
-- Indices de la tabla `inventario`
--
ALTER TABLE `inventario`
  ADD PRIMARY KEY (`id_inventario`),
  ADD KEY `id_producto_fk` (`id_producto_fk`);

--
-- Indices de la tabla `movimientos_inventario`
--
ALTER TABLE `movimientos_inventario`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `pedido`
--
ALTER TABLE `pedido`
  ADD PRIMARY KEY (`id_pedido`),
  ADD KEY `id_usuario_fk` (`id_usuario_fk`);

--
-- Indices de la tabla `producto`
--
ALTER TABLE `producto`
  ADD PRIMARY KEY (`id_producto`);

--
-- Indices de la tabla `resolucion_facturacion`
--
ALTER TABLE `resolucion_facturacion`
  ADD PRIMARY KEY (`id_resolucion`),
  ADD KEY `idx_resolucion_tipo` (`tipo_documento`,`vigente`);

--
-- Indices de la tabla `rol`
--
ALTER TABLE `rol`
  ADD PRIMARY KEY (`id_rol`);

--
-- Indices de la tabla `usuario`
--
ALTER TABLE `usuario`
  ADD PRIMARY KEY (`id_usuario`),
  ADD UNIQUE KEY `UK_correo` (`correo`),
  ADD KEY `id_rol_fk` (`id_rol_fk`);

--
-- Indices de la tabla `usuario_rol`
--
ALTER TABLE `usuario_rol`
  ADD PRIMARY KEY (`id_usuario_rol`),
  ADD UNIQUE KEY `uk_usuario_rol` (`id_usuario_fk`,`id_rol_fk`),
  ADD KEY `fk_usuario_rol_rol` (`id_rol_fk`);

--
-- Indices de la tabla `venta`
--
ALTER TABLE `venta`
  ADD PRIMARY KEY (`id_venta`),
  ADD KEY `id_usuario_fk` (`id_usuario_fk`),
  ADD KEY `id_pedido_fk` (`id_pedido_fk`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `alerta_stock`
--
ALTER TABLE `alerta_stock`
  MODIFY `id_alerta` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `carrito`
--
ALTER TABLE `carrito`
  MODIFY `id_carrito` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `descuento`
--
ALTER TABLE `descuento`
  MODIFY `id_descuento` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `detalle_carrito`
--
ALTER TABLE `detalle_carrito`
  MODIFY `id_detalle_carrito` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `detalle_pedido`
--
ALTER TABLE `detalle_pedido`
  MODIFY `id_detalle_pedido` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT de la tabla `detalle_venta`
--
ALTER TABLE `detalle_venta`
  MODIFY `id_detalle_venta` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `devolucion`
--
ALTER TABLE `devolucion`
  MODIFY `id_devolucion` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `factura`
--
ALTER TABLE `factura`
  MODIFY `id_factura` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `factura_electronica`
--
ALTER TABLE `factura_electronica`
  MODIFY `id_factura` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `factura_electronica_detalle`
--
ALTER TABLE `factura_electronica_detalle`
  MODIFY `id_detalle_factura` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `factura_electronica_evento`
--
ALTER TABLE `factura_electronica_evento`
  MODIFY `id_evento` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `inventario`
--
ALTER TABLE `inventario`
  MODIFY `id_inventario` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT de la tabla `movimientos_inventario`
--
ALTER TABLE `movimientos_inventario`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT de la tabla `pedido`
--
ALTER TABLE `pedido`
  MODIFY `id_pedido` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT de la tabla `producto`
--
ALTER TABLE `producto`
  MODIFY `id_producto` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT de la tabla `resolucion_facturacion`
--
ALTER TABLE `resolucion_facturacion`
  MODIFY `id_resolucion` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `rol`
--
ALTER TABLE `rol`
  MODIFY `id_rol` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `usuario`
--
ALTER TABLE `usuario`
  MODIFY `id_usuario` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT de la tabla `usuario_rol`
--
ALTER TABLE `usuario_rol`
  MODIFY `id_usuario_rol` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT de la tabla `venta`
--
ALTER TABLE `venta`
  MODIFY `id_venta` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `alerta_stock`
--
ALTER TABLE `alerta_stock`
  ADD CONSTRAINT `fk_alerta_producto` FOREIGN KEY (`id_producto_fk`) REFERENCES `producto` (`id_producto`);

--
-- Filtros para la tabla `carrito`
--
ALTER TABLE `carrito`
  ADD CONSTRAINT `fk_carrito_usuario` FOREIGN KEY (`id_usuario_fk`) REFERENCES `usuario` (`id_usuario`);

--
-- Filtros para la tabla `descuento`
--
ALTER TABLE `descuento`
  ADD CONSTRAINT `fk_descuento_producto` FOREIGN KEY (`id_producto_fk`) REFERENCES `producto` (`id_producto`);

--
-- Filtros para la tabla `detalle_carrito`
--
ALTER TABLE `detalle_carrito`
  ADD CONSTRAINT `fk_detalle_carrito_carrito` FOREIGN KEY (`id_carrito_fk`) REFERENCES `carrito` (`id_carrito`),
  ADD CONSTRAINT `fk_detalle_carrito_producto` FOREIGN KEY (`id_producto_fk`) REFERENCES `producto` (`id_producto`);

--
-- Filtros para la tabla `detalle_pedido`
--
ALTER TABLE `detalle_pedido`
  ADD CONSTRAINT `fk_detalle_pedido_pedido` FOREIGN KEY (`id_pedido_fk`) REFERENCES `pedido` (`id_pedido`),
  ADD CONSTRAINT `fk_detalle_pedido_producto` FOREIGN KEY (`id_producto_fk`) REFERENCES `producto` (`id_producto`);

--
-- Filtros para la tabla `detalle_venta`
--
ALTER TABLE `detalle_venta`
  ADD CONSTRAINT `fk_detalle_venta_producto` FOREIGN KEY (`id_producto_fk`) REFERENCES `producto` (`id_producto`),
  ADD CONSTRAINT `fk_detalle_venta_venta` FOREIGN KEY (`id_venta_fk`) REFERENCES `venta` (`id_venta`);

--
-- Filtros para la tabla `devolucion`
--
ALTER TABLE `devolucion`
  ADD CONSTRAINT `fk_devolucion_detalle_venta` FOREIGN KEY (`id_detalle_venta_fk`) REFERENCES `detalle_venta` (`id_detalle_venta`);

--
-- Filtros para la tabla `factura`
--
ALTER TABLE `factura`
  ADD CONSTRAINT `fk_factura_venta` FOREIGN KEY (`id_venta_fk`) REFERENCES `venta` (`id_venta`);

--
-- Filtros para la tabla `inventario`
--
ALTER TABLE `inventario`
  ADD CONSTRAINT `fk_inventario_producto` FOREIGN KEY (`id_producto_fk`) REFERENCES `producto` (`id_producto`);

--
-- Filtros para la tabla `pedido`
--
ALTER TABLE `pedido`
  ADD CONSTRAINT `fk_pedido_usuario` FOREIGN KEY (`id_usuario_fk`) REFERENCES `usuario` (`id_usuario`);

--
-- Filtros para la tabla `usuario`
--
ALTER TABLE `usuario`
  ADD CONSTRAINT `fk_usuario_rol` FOREIGN KEY (`id_rol_fk`) REFERENCES `rol` (`id_rol`);

--
-- Filtros para la tabla `usuario_rol`
--
ALTER TABLE `usuario_rol`
  ADD CONSTRAINT `fk_usuario_rol_rol` FOREIGN KEY (`id_rol_fk`) REFERENCES `rol` (`id_rol`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_usuario_rol_usuario` FOREIGN KEY (`id_usuario_fk`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `venta`
--
ALTER TABLE `venta`
  ADD CONSTRAINT `fk_venta_pedido` FOREIGN KEY (`id_pedido_fk`) REFERENCES `pedido` (`id_pedido`),
  ADD CONSTRAINT `fk_venta_usuario` FOREIGN KEY (`id_usuario_fk`) REFERENCES `usuario` (`id_usuario`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
