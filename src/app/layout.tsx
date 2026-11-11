import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { AccountMenu } from "@/components/AccountMenu";
import { AuthGate } from "@/components/AuthGate";
import { Logo } from "@/components/Logo";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Recipe Ninja",
  description: "Your personal recipe library: save, scale and cook.",
  appleWebApp: { capable: true, title: "Recipe Ninja", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#fdf8f3", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <Logo className="h-9 w-9" />
              Recipe Ninja
            </Link>
            <AccountMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6"><AuthGate>{children}</AuthGate></main>
      </body>
    </html>
  );
}
