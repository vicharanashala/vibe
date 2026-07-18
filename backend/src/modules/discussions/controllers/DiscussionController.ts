import 'reflect-metadata';
import {
    JsonController,
    Post,
    Delete,
    Get,
    HttpCode,
    Param,
    Body,
    Authorized,
    CurrentUser,
    QueryParams,
    NotFoundError,
    BadRequestError
} from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { OpenAPI } from 'routing-controllers-openapi';
import { ObjectId } from 'mongodb';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { MongoDatabase } from '#shared/index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { IUser } from '#root/shared/interfaces/models.js';

export class CreateThreadDto {
    @IsString()
    courseId!: string;

    @IsString()
    @IsOptional()
    cohortId?: string;

    @IsString()
    @MaxLength(120)
    title!: string;

    @IsString()
    body!: string;
}

export class CreateReplyDto {
    @IsString()
    body!: string;
}

export class GetThreadsQueryParams {
    @IsString()
    courseId!: string;

    @IsString()
    @IsOptional()
    cohortId?: string;
}

@OpenAPI({
    tags: ['Discussions'],
})
@JsonController('/discussions')
@injectable()
@Authorized()
export class DiscussionController {
    constructor(
        @inject(GLOBAL_TYPES.Database)
        private readonly mongoDb: MongoDatabase
    ) {}

    private async getThreadsCollection() {
        return await this.mongoDb.getCollection('discussion_threads');
    }

    private async getRepliesCollection() {
        return await this.mongoDb.getCollection('discussion_replies');
    }

    // 1. POST /discussions/threads
    @Post('/threads')
    @HttpCode(201)
    async createThread(
        @Body() body: CreateThreadDto,
        @CurrentUser() user: IUser
    ) {
        const threadsColl = await this.getThreadsCollection();
        const newThread = {
            courseId: body.courseId,
            cohortId: body.cohortId || '',
            title: body.title,
            body: body.body,
            author: {
                uid: user._id.toString(),
                name: `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`,
                avatar: (user as any).avatar || ''
            },
            replyCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastActivityAt: new Date().toISOString()
        };

        const result = await threadsColl.insertOne(newThread);
        return {
            ...newThread,
            _id: result.insertedId.toString()
        };
    }

    // 2. GET /discussions/threads?courseId=&cohortId=
    @Get('/threads')
    async getThreads(
        @QueryParams() query: GetThreadsQueryParams
    ) {
        const threadsColl = await this.getThreadsCollection();
        const filter: any = { courseId: query.courseId };
        if (query.cohortId) {
            filter.cohortId = query.cohortId;
        }

        const threadsList = await threadsColl
            .find(filter)
            .sort({ lastActivityAt: -1, createdAt: -1 })
            .toArray();

        return threadsList.map(t => ({
            ...t,
            _id: t._id.toString()
        }));
    }

    // 3. GET /discussions/threads/:threadId
    @Get('/threads/:threadId')
    async getThread(@Param('threadId') threadId: string) {
        if (!ObjectId.isValid(threadId)) {
            throw new BadRequestError('Invalid thread ID');
        }

        const threadsColl = await this.getThreadsCollection();
        const repliesColl = await this.getRepliesCollection();

        const thread = await threadsColl.findOne({ _id: new ObjectId(threadId) });
        if (!thread) {
            throw new NotFoundError('Thread not found');
        }

        const threadReplies = await repliesColl
            .find({ threadId })
            .sort({ createdAt: 1 })
            .toArray();

        return {
            ...thread,
            _id: thread._id.toString(),
            replies: threadReplies.map(r => ({
                ...r,
                _id: r._id.toString()
            }))
        };
    }

    // 4. POST /discussions/threads/:threadId/replies
    @Post('/threads/:threadId/replies')
    @HttpCode(201)
    async createReply(
        @Param('threadId') threadId: string,
        @Body() body: CreateReplyDto,
        @CurrentUser() user: IUser
    ) {
        if (!ObjectId.isValid(threadId)) {
            throw new BadRequestError('Invalid thread ID');
        }

        const threadsColl = await this.getThreadsCollection();
        const repliesColl = await this.getRepliesCollection();

        const thread = await threadsColl.findOne({ _id: new ObjectId(threadId) });
        if (!thread) {
            throw new NotFoundError('Thread not found');
        }

        const newReply = {
            threadId,
            body: body.body,
            author: {
                uid: user._id.toString(),
                name: `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`,
                avatar: (user as any).avatar || ''
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const result = await repliesColl.insertOne(newReply);

        // Update reply count and last activity timestamp on the thread
        await threadsColl.updateOne(
            { _id: new ObjectId(threadId) },
            {
                $inc: { replyCount: 1 },
                $set: { lastActivityAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
            }
        );

        return {
            ...newReply,
            _id: result.insertedId.toString()
        };
    }

    // 5. DELETE /discussions/threads/:threadId
    @Delete('/threads/:threadId')
    @HttpCode(204)
    async deleteThread(
        @Param('threadId') threadId: string,
        @CurrentUser() user: IUser
    ) {
        if (!ObjectId.isValid(threadId)) {
            throw new BadRequestError('Invalid thread ID');
        }

        const threadsColl = await this.getThreadsCollection();
        const repliesColl = await this.getRepliesCollection();

        const thread = await threadsColl.findOne({ _id: new ObjectId(threadId) });
        if (!thread) {
            throw new NotFoundError('Thread not found');
        }

        // Only author (or admin) can delete
        if (thread.author.uid !== user._id.toString() && user.roles !== 'admin') {
            throw new BadRequestError('You do not have permission to delete this thread');
        }

        await threadsColl.deleteOne({ _id: new ObjectId(threadId) });
        await repliesColl.deleteMany({ threadId });

        return null;
    }

    // 6. DELETE /discussions/replies/:replyId
    @Delete('/replies/:replyId')
    @HttpCode(204)
    async deleteReply(
        @Param('replyId') replyId: string,
        @CurrentUser() user: IUser
    ) {
        if (!ObjectId.isValid(replyId)) {
            throw new BadRequestError('Invalid reply ID');
        }

        const threadsColl = await this.getThreadsCollection();
        const repliesColl = await this.getRepliesCollection();

        const reply = await repliesColl.findOne({ _id: new ObjectId(replyId) });
        if (!reply) {
            throw new NotFoundError('Reply not found');
        }

        // Only author (or admin) can delete
        if (reply.author.uid !== user._id.toString() && user.roles !== 'admin') {
            throw new BadRequestError('You do not have permission to delete this reply');
        }

        await repliesColl.deleteOne({ _id: new ObjectId(replyId) });

        // Decrement reply count on the thread
        if (ObjectId.isValid(reply.threadId)) {
            await threadsColl.updateOne(
                { _id: new ObjectId(reply.threadId) },
                { $inc: { replyCount: -1 } }
            );
        }

        return null;
    }
}
