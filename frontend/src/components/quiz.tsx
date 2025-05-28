export default function quiz({ content }: { content: string }) {
  return (
    <div className="quiz-container">
      <h1 className="quiz-title">Quiz</h1>
      <div className="quiz-content">
        <p>{content}</p>
        {/* Here you can add quiz questions and options */}
      </div>
    </div>
  );
}