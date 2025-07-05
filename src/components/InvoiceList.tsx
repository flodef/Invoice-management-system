import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'sonner';
import React, { useState, useEffect, useRef } from 'react';

interface InvoiceListProps {
  onEditInvoice: (id: string) => void;
}

export function InvoiceList({ onEditInvoice }: InvoiceListProps) {
  const invoices = useQuery(api.invoices.getInvoices) || [];
  const clients = useQuery(api.invoices.getClients) || [];
  const deleteInvoice = useMutation(api.invoices.deleteInvoice);
  const duplicateInvoice = useMutation(api.invoices.duplicateInvoice);
  const generatePDF = useAction(api.pdf.generateInvoicePDF);
  const getStorageUrl = useAction(api.pdf.getStorageUrl);
  const sendInvoiceEmail = useAction(api.email.sendInvoiceEmail);

  const [showEmailConfirm, setShowEmailConfirm] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [showPdfViewer, setShowPdfViewer] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const handleDelete = async (id: string) => {
    try {
      await deleteInvoice({ id: id as any });
      toast.success('Facture supprimée!');
      setShowDeleteConfirm(null);
    } catch {
      toast.error('Échec de la suppression de la facture');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      toast.loading('Duplication de la facture...');
      const newInvoiceId = await duplicateInvoice({ id: id as any });
      toast.dismiss();
      toast.success('Facture dupliquée avec succès!');
      // Redirect to edit the new invoice
      onEditInvoice(newInvoiceId);
    } catch (error) {
      toast.dismiss();
      console.error('Duplicate error:', error);
      toast.error('Échec de la duplication de la facture');
    }
  };

  const handleSendEmail = async (id: string) => {
    try {
      toast.loading("Envoi de l'email...");
      const result = await sendInvoiceEmail({
        invoiceId: id as any,
        customMessage: customMessage.trim() || undefined,
      });
      toast.dismiss();

      if (result?.success) {
        toast.success(result.message);
        setShowEmailConfirm(null);
        setCustomMessage(''); // Reset custom message
      }
    } catch (error) {
      console.error('Email sending error:', error);
      toast.dismiss();
      toast.error("Échec de l'envoi de l'email");
    }
  };

  const handleViewPDF = async (id: string) => {
    try {
      toast.loading('Génération du PDF...');
      const result = await generatePDF({ invoiceId: id as any });
      toast.dismiss();

      if (result?.storageId) {
        const storageUrl = await getStorageUrl({ storageId: result.storageId });

        if (storageUrl) {
          // Fetch and create blob URL
          const response = await fetch(storageUrl);
          const blob = await response.blob();
          const pdfBlobUrl = window.URL.createObjectURL(blob);

          // Set state to show PDF viewer with this URL
          setPdfUrl(pdfBlobUrl);
          setShowPdfViewer(id);

          toast.success('PDF généré avec succès!');
        } else {
          throw new Error("Impossible de récupérer l'URL du PDF");
        }
      } else {
        throw new Error('Aucun PDF généré');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.dismiss();
      toast.error('Échec de la génération du PDF');
    }
  };

  const handleDownloadPDF = async (id: string) => {
    try {
      toast.loading('Génération du PDF...');
      const result = await generatePDF({ invoiceId: id as any });
      toast.dismiss();

      if (result?.storageId) {
        const storageUrl = await getStorageUrl({ storageId: result.storageId });

        if (storageUrl) {
          const response = await fetch(storageUrl);
          const blob = await response.blob();

          // Get invoice details for better filename
          const invoiceDetails = invoices.find(inv => inv._id === id);
          const invoiceNumber = invoiceDetails?.invoiceNumber || id;
          let clientName = '';

          if (invoiceDetails?.client?._id) {
            const client = clients?.find(c => c._id === invoiceDetails.client?._id);
            clientName = client?.name || '';
          }

          // Sanitize client name for filename (remove spaces, special chars)
          const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9]/g, '-');

          // Create filename with invoice number and client name
          const filename = `Facture-${invoiceNumber}-${sanitizedClientName}.pdf`;

          const downloadUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(downloadUrl);

          toast.success('PDF téléchargé avec succès!');
        }
      }
    } catch (error) {
      toast.error('Échec de la génération du PDF');
      console.error('Error downloading PDF:', error);
    }
  };

  const handleClosePdfViewer = () => {
    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    setShowPdfViewer(null);
  };

  // Duplicate all invoices from the previous month to the current month
  const handleDuplicatePreviousMonth = async () => {
    try {
      toast.loading('Duplication des factures du mois précédent...');

      // Get the previous month's invoices
      const previousMonthKey = getPreviousMonthKey();
      const previousMonthInvoices = invoices.filter(invoice => {
        const date = new Date(invoice.invoiceDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return monthKey === previousMonthKey;
      });

      // Create a duplicate for each invoice
      const duplicatePromises = previousMonthInvoices.map(invoice => duplicateInvoice({ id: invoice._id as any }));

      await Promise.all(duplicatePromises);
      toast.dismiss();
      toast.success(
        `${previousMonthInvoices.length} facture${previousMonthInvoices.length > 1 ? 's' : ''} dupliquée${previousMonthInvoices.length > 1 ? 's' : ''} avec succès!`,
      );
    } catch (error) {
      toast.dismiss();
      toast.error('Échec de la duplication des factures');
      console.error('Error duplicating invoices:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('fr-FR');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Group invoices by month
  const groupInvoicesByMonth = () => {
    const groups: { [key: string]: typeof invoices } = {};

    invoices.forEach(invoice => {
      const date = new Date(invoice.invoiceDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(invoice);
    });

    // Sort months in descending order (newest first)
    const sortedMonths = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return sortedMonths.map(monthKey => {
      // Calculate total amount for the month
      const totalAmount = groups[monthKey].reduce((sum, invoice) => sum + invoice.totalAmount, 0);

      return {
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        invoices: groups[monthKey].sort((a, b) => b.invoiceDate - a.invoiceDate), // Sort invoices within month
        count: groups[monthKey].length,
        totalAmount: totalAmount,
      };
    });
  };

  const formatMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
  };

  const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const getPreviousMonthKey = () => {
    const now = new Date();
    // Go back one month
    now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const hasInvoicesInCurrentMonth = () => {
    const currentMonthKey = getCurrentMonthKey();
    return invoices.some(invoice => {
      const date = new Date(invoice.invoiceDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return monthKey === currentMonthKey;
    });
  };

  const hasPreviousMonthInvoices = () => {
    const previousMonthKey = getPreviousMonthKey();
    return invoices.some(invoice => {
      const date = new Date(invoice.invoiceDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return monthKey === previousMonthKey;
    });
  };

  // Determine if we should show the duplicate button
  const shouldShowDuplicateButton = !hasInvoicesInCurrentMonth() && hasPreviousMonthInvoices();

  const toggleMonth = (monthKey: string) => {
    console.log(monthKey);
    setOpenMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  const groupedInvoices = groupInvoicesByMonth();

  // Initialize current month as open when invoices load or change
  useEffect(() => {
    if (invoices.length > 0 && !initializedRef.current) {
      const currentMonthKey = getCurrentMonthKey();
      const hasCurrentMonthInvoices = invoices.some(inv => {
        const date = new Date(inv.invoiceDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return monthKey === currentMonthKey;
      });

      if (hasCurrentMonthInvoices) {
        initializedRef.current = true;
        setOpenMonths(prev => new Set([...prev, currentMonthKey]));
      } else {
        // If no invoices in current month, open the first month (newest)
        if (groupedInvoices.length > 0) {
          initializedRef.current = true;
          setOpenMonths(prev => new Set([...prev, groupedInvoices[0].monthKey]));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices]); // Run when invoices change

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'paid':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Brouillon';
      case 'sent':
        return 'Envoyée';
      case 'paid':
        return 'Payée';
      default:
        return status;
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Factures</h2>
        <div className="flex gap-2">
          {shouldShowDuplicateButton && (
            <button
              onClick={() => void handleDuplicatePreviousMonth()}
              className="bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 transition-colors flex items-center gap-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="icon icon-tabler icon-tabler-copy"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" />
                <path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" />
              </svg>
              Dupliquer le mois précédent
            </button>
          )}
          <button
            onClick={() => onEditInvoice('new')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Créer une facture
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {invoices.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucune facture pour le moment. Créez votre première facture!</p>
        ) : (
          <div className="space-y-4">
            {groupedInvoices.map(({ monthKey, monthLabel, invoices: monthInvoices, count, totalAmount }) => {
              const isOpen = openMonths.has(monthKey);
              return (
                <div key={monthKey} className="border rounded-lg overflow-hidden">
                  {/* Month Header */}
                  <button
                    onClick={() => toggleMonth(monthKey)}
                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-lg text-gray-800">{monthLabel}</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
                        {count} facture{count > 1 ? 's' : ''}
                      </span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-sm rounded-full font-medium">
                        {formatCurrency(totalAmount)}
                      </span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Month Content */}
                  {isOpen && (
                    <div className="divide-y divide-gray-200">
                      {monthInvoices.map(invoice => {
                        const isDraft = invoice.status === 'draft';
                        return (
                          <div key={invoice._id} className="p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-semibold text-lg">#{invoice.invoiceNumber}</h3>
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}
                                  >
                                    {getStatusLabel(invoice.status)}
                                  </span>
                                </div>
                                <p className="text-gray-600">Client: {invoice.clientName}</p>
                                <p className="text-gray-600">Date: {formatDate(invoice.invoiceDate)}</p>
                                <p className="text-gray-600">Échéance: {formatDate(invoice.paymentDate)}</p>
                                <p className="font-semibold text-lg mt-2">{formatCurrency(invoice.totalAmount)}</p>
                              </div>
                              <div className="flex gap-2">
                                {isDraft && (
                                  <button
                                    onClick={() => onEditInvoice(invoice._id)}
                                    className="text-blue-600 hover:text-blue-800 px-3 py-1 rounded-md hover:bg-blue-50"
                                  >
                                    Modifier
                                  </button>
                                )}
                                {isDraft && (
                                  <button
                                    onClick={() => setShowEmailConfirm(invoice._id)}
                                    className="text-green-600 hover:text-green-800 px-3 py-1 rounded-md hover:bg-green-50"
                                  >
                                    Envoyer par email
                                  </button>
                                )}
                                <button
                                  onClick={() => void handleViewPDF(invoice._id)}
                                  className="text-purple-600 hover:text-purple-800 px-3 py-1 rounded-md hover:bg-purple-50"
                                >
                                  Visualiser PDF
                                </button>
                                <button
                                  onClick={() => void handleDuplicate(invoice._id)}
                                  className="text-orange-600 hover:text-orange-800 px-3 py-1 rounded-md hover:bg-orange-50"
                                >
                                  Dupliquer
                                </button>
                                {!isDraft && (
                                  <button
                                    onClick={() => setShowDeleteConfirm(invoice._id)}
                                    className="text-red-600 hover:text-red-800 px-3 py-1 rounded-md hover:bg-red-50"
                                  >
                                    Supprimer
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PDF Viewer Overlay */}
      {showPdfViewer && pdfUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">Aperçu de la facture</h3>
              <div className="flex gap-3">
                {(() => {
                  // Check if the current invoice is a draft (status !== 'sent')
                  const currentInvoice = invoices.find(inv => inv._id === showPdfViewer);
                  const isDraft = currentInvoice?.status !== 'sent';

                  return (
                    <>
                      {isDraft && (
                        <button
                          onClick={() => setShowEmailConfirm(showPdfViewer)}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                          Envoyer par email
                        </button>
                      )}
                      <button
                        onClick={() => void handleDownloadPDF(showPdfViewer)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center gap-2"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        Télécharger
                      </button>
                    </>
                  );
                })()}
                <button onClick={handleClosePdfViewer} className="text-gray-500 hover:text-gray-700">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-100">
              <iframe src={pdfUrl} className="w-full h-full" title="PDF Viewer" />
            </div>
          </div>
        </div>
      )}

      {/* Email Confirmation Modal */}
      {showEmailConfirm &&
        (() => {
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

                {/* Custom Message Field */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message personnalisé (optionnel)
                  </label>
                  <textarea
                    value={customMessage}
                    onChange={e => setCustomMessage(e.target.value)}
                    placeholder="Ajoutez un message personnel à votre email..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowEmailConfirm(null);
                      setCustomMessage(''); // Reset custom message when canceling
                    }}
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm &&
        (() => {
          const invoice = invoices.find(inv => inv._id === showDeleteConfirm);
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
                <h3 className="text-lg font-semibold mb-4 text-red-600">Confirmer la suppression</h3>
                <div className="mb-4">
                  <p className="text-gray-700 mb-4">
                    Êtes-vous sûr de vouloir supprimer cette facture ? Cette action est irréversible.
                  </p>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-gray-700 mb-1">
                      <strong>Facture:</strong> {invoice.invoiceNumber}
                    </p>
                    <p className="text-gray-700 mb-1">
                      <strong>Client:</strong> {invoice.client?.name || 'Client inconnu'}
                    </p>
                    <p className="text-gray-700">
                      <strong>Montant:</strong> {formatCurrency(invoice.totalAmount)}
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
    </div>
  );
}
