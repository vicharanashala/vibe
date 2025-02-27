const Course = require('../../models/Course/CourseSchema');
const User = require('../../models/User/UserSchema');

exports.postCourseController = async (req, res) => {
  try {
    const { firebase_id } = req.user;
    const user = await User.findOne({ firebaseUid: firebase_id });
    // Destructure the expected fields from the request body
    const institute = user.institute;
    const instructor = user._id;
    const { title, description, startDate, endDate, modules } = req.body;

    // Create a new Course instance with the provided data
    const course = new Course({
      title,
      description,
      institute,
      instructor,
      startDate,
      endDate,
      modules, // optional: modules array may be omitted if not provided
    });

    // Save the course to the database
    await course.save();

    // Respond with the newly created course
    res.status(201).json({ success: true, data: course });
  } catch (error) {
    // Handle errors (e.g., validation errors, DB errors)
    res.status(500).json({ success: false, error: error.message });
  }
};
