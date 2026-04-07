import { useEffect, useState } from "react";
import axios from "axios";

type Course = {
  _id: string;
  title: string;
  description: string;
  videoUrl: string;
};

function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [myCourses, setMyCourses] = useState<Course[]>([]);

  // Fetch all courses
  useEffect(() => {
    axios.get("http://localhost:5000/courses")
      .then((res) => {
        setCourses(res.data);
      })
      .catch(() => {
        alert("Error fetching courses");
      });
  }, []);

  // Enroll function
  const enroll = (courseId: string) => {
    axios.post("http://localhost:5000/enroll", {
      userEmail: "student@gmail.com",
      courseId,
    })
    .then((res) => alert(res.data))
    .catch(() => alert("Error enrolling"));
  };

  // Get enrolled courses
  const getMyCourses = () => {
    axios.get("http://localhost:5000/my-courses/student@gmail.com")
      .then((res) => {
        setMyCourses(res.data);
      })
      .catch(() => {
        alert("Error fetching my courses");
      });
  };

  // Quiz logic
  const checkAnswer = (option: string) => {
    if (option === "B") {
      alert("Correct Answer ✅");
    } else {
      alert("Wrong Answer ❌");
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h1>ViBe LMS</h1>

      {/* View My Courses Button */}
      <button onClick={getMyCourses}>
        View My Courses
      </button>

      <h2>All Courses</h2>

      {courses.length === 0 ? (
        <p>Loading courses...</p>
      ) : (
        courses.map((course) => (
          <div
            key={course._id}
            style={{
              border: "1px solid black",
              margin: "15px",
              padding: "10px"
            }}
          >
            <h3>{course.title}</h3>
            <p>{course.description}</p>

            <video width="300" controls>
              <source src={course.videoUrl} type="video/mp4" />
            </video>

            <br /><br />

            <button onClick={() => enroll(course._id)}>
              Enroll
            </button>
          </div>
        ))
      )}

      <h2>My Courses</h2>

      {myCourses.length === 0 ? (
        <p>No enrolled courses</p>
      ) : (
        myCourses.map((course) => (
          <div key={course._id}>
            <h3>{course.title}</h3>
            <p>{course.description}</p>
          </div>
        ))
      )}

      {/* Quiz Section */}
      <h2>Quiz</h2>

      <p>What is React?</p>

      <button onClick={() => checkAnswer("A")}>
        A. A database
      </button>

      <br /><br />

      <button onClick={() => checkAnswer("B")}>
        B. A JavaScript library
      </button>

      <br /><br />

      <button onClick={() => checkAnswer("C")}>
        C. An operating system
      </button>

      <br /><br />

      <button onClick={() => checkAnswer("D")}>
        D. A browser
      </button>
    </div>
  );
}

export default App;