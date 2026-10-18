import type { Metadata } from "next";
import { headers } from "next/headers";
import { Alike, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import "../styles/dashboard-resultado.css";
import { ProveedorIdioma } from "@/components/ProveedorIdioma";
import { diccionario } from "@/lib/diccionarios";
import {
  etiquetaIdioma,
  etiquetaOpenGraph,
  idiomaDeAcceptLanguage,
  scriptIdiomaInicial,
} from "@/lib/idiomas";
import { URL_SITIO } from "@/lib/sitio";
import type { Idioma } from "@/types/idioma";
import { IDIOMAS } from "@/types/idioma";

const alike = Alike({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-alike",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source",
});

/**
 * Idioma de la petición, por `Accept-Language`.
 *
 * Leer `headers()` vuelve dinámica la ruta (se renderiza por petición, ya no
 * se prerenderiza en build). Es a propósito: así el HTML que recibe un
 * navegador en inglés —y lo que ve un buscador, una vista previa de enlace o
 * un `curl`— ya sale en inglés: `<html lang>`, el metadata y el primer render.
 * Antes el servidor siempre servía español y el cliente lo corregía después.
 */
async function idiomaDePeticion(): Promise<Idioma> {
  const cabeceras = await headers();
  return idiomaDeAcceptLanguage(cabeceras.get("accept-language"));
}

export async function generateMetadata(): Promise<Metadata> {
  const idioma = await idiomaDePeticion();
  const { meta } = diccionario(idioma);

  return {
    metadataBase: new URL(URL_SITIO),
    title: meta.titulo,
    description: meta.descripcion,
    openGraph: {
      type: "website",
      url: "/",
      siteName: meta.titulo,
      title: meta.titulo,
      description: meta.descripcion,
      locale: etiquetaOpenGraph(idioma),
      alternateLocale: IDIOMAS.filter((otro) => otro !== idioma).map(etiquetaOpenGraph),
    },
    twitter: {
      card: "summary",
      title: meta.titulo,
      description: meta.descripcion,
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const idioma = await idiomaDePeticion();

  return (
    <html
      // El idioma que pidió el navegador (Accept-Language). El script de abajo
      // lo corrige antes del primer paint si el usuario guardó otro con el
      // selector. `suppressHydrationWarning` es por ese atributo: React no lo
      // administra (lo mueve el script), así que no debe reportarlo como
      // mismatch. NO silencia diferencias de texto: el árbol de React arranca
      // con el mismo idioma que el servidor (ver ProveedorIdioma).
      lang={etiquetaIdioma(idioma)}
      suppressHydrationWarning
      className={`${alike.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptIdiomaInicial(idioma) }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ProveedorIdioma idiomaInicial={idioma}>{children}</ProveedorIdioma>
      </body>
    </html>
  );
}
