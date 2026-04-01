
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env') });

async function addTestCourse() {
    const dbUrl = process.env.DB_URL;
    const dbName = process.env.DB_NAME;
    
    if (!dbUrl || !dbName) {
        console.error('DB_URL or DB_NAME not found in .env');
        return;
    }

    const client = new MongoClient(dbUrl);
    try {
        await client.connect();
        const db = client.db(dbName);
        
        const userId = new ObjectId("697db379753e8c52ee77d0f1");
        const now = new Date();

        console.log('Creating Video Item...');
        const videoItem = {
            _id: new ObjectId(),
            type: "VIDEO",
            name: "1 Minute Completion Video",
            description: "Watch this video to complete the course and test certificate generation.",
            details: {
                URL: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
                startTime: "0",
                endTime: "60",
                points: 10,
            },
            isDeleted: false,
            createdAt: now,
            updatedAt: now
        };
        await db.collection('videos').insertOne(videoItem);

        console.log('Creating Items Group...');
        const itemsGroupId = new ObjectId();
        const itemsGroup = {
            _id: itemsGroupId,
            items: [
                {
                    _id: videoItem._id,
                    type: "VIDEO",
                    order: "0",
                    isHidden: false,
                    name: videoItem.name
                }
            ],
            sectionId: itemsGroupId, // Following the pattern in ItemRepository
            isDeleted: false,
            createdAt: now,
            updatedAt: now
        };
        await db.collection('itemsGroup').insertOne(itemsGroup);

        console.log('Creating Course Version...');
        const versionId = new ObjectId();
        const moduleId = new ObjectId();
        const sectionId = new ObjectId();
        const courseVersion = {
            _id: versionId,
            courseId: null, // Will update after course creation
            version: "1.0-test",
            description: "Test version for certificate verification",
            versionStatus: "active",
            modules: [
                {
                    moduleId: moduleId,
                    name: "Testing Module",
                    description: "Module for testing",
                    order: "0",
                    isHidden: false,
                    sections: [
                        {
                            sectionId: sectionId,
                            name: "Testing Section",
                            description: "Section for testing",
                            order: "0",
                            isHidden: false,
                            itemsGroupId: itemsGroupId
                        }
                    ],
                    createdAt: now,
                    updatedAt: now
                }
            ],
            totalItems: 1,
            itemCounts: {
                VIDEO: 1
            },
            isDeleted: false,
            createdAt: now,
            updatedAt: now
        };
        await db.collection('newCourseVersion').insertOne(courseVersion);

        console.log('Creating Course...');
        const courseId = new ObjectId();
        const course = {
            _id: courseId,
            name: "Certificate Verification Test",
            description: "A short 1-minute course to verify certificate generation.",
            versions: [versionId],
            instructors: [userId],
            isDeleted: false,
            createdAt: now,
            updatedAt: now
        };
        await db.collection('newCourse').insertOne(course);

        // Update version with courseId
        await db.collection('newCourseVersion').updateOne(
            { _id: versionId },
            { $set: { courseId: courseId } }
        );

        console.log('Creating Course Settings...');
        const courseSettings = {
            courseId: courseId,
            courseVersionId: versionId,
            settings: {
                proctors: {
                    detectors: []
                },
                linearProgressionEnabled: false,
                seekForwardEnabled: true,
                isPublic: true
            }
        };
        await db.collection('courseSettings').insertOne(courseSettings);

        console.log('Enrolling User...');
        const enrollmentId = new ObjectId();
        const enrollment = {
            _id: enrollmentId,
            userId: userId,
            courseId: courseId,
            courseVersionId: versionId,
            role: "STUDENT",
            status: "ACTIVE",
            enrollmentDate: now,
            percentCompleted: 0,
            completedItemsCount: 0,
            isDeleted: false
        };
        await db.collection('enrollment').insertOne(enrollment);

        console.log('Initializing Progress...');
        const progress = {
            userId: userId,
            courseId: courseId,
            courseVersionId: versionId,
            currentModule: moduleId,
            currentSection: sectionId,
            currentItem: videoItem._id,
            completed: false,
            isDeleted: false,
            createdAt: now,
            updatedAt: now
        };
        await db.collection('progress').insertOne(progress);

        console.log('Success!');
        console.log('Course ID:', courseId.toString());
        console.log('Version ID:', versionId.toString());
        console.log('Enrollment ID:', enrollmentId.toString());

    } catch (err) {
        console.error('Error adding test course:', err);
    } finally {
        await client.close();
    }
}

addTestCourse().catch(console.error);
