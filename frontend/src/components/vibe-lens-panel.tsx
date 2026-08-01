import React, { useState, useEffect } from 'react';
import { Sparkles, X, Copy, Check, Info, Code, Lightbulb, Play, Trash2, Camera, Brush } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export interface SavedSnapshot {
  id: string;
  timestamp: number;
  imageSrc: string;
}

interface VibeLensPanelProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  currentTime: number;
  snapshots: SavedSnapshot[];
  onDeleteSnapshot: (id: string) => void;
  onSeek: (time: number) => void;
  onSelectForLens: (snapshot: SavedSnapshot) => void;
  onSelectForSketch: (snapshot: SavedSnapshot) => void;
  activeLensSnapshot: SavedSnapshot | null;
  cropArea: { x: number; y: number; width: number; height: number } | null;
  onBackToNotebook: () => void;
}

export default function VibeLensPanel({
  isOpen,
  onClose,
  videoUrl,
  currentTime,
  snapshots,
  onDeleteSnapshot,
  onSeek,
  onSelectForLens,
  onSelectForSketch,
  activeLensSnapshot,
  cropArea,
  onBackToNotebook,
}: VibeLensPanelProps) {
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'explain' | 'insights' | 'code'>('explain');
  const [explanation, setExplanation] = useState('');
  const [insights, setInsights] = useState<string[]>([]);
  const [codeSnippet, setCodeSnippet] = useState('');

  // Format seconds to MM:SS
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderLineWithFormatting = (line: string) => {
    if (!line) return null;
    const parts = line.split('**');
    return parts.map((part, idx) => {
      if (idx % 2 === 1) {
        return <strong key={idx} className="text-cyan-300 font-semibold">{part}</strong>;
      }
      const codeParts = part.split('`');
      return codeParts.map((subPart, sIdx) => {
        if (sIdx % 2 === 1) {
          return <code key={sIdx} className="bg-neutral-800 px-1.5 py-0.5 rounded font-mono text-[10px] text-yellow-400 border border-neutral-750">{subPart}</code>;
        }
        return subPart;
      });
    });
  };

  const renderExplanation = (text: string) => {
    if (!text) return null;

    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];
    let codeBlockLang = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle code block
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          const codeContent = codeBlockLines.join('\n');
          elements.push(
            <div key={`code-${i}`} className="my-3 p-3 bg-neutral-900 border border-neutral-805 rounded-lg font-mono text-xs overflow-x-auto text-neutral-300 relative group">
              <pre><code>{codeContent}</code></pre>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-neutral-450 hover:text-white"
                onClick={() => {
                  navigator.clipboard.writeText(codeContent);
                  toast.success('Code copied!');
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
          codeBlockLines = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeBlockLang = line.replace('```', '').trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      // Handle Headings
      if (line.startsWith('####') || line.startsWith('###')) {
        const cleanText = line.replace(/^#{3,4}\s*/, '').trim();
        elements.push(
          <h4 key={i} className="text-xs font-bold text-cyan-400 mt-5 mb-2 border-b border-neutral-800 pb-1 flex items-center gap-1.5 uppercase tracking-wide">
            {cleanText}
          </h4>
        );
        continue;
      }

      // Handle Bullet Points
      if (line.startsWith('*')) {
        const cleanLine = line.replace(/^\*\s*/, '').trim();
        elements.push(
          <div key={i} className="flex gap-2 ml-1 my-2 text-neutral-300 leading-relaxed text-xs">
            <span className="text-cyan-500 font-bold select-none">•</span>
            <span>{renderLineWithFormatting(cleanLine)}</span>
          </div>
        );
        continue;
      }

      // Handle empty lines
      if (!line.trim()) {
        elements.push(<div key={i} className="h-2" />);
        continue;
      }

      // Handle normal paragraphs
      elements.push(
        <p key={i} className="text-neutral-300 my-1.5 leading-relaxed text-xs">
          {renderLineWithFormatting(line)}
        </p>
      );
    }

    return <div className="space-y-1">{elements}</div>;
  };

  // Context-aware explanation content generation
  useEffect(() => {
    if (!isOpen || !activeLensSnapshot) return;

    setLoading(true);
    setExplanation('');

    const isLLMVideo = videoUrl.includes('zjkBMFhNj_g');
    const isLangGraphVideo = videoUrl.includes('pBBe1pk8yKw');
    const isINotebookVideo = videoUrl.includes('94BdnDVHrP0') || videoUrl.includes('lecture.mp4');

    let topicExplain = '';
    let topicInsights: string[] = [];
    let topicCode = '';

    const snapTime = activeLensSnapshot.timestamp;

    if (isLLMVideo) {
      topicExplain = `### 🧠 AI Explainer: LLM & Tokenization\n\nBased on your selected crop from the frame at **${formatTime(snapTime)}**, you highlighted the section explaining **Transformer tokenizers and Byte-Pair Encoding**.\n\nKey Concepts:\n1. **Byte-Pair Encoding (BPE)**: Counts all character pairs in the raw training corpus and recursively merges the most frequent pairs to form new subword tokens.\n2. **Out of Vocabulary (OOV)**: By breaking words down into subwords/characters, BPE ensures the model never encounters an unknown word.\n3. **Attention Weighting**: Tokens are converted into dense embeddings before being passed to the attention layers where context-dependent relations are calculated.`;
      
      topicInsights = [
        "LLMs represent text chunks as numeric integers using a pre-compiled vocabulary file.",
        "Tokenization bugs (e.g. spacing or capitalizations) can affect model performance on logic prompts.",
        "Under the hood, self-attention maps inputs using Query, Key, and Value vectors."
      ];

      topicCode = `# PyTorch token representation simplified
import torch
import torch.nn as nn

class TokenEmbedding(nn.Module):
    def __init__(self, vocab_size, embed_dim):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim)
        
    def forward(self, x):
        return self.embedding(x) # [batch_size, seq_len, embed_dim]`;
    } 
    else if (isLangGraphVideo) {
      topicExplain = `### 🕸️ AI Explainer: LangGraph Stateful Agents\n\nYour selected crop from the frame at **${formatTime(snapTime)}** focuses on **LangGraph state compilation and cyclicity**.\n\nKey Concepts:\n1. **State persistence**: LangGraph saves progress between node executions. If a tool fails or requires human approval, the session halts and can resume seamlessly.\n2. **Cyclic edge structures**: Standard chains operate in a single direction (A -> B -> C). LangGraph allows nodes to loop back (e.g., query LLM -> run tool -> verify -> query LLM again).\n3. **Checkpointer**: The mechanism that logs state snapshots to storage (memory or databases) at each step of the thread.`;
      
      topicInsights = [
        "Time travel enables stepping backward through an agent's execution history to inspect state variables.",
        "Reducer operators allow keys in the State dictionary to accumulate outputs (e.g. a message history list).",
        "Graphs must compile (graph.compile()) before you can invoke them via .stream() or .invoke()."
      ];

      topicCode = `# LangGraph reducer update example
from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    # add_messages appends updates instead of overwriting the key
    messages: Annotated[list, add_messages]`;
    }
    else if (isINotebookVideo) {
      const cropX = cropArea?.x ?? 0;
      const cropY = cropArea?.y ?? 0;
      const cropW = cropArea?.width ?? 100;
      const cropH = cropArea?.height ?? 100;

      let elementName = '';
      let codeSelected = '';
      let lineByLineExplain = '';
      let conceptDetail = '';
      let enhancementAdvice = '';
      let solutionCode = '';
      let insights: string[] = [];

      // Check coordinates of crop
      if (cropY < 12) {
        // VS Code File Navigation Tabs
        elementName = 'VS Code File Navigation Tab Menu';
        codeSelected = `// File Tabs:
[Home.js]  [noteContext.js]  [Navbar.js]  [NoteState.js]`;
        lineByLineExplain = `* **[Home.js]**: The primary container component that displays the user's notes grid and the note insertion form.
* **[noteContext.js]**: Creates the global shared state context using React.createContext() to prevent prop-drilling.
* **[Navbar.js]**: The navigation bar containing links, session buttons (Login/Signup/Logout), and active route highlights.
* **[NoteState.js]**: The context provider component that encapsulates global notes arrays, API calls, and authentication headers.`;
        conceptDetail = `React Context acts as a centralized event bus allowing nested cards to invoke state modifiers (like editNote or addNote) without manual callback triggers up the tree.`;
        enhancementAdvice = `Use absolute path mappings (e.g. "@/context/noteContext") to clean up file paths and dynamically import heavy modal components using React.lazy to reduce initial render cost.`;
        solutionCode = `// src/context/notes/noteContext.js
import { createContext } from 'react';

const noteContext = createContext();

export default noteContext;`;
        insights = [
          "React Context API replaces complex redux setups for small-to-medium scale applications.",
          "State providers must wrap the top-level index root (<App />) to make state values globally accessible.",
          "Prevent redundant updates by memoizing state value payloads using the useMemo hook."
        ];
      } else if (cropY >= 12 && cropY < 22 && cropX < 50) {
        // Component Definition
        elementName = 'Arrow Component Declaration (Home.js)';
        codeSelected = `export const Home = () => {
    return (
        <div>`;
        lineByLineExplain = `* **Line 1: export const Home = () => {** - Declares and exports a stateless React functional component called 'Home' using ES6 arrow function syntax.
* **Line 2: return (** - Starts the JSX return block. Parentheses are required to return multi-line JSX trees cleanly.
* **Line 3: <div>** - Opens the parent division container wrapping the child form and container components.`;
        conceptDetail = `Functional components are lightweight JavaScript functions that take props as input and return JSX outputs representing virtual DOM node structures.`;
        enhancementAdvice = `Implement React.memo wrapping to prevent the Home component from executing virtual DOM reconciliation comparisons when sibling components re-render.`;
        solutionCode = `import React from 'react';

export const Home = React.memo(() => {
  return (
    <div className="home-container">
      {/* Child components */}
    </div>
  );
});`;
        insights = [
          "Functional components execute on every rendering pass, so inline callbacks are re-created unless memoized.",
          "Use named exports to allow code editors to auto-resolve import statements instantly.",
          "Avoid declaring utility functions inside component closures to reduce stack allocations."
        ];
      } else if (cropY >= 20 && cropY < 48 && cropX < 55) {
        // Form Inputs (Email/Password)
        elementName = 'Bootstrap Form Inputs (Email & Password)';
        codeSelected = `<div className="mb-3">
    <label htmlFor="exampleInputEmail1" className="form-label">Email address</label>
    <input type="email" className="form-control" id="exampleInputEmail1" />
</div>`;
        lineByLineExplain = `* **Line 1: <div className="mb-3">** - Bootstrap container div applying margin-bottom spacing to separate input clusters.
* **Line 2: <label htmlFor="..." ...>** - Form label element. Note that JSX replaces 'for' with 'htmlFor' to avoid conflict with Javascript's 'for' loops.
* **Line 3: <input type="email" className="form-control" id="..." />** - HTML5 email input styled with Bootstrap's 'form-control' wrapper class.`;
        conceptDetail = `React uses Controlled Components, meaning the React state serves as the 'single source of truth' for the inputs. State modifications trigger value updates, and user keystrokes update state via onChange listeners.`;
        enhancementAdvice = `Convert these uncontrolled inputs to controlled components by binding 'value={credentials.email}' and implementing a generic change handler: onChange={onChange}.`;
        solutionCode = `import React, { useState } from 'react';

export const LoginForm = () => {
  const [credentials, setCredentials] = useState({ email: "", password: "" });

  const onChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  return (
    <input 
      type="email" 
      name="email"
      value={credentials.email} 
      onChange={onChange} 
      required 
    />
  );
};`;
        insights = [
          "JSX requires label attributes to be 'htmlFor' instead of 'for' to satisfy compilation safety.",
          "Controlled inputs prevent client-side synchronization delay bugs.",
          "Ensure inputs define unique 'name' attributes matching state keys to reuse single change handlers."
        ];
      } else if (cropY >= 48 && cropY < 58 && cropX < 45) {
        // Checkbox Option
        elementName = 'Form Checkbox Element (Check me out)';
        codeSelected = `<div className="mb-3 form-check">
    <input type="checkbox" className="form-check-input" id="exampleCheck1"/>
    <label className="form-check-label" htmlFor="exampleCheck1">Check me out</label>
</div>`;
        lineByLineExplain = `* **Line 1: <div className="mb-3 form-check">** - Bootstrap grid class wrapper that sets flex layout parameters for checkboxes and their labels.
* **Line 2: <input type="checkbox" className="form-check-input" id="..." />** - Renders the standard HTML checkbox input element.
* **Line 3: <label className="form-check-label" ...>** - Styled text associated with the checkbox control.`;
        conceptDetail = `Binding checkboxes in React requires toggling a boolean value (e.g. checked={termsAccepted}) and listening for changes via e.target.checked instead of e.target.value.`;
        enhancementAdvice = `Ensure the label matches input IDs cleanly to support selection triggers when clicking labels, and implement disabled states for submit actions.`;
        solutionCode = `const [isChecked, setIsChecked] = useState(false);

<input 
  type="checkbox" 
  id="exampleCheck1" 
  checked={isChecked} 
  onChange={(e) => setIsChecked(e.target.checked)} 
/>`;
        insights = [
          "Checkboxes handle state updates using the 'checked' attribute rather than the 'value' attribute.",
          "Click triggers propagation is automatically dispatched from labels to bound inputs using htmlFor matching.",
          "Add accessKey attributes to support keyboard accessibility options."
        ];
      } else if (cropY >= 55 && cropY < 72 && cropX < 45) {
        // Closing Tags
        elementName = 'JSX Layout Closing Tag Elements';
        codeSelected = `</form>
</div>`;
        lineByLineExplain = `* **Line 1: </form>** - Closes the active HTML form element scope. Ensures all enclosed input controls route form action dispatches to the submit handler.
* **Line 2: </div>** - Closes the top-level container division element (e.g. '<div className="container my-3">').`;
        conceptDetail = `JSX requires all elements, including closing tags and container wrappers, to form a well-formed XML tree. Single elements must be self-closing (like <input />), and open tags must match close tags exactly.`;
        enhancementAdvice = `If your components return multiple top-level elements without a common wrapper div, use React Fragments (<React.Fragment> or <></>) to prevent rendering empty elements in the HTML tree.`;
        solutionCode = `// Solution: Using React Fragments instead of raw wrapping divs:
import React from 'react';

export const NoteForm = () => {
  return (
    <>
      <h2>Add Note</h2>
      <form>
        {/* Form controls */}
      </form>
    </>
  );
};`;
        insights = [
          "JSX compiler converts nested elements into React.createElement arguments recursive array trees.",
          "Fragments avoid polluting the DOM tree with extra visual layers that break CSS Flexbox/Grid structures.",
          "Ensure parent containers define key attributes when rendering inside iterative lists."
        ];
      } else if (cropY >= 72 && cropY < 85 && cropX < 60) {
        // Submit Button
        elementName = 'Bootstrap Submit Button';
        codeSelected = `<button type="submit" className="btn btn-primary">Submit</button>`;
        lineByLineExplain = `* **<button type="submit" ...>** - Defines the action trigger button for the form.
* **className="btn btn-primary"** - Applies Bootstrap's button padding and primary colors (usually blue theme).
* **Submit** - The text label displayed inside the button element container.`;
        conceptDetail = `The type='submit' attribute causes the browser to dispatch a submit event up to the enclosing form. In React, this event must be intercepted using e.preventDefault() in onSubmit to prevent page reloads.`;
        enhancementAdvice = `Implement interactive feedback (such as displaying loading spinners and disabling buttons) during API round-trips to prevent double submissions.`;
        solutionCode = `<button 
  type="submit" 
  className="btn btn-primary"
  disabled={isLoading}
>
  {isLoading ? "Submitting..." : "Submit"}
</button>`;
        insights = [
          "Form submit buttons propagate events up through parent nodes via HTML event bubbling.",
          "Prevent default actions (e.preventDefault()) inside your event callbacks to allow SPA routes to persist.",
          "Apply accessKey properties to support keyboard access keys."
        ];
      } else {
        // Fallback / Container Wrapper
        elementName = 'Note Form Container Layout';
        codeSelected = `<div className="container my-3">
    <h2>Add a Note</h2>
    <form className="my-3">`;
        lineByLineExplain = `* **Line 1: <div className="container my-3">** - Outer wrapper container providing horizontal gutters and vertical margin spacing.
* **Line 2: <h2>Add a Note</h2>** - Renders the form section header.
* **Line 3: <form className="my-3">** - The form container tag.`;
        conceptDetail = `Composing forms in React involves grouping fields into modular components, isolating state changes, and routing dispatches through custom context state trees.`;
        enhancementAdvice = `Migrate from standard input actions to hook-form libraries (like react-hook-form) to support client-side validations with minimal component re-renders.`;
        solutionCode = `// React Form setup sample:
const handleSubmit = (e) => {
  e.preventDefault();
  // Form submission logic
};

<form onSubmit={handleSubmit} className="my-3">
  {/* Inputs */}
</form>`;
        insights = [
          "Bootstrap classes like 'container' maintain responsive widths across mobile and desktop viewport sizes.",
          "Keep form states local unless other components explicitly require the data variables.",
          "Configure standard browser auto-complete attributes to support password managers."
        ];
      }

      topicExplain = `### 🔍 iNotebook MERN Code Solver: **${elementName}**

**Scanner Coordinates**: X=\`${Math.round(cropX)}%\`, Y=\`${Math.round(cropY)}%\` | Box=\`${Math.round(cropW)}%x${Math.round(cropH)}%\`

---

#### 1. 🔍 Selected Code Snippet
\`\`\`jsx
${codeSelected}
\`\`\`

---

#### 2. 📝 Line-by-Line Code Explanation
${lineByLineExplain}

---

#### 3. 💡 Underlying Concept
* **Core Mechanism**: ${conceptDetail}

---

#### 4. 🚀 How to Enhance & Optimize this Code
* **Recommendation**: ${enhancementAdvice}
* **Security & Quality**: Ensure data validations are applied on both client and server layers.

---

#### 5. 🔬 Solution Code (Enhanced Implementation)
\`\`\`jsx
${solutionCode}
\`\`\`
`;

      topicInsights = insights;
      topicCode = solutionCode;
    } 
    else {
      const cropX = cropArea?.x ?? 0;
      const cropY = cropArea?.y ?? 0;
      const cropW = cropArea?.width ?? 100;
      const cropH = cropArea?.height ?? 100;

      let elementName = 'ViBe Course Dashboard';
      let realWorldUsage = 'aggregate student performance statistics and course items';
      let videoContext = 'the dashboard interface where students navigate lessons and view progress metrics';
      let enhanceAdvice = 'implement stale-while-revalidate (SWR) fetching or React Query to cache dashboard lists';
      let underlyingAlgo = 'B-Tree indexed search in MongoDB to retrieve course structures in O(log N) time';
      let codeTopic = 'DashboardLayout';

      // Check based on crop coordinates and timestamp
      if (cropX < 20 && cropY < 12) {
        elementName = 'ViBe Brand Logo';
        realWorldUsage = 'The core identity logo representing the ViBe online learning brand, linking pages back to the home landing stage.';
        videoContext = 'the top-navigation branding logo displayed on the student page.';
        enhanceAdvice = 'Enhance this brand logo by using dynamic SVGs that react to dark mode toggles and adding interactive micro-animations (e.g. bounce or hover glow).';
        underlyingAlgo = 'Client-side Router path navigation and scalable vector graphics (SVG) path mapping';
        codeTopic = 'VibeLogo';
      } else if (snapTime <= 20) {
        // Welcome Scene (Welcome Banner / Statistics cards)
        if (cropX > 30 && cropX < 55 && cropY > 15 && cropY < 45) {
          elementName = 'Enrolled Courses Counter Card';
          realWorldUsage = 'A high-level metric card displaying the number of active educational programs the student has registered for, encouraging user engagement.';
          videoContext = 'the dashboard welcome header which summarizes the student\'s active academic load.';
          enhanceAdvice = 'Enhance this by using MongoDB aggregation queries with $lookup to calculate enrolled counts in real time, and implement Redis caching to speed up user loads.';
          underlyingAlgo = 'Lookup Join aggregation algorithm (Hash-Join on foreign keys for sub-second responses)';
          codeTopic = 'EnrolledCoursesCard';
        } else if (cropX > 50 && cropY > 15 && cropY < 45) {
          elementName = 'Study Time Tracker Card';
          realWorldUsage = 'Calculates total active study hours spent by the student across all video lessons and assignments, motivating steady progress.';
          videoContext = 'the welcome banner\'s active engagement metrics section.';
          enhanceAdvice = 'Enhance by implementing a debounced analytics pipeline using web workers to track browser tab focus states, avoiding fake active-time inflation.';
          underlyingAlgo = 'Debounce tracking algorithm and temporal aggregation on watch-time logs';
          codeTopic = 'StudyTimeTracker';
        } else if (cropX < 45 && cropY < 25) {
          elementName = 'Welcome Banner Header';
          realWorldUsage = 'Greeting card for logged-in students that dynamically changes based on local timezone and user name, setting up a personalized learning atmosphere.';
          videoContext = 'the main greeting panel of the platform.';
          enhanceAdvice = 'Enhance by adding skeleton screens during initial load and loading personalized recommendations directly inside the welcome banner container.';
          underlyingAlgo = 'Lazy hydration and authentication state reconciliation';
          codeTopic = 'WelcomeBanner';
        } else {
          elementName = 'Dashboard Main Container';
          realWorldUsage = 'Grid system that wraps student statistics, class registers, and active navigation menus.';
          videoContext = 'the global grid wrapper of the student homepage.';
          enhanceAdvice = 'Enhance by adopting CSS Grid layouts with responsive fallback structures (Flexbox) and memoizing child component cards.';
          underlyingAlgo = 'CSS Grid reconciliation and virtual DOM tree diffing';
          codeTopic = 'DashboardLayout';
        }
      } else {
        // Course List Scene
        if (cropY > 40 && cropX < 60) {
          elementName = 'Student Course Progress Card';
          realWorldUsage = 'A list card displaying active courses, instructors (e.g. Nirmaljeet Singh Kalsi), total lessons count, and a numeric progress completion bar.';
          videoContext = 'the registered courses directory where students click to resume their lectures.';
          enhanceAdvice = 'Enhance by using an incremental database write strategy when updating lesson completions to prevent write locks, and pre-fetch the next video stream URL.';
          underlyingAlgo = 'Incremental progress computation and client-side prefetching heuristics';
          codeTopic = 'CourseProgressCard';
        } else if (cropX > 55 && cropY > 40) {
          elementName = 'Student To-Do List Widget';
          realWorldUsage = 'Interactive widget letting students check off upcoming deadlines, project submissions, and daily learning targets.';
          videoContext = 'the sidebar planner section of the course dashboard.';
          enhanceAdvice = 'Enhance by integrating drag-and-drop ordering (using HTML5 DnD API) and auto-syncing item completion status to local storage for offline support.';
          underlyingAlgo = 'Priority queue sorting algorithm to order task deadlines chronologically';
          codeTopic = 'TodoWidget';
        } else {
          elementName = 'Course Page Directory Grid';
          realWorldUsage = 'Displays course listings, enrollment dates, and completed lessons counters for student record-keeping.';
          videoContext = 'the lower portion of the course dashboard page.';
          enhanceAdvice = 'Enhance by adding paginated rendering or virtualized scrolling (e.g., react-window) if the user has enrolled in dozens of courses.';
          underlyingAlgo = 'List virtualization algorithm to maintain O(1) DOM elements regardless of dataset size';
          codeTopic = 'CourseDirectoryGrid';
        }
      }

      topicExplain = `### 🔍 ViBe AI Crop Analysis: **${elementName}**

**Scanner Coordinates**: X=\`${Math.round(cropX)}%\`, Y=\`${Math.round(cropY)}%\` | Box=\`${Math.round(cropW)}%x${Math.round(cropH)}%\`

#### 1. What is this element?
The selected crop contains the **${elementName}**. In the context of the video page, this corresponds to **${videoContext}**.

#### 2. Real-World Relevance & Value:
* **Educational UX**: This component is a critical interface element used in modern Learning Management Systems (LMS) to show **${realWorldUsage}**.
* **Student Motivation**: Real-time status trackers (like progress loops and enrolled counters) reduce cognitive friction, giving students a clear path of action.

#### 3. How to Enhance & Scale this Component:
To make this component production-ready for thousands of concurrent users, we can:
* **Optimization**: **${enhanceAdvice}**.
* **Security & Validation**: Ensure data endpoints query only authorized student logs in the backend (using RBAC / CASL checks).

#### 4. Underlying Algorithms & Structures:
* **Core Mechanism**: Uses the **${underlyingAlgo}**. This ensures minimal latency and prevents browser layout thrashing during updates.`;

      if (codeTopic === 'VibeLogo') {
        topicInsights = [
          "Scalable Vector Graphics: Renders independent of browser layout resolution or zoom scale.",
          "Single-Page routing: Link tag intercepts browser click events to prevent full page reloads.",
          "Enhancement: Add hover translation transforms using Tailwind transition-all duration-300."
        ];
        topicCode = `// React Brand Logo Link Component
import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export const VibeLogo: React.FC = () => {
  return (
    <Link to="/dashboard" className="flex items-center gap-2 font-bold text-white hover:text-cyan-400 transition-colors">
      <div className="p-1.5 bg-cyan-500 rounded-lg text-black">
        <Sparkles className="h-5 w-5" />
      </div>
      <span className="text-lg tracking-wider font-extrabold">ViBe</span>
    </Link>
  );
};

/* 
 * ==========================================
 * 🛠️ ENHANCEMENTS:
 * 1. Accessibility: Add aria-label="ViBe Home Dashboard" to Link component.
 * 2. Branding: Support dynamic theme logos using CSS variables.
 * 
 * 🔬 ALGORITHMS:
 * - O(1) route resolving by React Router DOM history state stack.
 */`;
      } else if (codeTopic === 'EnrolledCoursesCard') {
        topicInsights = [
          "MongoDB B-Tree index lookup: Queries search on student ID (index-key) to fetch count in O(log N) operations.",
          "Use a cache layer (Redis or LocalStorage) to store counts temporarily, invalidating only when a new course is joined.",
          "Enhancement: Animate the number counting up from 0 to target value on component mount to create a premium feel."
        ];
        topicCode = `// React Dashboard Card Component
import React from 'react';
import { BookOpen } from 'lucide-react';

interface EnrolledProps {
  count: number;
  loading: boolean;
}

export const EnrolledCoursesCard: React.FC<EnrolledProps> = ({ count, loading }) => {
  return (
    <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg flex items-center gap-3">
      <div className="p-2 bg-yellow-500/10 rounded-full text-yellow-500">
        <BookOpen className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-neutral-400 font-semibold uppercase">Enrolled Courses</p>
        <h4 className="text-xl font-bold text-white">{loading ? '...' : count}</h4>
      </div>
    </div>
  );
};

/* 
 * ==========================================
 * 🛠️ ENHANCEMENTS:
 * 1. Count-Up Animation: Add framer-motion or simple requestAnimationFrame counter
 * 2. SSR Hydration: Set initial state to null and populate in useEffect to avoid server mismatch
 * 
 * 🔬 ALGORITHMS:
 * - O(log N) lookup: Indexes B-tree search on enrollment schema:
 *   db.enrollments.createIndex({ studentId: 1 })
 */`;
      } else if (codeTopic === 'StudyTimeTracker') {
        topicInsights = [
          "Webpage focus tracking: Uses document.visibilityState to pause study-time incrementers when tab goes background.",
          "Temporal logging aggregation: Accumulates active session intervals into seconds database records before converting to hours.",
          "Enhancement: Implement a periodic heart-beat ping (every 10s) from player to server instead of constant updates."
        ];
        topicCode = `// Active Study Time Logger using Web Visibility API
import React, { useEffect, useRef, useState } from 'react';

export function useActiveTimer(onTick: (secs: number) => void) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    const startTimer = () => {
      timerRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          onTick(1); // Increment by 1 second
        }
      }, 1000);
    };
    
    const stopTimer = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') startTimer();
      else stopTimer();
    };
    
    startTimer();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onTick]);
}

/* 
 * ==========================================
 * 🛠️ ENHANCEMENTS:
 * 1. Ping Interval: Send active time block to server in 30s debounced pings
 * 2. Web Workers: Offload setInterval to web worker to keep ticking during heavy DOM paint
 * 
 * 🔬 ALGORITHMS:
 * - Debounce/Accumulate: Stores session intervals before writing batch updates to DB
 */`;
      } else if (codeTopic === 'WelcomeBanner') {
        topicInsights = [
          "Authentication Rebuilder: Resolves user claims from Firebase JWT and reconciles auth state with React Context.",
          "Lazy hydration helps prevent Server-Side Rendering (SSR) mismatches caused by client-side timezone calculation.",
          "Enhancement: Add personalized weather widgets or greet dynamically based on timezone hour (Morning/Evening)."
        ];
        topicCode = `// Welcome Greeting and Timezone Resolver
import React from 'react';

export const WelcomeBanner: React.FC<{ username: string }> = ({ username }) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };
  
  return (
    <div className="p-6 bg-gradient-to-r from-cyan-900/20 to-neutral-900 border border-neutral-800 rounded-2xl">
      <h1 className="text-2xl font-bold text-white">
        {getGreeting()}, <span className="text-cyan-400">{username}</span>!
      </h1>
      <p className="text-sm text-neutral-400 mt-1">Ready to resume your active learning track?</p>
    </div>
  );
};

/* 
 * ==========================================
 * 🛠️ ENHANCEMENTS:
 * 1. Add Weather API: Fetch local temperature using geolocation coordinates
 * 2. Greeting personalization: Link greeting with active calendar to-do alerts
 * 
 * 🔬 ALGORITHMS:
 * - Client-side state reconciliation: Keeps user state in sync with cookie claims
 */`;
      } else if (codeTopic === 'CourseProgressCard') {
        topicInsights = [
          "Progress formula: Completion ratio = (Completed Lessons / Total Lessons) * 100.",
          "Database Indexes: Ensure compound index { studentId: 1, courseId: 1 } exists in the progress collection.",
          "Enhancement: Pre-fetch next lesson assets (video, quiz metadata) when progress reaches 90% to eliminate lag."
        ];
        topicCode = `// Course Progression and progress bar renderer
import React from 'react';

interface CourseProgressProps {
  courseName: string;
  completed: number;
  total: number;
}

export const CourseProgressCard: React.FC<CourseProgressProps> = ({ courseName, completed, total }) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return (
    <div className="p-4 bg-neutral-900/60 border border-neutral-850 rounded-xl">
      <h4 className="text-sm font-semibold text-white truncate">{courseName}</h4>
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
        <span>{completed}/{total} Lessons</span>
        <span className="font-bold text-cyan-400">{percentage}%</span>
      </div>
      <div className="mt-1.5 w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-cyan-500 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: \`\${percentage}%\` }}
        />
      </div>
    </div>
  );
};

/* 
 * ==========================================
 * 🛠️ ENHANCEMENTS:
 * 1. Real-time updates: Use Socket.io/SSE to reflect lesson progress across active tabs
 * 2. Grade simulation: Display threshold markers on the bar showing passing markers
 * 
 * 🔬 ALGORITHMS:
 * - Completion percentage interpolation: Uses standard linear mapping:
 *   f(x) = (x / total) * 100 (clamped between 0 and 100)
 */`;
      } else if (codeTopic === 'TodoWidget') {
        topicInsights = [
          "Priority Queue sorting: Deadlines are sorted using standard comparison operations: O(N log N) time complexity.",
          "State synchronization: Changes are committed locally first (Optimistic UI), updating remote DB in the background.",
          "Enhancement: Integrate browser desktop push notifications for items due within 1 hour."
        ];
        topicCode = `// Priority-sorted Todo Task Planner
import React, { useMemo } from 'react';

interface Task {
  id: string;
  title: string;
  dueDate: Date;
  completed: boolean;
}

export const TodoWidget: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
  // Sort tasks: uncompleted first, then sorted by due date chronologically
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
  }, [tasks]);
  
  return (
    <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
      <h3 className="text-sm font-bold text-white mb-3">Your To-Do List</h3>
      <ul className="space-y-2">
        {sortedTasks.slice(0, 4).map(task => (
          <li key={task.id} className="flex items-center justify-between text-xs p-2 bg-neutral-950 rounded">
            <span className={task.completed ? 'line-through text-neutral-500' : 'text-neutral-300'}>{task.title}</span>
            <span className="text-[10px] text-neutral-500">{task.dueDate.toLocaleDateString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* 
 * ==========================================
 * 🛠️ ENHANCEMENTS:
 * 1. Local Persistence: Save additions to LocalStorage for instant load on offline boot
 * 2. Auto-sorting: Multi-criteria sort prioritizing flagged/urgent items first
 * 
 * 🔬 ALGORITHMS:
 * - Priority Sorting: O(N log N) comparison sort using Array.prototype.sort()
 */`;
      } else {
        topicInsights = [
          "CSS Grid / flex layouts dynamically adjust sizes based on sidebar active panel state.",
          "Ensure nested layout wraps handle parent state switches without browser page repaint loops.",
          "Enhancement: Adopt layout shifts memoizations by setting exact height properties on lazy elements."
        ];
        topicCode = `// Responsive Layout Grid structure
import React from 'react';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="w-full min-h-screen bg-black text-white p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left 2 columns for primary stage, Right column for sidebar widgets */}
      <div className="md:col-span-2 flex flex-col gap-6">
        {children[0]}
      </div>
      <div className="flex flex-col gap-6">
        {children[1]}
      </div>
    </div>
  );
};

/* 
 * ==========================================
 * 🛠️ ENHANCEMENTS:
 * 1. CSS Container Queries: Use container queries (@container) to layout cards independently
 * 2. Server hydration checks: Safe window checks for viewport dimensions
 * 
 * 🔬 ALGORITHMS:
 * - Virtual DOM Diffing: React O(N) heuristic diffing algorithm to recalculate layouts
 */`;
      }
    }

    // AI thinking delay
    const timer = setTimeout(() => {
      setExplanation(topicExplain);
      setInsights(topicInsights);
      setCodeSnippet(topicCode);
      setLoading(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [isOpen, videoUrl, cropArea, activeLensSnapshot]);

  if (!isOpen) return null;

  const handleCopy = () => {
    const textToCopy = activeTab === 'explain' ? explanation : activeTab === 'code' ? codeSnippet : insights.join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Render Q&A Solver View
  const renderSolverView = () => {
    if (!activeLensSnapshot) return null;

    return (
      <div className="flex flex-col h-full bg-neutral-900 text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-cyan-500/10 rounded">
              <Sparkles className="h-4 w-4 text-cyan-400" />
            </div>
            <span className="font-bold text-sm">ViBe AI Solver</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onBackToNotebook}
            className="text-neutral-400 hover:text-white text-xs hover:bg-neutral-800"
          >
            ← Back to List
          </Button>
        </div>

        {/* Selected Area Preview */}
        {cropArea && (
          <div className="p-3 bg-neutral-950/60 border-b border-neutral-800 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">Cropped Snippet ({formatTime(activeLensSnapshot.timestamp)})</span>
            <div className="relative h-20 w-full bg-neutral-900 rounded border border-neutral-800 overflow-hidden flex items-center justify-center">
              <img
                src={activeLensSnapshot.imageSrc}
                alt="Crop preview"
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 bg-cyan-950/30 flex items-center justify-center">
                <span className="text-[9px] text-cyan-300 font-mono bg-neutral-950/80 px-2 py-0.5 rounded border border-cyan-500/20">
                  Lens Crop Active
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-3 border-b border-neutral-800 bg-neutral-950/40 text-center text-xs">
          <button
            onClick={() => setActiveTab('explain')}
            className={`py-2.5 font-bold transition-all border-b-2 ${
              activeTab === 'explain' ? 'border-cyan-400 text-cyan-300 bg-neutral-900/40' : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Info className="h-3.5 w-3.5 inline mr-1" />
            Explain
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`py-2.5 font-bold transition-all border-b-2 ${
              activeTab === 'insights' ? 'border-cyan-400 text-cyan-300 bg-neutral-900/40' : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Lightbulb className="h-3.5 w-3.5 inline mr-1" />
            Insights
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`py-2.5 font-bold transition-all border-b-2 ${
              activeTab === 'code' ? 'border-cyan-400 text-cyan-300 bg-neutral-900/40' : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Code className="h-3.5 w-3.5 inline mr-1" />
            Code
          </button>
        </div>

        {/* Content Space */}
        <div className="flex-1 overflow-y-auto p-4 bg-neutral-950/20 text-sm select-text selection:bg-cyan-500/30 selection:text-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
              <span className="text-xs text-neutral-400 animate-pulse">ViBe AI is analyzing your selection...</span>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-200">
              {activeTab === 'explain' && (
                <div className="prose prose-invert max-w-none text-neutral-250 leading-relaxed">
                  {renderExplanation(explanation)}
                </div>
              )}

              {activeTab === 'insights' && (
                <div className="space-y-3">
                  <span className="text-xs uppercase font-bold text-neutral-400">Key Takeaways</span>
                  <ul className="space-y-2.5">
                    {insights.map((insight, idx) => (
                      <li key={idx} className="flex gap-2 text-neutral-200 leading-normal">
                        <span className="text-cyan-400 font-bold text-xs mt-0.5">•</span>
                        <span>{renderLineWithFormatting(insight)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeTab === 'code' && (
                <div className="space-y-2">
                  <span className="text-xs uppercase font-bold text-neutral-400">Reference Implementation</span>
                  <pre className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono overflow-x-auto text-cyan-300">
                    {codeSnippet}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Copy Toolbar footer */}
        {!loading && (
          <div className="p-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
            <span className="text-[10px] text-neutral-400">Need this information?</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-white h-7 px-3 text-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy Info
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Render Notebook Snippets List View
  const renderNotebookView = () => {
    return (
      <div className="flex flex-col h-full bg-neutral-900 text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-rose-600/10 rounded">
              <Camera className="h-4 w-4 text-rose-500" />
            </div>
            <span className="font-bold text-sm">ViBe Lens Notebook</span>
          </div>
          <span className="text-xs text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-full font-bold">
            {snapshots.length} Snaps
          </span>
        </div>

        {/* Saved Snapshots List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <div className="w-12 h-12 rounded-full border border-dashed border-neutral-700 flex items-center justify-center text-neutral-500 mb-3 animate-pulse">
                <Camera className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-neutral-300">Your Notebook is Empty</h4>
              <p className="text-xs text-neutral-500 mt-2 max-w-[200px] leading-relaxed">
                Click the Camera button in the media bar while the video is playing to snap slides instantly!
              </p>
            </div>
          ) : (
            snapshots.map((snap) => (
              <Card key={snap.id} className="bg-neutral-950 border-neutral-850 overflow-hidden shadow-md group relative">
                {/* Snapshot Image Preview */}
                <div className="relative h-28 w-full bg-neutral-900 overflow-hidden border-b border-neutral-850">
                  <img
                    src={snap.imageSrc}
                    alt={`Snap at ${formatTime(snap.timestamp)}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80"
                  />
                  <div className="absolute top-2 left-2 bg-black/75 backdrop-blur px-2 py-0.5 rounded text-[10px] font-mono font-bold border border-neutral-800 flex items-center gap-1 text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    {formatTime(snap.timestamp)}
                  </div>
                  
                  {/* Delete snapshot button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSnapshot(snap.id);
                    }}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-rose-950 hover:text-rose-400 text-neutral-400 rounded-full h-6 w-6 border border-neutral-800 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>

                  {/* Play/Seek overlay button */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      onClick={() => onSeek(snap.timestamp)}
                      className="bg-rose-600 hover:bg-rose-500 text-white text-xs h-7 rounded-full px-3 flex items-center gap-1 shadow-lg"
                    >
                      <Play className="h-3 w-3 fill-white" />
                      Seek to Time
                    </Button>
                  </div>
                </div>

                {/* Notebook actions */}
                <CardContent className="p-3 flex items-center justify-between bg-neutral-950">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectForSketch(snap)}
                    className="border-neutral-800 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white text-xs h-8 flex-1 mr-1.5"
                  >
                    <Brush className="h-3.5 w-3.5 mr-1.5 text-rose-500" />
                    Sketch
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onSelectForLens(snap)}
                    className="bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xs h-8 flex-1"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Solve AI
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-950 text-center">
          <p className="text-[10px] text-neutral-500">
            ViBe Lens Notebook matches visual snapshots to timestamp notes.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-[340px] h-full bg-neutral-900 border-l border-neutral-800 flex flex-col text-white z-50 flex-shrink-0 animate-in slide-in-from-right duration-300"
    >
      {activeLensSnapshot ? renderSolverView() : renderNotebookView()}
    </div>
  );
}
