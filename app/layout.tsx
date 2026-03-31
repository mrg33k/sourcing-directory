import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sourcing Directory",
  description: "Sourcing Directory",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
