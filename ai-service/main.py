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
LLM_MODEL = os.getenv("LLM_MODEL", "llama3.2")

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
                "options": {
                    "num_predict": 300
                }
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

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/embed")
def embed_trip(req: EmbedRequest):
    trip_text = build_trip_text(req)
    embedding = get_embedding(trip_text)

    collection.upsert(
        ids=[req.tripId],
        embeddings=[embedding],
        documents=[trip_text],
        metadatas=[
            {
                "userId": req.userId,
                "title": req.title,
                "location": req.location,
            }
        ],
    )

    return {
        "status": "ok",
        "message": "Trip embedded successfully",
        "tripId": req.tripId,
    }

@app.post("/recommend")
def recommend(req: RecommendRequest):
    results = collection.get(
        where={"userId": req.userId},
        include=["embeddings", "documents", "metadatas"],
    )

    # if user has no trips yet, don't recommend anything
    if not results["ids"]:
        raise HTTPException(
            status_code=404,
            detail="No trips found for user"
        )

    # get embeddings for user's trips
    embeddings = results.get("embeddings")

    if embeddings is None or len(embeddings) == 0:
        raise HTTPException(status_code=500, detail="No embeddings found for user")

    # calculate average embedding for user's trips
    avg_embedding = np.mean(np.array(embeddings), axis=0).tolist()

    # find similar trips to average embedding
    similar_results = collection.query(
        query_embeddings=[avg_embedding],
        n_results=min(req.numSimilar, len(results["ids"])),
        where={"userId": req.userId},
        include=["documents", "metadatas", "distances"],
    )

    # build readable trip context for LLM
    user_trip_summaries = "\n\n".join(results["documents"])

    prompt = f"""
    You are a travel recommendation assistant for a travel journal app.

    The user has taken these trips:

    {user_trip_summaries}

    Recommend:
    1. {req.numSimilar} destinations that are similar to their travel style.
    2. {req.numDifferent} destinations that are different from their usual trips, but still likely appealing.

    Return ONLY valid JSON in this exact structure:

    {{
    "similar": [
        {{
        "city": "City name",
        "country": "Country name",
        "reason": "Short reason"
        }}
    ],
    "different": [
        {{
        "city": "City name",
        "country": "Country name",
        "reason": "Short reason"
        }}
    ]
    }}
    """.strip()

    llm_response = call_llm(prompt)

    # parse LLM response as JSON, if failure then return raw response with warning
    try:
        recommendations = json.loads(llm_response)
    except json.JSONDecodeError:
        recommendations = {
            "warning": "Model did not return valid JSON",
            "rawResponse": llm_response,
        }
    
    return {
        "status": "ok",
        "basedOnTrips": similar_results,
        "recommendations": recommendations,
    }