"use node";

import { v } from "convex/values";
import { jsPDF } from "jspdf";
import { api } from "./_generated/api";
import { action } from "./_generated/server";

export const getStorageUrl = action({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const generateInvoicePDF = action({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    // Get invoice data
    const invoice = await ctx.runQuery(api.invoices.getInvoiceById, {
      id: args.invoiceId,
    });
    
    if (!invoice) {
      throw new Error("Invoice not found");
    }

    // Generate PDF using jsPDF
    const pdfBuffer = createInvoicePDF(invoice);

    const storageId = await ctx.storage.store(
      new Blob([pdfBuffer], { type: 'application/pdf' })
    );

    return { storageId, message: "PDF generated successfully" };
  },
});

function createInvoicePDF(invoice: any): Uint8Array {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
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
    doc.text(line, 20, yPos);
    yPos += 5;
  });
  
  doc.text(`N° SIRET: ${invoice.userProfile.freelanceId}`, 20, yPos + 5);
  
  // Header - Client Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Facturer à:', 120, 30);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.client.name, 120, 40);
  
  doc.setFont('helvetica', 'normal');
  const clientAddress = invoice.client.address.split('\n');
  yPos = 45;
  clientAddress.forEach((line: string) => {
    doc.text(line, 120, yPos);
    yPos += 5;
  });
  
  if (invoice.client.legalForm) {
    doc.text(`Forme juridique: ${invoice.client.legalForm}`, 120, yPos + 5);
  }
  
  // Invoice Details
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`Facture N°${invoice.invoiceNumber}`, 20, 90);
  
  // Items Table
  const tableStartY = 100;
  const colPositions = [20, 100, 120, 150, 175];
  
  // Table Header
  doc.setFillColor(245, 245, 245);
  doc.rect(20, tableStartY, 185, 8, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', colPositions[0] + 2, tableStartY + 5);
  doc.text('Qté', colPositions[1] + 2, tableStartY + 5);
  doc.text('Prix HT', colPositions[2] + 2, tableStartY + 5);
  doc.text('Remise', colPositions[3] + 2, tableStartY + 5);
  doc.text('Total HT', colPositions[4] + 2, tableStartY + 5);
  
  // Table borders
  doc.setDrawColor(221, 221, 221);
  doc.rect(20, tableStartY, 185, 8);
  
  // Table Items
  doc.setFont('helvetica', 'normal');
  let currentY = tableStartY + 8;
  
  invoice.items.forEach((item: any, index: number) => {
    const rowHeight = 8;
    
    // Row background (alternating)
    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(20, currentY, 185, rowHeight, 'F');
    }
    
    // Item data
    doc.text(item.label.substring(0, 35), colPositions[0] + 2, currentY + 5);
    doc.text(item.quantity.toString(), colPositions[1] + 2, currentY + 5);
    doc.text(formatCurrency(item.price), colPositions[2] + 2, currentY + 5);
    
    const discountText = item.discount ? `${item.discount}${item.discountUnit || '%'}` : '-';
    doc.text(discountText, colPositions[3] + 2, currentY + 5);
    
    doc.text(formatCurrency(item.total), colPositions[4] + 2, currentY + 5);
    
    // Row border
    doc.rect(20, currentY, 185, rowHeight);
    
    currentY += rowHeight;
  });
  
  // Date and discount info below table
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date de facturation: ${formatDate(invoice.invoiceDate)}`, 20, currentY + 15);
  doc.text(`Date de règlement: ${formatDate(invoice.paymentDate)}`, 20, currentY + 20);
  doc.text(`Conditions d'escompte : Pas d'escompte pour règlement anticipé`, 20, currentY + 25);
  
  // Total with box
  const totalBoxX = 155;
  const totalBoxY = currentY + 11;
  const totalBoxWidth = 45;
  const totalBoxHeight = 9;
  
  
  // Draw black box around total
  doc.setDrawColor(0, 0, 0);
  doc.rect(totalBoxX, totalBoxY, totalBoxWidth, totalBoxHeight);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total HT: ${formatCurrency(invoice.totalAmount)}`, 160, currentY + 17);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`TVA non applicable, art. 293 B du CGI`, 153, currentY + 23);
  
  // Payment Info with border
  const paymentBoxX = 20;
  const paymentBoxY = currentY + 140;
  const paymentBoxHeight = 25;
  const paymentBoxWidth = 180;
  
  // Draw black box around payment info
  doc.setDrawColor(0, 0, 0);
  doc.rect(paymentBoxX, paymentBoxY, paymentBoxWidth, paymentBoxHeight);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Paiement par virement bancaire', 22, currentY + 145);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`IBAN: ${invoice.userProfile.iban}`, 22, currentY + 150);
  doc.text(`BIC: ${invoice.userProfile.bic}`, 22, currentY + 155);
  doc.text(`Banque: ${invoice.userProfile.bank}`, 22, currentY + 160);

  doc.setFontSize(8);
  doc.text(`Pour tout professionnel, en cas de retard de paiement, application de l’indemnité forfaitaire légale pour frais de recouvrement : 40,00 €`, 20, currentY + 170);
  
  // Return PDF as Uint8Array
  return new Uint8Array(doc.output('arraybuffer'));
}
