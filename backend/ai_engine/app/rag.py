# Import tools needed to build the educational assistant system
from fastapi import APIRouter, Form  # Tools for creating web endpoints
from fastapi.responses import JSONResponse  # For sending JSON responses
from langchain_huggingface import HuggingFaceEmbeddings  # Text-to-number converter
from langchain_experimental.text_splitter import SemanticChunker  # Smart text splitter
from langchain_community.vectorstores import FAISS  # Database for number patterns
from langchain.schema import Document  # Standard format for text content
from typing import Optional  # For handling optional parameters
from langchain_google_genai import ChatGoogleGenerativeAI  # AI brain for answering
import faiss  # Number pattern search library
from langchain_community.docstore.in_memory import InMemoryDocstore  # Text storage
import os  # File system operations
import time  # Time tracking
import hashlib  # Creates unique fingerprints for text
from filelock import FileLock  # Prevents simultaneous file access
from langchain_core.prompts import ChatPromptTemplate  # Answering instructions
from langchain.chains import create_retrieval_chain  # Question-answer workflow
from langchain.chains.combine_documents import create_stuff_documents_chain  # Doc handling
import tempfile  # Safe temporary file operations

# Create a router to handle different website endpoints
app = APIRouter()

# --------------------------
# SETUP CORE COMPONENTS
# --------------------------

# Initialize text-to-number converter (like translator for AI)
embeddings = HuggingFaceEmbeddings()

# Where we'll store/search all the number patterns
VECTOR_STORE_DIR = "faiss_index"  # Changed to directory name
LOCK_FILE = os.path.join(VECTOR_STORE_DIR, ".lock")  # Separate lock file
INDEX_NAME = "index"  # FAISS index files base name

# Create directory if it doesn't exist
os.makedirs(VECTOR_STORE_DIR, exist_ok=True)

file_lock = FileLock(LOCK_FILE, timeout=60)

# Smart text splitter that keeps related ideas together
text_splitter = SemanticChunker(embeddings)

def load_vector_store():
    """Load or create the knowledge database with safety locks"""
    with file_lock:
        index_path = os.path.join(VECTOR_STORE_DIR, f"{INDEX_NAME}.faiss")
        
        # Check for actual index file existence
        if os.path.exists(index_path):
            return FAISS.load_local(
                VECTOR_STORE_DIR,
                embeddings,
                index_name=INDEX_NAME,
                allow_dangerous_deserialization=True
            )
        
        # Create and save new index if doesn't exist
        sample_embedding = embeddings.embed_query("test")
        index = faiss.IndexFlatL2(len(sample_embedding))
        new_store = FAISS(
            embedding_function=embeddings,
            index=index,
            docstore=InMemoryDocstore({}),
            index_to_docstore_id={}
        )
        # Save the empty index immediately
        new_store.save_local(VECTOR_STORE_DIR, index_name=INDEX_NAME)
        return new_store


# Initialize our main knowledge base with safety checks
vector_store = load_vector_store()

# Set up the AI teacher's brain (Gemini model)
model = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key="AIzaSyADJ_vp1XilyMX_yFrRfs9ipi9G93IVWUo")

# Teaching instructions for the AI:
# 1. Be helpful and clear
# 2. Use provided materials when possible
# 3. Admit when unsure
# 4. Focus on understanding
prompt = ChatPromptTemplate.from_template("""
1. Act as a knowledgeable and approachable teacher who helps students understand their doubts with clarity and patience.
2. Use the following pieces of context to explain and clarify the student's query thoroughly. If the exact answer is not available in the provided context but aligns with the topic, provide an accurate and well-informed response based on your own knowledge base.
3. If the question is completely irrelevant to the topic, outside the provided context, or you’re unsure of the answer, politely state, "I don’t know the answer to that," without making up any information.
4. Always prioritize accuracy. Break down your explanation into simple, easy-to-follow points and use relatable examples or analogies wherever possible to aid understanding. Aim to leave the student with a clear and solid grasp of the concept or query.
Context: {context}
Question: {input}
Response: """)

# Create processing pipeline for questions
document_chain = create_stuff_documents_chain(model, prompt)
retriever = vector_store.as_retriever(search_type="similarity", search_kwargs={"k": 2})
qa_chain = create_retrieval_chain(retriever, document_chain)

def get_content_hash(text: str) -> str:
    """Create unique fingerprint for text content"""
    return hashlib.sha256(text.encode()).hexdigest()

# --------------------------
# UPLOAD NEW MATERIALS
# --------------------------

#@app.post("/upload/")
def upload_text(text: str, title: Optional[str] = None):
    """
    Add new teaching materials to the system:
    1. Break text into logical sections
    2. Create unique IDs for each section
    3. Only add new, unseen content
    4. Update knowledge base safely
    """
    try:
        # Create unique ID for the entire text
        main_hash = get_content_hash(text)
        # Prepare document with title and ID
        docs = [Document(page_content=text, metadata={"source": title, "hash": main_hash})]
        
        # Split text into meaningful chunks
        documents = text_splitter.split_documents(docs)

        # Prevent conflicts with other users
        with file_lock:
            print("Lock acquired for upload")
            # Load current knowledge base
            current_store = load_vector_store()
            
            # Check existing content fingerprints
            existing_main_hashes = set()
            existing_chunk_hashes = set()
            for doc in current_store.docstore._dict.values():
                if 'main_hash' in doc.metadata:
                    existing_main_hashes.add(doc.metadata['main_hash'])
                if 'chunk_hash' in doc.metadata:
                    existing_chunk_hashes.add(doc.metadata['chunk_hash'])
            if main_hash in existing_main_hashes:
                return JSONResponse({"message": "This exact content already exists in the system"})
            

            # Filter out duplicates
            unique_docs = []
            for doc in documents:
                # Create chunk-specific ID
                chunk_hash = get_content_hash(doc.page_content)
                doc.metadata["chunk_hash"] = chunk_hash
                # Only keep new content
                if chunk_hash not in existing_chunk_hashes:
                    unique_docs.append(doc)
                    existing_chunk_hashes.add(chunk_hash)

            # Add new content if any exists
            if unique_docs:
                unique_docs = [doc for doc in unique_docs if doc.page_content.strip()]
                current_store.add_documents(unique_docs)
                
                # Safe save process (like writing to draft first)
                with tempfile.TemporaryDirectory() as tmp_dir:
                    current_store.save_local(tmp_dir)
                    # Replace old files atomically
                    for fname in os.listdir(tmp_dir):
                        src = os.path.join(tmp_dir, fname)
                        dst = os.path.join(VECTOR_STORE_DIR, fname)
                        os.replace(src, dst)
                
                # Refresh global knowledge base
                global vector_store
                vector_store = load_vector_store()

        # Prepare user feedback
        message = ("Text processed successfully. Added"
                f" {len(unique_docs)} new sections." if unique_docs 
                else "No new content added.")
        print("UPLOAD FUNTION FROM RAG HEREEEEE: ", message)
        return JSONResponse({"message": message})
    
    except TimeoutError:
        print("UPLOAD FUNTION FROM RAG HEREEEEE THIS IS TIMEOUTERROR")
        return JSONResponse({"error": "System busy, try again later"}, status_code=429)
    except Exception as e:
        print(f"UPLOAD FUNTION FROM RAG HEREEEEE: {str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)

# --------------------------
# HANDLE STUDENT QUESTIONS
# --------------------------

@app.post("/query/")
async def query_rag(question: str = Form(...)):
    """
    Answer student questions by:
    1. Finding relevant information in knowledge base
    2. Generating clear explanations using AI
    3. Timing response speed
    """
    try:
        start_time = time.time()
        # Always use fresh knowledge base copy
        current_store = load_vector_store()
        retriever = current_store.as_retriever(search_type="similarity", search_kwargs={"k": 2})
        qa_chain = create_retrieval_chain(retriever, document_chain)
        
        # Process question through AI teacher
        response = qa_chain.invoke({"input": question})
        result = response.get("answer", "No result generated.")
        
        # Return answer with performance metrics
        return JSONResponse({
            "response": result,
            "processing_time": f"{time.time() - start_time:.2f} seconds"
        })
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# --------------------------
# VIEW STORED CONTENT
# --------------------------

@app.get("/content-index/")
async def get_content_index():
    """Show list of stored materials without revealing full content"""
    try:
        # Safe access to content list
        with file_lock:
            current_store = load_vector_store()
            return {
                # Show content previews and metadata
                str(doc.metadata.get("chunk_hash", "unknown")): {
                    "source": doc.metadata.get("source", "unknown"),
                    "length": len(doc.page_content),
                    "preview": doc.page_content[:50] + "..."
                }
                for doc in current_store.docstore._dict.values()
            }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)