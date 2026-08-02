import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const pretendard = localFont({
  variable: "--font-pretendard",
  display: "swap",
  preload: false,
  src: [
    {
      path: "./fonts/Pretendard-Regular.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/Pretendard-Medium.woff",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/Pretendard-SemiBold.woff",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/Pretendard-Bold.woff",
      weight: "700",
      style: "normal",
    },
  ],
});

const title =
  "Dynin-Robotics — Omnimodal Unified Diffusion Vision-Language-Action Model";
const description =
  "One masked-diffusion backbone for robot policy, world modeling, goal-state prediction, and task understanding.";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const socialImage = siteUrl
  ? new URL(`${basePath}/social-preview.png`, siteUrl).toString()
  : undefined;
const socialImageAlt = "Dynin-Robotics project page overview";
const themeScript = `
  (() => {
    try {
      const saved = localStorage.getItem("dynin-color-theme");
      const preference =
        saved === "light" || saved === "dark" || saved === "auto"
          ? saved
          : "auto";
      const theme =
        preference === "auto"
          ? matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark"
          : preference;
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.themePreference = preference;
      document.documentElement.style.colorScheme = theme;
    } catch {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.dataset.themePreference = "auto";
      document.documentElement.style.colorScheme = "dark";
    }
  })();
`;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    ...(siteUrl ? { url: siteUrl } : {}),
    ...(socialImage
      ? {
          images: [
            {
              url: socialImage,
              width: 2438,
              height: 1508,
              alt: socialImageAlt,
            },
          ],
        }
      : {}),
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    ...(socialImage
      ? { images: [{ url: socialImage, alt: socialImageAlt }] }
      : {}),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={pretendard.variable}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
