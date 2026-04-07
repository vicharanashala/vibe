
export function FocusableSelectWidget(props: any) {
  const { options, value, onChange, disabled } = props;

  return (
    <select
      className="w-full border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#1a1a1a] dark:text-gray-100 dark:border-zinc-800 rounded-md"
      style={{ colorScheme: "dark" }} // Ensures browser-rendered dropdown is dark
      value={value ?? ""}
      disabled={disabled}
      tabIndex={0}         
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled hidden>
        Select an option
      </option>
      {options.enumOptions?.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
