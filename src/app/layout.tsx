import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { isFaculty } from "@/server/dal";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NYU VIP Inventory",
  description: "Track items, stock levels and what has been issued out.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const faculty = await isFaculty();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <Nav faculty={faculty} />
        <main className="mx-auto max-w-6xl px-4 py-7">{children}</main>
      </body>
    </html>
  );
}
