import { IconX } from '@tabler/icons-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'sonner';
import { Id } from '../../convex/_generated/dataModel';

interface ServiceEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  service?: {
    _id: Id<'services'>;
    label: string;
    defaultPrice: number;
    isActive: boolean;
  } | null;
}

export function ServiceEditorModal({ isOpen, onClose, service }: ServiceEditorModalProps) {
  const saveService = useMutation(api.invoices.saveService);

  const [formData, setFormData] = useState({
    label: '',
    defaultPrice: 0,
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetFormData = useCallback(() => {
    if (service) {
      setFormData({
        label: service.label,
        defaultPrice: service.defaultPrice,
        isActive: service.isActive,
      });
    } else {
      setFormData({ label: '', defaultPrice: 0, isActive: true });
    }
  }, [service]);

  useEffect(() => {
    resetFormData();
  }, [resetFormData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      await saveService({
        id: service?._id || undefined,
        ...formData,
      });
      toast.success(service ? 'Service mis à jour!' : 'Service ajouté!');
      resetFormData();
      onClose();
    } catch {
      toast.error("Échec de l'enregistrement du service");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">{service ? 'Modifier le service' : 'Ajouter un nouveau service'}</h2>
          <button
            onClick={() => {
              resetFormData();
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700"
            disabled={isSubmitting}
          >
            <IconX size={24} />
          </button>
        </div>

        <form onSubmit={e => void handleSubmit(e)} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-10">
              <label className="block text-sm font-medium text-gray-700 mb-1">Libellé du service</label>
              <input
                type="text"
                value={formData.label}
                onChange={e => setFormData({ ...formData, label: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix HT</label>
              <input
                type="number"
                step="5"
                min="5"
                max="1000"
                maxLength={4}
                value={formData.defaultPrice}
                onFocus={e => e.target.select()}
                onChange={e => setFormData({ ...formData, defaultPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              onClick={() => {
                resetFormData();
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
              {service ? 'Mettre à jour' : 'Ajouter'} le service
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
