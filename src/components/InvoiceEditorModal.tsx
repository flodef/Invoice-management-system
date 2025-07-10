import React from 'react';
import { InvoiceEditor } from './InvoiceEditor';
import { Id } from '../../convex/_generated/dataModel';
import { IconX } from '@tabler/icons-react';

type InvoiceIdOrNew = Id<'invoices'> | 'new';

interface InvoiceEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: InvoiceIdOrNew;
}

export function InvoiceEditorModal({ isOpen, onClose, invoiceId }: InvoiceEditorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b">
          <h2 className="text-2xl font-bold">{invoiceId === 'new' ? 'Créer une facture' : 'Modifier la facture'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <IconX size={20} stroke={1.5} />
          </button>
        </div>
        <div className="p-4 sm:p-6">
          <InvoiceEditor invoiceId={invoiceId} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
