import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sahaay · Shared elderly care",
    template: "%s · Sahaay",
  },
  description:
    "Sahaay keeps one care circle for an elderly parent: medication schedules, adherence, appointments and calm email reminders, protected by a family passcode.",
};

export const viewport: Viewport = {
  themeColor: "#070e12",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const size = store.get("sahaay_textsize")?.value;
  const contrast = store.get("sahaay_contrast")?.value;
  return (
    <html
      lang="en-IN"
      data-textsize={size === "large" || size === "xlarge" ? size : "normal"}
      data-contrast={contrast === "high" ? "high" : "normal"}
    >
      <body>{children}</body>
    </html>
  );
}
