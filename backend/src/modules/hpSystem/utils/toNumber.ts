import { Transform } from "class-transformer";

export const ToNumber = () =>
    Transform(({ value }) => (value === undefined ? undefined : Number(value)));