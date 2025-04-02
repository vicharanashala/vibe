import { MongoClient, Db, Collection, Document, ObjectId, WithId } from "mongodb";
import { IUser } from "shared/interfaces/IUser";
import { Inject, Service } from "typedi";

export interface IDatabase<T = unknown> {
    database: T | null;
    disconnect(): Promise<T | null>;
    isConnected(): boolean;
}
