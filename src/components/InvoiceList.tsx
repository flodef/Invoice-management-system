import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'sonner';
import React, { useState, useEffect, useRef } from 'react';
import {
  IconEdit,
  IconMail,
  IconFileDownload,
  IconCopy,
  IconTrash,
  IconEye,
  IconPlus,
  IconUpload,
} from '@tabler/icons-react';
import { UploadInvoiceModal } from './UploadInvoiceModal';
import { InvoiceEditorModal } from './InvoiceEditorModal';

import { Id } from '../../convex/_generated/dataModel';

type InvoiceIdOrNew = Id<'invoices'> | 'new';

interface InvoiceListProps {
  onEditInvoice: (invoiceId: InvoiceIdOrNew) => void;
}

export function InvoiceList({ onEditInvoice }: InvoiceListProps) {
  const invoices = useQuery(api.invoices.getInvoices) || [];
  const clients = useQuery(api.clients.getClients) || [];
  const deleteInvoice = useMutation(api.invoices.deleteInvoice);
  const duplicateInvoice = useMutation(api.invoices.duplicateInvoice);
  const toggleInvoiceStatus = useMutation(api.invoices.toggleInvoiceStatus);
  const generatePDF = useAction(api.pdf.generateInvoicePDF);
  const getStorageUrl = useAction(api.pdf.getStorageUrl);
  const sendInvoiceEmail = useAction(api.email.sendInvoiceEmail);

  const [showEmailConfirm, setShowEmailConfirm] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [showPdfViewer, setShowPdfViewer] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [invoiceToEditId, setInvoiceToEditId] = useState<InvoiceIdOrNew | null>(null);
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

  const handleToggleStatus = async (id: Id<'invoices'>, status: string) => {
    if (status !== 'sent' && status !== 'paid') return;

    try {
      await toggleInvoiceStatus({ id, status });
      toast.success(`Facture marquée comme ${status === 'sent' ? 'payée' : 'envoyée'}`);
    } catch {
      toast.error('Échec du changement de statut de la facture');
    }
  };

  // Show confirmation modal before duplicating
  const handleDuplicate = (id: string) => {
    setShowDuplicateConfirm(id);
  };

  // Actual duplication after confirmation
  const confirmDuplicate = async (id: string) => {
    try {
      toast.loading('Duplication de la facture...');
      const newInvoiceId = await duplicateInvoice({ id: id as any });
      toast.dismiss();
      toast.success('Facture dupliquée avec succès!');
      // Close confirmation modal
      setShowDuplicateConfirm(null);
      // Redirect to edit the new invoice
      onEditInvoice(newInvoiceId);
    } catch (error) {
      toast.dismiss();
      console.error('Duplicate error:', error);
      toast.error('Échec de la duplication de la facture');
      // Close confirmation modal
      setShowDuplicateConfirm(null);
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
      const invoice = invoices.find(inv => inv._id === id);
      if (!invoice) {
        toast.error('Facture non trouvée');
        return;
      }

      let storageIdToUse = invoice.pdfStorageId || invoice.uploadedInvoiceId;
      let pdfBlobUrl: string | null = null;

      if (storageIdToUse) {
        // If a storageId exists, try to get the URL directly
        toast.loading('Chargement du PDF...');
        const storageUrl = await getStorageUrl({ storageId: storageIdToUse });
        if (storageUrl) {
          const response = await fetch(storageUrl);
          const blob = await response.blob();
          pdfBlobUrl = window.URL.createObjectURL(blob);
          toast.dismiss();
          toast.success('PDF chargé avec succès!');
        } else {
          toast.dismiss();
          toast.error("Impossible de récupérer l'URL du PDF stocké");
          // Fallback to generating if stored URL fails
          storageIdToUse = undefined;
        }
      }

      if (!storageIdToUse) {
        // If no storageId or if fetching failed, generate PDF
        toast.loading('Génération du PDF...');
        const result = await generatePDF({ invoiceId: id as any });
        toast.dismiss();

        if (result?.storageId) {
          const storageUrl = await getStorageUrl({ storageId: result.storageId });
          if (storageUrl) {
            const response = await fetch(storageUrl);
            const blob = await response.blob();
            pdfBlobUrl = window.URL.createObjectURL(blob);
            toast.success('PDF généré et chargé avec succès!');
          } else {
            throw new Error("Impossible de récupérer l'URL du PDF généré");
          }
        } else {
          throw new Error('Aucun PDF généré');
        }
      }

      if (pdfBlobUrl) {
        setPdfUrl(pdfBlobUrl);
        setShowPdfViewer(id);
      } else {
        toast.error('Une erreur inattendue est survenue lors du chargement du PDF.');
      }
    } catch (error) {
      console.error('PDF handling error:', error);
      toast.dismiss();
      toast.error('Échec du traitement du PDF');
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
      const unpaidCount = groups[monthKey].filter(
        invoice => invoice.status === 'sent' && new Date(invoice.paymentDate) < new Date(),
      ).length;

      return {
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        invoices: groups[monthKey].sort((a, b) => b.invoiceDate - a.invoiceDate), // Sort invoices within month
        count: groups[monthKey].length,
        totalAmount: totalAmount,
        unpaidCount: unpaidCount,
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

  const unpaidInvoices = invoices.filter(
    invoice => invoice.status === 'sent' && new Date(invoice.paymentDate) < new Date(),
  );

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
              <IconCopy size={20} stroke={1.5} />
              Dupliquer le mois précédent
            </button>
          )}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center gap-1"
          >
            <IconUpload size={20} stroke={1.5} />
            Importer une facture
          </button>
          <button
            onClick={() => {
              setInvoiceToEditId('new');
              setIsEditorModalOpen(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
          >
            <IconPlus size={20} stroke={1.5} />
            Créer une facture
          </button>
        </div>
      </div>

      {unpaidInvoices.length > 0 && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6" role="alert">
          <p className="font-bold">Attention</p>
          <p>
            Vous avez {unpaidInvoices.length} facture{unpaidInvoices.length > 1 ? 's' : ''} impayée
            {unpaidInvoices.length > 1 ? 's' : ''}, d'un montant total de{' '}
            {formatCurrency(unpaidInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0))}.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {invoices.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucune facture pour le moment. Créez votre première facture!</p>
        ) : (
          <div className="space-y-4">
            {groupedInvoices.map(
              ({ monthKey, monthLabel, invoices: monthInvoices, count, totalAmount, unpaidCount }) => {
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
                        {unpaidCount > 0 && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full font-medium">
                            {unpaidCount} impayée{unpaidCount > 1 ? 's' : ''}
                          </span>
                        )}
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
                              <div className="flex flex-wrap justify-between items-center">
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                    <p className="text-gray-600 font-semibold truncate">{invoice.clientName}</p>
                                    <p className="text-gray-600">#{invoice.invoiceNumber}</p>
                                    <p className="text-gray-500 text-sm">
                                      {formatDate(invoice.invoiceDate)} → {formatDate(invoice.paymentDate)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                                  <span
                                    onClick={() => void handleToggleStatus(invoice._id, invoice.status)}
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      invoice.status === 'sent' || invoice.status === 'paid' ? 'cursor-pointer' : ''
                                    } ${getStatusColor(invoice.status)}`}
                                  >
                                    {getStatusLabel(invoice.status)}
                                  </span>
                                  <p className="font-semibold text-lg">{formatCurrency(invoice.totalAmount)}</p>
                                </div>
                                <div className="flex gap-2 ml-4">
                                  {isDraft && (
                                    <button
                                      onClick={() => {
                                        setInvoiceToEditId(invoice._id);
                                        setIsEditorModalOpen(true);
                                      }}
                                      className="text-blue-600 hover:text-blue-800 p-2 rounded-md hover:bg-blue-50"
                                      title="Modifier"
                                    >
                                      <IconEdit size={20} stroke={1.5} />
                                    </button>
                                  )}
                                  {isDraft && (
                                    <button
                                      onClick={() => setShowEmailConfirm(invoice._id)}
                                      className="text-green-600 hover:text-green-800 p-2 rounded-md hover:bg-green-50"
                                      title="Envoyer par email"
                                    >
                                      <IconMail size={20} stroke={1.5} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => void handleViewPDF(invoice._id)}
                                    className="text-purple-600 hover:text-purple-800 p-2 rounded-md hover:bg-purple-50"
                                    title="Visualiser PDF"
                                  >
                                    <IconEye size={20} stroke={1.5} />
                                  </button>
                                  <button
                                    onClick={() => void handleDuplicate(invoice._id)}
                                    className="text-orange-600 hover:text-orange-800 p-2 rounded-md hover:bg-orange-50"
                                    title="Dupliquer"
                                  >
                                    <IconCopy size={20} stroke={1.5} />
                                  </button>
                                  {isDraft && (
                                    <button
                                      onClick={() => setShowDeleteConfirm(invoice._id)}
                                      className="text-red-600 hover:text-red-800 p-2 rounded-md hover:bg-red-50"
                                      title="Supprimer"
                                    >
                                      <IconTrash size={20} stroke={1.5} />
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
              },
            )}
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
                        <IconFileDownload size={20} stroke={1.5} />
                        Télécharger PDF
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
                  <p className="text-gray-700 mb-2">
                    <strong>Montant total:</strong> {formatCurrency(invoice.totalAmount)}
                  </p>
                  <p className="text-gray-700 mb-2">
                    <strong>Contact:</strong> {invoice.client?.contactName}
                  </p>
                </div>

                {/* Custom Message Field */}
                <div className="mb-2">
                  <label className="text-gray-700 mb-2 text-sm font-medium">Message personnalisé (optionnel)</label>
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

      {/* Duplicate Confirmation Modal */}
      {showDuplicateConfirm &&
        (() => {
          const invoice = invoices.find(inv => inv._id === showDuplicateConfirm);
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
                <h3 className="text-lg font-semibold mb-4 text-orange-600">Dupliquer la facture</h3>
                <div className="mb-4">
                  <p className="text-gray-700 mb-4">
                    Voulez-vous créer une copie de cette facture ? La nouvelle facture sera en statut brouillon.
                  </p>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-gray-700 mb-1">
                      <strong>Facture source:</strong> {invoice.invoiceNumber}
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
                    onClick={() => setShowDuplicateConfirm(null)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => void confirmDuplicate(showDuplicateConfirm)}
                    className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                  >
                    Dupliquer
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Upload Invoice Modal */}
      <UploadInvoiceModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          // Refresh will happen automatically via Convex
          setIsUploadModalOpen(false);
        }}
      />

      {/* Invoice Editor Modal */}
      <InvoiceEditorModal
        isOpen={isEditorModalOpen}
        onClose={() => {
          setIsEditorModalOpen(false);
          setInvoiceToEditId(null);
        }}
        invoiceId={invoiceToEditId || 'new'}
      />
    </div>
  );
}
