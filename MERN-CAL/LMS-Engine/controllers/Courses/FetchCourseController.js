const User = require('../../models/User/UserSchema');
const Course = require('../../models/Course/CourseSchema');

exports.fetchCourseController = async (req, res) => {
    try {
        // const firebaseId = req.headers.firebaseid;
        const firebaseId = "91470c73-4e1e-4dfe-b4ec-d6123cd1892f";
        // Find the user by firebase UID
        const user = await User.findOne({ firebaseUid: firebaseId });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Extract the enrolled courses array from the user document
        const { coursesEnrolled } = user;

        // Fetch all the courses in which the user is enrolled
        const courses = await Course.find({
            '_id': { $in: coursesEnrolled }
        });

        // If courses array is empty, return a message indicating no courses found
        if (!courses.length) {
            return res.status(404).json({ message: "No enrolled courses found." });
        }

        // Prepare the response data by mapping over the courses array
        const responseData = courses.map(course => ({
            course_id: course._id,
            name: course.title,
            description: course.description,
            startDate: course.startDate,
            endDate: course.endDate,
            instructor: course.instructor,
            modules: course.modules,
        }));

        // Send the response data back to the client
        res.json(responseData);
    } catch (error) {
        console.error("Error fetching courses:", error);
        res.status(500).json({ message: "Error fetching courses" });
    }
};
