import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalAction, internalMutation } from './_generated/server';
import { nextInvoiceNumber } from './invoices';
import { isExternalSource } from './sources';
import { calculatePaymentDate } from './utils';

interface ParisParts {
  year: number;
  month: number; // 0-based, comme Date#getMonth
  day: number;
  hour: number;
}

// Règle EU explicite pour Europe/Paris : UTC+2 (CEST) entre le dernier
// dimanche de mars et le dernier dimanche d'octobre, bascule à 01:00 UTC ;
// UTC+1 (CET) sinon. Sert de référence et de repli si Intl/timeZone n'est
// pas supporté par le runtime Convex.
const lastSundayAt1UTC = (year: number, monthIndex: number): number => {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  return Date.UTC(year, monthIndex, lastDay.getUTCDate() - lastDay.getUTCDay(), 1);
};

const parisPartsEuRule = (date: Date): ParisParts => {
  const year = date.getUTCFullYear();
  const summer = date.getTime() >= lastSundayAt1UTC(year, 2) && date.getTime() < lastSundayAt1UTC(year, 9);
  const shifted = new Date(date.getTime() + (summer ? 2 : 1) * 3_600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
  };
};

const parisParts = (date: Date): ParisParts => {
  const fallback = parisPartsEuRule(date);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Paris',
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
    }).formatToParts(date);
    const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
    const intl = { year: get('year'), month: get('month') - 1, day: get('day'), hour: get('hour') };
    // Certains runtimes ignorent timeZone sans lever — si Intl et la règle EU
    // divergent on fait confiance à la règle EU.
    const same =
      intl.year === fallback.year &&
      intl.month === fallback.month &&
      intl.day === fallback.day &&
      intl.hour === fallback.hour;
    return same ? intl : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Génère une occurrence pour chaque série récurrente qui n'a pas encore de
 * facture le mois courant (heure de Paris). Appelée par le cron — idempotent
 * : si une occurrence (racine incluse) porte déjà une invoiceDate ce mois-ci,
 * la série est sautée. Retourne les ids créés.
 */
export const createMonthlyOccurrences = internalMutation({
  args: {},
  handler: async (ctx): Promise<Id<'invoices'>[]> => {
    const now = new Date();
    const parisNow = parisParts(now);

    // Séries candidates : factures marquées recurring hors sources externes
    // (leurs imports ont leur propre cycle de vie).
    const marked = await ctx.db
      .query('invoices')
      .withIndex('by_recurring', q => q.eq('recurring', true))
      .collect();
    const seriesKeys = new Set<Id<'invoices'>>();
    for (const inv of marked) {
      if (!isExternalSource(inv.source)) seriesKeys.add(inv.recurringFrom ?? inv._id);
    }

    const created: Id<'invoices'>[] = [];
    for (const key of seriesKeys) {
      // Toute la série : la racine + les occurrences qui la référencent —
      // l'occurrence la plus récente (toutes confondues) pilote la suite.
      const root = await ctx.db.get(key);
      const occurrences = await ctx.db
        .query('invoices')
        .withIndex('by_recurring_from', q => q.eq('recurringFrom', key))
        .collect();
      const series = [...(root ? [root] : []), ...occurrences];
      if (series.length === 0) continue;
      const latest = series.reduce((a, b) => (b.invoiceDate > a.invoiceDate ? b : a));

      // Idempotence : une occurrence (racine incluse) existe déjà ce mois-ci
      // → ne rien créer. Comparaison year/month en heure de Paris.
      const alreadyThisMonth = series.some(inv => {
        const p = parisParts(new Date(inv.invoiceDate));
        return p.year === parisNow.year && p.month === parisNow.month;
      });
      if (alreadyThisMonth) continue;

      // La série s'arrête si l'occurrence la plus récente a été démarquée.
      if (latest.recurring !== true || isExternalSource(latest.source)) continue;

      // Séquentiel : nextInvoiceNumber relit la base et doit voir les
      // insertions précédentes de ce run pour ne pas collisionner.
      const invoiceNumber = await nextInvoiceNumber(ctx, latest.userId, now);
      const invoiceId = await ctx.db.insert('invoices', {
        userId: latest.userId,
        clientId: latest.clientId,
        invoiceNumber,
        invoiceDate: now.getTime(),
        // Période facturée = mois échu : dernier jour du mois précédent
        // (heure de Paris), à midi UTC pour éviter les dérives de fuseau.
        serviceEndDate: Date.UTC(parisNow.year, parisNow.month, 0, 12),
        paymentDate: calculatePaymentDate(now.getTime()),
        status: 'draft',
        totalAmount: latest.totalAmount,
        items: latest.items,
        recurring: true,
        recurringFrom: key,
      });
      created.push(invoiceId);
    }
    return created;
  },
});

/**
 * Action cron — à 08:00 Europe/Paris le 1er du mois : génère les occurrences
 * puis les envoie par email une à une. Un échec d'envoi laisse la facture en
 * brouillon pour un envoi manuel ; les autres continuent. `force` saute le
 * garde horaire (tests manuels).
 */
export const runMonthlyRecurring = internalAction({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<{ created: number; sent: number; failed: number }> => {
    if (!args.force) {
      const parisNow = parisParts(new Date());
      if (parisNow.hour !== 8 || parisNow.day !== 1) {
        return { created: 0, sent: 0, failed: 0 };
      }
    }

    const created: Id<'invoices'>[] = await ctx.runMutation(internal.recurring.createMonthlyOccurrences, {});
    let sent = 0;
    let failed = 0;
    for (const invoiceId of created) {
      try {
        await ctx.runAction(internal.email.sendInvoiceEmailInternal, { invoiceId });
        sent += 1;
      } catch (error) {
        console.error(`Envoi auto de la facture ${invoiceId} échoué — reste en brouillon:`, error);
        failed += 1;
      }
    }
    return { created: created.length, sent, failed };
  },
});
