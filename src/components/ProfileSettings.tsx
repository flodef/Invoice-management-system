import { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'sonner';
import { AddressFields } from './AddressFields';
import { formatStructuredAddress, parseStructuredAddress } from '../utils/address';

export function ProfileSettings() {
  const userProfile = useQuery(api.userProfile.getUserProfile);
  const updateProfile = useMutation(api.userProfile.updateUserProfile);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    address: '',
    postalCode: '',
    city: '',
    freelanceId: '',
    iban: '',
    bic: '',
    bank: '',
    tel: '',
    apeCode: '',
    immatriculation: '',
    bankAddress: '',
  });

  useEffect(() => {
    if (userProfile) {
      const parsed = parseStructuredAddress(userProfile.address || '');
      setFormData({
        name: userProfile.name || '',
        email: userProfile.email || '',
        address: parsed.street,
        postalCode: parsed.postalCode,
        city: parsed.city,
        freelanceId: userProfile.freelanceId || '',
        iban: userProfile.iban || '',
        bic: userProfile.bic || '',
        bank: userProfile.bank || '',
        tel: userProfile.tel || '',
        apeCode: userProfile.apeCode || '',
        immatriculation: userProfile.immatriculation || '',
        bankAddress: userProfile.bankAddress || '',
      });
    }
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate SIRET is exactly 14 characters
    if (formData.freelanceId.length !== 14) {
      toast.error('Le numéro SIRET doit comporter exactement 14 caractères');
      return;
    }

    try {
      const { postalCode, city, ...rest } = formData;
      await updateProfile({
        ...rest,
        address: formatStructuredAddress({ street: formData.address, postalCode, city }),
      });
      toast.success('Profil mis à jour avec succès!');
    } catch {
      toast.error('Échec de la mise à jour du profil');
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6">Paramètres du profil</h2>

      <form onSubmit={e => void handleSubmit(e)} className="space-y-6">
        {/* Company name, SIRET & email on the same row */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Nom de l'entreprise / freelance</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="md:w-1/4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Numéro SIRET</label>
            <input
              type="text"
              value={formData.freelanceId}
              onChange={e => setFormData({ ...formData, freelanceId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="md:w-1/3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Email professionnel</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Adresse structurée : rue + code postal → commune (geo.api.gouv.fr) */}
        <AddressFields
          street={formData.address}
          postalCode={formData.postalCode}
          city={formData.city}
          onStreet={v => setFormData({ ...formData, address: v })}
          onPostalCode={v => setFormData({ ...formData, postalCode: v })}
          onCity={v => setFormData({ ...formData, city: v })}
          streetLabel="Adresse de l'entreprise (rue)"
          required
        />

        {/* Mentions légales — APE/NAF, immatriculation, téléphone */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="md:w-1/4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Code APE/NAF</label>
            <input
              type="text"
              value={formData.apeCode}
              onChange={e => setFormData({ ...formData, apeCode: e.target.value })}
              placeholder="6201Z"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Immatriculation RCS/RM (si applicable)
            </label>
            <input
              type="text"
              value={formData.immatriculation}
              onChange={e => setFormData({ ...formData, immatriculation: e.target.value })}
              placeholder="RCS Brest 123 456 789"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:w-1/4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
            <input
              type="tel"
              value={formData.tel}
              onChange={e => setFormData({ ...formData, tel: e.target.value })}
              placeholder="06 12 34 56 78"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* IBAN & BIC on the same row */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">IBAN</label>
            <input
              type="text"
              value={formData.iban}
              onChange={e => setFormData({ ...formData, iban: e.target.value })}
              placeholder="FR76 1234 5678 9012 3456 7890 123"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="md:w-1/3">
            <label className="block text-sm font-medium text-gray-700 mb-2">BIC</label>
            <input
              type="text"
              value={formData.bic}
              onChange={e => setFormData({ ...formData, bic: e.target.value })}
              placeholder="BNPAFRPPXXX"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Bank name + address */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="md:w-1/3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Banque</label>
            <input
              type="text"
              value={formData.bank}
              onChange={e => setFormData({ ...formData, bank: e.target.value })}
              placeholder="BNP Paribas"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Adresse de la banque</label>
            <input
              type="text"
              value={formData.bankAddress}
              onChange={e => setFormData({ ...formData, bankAddress: e.target.value })}
              placeholder="16 bd des Italiens, 75009 Paris"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Standard width save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-8 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
