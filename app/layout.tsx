import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { FONT_VARIABLE_CLASSES } from "@/app/fonts";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import CommandPalette from "@/components/CommandPalette";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "jackshed",
  description: "Practice tools for musicians: a jam tune picker, a note trainer, and more.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f4f4f6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${FONT_VARIABLE_CLASSES} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex h-dvh overflow-hidden bg-surface" suppressHydrationWarning>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <Sidebar />
        <CommandPalette />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background lg:my-2 lg:ml-2 lg:mr-2 lg:rounded-xl lg:border lg:border-surface-hover">
          {children}
        </div>
      </body>
    </html>
  );
}
