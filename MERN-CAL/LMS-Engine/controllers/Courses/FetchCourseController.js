const User = require('../../models/User/UserSchema');
const Course = require('../../models/Course/CourseSchema');

exports.fetchCourseController = async (req, res) => {
    try {
        
        const { firebase_id } = req.user;
        const user = await User.findOne({ firebaseUid: firebase_id });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Extract the enrolled courses array from the user document
        const { coursesEnrolled } = user;

        // Fetch all the courses in which the user is enrolled
        let courses;

        if (user.role === 'instructor') {
            courses = await Course.find(); // Fetch all courses for instructors
        } else {
            courses = await Course.find({
                '_id': { $in: coursesEnrolled }
            });
        }
        

        // If courses array is empty, return a message indicating no courses found
        if (!courses.length) {
            courses = [];
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
