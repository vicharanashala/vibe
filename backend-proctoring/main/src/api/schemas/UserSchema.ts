import { Field, InputType, ObjectType } from "type-graphql";
import { prop } from "@typegoose/typegoose";
import { getModelForClass } from "@typegoose/typegoose";
import { IsEmail } from "class-validator";



@ObjectType()
export default class User {
    @Field(() => String, {
        description: 'The unique identifier of the user'
    })
    _id: string;

    @Field({
        description: 'Name of the user'
    })
    @prop({ required: true })
    name: string;

    @IsEmail()
    @Field(
        {
            description: 'Email of the user'
        }
    )
    @prop({ required: true })
    email: string;

    @prop({ required: true })
    password: string;


}

@InputType()
export class CreateUserInput {
    @Field({
        description: 'Name of the user'
    })
    name: string;

    @IsEmail(
        {},
        { message: 'Invalid email provided :)' }
    )
    @Field({
        description: 'Email of the user'
    })
    email: string;

    @Field(
        {
            description: 'Password of the user'
        }
    )
    password: string;
}

@InputType()
export class UpdateUserInput {
    @Field({ nullable: true })
    name?: string;

    @Field({ nullable: true })
    email?: string;

    @Field({ nullable: true })
    password?: string;
}

export const UserModel = getModelForClass(User, {
    schemaOptions: { timestamps: true, collection: 'users' }
});
