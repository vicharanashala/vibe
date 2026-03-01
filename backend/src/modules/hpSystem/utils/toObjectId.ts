import { ObjectId } from "mongodb";
import { BadRequestError } from "routing-controllers";

export const toObjectId = (value: string, fieldName: string): ObjectId => {
    if (!ObjectId.isValid(value)) {
        throw new BadRequestError(`${fieldName} is not a valid ObjectId`);
    }
    return new ObjectId(value);
}
