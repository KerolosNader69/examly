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

export const metadata: Metadata = {
  title: "Examly - AI-Powered Oral Examination & Voice Assessment Platform",
  description: "Examly is an AI-powered oral examination and voice assessment platform for teachers and educational institutions to create, conduct, and evaluate spoken exams with real-time AI proctoring and automated grading.",
  applicationName: "Examly",
  openGraph: {
    title: "Examly - AI-Powered Oral Examination & Voice Assessment Platform",
    description: "Examly is an AI-powered oral examination and voice assessment platform for teachers and educational institutions to create, conduct, and evaluate spoken exams with real-time AI proctoring and automated grading.",
    siteName: "Examly",
    url: "https://examly.site",
    type: "website",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Examly",
              "applicationCategory": "EducationalApplication",
              "url": "https://examly.site",
              "description": "Examly is an AI-powered oral examination and voice assessment platform for teachers and educational institutions.",
            }),
          }}
        />
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
