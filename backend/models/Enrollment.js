const mongoose = require("mongoose");

const EnrollmentSchema = new mongoose.Schema({
  userEmail: String,
  courseId: String,
});

module.exports = mongoose.model("Enrollment", EnrollmentSchema);