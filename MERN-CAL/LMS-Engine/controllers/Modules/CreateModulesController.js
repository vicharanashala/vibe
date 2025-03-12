const Module = require('../../models/Course/ModuleSchema');
const Course = require('../../models/Course/CourseSchema');

exports.createModuleController = async (req, res) => {
  try {
    // Destructure fields from request body
    const { title, courseId, sections } = req.body;

    // Check if the referenced course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    // Find the highest sequence number for this course
    const lastModule = await Module.findOne({ course: courseId })
      .sort({ sequence: -1 }) // Sort in descending order
      .select('sequence'); // Only retrieve sequence field

    const nextSequence = lastModule ? lastModule.sequence + 1 : 1; // Increment if exists, else start at 1

    // Create a new Module instance
    const module = new Module({
      title,
      course: courseId,
      sections: sections || [], // optional: sections array may be omitted
      sequence: nextSequence,
    });

    // Save the module to the database
    const savedModule = await module.save();

    // Push the module's ObjectId into the course's modules array
    course.modules.push(savedModule._id);
    await course.save();

    // Respond with the created module
    res.status(201).json({ success: true, data: savedModule });
  } catch (error) {
    // Handle errors
    res.status(500).json({ success: false, error: error.message });
  }
};
