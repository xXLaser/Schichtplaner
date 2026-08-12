import type { Metadata } from "next";
import { Outfit, Source_Sans_3 } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const display = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Schichtwerk – Dienstplan",
  description:
    "Dienstplan für Schichtbetriebe mit Kompetenzen, Abwesenheiten und automatischer Kompensation",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full font-[family-name:var(--font-body)] antialiased">
        <Nav />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      </body>
    </html>
  );
}
