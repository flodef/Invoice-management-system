// Rows created through the bearer-authenticated import path — only these may
// be read/mutated by the external endpoints (avoir, suppression, statut).
// 'job-conciergerie*' covers JC (et '-test'), 'tradiz' les imports Tradiz.
// Module partagé frontend/backend : pas de 'use node', pas de fonctions
// Convex — importable tel quel depuis src/.
export const isExternalSource = (source?: string): boolean =>
  !!source && (source.startsWith('job-conciergerie') || source === 'tradiz');

// Label court pour les badges UI — toute source job-conciergerie* = JC.
export const externalSourceLabel = (source?: string): string => (source === 'tradiz' ? 'Tradiz' : 'JC');
