import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'sonner';
import { Doc, Id } from '../../convex/_generated/dataModel';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { ServiceEditorModal } from './ServiceEditorModal';

export function ServiceManager() {
  const services = useQuery(api.invoices.getServices) || [];
  const _saveService = useMutation(api.invoices.saveService); // This mutation is used in ServiceEditorModal.tsx
  const deleteService = useMutation(api.invoices.deleteService);

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<Doc<'services'> | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Id<'services'> | null>(null);

  const handleAddService = () => {
    setEditingService(null);
    setShowServiceModal(true);
  };

  const handleEditService = (service: Doc<'services'>) => {
    setEditingService(service);
    setShowServiceModal(true);
  };

  const handleDelete = async (id: Id<'services'>) => {
    try {
      await deleteService({ id });
      toast.success('Service supprimé!');
      setShowDeleteConfirm(null);
    } catch {
      toast.error('Échec de la suppression du service');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Services</h2>
        <button
            onClick={handleAddService}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Ajouter un service
          </button>
        </div>

      <div className="space-y-4">
        {services.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucun service pour le moment. Ajoutez votre premier service!</p>
        ) : (
          services
            .sort((a, b) => a.label.localeCompare(b.label))
            .map(service => (
              <div key={service._id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{service.label}</h3>
                    <p className="text-gray-600">
                      {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
                        service.defaultPrice,
                      )}
                    </p>
                    {service.isActive && (
                      <span className="inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 bg-blue-100 text-blue-800">
                        Service Actif
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditService(service)}
                      className="text-blue-600 hover:text-blue-800 p-2 rounded-md hover:bg-blue-50"
                      title="Modifier"
                    >
                      <IconEdit size={20} stroke={1.5} />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(service._id)}
                      className="text-red-600 hover:text-red-800 p-2 rounded-md hover:bg-red-50"
                      title="Supprimer"
                    >
                      <IconTrash size={20} stroke={1.5} />
                    </button>
                  </div>
                </div>
              </div>
            ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm &&
        (() => {
          const service = services.find(s => s._id === showDeleteConfirm);
          if (!service) return null;

          const formatCurrency = (amount: number) => {
            return new Intl.NumberFormat('fr-FR', {
              style: 'currency',
              currency: 'EUR',
            }).format(amount);
          };

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4 text-red-600">Confirmer la suppression</h3>
                <div className="mb-4">
                  <p className="text-gray-700 mb-4">
                    Êtes-vous sûr de vouloir supprimer ce service ? Cette action est irréversible.
                  </p>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-gray-700 mb-1">
                      <strong>Service:</strong> {service.label}
                    </p>
                    <p className="text-gray-700 mb-1">
                      <strong>Prix par défaut:</strong> {formatCurrency(service.defaultPrice)}
                    </p>
                    <p className="text-gray-700">
                      <strong>Statut:</strong> {service.isActive ? 'Actif' : 'Inactif'}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => void handleDelete(showDeleteConfirm)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      <ServiceEditorModal
        isOpen={showServiceModal}
        onClose={() => setShowServiceModal(false)}
        service={editingService}
      />
    </div>
  );
}
