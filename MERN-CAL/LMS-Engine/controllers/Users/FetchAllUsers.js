const User = require('../../models/User/UserSchema'); // Import User model

// Controller to fetch all users of an instructor's institute
exports.fetchAllUsersController = async (req, res) => {
    try {
        // Get instructor ID from the request (assuming authentication middleware is used)
        const firebase_id = req.user.firebase_id; // Get instructor email from the request
        // Fetch the instructor's user document using the email
        const instructor = await User.findOne({ firebaseUid: firebase_id });

        // Validate the instructor
        if (!instructor) {
            return res.status(404).json({ success: false, message: "Instructor not found." });
        }

        const instituteId = instructor.institute.toString(); // Convert the instructor's institute ID to a string
  
        // Validate the instructorId
        if (!instituteId) {
            return res.status(400).json({ success: false, message: "Instructor ID is required." });
        }

        // Fetch users who belong to the same institute as the instructor
        const users = await User.find({ institute: instituteId });

        // If no users are found, return a 404 response
        if (!users.length) {
            return res.status(404).json({ success: false, message: "No users found for this institute." });
        }

        console.log("Fetched users:", users);

        // Format response data
        const formattedUsers = users.map(user => ({
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role, // Assuming there's a role field
            firebase_id: user.firebaseUid,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        }));

        // Send response
        res.status(200).json({
            success: true,
            data: formattedUsers
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};