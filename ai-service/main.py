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
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
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

def build_trip_text(req: EmbedRequest) -> str:
    photo_text = ", ".join(req.photoTags or [])
    
    return f"""
        Title: {req.title}
        Location: {req.location}
        Description: {req.description}
        Photo Tags: {photo_text}
    """.strip()

def get_embedding(text: str) -> List[float]:
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/embed",
            json={
                "model": EMBED_MODEL, 
                "input": text,
                },
                timeout=60,
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail=f"Ollama embedding failed: {response.text}"
            )

        data = response.json()

        if "embeddings" not in data or not data["embeddings"]:
            raise HTTPException(
                status_code=500,
                detail="No embedding returned from Ollama"
            )

        return data["embeddings"][0]

    except requests.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Could not connect to Ollama embedding service: {str(e)}"
        )

def call_llm(prompt: str) -> str:
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": LLM_MODEL,
                "prompt": prompt,
                "stream": False,
            },
            timeout=120,
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail=f"Ollama LLM failed: {response.text}"
            )
        
        return response.json().get("response", "")

    except requests.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Could not connect to Ollama LLM service: {str(e)}"
        )

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
