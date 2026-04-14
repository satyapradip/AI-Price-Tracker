import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";



export const metadata = {
  title: "Deal Drop",
  description: "Track the best deals and discounts across the web.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning>
      
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
