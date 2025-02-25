const mongoose = require("mongoose");

const CourseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  institute: { type: mongoose.Schema.Types.ObjectId, ref: "Institute", required: true },
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Instructor reference
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  modules: [{ type: mongoose.Schema.Types.ObjectId, ref: "Module" }],
}, { timestamps: true });

module.exports = mongoose.model("Course", CourseSchema);
