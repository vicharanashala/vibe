import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export function FocusableSelectWidget(props: any) {
  const { options, value, onChange, disabled, placeholder } = props;

  return (
    <Select
      value={value ?? undefined}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-full h-9 bg-background text-foreground border border-input focus-visible:ring-2 focus-visible:ring-ring">
        <SelectValue placeholder={placeholder || "Select an option"} />
      </SelectTrigger>

      <SelectContent>
        {options?.enumOptions?.map((opt: any) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
