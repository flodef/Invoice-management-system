import { v } from 'convex/values';
import { httpAction, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { calculatePaymentDate } from './utils';
import type { Id } from './_generated/dataModel';

function roundToTwoDecimals(num: number): number {
  return parseFloat(num.toFixed(2));
}

// Client matching must tolerate naming differences between the two systems —
// "Calluna" (Job Conciergerie) vs "Calluna Conciergerie" (IMS),
// "MENTHEREGLISSE" vs "MENTHERÉGLISSE". Normalize case, accents and drop the
// "conciergerie" suffix word before comparing.
const normalizeClientName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bconciergerie\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Server-to-server invoice import — called by the Job Conciergerie billing
 * cron after it creates a local invoice. No user session: the deployment is
 * single-user, so the owner is resolved from the first userProfile row.
 *
 * Idempotent two ways:
 * - same client + same period-labelled item already imported → return it;
 * - the client already has ANY invoice numbered this month (e.g. a manually
 *   created invoice covering the same billing) → skip, don't duplicate.
 */
export const createExternal = internalMutation({
  args: {
    clientName: v.string(),
    clientEmail: v.optional(v.string()),
    serviceLabel: v.string(), // stable service name, e.g. "Abonnement Job Conciergerie — Pro"
    periodLabel: v.optional(v.string()), // e.g. "08/2026" — appended to the item label
    unitPrice: v.number(),
    discount: v.optional(v.number()),
    invoiceDate: v.optional(v.string()), // ISO date
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.query('userProfiles').first();
    if (!profile) throw new Error('No user profile configured');
    const userId = profile.userId;

    // Client: normalized match first, create a minimal record otherwise.
    const clients = await ctx.db
      .query('clients')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();
    const wanted = normalizeClientName(args.clientName);
    let clientId: Id<'clients'> | undefined = clients.find(c => normalizeClientName(c.name) === wanted)?._id;
    if (!clientId) {
      clientId = await ctx.db.insert('clients', {
        userId,
        name: args.clientName,
        contactName: '',
        address: '',
        email: args.clientEmail ?? '',
        legalForm: '',
        isActive: true,
      });
    }

    // Service: stable label (no period — the billed month lives on the item).
    const services = await ctx.db
      .query('services')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();
    let serviceId: Id<'services'> | undefined = services.find(s => s.label === args.serviceLabel)?._id;
    if (!serviceId) {
      serviceId = await ctx.db.insert('services', {
        userId,
        label: args.serviceLabel,
        defaultPrice: args.unitPrice,
        isActive: true,
      });
    }

    const itemLabel = args.periodLabel ? `${args.serviceLabel} (${args.periodLabel})` : args.serviceLabel;
    const invoiceDate = args.invoiceDate ? new Date(args.invoiceDate).getTime() : Date.now();
    const d = new Date(invoiceDate);
    const prefix = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;

    const invoices = await ctx.db
      .query('invoices')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();

    // Dedup: the client already has an invoice numbered this month — either
    // our previous import or a manually created one covering this billing.
    const existing = invoices.find(inv => inv.clientId === clientId && inv.invoiceNumber.startsWith(prefix));
    if (existing) {
      return { invoiceId: existing._id, invoiceNumber: existing.invoiceNumber, created: false };
    }

    const discount = Math.min(100, Math.max(0, args.discount ?? 0));
    const total = roundToTwoDecimals(args.unitPrice * (1 - discount / 100));

    // Numbering mirrors invoices.generateInvoiceNumber: YYYYMM + 2-digit seq.
    const maxNumber = invoices
      .filter(inv => inv.invoiceNumber.startsWith(prefix))
      .reduce((max, inv) => Math.max(max, parseInt(inv.invoiceNumber.slice(-2)) || 0), 0);
    const invoiceNumber = `${prefix}${String(maxNumber + 1).padStart(2, '0')}`;

    const invoiceId = await ctx.db.insert('invoices', {
      userId,
      clientId,
      invoiceNumber,
      invoiceDate,
      paymentDate: calculatePaymentDate(invoiceDate),
      status: 'sent',
      totalAmount: total,
      items: [
        {
          serviceId,
          label: itemLabel,
          quantity: 1,
          price: args.unitPrice,
          ...(discount > 0 ? { discount, discountUnit: '%', discountText: 'Remise négociée' } : {}),
          total,
        },
      ],
    });

    return { invoiceId, invoiceNumber, created: true };
  },
});

/**
 * POST /import-invoice — bearer-authenticated entry point for external
 * systems. The secret is a deployment env var (IMS_IMPORT_SECRET), never in
 * the codebase.
 */
export const importInvoice = httpAction(async (ctx, request) => {
  const secret = process.env.IMS_IMPORT_SECRET;
  const unauthorized = () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  if (!secret) return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }
  const args = body as {
    clientName?: string;
    clientEmail?: string;
    serviceLabel?: string;
    periodLabel?: string;
    unitPrice?: number;
    discount?: number;
    invoiceDate?: string;
  };
  if (!args.clientName || !args.serviceLabel || typeof args.unitPrice !== 'number') {
    return new Response(JSON.stringify({ error: 'clientName, serviceLabel and unitPrice are required' }), {
      status: 400,
    });
  }

  const result = await ctx.runMutation(internal.importInvoice.createExternal, {
    clientName: args.clientName,
    clientEmail: args.clientEmail,
    serviceLabel: args.serviceLabel,
    periodLabel: args.periodLabel,
    unitPrice: args.unitPrice,
    discount: args.discount,
    invoiceDate: args.invoiceDate,
  });

  return new Response(JSON.stringify({ ok: true, ...result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
