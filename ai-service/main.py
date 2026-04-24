from fastapi import FastAPI
from pydantic import BaseModel
import requests
import chromadb

app = FastAPI()

# Initialize ChromaDB
client = chromadb.PersistentClient(path="chroma_db")
collection = client.get_or_create_collection("trips")

class EmbedRequest(BaseModel): # maybe add more fields later
    tripId: str
    userId: str
    text: str

@app.post("/embed")
def embed_trip(req: EmbedRequest):

    try:
        response = requests.post(
            "http://localhost:11434/api/embeddings",
            json={"model": "nomic_embed_text", "prompt": req.text}
        )
        embedding = response.json()["embedding"]
    except Exception as e:
        raise Exception(f"Error embedding trip: {e}")

    collection.add(
        ids=[req.tripId],
        embeddings=[embedding],
        metadatas=[{"userId": req.userId}]
    )
    return {"message": "Trip embedded successfully"}
