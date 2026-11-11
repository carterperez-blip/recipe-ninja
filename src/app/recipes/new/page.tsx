import { RecipeForm } from "@/components/RecipeForm";

export default function NewRecipe() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Add a recipe</h1>
      <p className="rounded-xl bg-butter px-3 py-2 text-sm">
        Import from a web link, pasted text or a photo is coming next. For now, type or paste the recipe below.
      </p>
      <RecipeForm />
    </div>
  );
}
