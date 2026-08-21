// Declaraciones mínimas para la Web Speech API (SpeechRecognition).
//
// TypeScript 5.9 ya incluye en lib.dom.d.ts SpeechRecognitionAlternative,
// SpeechRecognitionResult y SpeechRecognitionResultList, pero NO declara el
// objeto principal SpeechRecognition (ni SpeechRecognitionEvent, ni
// SpeechRecognitionErrorEvent, ni el prefijo webkit de Chrome/Chromium/Edge).
// Estas declaraciones cubren únicamente lo que GrabadorVoz usa, siguiendo la
// especificación W3C y la variante prefijada de Chromium. Se elige una
// declaración propia en vez de `@types/dom-speech-recognition` para no
// duplicar los tipos que TS ya trae en lib.dom (evita conflictos de merge).

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

declare class SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface Window {
  // Estándar W3C y prefijo de Chrome/Chromium/Edge. Ambos opcionales porque el
  // soporte depende del navegador: se detecta en runtime, no solo en tipos.
  SpeechRecognition?: typeof SpeechRecognition;
  webkitSpeechRecognition?: typeof SpeechRecognition;
}
