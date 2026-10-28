import type { Metadata } from "next";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "isModelDumber — Is ChatGPT getting dumber?",
    template: "%s · isModelDumber",
  },
  description:
    "Is ChatGPT getting dumber? Independent, reproducible observations of native Codex subagent capabilities. Same tasks. Same settings. Evidence over anecdotes.",
  openGraph: {
    title: "Is ChatGPT getting dumber?",
    description:
      "Follow the evidence. Independent monitoring of native Codex subagent performance.",
    type: "website",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
