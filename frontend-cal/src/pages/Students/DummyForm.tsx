import React, { useState } from "react";
import { useCreateVideoDetailsMutation } from "../../store/apiService"; // Adjust import path

const DummyForm = () => {
  const [videoData, setvideoData] = useState({
    title: "",
    description: "",
    youtubeUrl: "",
  });

  const [createVideoDetails, { isLoading, isSuccess, isError, error }] =
    useCreateVideoDetailsMutation();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setvideoData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await createVideoDetails(videoData).unwrap(); // Wait for the mutation to complete
      console.log("Response from API:", response);
      alert("Video details submitted successfully!");
    } catch (err) {
      console.error("Error submitting form:", err);
      alert("Failed to submit video details. Please try again.");
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label htmlFor="title">Title:</label>
        <input
          type="text"
          id="title"
          name="title"
          value={videoData.title}
          onChange={handleChange}
          required
        />
        <label htmlFor="description">Description:</label>
        <input
          type="text"
          id="description"
          name="description"
          value={videoData.description}
          onChange={handleChange}
          required
        />
        <label htmlFor="youtubeUrl">YouTube URL:</label>
        <input
          type="url"
          id="youtubeUrl"
          name="youtubeUrl"
          value={videoData.youtubeUrl}
          onChange={handleChange}
          required
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Submitting..." : "Submit"}
        </button>
      </form>

      {/* Conditional rendering for success or error messages */}
      {isSuccess && <p>Form submitted successfully!</p>}
      {isError && <p>Error: {error?.data?.message || "Something went wrong!"}</p>}
    </div>
  );
};

export default DummyForm;
