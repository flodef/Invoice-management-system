import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
import { action, query } from './_generated/server';

/**
 * Store an uploaded invoice file
 */
export const storeUploadedInvoice = action({
  args: {
    file: v.any(),
    clientId: v.id('clients'),
    invoiceDate: v.number(),
    invoiceNumber: v.string(),
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
    totalAmount: v.number(),
  },
  handler: async (ctx, args): Promise<{ invoiceId: Id<'invoices'>; storageId: Id<'_storage'> }> => {
    // Upload the file to storage
    const storageId = await ctx.storage.store(args.file);

    // Calculate payment date (invoice date + 1 month)
    const paymentDate = new Date(args.invoiceDate);
    paymentDate.setMonth(paymentDate.getMonth() + 1);

    // Insert the invoice into the database using insertInvoice mutation
    const invoiceId = await ctx.runMutation(api.invoices.createInvoice, {
      clientId: args.clientId,
      invoiceNumber: args.invoiceNumber,
      invoiceDate: args.invoiceDate,
      paymentDate: paymentDate.getTime(),
      status: 'sent', // Uploaded invoices are already sent
      items: args.items,
      totalAmount: args.totalAmount,
      uploadedInvoiceId: storageId,
    });

    return { invoiceId, storageId };
  },
});

/**
 * Get the URL for an uploaded invoice file
 */
export const getUploadedInvoiceUrl = action({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Generate a new invoice number based on the date
 */
export const generateInvoiceNumber = query({
  args: { invoiceDate: v.number() },
  handler: async (ctx, args): Promise<string> => {
    const date = new Date(args.invoiceDate);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const yearMonth = `${year}${month}`;

    // Get count of invoices with this year/month
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Non autorisé');

    const startOfMonth = new Date(year, date.getMonth(), 1).getTime();
    const startOfNextMonth = new Date(year, date.getMonth() + 1, 1).getTime();

    const invoices = await ctx.db
      .query('invoices')
      .withIndex('by_user')
      .filter(q => q.eq(q.field('userId'), userId))
      .filter(q => q.gte(q.field('invoiceDate'), startOfMonth))
      .filter(q => q.lt(q.field('invoiceDate'), startOfNextMonth))
      .collect();

    // Format number as YYYYMMXX
    const count = (invoices.length + 1).toString().padStart(2, '0');
    return `${yearMonth}${count}`;
  },
});
