from pathlib import Path
import json
import os

from dotenv import load_dotenv
from nomic import AtlasDataset, login


BASE_DIR = Path(__file__).resolve().parent.parent
PARSED_DIR = BASE_DIR / "parsed"

load_dotenv(BASE_DIR / ".env")


NOMIC_API_KEY = os.getenv("NOMIC_API_KEY")
NOMIC_DATASET = os.getenv(
    "NOMIC_DATASET",
    "integratrip-magazines",
)

EMBEDDING_MODEL = "gte-multilingual-base"
BATCH_SIZE = 500


def load_records():
    records = []

    jsonl_files = sorted(PARSED_DIR.glob("*.jsonl"))

    if not jsonl_files:
        raise RuntimeError(
            f"No se encontraron archivos .jsonl en {PARSED_DIR}"
        )

    print(f"Archivos encontrados: {len(jsonl_files)}")

    for jsonl_path in jsonl_files:
        print(f"Leyendo: {jsonl_path.name}")

        with jsonl_path.open("r", encoding="utf-8") as f:
            for line_number, line in enumerate(f, start=1):
                line = line.strip()

                if not line:
                    continue

                try:
                    record = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise RuntimeError(
                        f"JSON inválido en {jsonl_path.name}, "
                        f"línea {line_number}"
                    ) from exc

                required = {
                    "id",
                    "text",
                    "source",
                    "issue",
                    "headings",
                    "pages",
                }

                missing = required - record.keys()

                if missing:
                    raise RuntimeError(
                        f"{jsonl_path.name}, línea {line_number}: "
                        f"faltan campos {sorted(missing)}"
                    )

                # Nomic Atlas no acepta columnas de tipo lista.
                # Convertimos headings y pages a texto.
                if isinstance(record["headings"], list):
                    record["headings"] = " > ".join(
                        str(x) for x in record["headings"]
                    )

                if isinstance(record["pages"], list):
                    record["pages"] = ", ".join(
                        str(x) for x in record["pages"]
                    )

                records.append(record)

    return records


def main():
    if not NOMIC_API_KEY:
        raise RuntimeError(
            "Falta NOMIC_API_KEY en rag/.env"
        )

    # Autenticación con Nomic
    login(NOMIC_API_KEY)

    rows = load_records()

    print(f"\nTotal de chunks: {len(rows)}")
    print(f"Dataset: {NOMIC_DATASET}")

    dataset = AtlasDataset(
        NOMIC_DATASET,
        unique_id_field="id",
    )

    for start in range(0, len(rows), BATCH_SIZE):
        batch = rows[start:start + BATCH_SIZE]

        dataset.add_data(batch)

        print(
            f"Subidos {start + len(batch)}/{len(rows)} chunks"
        )

    print("\nCreando índice...")

    dataset.create_index(
        indexed_field="text",
        embedding_model=EMBEDDING_MODEL,
    )

    print("\nDataset creado correctamente.")
    print(f"Identifier: {dataset.identifier}")
    print(f"ID: {dataset.id}")
    print(f"Total puntos: {dataset.total_datums}")


if __name__ == "__main__":
    main()