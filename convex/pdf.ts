'use node';

import { v } from 'convex/values';
import { jsPDF } from 'jspdf';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, internalAction, type ActionCtx } from './_generated/server';

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

// Shared PDF generation — internal variants of the queries/mutations so both
// the authenticated UI path and the server-to-server HTTP path can call it.
const generateInvoicePDFCore = async (ctx: ActionCtx, invoiceId: Id<'invoices'>) => {
  const invoice = await ctx.runQuery(internal.invoices.getInvoiceByIdInternal, { id: invoiceId });
  if (!invoice) throw new Error('Invoice not found');

  const pdfBuffer = createInvoicePDF(invoice);
  const storageId = await ctx.storage.store(new Blob([pdfBuffer], { type: 'application/pdf' }));

  await ctx.runMutation(internal.invoices.updateInvoicePDFInternal, {
    invoiceId,
    pdfStorageId: storageId,
  });

  return { storageId, message: 'PDF generated successfully' };
};

export const generateInvoicePDF = action({
  args: {
    invoiceId: v.id('invoices'),
  },
  handler: async (ctx, args) => {
    // Auth gate — the authed query enforces ownership (returns null otherwise).
    const invoice = await ctx.runQuery(api.invoices.getInvoiceById, { id: args.invoiceId });
    if (!invoice) throw new Error('Invoice not found');

    return generateInvoicePDFCore(ctx, args.invoiceId);
  },
});

// Server-to-server variant — only reachable from other Convex functions
// (the /send-invoice-email HTTP endpoint), never from the public API.
export const generateInvoicePDFInternal = internalAction({
  args: {
    invoiceId: v.id('invoices'),
  },
  handler: async (ctx, args) => generateInvoicePDFCore(ctx, args.invoiceId),
});

// Mise en page alignée sur Job Conciergerie — toutes les mentions
// obligatoires d'une facture B2B française : émetteur EI (nom + mention,
// adresse, SIREN+SIRET, code APE, immatriculation, contact), client pro
// (raison sociale + forme juridique, siège, SIREN, n° TVA), facture (n°
// chronologique, émission, fin de prestation), « TVA non applicable, art.
// 293 B du CGI », conditions de paiement (échéance, escompte néant,
// pénalités BCE + 10 pts, indemnité 40 €).
const PAGE_LEFT = 20;
const CLIENT_X = 120;

function createInvoicePDF(invoice: any): Uint8Array {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatMonthYear = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });

  const formatCurrency = (amount: number) => {
    // Remove all whitespace characters (including non-breaking spaces) from the formatted string
    // to prevent jsPDF from misinterpreting thousands separators.
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    })
      .format(amount)
      .replace(/\s/g, '');
  };

  const profile = invoice.userProfile;
  const client = invoice.client;

  // Create new PDF document
  const doc = new jsPDF();
  doc.setFont('helvetica');

  // ─── Émetteur (l'entrepreneur individuel) ───
  doc.setFontSize(15).setFont('helvetica', 'bold');
  doc.text(profile.name, PAGE_LEFT, 24);
  doc.setFontSize(9).setFont('helvetica', 'italic');
  doc.text('Entrepreneur individuel (EI)', PAGE_LEFT, 30);

  doc.setFont('helvetica', 'normal');
  let y = 36;
  for (const line of String(profile.address ?? '').split('\n'))
    for (const part of splitLongText(line, 52)) {
      doc.text(part, PAGE_LEFT, y);
      y += 4.5;
    }
  const siret = String(profile.freelanceId ?? '');
  doc.text(`SIREN : ${siret.slice(0, 9)} — SIRET : ${siret}`, PAGE_LEFT, y + 1);
  y += 5.5;
  if (profile.apeCode) {
    doc.text(`Code APE/NAF : ${profile.apeCode}`, PAGE_LEFT, y + 1);
    y += 5.5;
  }
  if (profile.immatriculation) {
    doc.text(`Immatriculation : ${profile.immatriculation}`, PAGE_LEFT, y + 1);
    y += 5.5;
  }
  // Email vendeur : celui choisi sur la fiche client, sinon le profil.
  const contact = [client?.vendorEmail ?? profile.email, profile.tel].filter(Boolean).join(' — ');
  if (contact) {
    doc.text(contact, PAGE_LEFT, y + 1);
    y += 5.5;
  }
  const emitterEnd = y;

  // ─── Client (société) ───
  doc.setFontSize(11).setFont('helvetica', 'bold');
  doc.text('Facturé à :', CLIENT_X, 24);
  doc.setFontSize(10);
  doc.text(`${client?.legalForm ? `${client.legalForm} ` : ''}${client?.name || 'Client inconnu'}`, CLIENT_X, 32);
  doc.setFontSize(9).setFont('helvetica', 'normal');
  let cy = 38;
  for (const line of String(client?.address || 'Adresse inconnue').split('\n'))
    for (const part of splitLongText(line, 40)) {
      doc.text(part, CLIENT_X, cy);
      cy += 4.5;
    }
  if (client?.siren) {
    doc.text(`SIREN : ${client.siren}`, CLIENT_X, cy + 1);
    cy += 5.5;
  }
  if (client?.tvaNumber) {
    doc.text(`N° TVA : ${client.tvaNumber}`, CLIENT_X, cy + 1);
    cy += 5.5;
  }
  const clientEnd = cy;

  // ─── En-tête de facture ───
  let body = Math.max(emitterEnd, clientEnd) + 12;
  doc.setFontSize(17).setFont('helvetica', 'bold');
  doc.text(`Facture N° ${invoice.invoiceNumber}`, PAGE_LEFT, body);
  doc.setFontSize(9).setFont('helvetica', 'normal');
  body += 6;
  doc.text(`Date d'émission : ${formatDate(invoice.invoiceDate)}`, PAGE_LEFT, body);
  body += 5;
  if (invoice.serviceEndDate) {
    doc.text(
      `Prestation : ${formatMonthYear(invoice.serviceEndDate)} (fin le ${formatDate(invoice.serviceEndDate)})`,
      PAGE_LEFT,
      body,
    );
    body += 5;
  }

  // ─── Tableau des lignes (avec remise — spécifique IMS) ───
  body += 5;
  const tableStartY = body;
  const colPositions = [PAGE_LEFT, 135, 145, 160, 175];

  // Table Header
  doc.setFillColor(245, 245, 245);
  doc.rect(PAGE_LEFT, tableStartY, MAX_PAGE_WIDTH, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.text('Description', colPositions[0] + 2, tableStartY + 5);
  doc.text('Qté', colPositions[1] + 2, tableStartY + 5);
  doc.text('Prix HT', colPositions[2] + 2, tableStartY + 5);
  doc.text('Remise', colPositions[3] + 2, tableStartY + 5);
  doc.text('Total HT', colPositions[4] + 2, tableStartY + 5);

  // Table borders
  doc.setDrawColor(221, 221, 221);
  doc.rect(PAGE_LEFT, tableStartY, MAX_PAGE_WIDTH, 8);

  // Table Items
  doc.setFont('helvetica', 'normal');
  let currentY = tableStartY + 8;

  invoice.items.forEach((item: any, index: number) => {
    const rowHeight = 8;

    // Row background (alternating)
    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(PAGE_LEFT, currentY, MAX_PAGE_WIDTH, rowHeight, 'F');
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
    doc.rect(PAGE_LEFT, currentY, MAX_PAGE_WIDTH, rowHeight);

    currentY += rowHeight;
  });

  // ─── Totaux ───
  currentY += 8;
  doc.setDrawColor(0, 0, 0).rect(CLIENT_X, currentY, 70, 9);
  doc.setFontSize(11).setFont('helvetica', 'bold');
  doc.text(`Total à payer : ${formatCurrency(invoice.totalAmount)}`, CLIENT_X + 3, currentY + 6);
  doc.setFontSize(8).setFont('helvetica', 'normal');
  doc.text(
    'TVA non applicable, art. 293 B du CGI — montant en franchise de TVA (HT = TTC).',
    PAGE_LEFT + MAX_PAGE_WIDTH,
    currentY + 14,
    { align: 'right' },
  );
  currentY += 22;

  // ─── Conditions de paiement (obligatoires en B2B) — encart ancré en bas
  // de page, nouvelle page si le contenu le fait déborder.
  let payTop = Math.max(currentY, 253);
  if (payTop + 34 > 297) {
    doc.addPage();
    payTop = 20;
  }
  doc.setDrawColor(0, 0, 0).rect(PAGE_LEFT, payTop, MAX_PAGE_WIDTH, 34);
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.text('Paiement par virement bancaire', PAGE_LEFT + 2, payTop + 6);
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.text(`IBAN : ${profile.iban}`, PAGE_LEFT + 2, payTop + 12);
  doc.text(`BIC : ${profile.bic}`, PAGE_LEFT + 2, payTop + 17);
  const bank = [profile.bank, profile.bankAddress].filter(Boolean).join(' — ');
  if (bank) doc.text(`Banque : ${bank}`, PAGE_LEFT + 2, payTop + 22);
  if (invoice.paymentDate) doc.text(`Date d'échéance : ${formatDate(invoice.paymentDate)}`, CLIENT_X, payTop + 12);
  doc.text('Escompte pour paiement anticipé : néant', CLIENT_X, payTop + 17);
  doc.setFontSize(8);
  doc.text(
    'En cas de retard de paiement : pénalités au taux appliqué par la BCE à son opération de',
    PAGE_LEFT + 2,
    payTop + 28,
  );
  doc.text(
    'refinancement le plus récent, majoré de 10 points. Indemnité forfaitaire de recouvrement : 40,00 €.',
    PAGE_LEFT + 2,
    payTop + 32,
  );

  // Return PDF as Uint8Array
  return new Uint8Array(doc.output('arraybuffer'));
}
