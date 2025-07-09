import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'sonner';
import { Doc, Id } from '../../convex/_generated/dataModel';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { ClientEditorModal } from './ClientEditorModal';

export function ClientManager() {
  const clients = useQuery(api.invoices.getClients) || [];
  const _saveClient = useMutation(api.invoices.saveClient); // This mutation is used in ClientEditorModal.tsx
  const deleteClient = useMutation(api.invoices.deleteClient);
  const toggleClientStatus = useMutation(api.invoices.toggleClientStatus);

  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Doc<'clients'> | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Id<'clients'> | null>(null);

  const handleAddClient = () => {
    setEditingClient(null);
    setShowClientModal(true);
  };

  const handleEditClient = (client: Doc<'clients'>) => {
    setEditingClient(client);
    setShowClientModal(true);
  };

  const handleDelete = async (id: Id<'clients'>) => {
    try {
      await deleteClient({ id });
      toast.success('Client supprimé!');
      setShowDeleteConfirm(null);
    } catch {
      toast.error('Échec de la suppression du client');
    }
  };

  const handleToggleStatus = async (id: Id<'clients'>, isActive: boolean) => {
    try {
      await toggleClientStatus({ id, isActive });
      toast.success(`Client marqué comme ${isActive ? 'inactif' : 'actif'}`);
    } catch {
      toast.error('Échec du changement de statut du client');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Clients</h2>
        <button
          onClick={handleAddClient}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Ajouter un client
        </button>
      </div>

      <div className="space-y-4">
        {clients.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucun client pour le moment. Ajoutez votre premier client!</p>
        ) : (
          clients
            .sort((a, b) => {
              if (a.isActive && !b.isActive) return -1;
              if (!a.isActive && b.isActive) return 1;
              return a.name.localeCompare(b.name);
            })
            .map(client => (
              <div
                key={client._id}
                className={`border rounded-lg p-4 hover:bg-gray-50 ${!client.isActive ? 'bg-gray-100' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{client.name}</h3>
                    <p className="text-gray-600">{client.email}</p>
                    <p className="text-gray-600 text-sm mt-1">{client.address}</p>
                    <span
                      onClick={() => void handleToggleStatus(client._id, client.isActive)}
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 cursor-pointer ${
                        client.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {client.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditClient(client)}
                      className="text-blue-600 hover:text-blue-800 p-2 rounded-md hover:bg-blue-50"
                      title="Modifier"
                    >
                      <IconEdit size={20} stroke={1.5} />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(client._id)}
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
          const client = clients.find(c => c._id === showDeleteConfirm);
          if (!client) return null;

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4 text-red-600">Confirmer la suppression</h3>
                <div className="mb-4">
                  <p className="text-gray-700 mb-4">
                    Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible.
                  </p>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-gray-700 mb-1">
                      <strong>Nom:</strong> {client.name}
                    </p>
                    <p className="text-gray-700 mb-1">
                      <strong>Contact:</strong> {client.contactName}
                    </p>
                    <p className="text-gray-700">
                      <strong>Email:</strong> {client.email}
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

      <ClientEditorModal isOpen={showClientModal} onClose={() => setShowClientModal(false)} client={editingClient} />
    </div>
  );
}
