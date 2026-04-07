const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();

// Enable CORS
app.use(cors());

//  Storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

//  Test route
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// Upload API (FIXED COMPLETE)
app.post("/api/upload", upload.single("image"), (req, res) => {
  console.log("API HIT");

  if (!req.file) {
    console.log("No file received");
    return res.status(400).json({ message: "No file uploaded" });
  }

  console.log("File received:", req.file.filename);

  res.json({
    message: "File uploaded successfully",
    file: req.file,
  });
});

//  Start server
app.listen(5000, () => {
  console.log("Server running on port 5000");
});