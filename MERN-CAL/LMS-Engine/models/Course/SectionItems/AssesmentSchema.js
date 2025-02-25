const mongoose = require("mongoose");

const AssessmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }], // Array of Question references
  section: { type: mongoose.Schema.Types.ObjectId, ref: "Section" }, // Reference to SectionItem
  sequence: { type: Number, required: true }, // Assessment sequence within a section
}, { timestamps: true });

module.exports = mongoose.model("Assessment", AssessmentSchema);