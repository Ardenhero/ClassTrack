import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GlobalSync } from "@/components/GlobalSync";
import { ChatWidget } from "@/components/ChatWidget";
import GlobalExperience from "@/components/GlobalExperience";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ICpEP.SE | ClassTrack",
  description: "Professional Attendance Management System for Schools",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = headers().get("x-nonce") ?? "";

  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-transparent text-gray-900 dark:text-gray-100 min-h-screen transition-colors duration-300`}>
        <Providers
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <GlobalExperience />
          {children}
          <ChatWidget />
        </Providers>
        <Analytics />
        <SpeedInsights />
        <GlobalSync />
      </body>
    </html>
  );
}
