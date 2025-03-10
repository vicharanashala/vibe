const admin = require("firebase-admin");
const crypto = require("crypto");
const User = require("../../models/User/UserSchema"); // Adjust path as necessary

// Utility function to generate strong random passwords
const generatePassword = (length = 12) => {
  return crypto.randomBytes(length).toString("base64").slice(0, length);
};

// Controller for bulk user signup
exports.bulkSignup = async (req, res) => {
  const users = req.body.users; // Array of user data from the POST request
  const userCreationResults = [];
  console.log("Received user data:", users);    

  for (const user of users) {
    console.log("Processing user:", user);
    if (user.firstName && user.lastName && user.email) {
      // Ensure all required fields are filled
      user.institute = "67b9888bc4be0ae22a62cf2a"; // Default institute ID
      user.role = "student"; // Default role to 'student' if not provided
      const password = generatePassword(); // Generate a strong password
      try {
        // Create user in Firebase
        const userRecord = await admin.auth().createUser({
          email: user.email.lowerCase(),
          emailVerified: false,
          password: password,
          displayName: `${user.firstName} ${user.lastName}`,
          disabled: false,
        });

        // Save user details in MongoDB
        const newUser = new User({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email.lowerCase(),
          password: password, // Ideally, you should hash the password before storing
          role: user.role,
          institute: user.institute,
          firebaseUid: userRecord.uid,
        });

        await newUser.save(); // Save the new user document in MongoDB

        userCreationResults.push({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          password: password, // Be cautious about returning passwords
          uid: userRecord.uid,
        });
      } catch (error) {
        console.error("Error creating user:", error);
        userCreationResults.push({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          error: error.message, // Include error message in response
        });
      }
    } else {
      userCreationResults.push({
        error: "Missing required fields",
        providedData: user,
      });
    }
  }

  // Respond with the results of user creation attempts
  res.json({
    success: true,
    message: "User creation attempt completed",
    results: userCreationResults,
  });
};
