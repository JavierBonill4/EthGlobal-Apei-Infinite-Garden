import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // TODO(naming): pick a real name before launch. Not "Infinite Garden" --
  // see docs/DESIGN.md section 17.
  title: "The Garden",
  description:
    "A shared world everyone tends and anyone can ruin. You never win it, you continue it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
