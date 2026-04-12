
export function FocusableSelectWidget(props: any) {
  const { options, value, onChange, disabled } = props;

  return (
    <select
      className="w-full border rounded-md p-2"
      value={value ?? ""}
      disabled={disabled}
      tabIndex={0}         
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled hidden>
        Select an option
      </option>
      {options.enumOptions?.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
