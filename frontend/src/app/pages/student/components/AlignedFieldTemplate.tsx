import { FieldTemplateProps } from '@rjsf/utils';

export function AlignedFieldTemplate(props: FieldTemplateProps) {
  const {
    label,
    required,
    children,
    errors,
    rawErrors,
    schema,         
  } = props;

  const hasError = rawErrors && rawErrors.length > 0;

 
  const isUrlField = schema?.type === "string" && schema?.format === "uri";

  

  if (isUrlField) {
   
    return (
      <div className="mb-2">
       
        {children}
       <a
          href={label}
          target="_blank"
          rel="noopener noreferrer"
          className={`block mt-1 ml-2 mb-1 text-sm font-medium underline break-all
            ${hasError ? "text-red-400" : "text-primary"}
          `}
        >
          {label}
          {required && <span className="ml-1">*</span>}
        </a>
      </div>
    );
  }

  // default behavior for everything else
  return (
    <div className="mb-2">
      <label
        className={`block mt-1 ml-2 mb-1 text-sm font-medium 
          ${hasError ? "text-red-400" : "text-black dark:text-white"}
        `}
      >
        {label}
        {required && <span className="ml-1">*</span>}
      </label>

      {children}

      {errors && (
        <div className="mt-1 ml-1 text-sm text-red-400">{errors}</div>
      )}
    </div>
  );
}
