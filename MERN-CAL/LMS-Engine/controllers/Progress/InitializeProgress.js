const axios = require("axios");
const Course = require("../../models/Course/CourseSchema");
const User = require("../../models/User/UserSchema");
const { createBatch } = require("../../controllers/Batch/CreateBatchController");

exports.enrollStudents = async (req, res) => {
  try {
    const { courseId, studentIds } = req.body;
    const { batchName } = req.params;
    const { firebase_id } = req.user; // Extracting firebase_id from authenticated request
    console.log("Enrolling students:", batchName);

    // Fetch user to get instituteId
    const user = await User.findOne({ firebaseUid: firebase_id }).select(
      "institute"
    );
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });
    }
    const instituteId = user.institute;

    // Validate course existence
    const course = await Course.findById(courseId).populate({
      path: "modules",
      populate: {
        path: "sections",
        populate: {
          path: "sectionItems.itemId",
          select: "title description url questions startTime endTime sequence",
        },
      },
    });

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    // Fetch students and validate existence
    // const students = await User.find({ _id: { $in: studentIds } });
    // if (students.length !== studentIds.length) {
    //   return res.status(400).json({ success: false, message: "Some student IDs are invalid" });
    // }

    // Construct batchData for createBatch
    const batchData = {
      batchName,
      instituteId,
      studentEnrollments: studentIds.map((studentId) => ({
        studentId,
        coursesEnrolled: [courseId], // Enrolling students in this course
      })),
    };

    // Call createBatch function to handle batch updates
    const batchResponse = await createBatch({ body: batchData });

    // Constructing the payload for the external API
    const postData = {
      courseInstanceId: courseId,
      studentIds: studentIds,
      modules: course.modules.map((module) => ({
        moduleId: module._id,
        sequence: module.sequence,
        sections: module.sections.map((section) => ({
          sectionId: section._id,
          sequence: section.sequence,
          sectionItems: section.sectionItems
            .map((item) => ({
              sectionItemId: item.itemId._id,
              sequence: item.itemId.sequence,
            }))
            .sort((a, b) => a.sequence - b.sequence), // Sorting section items by sequence
        })),
      })),
    };

    // Logging the formatted data for review (remove in production)
    console.log(JSON.stringify(postData, null, 2));
    const mainData = JSON.parse(JSON.stringify(postData, null, 2));
    const Activity = process.env.ACTIVITY_URL;

    // Making the POST request to the external service
    const response = await axios.post(
      `${Activity}/course-progress/initialize-progress`,
      mainData,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    res
      .status(200)
      .json({
        success: true,
        message: "Students enrolled successfully",
        data: response.data,
      });
  } catch (error) {
    console.error("Error enrolling students: ", error);
    res.status(500).json({
      success: false,
      message: "Failed to enroll students",
      error: error.message,
    });
  }
};
