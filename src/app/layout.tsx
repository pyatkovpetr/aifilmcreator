import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI режиссёр — сценарий клипа и фильма",
  description: "5 режиссёрских идей, раскадровка по 10 секунд, промпты, negative prompts и PDF production pack.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
