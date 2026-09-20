'use node';

import { internalAction } from './_generated/server';
import { v } from 'convex/values';

/**
 * Push an invoice status change back to Job Conciergerie — its `invoices`
 * table is the billing source of truth ('pending' → 'sent' → 'paid').
 * Scheduled (runAfter 0) from the status mutations for invoices imported
 * from JC (source='job-conciergerie'); mutations can't do network I/O.
 *
 * Env (Convex deployment):
 *   JC_STATUS_URL      — e.g. https://app.job-conciergerie.fr
 *   IMS_IMPORT_SECRET  — same shared bearer as /import-invoice
 */
export const notifyJobConciergerie = internalAction({
  args: { invoiceNumber: v.string(), status: v.string() },
  handler: async (_ctx, args) => {
    const url = process.env.JC_STATUS_URL;
    const secret = process.env.IMS_IMPORT_SECRET;
    if (!url || !secret) return;

    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/api/invoice-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ invoiceNumber: args.invoiceNumber, status: args.status }),
      });
      if (!response.ok) console.error(`JC status sync failed (${response.status}): ${await response.text()}`);
    } catch (error) {
      console.error('JC status sync error:', error);
    }
  },
});
