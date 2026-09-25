import { v } from 'convex/values';
import { httpAction, internalMutation } from './_generated/server';
import { api, internal } from './_generated/api';
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
    clientAddress: v.optional(v.string()),
    clientLegalForm: v.optional(v.string()),
    clientSiren: v.optional(v.string()),
    clientTvaNumber: v.optional(v.string()),
    serviceLabel: v.string(), // stable service name, e.g. "Abonnement Job Conciergerie — Pro"
    periodLabel: v.optional(v.string()), // e.g. "08/2026" — appended to the item label
    unitPrice: v.number(),
    discount: v.optional(v.number()),
    invoiceDate: v.optional(v.string()), // ISO date
    serviceEndDate: v.optional(v.string()), // ISO date — fin de prestation
    test: v.optional(v.boolean()), // admin testing — TEST- draft, see below
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.query('userProfiles').first();
    if (!profile) throw new Error('No user profile configured');
    const userId = profile.userId;

    // Client: normalized match first, create a record otherwise. An existing
    // record is only ENRICHED — fields the payload provides fill the gaps,
    // never overwrite what the user typed by hand.
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
        address: args.clientAddress ?? '',
        email: args.clientEmail ?? '',
        legalForm: args.clientLegalForm ?? '',
        siren: args.clientSiren,
        tvaNumber: args.clientTvaNumber,
        isActive: true,
      });
    } else {
      const existing = clients.find(c => c._id === clientId)!;
      const patch: Record<string, string> = {};
      if (!existing.address && args.clientAddress) patch.address = args.clientAddress;
      if (!existing.email && args.clientEmail) patch.email = args.clientEmail;
      if (!existing.legalForm && args.clientLegalForm) patch.legalForm = args.clientLegalForm;
      if (!existing.siren && args.clientSiren) patch.siren = args.clientSiren;
      if (!existing.tvaNumber && args.clientTvaNumber) patch.tvaNumber = args.clientTvaNumber;
      if (Object.keys(patch).length > 0) await ctx.db.patch(clientId, patch);
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
    const serviceEndDate = args.serviceEndDate ? new Date(args.serviceEndDate).getTime() : undefined;
    const d = new Date(invoiceDate);
    const prefix = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;

    const invoices = await ctx.db
      .query('invoices')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();

    // Dedup: the client already has an invoice numbered this month — either
    // our previous import or a manually created one covering this billing.
    const discount = Math.min(100, Math.max(0, args.discount ?? 0));
    const total = roundToTwoDecimals(args.unitPrice * (1 - discount / 100));
    const items = [
      {
        serviceId,
        label: itemLabel,
        quantity: 1,
        price: args.unitPrice,
        ...(discount > 0 ? { discount, discountUnit: '%', discountText: 'Remise négociée' } : {}),
        total,
      },
    ];

    // Test mode (JC admin "Facture" section): a dedicated TEST- draft per
    // client, refreshed on each call — it never joins the real YYYYMM
    // numbering, which must stay gapless for French accounting.
    if (args.test) {
      const testNumber = `TEST-${clientId.slice(-4).toUpperCase()}`;
      const existingTest = invoices.find(inv => inv.clientId === clientId && inv.invoiceNumber === testNumber);
      if (existingTest) {
        await ctx.db.patch(existingTest._id, {
          invoiceDate,
          serviceEndDate,
          paymentDate: calculatePaymentDate(invoiceDate),
          totalAmount: total,
          items,
        });
        return { invoiceId: existingTest._id, invoiceNumber: existingTest.invoiceNumber, created: false };
      }
      const invoiceId = await ctx.db.insert('invoices', {
        userId,
        clientId,
        invoiceNumber: testNumber,
        invoiceDate,
        serviceEndDate,
        paymentDate: calculatePaymentDate(invoiceDate),
        status: 'draft',
        source: 'job-conciergerie-test',
        totalAmount: total,
        items,
      });
      return { invoiceId, invoiceNumber: testNumber, created: true };
    }

    const existing = invoices.find(inv => inv.clientId === clientId && inv.invoiceNumber.startsWith(prefix));
    if (existing) {
      return { invoiceId: existing._id, invoiceNumber: existing.invoiceNumber, created: false };
    }

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
      serviceEndDate,
      paymentDate: calculatePaymentDate(invoiceDate),
      status: 'sent',
      source: 'job-conciergerie',
      totalAmount: total,
      items,
    });

    return { invoiceId, invoiceNumber, created: true };
  },
});

// Shared bearer auth — the secret is a deployment env var
// (IMS_IMPORT_SECRET), never in the codebase. trim() : un whitespace
// glissé dans la var (copier-coller, export multiligne) invaliderait
// silencieusement tous les appels JC → IMS.
const checkAuth = (request: Request): Response | null => {
  const secret = process.env.IMS_IMPORT_SECRET?.trim();
  if (!secret) return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  return null;
};

interface InvoiceArgs {
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  clientLegalForm?: string;
  clientSiren?: string;
  clientTvaNumber?: string;
  serviceLabel: string;
  periodLabel?: string;
  unitPrice: number;
  discount?: number;
  invoiceDate?: string;
  serviceEndDate?: string;
}

const parseJsonBody = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }
};

const validateInvoiceArgs = (body: unknown): InvoiceArgs | Response => {
  const args = body as Partial<InvoiceArgs>;
  if (!args.clientName || !args.serviceLabel || typeof args.unitPrice !== 'number') {
    return new Response(JSON.stringify({ error: 'clientName, serviceLabel and unitPrice are required' }), {
      status: 400,
    });
  }
  return args as InvoiceArgs;
};

const jsonResponse = (data: object, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * POST /import-invoice — bearer-authenticated entry point for external
 * systems.
 */
export const importInvoice = httpAction(async (ctx, request) => {
  const authError = checkAuth(request);
  if (authError) return authError;

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;
  const args = validateInvoiceArgs(body);
  if (args instanceof Response) return args;

  const result = await ctx.runMutation(internal.importInvoice.createExternal, {
    clientName: args.clientName,
    clientEmail: args.clientEmail,
    clientAddress: args.clientAddress,
    clientLegalForm: args.clientLegalForm,
    clientSiren: args.clientSiren,
    clientTvaNumber: args.clientTvaNumber,
    serviceLabel: args.serviceLabel,
    periodLabel: args.periodLabel,
    unitPrice: args.unitPrice,
    discount: args.discount,
    invoiceDate: args.invoiceDate,
    serviceEndDate: args.serviceEndDate,
  });
  return jsonResponse({ ok: true, ...result });
});

/**
 * POST /send-invoice-email — bearer-authenticated. Runs the standard invoice
 * email flow (generated PDF attached, owner in bcc) on an imported invoice,
 * then marks it sent — the client-facing email is the real accounting
 * document. Called by the Job Conciergerie billing cron right after import.
 */
export const sendInvoiceEmailHttp = httpAction(async (ctx, request) => {
  const authError = checkAuth(request);
  if (authError) return authError;

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;
  const invoiceNumber = (body as { invoiceNumber?: string }).invoiceNumber;
  if (!invoiceNumber) {
    return new Response(JSON.stringify({ error: 'invoiceNumber is required' }), { status: 400 });
  }

  const invoice = await ctx.runQuery(internal.invoices.getByInvoiceNumber, { invoiceNumber });
  if (!invoice) return new Response(JSON.stringify({ error: 'Invoice not found' }), { status: 404 });

  try {
    // Internal action — generates the PDF, emails the client (owner in bcc)
    // and marks the invoice sent, all without a user session.
    await ctx.runAction(internal.email.sendInvoiceEmailInternal, { invoiceId: invoice._id });
  } catch (error) {
    console.error('sendInvoiceEmail failed:', error);
    return new Response(JSON.stringify({ error: 'Send failed' }), { status: 502 });
  }

  return jsonResponse({ ok: true });
});

/**
 * POST /test-invoice-pdf — bearer-authenticated. Creates/refreshes the
 * client's TEST- draft invoice, generates its PDF and returns a storage URL —
 * powers the JC admin "Tester le PDF" button. Nothing is emailed.
 */
export const testInvoicePdf = httpAction(async (ctx, request) => {
  const authError = checkAuth(request);
  if (authError) return authError;

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;
  const args = validateInvoiceArgs(body);
  if (args instanceof Response) return args;

  const { invoiceId, invoiceNumber } = await ctx.runMutation(internal.importInvoice.createExternal, {
    clientName: args.clientName,
    clientEmail: args.clientEmail,
    clientAddress: args.clientAddress,
    clientLegalForm: args.clientLegalForm,
    clientSiren: args.clientSiren,
    clientTvaNumber: args.clientTvaNumber,
    serviceLabel: args.serviceLabel,
    periodLabel: args.periodLabel,
    unitPrice: args.unitPrice,
    discount: args.discount,
    invoiceDate: args.invoiceDate,
    serviceEndDate: args.serviceEndDate,
    test: true,
  });
  const { storageId } = await ctx.runAction(internal.pdf.generateInvoicePDFInternal, { invoiceId });
  const pdfUrl = await ctx.runAction(api.pdf.getStorageUrl, { storageId });

  return jsonResponse({ ok: true, invoiceNumber, pdfUrl });
});

/**
 * POST /test-invoice-email — bearer-authenticated. Same as /test-invoice-pdf
 * plus the full client-facing send flow, except the recipient is overridden
 * to `recipientEmail` — the real client is never emailed, the owner bcc is
 * skipped and the TEST- draft stays unsent.
 */
export const testInvoiceEmail = httpAction(async (ctx, request) => {
  const authError = checkAuth(request);
  if (authError) return authError;

  const body = await parseJsonBody(request);
  if (body instanceof Response) return body;
  const { recipientEmail } = body as { recipientEmail?: string };
  if (!recipientEmail) {
    return new Response(JSON.stringify({ error: 'recipientEmail is required' }), { status: 400 });
  }
  const args = validateInvoiceArgs(body);
  if (args instanceof Response) return args;

  const { invoiceId, invoiceNumber } = await ctx.runMutation(internal.importInvoice.createExternal, {
    clientName: args.clientName,
    clientEmail: args.clientEmail,
    clientAddress: args.clientAddress,
    clientLegalForm: args.clientLegalForm,
    clientSiren: args.clientSiren,
    clientTvaNumber: args.clientTvaNumber,
    serviceLabel: args.serviceLabel,
    periodLabel: args.periodLabel,
    unitPrice: args.unitPrice,
    discount: args.discount,
    invoiceDate: args.invoiceDate,
    serviceEndDate: args.serviceEndDate,
    test: true,
  });

  try {
    await ctx.runAction(internal.email.sendInvoiceEmailInternal, {
      invoiceId,
      testRecipient: recipientEmail,
    });
  } catch (error) {
    console.error('testInvoiceEmail failed:', error);
    return new Response(JSON.stringify({ error: 'Send failed' }), { status: 502 });
  }

  return jsonResponse({ ok: true, invoiceNumber });
});
