from pathlib import Path
import os
import requests

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

NOMIC_API_KEY = os.getenv("NOMIC_API_KEY")

PROJECTION_ID = "710fa00b-0cf5-41d1-9a03-b51c031bf223"

SEARCH_URL = "https://api-atlas.nomic.ai/v1/query/topk"


def search_nomic(query: str, k: int = 5):
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

    if not response.ok:
        print("\nERROR DE ATLAS")
        print("Status:", response.status_code)
        print("Respuesta:")
        print(response.text)
        response.raise_for_status()

    return response.json()


def main():
    query = input(
        "Escribe una consulta para buscar en las revistas: "
    ).strip()

    if not query:
        print("La consulta no puede estar vacía.")
        return

    print(f"\nBuscando: {query}\n")

    results = search_nomic(query, k=5)

    rows = results.get("data", [])

    if not rows:
        print("No se encontraron resultados.")
        return

    for i, row in enumerate(rows, start=1):
        print("=" * 70)
        print(f"RESULTADO {i}")
        print("=" * 70)

        print(f"ID: {row.get('id')}")
        print(f"Revista: {row.get('issue')}")
        print(f"Fuente: {row.get('source')}")
        print(f"Páginas: {row.get('pages')}")
        print(f"Encabezados: {row.get('headings')}")
        print(f"Similitud: {row.get('_similarity')}")

        print("\nTexto:")
        print(row.get("text", ""))

        print()


if __name__ == "__main__":
    main()