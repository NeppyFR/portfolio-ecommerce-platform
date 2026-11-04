import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductScreen } from "@/shop/ProductScreen";
import { PRODUCT_TITLES, RUNTIME_PARAM, SEED_PRODUCT_SLUGS } from "@/lib/routes";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return [...SEED_PRODUCT_SLUGS, RUNTIME_PARAM].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: PRODUCT_TITLES[slug] ?? "Product" };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return (
    <Suspense>
      <ProductScreen slug={slug} />
    </Suspense>
  );
}
