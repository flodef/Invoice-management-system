import { IconFile, IconFileText, IconUpload, IconX } from '@tabler/icons-react';
import { useAction, useQuery } from 'convex/react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../convex/_generated/api';
import { Doc, Id } from '../../convex/_generated/dataModel';
import { formatCurrency } from '../utils/formatters';
import { InvoiceItem, InvoiceItemsManager } from './InvoiceItemsManager';

interface UploadInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (invoiceId: string) => void;
}

export function UploadInvoiceModal({ isOpen, onClose, onSuccess }: UploadInvoiceModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Get clients and services
  const clients = useQuery(api.invoices.getClients) || [];

  // Generate invoice number based on date
  const generateInvoiceNumber = useQuery(
    api.uploadInvoice.generateInvoiceNumber,
    invoiceDate ? { invoiceDate: new Date(invoiceDate).getTime() } : 'skip',
  );

  // Upload invoice action
  const storeUploadedInvoice = useAction(api.uploadInvoice.storeUploadedInvoice);

  // Initialize invoice number when date changes
  useEffect(() => {
    if (generateInvoiceNumber) {
      setInvoiceNumber(generateInvoiceNumber);
    }
  }, [generateInvoiceNumber]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFileSelected(droppedFile);
    }
  };

  const handleFileSelected = (selectedFile: File) => {
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

    setFile(selectedFile);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
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

    setIsSubmitting(true);
    toast.loading('Importation de la facture...');

    try {
      const invoiceDateObj = new Date(invoiceDate);

      const result = await storeUploadedInvoice({
        file,
        clientId: selectedClientId as Id<'clients'>,
        invoiceDate: invoiceDateObj.getTime(),
        invoiceNumber,
        items,
        totalAmount,
      });

      toast.dismiss();
      toast.success('Facture importée avec succès');

      if (result && result.invoiceId) {
        onSuccess(result.invoiceId);
      }
      onClose();
    } catch (error) {
      console.error('Error uploading invoice:', error);
      toast.dismiss();
      toast.error("Erreur lors de l'importation de la facture");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const getFileIcon = () => {
    if (!file) return null;

    return file.type === 'application/pdf' ? (
      <IconFile size={48} className="text-red-500" />
    ) : (
      <IconFileText size={48} className="text-blue-500" />
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">Importer une facture</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" disabled={isSubmitting}>
            <IconX size={24} />
          </button>
        </div>

        <form onSubmit={e => void handleSubmit(e)} className="p-6 space-y-6">
          {/* File upload area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            } ${file ? 'bg-gray-50' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="application/pdf,image/*"
              onChange={handleFileInputChange}
              disabled={isSubmitting}
            />

            {file ? (
              <div className="flex flex-col items-center">
                {getFileIcon()}
                <p className="mt-2 text-sm text-gray-600">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                <button
                  type="button"
                  className="mt-2 text-sm text-red-600 hover:text-red-800"
                  onClick={e => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  disabled={isSubmitting}
                >
                  Supprimer
                </button>
              </div>
            ) : (
              <>
                <IconUpload size={48} className="text-gray-400" />
                <p className="mt-2 text-lg font-medium text-gray-900">
                  Déposer un fichier ici ou cliquer pour sélectionner
                </p>
                <p className="mt-1 text-sm text-gray-500">PDF uniquement (jusqu'à 1MB)</p>
              </>
            )}
          </div>

          {/* Client selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-white h-10 p-2"
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              required
              disabled={isSubmitting}
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

          {/* Invoice date and number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de facture</label>
              <div className="relative">
                <input
                  type="date"
                  className="w-full rounded-md border border-gray-300 bg-white h-10 p-2"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de facture</label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-300 bg-gray-200 h-10 p-2"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                required
                readOnly
                disabled={isSubmitting}
              />
            </div>
          </div>

          <InvoiceItemsManager items={items} setItems={setItems} isReadOnly={isSubmitting} />

          {/* Total amount */}
          <div className="flex justify-end items-center">
            <span className="text-lg font-medium mr-4">Total:</span>
            <span className="text-xl font-bold">{formatCurrency(totalAmount)}</span>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              disabled={isSubmitting || !file || !selectedClientId || items.length === 0}
            >
              {isSubmitting ? 'Importation...' : 'Importer la facture'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
