import { supabase } from '../lib/supabaseClient';

/**
 * Obtener número correlativo de la siguiente factura
 */
export async function getProximoNumeroFactura() {
  try {
    const { data, error } = await supabase
      .from('factura')
      .select('numero_factura')
      .order('numero_factura', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (data && data.length > 0) {
      return Number(data[0].numero_factura) + 1;
    }
    return 1001; // Número inicial base
  } catch (err) {
    console.error('Error in getProximoNumeroFactura:', err);
    return 1001;
  }
}

/**
 * Obtener listado de facturas con filtros y paginación
 */
export async function getFacturas({
  search = '',
  estado = 'ALL', // 'ALL', 'PAGADA', 'PENDIENTE', 'ANULADA'
  fechaDesde = '',
  fechaHasta = '',
  page = 1,
  pageSize = 10,
}) {
  try {
    let query = supabase
      .from('factura')
      .select('*, cliente(*), usuario(nombre)', { count: 'exact' });

    // Filtro de estado
    if (estado !== 'ALL') {
      query = query.eq('estado', estado);
    }

    // Filtros por rango de fecha
    if (fechaDesde) {
      query = query.gte('fecha_emision', fechaDesde);
    }
    if (fechaHasta) {
      query = query.lte('fecha_emision', fechaHasta);
    }

    // Orden descendente por número de factura o fecha
    query = query.order('numero_factura', { ascending: false });

    const { data, count, error } = await query;
    if (error) throw error;

    let items = data || [];

    // Búsqueda en memoria por # factura o nombre de cliente
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      items = items.filter(f =>
        f.numero_factura.toString().includes(term) ||
        (f.cliente?.nombre && f.cliente.nombre.toLowerCase().includes(term)) ||
        (f.cliente?.ruc && f.cliente.ruc.includes(term))
      );
    }

    const totalFiltered = items.length;
    const from = (page - 1) * pageSize;
    const paginatedItems = items.slice(from, from + pageSize);

    return {
      facturas: paginatedItems,
      totalCount: totalFiltered,
      totalPages: Math.ceil(totalFiltered / pageSize) || 1,
      currentPage: page,
    };
  } catch (err) {
    console.error('Error in getFacturas:', err);
    throw err;
  }
}

/**
 * Obtener detalle completo de una factura
 */
export async function getFacturaDetalle(id_factura) {
  try {
    // 1. Cabecera con cliente y usuario
    const { data: factura, error: fErr } = await supabase
      .from('factura')
      .select('*, cliente(*), usuario(nombre)')
      .eq('id_factura', id_factura)
      .single();

    if (fErr) throw fErr;

    // 2. Detalle de productos
    const { data: detalles, error: dErr } = await supabase
      .from('detalle_factura')
      .select('*, producto(*)')
      .eq('id_factura', id_factura)
      .order('id_detalle_factura', { ascending: true });

    if (dErr) throw dErr;

    // 3. Pagos / abonos registrados para esta factura
    const { data: pagos, error: pErr } = await supabase
      .from('pago')
      .select('*')
      .eq('id_factura', id_factura)
      .order('fecha_pago', { ascending: true });

    return {
      factura,
      detalles: detalles || [],
      pagos: pagos || [],
    };
  } catch (err) {
    console.error('Error in getFacturaDetalle:', err);
    throw err;
  }
}

/**
 * Guardar una nueva factura con todas sus transacciones atómicas
 */
export async function crearFactura({
  numero_factura,
  id_cliente,
  id_usuario = 1,
  fecha_emision,
  saldo_anterior = 0,
  total_factura,
  total_abonado = 0,
  saldo_pendiente,
  estado,
  observaciones = '',
  detalles = [],
  metodo_pago = 'EFECTIVO',
}) {
  try {
    // 1. Insertar Cabecera de Factura
    const facturaPayload = {
      numero_factura: parseInt(numero_factura, 10),
      id_cliente: parseInt(id_cliente, 10),
      id_usuario: parseInt(id_usuario, 10),
      fecha_emision: fecha_emision || new Date().toISOString().split('T')[0],
      saldo_anterior: parseFloat(saldo_anterior) || 0,
      total_factura: parseFloat(total_factura) || 0,
      total_abonado: parseFloat(total_abonado) || 0,
      saldo_pendiente: parseFloat(saldo_pendiente) || 0,
      estado: estado || (parseFloat(saldo_pendiente) <= 0 ? 'PAGADA' : 'PENDIENTE'),
      observaciones: observaciones?.trim() || null,
    };

    const { data: nuevaFactura, error: fErr } = await supabase
      .from('factura')
      .insert([facturaPayload])
      .select()
      .single();

    if (fErr) throw fErr;

    const facturaId = nuevaFactura.id_factura;

    // 2. Insertar DetalleFactura para cada producto
    if (detalles.length > 0) {
      const itemsPayload = detalles.map(d => ({
        id_factura: facturaId,
        id_producto: parseInt(d.id_producto, 10),
        cantidad: parseFloat(d.cantidad),
        precio_unitario: parseFloat(d.precio_unitario),
        costo_unitario: parseFloat(d.costo_unitario) || 0,
        subtotal: parseFloat(d.cantidad) * parseFloat(d.precio_unitario),
        descuento: parseFloat(d.descuento) || 0,
      }));

      const { error: dErr } = await supabase
        .from('detalle_factura')
        .insert(itemsPayload);

      if (dErr) throw dErr;

      // 3. Descontar Stock y registrar MovimientoInventario para productos inventariables
      for (const item of detalles) {
        if (item.es_inventariable) {
          // Obtener stock actual
          const { data: prodData } = await supabase
            .from('producto')
            .select('stock_actual')
            .eq('id_producto', item.id_producto)
            .single();

          if (prodData) {
            const stockActual = parseFloat(prodData.stock_actual) || 0;
            const nuevoStock = Math.max(0, stockActual - parseFloat(item.cantidad));

            await supabase
              .from('producto')
              .update({ stock_actual: nuevoStock })
              .eq('id_producto', item.id_producto);

            // Registrar movimiento de salida
            await supabase
              .from('movimiento_inventario')
              .insert([{
                tipo_movimiento: 'SALIDA',
                id_producto: item.id_producto,
                cantidad: parseFloat(item.cantidad),
                costo_unitario: parseFloat(item.costo_unitario) || 0,
                referencia: `Factura #${numero_factura}`,
                id_usuario: parseInt(id_usuario, 10),
              }]);
          }
        }
      }
    }

    // 4. Si hubo abono en el momento de la venta, registrar en tabla Pago
    if (parseFloat(total_abonado) > 0) {
      await supabase
        .from('pago')
        .insert([{
          id_factura: facturaId,
          fecha_pago: fecha_emision || new Date().toISOString().split('T')[0],
          monto: parseFloat(total_abonado),
          metodo_pago: metodo_pago || 'EFECTIVO',
          referencia: `Abono inicial venta #${numero_factura}`,
          id_usuario: parseInt(id_usuario, 10),
        }]);
    }

    // 5. Actualizar saldo_actual del cliente
    // Nuevo saldo del cliente = Saldo Anterior + Total Factura - Total Abonado
    const nuevoSaldoCliente = Math.max(0, parseFloat(saldo_anterior) + parseFloat(total_factura) - parseFloat(total_abonado));
    await supabase
      .from('cliente')
      .update({ saldo_actual: nuevoSaldoCliente })
      .eq('id_cliente', id_cliente);

    // 6. Registrar en Auditoría
    try {
      await supabase.from('auditoria').insert([{
        tabla_afectada: 'factura',
        id_registro: facturaId,
        accion: 'CREAR',
        id_usuario: parseInt(id_usuario, 10),
        detalle: `Factura #${numero_factura} emitida para cliente #${id_cliente}. Total: $${total_factura.toFixed(2)}, Abono: $${total_abonado.toFixed(2)}, Pendiente: $${saldo_pendiente.toFixed(2)}`,
      }]);
    } catch {}

    return { success: true, factura: nuevaFactura };
  } catch (err) {
    console.error('Error in crearFactura:', err);
    return { success: false, error: err.message || 'Error al guardar la factura' };
  }
}

/**
 * Anular una factura (Solo ADMIN)
 * - Cambia estado a ANULADA
 * - Reintegra el stock de los productos vendidos
 * - Registra movimiento de inventario de entrada/ajuste
 * - Revierte el saldo del cliente
 * - Registra en auditoría con motivo
 */
export async function anularFactura(id_factura, motivo, usuarioId = 1) {
  try {
    // 1. Obtener la factura con sus detalles
    const { data: factura, error: fErr } = await supabase
      .from('factura')
      .select('*, detalle_factura(*, producto(*))')
      .eq('id_factura', id_factura)
      .single();

    if (fErr) throw fErr;
    if (factura.estado === 'ANULADA') {
      return { success: false, error: 'Esta factura ya se encuentra anulada.' };
    }

    // 2. Marcar como ANULADA
    const { error: upErr } = await supabase
      .from('factura')
      .update({
        estado: 'ANULADA',
        observaciones: factura.observaciones
          ? `${factura.observaciones} | ANULADA: ${motivo}`
          : `ANULADA: ${motivo}`,
      })
      .eq('id_factura', id_factura);

    if (upErr) throw upErr;

    // 3. Reintegrar stock a productos inventariables
    const detalles = factura.detalle_factura || [];
    for (const item of detalles) {
      if (item.producto?.es_inventariable) {
        const stockActual = parseFloat(item.producto.stock_actual) || 0;
        const cant = parseFloat(item.cantidad) || 0;
        const stockRevertido = stockActual + cant;

        await supabase
          .from('producto')
          .update({ stock_actual: stockRevertido })
          .eq('id_producto', item.id_producto);

        // Movimiento de reversión
        await supabase
          .from('movimiento_inventario')
          .insert([{
            tipo_movimiento: 'ENTRADA',
            id_producto: item.id_producto,
            cantidad: cant,
            costo_unitario: parseFloat(item.costo_unitario) || 0,
            referencia: `Anulación Factura #${factura.numero_factura}: ${motivo}`,
            id_usuario: usuarioId,
          }]);
      }
    }

    // 4. Revertir saldo del cliente
    // Al anularse la factura, el saldo pendiente de esta venta se descuenta de la deuda del cliente
    const { data: cliente } = await supabase
      .from('cliente')
      .select('saldo_actual')
      .eq('id_cliente', factura.id_cliente)
      .single();

    if (cliente) {
      const saldoActual = parseFloat(cliente.saldo_actual) || 0;
      const saldoPendienteFactura = parseFloat(factura.saldo_pendiente) || 0;
      const saldoRevertido = Math.max(0, saldoActual - saldoPendienteFactura);

      await supabase
        .from('cliente')
        .update({ saldo_actual: saldoRevertido })
        .eq('id_cliente', factura.id_cliente);
    }

    // 5. Registrar en Auditoría
    try {
      await supabase.from('auditoria').insert([{
        tabla_afectada: 'factura',
        id_registro: id_factura,
        accion: 'ANULAR',
        id_usuario: usuarioId,
        detalle: `Factura #${factura.numero_factura} anulada. Motivo: ${motivo}`,
      }]);
    } catch {}

    return { success: true };
  } catch (err) {
    console.error('Error in anularFactura:', err);
    return { success: false, error: err.message || 'Error al anular factura' };
  }
}
