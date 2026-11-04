from pathlib import Path
import json

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.transforms.chunker.hybrid_chunker import HybridChunker
from transformers import AutoTokenizer


BASE_DIR = Path(__file__).resolve().parent.parent
MAGAZINES_DIR = BASE_DIR / "magazines"
PARSED_DIR = BASE_DIR / "parsed"

PARSED_DIR.mkdir(exist_ok=True)

TOKENIZER_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_MODEL)


# PDF con capa de texto: NO usar OCR
pipeline_options = PdfPipelineOptions()
pipeline_options.do_ocr = False

converter = DocumentConverter(
    format_options={
        InputFormat.PDF: PdfFormatOption(
            pipeline_options=pipeline_options
        )
    }
)


chunker = HybridChunker(
    tokenizer=tokenizer,
    max_tokens=500,
)


def parse_magazine(pdf_path: Path):
    print(f"Procesando: {pdf_path.name}")

    result = converter.convert(pdf_path)
    document = result.document

    chunks = chunker.chunk(document)

    output_path = PARSED_DIR / f"{pdf_path.stem}.jsonl"

    with output_path.open("w", encoding="utf-8") as f:
        for index, chunk in enumerate(chunks):

            pages = sorted(
                {
                    prov.page_no
                    for item in chunk.meta.doc_items
                    for prov in item.prov
                }
            )

            headings = list(chunk.meta.headings or [])

            record = {
                "id": f"{pdf_path.stem}-{index:04d}",
                "text": chunker.contextualize(chunk),
                "source": pdf_path.name,
                "issue": int(pdf_path.stem.replace("traveling", "")),
                "headings": headings,
                "pages": pages,
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"Generado: {output_path}")

def main():
    pdf_files = list(MAGAZINES_DIR.glob("*.pdf"))

    if not pdf_files:
        print("No se encontraron revistas PDF.")
        return

    for pdf in pdf_files:
        parse_magazine(pdf)


if __name__ == "__main__":
    main()