// Tipos del coach visual (docs/alcance.md §5.1).
// El avatar personifica al entrenador: escucha en vivo durante la grabación y
// reacciona con micro-gestos a lo que el sistema detecta en la transcripción.

/**
 * Estados del coach. Uno activo a la vez; la animación es breve (~1.2s) y cada
 * reacción se dispara por un dato real verificable en el dashboard.
 */
export type EstadoCoach =
  | "escuchando"
  | "estremecido"
  | "sorprendido"
  | "asintiendo"
  | "mirandoReloj";

/** Reacciones que disparan gestos (todo estado salvo "escuchando"). */
export type ReaccionCoach = Exclude<EstadoCoach, "escuchando">;
