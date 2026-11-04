import type { Metadata } from "next";
import { NotFoundScreen } from "@/shop/NotFoundScreen";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return <NotFoundScreen />;
}
