import { useEffect, useState } from 'react';
import { fetchCommunesForPostalCode, postalCodePartialRegex, postalCodeRegex } from '../utils/address';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

interface AddressFieldsProps {
  street: string;
  postalCode: string;
  city: string;
  onStreet: (v: string) => void;
  onPostalCode: (v: string) => void;
  onCity: (v: string) => void;
  streetLabel?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Adresse saisie en trois champs (rue + code postal + commune proposée par
 * geo.api.gouv.fr) — même concept que Job Conciergerie. La commune est un
 * select alimenté dès que le code postal est valide ; la valeur courante
 * reste proposée même hors liste (adresse legacy ou API indisponible).
 */
export function AddressFields({
  street,
  postalCode,
  city,
  onStreet,
  onPostalCode,
  onCity,
  streetLabel = 'Rue',
  disabled = false,
  required = false,
}: AddressFieldsProps) {
  const [communes, setCommunes] = useState<string[]>([]);

  useEffect(() => {
    if (!postalCodeRegex.test(postalCode)) {
      setCommunes([]);
      return;
    }
    let cancelled = false;
    void fetchCommunesForPostalCode(postalCode).then(list => {
      if (!cancelled) setCommunes(list);
    });
    return () => {
      cancelled = true;
    };
  }, [postalCode]);

  const postalValid = postalCodeRegex.test(postalCode);
  const cityOptions = city && !communes.includes(city) ? [city, ...communes] : communes;

  return (
    <>
      <div>
        <label className={labelClass}>{streetLabel}</label>
        <input
          type="text"
          value={street}
          onChange={e => onStreet(e.target.value)}
          placeholder="9 Lanléan"
          className={inputClass}
          required={required}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Code postal</label>
          <input
            type="text"
            value={postalCode}
            onChange={e => {
              const v = e.target.value;
              if (postalCodePartialRegex.test(v)) onPostalCode(v);
            }}
            placeholder="29550"
            inputMode="numeric"
            className={inputClass}
            required={required}
            disabled={disabled}
          />
        </div>
        <div>
          <label className={labelClass}>Commune</label>
          <select
            value={city}
            onChange={e => onCity(e.target.value)}
            className={`${inputClass} bg-white h-[42px]`}
            required={required}
            disabled={disabled || !postalValid}
          >
            <option value="" disabled>
              {postalValid ? 'Choisir une commune…' : "Code postal d'abord"}
            </option>
            {cityOptions.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
