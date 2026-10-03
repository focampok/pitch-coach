import type { Metadata } from "next";
import { Alike, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import "../styles/dashboard-resultado.css";
import { ProveedorIdioma } from "@/components/ProveedorIdioma";
import {
  IDIOMA_POR_DEFECTO,
  etiquetaIdioma,
  scriptIdiomaInicial,
} from "@/lib/idiomas";

const alike = Alike({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-alike",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source",
});

export const metadata: Metadata = {
  title: "Pitch Coach",
  description:
    "Entrena tu pitch en voz alta y recibe un veredicto hablado con feedback estructurado según el tipo de pitch.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      // El idioma por defecto del servidor; el script de abajo lo corrige antes
      // del primer paint si el usuario tiene otro guardado o preferido en el
      // navegador. `suppressHydrationWarning` es por ese atributo: React no lo
      // administra (lo mueve el script), así que no debe reportarlo como
      // mismatch. NO silencia diferencias de texto: el árbol de React arranca
      // con el mismo idioma por defecto que el servidor (ver ProveedorIdioma).
      lang={etiquetaIdioma(IDIOMA_POR_DEFECTO)}
      suppressHydrationWarning
      className={`${alike.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptIdiomaInicial() }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ProveedorIdioma>{children}</ProveedorIdioma>
      </body>
    </html>
  );
}
