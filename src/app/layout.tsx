import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Schichtwerk – Dienstplan & Urlaub",
  description:
    "Mobil nutzbarer Dienstplan für Schichtbetriebe mit Urlaubsplaner, Kompetenzen und automatischer Kompensation",
  applicationName: "Schichtwerk",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Schichtwerk",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full">
      <body className="min-h-full font-[family-name:var(--font-body)] antialiased">
        <Nav />
        <main className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-10 lg:pb-10">
          {children}
        </main>
      </body>
    </html>
  );
}
