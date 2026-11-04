import type { Metadata } from "next";
import { Suspense } from "react";
import { CollectionScreen } from "@/shop/CollectionScreen";
import { COLLECTION_TITLES, RUNTIME_PARAM, SEED_COLLECTION_HANDLES } from "@/lib/routes";

type Props = { params: Promise<{ handle: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return [...SEED_COLLECTION_HANDLES, RUNTIME_PARAM].map((handle) => ({ handle }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  return { title: COLLECTION_TITLES[handle] ?? "Collection" };
}

export default async function Page({ params }: Props) {
  const { handle } = await params;
  return (
    <Suspense>
      <CollectionScreen handle={handle} />
    </Suspense>
  );
}
