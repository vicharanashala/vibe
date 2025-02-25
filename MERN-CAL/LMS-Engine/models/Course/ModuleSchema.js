const mongoose = require("mongoose");

const ModuleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  sections: [{ type: mongoose.Schema.Types.ObjectId, ref: "Section" }],
  sequence: { type: Number, required: true, unique: false }, // Module sequence within a course
}, { timestamps: true });

module.exports = mongoose.model("Module", ModuleSchema);
