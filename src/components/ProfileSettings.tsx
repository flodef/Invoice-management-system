import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function ProfileSettings() {
  const userProfile = useQuery(api.invoices.getUserProfile);
  const updateProfile = useMutation(api.invoices.updateUserProfile);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    address: "",
    freelanceId: "",
    iban: "",
    bic: "",
    bank: "",
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        name: userProfile.name || "",
        email: userProfile.email || "",
        address: userProfile.address || "",
        freelanceId: userProfile.freelanceId || "",
        iban: userProfile.iban || "",
        bic: userProfile.bic || "",
        bank: userProfile.bank || "",
      });
    }
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile(formData);
      toast.success("Profil mis à jour avec succès!");
    } catch {
      toast.error("Échec de la mise à jour du profil");
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Paramètres du profil</h2>
      
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nom de l'entreprise
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email professionnel
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Adresse de l'entreprise
          </label>
          <textarea
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Numéro SIRET
          </label>
          <input
            type="text"
            value={formData.freelanceId}
            onChange={(e) => setFormData({ ...formData, freelanceId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            IBAN
          </label>
          <input
            type="text"
            value={formData.iban}
            onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
            placeholder="FR76 1234 5678 9012 3456 7890 123"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            BIC
          </label>
          <input
            type="text"
            value={formData.bic}
            onChange={(e) => setFormData({ ...formData, bic: e.target.value })}
            placeholder="BNPAFRPPXXX"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Banque
          </label>
          <input
            type="text"
            value={formData.bank}
            onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
            placeholder="BNP Paribas"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
          Enregistrer le profil
        </button>
      </form>
    </div>
  );
}
