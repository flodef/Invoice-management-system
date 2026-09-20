'use node';

import { action, internalAction, type ActionCtx } from './_generated/server';
import { v } from 'convex/values';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

// Shared send flow — internal queries/actions so both the authenticated UI
// path and the server-to-server HTTP endpoint can use it. Generates the PDF
// (same model as everywhere), emails it to the client with the owner in bcc,
// and marks the invoice sent.
const sendInvoiceEmailCore = async (
  ctx: ActionCtx,
  invoiceId: Id<'invoices'>,
  customMessage?: string,
  testRecipient?: string,
) => {
  // Get invoice data with all relations
  const invoice = await ctx.runQuery(internal.invoices.getInvoiceByIdInternal, { id: invoiceId });

  if (!invoice || !invoice.userProfile || !invoice.client) {
    throw new Error('Invoice, user profile, or client not found');
  }

  // Generate PDF
  const pdfResult = await ctx.runAction(internal.pdf.generateInvoicePDFInternal, { invoiceId });

  if (!pdfResult?.storageId) {
    throw new Error('Failed to generate PDF');
  }

  // Get PDF URL
  const pdfUrl = await ctx.storage.getUrl(pdfResult.storageId);

  if (!pdfUrl) {
    throw new Error('Failed to get PDF URL');
  }

  // Fetch PDF data
  const pdfResponse = await fetch(pdfUrl);
  const pdfBuffer = await pdfResponse.arrayBuffer();

  // Import nodemailer dynamically
  const nodemailer = await import('nodemailer');

  // Configure transporter
  const transporter = nodemailer.default.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Create email content
  const invoiceDate = new Date(invoice.invoiceDate);

  // Random greeting
  const greetings = ['Bonjour', 'Salut', 'Coucou'];
  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

  const emailSubject = `Facture n°${invoice.invoiceNumber}`;
  const emailBody = `
${randomGreeting} ${invoice.client.contactName},
${customMessage ? `\n${customMessage}\n` : ''}
Voici la facture n°${invoice.invoiceNumber} du mois de ${invoiceDate.toLocaleString('fr-FR', { month: 'long' })} d'un montant de ${formatCurrency(invoice.totalAmount)}.

En te souhaitant une excellente journée,

${invoice.userProfile.name.split(' ')[0]}
    `.trim();

  // Send email
  try {
    await transporter.sendMail({
      from: `"${invoice.userProfile.name}" <${process.env.SMTP_FROM_EMAIL}>`,
      // Test sends (JC admin) go to the given address only — never the client,
      // and the owner bcc is skipped since the admin IS the owner.
      to: testRecipient ?? invoice.client.email,
      ...(testRecipient ? {} : { bcc: invoice.userProfile.email }),
      subject: emailSubject,
      text: emailBody,
      attachments: [
        {
          filename: `Facture-${invoice.invoiceNumber}-${invoice.client.name.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
          content: Buffer.from(pdfBuffer),
          contentType: 'application/pdf',
        },
      ],
    });

    // Mark invoice as sent (internal mutation — works for both the authed
    // UI path and the unauthenticated HTTP send). Test sends leave the TEST-
    // draft unsent so it can be re-tested.
    if (!testRecipient) {
      await ctx.runMutation(internal.invoices.markSentInternal, { id: invoiceId });
    }

    return { success: true, message: 'Email envoyé avec succès!' };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error("Échec de l'envoi de l'email");
  }
};

// Email sending action using nodemailer
export const sendInvoiceEmail = action({
  args: {
    invoiceId: v.id('invoices'),
    customMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Auth gate — the authed query enforces ownership (returns null otherwise).
    const invoice = await ctx.runQuery(api.invoices.getInvoiceById, { id: args.invoiceId });
    if (!invoice) throw new Error('Invoice, user profile, or client not found');

    return sendInvoiceEmailCore(ctx, args.invoiceId, args.customMessage);
  },
});

// Server-to-server variant — only reachable from other Convex functions
// (the /send-invoice-email HTTP endpoint), never from the public API.
export const sendInvoiceEmailInternal = internalAction({
  args: {
    invoiceId: v.id('invoices'),
    customMessage: v.optional(v.string()),
    testRecipient: v.optional(v.string()),
  },
  handler: async (ctx, args) => sendInvoiceEmailCore(ctx, args.invoiceId, args.customMessage, args.testRecipient),
});
