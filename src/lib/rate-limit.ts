/**
 * Rate limit en memoria, por instancia del servidor.
 *
 * IMPORTANTE: el estado vive en el proceso Node. Si el servicio corre con más
 * de una instancia, cada una lleva su propio contador, así que el límite
 * efectivo se multiplica por el número de instancias. No es un límite global:
 * sirve para frenar abuso casual y proteger cuota de proveedores, no como
 * control de seguridad distribuido. Si se necesita un límite global, hay que
 * sustituir este módulo por un almacén compartido (Redis, etc.).
 */

import { diccionario } from "./diccionarios";
import { idiomaDeCabecera } from "./idiomas";

/** Ventana de conteo. */
export const VENTANA_MS = 10 * 60 * 1000; // 10 minutos

/** Solicitudes permitidas por IP dentro de la ventana (límite por defecto). */
export const MAX_SOLICITUDES = 10;

/**
 * Límite propio por ámbito, cuando el costo por invocación no es el estándar.
 *
 * POR QUÉ EXISTE: `/api/enriquecer` no cuesta una llamada externa como el resto.
 * Con la Fase B (verificación obligatoria) cada invocación dispara, por
 * invocación:
 *   - 1 extracción de entidades al modelo (Nano, `rapido`);
 *   - por cada uno de los `MAX_PUNTOS_ENRIQUECIDOS` (2) primeros puntos de la
 *     rúbrica: 1 query al modelo (`rapido`) + 1 búsqueda en Tavily (1 crédito
 *     con `search_depth: "basic"`) + hasta 2 Extract (máximo `MAX_CANDIDATOS`)
 *     + 1 validación (`rapido`) + 1 frase (`rapido`). El resto de puntos no
 *     genera ninguna llamada externa.
 * Es decir, hasta 1 + 2 × 6 = ~13 llamadas externas por invocación. Con el techo
 * global de 10/10 min esto vaciaría el free tier de Tavily en horas de abuso;
 * el techo de 5 mantiene el costo por ventana acotado. No se baja más porque el
 * flujo verificado ya intenta varios caminos antes de descartar un punto: un
 * techo menor dejaría la feature inutilizable en el uso normal.
 *
 * Si el costo por punto crece otra vez, este número (y su test) deben revisarse.
 */
export const LIMITES_POR_AMBITO: Record<string, number> = {
  enriquecer: 5,
};

/** Solicitudes permitidas por IP en la ventana para un ámbito dado. */
export function maximoDe(ambito: string): number {
  return LIMITES_POR_AMBITO[ambito] ?? MAX_SOLICITUDES;
}

interface ResultadoRateLimit {
  /** Si la solicitud puede continuar. */
  permitido: boolean;
  /** Solicitudes restantes en la ventana (0 si se agotó). */
  restantes: number;
  /** Segundos sugeridos para `Retry-After` cuando NO se permite. */
  retryAfterSegundos: number;
}

/** timestamps (ms) de las solicitudes recientes, por clave. */
const registro = new Map<string, number[]>();

/** Elimina las marcas fuera de la ventana. Devuelve las vigentes. */
function vigentes(marcas: number[] | undefined, ahora: number): number[] {
  if (!marcas) return [];
  return marcas.filter((marca) => ahora - marca < VENTANA_MS);
}

/**
 * Registra un intento para `clave` y decide si se permite.
 * `ahora` es inyectable para poder testear la ventana sin esperar.
 * `maximo` permite un techo distinto del global (ver LIMITES_POR_AMBITO).
 */
export function consumir(
  clave: string,
  ahora: number = Date.now(),
  maximo: number = MAX_SOLICITUDES,
): ResultadoRateLimit {
  const previas = vigentes(registro.get(clave), ahora);

  if (previas.length >= maximo) {
    // La ventana se libera cuando la solicitud más antigua caduca.
    const masAntigua = previas[0];
    const retryAfterSegundos = Math.max(
      1,
      Math.ceil((VENTANA_MS - (ahora - masAntigua)) / 1000),
    );
    registro.set(clave, previas);
    return { permitido: false, restantes: 0, retryAfterSegundos };
  }

  previas.push(ahora);
  registro.set(clave, previas);
  return {
    permitido: true,
    restantes: maximo - previas.length,
    retryAfterSegundos: 0,
  };
}

/** Resetea el estado (solo para tests). */
export function reiniciar(): void {
  registro.clear();
}

/**
 * Obtiene una IP aproximada para limitar por cliente. Detrás de un proxy
 * (Railway) el primer valor de `x-forwarded-for` es el cliente. Es
 * best-effort: si no hay cabeceras, se agrupa bajo "desconocida".
 */
export function obtenerIp(request: Request): string {
  const reenviada = request.headers.get("x-forwarded-for");
  if (reenviada) {
    const primera = reenviada.split(",")[0]?.trim();
    if (primera) return primera;
  }
  return request.headers.get("x-real-ip")?.trim() || "desconocida";
}

/**
 * Aplica el rate limit a una petición. Devuelve `null` si puede continuar o un
 * `Response` 429 con `Retry-After` si se excedió.
 *
 * El mensaje va en el idioma de la cabecera `X-Idioma`: esta función corre
 * ANTES de que la ruta lea el cuerpo (así no se parsean 20 MB de audio bajo
 * abuso), así que el campo `idioma` del cuerpo todavía no está disponible.
 */
export function limitar(
  request: Request,
  ambito: string,
  ahora: number = Date.now(),
): Response | null {
  const resultado = consumir(
    `${ambito}:${obtenerIp(request)}`,
    ahora,
    maximoDe(ambito),
  );
  if (resultado.permitido) return null;

  const textos = diccionario(idiomaDeCabecera(request));

  return new Response(
    JSON.stringify({ error: textos.api.demasiadasSolicitudes }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(resultado.retryAfterSegundos),
      },
    },
  );
}
