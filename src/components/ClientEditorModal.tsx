import { IconX } from '@tabler/icons-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'sonner';
import { Id } from '../../convex/_generated/dataModel';
import { AddressFields } from './AddressFields';
import { formatStructuredAddress, parseStructuredAddress } from '../utils/address';
import { filterSiren, filterTvaNumber, sirenRegex, tvaNumberRegex } from '../utils/validators';

interface ClientEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: {
    _id: Id<'clients'>;
    name: string;
    contactName?: string;
    address: string;
    email: string;
    legalForm?: string;
    siren?: string;
    tvaNumber?: string;
    isActive?: boolean;
  } | null;
}

export function ClientEditorModal({ isOpen, onClose, client }: ClientEditorModalProps) {
  const saveClient = useMutation(api.clients.saveClient);

  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    address: '',
    postalCode: '',
    city: '',
    email: '',
    legalForm: 'SARL',
    siren: '',
    tvaNumber: '',
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetFormData = useCallback(() => {
    const parsed = parseStructuredAddress(client?.address ?? '');
    setFormData({
      name: client?.name ?? '',
      contactName: client?.contactName || '',
      address: parsed.street,
      postalCode: parsed.postalCode,
      city: parsed.city,
      email: client?.email ?? '',
      legalForm: client?.legalForm || 'SARL',
      siren: client?.siren || '',
      tvaNumber: client?.tvaNumber || '',
      isActive: client?.isActive ?? true,
    });
  }, [client]);

  useEffect(() => {
    resetFormData();
  }, [resetFormData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.siren && !sirenRegex.test(formData.siren)) {
      toast.error('SIREN invalide — 9 chiffres attendus');
      return;
    }
    if (formData.tvaNumber && !tvaNumberRegex.test(formData.tvaNumber)) {
      toast.error('N° TVA intracommunautaire invalide — format FR + 11 caractères');
      return;
    }
    setIsSubmitting(true);
    try {
      const { postalCode, city, ...rest } = formData;
      await saveClient({
        id: client?._id || undefined,
        ...rest,
        address: formatStructuredAddress({ street: formData.address, postalCode, city }),
      });
      toast.success(client ? 'Client mis à jour!' : 'Client ajouté!');
      resetFormData();
      onClose();
    } catch (error) {
      console.error('Client save error:', error);
      toast.error("Échec de l'enregistrement du client");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b">
          <h2 className="text-2xl font-bold">{client ? 'Modifier le client' : 'Ajouter un nouveau client'}</h2>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entreprise</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du contact</label>
              <input
                type="text"
                value={formData.contactName}
                onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Prénom"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>
          <AddressFields
            street={formData.address}
            postalCode={formData.postalCode}
            city={formData.city}
            onStreet={v => setFormData({ ...formData, address: v })}
            onPostalCode={v => setFormData({ ...formData, postalCode: v })}
            onCity={v => setFormData({ ...formData, city: v })}
            streetLabel="Rue"
            required
            disabled={isSubmitting}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Forme juridique</label>
              <select
                value={formData.legalForm}
                onChange={e => setFormData({ ...formData, legalForm: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-10"
                disabled={isSubmitting}
              >
                <option value="SARL">SARL</option>
                <option value="EURL">EURL</option>
                <option value="SASU">SASU</option>
                <option value="SAS">SAS</option>
                <option value="EI">Entrepreneur individuel</option>
                <option value="Micro-entrepreneur">Micro-entrepreneur</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SIREN</label>
              <input
                type="text"
                value={formData.siren}
                onChange={e => setFormData({ ...formData, siren: filterSiren(e.target.value) })}
                placeholder="9 chiffres"
                inputMode="numeric"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  formData.siren && !sirenRegex.test(formData.siren) ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={isSubmitting}
              />
              {formData.siren && !sirenRegex.test(formData.siren) && (
                <p className="text-red-600 text-xs mt-1">9 chiffres attendus</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N° TVA intracommunautaire</label>
              <input
                type="text"
                value={formData.tvaNumber}
                onChange={e => setFormData({ ...formData, tvaNumber: filterTvaNumber(e.target.value) })}
                placeholder="FR00123456789"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  formData.tvaNumber && !tvaNumberRegex.test(formData.tvaNumber) ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={isSubmitting}
              />
              {formData.tvaNumber && !tvaNumberRegex.test(formData.tvaNumber) && (
                <p className="text-red-600 text-xs mt-1">Format FR + 11 caractères</p>
              )}
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
              {client ? 'Mettre à jour' : 'Ajouter'} le client
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
