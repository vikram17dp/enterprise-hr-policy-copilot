import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
export const metadata: Metadata = {
  title: "HR Policy Copilot",
  description: "Enterprise HR Policy AI Assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <TooltipProvider>
          {children}
          <Toaster
             position="top-right"
             richColors
             closeButton
          />
        </TooltipProvider>
      </body>
    </html>
  );
}