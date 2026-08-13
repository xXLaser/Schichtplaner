import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Schichtwerk – Dienstplan & Urlaub",
  description:
    "Lokaler Dienstplan für Schichtbetriebe mit Setup-Assistent, Kompetenzen und automatischer Planung",
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className="h-full">
      <body className="min-h-full font-[family-name:var(--font-body)] antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
