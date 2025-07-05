import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function MonthlyTemplates() {
  const templates = useQuery(api.invoices.getMonthlyTemplates) || [];
  const createTemplates = useMutation(api.invoices.createMonthlyTemplates);
  const createFromTemplate = useMutation(api.invoices.createInvoiceFromTemplate);

  const handleCreateTemplates = async () => {
    try {
      await createTemplates();
      toast.success("Modèles mensuels créés à partir des factures du mois dernier!");
    } catch {
      toast.error("Échec de la création des modèles");
    }
  };

  const handleCreateInvoice = async (templateId: string) => {
    try {
      await createFromTemplate({ templateId: templateId as any });
      toast.success("Facture créée à partir du modèle!");
    } catch {
      toast.error("Échec de la création de la facture");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getCurrentMonth = () => {
    const now = new Date();
    return now.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Modèles mensuels</h2>
          <p className="text-gray-600">Modèles pour {getCurrentMonth()}</p>
        </div>
        <button
          onClick={()=>void handleCreateTemplates()}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Générer à partir du mois dernier
        </button>
      </div>

      <div className="space-y-4">
        {templates.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">Aucun modèle pour ce mois pour le moment.</p>
            <p className="text-sm text-gray-400">
              Cliquez sur "Générer à partir du mois dernier" pour créer des modèles basés sur les factures envoyées du mois dernier.
            </p>
          </div>
        ) : (
          templates.map((template) => {
            const totalAmount = template.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            
            return (
              <div key={template._id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{template.clientName}</h3>
                    <div className="mt-2 space-y-1">
                      {template.items.map((item, index) => (
                        <div key={index} className="text-sm text-gray-600">
                          {item.label} - Qté: {item.quantity} × {formatCurrency(item.price)} = {formatCurrency(item.quantity * item.price)}
                        </div>
                      ))}
                    </div>
                    <p className="font-semibold text-lg mt-2">Total: {formatCurrency(totalAmount)}</p>
                    {template.lastInvoiceId && (
                      <span className="inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 bg-green-100 text-green-800">
                        Facture créée
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleCreateInvoice(template._id)}
                      disabled={!!template.lastInvoiceId}
                      className={`px-4 py-2 rounded-md transition-colors ${
                        template.lastInvoiceId
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-green-600 text-white hover:bg-green-700"
                      }`}
                    >
                      {template.lastInvoiceId ? "Facture créée" : "Créer une facture"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
