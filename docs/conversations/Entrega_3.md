# IntegraTrip: Tarea 3: RAG con Traveling Magazine



## Descripción

En esta tarea se incorporó un sistema de **Retrieval-Augmented Generation (RAG)** al asistente de viajes de IntegraTrip.

La solución implementada procesa revistas Traveling Magazine en PDF, genera fragmentos con metadatos, los indexa en Nomic Atlas con `gte-multilingual-base` e integra una herramienta local llamada `rag_search_magazines` al loop del agente.

## Revistas utilizadas

Se utilizaron 10 ediciones:

- `traveling55.pdf`
- `traveling65.pdf`
- `traveling69.pdf`
- `traveling71.pdf`
- `traveling72.pdf`
- `traveling74.pdf`
- `traveling75.pdf`
- `traveling76.pdf`
- `traveling77.pdf`
- `traveling78.pdf`

Después del procesamiento se obtuvieron **2317 chunks**.

## Estructura relacionda a rag

```text
IIC3103_Tareas/
├── README.md
├── backend/
│   └── src/
│       ├── agent/
│       │   ├── runAgent.ts
│       │   ├── catalog.ts
│       │   └── executeTool.ts
│       └── rag/
│           └── searchMagazines.ts
└── rag/
    ├── parsed/
    ├── scripts/
    └── rag_search.py
```



## Procesamiento de las revistas

Cada chunk contiene:

```json
{
  "id": "traveling77-0035",
  "text": "...",
  "source": "traveling77.pdf",
  "issue": 77,
  "headings": "Playa Naranjo, la pausa del viaje",
  "pages": "11, 12"
}
```

Los metadatos permiten citar revista y páginas en la respuesta final.

## Nomic Atlas

Los chunks se cargaron en Nomic Atlas y se creó un índice  sobre el campo `text`.

Modelo utilizado:

```text
gte-multilingual-base
```

Dataset:

```text
danielaarp/integratrip-magazines
```


## Búsqueda semántica

La lógica principal está en:

```text
backend/src/rag/searchMagazines.ts
```

La función `ragSearchMagazines(queries)`:

1. recibe una o más consultas;
2. recupera hasta 5 vecinos por consulta;
3. elimina duplicados por `id`;
4. conserva la mejor similitud;
5. filtra publicidad y textos poco informativos;
6. ordena por similitud;
7. devuelve como máximo 4 fragmentos;
8. entrega revista, páginas, encabezado, texto y similitud.

## Herramienta `rag_search_magazines`

La herramienta recibe argumentos como:

```json
{
  "queries": [
    "playas recomendadas",
    "restaurantes con vistas al atardecer",
    "castillos"
  ]
}
```

Las consultas son generadas por el modelo a partir de la pregunta del usuario.

Para preguntas compuestas, el modelo puede generar varias queries y combinar sus resultados.

## Integración con el agente

Las herramientas MCP continúan ejecutándose mediante:

```text
Generate - tool call - executeTool - MCP
```

La herramienta RAG se ejecuta de la siguiente manera:
```text Generate - rag_search_magazines - backend - Nomic Atlas - fragmentos - Generate - respuesta final
```


## Reglas de respuesta

Cuando el agente utiliza información de las revistas:

- cita edición y páginas;
- no inventa información no respaldada;
- no trata categorías relacionadas como equivalentes;
- si la información no es suficiente, responde exactamente:

```text
No encontré información suficiente en las revistas proporcionadas.
```

## Pruebas realizadas

### Playas

Consulta:

```text
¿Qué playas recomendadas aparecen en las revistas?
```

Se recuperaron resultados relevantes como playas de Mauritania, Praia das Catedrais, Playa Revolcadero y Playa Naranjo.

### Comida romántica

Consulta:

```text
comida romántica
```

Se recuperaron restaurantes como VelascoAbellá y Tony's Bistro. Esta prueba mostró que resultados con similitud moderada aún podían ser útiles.

### Castillos

Consulta:

```text
¿Qué castillos aparecen en las revistas y cuáles parecen más recomendables para visitar?
```

Inicialmente aparecieron chunks de `PUBLICIDAD` y conceptos cercanos como `castros`. Esto impedia tener un resultado limpio, por lo que se agregaron las siguientes modificaciones:

- filtrado de chunks con encabezado `PUBLICIDAD`;
- instrucciones para no presentar categorías relacionadas como equivalentes.

### Consulta compuesta

Consulta:

```text
¿Dónde puedo comer muy bien y ver un atardecer hermoso al mismo tiempo?
```

El agente tiene instrucciones para combinar criterios de gastronomía y atardecer mediante varias consultas.

### Información insuficiente

Consulta:

```text
¿Qué reservas naturales en Chile recomiendan estas revistas?
```

El agente respondió correctamente:

```text
No encontré información suficiente en las revistas proporcionadas.
```

## Compilación del backend

Desde `backend`:

```bash
npm install
npm run build
```

Para levantar el backend se utiliza el script definido por el proyecto, por ejemplo:

```bash
npm run dev
```

## Limitaciones observadas

La búsqueda semántica puede recuperar conceptos cercanos aunque no sean equivalentes.
Ejemplos:

- `castillo` puede recuperar `castro`;
- consultas de gastronomía pueden recuperar lugares relacionados que no cumplen todos los criterios;
- chunks de publicidad pueden obtener similitud inesperadamente alta.

Para mitigarlo se incorporaron deduplicación, filtrado de publicidad, límite de 4 fragmentos e instrucciones explícitas al modelo.

## Declaración de uso de IA

**Herramienta utilizada:** ChatGPT (OpenAI), modelo GPT-5.6 Sol.

**Tareas realizadas con apoyo de IA:** apoyo en la implementación y depuración del pipeline RAG; revisión del parseo correcto de revistas, implementación y revisión de `rag_search_magazines`, revision de errores en la integración de la herramienta con el loop del agente; 

**Verificación:** las propuestas generadas con apoyo de IA fueron contrastadas con el enunciado, el código existente y el comportamiento real del sistema. La implementación se verificó mediante compilación del backend y pruebas manuales con consultas simples, compuestas y casos sin información suficiente.
