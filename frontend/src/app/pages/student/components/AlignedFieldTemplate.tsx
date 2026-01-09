import { FieldTemplateProps } from '@rjsf/utils';

export function AlignedFieldTemplate(props: FieldTemplateProps) {
  const { label, required, children, errors, rawErrors  } = props;
  const hasError = rawErrors && rawErrors.length > 0;

  return (
    <div className="mb-2">
      <label 
      className={`block mt-1 ml-2 mb-1 text-sm font-medium 
          ${hasError ? "text-red-400" : "text-black dark:text-white"}
        `}
      >
        {label}
        {required && <span className="ml-1 dark:text-white text-black">*</span>}
      </label>

      {children}

      {errors && <div className="mt-1 ml-1 text-sm text-red-400">{errors}</div>}
    </div>
  );
}
