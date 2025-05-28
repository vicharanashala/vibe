export default function Article({ content }: { content: string }) {
  return (
    <div className="article-container">
      <h1 className="article-title">Article</h1>
      <div className="article-content">
        <p>{content}</p>
      </div>
    </div>
  );
}