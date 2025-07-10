import { IconUpload, IconX } from '@tabler/icons-react';
import { useAction, useMutation, useQuery } from 'convex/react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../convex/_generated/api';
import { Doc, Id } from '../../convex/_generated/dataModel';
import { formatCurrency } from '../utils/formatters';
import { CustomDateInput } from './CustomDateInput';
import { InvoiceItem, InvoiceItemsManager } from './InvoiceItemsManager';
import { validateInvoiceItems } from '@/lib/utils';

interface UploadInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (invoiceId: string) => void;
}

// Simple fuzzy matching function
const fuzzyMatch = (term: string, clients: Doc<'clients'>[]) => {
  const lowerTerm = term.toLowerCase().replace(/[-_]/g, ' ');
  let bestMatch = null;
  let maxScore = 0;

  for (const client of clients) {
    const clientName = client.name.toLowerCase();
    const score = lowerTerm.split(' ').reduce((acc, word) => {
      return acc + (clientName.includes(word) ? word.length : 0);
    }, 0);

    if (score > maxScore) {
      maxScore = score;
      bestMatch = client;
    }
  }

  return bestMatch;
};

export function UploadInvoiceModal({ isOpen, onClose, onSuccess }: UploadInvoiceModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Get clients and services
  const clients = useQuery(api.clients.getClients) || [];
  const checkInvoiceExists = useMutation(api.invoices.checkInvoiceExists);

  // Upload invoice action
  const storeUploadedInvoice = useAction(api.uploadInvoice.storeUploadedInvoice);
  const generateUploadUrl = useMutation(api.uploadInvoice.generateUploadUrl);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);

      return () => {
        URL.revokeObjectURL(url);
        setFileUrl(null);
      };
    }
  }, [file]);

  const handleFileSelected = async (selectedFile: File) => {
    // Check file type - accept PDF or images
    if (!(selectedFile.type === 'application/pdf')) {
      toast.error('Seulement les fichiers PDF sont acceptés');
      return;
    }

    // Check file size (max 5MB)
    if (selectedFile.size > 1 * 1024 * 1024) {
      toast.error('La taille du fichier doit être inférieure à 1MB');
      return;
    }

    // Parse filename
    const filename = selectedFile.name.replace(/\.pdf$/, '');
    const match = filename.match(/^Facture-(\d{8})-(.+)$/);

    if (!match) {
      toast.error('Nom de fichier invalide. Le format doit être: Facture-YYYYMMDD-Client_Name.pdf');
      return;
    }

    const [, invoiceNum, clientName] = match;

    try {
      await checkInvoiceExists({ invoiceNumber: invoiceNum });
    } catch (error) {
      if (error instanceof Error && error.message.includes('DUPLICATE_INVOICE')) {
        toast.error(`Une facture avec le numéro ${invoiceNum} existe déjà.`);
      } else {
        toast.error('An unexpected error occurred.');
      }
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Find client by fuzzy matching
    const matchedClient = fuzzyMatch(clientName, clients);
    if (!matchedClient) {
      toast.error(`Client non trouvé pour: ${clientName}`);
      return;
    }

    const year = parseInt(invoiceNum.substring(0, 4), 10);
    const month = parseInt(invoiceNum.substring(4, 6), 10);

    // Set invoice date to the 1st of the month, using UTC to avoid timezone issues
    const date = new Date(Date.UTC(year, month - 1, 1));
    setInvoiceDate(date.toISOString().split('T')[0]);

    setInvoiceNumber(invoiceNum);
    setSelectedClientId(matchedClient._id);
    setFile(selectedFile);
  };

  const resetInvoiceData = () => {
    setFile(null);
    setSelectedClientId('');
    setInvoiceDate('');
    setInvoiceNumber('');
    setItems([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Clear the file input as well
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      toast.error('Veuillez sélectionner un fichier');
      return;
    }

    if (!selectedClientId) {
      toast.error('Veuillez sélectionner un client');
      return;
    }

    if (items.length === 0) {
      toast.error('Veuillez ajouter au moins un article');
      return;
    }

    // Validate invoice items before saving
    if (!validateInvoiceItems(items)) {
      return; // Validation failed, error message already shown by validateInvoiceItems
    }

    setIsSubmitting(true);
    const loadingToastId = toast.loading('Importation de la facture...');

    try {
      const invoiceDateObj = new Date(invoiceDate);

      // Request an upload URL from Convex
      const postUrl = await generateUploadUrl();

      // Upload the file to the URL
      const response = await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error(`File upload failed: ${response.statusText}`);
      }

      const { storageId } = await response.json();

      const result = await storeUploadedInvoice({
        file: storageId, // Pass the storageId instead of the raw file
        invoiceData: {
          clientId: selectedClientId as Id<'clients'>,
          invoiceDate: invoiceDateObj.getTime(),
          invoiceNumber,
          items,
          totalAmount,
        },
      });

      toast.dismiss(loadingToastId);
      toast.success('Facture importée avec succès');

      if (result && result.invoiceId) {
        onSuccess(result.invoiceId);
      }
      resetInvoiceData();
      onClose();
    } catch (error) {
      console.error('Error uploading invoice:', error);
      toast.dismiss(loadingToastId);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Erreur lors de l'importation de la facture");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b">
          <h2 className="text-2xl font-bold">Importer une facture</h2>
          <button
            onClick={() => {
              resetInvoiceData();
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700"
            disabled={isSubmitting}
          >
            <IconX size={24} />
          </button>
        </div>

        <form onSubmit={e => void handleSubmit(e)} className="p-6 space-y-6">
          {file && fileUrl ? (
            <div>
              <embed src={fileUrl} type="application/pdf" width="100%" height="500px" />
              <button
                type="button"
                className="mt-2 text-sm text-red-600 hover:text-red-800"
                onClick={() => {
                  resetInvoiceData();
                }}
                disabled={isSubmitting}
              >
                Supprimer
              </button>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-lg p-4 sm:p-6 flex flex-col items-center justify-center cursor-pointer ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
              onDragOver={e => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  void handleFileSelected(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="application/pdf"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    void handleFileSelected(e.target.files[0]);
                  }
                }}
                disabled={isSubmitting}
              />
              <IconUpload size={48} className="text-gray-400" />
              <p className="mt-2 text-lg font-medium text-gray-900">
                Déposer un fichier ici ou cliquer pour sélectionner
              </p>
              <p className="mt-1 text-sm text-gray-500">PDF uniquement (jusqu'à 1MB)</p>
            </div>
          )}

          {file && (
            <>
              <div className="flex flex-wrap items-end gap-4">
                {/* Client selection */}
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                  <select
                    className="w-full rounded-md border border-gray-300 bg-gray-200 h-10 p-2"
                    value={selectedClientId}
                    onChange={e => setSelectedClientId(e.target.value)}
                    required
                    disabled
                  >
                    <option value="">Sélectionner un client</option>
                    {clients
                      .sort((a: Doc<'clients'>, b: Doc<'clients'>) => a.name.localeCompare(b.name))
                      .map((client: Doc<'clients'>) => (
                        <option key={client._id} value={client._id}>
                          {client.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Invoice number */}
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de facture</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 bg-gray-200 h-10 p-2"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    required
                    readOnly
                  />
                </div>

                {/* Invoice and Payment Dates */}
                <div className="flex-1 min-w-[250px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de facture → Échéance</label>
                  <div className="flex items-center">
                    <CustomDateInput value={invoiceDate} onChange={setInvoiceDate} disabled={isSubmitting} />
                    <span className="mx-2">→</span>
                    <CustomDateInput
                      value={(() => {
                        if (!invoiceDate) return '';
                        const date = new Date(invoiceDate);
                        date.setUTCMonth(date.getUTCMonth() + 1);
                        return date.toISOString().split('T')[0];
                      })()}
                      onChange={() => {}}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              <InvoiceItemsManager items={items} setItems={setItems} isReadOnly={isSubmitting} />

              {/* Total amount */}
              <div className="flex justify-end items-center">
                <span className="text-lg font-medium mr-4">Total:</span>
                <span className="text-xl font-bold">{formatCurrency(totalAmount)}</span>
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              onClick={() => {
                resetInvoiceData();
                onClose();
              }}
              disabled={isSubmitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Importation...' : 'Importer la facture'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
