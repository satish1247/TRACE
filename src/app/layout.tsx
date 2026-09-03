import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRACE",
  description: "Banks check whether the payment is correct. TRACE checks whether the person is free.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
