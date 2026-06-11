export default function InputField({
  label,
  name,
  error,
  helperText,
  required = false,
  ...props
}) {
  const inputId = `field-${name}`;

  return (
    <label className="field" htmlFor={inputId}>
      <span className="field-label">
        {label}
        {required ? <em>*</em> : null}
      </span>
      <input
        id={inputId}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error || helperText ? `${inputId}-hint` : undefined}
        {...props}
      />
      {(error || helperText) && (
        <span id={`${inputId}-hint`} className={error ? 'field-error' : 'field-helper'}>
          {error || helperText}
        </span>
      )}
    </label>
  );
}
