import { Field, ObjectType } from "type-graphql";
import { prop } from "@typegoose/typegoose";
import { getModelForClass } from "@typegoose/typegoose";


export class Role {
    name: string;
    description: string;
}

export class Permission {
    name: string;
    description: string;
}

@ObjectType()
export default class User{
    @Field(() => String)
    _id: string;

    @Field()
    @prop({ required: true })
    name: string;

    @Field()
    @prop({ required: true })
    email: string;

    @prop({ required: true })
    password: string;


}

export const UserModel = getModelForClass(User);
