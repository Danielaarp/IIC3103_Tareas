from pathlib import Path
import os
import requests

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

NOMIC_API_KEY = os.getenv("NOMIC_API_KEY")

DATASET_ID = "aff956e9-2b46-4599-9ef4-e173d4db22be"
PROJECTION_ID = "01a1a22c-5d78-7492-f933-6b6e9d53f1f5"

url = (
    f"https://api-atlas.nomic.ai/v1/dataset/"
    f"{DATASET_ID}/index/projection/{PROJECTION_ID}"
)

response = requests.get(
    url,
    headers={
        "Authorization": f"Bearer {NOMIC_API_KEY}",
        "Accept": "application/json",
    },
    timeout=30,
)

print("STATUS:", response.status_code)
print(response.text)