/**
 * Cliente server-side para Tavily (enriquecimiento opcional, §12 del alcance).
 * Se usa solo cuando un punto de rúbrica no se cumplió por falta de una cifra
 * concreta — no es parte del loop crítico.
 */

export interface SugerenciaTavily {
  punto: string;
  query: string;
  resumen: string;
  url: string;
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

interface TavilyResponse {
  results: TavilyResult[];
}

async function buscarEnTavily(query: string): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY no configurada");
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: 3,
      include_answer: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Tavily respondió ${res.status}`);
  }

  const data = (await res.json()) as TavilyResponse;
  return data.results ?? [];
}

/**
 * Para cada punto de rúbrica NO cumplido, arma una query relacionada con
 * el tema del pitch y busca un dato/estadística real que el usuario podría
 * usar para reforzar ese punto. Es "best effort": si Tavily falla para un
 * punto puntual, ese punto simplemente no trae sugerencia — no debe tumbar
 * el resto del análisis.
 */
export async function enriquecerConTavily(
  puntosSinCumplir: { punto: string; comentario?: string }[],
  temaPitch: string
): Promise<SugerenciaTavily[]> {
  const sugerencias: SugerenciaTavily[] = [];

  // Se corren en paralelo pero cada una se aísla con su propio try/catch.
  await Promise.all(
    puntosSinCumplir.map(async ({ punto, comentario }) => {
      const query = `estadística reciente ${temaPitch} ${punto}`.trim();
      try {
        const resultados = await buscarEnTavily(query);
        const mejor = resultados[0];
        if (mejor) {
          sugerencias.push({
            punto,
            query,
            resumen: mejor.content.slice(0, 280),
            url: mejor.url,
          });
        }
      } catch (err) {
        console.warn(`[tavily] sin sugerencia para "${punto}":`, err);
      }
    })
  );

  return sugerencias;
}
