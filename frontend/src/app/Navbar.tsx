import { useState } from "react";

function Navbar({ profile, onUpdateClick }: any) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      padding: "15px 40px",
      backgroundColor: "#e9eff1",
      alignItems: "center"
    }}>

      {/* LEFT LOGO */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <img 
          src="https://vicharanashala.ai/logo.png"
          width="40"
          style={{ marginRight: "10px" }}
        />
        <h2 style={{ color: "#1f4e5f" }}>VICHARANASHALA</h2>
      </div>

      {/* RIGHT PROFILE */}
      <div style={{ position: "relative" }}>
        <img
          src={profile || "https://via.placeholder.com/40"}
          width="40"
          height="40"
          style={{
            borderRadius: "50%",
            cursor: "pointer"
          }}
          onClick={() => setOpen(!open)}
        />

        {open && (
          <div style={{
            position: "absolute",
            right: 0,
            top: "50px",
            background: "white",
            padding: "10px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
          }}>
            <p 
              style={{ cursor: "pointer" }}
              onClick={() => {
                setOpen(false);
                onUpdateClick();
              }}
            >
              Update Profile
            </p>
          </div>
        )}
      </div>

    </div>
  );
}

export default Navbar;