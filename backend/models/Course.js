const mongoose = require("mongoose");

const CourseSchema = new mongoose.Schema({
  title: String,
  description: String,
  videoUrl: String,
});

module.exports = mongoose.model("Course", CourseSchema);