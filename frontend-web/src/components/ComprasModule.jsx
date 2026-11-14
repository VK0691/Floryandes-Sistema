import React, { useState } from 'react';
import { List, PlusCircle, Truck } from 'lucide-react';
import ComprasList from './ComprasList';
import NuevaCompra from './NuevaCompra';

export default function ComprasModule() {
  const [activeSubTab, setActiveSubTab] = useState('lista');

  return (
    <div style={styles.container} className="fade-in">
      {/* Subtab Navigation Bar */}
      <div style={styles.subtabBar}>
        <button
          type="button"
          onClick={() => setActiveSubTab('lista')}
          style={{
            ...styles.subtabBtn,
            ...(activeSubTab === 'lista' ? styles.subtabBtnActive : {}),
          }}
        >
          <List size={15} />
          <span>Historial de Compras</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('nueva')}
          style={{
            ...styles.subtabBtn,
            ...(activeSubTab === 'nueva' ? styles.subtabBtnActive : {}),
          }}
        >
          <PlusCircle size={15} />
          <span>Nueva Compra</span>
        </button>
      </div>

      {/* Render active subtab */}
      {activeSubTab === 'lista' ? (
        <ComprasList onNuevaCompra={() => setActiveSubTab('nueva')} />
      ) : (
        <NuevaCompra
          onVolver={() => setActiveSubTab('lista')}
          onCompraGuardada={() => setActiveSubTab('lista')}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    maxWidth: '1280px',
    margin: '0 auto',
  },
  subtabBar: {
    display: 'inline-flex',
    backgroundColor: '#FFFFFF',
    padding: '4px',
    borderRadius: '10px',
    border: '1px solid #E2E8F0',
    width: 'fit-content',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
  },
  subtabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#64748B',
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  subtabBtnActive: {
    backgroundColor: '#1E4E79',
    color: '#FFFFFF',
    fontWeight: '700',
  },
};

