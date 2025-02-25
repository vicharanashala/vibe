const mongoose = require("mongoose");

const InstituteSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // Unique name of the institute
  description: { type: String }, // A short description of the institute
  website: { type: String }, // Institute website URL
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    zipCode: { type: String }
  },
  phone: { type: String }, // Contact number
  email: { type: String, unique: true }, // Contact email
  logo: { type: String }, // URL to institute logo
  establishedYear: { type: Number }, // Year of establishment
  courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }], // Courses offered by this institute
  instructors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Faculty or instructors linked to this institute
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Students enrolled in this institute
}, { timestamps: true });

module.exports = mongoose.model("Institute", InstituteSchema);
