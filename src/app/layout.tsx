import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CSR Publishing",
  description: "Clinical Study Report Publishing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${jakartaSans.variable} ${jetbrainsMono.variable} bg-background text-foreground font-sans antialiased`}
      >
        <TooltipProvider delayDuration={300}>
          <QueryProvider>{children}</QueryProvider>
          <Toaster position="bottom-right" theme="dark" richColors closeButton />
        </TooltipProvider>
      </body>
    </html>
  );
}
