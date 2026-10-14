import type { Metadata } from "next";
import { Comfortaa, Source_Serif_4 } from "next/font/google";
import { CurrencyBackground } from "@/components/currency-background";
import "./globals.css";

const comfortaa = Comfortaa({
  variable: "--font-comfortaa",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Friday",
  description: "Personal finance manager",
  icons: {
    icon: [
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/icon.png", type: "image/png", sizes: "256x256" },
    ],
    shortcut: "/favicon.png",
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${comfortaa.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <CurrencyBackground />
        <div className="relative z-10 min-h-full">{children}</div>
      </body>
    </html>
  );
}
