from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from openai import OpenAI
import requests
import chromadb
import os
import json
import threading
import time
import numpy as np
import boto3

app = FastAPI()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TRIPS_TABLE = os.getenv("TRIPS_TABLE")

openai_client = OpenAI(api_key=OPENAI_API_KEY)

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
        response = openai_client.responses.create(
            model=OPENAI_MODEL,
            input=prompt,
            text={
                "format": {
                    "type": "json_object"
                }
            },
        )

        return response.output_text

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OpenAI LLM request failed: {str(e)}",
        )

def embed_and_store(req: EmbedRequest) -> None:
    """Generate an embedding for a trip and upsert it into ChromaDB."""
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

def wait_for_ollama(timeout: int = 300) -> bool:
    """Block until the Ollama server is reachable, or give up after timeout."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
            if resp.status_code == 200:
                return True
        except requests.RequestException:
            pass
        time.sleep(5)
    return False

def backfill_from_dynamo() -> None:
    """Rebuild ChromaDB embeddings from DynamoDB.

    Runs on startup when the local Chroma store is empty (e.g. after the EC2
    instance has been replaced), so recommendations keep working without any
    manual intervention.
    """
    if not TRIPS_TABLE:
        print("TRIPS_TABLE not set; skipping startup backfill")
        return

    if not wait_for_ollama():
        print("Ollama not ready; skipping startup backfill")
        return

    table = boto3.resource("dynamodb").Table(TRIPS_TABLE)

    items: List[dict] = []
    resp = table.scan()
    items.extend(resp.get("Items", []))
    while "LastEvaluatedKey" in resp:
        resp = table.scan(ExclusiveStartKey=resp["LastEvaluatedKey"])
        items.extend(resp.get("Items", []))

    embedded = 0
    for item in items:
        try:
            embed_and_store(EmbedRequest(
                tripId=item["TripID"],
                userId=item["UserID"],
                title=item.get("Title", ""),
                location=item.get("Location", ""),
                description=item.get("Description", ""),
                photoTags=[],
            ))
            embedded += 1
        except Exception as e:
            print(f"Failed to embed trip {item.get('TripID')}: {e}")

    print(f"Startup backfill complete: embedded {embedded}/{len(items)} trips")

@app.on_event("startup")
def startup_backfill():
    def run():
        try:
            if collection.count() == 0:
                print("Chroma store empty; starting embedding backfill from DynamoDB")
                backfill_from_dynamo()
        except Exception as e:
            print(f"Startup backfill failed: {e}")

    # Run in the background so the service becomes healthy immediately
    threading.Thread(target=run, daemon=True).start()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/embed")
def embed_trip(req: EmbedRequest):
    embed_and_store(req)

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
        raise HTTPException(
            status_code=500,
            detail="Model did not return valid JSON"
        )
    
    return {
        "status": "ok",
        "similarTrips": recommendations.get("similar", []),
        "differentTrips": recommendations.get("different", []),
    }