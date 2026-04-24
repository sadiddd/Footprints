from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
import requests
import chromadb
import os
import json
import numpy as np

app = FastAPI()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic_embed_text")
LLM_MODEL = os.getenv("LLM_MODEL", "mistral")

client = chromadb.PersistentClient(path="./chroma_data")
collection = client.get_or_create_collection("trips")

class EmbedRequest(BaseModel):
    tripId: str
    userId: str
    title: str
    location: str
    description: str
    photoTags: Optional[List[str]] = Field(default_factory=list) 

class RecommendRequest(BaseModel):
    userId: str
    numSimilar: int = 3
    numDifferent: int = 2

@app.post("/embed")
def embed_trip(req: EmbedRequest):

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/embeddings",
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
