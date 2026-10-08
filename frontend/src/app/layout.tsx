import { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Recupera+ | Plataforma Inteligente de Cobrança",
  description: "Recupere valores de forma inteligente e sem atrito.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-50 min-h-screen flex flex-col font-sans selection:bg-indigo-500/30`}
      >
        {/* Animated background gradient */}
        <div className="fixed inset-0 -z-10 h-full w-full bg-zinc-950">
          <div className="absolute bottom-0 left-[-20%] right-0 top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(99,102,241,0.15),rgba(255,255,255,0))] blur-[80px]"></div>
          <div className="absolute bottom-[-20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(168,85,247,0.1),rgba(255,255,255,0))] blur-[100px]"></div>
        </div>
        
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
