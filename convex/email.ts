'use node';

import { action } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';

// Email sending action using nodemailer
export const sendInvoiceEmail = action({
  args: {
    invoiceId: v.id('invoices'),
    customMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get invoice data with all relations
    const invoice = await ctx.runQuery(api.invoices.getInvoiceById, {
      id: args.invoiceId,
    });

    if (!invoice || !invoice.userProfile || !invoice.client) {
      throw new Error('Invoice, user profile, or client not found');
    }

    // Generate PDF
    const pdfResult = await ctx.runAction(api.pdf.generateInvoicePDF, {
      invoiceId: args.invoiceId,
    });

    if (!pdfResult?.storageId) {
      throw new Error('Failed to generate PDF');
    }

    // Get PDF URL
    const pdfUrl = await ctx.runAction(api.pdf.getStorageUrl, {
      storageId: pdfResult.storageId,
    });

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
${args.customMessage ? `\n${args.customMessage}\n` : ''}
Voici la facture n°${invoice.invoiceNumber} du mois de ${invoiceDate.toLocaleString('fr-FR', { month: 'long' })} d'un montant de ${formatCurrency(invoice.totalAmount)}.

En te souhaitant une excellente journée,

${invoice.userProfile.name.split(' ')[0]}
    `.trim();

    // Send email
    try {
      await transporter.sendMail({
        from: `"${invoice.userProfile.name}" <${process.env.SMTP_FROM_EMAIL}>`,
        to: invoice.client.email,
        bcc: invoice.userProfile.email,
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

      // Mark invoice as sent
      await ctx.runMutation(api.invoices.markInvoiceAsSent, {
        id: args.invoiceId,
      });

      return { success: true, message: 'Email envoyé avec succès!' };
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error("Échec de l'envoi de l'email");
    }
  },
});
