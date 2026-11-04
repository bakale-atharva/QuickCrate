"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { FormError, selectClass, textareaClass } from "@/components/admin/common";
import ImageUpload from "@/components/admin/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { paiseToRupeesInput, parseRupees } from "@/lib/format";
import { slugify } from "@/lib/slug";

type AdminProduct = NonNullable<FunctionReturnType<typeof api.products.adminGetById>>;

type Values = {
  categoryId: string;
  name: string;
  slug: string;
  sku: string;
  packLabel: string;
  price: string;
  description: string;
  initialStock: string;
};

// Creates a product, or edits catalog details of an existing one. Stock is
// never edited here: it changes only through audited adjustments.
export default function ProductForm({ product }: { product?: AdminProduct }) {
  const formId = useId();
  const router = useRouter();
  const categories = useQuery(api.categories.listAllAdmin, {});
  const create = useMutation(api.products.create);
  const update = useMutation(api.products.update);

  const [values, setValues] = useState<Values>({
    categoryId: product?.categoryId ?? "",
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    sku: product?.sku ?? "",
    packLabel: product?.packLabel ?? "",
    price: product ? paiseToRupeesInput(product.pricePaise) : "",
    description: product?.description ?? "",
    initialStock: "0",
  });
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  // New products hold their uploaded image until the product is created.
  const [pendingImage, setPendingImage] = useState<{ id: Id<"_storage">; url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Values, string>>>({});

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const pricePaise = parseRupees(values.price);
    const initialStock = /^\d{1,6}$/.test(values.initialStock.trim()) ? BigInt(values.initialStock.trim()) : null;
    const errors: Partial<Record<keyof Values, string>> = {};
    if (!values.categoryId) errors.categoryId = "Choose a category.";
    if (pricePaise === null) errors.price = "Enter a price in rupees, e.g. 45 or 45.50.";
    if (!product && initialStock === null) errors.initialStock = "Enter a whole number of units.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || pricePaise === null) return;

    const details = {
      categoryId: values.categoryId as Id<"categories">,
      name: values.name,
      slug: values.slug,
      sku: values.sku,
      packLabel: values.packLabel,
      pricePaise,
      description: values.description,
    };

    setSaving(true);
    try {
      if (product) {
        await update({ id: product._id, ...details });
        toast.success("Product saved");
      } else {
        const id = await create({ ...details, initialStock: initialStock ?? BigInt(0), imageId: pendingImage?.id });
        toast.success(`Created “${values.name.trim()}”`);
        router.push(`/admin/products/${id}`);
      }
    } catch (err) {
      setError(errorMessage(err, "Couldn't save this product"));
    } finally {
      setSaving(false);
    }
  }

  async function handleImage(storageId: Id<"_storage">, previewUrl: string) {
    if (product) {
      await update({ id: product._id, imageId: storageId });
      toast.success("Image updated");
    } else {
      setPendingImage({ id: storageId, url: previewUrl });
    }
  }

  const describedBy = (key: keyof Values) => (fieldErrors[key] ? `${formId}-${key}-error` : undefined);
  const fieldError = (key: keyof Values) =>
    fieldErrors[key] && (
      <span id={`${formId}-${key}-error`} className="block text-xs text-destructive">
        {fieldErrors[key]}
      </span>
    );

  return (
    <form
      onSubmit={handleSubmit}
      aria-describedby={error ? `${formId}-error` : undefined}
      className="space-y-5"
    >
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium">Image</legend>
        <ImageUpload
          name={values.name}
          currentUrl={product ? product.imageUrl : (pendingImage?.url ?? null)}
          onUploaded={handleImage}
          disabled={saving}
        />
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs font-medium">Name</span>
          <Input
            required
            value={values.name}
            onChange={(event) => {
              set("name", event.target.value);
              if (!slugTouched) set("slug", slugify(event.target.value));
            }}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium">URL slug</span>
          <Input
            required
            value={values.slug}
            onChange={(event) => {
              set("slug", event.target.value);
              setSlugTouched(true);
            }}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium">SKU</span>
          <Input required value={values.sku} onChange={(event) => set("sku", event.target.value)} className="uppercase" />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium">Category</span>
          <select
            required
            value={values.categoryId}
            onChange={(event) => set("categoryId", event.target.value)}
            aria-invalid={Boolean(fieldErrors.categoryId) || undefined}
            aria-describedby={describedBy("categoryId")}
            className={`${selectClass} w-full`}
          >
            <option value="" disabled>
              {categories === undefined ? "Loading…" : "Choose a category"}
            </option>
            {categories?.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
                {category.archived ? " (archived)" : ""}
              </option>
            ))}
          </select>
          {fieldError("categoryId")}
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium">Pack size</span>
          <Input
            required
            placeholder="e.g. 500 g, 1 L, Pack of 6"
            value={values.packLabel}
            onChange={(event) => set("packLabel", event.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium">Price (₹, incl. taxes)</span>
          <Input
            required
            inputMode="decimal"
            value={values.price}
            onChange={(event) => set("price", event.target.value)}
            aria-invalid={Boolean(fieldErrors.price) || undefined}
            aria-describedby={describedBy("price")}
          />
          {fieldError("price")}
        </label>
        {!product && (
          <label className="space-y-1">
            <span className="text-xs font-medium">Opening stock (units)</span>
            <Input
              required
              inputMode="numeric"
              value={values.initialStock}
              onChange={(event) => set("initialStock", event.target.value)}
              aria-invalid={Boolean(fieldErrors.initialStock) || undefined}
              aria-describedby={describedBy("initialStock")}
            />
            {fieldError("initialStock")}
          </label>
        )}
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs font-medium">Description</span>
          <textarea
            rows={4}
            value={values.description}
            onChange={(event) => set("description", event.target.value)}
            className={textareaClass}
          />
        </label>
      </div>

      <FormError id={`${formId}-error`} message={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="px-4" disabled={saving}>
          {saving ? "Saving…" : product ? "Save changes" : "Create product"}
        </Button>
        {!product && (
          <Button type="button" variant="outline" size="lg" className="px-4" onClick={() => router.push("/admin/products")} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
