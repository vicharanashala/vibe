from fastapi import APIRouter, Form
from fastapi.responses import JSONResponse
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_experimental.text_splitter import SemanticChunker
from langchain_community.vectorstores import FAISS
from langchain.llms.base import BaseLLM
from langchain.schema import Generation, LLMResult, Document
from langchain.chains import RetrievalQA
from langchain.chains.llm import LLMChain
from langchain.chains.combine_documents.stuff import StuffDocumentsChain
from langchain.prompts import PromptTemplate
from typing import List, Optional, Any
import google.generativeai as genai
import faiss
from langchain_community.docstore.in_memory import InMemoryDocstore
import os
import json
import time

app = APIRouter()

# Initialize components
embeddings = HuggingFaceEmbeddings()
VECTOR_STORE_PATH = "faiss_index"
METADATA_FILE = "metadata.json"
text_splitter = SemanticChunker(embeddings)

if os.path.exists(VECTOR_STORE_PATH):
    vector_store = FAISS.load_local(
        VECTOR_STORE_PATH, embeddings, allow_dangerous_deserialization=True)
else:
    # Create an empty FAISS index
    sample_embedding = embeddings.embed_query("test input")
    embedding_dimension = len(sample_embedding)
    index = faiss.IndexFlatL2(embedding_dimension)
    docstore = InMemoryDocstore({})
    index_to_docstore_id = {}
    vector_store = FAISS(
        index=index,
        embedding_function=embeddings,
        docstore=docstore,
        index_to_docstore_id=index_to_docstore_id,
    )

# Load or create FAISS index
# sample_embedding = embedding_model.embed_query("test input")
# embedding_dimension = len(sample_embedding)
# index = faiss.IndexFlatL2(embedding_dimension)
# Load or create FAISS index
# if os.path.exists(VECTOR_STORE_PATH):
#     vector_store = FAISS.load_local(VECTOR_STORE_PATH)
# else:
#     # Create an empty FAISS index
#     index = faiss.IndexFlatL2(embedding_dimension)
#     vector_store = FAISS(index)

# docstore = InMemoryDocstore({})
# index_to_docstore_id = {}

# # Initialize FAISS vector store
# vector_store = FAISS(
#     index=index,
#     embedding_function = embedding_model,
#     docstore=docstore,
#     index_to_docstore_id=index_to_docstore_id,
# )

# Load or initialize metadata
if os.path.exists(METADATA_FILE):
    with open(METADATA_FILE, "r") as f:
        metadata = json.load(f)
else:
    metadata = {}


genai.configure(api_key="AIzaSyDJUVte4fFDDqL7d5l1L7JGpgdS9U_n7sE")
model = genai.GenerativeModel("gemini-1.5-flash")


# Define the GenAIWrapper
class GenAIWrapper(BaseLLM):
    model: Any  # Do not use Field(...) here

    def __init__(self, model: Any, **kwargs):
        """Initialize the wrapper with the underlying GenAI model."""
        super().__init__(**kwargs)
        self.model = model

    def _call(self, prompt: str, stop: Optional[List[str]] = None) -> str:
        """Simplified single-shot call method."""
        response = self.model.generate_text(prompt)
        return response.text  # Ensure this returns the text output

    def _generate(
        self,
        prompts: List[str],
        stop: Optional[List[str]] = None,
        **kwargs: Any
    ) -> LLMResult:
        generations = []
        for prompt in prompts:
            response = self.model.generate_content(prompt)
            generations.append(Generation(text=response.text))

        # Wrap results in LangChain's LLMResult object
        return LLMResult(generations=[generations])

    @property
    def _llm_type(self) -> str:
        return "genai"


wrapped_model = GenAIWrapper(model=model)

# Create prompts and chains
prompt = """
1. Act as a knowledgeable and approachable teacher who helps students understand their doubts with clarity and patience.
2. Use the following pieces of context to explain and clarify the student's query thoroughly. If the exact answer is not available in the provided context but aligns with the topic, provide an accurate and well-informed response based on your own knowledge base.
3. If the question is completely irrelevant to the topic, outside the provided context, or you’re unsure of the answer, politely state, "I don’t know the answer to that," without making up any information.
4. Always prioritize accuracy. Break down your explanation into simple, easy-to-follow points and use relatable examples or analogies wherever possible to aid understanding. Aim to leave the student with a clear and solid grasp of the concept or query.
Context: {context}
Question: {question}
Response: """

QA_CHAIN_PROMPT = PromptTemplate.from_template(prompt)
llm_chain = LLMChain(llm=wrapped_model, prompt=QA_CHAIN_PROMPT, verbose=True)

document_prompt = PromptTemplate(
    input_variables=["page_content", "source"],
    template="Context:\ncontent:{page_content}\nsource:{source}",
)
combine_documents_chain = StuffDocumentsChain(
    llm_chain=llm_chain,
    document_variable_name="context",
    document_prompt=document_prompt,
)

qa_chain = RetrievalQA(
    combine_documents_chain=combine_documents_chain,
    retriever=vector_store.as_retriever(
        search_type="similarity", search_kwargs={"k": 2}),
    return_source_documents=False,
    verbose=True,
)


# Endpoint for uploading PDF files
@app.post("/upload/")
def upload_text(text: str, title: Optional[str] = None):
    try:
        # Split the input text into chunks
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
        if vector_store is None and unique_documents:
            vector_store = FAISS.from_documents(unique_documents, embeddings)
        elif unique_documents:
            vector_store.add_documents(unique_documents)

        # Update metadata with unique entries
        if title not in metadata:
            metadata[title] = []

        for doc in unique_documents:
            metadata[title].append({"content": doc.page_content})

        with open(METADATA_FILE, "w") as f:
            json.dump(metadata, f)

        # Save FAISS index
        if unique_documents:
            vector_store.save_local(VECTOR_STORE_PATH)

        message = ("Text uploaded and processed successfully."
                   if unique_documents
                   else "No new unique entries were added.")
        return JSONResponse({"message": message})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# Endpoint for querying the system
@app.post("/query/")
async def query_rag(question: str = Form(...)):
    try:
        # Retrieve the documents relevant to the question from FAISS VS
        if vector_store is None:
            return JSONResponse({
                "error": "Vector store is not initialized."}, status_code=500)
        start_time = time.time()
        # Run the QA chain with the prompt
        output = qa_chain({"query": question})
        end_time = time.time()
        print(f"Generation time: {end_time - start_time} seconds")
        # Extract the result and source documents
        result = output.get("result", "No result generated.")
        # source_documents = output.get("source_documents", [])

        # if not source_documents:
        #     return JSONResponse({
        #         "response": "No relevant information found for your query.",
        #         "sources": []
        #     })
        return JSONResponse({"response": result})  # , "sources": sources
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# Endpoint to check metadata
@app.get("/metadata/")
async def get_metadata():
    return metadata
