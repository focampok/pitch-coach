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

/** Ventana de conteo. */
export const VENTANA_MS = 10 * 60 * 1000; // 10 minutos

/** Solicitudes permitidas por IP dentro de la ventana. */
export const MAX_SOLICITUDES = 10;

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
 */
export function consumir(
  clave: string,
  ahora: number = Date.now(),
): ResultadoRateLimit {
  const previas = vigentes(registro.get(clave), ahora);

  if (previas.length >= MAX_SOLICITUDES) {
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
    restantes: MAX_SOLICITUDES - previas.length,
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
 */
export function limitar(
  request: Request,
  ambito: string,
  ahora: number = Date.now(),
): Response | null {
  const resultado = consumir(`${ambito}:${obtenerIp(request)}`, ahora);
  if (resultado.permitido) return null;

  return new Response(
    JSON.stringify({
      error:
        "Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(resultado.retryAfterSegundos),
      },
    },
  );
}
