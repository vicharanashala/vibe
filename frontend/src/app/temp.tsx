import { useState } from "react";

function ProfileUpload({ setProfile, onDone }: any) {
  const [image, setImage] = useState<File | null>(null);

  const uploadImage = async () => {
    if (!image) {
      alert("Select file first");
      return;
    }

    const formData = new FormData();
    formData.append("image", image);

    await fetch("http://localhost:5000/api/upload", {
      method: "POST",
      body: formData,
    });

    const url = URL.createObjectURL(image);

    localStorage.setItem("profile", url);
    setProfile(url);

    alert("Profile Updated!");
    onDone();
  };

  return (
    <div>
      <h2>Update Profile</h2>

      <input
        type="file"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            setImage(e.target.files[0]);
          }
        }}
      />

      <br /><br />

      <button onClick={uploadImage}>
        Upload
      </button>
    </div>
  );
}

export default ProfileUpload;