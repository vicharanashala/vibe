const mongoose = require("mongoose");

const BatchSchema = new mongoose.Schema(
  {
    batchName: { type: String, required: true, trim: true },
    institute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institute",
      required: true,
    },
    students: [
      {
        studentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        coursesEnrolled: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: true,
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Batch", BatchSchema);
