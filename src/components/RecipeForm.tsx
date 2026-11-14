"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseIngredientLine } from "@/lib/recipe/parse";
import { rawIngredientText } from "@/lib/recipe/scale";
import { buildManualCredit, creditLabel } from "@/lib/recipe/credit";
import { DEFAULT_SERVINGS, type ImageCredit, type Recipe } from "@/lib/recipe/types";
import { PicturePicker } from "@/components/PicturePicker";
import { RecipeImage } from "@/components/RecipeImage";
import { saveRecipe } from "@/lib/store";

const label = "mb-1 block text-sm font-medium";

export function RecipeForm({ initial, onSaved }: { initial?: Recipe; onSaved?: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  // credit from Find a picture (Pexels / Unsplash); a credit typed for a pasted picture lives in the fields below
  const stock = initial?.imageCredit && initial.imageCredit.source !== "other" ? initial.imageCredit : null;
  const typed = initial?.imageCredit?.source === "other" ? initial.imageCredit : null;
  const [imageCredit, setImageCredit] = useState<ImageCredit | null>(stock);
  const [creditName, setCreditName] = useState(typed?.name ?? "");
  const [creditUrl, setCreditUrl] = useState(typed?.url ?? "");
  const [creditLicense, setCreditLicense] = useState(typed?.license ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [servings, setServings] = useState(String(initial?.baseServings ?? DEFAULT_SERVINGS));
  const [prep, setPrep] = useState(initial?.prepMinutes?.toString() ?? "");
  const [cook, setCook] = useState(initial?.cookMinutes?.toString() ?? "");
  const [ingredientsText, setIngredientsText] = useState(
    initial ? initial.ingredients.map(rawIngredientText).join("\n") : "",
  );
  const [stepsText, setStepsText] = useState(initial ? initial.steps.map((s) => s.text).join("\n") : "");
  const [tagsText, setTagsText] = useState(initial?.tags.join(", ") ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
  const parsed = lines(ingredientsText).map(parseIngredientLine);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const base = Number(servings);
    if (!title.trim()) return setError("Please give the recipe a title.");
    if (parsed.length === 0) return setError("Add at least one ingredient.");
    if (!(base > 0)) return setError("Servings must be a number above 0.");
    let credit: ImageCredit | null = null;
    if (imageUrl.trim()) {
      if (imageCredit) credit = imageCredit;
      else {
        const m = buildManualCredit({ name: creditName, url: creditUrl, license: creditLicense });
        if (m.error) return setError(m.error);
        credit = m.credit;
      }
    }
    setSaving(true);
    setError("");
    try {
      const saved = await saveRecipe({
      ...initial,
      title: title.trim(),
      imageUrl: imageUrl.trim() || null,
      imageCredit: credit,
      sourceUrl: sourceUrl.trim() || null,
      baseServings: base,
      prepMinutes: prep ? Number(prep) : null,
      cookMinutes: cook ? Number(cook) : null,
      ingredients: parsed,
      steps: lines(stepsText).map((text) => ({ text })),
      tags: tagsText.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
      notes: notes.trim(),
      });
      // Next keeps hidden pages alive, so clear this form before leaving it.
      setSaving(false);
      onSaved?.();
      router.push(`/recipes/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the recipe.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className={label} htmlFor="title">Title</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="img">Picture URL</label>
          <input
            id="img"
            value={imageUrl}
            onChange={(e) => {
              setImageUrl(e.target.value);
              setImageCredit(null); // a pasted link is no longer a Pexels / Unsplash photo
            }}
            placeholder="https://…"
          />
        </div>
        <div>
          <label className={label} htmlFor="src">Source URL</label>
          <input id="src" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" />
        </div>
      </div>
      <div className="space-y-2">
        {imageUrl.trim() && (
          <div className="flex items-center gap-3">
            <RecipeImage url={imageUrl.trim()} title={title || "Recipe"} className="h-16 w-24 rounded-xl" />
            {imageCredit && <p className="text-xs text-muted">{creditLabel(imageCredit)}</p>}
            <button
              type="button"
              className="text-sm underline"
              onClick={() => {
                setImageUrl("");
                setImageCredit(null);
                setCreditName("");
                setCreditUrl("");
                setCreditLicense("");
              }}
            >
              Remove picture
            </button>
          </div>
        )}
        {imageUrl.trim() && !imageCredit && (
          <fieldset className="space-y-2 rounded-2xl border border-line bg-surface p-3">
            <legend className="px-1 text-sm font-medium">Photo credit (optional)</legend>
            <p className="text-xs text-muted">Some pictures, such as Creative Commons ones, need the creator credited. It shows under the picture.</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <input aria-label="Photographer or creator" placeholder="Photographer or creator" value={creditName} onChange={(e) => setCreditName(e.target.value)} />
              <input aria-label="Link to the photo page" placeholder="Link to the photo page" value={creditUrl} onChange={(e) => setCreditUrl(e.target.value)} />
              <input aria-label="License" placeholder="License, e.g. CC BY" value={creditLicense} onChange={(e) => setCreditLicense(e.target.value)} />
            </div>
          </fieldset>
        )}
        <PicturePicker
          defaultQuery={title}
          onPick={(url, credit) => {
            setImageUrl(url);
            setImageCredit(credit);
            setCreditName("");
            setCreditUrl("");
            setCreditLicense("");
          }}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="serv">Servings this recipe makes</label>
          <input id="serv" type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="prep">Prep (min)</label>
          <input id="prep" type="number" min={0} value={prep} onChange={(e) => setPrep(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="cook">Cook (min)</label>
          <input id="cook" type="number" min={0} value={cook} onChange={(e) => setCook(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="ing">Ingredients (one per line)</label>
        <textarea
          id="ing"
          rows={7}
          value={ingredientsText}
          onChange={(e) => setIngredientsText(e.target.value)}
          placeholder={"1 1/2 cups flour\n2 eggs\nsalt, to taste"}
        />
        {parsed.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {parsed.map((p, i) => (
              <li key={i} className={`rounded-full px-2.5 py-1 ${p.scalable ? "bg-navy-soft" : "bg-sand"}`}>
                {p.scalable ? "scales" : "fixed"}: {p.name || "(no name)"}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <label className={label} htmlFor="steps">Steps (one per line)</label>
        <textarea id="steps" rows={7} value={stepsText} onChange={(e) => setStepsText(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="tags">Tags (comma separated)</label>
          <input id="tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="dinner, quick" />
        </div>
        <div>
          <label className={label} htmlFor="notes">Notes</label>
          <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl bg-accent-soft px-3 py-2 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button
          className="rounded-full bg-accent px-5 py-2 font-semibold text-white disabled:opacity-50"
          type="submit"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save recipe"}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-full border border-line bg-surface px-5 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
