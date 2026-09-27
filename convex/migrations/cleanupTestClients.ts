import { internalMutation } from '../_generated/server';
import { v } from 'convex/values';

/**
 * One-off : supprime les clients créés par les imports de test JC
 * (signups E2E sur la base dev). Supprime aussi leurs factures restantes
 * (TEST- brouillons, externes orphelines) et les PDFs associés.
 * Idempotent — relançable sans effet.
 */
export const run = internalMutation({
  args: { dryRun: v.optional(v.boolean()), names: v.array(v.string()) },
  handler: async (ctx, args) => {
    const profile = await ctx.db.query('userProfiles').first();
    if (!profile) throw new Error('No user profile configured');

    const clients = await ctx.db
      .query('clients')
      .withIndex('by_user', q => q.eq('userId', profile.userId))
      .collect();
    const targets = clients.filter(c => args.names.some(n => c.name.toLowerCase() === n.toLowerCase()));

    const invoices = await ctx.db
      .query('invoices')
      .withIndex('by_user', q => q.eq('userId', profile.userId))
      .collect();
    const targetIds = new Set(targets.map(c => c._id));
    const orphanInvoices = invoices.filter(i => targetIds.has(i.clientId));

    if (!args.dryRun) {
      for (const inv of orphanInvoices) {
        if (inv.pdfStorageId) await ctx.storage.delete(inv.pdfStorageId);
        await ctx.db.delete(inv._id);
      }
      for (const c of targets) await ctx.db.delete(c._id);
    }

    return {
      clients: targets.map(c => `${c.name} (${c.email || 'pas d\'email'})`),
      invoices: orphanInvoices.map(i => i.invoiceNumber),
      applied: !args.dryRun,
    };
  },
});
