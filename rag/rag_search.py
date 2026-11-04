from pathlib import Path
import os
import requests

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")


NOMIC_API_KEY = os.getenv("NOMIC_API_KEY")

PROJECTION_ID = "710fa00b-0cf5-41d1-9a03-b51c031bf223"

SEARCH_URL = "https://api-atlas.nomic.ai/v1/query/topk"


def _search_one(query: str, k: int = 5):
    if not NOMIC_API_KEY:
        raise RuntimeError(
            "Falta NOMIC_API_KEY en rag/.env"
        )

    headers = {
        "Authorization": f"Bearer {NOMIC_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "projection_id": PROJECTION_ID,
        "query": query,
        "k": k,
        "fields": [
            "id",
            "text",
            "source",
            "issue",
            "pages",
            "headings",
        ],
    }

    response = requests.post(
        SEARCH_URL,
        headers=headers,
        json=payload,
        timeout=30,
    )

    response.raise_for_status()

    return response.json().get("data", [])


def rag_search_magazines(
    queries: list[str],
    max_results: int = 4,
):
    unique_results = {}

    for query in queries:
        results = _search_one(query, k=5)

        for row in results:
            chunk_id = row.get("id")

            if not chunk_id:
                continue

            similarity = row.get("_similarity", 0)

            # Si el mismo chunk apareció en varias búsquedas,
            # nos quedamos con su mejor similitud.
            if (
                chunk_id not in unique_results
                or similarity
                > unique_results[chunk_id].get(
                    "_similarity",
                    0,
                )
            ):
                unique_results[chunk_id] = row

    ranked = sorted(
        unique_results.values(),
        key=lambda row: row.get(
            "_similarity",
            0,
        ),
        reverse=True,
    )

    selected = ranked[:max_results]

    output = []

    for row in selected:
        text = row.get("text", "")

        # Evita mandar chunks enormes al LLM.
        if len(text) > 1200:
            text = text[:1200] + "..."

        output.append(
            {
                "id": row.get("id"),
                "issue": row.get("issue"),
                "source": row.get("source"),
                "pages": row.get("pages"),
                "headings": row.get("headings"),
                "text": text,
                "similarity": row.get(
                    "_similarity"
                ),
            }
        )

    return output