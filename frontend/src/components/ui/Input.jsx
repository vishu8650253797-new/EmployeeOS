import { useId, useCallback } from 'react';

export default function Input({
  label,
  error,
  hint,
  required = false,
  className = '',
  id: idProp,
  onChange,
  value,
  type = 'text',
  placeholder,
  disabled,
  textarea = false,
  rows,
  uppercase = false,
  name,
  autoComplete,
}) {
  const generatedId = useId();
  const id = idProp || generatedId;

  const handleChange = (e) => {
    const inputValue = e.target.value;
    const finalValue = uppercase ? inputValue.toUpperCase() : inputValue;
    if (onChange) {
      onChange(finalValue);
    }
  };

  if (textarea) {
    return (
      <div className={className}>
        {label && (
          <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-700">
            {label}
            {required && <span className="ml-0.5 text-danger-600" aria-hidden="true">*</span>}
          </label>
        )}
        <textarea
          id={id}
          name={name}
          value={value || ''}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows || 3}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          required={required}
          className={`focus-ring w-full rounded-lg border bg-surface px-3 text-sm text-ink-900 placeholder:text-ink-400 transition-colors disabled:cursor-not-allowed disabled:bg-canvas ${
            error ? 'border-danger-600' : 'border-line-strong hover:border-ink-400'
          } ${uppercase ? 'uppercase' : ''}`}
        />
        {error && (
          <p id={`${id}-error`} className="mt-1.5 text-xs text-danger-600" role="alert">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-400">
            {hint}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-700">
          {label}
          {required && <span className="ml-0.5 text-danger-600" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        id={id}
        name={name}
        type={type}
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        required={required}
        className={`focus-ring h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink-900 placeholder:text-ink-400 transition-colors disabled:cursor-not-allowed disabled:bg-canvas ${
          error ? 'border-danger-600' : 'border-line-strong hover:border-ink-400'
        } ${uppercase ? 'uppercase' : ''}`}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-danger-600" role="alert">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-400">
          {hint}
        </p>
      )}
    </div>
  );
}
