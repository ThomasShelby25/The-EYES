





import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "EYES - Everything You Ever Said",
  description: "Your digital memory dashboard. Monitor, audit, and explore everything across your connected platforms.",
  keywords: ["digital memory", "reputation monitoring", "audit", "privacy"],
  verification: {
    google: 'Uk096nnnTBgf1xGTAbnaRkvN90RjJrVd7HekhqyNTHU',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              const savedTheme = localStorage.getItem('eyes-theme');
              if (savedTheme) {
                document.documentElement.setAttribute('data-theme', savedTheme);
              }
            } catch (e) {}
          })();
        `}} />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

