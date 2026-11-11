import { ImportPanel } from "@/components/ImportPanel";

export default function NewRecipe() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Add a recipe</h1>
      <ImportPanel />
    </div>
  );
}
