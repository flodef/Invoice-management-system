import { useState, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ProfileSettings } from './ProfileSettings';
import { ClientManager } from './ClientManager';
import { ServiceManager } from './ServiceManager';
import { InvoiceList } from './InvoiceList';
import { InvoiceEditor } from './InvoiceEditor';
import { StatisticsPage } from './StatisticsPage';

import { Id } from '../../convex/_generated/dataModel';

type InvoiceIdOrNew = Id<'invoices'> | 'new';

type Tab = 'invoices' | 'clients' | 'services' | 'profile' | 'statistics';

export function InvoiceManager() {
  const [activeTab, setActiveTab] = useState<Tab>('invoices');
  const [editingInvoiceId, setEditingInvoiceId] = useState<InvoiceIdOrNew | null>(null);

  const userProfile = useQuery(api.userProfile.getUserProfile);

  const handleEditInvoice = useCallback((id: InvoiceIdOrNew) => {
    setEditingInvoiceId(id);
  }, []);

  const tabs = [
    { id: 'invoices' as const, label: 'Factures', icon: '📄' },
    { id: 'statistics' as const, label: 'Statistiques', icon: '📊' },
    { id: 'clients' as const, label: 'Clients', icon: '👥' },
    { id: 'services' as const, label: 'Services', icon: '🛠️' },
    { id: 'profile' as const, label: 'Profil', icon: '⚙️' },
  ];

  // Show profile setup if not configured
  if (!userProfile) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
          <h2 className="text-2xl font-bold mb-4">Bienvenue! Configurons votre profil</h2>
          <p className="text-gray-600 mb-6">
            Veuillez configurer vos informations professionnelles pour commencer à créer des factures.
          </p>
          <ProfileSettings />
        </div>
      </div>
    );
  }

  if (editingInvoiceId) {
    return <InvoiceEditor invoiceId={editingInvoiceId} onClose={() => setEditingInvoiceId(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="flex overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-1 sm:gap-2 px-2 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              title={tab.label}
            >
              <span className="text-center">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border">
        {activeTab === 'invoices' && <InvoiceList onEditInvoice={handleEditInvoice} />}
        {activeTab === 'statistics' && <StatisticsPage />}
        {activeTab === 'clients' && <ClientManager />}
        {activeTab === 'services' && <ServiceManager />}
        {activeTab === 'profile' && <ProfileSettings />}
      </div>
    </div>
  );
}
