import type { Satuan } from '../../types';

interface SatuanSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  satuans: Satuan[];
  disabled?: boolean;
  required?: boolean;
  label?: string;
  placeholder?: string;
  className?: string;
}

export default function SatuanSelector({
  value,
  onChange,
  satuans,
  disabled = false,
  required = false,
  label = 'Satuan',
  placeholder = 'Pilih satuan',
  className = '',
}: SatuanSelectorProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-sm font-semibold text-text-primary">
        {label}
        {required && <span className="text-accent-red ml-1">*</span>}
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className="form-control"
      >
        <option value="">{placeholder}</option>
        {satuans.map((satuan) => (
          <option key={satuan.id} value={satuan.nama}>
            {satuan.nama}
          </option>
        ))}
      </select>
    </div>
  );
}
