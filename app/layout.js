import "./globals.css";

export const metadata = {
  title: "Meeting Attendance",
  description: "QR-based attendance tracker",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
