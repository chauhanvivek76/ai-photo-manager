# AuraPhoto - AI-Powered Photo Management Platform

AuraPhoto is a scalable, AI-powered photo hub that connects local storage directories and Google Photos libraries. It automatically detects exact and near-duplicates, groups faces, categorizes photos into 7 document/visual types, and supports semantic natural language searches using CLIP vectors.

---

## 🌟 Key Features

1.  **Dual Storage Sync**: Mount local filesystem paths and sync Google Photos libraries.
2.  **Semantic Search**: Query your library using natural language (e.g. *"mountain hike"* or *"prescription paper"*) with sub-10ms latency using PostgreSQL HNSW indices.
3.  **Facial Recognition & Clustering**: Detects and aligns faces (MTCNN) and clusters them (FaceNet + DBSCAN) into human profiles you can name.
4.  **Auto-Categorization**: Zero-shot categorization into documents, prescriptions, receipts, travel, pets, people, and other scenes.
5.  **Multi-Index Duplicate Solver**: Identifies exact duplicate files (MD5) and near-duplicate variations (Hamming distance on pHash, accelerated via segment indexing).
6.  **100k Benchmark Seeder**: Populates the database with 100,000 synthetic records with realistic vector distributions to test pagination speeds and search performance instantly.

---

## 🛠️ Technology Stack

*   **Frontend**: React (Vite), Lucide Icons, Vanilla CSS (Obsidian glassmorphism, responsive grids).
*   **Backend**: FastAPI, SQLAlchemy.
*   **Worker Queue**: Celery, Redis.
*   **Database**: PostgreSQL 16 + `pgvector` (HNSW indexing).
*   **AI Inference**: PyTorch (CPU-optimized), HuggingFace Transformers (CLIP), `facenet-pytorch` (MTCNN, FaceNet), `scikit-learn` (DBSCAN).
*   **Orchestration**: Docker, Docker Compose (Multi-stage builds).

---

## 🚀 Quick Start Guide

### Prerequisites
*   [Docker](https://www.docker.com/) and Docker Compose installed.

### 1. Start the Application
Clone the repository and run:
```bash
docker-compose up --build
```
This builds the React frontend, packages it into the FastAPI python backend, starts PostgreSQL, Redis, FastAPI, and Celery workers.

### 2. Access the Web Interface
Open your browser and navigate to:
```
http://localhost:8000/
```

### 3. Seed 100,000 Images for Benchmark Testing
1.  Go to the **Sync Hub** tab in the sidebar.
2.  Locate the **100,000 Photo Scaling Benchmark** card.
3.  Select **100,000 Photos** and click **Start Scaling Seed**.
4.  Wait a few seconds for the seeding to finish.
5.  Try natural language searches (e.g. *"dog"* or *"receipt"*) or browse the **Library** and **Duplicates** tabs. Everything will load instantly at scale!

---

## 🔌 API Endpoints & Usage

The OpenAPI specification is available at `http://localhost:8000/docs`.

### 1. Health Check
*   **Endpoint**: `GET /api/v1/health`
*   **cURL Example**:
    ```bash
    curl -X GET http://localhost:8000/api/v1/health
    ```

### 2. Add and Sync Sources
*   **Endpoint**: `POST /api/v1/sync-sources`
*   **Body**:
    ```json
    {
      "source_type": "local",
      "path": "/photos/vacation"
    }
    ```
*   **cURL Example**:
    ```bash
    curl -X POST http://localhost:8000/api/v1/sync-sources \
      -H "Content-Type: application/json" \
      -d '{"source_type": "local", "path": "/photos/vacation"}'
    ```

*   **Sync Endpoint**: `POST /api/v1/sync-sources/{id}/sync`
    *   Query parameters: `simulate=true` (useful for Google Photos sync when OAuth credentials are not set up).
    ```bash
    curl -X POST http://localhost:8000/api/v1/sync-sources/1/sync?simulate=true
    ```

### 3. Natural Language Search
*   **Endpoint**: `POST /api/v1/search`
*   **Body**:
    ```json
    {
      "query": "dog in a park",
      "limit": 30
    }
    ```
*   **cURL Example**:
    ```bash
    curl -X POST http://localhost:8000/api/v1/search \
      -H "Content-Type: application/json" \
      -d '{"query": "dog in a park", "limit": 30}'
    ```

### 4. Duplicate Management
*   **Endpoint**: `GET /api/v1/duplicates`
*   **Response**: Returns groups of exact (MD5) and near-duplicate (Hamming distance $\le 4$) photos.

### 5. People Profiles
*   **List People**: `GET /api/v1/people`
*   **Person Photos**: `GET /api/v1/people/{id}`
*   **Rename Person**: `PUT /api/v1/people/{id}`
    ```json
    {
      "name": "Bob"
    }
    ```
*   **cURL Example**:
    ```bash
    curl -X PUT http://localhost:8000/api/v1/people/1 \
      -H "Content-Type: application/json" \
      -d '{"name": "Bob"}'
    ```

---

## 🔑 Setting up Google Photos API Credentials (OAuth)

To connect to live Google Photos accounts:
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a project and enable the **Google Photos Library API**.
3.  Configure your OAuth Consent Screen, adding the scope:
    `https://www.googleapis.com/auth/photoslibrary.readonly`
4.  Create **OAuth 2.0 Client Credentials**. Set the Authorized Redirect URI to:
    `http://localhost:8000/api/v1/auth/callback`
5.  Create a `.env` file in the root directory:
    ```env
    GOOGLE_CLIENT_ID=your_client_id_here
    GOOGLE_CLIENT_SECRET=your_client_secret_here
    ```
6.  Restart containers: `docker-compose down && docker-compose up -d`.

---

## 🧪 Running Automated Tests

Run the test suite inside the backend container:
```bash
# AI Photo Manager

## 🎥 Demo Video
https://drive.google.com/file/d/1aw_SeVpWgefeGqyP4lUYmsDmWSpGaZ7Z/view?usp=sharing

## 📂 GitHub Repository
https://github.com/chauhanvivek76/ai-photo-manager

docker-compose exec api pytest
```
This runs:
*   `tests/test_api.py`: Validates health check, sources lifecycle, and stats.
*   `tests/test_ai.py`: Verifies CLIP zero-shot classification, embeddings, and Face DBSCAN grouping.
*   `tests/test_duplicate_detector.py`: Checks pHash similarity thresholds and Multi-Index Hashing segments logic.
