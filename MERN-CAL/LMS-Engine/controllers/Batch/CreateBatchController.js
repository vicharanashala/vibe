const Batch = require("../../models/User/BatchSchema");
const User = require("../../models/User/UserSchema");
const Course = require("../../models/Course/CourseSchema");
const mongoose = require("mongoose");

exports.createBatch = async (req, res = null) => {
    try {
        const { batchName, instituteId, studentEnrollments } = req.body;
        console.log("Creating batch:", batchName);

        let batch = await Batch.findOne({ batchName, institute: instituteId }).populate("students");

        if (batch) {
            console.log("Batch already exists. Updating students and courses...");

            // Convert list of students to map for easy access
            const existingStudentIds = new Map(batch.students.map(student => [student.studentId.toString(), student]));

            for (const student of studentEnrollments) {
                const studentId = await validateStudentId(student.studentId);
                if (!studentId) {
                    return res ? res.status(400).json({ success: false, message: `Invalid student ID: ${student.studentId}` }) 
                               : { success: false, message: `Invalid student ID: ${student.studentId}` };
                }

                if (!existingStudentIds.has(studentId.toString())) {
                    // Add new student to batch
                    batch.students.push({
                        studentId,
                        coursesEnrolled: [...new Set(student.coursesEnrolled)]
                    });
                } else {
                    // Update existing student courses
                    const batchStudent = existingStudentIds.get(studentId.toString());
                    batchStudent.coursesEnrolled = [...new Set([...batchStudent.coursesEnrolled, ...student.coursesEnrolled])];
                }

                // Update user's enrolled courses
                await User.findByIdAndUpdate(
                    studentId,
                    { $addToSet: { coursesEnrolled: { $each: student.coursesEnrolled } } },
                    { new: true }
                );
            }

            await batch.save();
            return res ? res.status(200).json({ success: true, message: "Batch updated successfully", data: batch })
                       : { success: true, message: "Batch updated successfully", data: batch };
        } else {
            console.log("Creating new batch...");

            const validatedStudents = await Promise.all(studentEnrollments.map(async student => {
                const studentId = await validateStudentId(student.studentId);
                if (!studentId) {
                    throw new Error(`Invalid student ID: ${student.studentId}`);
                }
                return {
                    studentId,
                    coursesEnrolled: student.coursesEnrolled,
                };
            }));

            batch = new Batch({
                batchName,
                institute: instituteId,
                students: validatedStudents,
            });

            await batch.save();
            return res ? res.status(201).json({ success: true, message: "Batch created successfully", data: batch })
                       : { success: true, message: "Batch created successfully", data: batch };
        }
    } catch (error) {
        console.error("Error creating batch:", error);
        return res ? res.status(500).json({ success: false, error: error.message })
                   : { success: false, error: error.message };
    }
};

async function validateStudentId(firebaseId) {
    // Ensure studentId is always a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(firebaseId)) {
        const userFromFirebase = await User.findOne({ firebaseUid: firebaseId });
        if (!userFromFirebase) {
            return null;
        }
        return userFromFirebase._id; // Convert to ObjectId
    }
    return firebaseId;
}
