const NOMIC_API_KEY = process.env.NOMIC_API_KEY;

const PROJECTION_ID =
  "710fa00b-0cf5-41d1-9a03-b51c031bf223";

const SEARCH_URL =
  "https://api-atlas.nomic.ai/v1/query/topk";

interface AtlasRow {
  id?: string;
  text?: string;
  source?: string;
  issue?: number;
  pages?: string;
  headings?: string;
  _similarity?: number;
}

export interface MagazineResult {
  id: string;
  issue: number | null;
  source: string;
  pages: string;
  headings: string;
  text: string;
  similarity: number;
}


async function searchOne(
  query: string,
  k = 5,
): Promise<AtlasRow[]> {
  if (!NOMIC_API_KEY) {
    throw new Error("Falta NOMIC_API_KEY");
  }

  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOMIC_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projection_id: PROJECTION_ID,
      query,
      k,
      fields: [
        "id",
        "text",
        "source",
        "issue",
        "pages",
        "headings",
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Nomic respondió ${response.status}: ${body}`,
    );
  }

  const data = (await response.json()) as {
    data?: AtlasRow[];
  };

  return data.data ?? [];
}
export async function ragSearchMagazines(
  queries: string[],
): Promise<MagazineResult[]> {
  const unique = new Map<string, AtlasRow>();

  for (const query of queries) {
    const rows = await searchOne(query, 5);

    for (const row of rows) {
      if (!row.id) continue;

      const heading = (row.headings ?? "")
        .trim()
        .toLowerCase();

      const text = (row.text ?? "")
        .trim();

      // Filtra publicidad explícita
      if (heading === "publicidad") {
        continue;
      }

      // Filtra chunks demasiado cortos o poco informativos
      if (text.length < 80) {
        continue;
      }

      const previous = unique.get(row.id);

      if (
        !previous ||
        (row._similarity ?? 0) >
          (previous._similarity ?? 0)
      ) {
        unique.set(row.id, row);
      }
    }
  }

  return [...unique.values()]
    .sort(
      (a, b) =>
        (b._similarity ?? 0) -
        (a._similarity ?? 0),
    )
    .slice(0, 4)
    .map((row) => ({
      id: row.id ?? "",
      issue: row.issue ?? null,
      source: row.source ?? "",
      pages: row.pages ?? "",
      headings: row.headings ?? "",
      text:
        (row.text ?? "").length > 1200
          ? `${row.text!.slice(0, 1200)}...`
          : (row.text ?? ""),
      similarity: row._similarity ?? 0,
    }));
}