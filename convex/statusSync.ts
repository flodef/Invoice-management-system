'use node';

import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction } from './_generated/server';

/**
 * Push an invoice status change back to Job Conciergerie — its `invoices`
 * table is the billing source of truth ('pending' → 'sent' → 'paid').
 * Scheduled (runAfter 0) from the status mutations for invoices imported
 * from JC (source='job-conciergerie'); mutations can't do network I/O.
 *
 * Reliability: the call is retried a few times (backoff below). If every
 * attempt fails, a 'paid' toggle is reverted to 'sent' via
 * revertPaidToSent — the invoice visibly stays unpaid in IMS and re-marking
 * it paid re-triggers the whole sync. 'sent' desyncs are benign (JC treats
 * pending/sent alike for reminders and suspension) so they only get logged.
 *
 * Env (Convex deployment):
 *   JC_STATUS_URL      — e.g. https://app.job-conciergerie.fr
 *   IMS_IMPORT_SECRET  — same shared bearer as /import-invoice
 */
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000];

export const notifyJobConciergerie = internalAction({
  args: { invoiceNumber: v.string(), status: v.string(), attempt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const url = process.env.JC_STATUS_URL;
    const secret = process.env.IMS_IMPORT_SECRET;
    if (!url || !secret) {
      console.error('JC status sync skipped: JC_STATUS_URL / IMS_IMPORT_SECRET unset on this deployment');
      return;
    }

    const attempt = args.attempt ?? 0;
    let delivered = false;
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/api/invoice-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ invoiceNumber: args.invoiceNumber, status: args.status }),
      });
      delivered = response.ok;
      if (!response.ok) console.error(`JC status sync failed (${response.status}): ${await response.text()}`);
    } catch (error) {
      console.error('JC status sync error:', error);
    }
    if (delivered) return;

    if (attempt < RETRY_DELAYS_MS.length) {
      await ctx.scheduler.runAfter(RETRY_DELAYS_MS[attempt], internal.statusSync.notifyJobConciergerie, {
        invoiceNumber: args.invoiceNumber,
        status: args.status,
        attempt: attempt + 1,
      });
      return;
    }

    if (args.status === 'paid') {
      await ctx.runMutation(internal.invoices.revertPaidToSent, { invoiceNumber: args.invoiceNumber });
      console.error(`JC status sync gave up on ${args.invoiceNumber} — invoice reverted to 'sent'`);
    } else {
      console.error(`JC status sync gave up on ${args.invoiceNumber} (status '${args.status}')`);
    }
  },
});
