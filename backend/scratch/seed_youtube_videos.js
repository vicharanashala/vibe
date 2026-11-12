import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('vibe');
  
  const updates = [
    {
      name: "Introduction to HTML & CSS",
      url: "https://www.youtube.com/watch?v=mJgBOIoGihA" // HTML & CSS Full Course - Beginner to Pro
    },
    {
      name: "React fundamentals Crash Course",
      url: "https://www.youtube.com/watch?v=7CqJlxBYj-M" // MERN Stack Tutorial - React, Node, Express, MongoDB
    },
    {
      name: "Introduction to LLMs and Prompt Engineering",
      url: "https://www.youtube.com/watch?v=zjkBMFhNj_g" // Intro to Large Language Models - Andrej Karpathy
    },
    {
      name: "LangChain & LangGraph Autonomous Agent Architectures",
      url: "https://www.youtube.com/watch?v=pBBe1pk8yKw" // LangGraph Stateful Agents Tutorial
    }
  ];

  for (const item of updates) {
    const res = await db.collection('videos').updateOne(
      { name: item.name },
      {
        $set: {
          url: item.url,
          URL: item.url,
          startTime: 0,
          endTime: 3600, // 1 hour threshold
          'details.URL': item.url,
          'details.startTime': "0",
          'details.endTime': "3600"
        }
      }
    );
    console.log(`Updated video "${item.name}" -> ${item.url} (Modified: ${res.modifiedCount})`);
  }
  
  await client.close();
}

main().catch(console.error);
