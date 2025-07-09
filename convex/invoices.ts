import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { calculatePaymentDate } from './utils';

// Generate invoice number
export const generateInvoiceNumber = query({
  args: {},
  handler: async (ctx): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `${year}${month}`;

    // Find the highest invoice number for this month
    const invoices = await ctx.db
      .query('invoices')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();

    const monthInvoices = invoices.filter(inv => inv.invoiceNumber.startsWith(prefix));
    const maxNumber = monthInvoices.reduce((max, inv) => {
      const num = parseInt(inv.invoiceNumber.slice(-2));
      return Math.max(max, num);
    }, 0);

    const nextNumber = String(maxNumber + 1).padStart(2, '0');
    return `${prefix}${nextNumber}`;
  },
});

// Get invoices
export const getInvoices = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const invoices = await ctx.db
      .query('invoices')
      .withIndex('by_user', q => q.eq('userId', userId))
      .order('desc')
      .collect();

    // Get client names and user profiles
    const invoicesWithClients = await Promise.all(
      invoices.map(async invoice => {
        const client = await ctx.db.get(invoice.clientId);
        const userProfile = await ctx.db
          .query('userProfiles')
          .withIndex('by_user', q => q.eq('userId', userId))
          .first();
        return {
          ...invoice,
          clientName: client?.name || 'Unknown Client',
          client,
          userProfile,
        };
      }),
    );

    return invoicesWithClients;
  },
});

// Get invoice by ID with full details
export const getInvoiceById = query({
  args: { id: v.id('invoices') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const invoice = await ctx.db.get(args.id);
    if (!invoice || invoice.userId !== userId) {
      return null;
    }

    const client = await ctx.db.get(invoice.clientId);
    const userProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', q => q.eq('userId', userId))
      .first();

    return {
      ...invoice,
      client,
      userProfile,
    };
  },
});

// Create invoice
export const createInvoice = mutation({
  args: {
    clientId: v.id('clients'),
    invoiceNumber: v.optional(v.string()),
    invoiceDate: v.optional(v.number()),
    paymentDate: v.optional(v.number()),
    status: v.optional(v.string()),
    totalAmount: v.optional(v.number()),
    uploadedInvoiceId: v.optional(v.id('_storage')),
    items: v.array(
      v.object({
        serviceId: v.id('services'),
        label: v.string(),
        quantity: v.number(),
        price: v.number(),
        discount: v.optional(v.number()),
        discountUnit: v.optional(v.string()),
        discountText: v.optional(v.string()),
        total: v.number(),
      }),
    ),
  },
  handler: async (ctx, args): Promise<Id<'invoices'>> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    // Use provided values or generate defaults
    const invoiceNumber: string = args.invoiceNumber || (await ctx.runQuery(api.invoices.generateInvoiceNumber));
    const now = Date.now();
    const invoiceDate = args.invoiceDate || now;
    const paymentDate = args.paymentDate || calculatePaymentDate(invoiceDate);
    const totalAmount = args.totalAmount || args.items.reduce((sum, item) => sum + item.total, 0);
    const status = args.status || 'draft';

    // Create the invoice with all fields
    const invoiceData: any = {
      userId,
      clientId: args.clientId,
      invoiceNumber,
      invoiceDate,
      paymentDate,
      status,
      totalAmount,
      items: args.items,
    };

    // Add uploadedInvoiceId if provided
    if (args.uploadedInvoiceId) {
      invoiceData.uploadedInvoiceId = args.uploadedInvoiceId;
    }

    const invoiceId: Id<'invoices'> = await ctx.db.insert('invoices', invoiceData);

    return invoiceId;
  },
});

// Update invoice
export const updateInvoice = mutation({
  args: {
    id: v.id('invoices'),
    clientId: v.optional(v.id('clients')), // Allow changing client
    items: v.array(
      v.object({
        serviceId: v.id('services'),
        label: v.string(),
        quantity: v.number(),
        price: v.number(),
        discount: v.optional(v.number()),
        discountUnit: v.optional(v.string()),
        discountText: v.optional(v.string()), // Add missing discountText field
        total: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const invoice = await ctx.db.get(args.id);
    if (!invoice || invoice.userId !== userId) {
      throw new Error('Invoice not found');
    }

    const totalAmount = args.items.reduce((sum, item) => sum + item.total, 0);

    // Create patch object with required fields
    const patchObj: any = {
      items: args.items,
      totalAmount,
    };

    // Add clientId to patch if provided
    if (args.clientId) {
      patchObj.clientId = args.clientId;
    }

    await ctx.db.patch(args.id, patchObj);
  },
});

// Mark invoice as sent
export const markInvoiceAsSent = mutation({
  args: { id: v.id('invoices') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const invoice = await ctx.db.get(args.id);
    if (!invoice || invoice.userId !== userId) {
      throw new Error('Invoice not found');
    }

    await ctx.db.patch(args.id, { status: 'sent' });
  },
});

// Update invoice status
export const updateInvoiceStatus = mutation({
  args: {
    id: v.id('invoices'),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const invoice = await ctx.db.get(args.id);
    if (!invoice || invoice.userId !== userId) {
      throw new Error('Invoice not found');
    }

    await ctx.db.patch(args.id, { status: args.status });
  },
});

// Toggle invoice status between sent and paid
export const toggleInvoiceStatus = mutation({
  args: {
    id: v.id('invoices'),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const invoice = await ctx.db.get(args.id);
    if (!invoice || invoice.userId !== userId) {
      throw new Error('Invoice not found');
    }

    if (args.status !== 'sent' && args.status !== 'paid') {
      throw new Error('Invalid status for toggling');
    }

    const newStatus = args.status === 'sent' ? 'paid' : 'sent';

    await ctx.db.patch(args.id, { status: newStatus });
  },
});

// Delete invoice
export const deleteInvoice = mutation({
  args: { id: v.id('invoices') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const invoice = await ctx.db.get(args.id);
    if (!invoice || invoice.userId !== userId) {
      throw new Error('Invoice not found');
    }

    // Delete associated PDF files from storage if they exist
    if (invoice.pdfStorageId) {
      await ctx.storage.delete(invoice.pdfStorageId);
    }
    if (invoice.uploadedInvoiceId) {
      await ctx.storage.delete(invoice.uploadedInvoiceId);
    }

    await ctx.db.delete(args.id);
  },
});

// Duplicate invoice
export const duplicateInvoice = mutation({
  args: { id: v.id('invoices') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const originalInvoice = await ctx.db.get(args.id);
    if (!originalInvoice || originalInvoice.userId !== userId) {
      throw new Error('Invoice not found');
    }

    // Generate new invoice number using the same logic as createInvoice
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `${year}${month}`;

    // Find the highest invoice number for this month
    const invoices = await ctx.db
      .query('invoices')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();

    const monthInvoices = invoices.filter(inv => inv.invoiceNumber.startsWith(prefix));
    const maxNumber = monthInvoices.reduce((max, inv) => {
      const num = parseInt(inv.invoiceNumber.slice(-2));
      return Math.max(max, num);
    }, 0);

    const nextNumber = String(maxNumber + 1).padStart(2, '0');
    const invoiceNumber = `${prefix}${nextNumber}`;

    // Create duplicate with new data
    const currentDate = Date.now();
    const paymentDate = calculatePaymentDate(currentDate);
    const duplicateData = {
      userId,
      invoiceNumber,
      clientId: originalInvoice.clientId, // Keep original client, can be changed in editor
      items: originalInvoice.items,
      totalAmount: originalInvoice.totalAmount,
      status: 'draft' as const,
      invoiceDate: currentDate,
      paymentDate,
    };

    return await ctx.db.insert('invoices', duplicateData);
  },
});

// Update invoice PDF storage ID
export const updateInvoicePDF = mutation({
  args: {
    invoiceId: v.id('invoices'),
    pdfStorageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.userId !== userId) {
      throw new Error('Invoice not found');
    }

    await ctx.db.patch(args.invoiceId, {
      pdfStorageId: args.pdfStorageId,
    });
  },
});

// Check if an invoice with the given number already exists
export const checkInvoiceExists = mutation({
  args: { invoiceNumber: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const existingInvoice = await ctx.db
      .query('invoices')
      .withIndex('by_user_and_number', q => q.eq('userId', userId).eq('invoiceNumber', args.invoiceNumber))
      .first();

    if (existingInvoice) {
      throw new Error(`DUPLICATE_INVOICE`);
    }

    return false;
  },
});