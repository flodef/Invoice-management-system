import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Factures récurrentes : envoi le 1er du mois à 08:00 Europe/Paris — soit
// 06:00 UTC en heure d'hiver (CET) et 07:00 UTC en heure d'été (CEST). Les
// deux crons sont déclarés ; le garde horaire dans runMonthlyRecurring ne
// laisse agir que le créneau correspondant à 08:00 à Paris.
crons.cron('monthly-recurring-invoices-0600utc', '0 6 1 * *', internal.recurring.runMonthlyRecurring, {});
crons.cron('monthly-recurring-invoices-0700utc', '0 7 1 * *', internal.recurring.runMonthlyRecurring, {});

export default crons;
