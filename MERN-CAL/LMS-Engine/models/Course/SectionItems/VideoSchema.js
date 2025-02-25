const mongoose = require("mongoose");

const VideoSchema = new mongoose.Schema({
  title: { type: String, required: true }, // Video title
  description: { type: String }, // Video description (optional)
  url: { type: String, required: true }, // URL of the video (YouTube, Vimeo, or local storage)
  sequence: { type: Number, required: true }, // Video sequence within a section
  section: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true }, // Links to a section item
  startTime: { type: Number, required: true }, // When the video becomes available
  endTime: { type: Number, required: true } // When the video expires
}, { timestamps: true });

module.exports = mongoose.model("Video", VideoSchema);