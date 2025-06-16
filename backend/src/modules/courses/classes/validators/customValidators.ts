import { registerDecorator, ValidationOptions, ValidationArguments } from "class-validator";

type IdPropertyNames = {
  afterIdPropertyName: string;
  beforeIdPropertyName: string;
};

export function OnlyOneId(
  idProps: IdPropertyNames,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: "onlyOneId",
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(_: any, args: ValidationArguments) {
          const obj = args.object as any;
          const after = !!obj[idProps.afterIdPropertyName];
          const before = !!obj[idProps.beforeIdPropertyName];
          return (after || before) && !(after && before);
        },
        defaultMessage(args: ValidationArguments) {
          return `Provide either "${idProps.afterIdPropertyName}" or "${idProps.beforeIdPropertyName}", but not both`;
        }
      }
    });
  };
}

export function AtLeastOne(
  fields: string[],
  validationOptions?: ValidationOptions
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'atLeastOne',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [fields],
      options: validationOptions,
      validator: {
        validate(_value: any, args: ValidationArguments) {
          const obj = args.object as Record<string, any>;
          return fields.some(f => obj[f] !== undefined && obj[f] !== null && obj[f] !== '');
        },
        defaultMessage(args: ValidationArguments) {
          const fields = args.constraints[0] as string[];
          return (
            args?.constraints?.[1]?.message ||
            `At least one of [${fields.join(', ')}] must be provided`
          );
        }
      }
    });
  };
}
