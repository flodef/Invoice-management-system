import { internalMutation } from '../_generated/server';
import { v } from 'convex/values';

const JC_EMAIL = 'flo@job-conciergerie.fr';
const TRADIZ_EMAIL = 'flo@tradiz.fr';
// « Le pain d'annette » facture avec l'email historique — tout le reste
// (Job Conciergerie compris) part de flo@job-conciergerie.fr.
const TRADIZ_MATCH = 'annette';

const normalize = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * One-off : l'email vendeur devient par client (vendorEmail) au lieu de
 * l'email unique du profil. Pose flo@job-conciergerie.fr en email de
 * profil (défaut partout), flo@tradiz.fr en alternative (liste
 * vendorEmails), et l'email vendeur explicite sur chaque client.
 * Idempotent — relançable sans effet.
 */
export const run = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const profile = await ctx.db.query('userProfiles').first();
    if (!profile) throw new Error('No user profile configured');

    const clients = await ctx.db
      .query('clients')
      .withIndex('by_user', q => q.eq('userId', profile.userId))
      .collect();

    const plan = clients.map(c => ({
      id: c._id,
      name: c.name,
      vendorEmail: normalize(c.name).includes(TRADIZ_MATCH) ? TRADIZ_EMAIL : JC_EMAIL,
    }));

    if (!args.dryRun) {
      await ctx.db.patch(profile._id, {
        email: JC_EMAIL,
        vendorEmails: [TRADIZ_EMAIL],
      });
      for (const p of plan) await ctx.db.patch(p.id, { vendorEmail: p.vendorEmail });
    }

    return {
      profile: { email: JC_EMAIL, vendorEmails: [TRADIZ_EMAIL] },
      clients: plan.map(p => `${p.name} → ${p.vendorEmail}`),
      applied: !args.dryRun,
    };
  },
});
