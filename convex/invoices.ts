import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { calculatePaymentDate } from './utils';

// Get user profile
export const getUserProfile = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query('userProfiles')
      .withIndex('by_user', q => q.eq('userId', userId))
      .first();
  },
});

// Update user profile
export const updateUserProfile = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    address: v.string(),
    freelanceId: v.string(),
    iban: v.string(),
    bic: v.string(),
    bank: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_user', q => q.eq('userId', userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert('userProfiles', { userId, ...args });
    }
  },
});

// Get all clients
export const getClients = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query('clients')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();
  },
});

// Add/update client
export const saveClient = mutation({
  args: {
    id: v.optional(v.id('clients')),
    name: v.string(),
    contactName: v.string(),
    address: v.string(),
    email: v.string(),
    legalForm: v.optional(v.string()),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const { id, ...clientData } = args;

    if (id) {
      await ctx.db.patch(id, clientData);
      return id;
    } else {
      return await ctx.db.insert('clients', { userId, ...clientData });
    }
  },
});

// Delete client
export const deleteClient = mutation({
  args: { id: v.id('clients') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const client = await ctx.db.get(args.id);
    if (!client || client.userId !== userId) {
      throw new Error('Client not found');
    }

    await ctx.db.delete(args.id);
  },
});

// Get all services
export const getServices = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query('services')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();
  },
});

// Add/update service
export const saveService = mutation({
  args: {
    id: v.optional(v.id('services')),
    label: v.string(),
    defaultPrice: v.number(),
    isGlobal: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const { id, ...serviceData } = args;

    if (id) {
      await ctx.db.patch(id, serviceData);

      // If global service updated, update all unsent invoices
      if (serviceData.isGlobal) {
        const invoices = await ctx.db
          .query('invoices')
          .withIndex('by_user', q => q.eq('userId', userId))
          .filter(q => q.eq(q.field('status'), 'draft'))
          .collect();

        for (const invoice of invoices) {
          const updatedItems = invoice.items.map(item =>
            item.serviceId === id
              ? {
                  ...item,
                  label: serviceData.label,
                  price: serviceData.defaultPrice,
                  total: item.quantity * serviceData.defaultPrice,
                }
              : item,
          );
          const newTotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
          await ctx.db.patch(invoice._id, { items: updatedItems, totalAmount: newTotal });
        }
      }

      return id;
    } else {
      return await ctx.db.insert('services', { userId, ...serviceData });
    }
  },
});

// Delete service
export const deleteService = mutation({
  args: { id: v.id('services') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not authenticated');

    const service = await ctx.db.get(args.id);
    if (!service || service.userId !== userId) {
      throw new Error('Service not found');
    }

    await ctx.db.delete(args.id);
  },
});

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
      .withIndex('by_user_and_number', q =>
        q.eq('userId', userId).eq('invoiceNumber', args.invoiceNumber)
      )
      .first();

    if (existingInvoice) {
      throw new Error(`DUPLICATE_INVOICE`);
    }

    return false;
  },
});
