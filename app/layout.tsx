import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Intent 登录方式管理 Demo",
  description: "Intent 手机号与邮箱增绑、换绑交互演示",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
