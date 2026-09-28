import { NextResponse } from "next/server";
import type { Idioma } from "@/types/idioma";
import { diccionario, type Diccionario } from "./diccionarios";
import { idiomaDeCabecera, idiomaDeSolicitud } from "./idiomas";

/**
 * Resolución del idioma de una API route (docs/alcance.md, contrato bilingüe).
 *
 * Regla del contrato: el campo `idioma` del cuerpo es `'es'` o `'en'`; ausente
 * vale `'es'`; cualquier otro valor es un 400. El idioma elegido gobierna TODOS
 * los mensajes que devuelve la ruta (400, 413, 429 y el genérico 502).
 *
 * El 429 lo arma `limitar()`, que corre antes de leer el cuerpo: ese usa la
 * cabecera `X-Idioma` (ver src/lib/idiomas.ts).
 */
export type ResultadoIdiomaRuta =
  | { tipo: "ok"; idioma: Idioma; textos: Diccionario }
  | { tipo: "invalido"; respuesta: NextResponse };

/**
 * Resuelve el idioma de la petición a partir del cuerpo ya parseado.
 *
 * Si el campo viene presente pero inválido, devuelve la respuesta 400 ya armada
 * —en el idioma de la cabecera, porque el del cuerpo es justamente el que no se
 * pudo usar—, para que la ruta no tenga que repetir ese caso.
 */
export function resolverIdiomaDeRuta(
  valorDelCuerpo: unknown,
  request: Request,
): ResultadoIdiomaRuta {
  const idioma = idiomaDeSolicitud(valorDelCuerpo);
  if (idioma === null) {
    const respaldo = diccionario(idiomaDeCabecera(request));
    return {
      tipo: "invalido",
      respuesta: NextResponse.json(
        { error: respaldo.api.idiomaInvalido },
        { status: 400 },
      ),
    };
  }
  return { tipo: "ok", idioma, textos: diccionario(idioma) };
}
