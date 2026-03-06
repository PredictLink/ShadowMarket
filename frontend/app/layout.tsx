import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShadowMarket — Private Prediction Markets",
  description:
    "Private prediction markets with sealed bids and zero front-running, powered by Chainlink Confidential Compute.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-shadow-900 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
