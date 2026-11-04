"use client";

import { useMutation, useQuery } from "convex/react";
import { TagsIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { EmptyState, FormError, PageHeader, StatusPill } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { slugify } from "@/lib/slug";

export default function CategoriesView() {
  const categories = useQuery(api.categories.listAllAdmin, {});

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Categories"
        description="Archived categories are hidden from the store; their products stay in place."
      />
      <div className="space-y-6">
        <CategoryForm />
        {categories === undefined ? (
          <div className="space-y-2" aria-busy aria-label="Loading categories">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <EmptyState icon={TagsIcon} title="No categories yet" body="Add a category above, then create products in it." />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {categories.map((category) => (
              <CategoryRow key={category._id} category={category} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CategoryForm({
  category,
  onDone,
}: {
  category?: Doc<"categories">;
  onDone?: () => void;
}) {
  const formId = useId();
  const create = useMutation(api.categories.create);
  const update = useMutation(api.categories.update);
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  // A new category's slug follows its name until the admin edits the slug.
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (category) {
        await update({ id: category._id, name, slug });
        toast.success("Category updated");
      } else {
        await create({ name, slug });
        toast.success(`Added “${name.trim()}”`);
        setName("");
        setSlug("");
        setSlugTouched(false);
      }
      onDone?.();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save this category"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={category ? `Edit ${category.name}` : "Add category"}
      aria-describedby={error ? `${formId}-error` : undefined}
      className={category ? "space-y-3" : "space-y-3 rounded-xl border bg-card p-4"}
    >
      {!category && <h2 className="text-sm font-semibold">Add category</h2>}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="space-y-1">
          <span className="text-xs font-medium">Name</span>
          <Input
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium">URL slug</span>
          <Input
            required
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value);
              setSlugTouched(true);
            }}
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" size="lg" className="px-4" disabled={saving}>
            {saving ? "Saving…" : category ? "Save" : "Add"}
          </Button>
          {onDone && (
            <Button type="button" variant="outline" size="lg" onClick={onDone} disabled={saving}>
              Cancel
            </Button>
          )}
        </div>
      </div>
      <FormError id={`${formId}-error`} message={error} />
    </form>
  );
}

function CategoryRow({ category }: { category: Doc<"categories"> }) {
  const archive = useMutation(api.categories.archive);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleArchived() {
    setBusy(true);
    try {
      await archive({ id: category._id, archived: !category.archived });
      toast.success(category.archived ? `Restored “${category.name}”` : `Archived “${category.name}”`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update this category"));
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="p-4">
        <CategoryForm category={category} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {category.name}
          {category.archived && <StatusPill tone="neutral">Archived</StatusPill>}
        </p>
        <p className="text-xs text-muted-foreground">/categories/{category.slug}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button variant={category.archived ? "outline" : "destructive"} onClick={() => void toggleArchived()} disabled={busy}>
          {category.archived ? "Restore" : "Archive"}
        </Button>
      </div>
    </li>
  );
}
