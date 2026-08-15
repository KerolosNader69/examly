import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://examly.site";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Examly - AI-Powered Oral Exams for Teachers",
    template: "%s | Examly",
  },
  description: "Transform your teaching with AI-graded oral exams. Fast, fair, secure, and accessible oral assessment tools for modern educators.",
  keywords: [
    "AI oral exams",
    "AI grading for teachers",
    "automated oral assessment",
    "EdTech AI platform",
    "examly oral evaluation",
    "voice exam AI",
  ],
  authors: [{ name: "Examly Team" }],
  creator: "Examly",
  publisher: "Examly",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "Examly",
    title: "Examly - AI-Powered Oral Exams for Teachers",
    description: "Transform your teaching with AI-graded oral exams. Fast, fair, secure, and accessible oral assessment tools for modern educators.",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "Examly Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Examly - AI-Powered Oral Exams for Teachers",
    description: "Transform your teaching with AI-graded oral exams.",
    images: ["/icon.png"],
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${poppins.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-inter bg-bg-light text-text-dark dark:bg-deep-teal dark:text-light-mint">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
