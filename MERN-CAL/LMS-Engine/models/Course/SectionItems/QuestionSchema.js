const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  assessment: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment", required: true }, // Links question to an assessment
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // User reference
  questionText: { type: String, required: true },
  type: { 
    type: String, 
    enum: ["multiple-choice", "multi-select", "true-false", "short-answer", "descriptive"], 
    required: true 
  },
  options: [{ type: String }], // Used for multiple-choice and multi-select questions
  answer: [{ type: String, required: true , select: false }], // Supports multiple correct answers for multi-select
  timeLimit: { type: Number, default: 30 }, // Time limit in seconds (null if no time limit)
  points: { type: Number, default: 1 }, // Points awarded for correct answer
}, { timestamps: true });

module.exports = mongoose.model("Question", QuestionSchema);