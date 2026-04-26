# Footprints

A travel journalling web app where users can document trips with photos, locations, and descriptions, share them publicly, and receive AI-powered destination recommendations based on their travel history.

Live: [https://footprints-delta.vercel.app](https://footprints-delta.vercel.app)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19 |
| Styling | Tailwind CSS 3, DaisyUI (autumn theme) |
| Maps | Leaflet + React-Leaflet |
| Authentication | AWS Cognito + AWS Amplify v6 |
| API | AWS API Gateway (REST) |
| Compute | AWS Lambda (Node.js) |
| Database | AWS DynamoDB (on-demand) |
| File storage | AWS S3 (presigned URLs) |
| AI embedding | Ollama (`nomic-embed-text`) on EC2 |
| Vector database | ChromaDB (local disk on EC2) |
| LLM | OpenAI (`gpt-4o-mini`) |
| AI service | Python FastAPI |
| Infrastructure | AWS CDK v2 (TypeScript) |
| Frontend hosting | Vercel |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Vercel                              │
│   Next.js 15 (App Router)  ◄──── Cognito (auth)            │
└────────────────────────┬────────────────────────────────────┘
                         │  HTTPS
┌────────────────────────▼────────────────────────────────────┐
│                    AWS API Gateway                          │
│       │                                                     │
│       ├── Lambda: addTrip / getTrips / updateTrip / etc.    │
│       │           │                         │               │
│       │        DynamoDB                     S3              │
│       │                                                     │
│       └── Lambda: getRecommendations ──┐                    │
│                                        │ VPC (port 8000)    │
│   ┌────────────────────────────────────▼─────────────┐      │
│   │  EC2 t3.large (private subnet)                   │      │
│   │  FastAPI (ai-service)                            │      │
│   │   POST /embed  ──► Ollama ──► ChromaDB           │      │
│   │   POST /recommend ──► ChromaDB ──► OpenAI        │      │
│   └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

The core CRUD API runs on Lambda, while the AI workload runs on a single EC2 instance inside a private VPC subnet. Only Lambdas with a dedicated security group can reach port 8000 on the EC2 instance — it has no public exposure. A Route 53 private hosted zone (`footprints.internal`) resolves `ai.footprints.internal` to the instance's private IP so Lambdas call it by name.

---

## Features

**Trip journalling** — Create entries with a title, location, date range, written description, pinned map locations (via Leaflet), and photos. Trips can be public or private.

**Photo uploads** — Images never pass through Lambda. The frontend requests presigned S3 PUT URLs, uploads directly to S3, and reads images back via presigned GET URLs. HEIC/HEIF files (common from iPhones) are converted to JPEG in the browser before upload using `heic2any`.

**Browse** — Public trips are visible to anyone without an account.

**AI recommendations** — When a trip is created, `addTrip` fires a best-effort embed to the AI service. Ollama generates a vector embedding of the trip text (`nomic-embed-text`) and stores it in ChromaDB. On demand, the recommendation endpoint computes the mean of a user's stored embeddings, queries ChromaDB for similar context, then sends the user's trip summaries to OpenAI to generate five destination suggestions — three similar to their travel style and two deliberately different.

---

## Environment Variables

### Frontend (`travel-app/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | API Gateway base URL |
| `NEXT_PUBLIC_USER_POOL_ID` | Cognito User Pool ID |
| `NEXT_PUBLIC_USER_POOL_CLIENT_ID` | Cognito App Client ID |

### AI service (EC2)

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | Required for recommendations |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model for recommendation generation |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `EMBED_MODEL` | `nomic-embed-text` | Ollama embedding model |
