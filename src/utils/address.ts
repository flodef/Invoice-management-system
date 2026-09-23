export interface StructuredAddress {
  street: string;
  postalCode: string;
  city: string;
}

export const postalCodeRegex = /^\d{5}$/;
export const postalCodePartialRegex = /^\d{0,5}$/;

/** Sérialise le trio rue/CP/commune — même format que Job Conciergerie : « rue, CP commune ». */
export const formatStructuredAddress = ({ street, postalCode, city }: StructuredAddress): string =>
  [street.trim(), [postalCode.trim(), city.trim()].filter(Boolean).join(' ')].filter(Boolean).join(', ');

/** Éclate « rue, CP commune » en trio ; sans CP à 5 chiffres, tout part dans la rue. */
export const parseStructuredAddress = (value: string): StructuredAddress => {
  const m = value.match(/^(.*?),?\s*(\d{5})\s+(.+)$/);
  return m
    ? {
        street: m[1].trim().replace(/,$/, ''),
        postalCode: m[2],
        city: m[3].trim().replace(/\s+france$/i, ''),
      }
    : { street: value, postalCode: '', city: '' };
};

export const fetchCommunesForPostalCode = async (postalCode: string): Promise<string[]> => {
  const res = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${postalCode}&fields=nom&format=json`);
  if (!res.ok) return [];
  const data = (await res.json()) as { nom: string }[];
  return Array.isArray(data) ? data.map(c => c.nom) : [];
};
