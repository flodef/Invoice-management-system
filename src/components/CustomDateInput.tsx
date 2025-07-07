import { IconCalendar } from '@tabler/icons-react';
import { useRef } from 'react';

interface CustomDateInputProps {
  value: string; // Expects date in YYYY-MM-DD format
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

const formatDateForDisplay = (dateString: string) => {
  if (!dateString) return 'jj/mm/aaaa';
  const date = new Date(dateString);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

export function CustomDateInput({ value, onChange, disabled, readOnly }: CustomDateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!disabled && !readOnly) {
      inputRef.current?.showPicker();
    }
  };

  return (
    <div className="relative">
      <div
        className={`w-full rounded-md border border-gray-300 h-10 px-3 flex items-center justify-between ${readOnly || disabled ? 'bg-gray-200 cursor-not-allowed' : 'bg-white cursor-pointer'}`}
        onClick={handleClick}
      >
        <span className={`${value ? 'text-black' : 'text-gray-400'}`}>{formatDateForDisplay(value)}</span>
        {!readOnly && <IconCalendar size={20} className="text-gray-500" />}
      </div>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled || readOnly}
        className="opacity-0 absolute top-0 left-0 w-full h-full pointer-events-none"
        tabIndex={-1} // Prevent tabbing to the hidden input
      />
    </div>
  );
}
