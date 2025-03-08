import React, { useState } from 'react';

const JsonFileEditor = () => {
  const [segments, setSegments] = useState([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [questions, setQuestions] = useState([]);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === "application/json") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = JSON.parse(e.target.result);
        if (data && data["0"]) {
          setSegments(data["0"].segments);
          setQuestions(data["0"].questions);
        } else {
          alert('JSON format is incorrect or missing required data');
        }
      };
      reader.readAsText(file);
    } else {
      alert('Please upload a valid JSON file.');
    }
  };

  const handleQuestionChange = (questionIndex, field, value) => {
    const updatedQuestions = [...questions];
    if (updatedQuestions[questionIndex]) {
      updatedQuestions[questionIndex][field] = value;
      setQuestions(updatedQuestions);
    }
  };

  const findQuestionBySegment = (segmentIndex) => {
    return questions.findIndex(q => q.segment === segmentIndex + 1);
  };

  const nextSegment = () => {
    setCurrentSegmentIndex((prevIndex) => (prevIndex + 1) % segments.length);
  };

  const previousSegment = () => {
    setCurrentSegmentIndex((prevIndex) => (prevIndex - 1 + segments.length) % segments.length);
  };

  const handleSubmit = () => {
    console.log('Updated Data:', {segments, questions});
    // Here you would typically send the data to a server or save it locally
  };

  const currentQuestionIndex = findQuestionBySegment(currentSegmentIndex);

  return (
    <div className="p-6 bg-gray-100 h-full">
      <h1 className="text-3xl font-bold mb-6 text-center">Json File Editor</h1>
      <div className="flex justify-center mb-6">
        <input
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm"
        />
      </div>
      <h1 className='flex justify-center'>Segment : {currentQuestionIndex + 1}</h1>
      {segments.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="mb-4">
            <label className="block text-lg font-medium mb-2">Segment Text:</label>
            <textarea
              value={segments[currentSegmentIndex].text}
              onChange={(e) => handleSegmentChange(currentSegmentIndex, 'text', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
            />
          </div>
          {currentQuestionIndex !== -1 && (
            <div>
              <div className="mb-4">
                <label className="block text-lg font-medium mb-2">Question for segment {questions[currentQuestionIndex].segment} : </label>
                <input
                  type="text"
                  value={questions[currentQuestionIndex].question}
                  onChange={(e) => handleQuestionChange(currentQuestionIndex, 'question', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                />
              </div>
              {['option_1', 'option_2', 'option_3', 'option_4'].map((option, index) => (
                <div className="mb-4" key={option}>
                  <label className="block text-lg font-medium mb-2">Option {index + 1}:</label>
                  <input
                    type="text"
                    value={questions[currentQuestionIndex][option]}
                    onChange={(e) => handleQuestionChange(currentQuestionIndex, option, e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                  />
                </div>
              ))}
              <div className="mb-4">
                <label className="block text-lg font-medium mb-2">Correct Answer:</label>
                <input
                  type="text"
                  value={questions[currentQuestionIndex].correct_answer}
                  onChange={(e) => handleQuestionChange(currentQuestionIndex, 'correct_answer', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                />
              </div>
            </div>
          )}
          <div className="flex justify-between mb-4">
            <button
              onClick={previousSegment}
              className="px-4 py-2 bg-blue-500 text-white rounded-md shadow-sm hover:bg-blue-600"
            >
              Previous Segment
            </button>
            <button
              onClick={nextSegment}
              className="px-4 py-2 bg-blue-500 text-white rounded-md shadow-sm hover:bg-blue-600"
            >
              Next Segment
            </button>
          </div>
          <div className="flex justify-center">
            <button
              onClick={handleSubmit}
              className="px-6 py-2 bg-green-500 text-white rounded-md shadow-sm hover:bg-green-600"
            >
              Submit Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default JsonFileEditor;
