const Course = require('../../models/Course/CourseSchema');
const Module = require('../../models/Course/ModuleSchema');

exports.fetchModulesController = async (req, res) => {
    try {
        const courseId = req.query.course_id;  // Get courseId from query parameters

        // Validate the courseId
        if (!courseId) {
            return res.status(400).json({ message: "Course ID must be provided." });
        }

        // Find the course by ID
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ message: "Course not found." });
        }

        // Extract the modules array from the course document
        const { modules } = course;

        // Fetch all the modules of the course using the module IDs
        const modulesData = await Module.find({
            '_id': { $in: modules }
        });

        // If modulesData array is empty, return a message indicating no modules found
        if (!modulesData.length) {
            return res.status(404).json({ message: "No modules found for this course." });
        }

        // Prepare the response data by mapping over the modulesData array
        const responseData = modulesData.map(module => ({
            module_id: module._id,
            title: module.title,
            description: module.description,
            sequence: module.sequence,
            sections: module.sections,
            createdAt: module.createdAt,
            updatedAt: module.updatedAt
        }));

        // Send the response data back to the client
        res.json(responseData);
    } catch (error) {
        console.error("Error fetching modules:", error);
        res.status(500).json({ message: "Error fetching modules" });
    }
};
