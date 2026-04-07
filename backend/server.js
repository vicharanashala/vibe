const Enrollment = require("./models/Enrollment");
const Course = require("./models/Course");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/vibe");

app.get("/", (req, res) => {
  res.send("Server Running");
});

app.listen(5000, () => console.log("Server running on port 5000"));
app.post("/add-course", async (req, res) => {
  try {
    const course = new Course(req.body);
    await course.save();
    res.send("Course Added Successfully");
  } catch (err) {
    res.send("Error adding course");
  }
});

// Add Course
app.post("/add-course", async (req, res) => {
  try {
    const course = new Course(req.body);
    await course.save();
    res.send("Course Added Successfully");
  } catch (err) {
    res.send("Error adding course");
  }
});

// Get Courses
app.get("/courses", async (req, res) => {
  try {
    const courses = await Course.find();
    res.json(courses);
  } catch (err) {
    res.send("Error fetching courses");
  }
});

app.post("/enroll", async (req, res) => {
  try {
    const { userEmail, courseId } = req.body;

    const enrollment = new Enrollment({ userEmail, courseId });
    await enrollment.save();

    res.send("Enrolled Successfully");
  } catch (err) {
    res.send("Error enrolling");
  }
});

app.get("/my-courses/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const enrollments = await Enrollment.find({ userEmail: email });

    const courseIds = enrollments.map(e => e.courseId);

    const courses = await Course.find({ _id: { $in: courseIds } });

    res.json(courses);
  } catch (err) {
    res.send("Error fetching enrolled courses");
  }
});