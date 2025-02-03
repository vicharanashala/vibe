from fastapi import APIRouter, Form
from fastapi.responses import JSONResponse
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_experimental.text_splitter import SemanticChunker
from langchain_community.vectorstores import FAISS
from langchain.schema import Document
from typing import Optional
from langchain_google_genai import ChatGoogleGenerativeAI
import faiss
from langchain_community.docstore.in_memory import InMemoryDocstore
import time
import hashlib
import asyncio
import aiofiles
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from dotenv import load_dotenv
import os

app = APIRouter()

# Load environment variables from .env
load_dotenv()

API_KEY = os.getenv("API_KEY")
print("API KEYYYY from rag:", API_KEY)

# --------------------------
# IMPROVED LOCK MECHANISM
# --------------------------

class AsyncLockManager:
    def __init__(self, lock_dir: str):
        self.lock_dir = Path(lock_dir)
        self.lock_file = self.lock_dir / ".lock"
        self.lock = asyncio.Lock()
        self._initialize_lock_dir()
    
    def _initialize_lock_dir(self):
        self.lock_dir.mkdir(parents=True, exist_ok=True)
        if self.lock_file.exists():
            self.lock_file.unlink()
    
    @asynccontextmanager
    async def acquire(self):
        try:
            await self.lock.acquire()
            # Create lock file as a signal
            async with aiofiles.open(self.lock_file, 'w') as f:
                await f.write(str(time.time()))
            yield
        finally:
            if self.lock_file.exists():
                self.lock_file.unlink()
            self.lock.release()
    
    def cleanup(self):
        if self.lock_file.exists():
            self.lock_file.unlink()

# --------------------------
# IMPROVED VECTOR STORE MANAGEMENT
# --------------------------

class VectorStoreManager:
    def __init__(self, base_dir: str, embeddings):
        self.base_dir = Path(base_dir)
        self.embeddings = embeddings
        self.lock_manager = AsyncLockManager(base_dir)
        self.index_name = "index"
        self._initialize_dirs()
    
    def _initialize_dirs(self):
        self.base_dir.mkdir(parents=True, exist_ok=True)
    
    async def load_or_create(self):
        async with self.lock_manager.acquire():
            index_path = self.base_dir / f"{self.index_name}.faiss"
            
            if await aiofiles.os.path.exists(index_path):
                return await asyncio.to_thread(
                    FAISS.load_local,
                    str(self.base_dir),
                    self.embeddings,
                    index_name=self.index_name,
                    allow_dangerous_deserialization=True
                )
            
            return await self._create_new_store()
    
    async def _create_new_store(self):
        sample_embedding = await asyncio.to_thread(self.embeddings.embed_query, "test")
        index = await asyncio.to_thread(faiss.IndexFlatL2, len(sample_embedding))
        
        store = await asyncio.to_thread(
            FAISS,
            embedding_function=self.embeddings,
            index=index,
            docstore=InMemoryDocstore({}),
            index_to_docstore_id={}
        )
        
        await asyncio.to_thread(
            store.save_local,
            str(self.base_dir),
            index_name=self.index_name
        )
        
        return store
    
    async def save_store(self, store):
        async with self.lock_manager.acquire():
            await asyncio.to_thread(
                store.save_local,
                str(self.base_dir),
                index_name=self.index_name
            )

# --------------------------
# QUERY MANAGER
# --------------------------

class QueryManager:
    def __init__(self, vector_store_manager: VectorStoreManager, model: ChatGoogleGenerativeAI):
        self.vector_store_manager = vector_store_manager
        self.model = model
        self.prompt = ChatPromptTemplate.from_template("""
            1. Act as a knowledgeable and approachable teacher who helps students understand their doubts with clarity and patience.
            2. Use the following pieces of context to explain and clarify the student's query thoroughly. If the exact answer is not available in the provided context but aligns with the topic, provide an accurate and well-informed response based on your own knowledge base.
            3. If the question is completely irrelevant to the topic, outside the provided context, or you're unsure of the answer, politely state, "I don't know the answer to that," without making up any information.
            4. Always prioritize accuracy. Break down your explanation into simple, easy-to-follow points and use relatable examples or analogies wherever possible to aid understanding. Aim to leave the student with a clear and solid grasp of the concept or query.
            Context: {context}
            Question: {input}
            Response: """)
    
    async def setup_chain(self, store):
        """Set up the retrieval chain with the current store"""
        retriever = store.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 2}
        )
        document_chain = create_stuff_documents_chain(self.model, self.prompt)
        return create_retrieval_chain(retriever, document_chain)
    
    async def query(self, question: str):
        """Process a query and return the response"""
        start_time = time.time()
        
        try:
            store = await self.vector_store_manager.load_or_create()
            qa_chain = await self.setup_chain(store)
            
            # Process query in thread pool to avoid blocking
            response = await asyncio.to_thread(
                qa_chain.invoke,
                {"input": question}
            )
            
            result = response.get("answer", "No result generated.")
            processing_time = time.time() - start_time
            
            return {
                "response": result,
                "processing_time": f"{processing_time:.2f} seconds"
            }
            
        except Exception as e:
            return {
                "error": str(e),
                "processing_time": f"{time.time() - start_time:.2f} seconds"
            }

# --------------------------
# CONTENT MANAGER
# --------------------------

class ContentManager:
    def __init__(self, vector_store_manager: VectorStoreManager, text_splitter):
        self.vector_store_manager = vector_store_manager
        self.text_splitter = text_splitter
        self.thread_pool = ThreadPoolExecutor()
    
    def get_content_hash(self, text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()
    
    async def upload_content(self, text: str, title: Optional[str] = None):
        main_hash = self.get_content_hash(text)
        docs = [Document(page_content=text, metadata={"source": title, "hash": main_hash})]
        
        try:
            documents = await asyncio.to_thread(self.text_splitter.split_documents, docs)
            store = await self.vector_store_manager.load_or_create()
            
            unique_docs = await self._filter_unique_documents(store, documents, main_hash)
            
            if unique_docs:
                await asyncio.to_thread(store.add_documents, unique_docs)
                await self.vector_store_manager.save_store(store)
                return {"message": f"Added {len(unique_docs)} new sections."}
            
            return {"message": "No new content added."}
            
        except Exception as e:
            return {"error": str(e)}
    
    async def _filter_unique_documents(self, store, documents, main_hash):
        existing_hashes = {
            doc.metadata.get('chunk_hash')
            for doc in store.docstore._dict.values()
        }
        
        unique_docs = []
        for doc in documents:
            chunk_hash = self.get_content_hash(doc.page_content)
            if chunk_hash not in existing_hashes and doc.page_content.strip():
                doc.metadata["chunk_hash"] = chunk_hash
                doc.metadata["main_hash"] = main_hash
                unique_docs.append(doc)
                existing_hashes.add(chunk_hash)
        
        return unique_docs

# --------------------------
# APPLICATION SETUP
# --------------------------

vector_store_manager = None
content_manager = None
query_manager = None

@app.on_event("startup")
async def startup_event():
    global vector_store_manager, content_manager, query_manager
    
    embeddings = HuggingFaceEmbeddings()
    text_splitter = SemanticChunker(embeddings)
    
    model = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=API_KEY
    )
    
    vector_store_manager = VectorStoreManager("faiss_index", embeddings)
    content_manager = ContentManager(vector_store_manager, text_splitter)
    query_manager = QueryManager(vector_store_manager, model)

@app.on_event("shutdown")
async def shutdown_event():
    if vector_store_manager:
        vector_store_manager.lock_manager.cleanup()
    if content_manager and content_manager.thread_pool:
        content_manager.thread_pool.shutdown()

# --------------------------
# API ENDPOINTS
# --------------------------

@app.post("/upload/")
async def upload_text(text: str = Form(...), title: Optional[str] = Form(None)):
    if content_manager is None:
        return JSONResponse({"error": "System not initialized"}, status_code=500)
    return await content_manager.upload_content(text, title)

@app.post("/query/")
async def query_content(question: str = Form(...)):
    if query_manager is None:
        return JSONResponse({"error": "System not initialized"}, status_code=500)
    
    try:
        result = await query_manager.query(question)
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/content-index/")
async def get_content_index():
    """Show list of stored materials without revealing full content"""
    if vector_store_manager is None:
        return JSONResponse({"error": "System not initialized"}, status_code=500)
        
    try:
        store = await vector_store_manager.load_or_create()
        contents = {
            str(doc.metadata.get("chunk_hash", "unknown")): {
                "source": doc.metadata.get("source", "unknown"),
                "length": len(doc.page_content),
                "preview": doc.page_content[:50] + "..."
            }
            for doc in store.docstore._dict.values()
        }
        return contents
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)