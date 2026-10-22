-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 20-10-2026 a las 23:34:29
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
  `fecha_alerta` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `carrito`
--

CREATE TABLE `carrito` (
  `id_carrito` int(11) NOT NULL,
  `id_usuario_fk` bigint(20) DEFAULT NULL,
  `fecha_creacion` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `descuento`
--

CREATE TABLE `descuento` (
  `id_descuento` int(11) NOT NULL,
  `id_producto_fk` bigint(20) DEFAULT NULL,
  `tipo_descuento` varchar(50) DEFAULT NULL,
  `valor_descuento` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `detalle_carrito`
--

CREATE TABLE `detalle_carrito` (
  `id_detalle_carrito` bigint(20) NOT NULL,
  `id_carrito_fk` int(11) DEFAULT NULL,
  `id_producto_fk` bigint(20) DEFAULT NULL,
  `cantidad` int(11) DEFAULT NULL
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
  `cantidad` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `detalle_pedido`
--

INSERT INTO `detalle_pedido` (`id_detalle_pedido`, `id_pedido_fk`, `id_producto_fk`, `precio_unitario`, `cantidad`) VALUES
(6, 6, 11, 45000.00, 5),
(7, 7, 12, 30000.00, 4),
(8, 8, 12, 30000.00, 4),
(9, 9, 12, 30000.00, 1),
(10, 9, 11, 45000.00, 1),
(11, 9, 10, 30000.00, 1),
(12, 9, 9, 5000.00, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `detalle_venta`
--

CREATE TABLE `detalle_venta` (
  `id_detalle_venta` bigint(20) NOT NULL,
  `id_venta_fk` bigint(20) DEFAULT NULL,
  `id_producto_fk` bigint(20) DEFAULT NULL,
  `cantidad` int(11) DEFAULT NULL,
  `precio_unitario` decimal(38,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `detalle_venta`
--

INSERT INTO `detalle_venta` (`id_detalle_venta`, `id_venta_fk`, `id_producto_fk`, `cantidad`, `precio_unitario`) VALUES
(1, 1, 12, 4, 30000.00);

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
  `fecha_factura` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
(9, 13, '2026-09-16 19:07:07.000000', 'Pendiente', b'0');

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
-- Estructura de tabla para la tabla `rol`
--

CREATE TABLE `rol` (
  `id_rol` int(11) NOT NULL,
  `nombre_rol` varchar(50) DEFAULT NULL,
  `descripcion_rol` varchar(150) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `rol`
--

INSERT INTO `rol` (`id_rol`, `nombre_rol`, `descripcion_rol`) VALUES
(1, 'Administrador', 'Control total del sistema'),
(2, 'Cliente', 'Usuario que compra productos'),
(3, 'Vendedor', 'Gestiona ventas'),
(4, 'Bodeguero', 'Administra inventario');

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
  `id_rol_fk` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuario_rol`
--

INSERT INTO `usuario_rol` (`id_usuario_rol`, `id_usuario_fk`, `id_rol_fk`) VALUES
(1, 12, 1),
(8, 12, 3),
(11, 13, 1),
(12, 13, 2),
(13, 13, 3),
(14, 14, 2),
(5, 14, 3),
(15, 15, 2),
(6, 15, 4),
(2, 16, 1),
(4, 17, 2);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `venta`
--

CREATE TABLE `venta` (
  `id_venta` bigint(20) NOT NULL,
  `id_usuario_fk` bigint(20) DEFAULT NULL,
  `id_pedido_fk` bigint(20) DEFAULT NULL,
  `fecha_venta` datetime(6) DEFAULT NULL,
  `total_pagado` double DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `venta`
--

INSERT INTO `venta` (`id_venta`, `id_usuario_fk`, `id_pedido_fk`, `fecha_venta`, `total_pagado`) VALUES
(1, 13, 7, '2026-09-16 01:49:59.000000', 120000);

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
  MODIFY `id_detalle_venta` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

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
  MODIFY `id_venta` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

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
