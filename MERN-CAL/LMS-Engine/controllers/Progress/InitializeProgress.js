const axios = require("axios");
const Course = require("../../models/Course/CourseSchema");
const User = require("../../models/User/UserSchema");

exports.enrollStudents = async (req, res) => {
  try {
    const { courseId, studentIds } = req.body;
    const { firebase_id } = req.user; // Assuming user info comes from authenticated request

    // Optional user authentication validation
    // const user = await User.findOne({ firebaseUid: firebase_id });
    // if (!user) {
    //   return res.status(401).json({ success: false, message: "User not authenticated" });
    // }

    // Validate the course existence
    const course = await Course.findById(courseId).populate({
      path: 'modules',
      populate: {
        path: 'sections',
        populate: {
          path: 'sectionItems.itemId', // Corrected path to the actual item
          select: 'title description url questions startTime endTime sequence' // Ensure sequence is included
        }
      }
    });

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    await Promise.all(studentIds.map(async (studentId) => {
      await User.findOneAndUpdate(
        { firebaseUid: studentId },
        { $addToSet: { coursesEnrolled: courseId } }, // Using $addToSet to avoid duplicates
        { new: true, upsert: true } // Option upsert set to true to create a user if not found
      );
    }));

    // Constructing the payload for the external API
    const postData = {
      courseInstanceId: courseId,
      studentIds: studentIds,
      modules: course.modules.map(module => ({
        moduleId: module._id,
        sequence: module.sequence,
        sections: module.sections.map(section => ({
          sectionId: section._id,
          sequence: section.sequence,
          sectionItems: section.sectionItems.map(item => ({
            sectionItemId: item.itemId._id,
            sequence: item.itemId.sequence,
          })).sort((a, b) => a.sequence - b.sequence) // Sorting section items by sequence
        }))
      }))
    };

    // Logging the formatted data for review (remove in production)
    console.log(JSON.stringify(postData, null, 2));
    const mainData = JSON.parse(JSON.stringify(postData, null, 2))
    

    // Making the POST request to the external service
    const response = await axios.post('http://localhost:8080/course-progress/initialize-progress', mainData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json({ success: true, message: "Students enrolled successfully", data: response.data });
  } catch (error) {
    console.error("Error enrolling students: ", error);
    res.status(500).json({
      success: false,
      message: "Failed to enroll students",
      error: error.message
    });
  }
};
