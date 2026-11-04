import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

from rag_search import rag_search_magazines

queries = [
    "comida romántica",
]

results = rag_search_magazines(queries)

for i, result in enumerate(results, 1):
    print("=" * 70)
    print(f"RESULTADO {i}")
    print("=" * 70)
    print(f"Revista: {result['issue']}")
    print(f"Páginas: {result['pages']}")
    print(f"Encabezado: {result['headings']}")
    print(f"Similitud: {result['similarity']}")
    print()
    print(result["text"])
    print()