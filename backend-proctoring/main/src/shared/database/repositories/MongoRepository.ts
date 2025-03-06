import { Model } from "mongoose";
import { BaseRepository } from "./BaseRepository";

export class MongoRepository<T> implements BaseRepository<T> {
  constructor(private model: Model<T>) {}

  async findById(id: string): Promise<T | null> {
    return this.model.findById(id).exec();
  }

  async findAll(): Promise<T[]> {
    return this.model.find().exec();
  }

  async create(data: Partial<T>): Promise<T> {
    return new this.model(data).save() as unknown as T;
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
