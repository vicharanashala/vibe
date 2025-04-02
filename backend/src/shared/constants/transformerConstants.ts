import {TransformFnParams} from 'class-transformer';
import {ObjectId} from 'mongodb';

type TransformerOptions = {
  transformer: (params: TransformFnParams) => unknown;
};

const ObjectIdToString: TransformerOptions = {
  transformer: ({value}) =>
    value instanceof ObjectId ? value.toString() : value,
};

const StringToObjectId: TransformerOptions = {
  transformer: ({value}) =>
    typeof value === 'string' ? new ObjectId(value) : value,
};

const ObjectIdArrayToStringArray: TransformerOptions = {
  transformer: ({value}) =>
    Array.isArray(value) ? value.map(v => v.toString()) : value,
};

const StringArrayToObjectIdArray: TransformerOptions = {
  transformer: ({value}) =>
    Array.isArray(value) ? value.map(v => new ObjectId(v)) : value,
};

export {
  ObjectIdToString,
  StringToObjectId,
  ObjectIdArrayToStringArray,
  StringArrayToObjectIdArray,
  TransformerOptions,
};
