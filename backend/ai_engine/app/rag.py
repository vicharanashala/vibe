# Import necessary libraries for building the RAG system

from fastapi import APIRouter, Form
from fastapi.responses import JSONResponse
from langchain_huggingface import HuggingFaceEmbeddings # For converting text to embeddings
from langchain_experimental.text_splitter import SemanticChunker
from langchain_community.vectorstores import FAISS # Vector database for storing embeddings
from langchain.schema import Document
from typing import Optional
from langchain_google_genai import ChatGoogleGenerativeAI
import faiss
from langchain_community.docstore.in_memory import InMemoryDocstore
import os
import json
import time
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain


app = APIRouter()


# Initialize core components

# HuggingFace embeddings will convert text into numerical vectors
embeddings = HuggingFaceEmbeddings()

VECTOR_STORE_PATH = "faiss_index" # Path to store the FAISS index
METADATA_FILE = "metadata.json" # File to store document metadata

# SemanticChunker splits text into meaningful chunks while preserving context
text_splitter = SemanticChunker(embeddings)

# Initialize or load the vector store
if os.path.exists(VECTOR_STORE_PATH):
    # If a FAISS index exists, load it
    vector_store = FAISS.load_local(
        VECTOR_STORE_PATH, embeddings, allow_dangerous_deserialization=True)
else:
    # Create a new FAISS index if none exists
    # First, get the embedding dimension by embedding a test input
    sample_embedding = embeddings.embed_query("test input")
    embedding_dimension = len(sample_embedding)
    # Create an empty FAISS index with L2 (Euclidean) distance metric
    index = faiss.IndexFlatL2(embedding_dimension)
    docstore = InMemoryDocstore({}) # Store for document text
    index_to_docstore_id = {} # Mapping between FAISS indices and document IDs
    vector_store = FAISS(
        index=index,
        embedding_function=embeddings,
        docstore=docstore,
        index_to_docstore_id=index_to_docstore_id,
    )

# Load or initialize metadata storage
if os.path.exists(METADATA_FILE):
    with open(METADATA_FILE, "r") as f:
        metadata = json.load(f)
else:
    metadata = {}

# Initialize Gemini model
model = ChatGoogleGenerativeAI(model="gemini-2.0-flash-exp", google_api_key="YOUR-GEMINI-API-KEY")

# Create prompt template for the model
# This defines how the model should behave and format its responses
prompt = ChatPromptTemplate.from_template("""
1. Act as a knowledgeable and approachable teacher who helps students understand their doubts with clarity and patience.
2. Use the following pieces of context to explain and clarify the student's query thoroughly. If the exact answer is not available in the provided context but aligns with the topic, provide an accurate and well-informed response based on your own knowledge base.
3. If the question is completely irrelevant to the topic, outside the provided context, or you’re unsure of the answer, politely state, "I don’t know the answer to that," without making up any information.
4. Always prioritize accuracy. Break down your explanation into simple, easy-to-follow points and use relatable examples or analogies wherever possible to aid understanding. Aim to leave the student with a clear and solid grasp of the concept or query.
Context: {context}
Question: {input}
Response: """)

# Create the chain that processes documents and generates responses
document_chain = create_stuff_documents_chain(model, prompt)

# Set up the retrieval chain
# Configure to fetch 2 most similar documents for each query
retriever = vector_store.as_retriever(search_type="similarity", search_kwargs={"k": 2})
qa_chain = create_retrieval_chain(retriever, document_chain)


# @app.post("/upload/")
def upload_text(text: str, title: Optional[str] = None):
    """
    Endpoint to upload and process lecture text
    1. Splits text into semantic chunks
    2. Converts chunks to embeddings
    3. Stores in FAISS vector store
    4. Updates metadata
    """
    try:
        # Create document object and split into semantic chunks
        docs = [Document(page_content=text, metadata={"source": title})]
        documents = text_splitter.split_documents(docs)

        # Load existing metadata if it exists
        if os.path.exists(METADATA_FILE):
            with open(METADATA_FILE, "r") as f:
                metadata = json.load(f)
        else:
            metadata = {}

        # Filter out documents that are already in the metadata
        unique_documents = []
        for doc in documents:
            if title not in metadata or {"content": doc.page_content
                                         } not in metadata.get(title, []):
                unique_documents.append(doc)

        # Add unique documents to FAISS vector store
        global vector_store  # Ensure we're modifying the global variable
        if unique_documents:
            vector_store.add_documents(unique_documents)

        # Update metadata with new documents
        if title not in metadata:
            metadata[title] = []
        for doc in unique_documents:
            metadata[title].append({"content": doc.page_content})

        # Save metadata and vector store
        with open(METADATA_FILE, "w") as f:
            json.dump(metadata, f)

        if unique_documents:
            vector_store.save_local(VECTOR_STORE_PATH)

        message = ("Text uploaded and processed successfully."
                   if unique_documents
                   else "No new unique entries were added.")
        return JSONResponse({"message": message})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/query/")
async def query_rag(question: str = Form(...)):
    """
    Endpoint to handle student questions
    1. Takes question as input
    2. Retrieves relevant documents from vector store
    3. Generates response using Gemini model
    """
    try:
        if vector_store is None:
            return JSONResponse({
                "error": "Vector store is not initialized."}, status_code=500)
        start_time = time.time()
        # Use the QA chain to process the question and generate response
        response = qa_chain.invoke({"input": question})
        end_time = time.time()
        print(f"Generation time: {end_time - start_time} seconds")
        result = response.get("answer", "No result generated.")
        return JSONResponse({"response": result})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/metadata/")
async def get_metadata():
    return metadata