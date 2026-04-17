
export function FocusableSelectWidget(props: any) {
  const { options, value, onChange, disabled } = props;

  return (
    <select
      className="flex h-9 w-full rounded-md border border-input px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      value={value ?? ""}
      disabled={disabled}
      tabIndex={0}         
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled hidden className="text-foreground bg-background">
        Select an option
      </option>
      {options.enumOptions?.map((opt) => (
        <option key={opt.value} value={opt.value} className="text-foreground bg-background">
          {opt.label}
        </option>
      ))}
    </select>
  );
}
