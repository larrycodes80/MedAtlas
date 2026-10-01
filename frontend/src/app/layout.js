import "./globals.css";

export const metadata = {
  title: "MedAtlas — Your second brain",
  description: "Your local medical document workspace",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
