import { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'sonner';
import { Id } from '../../convex/_generated/dataModel';

interface InvoiceEditorProps {
  invoiceId: string;
  onBack: () => void;
}

interface InvoiceItem {
  serviceId: Id<'services'>;
  label: string;
  quantity: number;
  price: number;
  discount?: number; // discount value
  discountUnit?: string; // "%" or "€"
  discountText?: string; // description of the discount
  total: number;
}

export function InvoiceEditor({ invoiceId, onBack }: InvoiceEditorProps) {
  const isNew = invoiceId === 'new';
  const invoice = useQuery(api.invoices.getInvoiceById, isNew ? 'skip' : { id: invoiceId as Id<'invoices'> });
  const clients = useQuery(api.invoices.getClients) || [];
  const services = useQuery(api.invoices.getServices) || [];

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

  const addItem = () => {
    if (services.length === 0) {
      toast.error("Veuillez d'abord ajouter des services");
      return;
    }

    // Find the first service that isn't already used in other items
    const availableService = services.find(service => !items.some(item => item.serviceId === service._id));

    if (!availableService) {
      toast.error('Tous les services ont déjà été ajoutés');
      return;
    }

    setItems([
      ...items,
      {
        serviceId: availableService._id,
        label: availableService.label,
        quantity: 1,
        price: availableService.defaultPrice,
        discount: 0,
        discountUnit: '%',
        total: availableService.defaultPrice,
      },
    ]);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'serviceId') {
      const service = services.find(s => s._id === value);
      if (service) {
        newItems[index].label = service.label;
        newItems[index].price = service.defaultPrice;
      }
    }

    if (
      field === 'serviceId' ||
      field === 'quantity' ||
      field === 'price' ||
      field === 'discount' ||
      field === 'discountUnit'
    ) {
      const baseTotal = newItems[index].quantity * newItems[index].price;
      const discountValue = newItems[index].discount || 0;
      const discountUnit = newItems[index].discountUnit || '%';

      let discountAmount = 0;
      if (discountUnit === '%') {
        discountAmount = baseTotal * (discountValue / 100);
      } else {
        discountAmount = discountValue;
      }

      newItems[index].total = Math.max(0, baseTotal - discountAmount);
    }

    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

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

    try {
      if (isNew) {
        await createInvoice({
          clientId: selectedClientId,
          items,
        });
        toast.success('Facture créée!');
      } else {
        await updateInvoice({
          id: invoiceId as Id<'invoices'>,
          items,
        });
        toast.success('Facture mise à jour!');
      }
      onBack();
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
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold">
              {isNew ? 'Créer une facture' : `Modifier la facture N°${invoice?.invoiceNumber}`}
            </h2>
          </div>
        </div>

        <form onSubmit={e => void handleSubmit(e)} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value as Id<'clients'> | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-10"
              required
            >
              <option value="">Sélectionner un client</option>
              {clients.map(client => (
                <option key={client._id} value={client._id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Éléments de la facture</h3>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={addItem}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={items.length >= services.length}
                >
                  {items.length >= services.length ? 'Tous les services ajoutés' : 'Ajouter un élément'}
                </button>
              )}
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex flex-wrap gap-2 items-end mb-2">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
                      <select
                        value={item.serviceId || ''}
                        onChange={e => updateItem(index, 'serviceId', e.target.value as Id<'services'>)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-10"
                        disabled={isReadOnly}
                      >
                        {services
                          .filter(
                            service =>
                              service._id === item.serviceId ||
                              !items.some(
                                (otherItem, otherIndex) => otherIndex !== index && otherItem.serviceId === service._id,
                              ),
                          )
                          .map(service => (
                            <option key={service._id} value={service._id}>
                              {service.label}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="w-14">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Qté</label>
                      <input
                        type="number"
                        min="1"
                        max="9"
                        step="1"
                        value={item.quantity}
                        onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-10"
                        disabled={isReadOnly}
                      />
                    </div>

                    <div className="w-20">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Prix HT</label>
                      <div className="px-3 py-2">{formatCurrency(item.price)}</div>
                    </div>

                    <div className="w-36">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Remise</label>
                      <div className="flex">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          max="99.99"
                          value={item.discount || 0}
                          onChange={e => updateItem(index, 'discount', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-10"
                          disabled={isReadOnly}
                        />
                        <select
                          value={item.discountUnit || '%'}
                          onChange={e => updateItem(index, 'discountUnit', e.target.value)}
                          className="rounded-r-md border border-gray-300 p-2 border-l-0"
                          disabled={isReadOnly}
                        >
                          <option value="%">%</option>
                          <option value="€">€</option>
                        </select>
                      </div>
                    </div>

                    <div className="w-20">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total HT</label>
                      <div className="px-3 py-2">{formatCurrency(item.total)}</div>
                    </div>

                    {!isReadOnly && (
                      <div className="w-10">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="w-full bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 transition-colors"
                        >
                          X
                        </button>
                      </div>
                    )}
                  </div>

                  {(item.discount || 0) > 0 && (
                    <div className="mt-2 flex">
                      <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description remise</label>
                        <input
                          type="text"
                          value={item.discountText || ''}
                          onChange={e => updateItem(index, 'discountText', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Ex: Remise commerciale"
                          disabled={isReadOnly}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {items.length === 0 && (
              <p className="text-gray-500 text-center py-8">
                Aucun élément ajouté. Cliquez sur "Ajouter un élément" pour commencer.
              </p>
            )}
          </div>

          {items.length > 0 && (
            <div className="border-t pt-4">
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-lg font-semibold">Total HT: {formatCurrency(totalAmount)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              {isNew ? 'Créer la facture' : 'Mettre à jour la facture'}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400 transition-colors"
            >
              Retour
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
