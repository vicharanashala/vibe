/**
 * Migration Script: Populate cohortId across HP System collections
 * 
 * This script:
 * 1. Inserts hardcoded (legacy) cohorts into the `cohorts` collection if they don't exist
 * 2. Builds a name → ObjectId map from the cohorts collection
 * 3. Backfills `cohortId` on all documents in hp_activities, hp_activity_submissions, hp_ledger
 * 4. Prints a summary report
 * 
 * Usage: npx ts-node src/modules/hpSystem/scripts/migrateCohortIds.ts
 */

import { MongoClient, ObjectId } from "mongodb";

// ── Configuration ──────────────────────────────────────────────────────
// Update this connection string to match your environment
const MONGO_URI = process.env.DB_URL;
const DB_NAME = process.env.DB_NAME;

// Hardcoded cohorts that need to be inserted into the cohorts collection
const LEGACY_COHORTS = [
    { name: "Euclideans", courseId: "6968e12cbf2860d6e39051ae", versionId: "6968e12cbf2860d6e39051af" },
    { name: "Dijkstrians", courseId: "6970f87e30644cbc74b6714f", versionId: "6970f87e30644cbc74b67150" },
    { name: "Kruskalians", courseId: "697b4e262942654879011c56", versionId: "697b4e262942654879011c57" },
    { name: "RSAians", courseId: "69903415e1930c015760a718", versionId: "69903415e1930c015760a719" },
    { name: "AKSians", courseId: "69942dc6d6d99b252e3a54fe", versionId: "69942dc6d6d99b252e3a54ff" },
    { name: "Testians", courseId: "69c77812b4ae917c56cf227e", versionId: "69c77812b4ae917c56cf227f" },
    { name: "Scorchers", courseId: "69c77763b4ae917c56cf1342", versionId: "69c77763b4ae917c56cf1343" },
];

async function migrate() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log("✅ Connected to MongoDB");

        const db = client.db(DB_NAME);
        const cohortsCollection = db.collection("cohorts");
        const activitiesCollection = db.collection("hp_activities");
        const submissionsCollection = db.collection("hp_activity_submissions");
        const ledgerCollection = db.collection("hp_ledger");
        const enrollmentCollection = db.collection("enrollment");

        // ── Step 1: Insert legacy cohorts ──────────────────────────────
        console.log("\n📦 Step 1: Inserting legacy cohorts into cohorts collection...");

        console.log("DB:", DB_NAME);

        const collections = await db.listCollections().toArray();
        console.log(collections.map(c => c.name));

        for (const cohort of LEGACY_COHORTS) {
            const existing = await cohortsCollection.findOne({
                name: cohort.name,
                courseVersionId: new ObjectId(cohort.versionId),
            });

            if (existing) {
                console.log(`  ⏩ "${cohort.name}" already exists (id: ${existing._id})`);
            } else {
                const result = await cohortsCollection.insertOne({
                    name: cohort.name,
                    courseId: new ObjectId(cohort.courseId),
                    courseVersionId: new ObjectId(cohort.versionId),
                    isPublic: true,
                    isDeleted: false,
                    isLegacy: true, // marker to identify migration-inserted cohorts
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                console.log(`  ✅ Inserted "${cohort.name}" → id: ${result.insertedId}`);
            }
        }

        // ── Step 2: Build name → ObjectId map ──────────────────────────
        console.log("\n🗺️  Step 2: Building cohort name → ObjectId map...");

        const allCohorts = await cohortsCollection.find({ isDeleted: { $ne: true } }).toArray();
        const nameToId = new Map<string, ObjectId>();

        for (const c of allCohorts) {
            nameToId.set(c.name, c._id);
        }

        console.log(`  Found ${nameToId.size} cohorts in the database`);
        for (const [name, id] of nameToId) {
            console.log(`    "${name}" → ${id}`);
        }

        // ── Step 3: Backfill cohortId on HP collections ────────────────
        console.log("\n🔄 Step 3: Backfilling cohortId on HP collections...");

        // Find all unique cohort string values across all 3 collections
        const uniqueCohortNames = new Set<string>();

        const activityCohorts = await activitiesCollection.distinct("cohort");
        activityCohorts.forEach((c: string) => uniqueCohortNames.add(c));

        const submissionCohorts = await submissionsCollection.distinct("cohort");
        submissionCohorts.forEach((c: string) => uniqueCohortNames.add(c));

        const ledgerCohorts = await ledgerCollection.distinct("cohort");
        ledgerCohorts.forEach((c: string) => uniqueCohortNames.add(c));

        console.log(`  Found ${uniqueCohortNames.size} unique cohort names: ${Array.from(uniqueCohortNames).join(", ")}`);

        // Check for unmapped cohort names
        const unmapped: string[] = [];
        for (const name of uniqueCohortNames) {
            if (!nameToId.has(name)) {
                unmapped.push(name);
            }
        }

        if (unmapped.length > 0) {
            console.warn(`\n  ⚠️  WARNING: The following cohort names have no matching record in the cohorts collection:`);
            unmapped.forEach(n => console.warn(`    - "${n}"`));
            console.warn(`  These documents will NOT have cohortId populated. You may need to create cohort records for them first.`);
        }

        // Update each collection
        let totalActivitiesUpdated = 0;
        let totalSubmissionsUpdated = 0;
        let totalLedgerUpdated = 0;

        for (const [name, cohortId] of nameToId) {
            // hp_activities
            const actResult = await activitiesCollection.updateMany(
                { cohort: name, cohortId: { $exists: false } },
                { $set: { cohortId: cohortId } }
            );
            totalActivitiesUpdated += actResult.modifiedCount;

            // hp_activity_submissions
            const subResult = await submissionsCollection.updateMany(
                { cohort: name, cohortId: { $exists: false } },
                { $set: { cohortId: cohortId } }
            );
            totalSubmissionsUpdated += subResult.modifiedCount;

            // hp_ledger
            const ledgerResult = await ledgerCollection.updateMany(
                { cohort: name, cohortId: { $exists: false } },
                { $set: { cohortId: cohortId } }
            );
            totalLedgerUpdated += ledgerResult.modifiedCount;

            if (actResult.modifiedCount + subResult.modifiedCount + ledgerResult.modifiedCount > 0) {
                console.log(`  ✅ "${name}" → activities: ${actResult.modifiedCount}, submissions: ${subResult.modifiedCount}, ledger: ${ledgerResult.modifiedCount}`);
            }
        }

        // ── Step 3.5: Backfill cohortId on enrollments for legacy courses ──
        console.log("\n🎓 Step 3.5: Backfilling cohortId on enrollments for legacy courses...");
        let totalEnrollmentsUpdated = 0;

        for (const cohort of LEGACY_COHORTS) {
            const cohortId = nameToId.get(cohort.name);
            if (!cohortId) continue;

            const enrollmentResult = await enrollmentCollection.updateMany(
                { 
                    courseId: new ObjectId(cohort.courseId),
                    courseVersionId: new ObjectId(cohort.versionId),
                    cohortId: { $exists: false } 
                },
                { $set: { cohortId: cohortId } }
            );

            totalEnrollmentsUpdated += enrollmentResult.modifiedCount;
            if (enrollmentResult.modifiedCount > 0) {
                console.log(`  ✅ "${cohort.name}" → enrollments: ${enrollmentResult.modifiedCount}`);
            }
        }

        // ── Step 4: Verification ───────────────────────────────────────
        console.log("\n📊 Step 4: Verification Report");
        console.log("─".repeat(50));

        const activitiesWithout = await activitiesCollection.countDocuments({ cohortId: { $exists: false } });
        const submissionsWithout = await submissionsCollection.countDocuments({ cohortId: { $exists: false } });
        const ledgerWithout = await ledgerCollection.countDocuments({ cohortId: { $exists: false } });

        let enrollmentsWithoutLegacy = 0;
        for (const cohort of LEGACY_COHORTS) {
            enrollmentsWithoutLegacy += await enrollmentCollection.countDocuments({
                courseId: new ObjectId(cohort.courseId),
                courseVersionId: new ObjectId(cohort.versionId),
                cohortId: { $exists: false }
            });
        }

        console.log(`  hp_activities       : ${totalActivitiesUpdated} updated, ${activitiesWithout} remaining without cohortId`);
        console.log(`  hp_activity_submissions: ${totalSubmissionsUpdated} updated, ${submissionsWithout} remaining without cohortId`);
        console.log(`  hp_ledger           : ${totalLedgerUpdated} updated, ${ledgerWithout} remaining without cohortId`);
        console.log(`  enrollments (legacy): ${totalEnrollmentsUpdated} updated, ${enrollmentsWithoutLegacy} remaining without cohortId`);

        if (activitiesWithout + submissionsWithout + ledgerWithout + enrollmentsWithoutLegacy === 0) {
            console.log("\n🎉 Migration complete! All documents have cohortId populated.");
        } else {
            console.log("\n⚠️  Some documents still missing cohortId. Check the warnings above.");
        }

    } catch (error) {
        console.error("❌ Migration failed:", error);
        throw error;
    } finally {
        await client.close();
        console.log("\n🔌 Disconnected from MongoDB");
    }
}

migrate().catch(console.error);
