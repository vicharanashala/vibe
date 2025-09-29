import { ICourseRegistration, MongoDatabase } from "#root/shared/index.js";
import { inject,injectable } from "inversify";
import {Collection, ClientSession, ObjectId, Filter, SortDirection} from 'mongodb';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from 'routing-controllers';
import {GLOBAL_TYPES} from '#root/types.js';

class CourseRegistrationRepository{
  private courseRegistrationCollection: Collection<ICourseRegistration>
  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase
  ){}

  private async init(){
    this.courseRegistrationCollection = await this.db.getCollection<ICourseRegistration>('CourseRegistration')
  }

  async findByUserId(userId:string){
    await this.init()
    const result = await this.courseRegistrationCollection.findOne({userId})
    return result
  }

  async Create(data:ICourseRegistration){
    await this.init()
    const result = await this.courseRegistrationCollection.insertOne(data)
    return result.insertedId.toString()
  }

  async findAllregistrations(filter:{status?:string;search?:string},skip:number,limit:number,sort:'older' | 'latest'){
    await this.init()
    const query:any ={}
    if(filter.status && filter.status !== 'ALL'){
      query.status = filter.status
    }
    if(filter.search){
      query.$or= [
        {"detail.name":{$regex:filter.search,$options:"i"}},
        {"detail.email":{$regex:filter.search,$options:"i"}},
      ]
    }

    const sortOption = sort === "latest" ? { createdAt: -1 as SortDirection} : { createdAt: 1 as SortDirection };
    const result = await this.courseRegistrationCollection.find(query).sort(sortOption).skip(skip).limit(limit).toArray()
    const registrations = result.map((item) => ({...item,_id:item._id.toString()}))
    const totalDocuments = await this.courseRegistrationCollection.countDocuments(query)
    return {registrations,totalDocuments}
  }

  async updateStatus(registrationId:string,status:"PENDING" | "APPROVED" | "REJECTED"){
    await this.init()
    const data = await this.courseRegistrationCollection.findOneAndUpdate({_id:new ObjectId(registrationId)},{
      $set:{status,updatedAt:new Date()}
    },{returnDocument:"after"})
    console.log("result ",data)
    const result = {...data,_id:data._id.toString()}
    return result
  }


  async updateBulkStatus(registrationIds:string[]){
    await this.init()
    if(registrationIds.length<0){
      const data = await this.courseRegistrationCollection.updateMany({_id:{$in:registrationIds}},{$set:{status:"APPROVED",updatedAt:new Date()}});
      return data.modifiedCount
    }else{
      const data = await this.courseRegistrationCollection.updateMany({},{$set:{status:"APPROVED",updatedAt:new Date()}})
      return data.modifiedCount
    }
  }
}

export {CourseRegistrationRepository}