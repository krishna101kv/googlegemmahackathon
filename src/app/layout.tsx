import type { Metadata } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stagecraft — Personal Toastmasters Coach",
  description:
    "Local-first speech coaching with Gemma 4: record, get coached, track progress.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${figtree.variable}`}>
        <div className="app-shell">
          <AppNav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
