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
    // console.log('childrennnn------------------------', children);
    // console.log(children.props.children[0].props.uiSchema["ui:placeholder"]);
    const placeholder = children.props.children[0].props.uiSchema["ui:placeholder"];
    const helpText = children.props.children[0].props.uiSchema["ui:help"];
    const widgetType = children.props.children[0].props.uiSchema["ui:widget"];
   
    return (
      <div className="mb-2">
       <p className={`text-sm font-medium  ${hasError ? "text-red-400" : "text-black dark:text-white"}`}>
        {placeholder}
       </p>
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
        <p className='ml-2 text-muted-foreground text-sm'>{helpText}</p>
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
