import { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'sonner';
import { Id } from '../../convex/_generated/dataModel';
import { InvoiceItem, InvoiceItemsManager } from './InvoiceItemsManager';
import { validateInvoiceItems } from '../lib/utils'; // Import the validation function

type InvoiceIdType = Id<'invoices'> | 'new';

interface InvoiceEditorProps {
  invoiceId: InvoiceIdType;
  onClose: () => void;
}

export function InvoiceEditor({ invoiceId, onClose }: InvoiceEditorProps) {
  const isNew = invoiceId === 'new';
  const invoice = useQuery(api.invoices.getInvoiceById, isNew ? 'skip' : { id: invoiceId });
  const clients = useQuery(api.clients.getClients) || [];

  const createInvoice = useMutation(api.invoices.createInvoice);
  const updateInvoice = useMutation(api.invoices.updateInvoice);

  const [selectedClientId, setSelectedClientId] = useState<Id<'clients'> | ''>('');
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Check if invoice is read-only (status is "sent")
  const isReadOnly = !isNew && invoice?.status === 'sent';

  useEffect(() => {
    if (!isNew && invoice) {
      setSelectedClientId(invoice.clientId);
      setItems(invoice.items);
    }
  }, [isNew, invoice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientId) {
      toast.error('Veuillez sélectionner un client');
      return;
    }

    if (items.length === 0) {
      toast.error('Veuillez ajouter au moins un élément');
      return;
    }

    // Validate invoice items before saving
    if (!validateInvoiceItems(items)) {
      return; // Validation failed, error message already shown by validateInvoiceItems
    }

    try {
      if (isNew) {
        await createInvoice({
          clientId: selectedClientId,
          items,
        });
        toast.success('Facture créée!');
      } else {
        await updateInvoice({
          id: invoiceId,
          clientId: selectedClientId,
          items,
        });
        toast.success('Facture mise à jour!');
      }
      onClose();
    } catch {
      toast.error("Échec de l'enregistrement de la facture");
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  if (!isNew && invoice === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <form onSubmit={e => void handleSubmit(e)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
        <select
          value={selectedClientId}
          onChange={e => setSelectedClientId(e.target.value as Id<'clients'> | '')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-10"
          required
        >
          <option value="">Sélectionner un client</option>
          {clients
            .filter(client => client.isActive) // Filter for active clients
            .map(client => (
              <option key={client._id} value={client._id}>
                {client.name}
              </option>
            ))}
        </select>
      </div>

      <InvoiceItemsManager items={items} setItems={setItems} isReadOnly={isReadOnly} />

      {items.length > 0 && (
        <div className="border-t pt-4">
          <div className="flex justify-end">
            <div className="text-right">
              <p className="text-lg font-semibold">Total HT: {formatCurrency(totalAmount)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 justify-end">
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          {isNew ? 'Créer la facture' : 'Mettre à jour la facture'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400 transition-colors"
        >
          Retour
        </button>
      </div>
    </form>
  );
}
