import { useState } from "react";
import Navbar from "./Navbar";
import ProfileUpload from "./temp";

function App() {
  const [profile, setProfile] = useState<string | null>(
    localStorage.getItem("profile")
  );
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div style={{ backgroundColor: "#e9eff1", minHeight: "100vh" }}>
      
      <Navbar 
        profile={profile} 
        onUpdateClick={() => setShowUpload(true)} 
      />

      {/* HERO SECTION */}
      {!showUpload && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "60px"
        }}>
          
          {/* LEFT TEXT */}
          <div style={{ maxWidth: "50%" }}>
            <h1 style={{ color: "#d17a22", fontSize: "48px" }}>
              Welcome to the Future of Learning
            </h1>

            <h3 style={{ color: "#1f4e5f" }}>
              Empowering Education for All
            </h3>

            <p style={{ color: "#555" }}>
              Connect, collaborate, and grow with our platform.
            </p>

            <button style={{
              backgroundColor: "#2c7a7b",
              color: "white",
              padding: "10px 20px",
              marginRight: "10px",
              borderRadius: "5px"
            }}>
              Explore Demo
            </button>

            <button style={{
              backgroundColor: "#2c7a7b",
              color: "white",
              padding: "10px 20px",
              borderRadius: "5px"
            }}>
              Get Started
            </button>
          </div>

          {/* RIGHT YOUTUBE STYLE CARD */}
          <div style={{
            background: "black",
            padding: "10px",
            borderRadius: "12px",
            width: "420px"
          }}>
            <div style={{ position: "relative" }}>
              <img 
                src="https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg"
                width="100%"
                style={{ borderRadius: "8px" }}
              />

              <img 
                src="https://cdn-icons-png.flaticon.com/512/727/727245.png"
                width="60"
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)"
                }}
              />
            </div>

            <p style={{ color: "white", marginTop: "10px" }}>
              ViBe Student Tutorial
            </p>
          </div>

        </div>
      )}

      {/* UPLOAD SCREEN */}
      {showUpload && (
        <div style={{ textAlign: "center", marginTop: "50px" }}>
          <ProfileUpload 
            setProfile={setProfile} 
            onDone={() => setShowUpload(false)} 
          />
        </div>
      )}
    </div>
  );
}

export default App;