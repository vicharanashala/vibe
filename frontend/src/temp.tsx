import { useState } from "react";

function ProfileUpload() {
  const [image, setImage] = useState<File | null>(null);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Profile Upload</h2>

      <input
        type="file"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            setImage(e.target.files[0]);
          }
        }}
      />

      <button onClick={() => alert("File selected!")}>
        Upload
      </button>
    </div>
  );
}

export default ProfileUpload;