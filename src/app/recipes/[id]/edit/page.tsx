"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { RecipeForm } from "@/components/RecipeForm";
import { useHydrated, useRecipes } from "@/lib/store";

export default function EditRecipe() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <EditLoader />
    </Suspense>
  );
}

function EditLoader() {
  const { id } = useParams<{ id: string }>();
  const hydrated = useHydrated();
  const recipe = useRecipes().find((r) => r.id === id);
  if (!hydrated) return <p className="text-muted">Loading…</p>;
  if (!recipe) return <p>Recipe not found. <Link className="underline" href="/">Back to library</Link></p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit recipe</h1>
      <RecipeForm initial={recipe} />
    </div>
  );
}
