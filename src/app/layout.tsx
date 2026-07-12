import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Worship Lab",
  description: "Setlists & worship teams for Mount Greylock Baptist Church",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Worship Lab",
  },
};

export const viewport: Viewport = {
  themeColor: "#eef4f6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applied before paint so a saved dark preference doesn't flash light first.
const themeInit = `try{if(localStorage.getItem("wl-theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body>
          <script dangerouslySetInnerHTML={{ __html: themeInit }} />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
