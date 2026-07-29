import { useId } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Select({
  label,
  error,
  required = false,
  options = [],
  placeholder,
  className = '',
  id: idProp,
  onChange,
  value,
  disabled,
  ...props
}) {
  const generatedId = useId();
  const id = idProp || generatedId;

  const handleChange = (e) => {
    if (onChange) {
      if (e.target.multiple) {
        onChange(Array.from(e.target.selectedOptions, (option) => option.value));
      } else {
        onChange(e.target.value);
      }
    }
  };

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-700">
          {label}
          {required && <span className="ml-0.5 text-danger-600" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          value={value || ''}
          onChange={handleChange}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          required={required}
          className={`focus-ring h-10 w-full appearance-none rounded-lg border bg-surface pl-3 pr-9 text-sm text-ink-900 transition-colors disabled:cursor-not-allowed disabled:bg-canvas ${
            error ? 'border-danger-600' : 'border-line-strong hover:border-ink-400'
          }`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => {
            const optionValue = typeof option === 'string' ? option : option.value;
            const optionLabel = typeof option === 'string' ? option : option.label;
            return (
              <option key={optionValue} value={optionValue}>
                {optionLabel}
              </option>
            );
          })}
        </select>
        <ChevronDown
          size={15}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
          aria-hidden="true"
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-danger-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
