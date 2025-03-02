import { Field, ObjectType } from "type-graphql";
import { prop } from "@typegoose/typegoose";

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