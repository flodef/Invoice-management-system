'use node';

import { v } from 'convex/values';
import { jsPDF } from 'jspdf';
import { api } from './_generated/api';
import { action } from './_generated/server';

const MAX_PAGE_WIDTH = 170;

// Function to split long lines at spaces or hyphens
const splitLongText = (text: string, maxLength: number = 45): string[] => {
  if (text.length <= maxLength) return [text];

  // Find the last space or hyphen within the maxLength
  let splitIndex = maxLength;
  while (splitIndex > 0 && text[splitIndex] !== ' ' && text[splitIndex] !== '-') {
    splitIndex--;
  }

  // If no space or hyphen found, force split at maxLength
  if (splitIndex === 0) splitIndex = maxLength;

  // If split at hyphen, include the hyphen in the first part
  const splitPoint = text[splitIndex] === '-' ? splitIndex + 1 : splitIndex;

  const firstPart = text.substring(0, splitPoint);
  const remainingText = text.substring(text[splitIndex] === ' ' ? splitIndex + 1 : splitPoint);

  return [firstPart, ...splitLongText(remainingText, maxLength)];
};

export const getStorageUrl = action({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const generateInvoicePDF = action({
  args: {
    invoiceId: v.id('invoices'),
  },
  handler: async (ctx, args) => {
    // Get invoice data
    const invoice = await ctx.runQuery(api.invoices.getInvoiceById, {
      id: args.invoiceId,
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Generate PDF using jsPDF
    const pdfBuffer = createInvoicePDF(invoice);

    const storageId = await ctx.storage.store(new Blob([pdfBuffer], { type: 'application/pdf' }));

    // Update the invoice with the new pdfStorageId
    await ctx.runMutation(api.invoices.updateInvoicePDF, {
      invoiceId: args.invoiceId,
      pdfStorageId: storageId,
    });

    return { storageId, message: 'PDF generated successfully' };
  },
});

function createInvoicePDF(invoice: any): Uint8Array {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Create new PDF document
  const doc = new jsPDF();

  // Set font
  doc.setFont('helvetica');

  // Header - Company Info
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.userProfile.name, 20, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.userProfile.email, 20, 40);

  // Handle multiline address
  const companyAddress = invoice.userProfile.address.split('\n');
  let yPos = 45;
  companyAddress.forEach((line: string) => {
    const lineParts = splitLongText(line);
    lineParts.forEach((part: string) => {
      doc.text(part, 20, yPos);
      yPos += 5;
    });
  });

  doc.text(`N° SIRET: ${invoice.userProfile.freelanceId}`, 20, yPos + 5);

  // Header - Client Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Facturer à:', 120, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.client?.name || 'Client inconnu', 120, 40);

  doc.setFont('helvetica', 'normal');

  // Process client address with line splitting
  const clientAddress = (invoice.client?.address || 'Adresse inconnue').split('\n');
  yPos = 45;
  clientAddress.forEach((line: string) => {
    const lineParts = splitLongText(line);
    lineParts.forEach((part: string) => {
      doc.text(part, 120, yPos);
      yPos += 5;
    });
  });

  if (invoice.client?.legalForm) {
    doc.text(`Forme juridique: ${invoice.client.legalForm}`, 120, yPos + 5);
  }

  // Invoice Details
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`Facture N°${invoice.invoiceNumber}`, 20, 90);

  // Items Table
  const tableStartY = 100;
  const colPositions = [20, 135, 145, 160, 175];

  // Table Header
  doc.setFillColor(245, 245, 245);
  doc.rect(20, tableStartY, MAX_PAGE_WIDTH, 8, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', colPositions[0] + 2, tableStartY + 5);
  doc.text('Qté', colPositions[1] + 2, tableStartY + 5);
  doc.text('Prix HT', colPositions[2] + 2, tableStartY + 5);
  doc.text('Remise', colPositions[3] + 2, tableStartY + 5);
  doc.text('Total HT', colPositions[4] + 2, tableStartY + 5);

  // Table borders
  doc.setDrawColor(221, 221, 221);
  doc.rect(20, tableStartY, MAX_PAGE_WIDTH, 8);

  // Table Items
  doc.setFont('helvetica', 'normal');
  let currentY = tableStartY + 8;

  invoice.items.forEach((item: any, index: number) => {
    const rowHeight = 8;

    // Row background (alternating)
    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(20, currentY, MAX_PAGE_WIDTH, rowHeight, 'F');
    }

    // Item data
    doc.text(
      (item.label + (item.discountText ? ` (${item.discountText})` : '')).substring(0, 80),
      colPositions[0] + 2,
      currentY + 5,
    );
    doc.text(item.quantity.toString(), colPositions[1] + 2, currentY + 5);
    doc.text(formatCurrency(item.price), colPositions[2] + 2, currentY + 5);

    const discountText = item.discount ? `${item.discount}${item.discountUnit || '%'}` : '-';
    doc.text(discountText, colPositions[3] + 2, currentY + 5);

    doc.text(formatCurrency(item.total), colPositions[4] + 2, currentY + 5);

    // Row border
    doc.rect(20, currentY, MAX_PAGE_WIDTH, rowHeight);

    currentY += rowHeight;
  });

  // Date and discount info below table
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date de facturation: ${formatDate(invoice.invoiceDate)}`, 20, currentY + 15);
  doc.text(`Date de règlement: ${formatDate(invoice.paymentDate)}`, 20, currentY + 20);
  doc.text(`Conditions d'escompte : Pas d'escompte pour règlement anticipé`, 20, currentY + 25);

  // Total with box
  const totalBoxX = MAX_PAGE_WIDTH - 25;
  const totalBoxY = currentY + 11;
  const totalBoxWidth = 45;
  const totalBoxHeight = 9;

  // Draw black box around total
  doc.setDrawColor(0, 0, 0);
  doc.rect(totalBoxX, totalBoxY, totalBoxWidth, totalBoxHeight);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total HT: ${formatCurrency(invoice.totalAmount)}`, totalBoxX + 5, currentY + 17);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`TVA non applicable, art. 293 B du CGI`, totalBoxX - 2, currentY + 23);

  // Payment Info with border
  const paymentBoxX = 20;
  const paymentBoxY = currentY + 125;
  const paymentBoxHeight = 25;
  const paymentBoxWidth = MAX_PAGE_WIDTH;

  // Draw black box around payment info
  doc.setDrawColor(0, 0, 0);
  doc.rect(paymentBoxX, paymentBoxY, paymentBoxWidth, paymentBoxHeight);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Paiement par virement bancaire', 22, currentY + 130);

  doc.setFont('helvetica', 'normal');
  doc.text(`IBAN: ${invoice.userProfile.iban}`, 22, currentY + 137);
  doc.text(`BIC: ${invoice.userProfile.bic}`, 22, currentY + 142);
  doc.text(`Banque: ${invoice.userProfile.bank}`, 22, currentY + 147);

  doc.setFontSize(8);
  doc.text(
    `Pour tout professionnel, en cas de retard de paiement, application de l’indemnité forfaitaire légale pour frais de recouvrement : 40,00 €`,
    21,
    currentY + 155,
  );

  // Return PDF as Uint8Array
  return new Uint8Array(doc.output('arraybuffer'));
}
