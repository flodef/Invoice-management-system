// Mêmes règles que Job Conciergerie (app/utils/regex.ts).
export const sirenRegex = /^\d{9}$/;
export const siretRegex = /^\d{14}$/;
/** N° TVA intracommunautaire FR : FR + 2 alphanumériques + 9 chiffres. */
export const tvaNumberRegex = /^FR[A-Z0-9]{2}\d{9}$/i;

/** Filtres de saisie — ce que l'utilisateur peut taper, pas la validation. */
export const filterSiren = (v: string) => v.replace(/\D/g, '').slice(0, 9);
export const filterSiret = (v: string) => v.replace(/\D/g, '').slice(0, 14);
export const filterTvaNumber = (v: string) =>
  v
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 13);
