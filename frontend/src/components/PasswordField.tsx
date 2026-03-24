import React, { useMemo, useState } from "react";

type PasswordFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
};

const validatePassword = (value: string) => {
  const minLength = value.length >= 8;
  const hasDigit = /\d/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  return {
    valid: minLength && hasDigit && hasUpper,
    minLength,
    hasDigit,
    hasUpper,
  };
};

const PasswordField: React.FC<PasswordFieldProps> = ({
  value,
  onChange,
  label = "Password",
  placeholder = "Enter password",
  required = true,
}) => {
  const [visible, setVisible] = useState(false);

  const validation = useMemo(() => validatePassword(value), [value]);
  const showError = required && value.length > 0 && !validation.valid;

  // Determine border color using inline styles for reliability
  const getBorderColor = () => {
    if (value.length === 0) return "#d1d5db"; // gray-300
    if (validation.valid) return "#10b981"; // emerald-500
    return "#ef4444"; // rose-500
  };

  const getRingColor = () => {
    if (value.length === 0) return "rgba(59, 130, 246, 0.1)"; // primary/40
    if (validation.valid) return "rgba(16, 185, 129, 0.2)"; // emerald-200
    return "rgba(239, 68, 68, 0.2)"; // rose-200
  };

  return (
    <div className="w-full max-w-md">
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div 
        className="relative rounded-lg border px-2 py-1 transition-colors duration-200"
        style={{
          borderColor: getBorderColor(),
          boxShadow: `0 0 0 3px ${getRingColor()}`
        }}
      >
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border-none focus:ring-0 outline-none p-2 text-base bg-transparent"
          autoComplete="new-password"
        />

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "🙈" : "👁️"}
        </button>
      </div>

      {showError && (
        <p className="mt-2 text-sm text-rose-600">
          Password must have:
          <ul className="list-disc ml-5 mt-1">
            <li className={!validation.minLength ? "font-semibold" : "text-slate-500"}>8+ characters</li>
            <li className={!validation.hasDigit ? "font-semibold" : "text-slate-500"}>1 number</li>
            <li className={!validation.hasUpper ? "font-semibold" : "text-slate-500"}>1 uppercase letter</li>
          </ul>
        </p>
      )}

      {!showError && value.length > 0 && validation.valid && (
        <p className="mt-2 text-sm text-emerald-600">Great! Password rules are satisfied.</p>
      )}
    </div>
  );
};

export default PasswordField;
