require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const User = require('./models/User/UserSchema');
const Course = require('./models/Course/CourseSchema');
const Institute = require('./models/User/InstituteSchema');
const Module = require('./models/Course/ModuleSchema');
const Section = require('./models/Course/SectionSchema');
const SectionItem = require('./models/Course/SectionItems/ItemsSchema');
const Assessment = require('./models/Course/SectionItems/AssesmentSchema');
const Question = require('./models/Course/SectionItems/QuestionSchema');
const Video = require('./models/Course/SectionItems/VideoSchema');

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true, 
    useUnifiedTopology: true
  })
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

async function createDummyData() {
  try {
    // Create an Institute with extra fields
    const institute = await Institute.create({
      name: "Tech University",
      description: "A leading university in technology and innovation.",
      website: "https://techuniversity.edu",
      address: {
        street: "123 Tech Lane",
        city: "Techville",
        state: "Techstate",
        country: "Techland",
        zipCode: "12345"
      },
      phone: "123-456-7890",
      email: "info@techuniversity.edu",
      logo: "https://techuniversity.edu/logo.png",
      establishedYear: 1965,
      accreditation: "ABET Accredited",
      studentCount: 20000,
      coursesOffered: ["Computer Science", "Electrical Engineering", "Mechanical Engineering"]
    });

    // Create a User (Instructor) with additional fields
    const user = await User.create({
      firstName: "John",
      lastName: "Doe",
      role: "instructor",
      institute: institute._id,
      email: "johndoe@techuniversity.edu",
      password: await bcrypt.hash("securepassword123", 10),
      firebaseUid: uuidv4(),
      courses: [],
      bio: "Experienced professor in computer science.",
      profilePicture: "https://techuniversity.edu/faculty/johndoe.png",
      specialization: "Software Engineering"
    });

    // Create a Course with extra details
    const course = await Course.create({
      title: "Introduction to Programming",
      description: "Learn the basics of programming with ease.",
      institute: institute._id,
      instructor: user._id,
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
      modules: [],
      category: "Computer Science",
      difficulty: "Beginner",
      language: "English",
      thumbnail: "https://techuniversity.edu/courses/intro-to-programming.png"
    });

    // Add course reference to the instructor
    await User.findByIdAndUpdate(user._id, { $push: { coursesEnrolled: course._id } });

    // Create a Module with extra description
    const module = await Module.create({
      title: "Programming Fundamentals",
      description: "Basic concepts of programming and computer science.",
      course: course._id,
      sequence: 1,
      sections: []
    });

    // Push the module into the course
    await Course.findByIdAndUpdate(course._id, { $push: { modules: module._id } });

    // Create a Section with additional overview and summary fields
    const section = await Section.create({
      title: "Introduction to Variables",
      overview: "Understanding variables and data types.",
      summary: "An overview of variables in programming and how they store data.",
      module: module._id,
      sequence: 1,
      sectionItems: []
    });

    // Add the section to the module
    await Module.findByIdAndUpdate(module._id, { $push: { sections: section._id } });

    // Create Section Items: Video and Assessment
    const video = await Video.create({
      title: "What is Programming?",
      description: "A detailed look into programming basics.",
      url: "https://youtu.be/oxFYdHVNpg8?si=gAXzBDyBWYfZI1xi",
      section: section._id,
      sequence: 1,
      startTime: 0,
      endTime: 10,
   
    });

    const assessment = await Assessment.create({
      title: "Basic Programming Quiz",
      section: section._id,
      sequence: 2,
      questions: [],
      passingScore: 70,
      timeLimit: 30 // in minutes
    });

    // Add both section items to the section
    await Section.findByIdAndUpdate(section._id, {
      $push: {
        sectionItems: {
          $each: [
            { itemId: video._id, itemType: 'video' },
            { itemId: assessment._id, itemType: 'assessment' }
          ]
        }
      }
    });

    // Create multiple questions using the new enum:
    // Allowed types: "multiple-choice", "multi-select", "true-false", "short-answer", "descriptive"

    // 1. Multiple-choice question
    const mcQuestion = await Question.create({
      assessment: assessment._id,
      questionText: "What is a variable in programming?",
      type: "multiple-choice",
      options: ["Data storage", "A type of function", "Programming tool", "Loop structure"],
      answer: ["Data storage"],
      difficulty: "Easy",
      explanation: "A variable stores data values that can change during program execution.",
      createdBy: user._id,
      points: 5
    });

    // 2. True/False question
    const tfQuestion = await Question.create({
      assessment: assessment._id,
      questionText: "In programming, a variable's value can change.",
      type: "true-false",
      options: ["True", "False"],
      answer: ["True"],
      difficulty: "Easy",
      explanation: "Variables are designed to hold changing data values.",
      createdBy: user._id,
      points: 3
    });

    // 3. Short-answer question (previously fill-in-the-blank)
    const shortAnswerQuestion = await Question.create({
      assessment: assessment._id,
      questionText: "A _______ is used to store data values in programming.",
      type: "short-answer",
      options: [], // No options needed for short-answer
      answer: ["variable"],
      difficulty: "Medium",
      explanation: "The correct answer is 'variable'.",
      createdBy: user._id,
      points: 7
    });

    // 4. Descriptive question (previously essay)
    const descriptiveQuestion = await Question.create({
      assessment: assessment._id,
      questionText: "Explain the importance of data types in programming.",
      type: "descriptive",
      options: [], // Descriptive type questions do not have preset options
      answer: [], // Answer will be evaluated manually
      difficulty: "Hard",
      explanation: "This question assesses your understanding of why data types matter in ensuring proper data handling.",
      createdBy: user._id,
      points: 10
    });

    // 5. Multi-select question
    const multiSelectQuestion = await Question.create({
      assessment: assessment._id,
      questionText: "Select all programming paradigms:",
      type: "multi-select",
      options: ["Object-Oriented", "Functional", "Procedural", "Linear"],
      answer: ["Object-Oriented", "Functional", "Procedural"],
      difficulty: "Medium",
      explanation: "Multiple paradigms exist; choose those that apply to modern programming.",
      createdBy: user._id,
      points: 8
    });

    // Add all questions to the assessment
    await Assessment.findByIdAndUpdate(assessment._id, {
      $push: { questions: { $each: [mcQuestion._id, tfQuestion._id, shortAnswerQuestion._id, descriptiveQuestion._id, multiSelectQuestion._id] } }
    });

    console.log("Dummy data created successfully!");
  } catch (error) {
    console.error("Failed to create dummy data:", error);
  } finally {
    mongoose.disconnect();
  }
}

createDummyData();
