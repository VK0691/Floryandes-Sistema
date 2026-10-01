import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Ban,
  Calendar,
  User,
  CreditCard,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { getFacturaDetalle, anularFactura } from '../services/facturasService';
import { useAuth, ROLES } from '../context/AuthContext';

export default function FacturaDetalleModal({ facturaId, isOpen, onClose, onFacturaActualizada }) {
  const { currentRole, currentUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cancellation modal state
  const [showAnularModal, setShowAnularModal] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [anulando, setAnulando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    if (!facturaId) return;
    setLoading(true);
    try {
      const res = await getFacturaDetalle(facturaId);
      setData(res);
    } catch (err) {
      console.error('Error loading factura detalle:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setShowAnularModal(false);
      setMotivoAnulacion('');
      setErrorMsg('');
    }
  }, [facturaId, isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleAnular = async (e) => {
    e.preventDefault();
    if (!motivoAnulacion.trim()) {
      setErrorMsg('Debe ingresar el motivo de anulación.');
      return;
    }

    setAnulando(true);
    setErrorMsg('');
    try {
      const res = await anularFactura(facturaId, motivoAnulacion.trim(), currentUser?.id || 1);
      if (res.success) {
        setShowAnularModal(false);
        await loadData();
        if (onFacturaActualizada) onFacturaActualizada();
      } else {
        setErrorMsg(res.error);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error al anular factura');
    } finally {
      setAnulando(false);
    }
  };

  const f = data?.factura;
  const isAnulada = f?.estado === 'ANULADA';
  const isPagada = f?.estado === 'PAGADA';
  const isAdmin = currentRole === ROLES.ADMIN;

  const utilidadTotal = data?.detalles?.reduce(
    (acc, d) => acc + (Number(d.cantidad) * (Number(d.precio_unitario) - Number(d.costo_unitario))),
    0
  ) || 0;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <FileText size={20} color="#1E4E79" />
            <div>
              <div style={styles.titleRow}>
                <h3 style={styles.title}>
                  Factura #{loading ? '...' : f?.numero_factura}
                </h3>
                {f && (
                  <span
                    style={{
                      ...styles.statusTag,
                      backgroundColor: isAnulada
                        ? '#FEF2F2'
                        : isPagada
                        ? '#ECFDF5'
                        : '#FFFBEB',
                      color: isAnulada
                        ? '#DC2626'
                        : isPagada
                        ? '#059669'
                        : '#D97706',
                    }}
                  >
                    {f.estado}
                  </span>
                )}
              </div>
              <span style={styles.subtitle}>
                Emisión: {f?.fecha_emision} • Registrado por: {f?.usuario?.nombre || 'Usuario'}
              </span>
            </div>
          </div>

          <div style={styles.headerActions}>
            <button
              onClick={handlePrint}
              style={styles.printBtn}
              title="Imprimir comprobante"
            >
              <Printer size={15} />
              <span>Imprimir</span>
            </button>

            {isAdmin && !isAnulada && (
              <button
                onClick={() => setShowAnularModal(true)}
                style={styles.anularBtn}
                title="Anular venta y reintegrar existencias"
              >
                <Ban size={15} />
                <span>Anular Factura</span>
              </button>
            )}

            <button onClick={onClose} style={styles.closeBtn} title="Cerrar ventana">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={styles.body}>
          {loading ? (
            <div style={styles.loadingBox}>
              <div style={styles.spinner}></div>
              <span>Cargando detalle de la factura...</span>
            </div>
          ) : f ? (
            <>
              {/* Client Info Banner */}
              <div style={styles.clientBox}>
                <div style={styles.clientBoxLeft}>
                  <User size={18} color="#1E4E79" />
                  <div>
                    <strong style={styles.clientName}>{f.cliente?.nombre}</strong>
                    <div style={styles.clientSub}>
                      RUC/Cédula: <span className="num-mono">{f.cliente?.ruc || 'Consumidor Final'}</span> • Teléfono: <span className="num-mono">{f.cliente?.telefono || 'No registrado'}</span>
                    </div>
                  </div>
                </div>
                <div style={styles.clientBoxRight}>
                  <span style={styles.clientTypeTag}>{f.cliente?.tipo_cliente || 'Minorista'}</span>
                </div>
              </div>

              {/* Items Table */}
              <div style={styles.tableCard}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.trHead}>
                      <th style={styles.th}>CANT.</th>
                      <th style={styles.th}>PRODUCTO</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>PRECIO U.</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>COSTO U.</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>SUBTOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.detalles.map((d) => (
                      <tr key={d.id_detalle_factura} style={styles.tr}>
                        <td style={styles.tdQty} className="num-mono">{d.cantidad}</td>
                        <td style={styles.tdProd}>
                          <strong>[{d.producto?.codigo}]</strong> {d.producto?.nombre}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }} className="num-mono">
                          ${Number(d.precio_unitario).toFixed(2)}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }} className="num-mono">
                          ${Number(d.costo_unitario || 0).toFixed(2)}
                        </td>
                        <td style={{ ...styles.tdSubtotal, textAlign: 'right' }} className="num-mono">
                          ${Number(d.subtotal).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div style={styles.summaryGrid}>
                <div style={styles.summaryLeft}>
                  {f.observaciones && (
                    <div style={styles.obsBox}>
                      <span style={styles.obsLabel}>Observaciones:</span>
                      <p style={styles.obsText}>{f.observaciones}</p>
                    </div>
                  )}

                  {/* Profit indicator for admin */}
                  {isAdmin && (
                    <div style={styles.marginCard}>
                      <span style={styles.marginLabel}>Utilidad Neta de la Venta:</span>
                      <span style={styles.marginVal} className="num-mono">
                        +${Math.max(0, utilidadTotal).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                <div style={styles.summaryRight}>
                  <div style={styles.sumRow}>
                    <span>Subtotal Factura:</span>
                    <strong className="num-mono">${Number(f.total_factura).toFixed(2)}</strong>
                  </div>
                  <div style={styles.sumRow}>
                    <span>Saldo Anterior del Cliente:</span>
                    <span className="num-mono">${Number(f.saldo_anterior).toFixed(2)}</span>
                  </div>
                  <div style={styles.sumRow}>
                    <span>Total a Pagar:</span>
                    <strong className="num-mono" style={{ color: '#1E4E79' }}>
                      ${(Number(f.total_factura) + Number(f.saldo_anterior)).toFixed(2)}
                    </strong>
                  </div>
                  <div style={styles.sumRow}>
                    <span>Total Abonado:</span>
                    <span className="num-mono" style={{ color: '#059669' }}>
                      -${Number(f.total_abonado).toFixed(2)}
                    </span>
                  </div>
                  <div style={styles.sumDivider}></div>
                  <div style={styles.sumRowTotal}>
                    <span>Saldo Pendiente:</span>
                    <strong
                      className="num-mono"
                      style={{
                        color: Number(f.saldo_pendiente) > 0 ? '#DC2626' : '#059669',
                      }}
                    >
                      ${Number(f.saldo_pendiente).toFixed(2)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Payment History Table */}
              <div style={styles.paymentsSection}>
                <span style={styles.paymentsTitle}>Historial de Pagos y Abonos</span>
                {data.pagos.length === 0 ? (
                  <span style={styles.noPayments}>No se registraron abonos en esta factura.</span>
                ) : (
                  <div style={styles.paymentsTableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr style={styles.trHead}>
                          <th style={styles.th}>FECHA</th>
                          <th style={styles.th}>MÉTODO</th>
                          <th style={styles.th}>REFERENCIA</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>MONTO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.pagos.map((p) => (
                          <tr key={p.id_pago} style={styles.tr}>
                            <td style={styles.td} className="num-mono">{p.fecha_pago}</td>
                            <td style={styles.td}>{p.metodo_pago}</td>
                            <td style={styles.td}>{p.referencia || '—'}</td>
                            <td style={{ ...styles.td, textAlign: 'right' }} className="num-mono">
                              <strong>${Number(p.monto).toFixed(2)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Cancellation Modal Overlay */}
        {showAnularModal && (
          <div style={styles.anularOverlay}>
            <div style={styles.anularCard}>
              <h4 style={styles.anularTitle}>Confirmar Anulación de Factura</h4>
              <p style={styles.anularDesc}>
                Esta acción marcará la factura #{f?.numero_factura} como <strong>ANULADA</strong>, reintegrará las cantidades al inventario físico de productos y revertirá el saldo pendiente del cliente.
              </p>

              {errorMsg && (
                <div style={styles.errorAlert}>
                  <AlertCircle size={15} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleAnular}>
                <div style={styles.anularField}>
                  <label style={styles.anularLabel}>Motivo de la anulación:</label>
                  <textarea
                    rows={3}
                    placeholder="Ej: Error en cantidad facturada / Cliente canceló el pedido"
                    value={motivoAnulacion}
                    onChange={(e) => setMotivoAnulacion(e.target.value)}
                    style={styles.anularTextarea}
                    autoFocus
                  />
                </div>

                <div style={styles.anularActions}>
                  <button
                    type="button"
                    disabled={anulando}
                    onClick={() => setShowAnularModal(false)}
                    style={styles.anularCancelBtn}
                  >
                    Regresar
                  </button>
                  <button
                    type="submit"
                    disabled={anulando}
                    style={styles.anularSubmitBtn}
                  >
                    {anulando ? 'Anulando...' : 'Confirmar Anulación'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '16px',
  },
  modal: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    width: '100%',
    maxWidth: '740px',
    overflow: 'hidden',
    animation: 'fadeIn 0.2s ease-out',
  },
  header: {
    padding: '18px 24px',
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    flexWrap: 'wrap',
    gap: '12px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  title: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#0F172A',
  },
  statusTag: {
    padding: '2px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: '12px',
    color: '#64748B',
    marginTop: '2px',
    display: 'block',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  printBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #CBD5E1',
    color: '#334155',
    padding: '7px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  anularBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#DC2626',
    padding: '7px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#94A3B8',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
  },
  body: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    maxHeight: '75vh',
    overflowY: 'auto',
  },
  clientBox: {
    backgroundColor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientBoxLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  clientName: {
    fontSize: '14px',
    color: '#0F172A',
    fontWeight: '700',
  },
  clientSub: {
    fontSize: '12px',
    color: '#64748B',
    marginTop: '2px',
  },
  clientTypeTag: {
    backgroundColor: '#EFF6FF',
    color: '#1E4E79',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '700',
  },
  tableCard: {
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  trHead: {
    backgroundColor: '#F8FAFC',
    borderBottom: '1px solid #E2E8F0',
  },
  th: {
    padding: '10px 14px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'left',
  },
  tr: {
    borderBottom: '1px solid #F1F5F9',
  },
  td: {
    padding: '10px 14px',
    fontSize: '12px',
    color: '#334155',
  },
  tdQty: {
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '700',
    color: '#0F172A',
  },
  tdProd: {
    padding: '10px 14px',
    fontSize: '13px',
    color: '#1E293B',
  },
  tdSubtotal: {
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '700',
    color: '#0F172A',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 280px',
    gap: '20px',
    alignItems: 'start',
  },
  summaryLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  obsBox: {
    backgroundColor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '10px 14px',
  },
  obsLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748B',
    display: 'block',
    marginBottom: '2px',
  },
  obsText: {
    fontSize: '12px',
    color: '#334155',
    lineHeight: '1.4',
  },
  marginCard: {
    backgroundColor: '#ECFDF5',
    border: '1px solid #A7F3D0',
    borderRadius: '8px',
    padding: '10px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marginLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#065F46',
  },
  marginVal: {
    fontSize: '14px',
    fontWeight: '800',
    color: '#059669',
  },
  summaryRight: {
    backgroundColor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sumRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#475569',
  },
  sumDivider: {
    height: '1px',
    backgroundColor: '#CBD5E1',
    margin: '4px 0',
  },
  sumRowTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    fontWeight: '800',
  },
  paymentsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingTop: '6px',
    borderTop: '1px solid #F1F5F9',
  },
  paymentsTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#1E293B',
  },
  noPayments: {
    fontSize: '12px',
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  paymentsTableWrap: {
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  loadingBox: {
    padding: '50px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    color: '#64748B',
    fontSize: '13px',
  },
  spinner: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '3px solid #E2E8F0',
    borderTopColor: '#E05A2B',
    animation: 'spin 0.8s linear infinite',
  },
  anularOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 10,
  },
  anularCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '460px',
    width: '100%',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  anularTitle: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#DC2626',
    marginBottom: '8px',
  },
  anularDesc: {
    fontSize: '13px',
    color: '#64748B',
    lineHeight: '1.5',
    marginBottom: '16px',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#FEF2F2',
    color: '#991B1B',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    marginBottom: '12px',
  },
  anularField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '16px',
  },
  anularLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#334155',
  },
  anularTextarea: {
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #CBD5E1',
    fontSize: '13px',
    outline: 'none',
  },
  anularActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  anularCancelBtn: {
    padding: '8px 14px',
    backgroundColor: '#F1F5F9',
    color: '#475569',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  anularSubmitBtn: {
    padding: '8px 16px',
    backgroundColor: '#DC2626',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  }
};
