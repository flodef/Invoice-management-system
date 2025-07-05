import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useState } from "react";

interface InvoiceListProps {
  onEditInvoice: (id: string) => void;
}

export function InvoiceList({ onEditInvoice }: InvoiceListProps) {
  const invoices = useQuery(api.invoices.getInvoices) || [];
  const deleteInvoice = useMutation(api.invoices.deleteInvoice);
  const duplicateInvoice = useMutation(api.invoices.duplicateInvoice);
  const generatePDF = useAction(api.pdf.generateInvoicePDF);
  const getStorageUrl = useAction(api.pdf.getStorageUrl);
  const sendInvoiceEmail = useAction(api.email.sendInvoiceEmail);
  
  const [showEmailConfirm, setShowEmailConfirm] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette facture?")) {
      try {
        await deleteInvoice({ id: id as any });
        toast.success("Facture supprimée!");
      } catch {
        toast.error("Échec de la suppression de la facture");
      }
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      toast.loading("Duplication de la facture...");
      const newInvoiceId = await duplicateInvoice({ id: id as any });
      toast.dismiss();
      toast.success("Facture dupliquée avec succès!");
      // Redirect to edit the new invoice
      onEditInvoice(newInvoiceId);
    } catch (error) {
      toast.dismiss();
      console.error('Duplicate error:', error);
      toast.error("Échec de la duplication de la facture");
    }
  };

  const handleSendEmail = async (id: string) => {
    try {
      toast.loading("Envoi de l'email...");
      const result = await sendInvoiceEmail({ invoiceId: id as any });
      toast.dismiss();
      
      if (result?.success) {
        toast.success(result.message);
        setShowEmailConfirm(null);
      }
    } catch (error) {
      console.error("Email sending error:", error);
      toast.dismiss();
      toast.error("Échec de l'envoi de l'email");
    }
  };

  const handleDownloadPDF = async (id: string) => {
    try {
      toast.loading("Génération du PDF...");
      const result = await generatePDF({ invoiceId: id as any });
      toast.dismiss();
      
      if (result?.storageId) {
        // Get the storage URL for download
        const storageUrl = await getStorageUrl({ storageId: result.storageId });
        
        if (storageUrl) {
          // Create download link
          const response = await fetch(storageUrl);
          const blob = await response.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          // Create a readable filename with invoice number and client name
          const invoice = invoices.find(inv => inv._id === id);
          const sanitizedClientName = invoice?.clientName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-') || 'Client';
          link.download = `Facture-${invoice?.invoiceNumber || id}-${sanitizedClientName}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(downloadUrl);
          
          toast.success("PDF téléchargé avec succès!");
        } else {
          throw new Error("Impossible de récupérer l'URL du PDF");
        }
      } else {
        throw new Error("Aucun PDF généré");
      }
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.dismiss();
      toast.error("Échec de la génération du PDF");
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('fr-FR');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };



  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-yellow-100 text-yellow-800";
      case "sent":
        return "bg-blue-100 text-blue-800";
      case "paid":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft":
        return "Brouillon";
      case "sent":
        return "Envoyée";
      case "paid":
        return "Payée";
      default:
        return status;
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Factures</h2>
        <button
          onClick={() => onEditInvoice("new")}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Créer une facture
        </button>
      </div>

      <div className="space-y-4">
        {invoices.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucune facture pour le moment. Créez votre première facture!</p>
        ) : (
          invoices.map((invoice) => (
            <div key={invoice._id} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">#{invoice.invoiceNumber}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                      {getStatusLabel(invoice.status)}
                    </span>
                  </div>
                  <p className="text-gray-600">Client: {invoice.clientName}</p>
                  <p className="text-gray-600">Date: {formatDate(invoice.invoiceDate)}</p>
                  <p className="text-gray-600">Échéance: {formatDate(invoice.paymentDate)}</p>
                  <p className="font-semibold text-lg mt-2">{formatCurrency(invoice.totalAmount)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEditInvoice(invoice._id)}
                    className="text-blue-600 hover:text-blue-800 px-3 py-1 rounded-md hover:bg-blue-50"
                  >
                    Modifier
                  </button>
                  {invoice.status === "draft" && (
                    <button
                      onClick={() => setShowEmailConfirm(invoice._id)}
                      className="text-green-600 hover:text-green-800 px-3 py-1 rounded-md hover:bg-green-50"
                    >
                      Envoyer par email
                    </button>
                  )}
                  <button
                    onClick={() => void handleDownloadPDF(invoice._id)}
                    className="text-purple-600 hover:text-purple-800 px-3 py-1 rounded-md hover:bg-purple-50"
                  >
                    Télécharger PDF
                  </button>
                  <button
                    onClick={() => void handleDuplicate(invoice._id)}
                    className="text-orange-600 hover:text-orange-800 px-3 py-1 rounded-md hover:bg-orange-50"
                  >
                    Dupliquer
                  </button>
                  <button
                    onClick={() => void handleDelete(invoice._id)}
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
      
      {/* Email Confirmation Modal */}
      {showEmailConfirm && (() => {
        const invoice = invoices.find(inv => inv._id === showEmailConfirm);
        if (!invoice) return null;
        
        const formatCurrency = (amount: number) => {
          return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
          }).format(amount);
        };
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Confirmer l'envoi par email</h3>
              <div className="mb-4">
                <p className="text-gray-700 mb-2">
                  <strong>Entreprise:</strong> {invoice.userProfile?.name}
                </p>
                <p className="text-gray-700 mb-2">
                  <strong>Client:</strong> {invoice.client?.name}
                </p>
                <p className="text-gray-700 mb-2">
                  <strong>Email:</strong> {invoice.client?.email}
                </p>
                <p className="text-gray-700 mb-2">
                  <strong>Facture:</strong> {invoice.invoiceNumber}
                </p>
                <p className="text-gray-700 mb-4">
                  <strong>Montant total:</strong> {formatCurrency(invoice.totalAmount)}
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowEmailConfirm(null)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={() => void handleSendEmail(showEmailConfirm)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
