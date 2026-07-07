# One container, three places: local Docker, Hugging Face Spaces, Kubernetes (kind).
FROM python:3.12-slim

WORKDIR /code

# Install dependencies first — Docker caches this layer so rebuilds are fast
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Warm the FlashRank reranker model at build so the first chat isn't slow.
RUN python -c "from flashrank import Ranker; Ranker(model_name='ms-marco-MiniLM-L-12-v2')" || true

# Hugging Face Spaces requires the app to listen on port 7860
EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
