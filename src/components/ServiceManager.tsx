import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";

export function ServiceManager() {
  const services = useQuery(api.invoices.getServices) || [];
  const saveService = useMutation(api.invoices.saveService);
  const deleteService = useMutation(api.invoices.deleteService);

  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Id<"services"> | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    defaultPrice: 0,
    isGlobal: false,
  });

  const resetForm = () => {
    setFormData({ label: "", defaultPrice: 0, isGlobal: false });
    setEditingService(null);
    setShowForm(false);
  };

  const handleEdit = (service: any) => {
    setFormData({
      label: service.label,
      defaultPrice: service.defaultPrice,
      isGlobal: service.isGlobal,
    });
    setEditingService(service._id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveService({
        id: editingService || undefined,
        ...formData,
      });
      toast.success(editingService ? "Service mis à jour!" : "Service ajouté!");
      resetForm();
    } catch {
      toast.error("Échec de l'enregistrement du service");
    }
  };

  const handleDelete = async (id: Id<"services">) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce service?")) {
      try {
        await deleteService({ id });
        toast.success("Service supprimé!");
      } catch {
        toast.error("Échec de la suppression du service");
      }
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Services</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Ajouter un service
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">
            {editingService ? "Modifier le service" : "Ajouter un nouveau service"}
          </h3>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Libellé du service
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix par défaut HT
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.defaultPrice}
                  onChange={(e) => setFormData({ ...formData, defaultPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isGlobal"
                checked={formData.isGlobal}
                onChange={(e) => setFormData({ ...formData, isGlobal: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="isGlobal" className="text-sm text-gray-700">
                Service global (les modifications affectent toutes les factures non envoyées)
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                {editingService ? "Mettre à jour" : "Ajouter"} le service
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {services.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucun service pour le moment. Ajoutez votre premier service!</p>
        ) : (
          services.map((service) => (
            <div key={service._id} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{service.label}</h3>
                  <p className="text-gray-600">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(service.defaultPrice)}</p>
                  {service.isGlobal && (
                    <span className="inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 bg-blue-100 text-blue-800">
                      Service Global
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(service)}
                    className="text-blue-600 hover:text-blue-800 px-3 py-1 rounded-md hover:bg-blue-50"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => void handleDelete(service._id)}
                    className="text-red-600 hover:text-red-800 px-3 py-1 rounded-md hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
