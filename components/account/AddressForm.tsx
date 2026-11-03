"use client";

import { useMutation } from "convex/react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";

export type Address = Doc<"addresses">["address"];

const EMPTY: Address = {
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "India",
  phone: "",
};

const FIELDS: {
  name: keyof Address;
  label: string;
  autoComplete: string;
  required?: boolean;
  wide?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}[] = [
  { name: "fullName", label: "Full name", autoComplete: "name", required: true, wide: true },
  { name: "line1", label: "Address line 1", autoComplete: "address-line1", required: true, wide: true },
  { name: "line2", label: "Address line 2 (optional)", autoComplete: "address-line2", wide: true },
  { name: "city", label: "City", autoComplete: "address-level2", required: true },
  { name: "region", label: "State", autoComplete: "address-level1", required: true },
  { name: "postalCode", label: "PIN code", autoComplete: "postal-code", required: true, inputMode: "numeric" },
  { name: "country", label: "Country", autoComplete: "country-name", required: true },
  { name: "phone", label: "Phone (optional)", autoComplete: "tel", inputMode: "tel", wide: true },
];

export default function AddressForm({
  addressId,
  initial,
  canSetDefault = true,
  onSaved,
  onCancel,
  submitLabel = "Save address",
}: {
  addressId?: Id<"addresses">;
  initial?: Address;
  canSetDefault?: boolean;
  onSaved?: (id: Id<"addresses">) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const formId = useId();
  const create = useMutation(api.addresses.create);
  const update = useMutation(api.addresses.update);
  const [values, setValues] = useState<Address>({ ...EMPTY, ...initial });
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const address: Address = {
      ...values,
      line2: values.line2?.trim() || undefined,
      phone: values.phone?.trim() || undefined,
    };
    try {
      if (addressId) {
        await update({ id: addressId, address, ...(makeDefault ? { isDefault: true } : {}) });
        toast.success("Address updated");
        onSaved?.(addressId);
      } else {
        const id = await create({ address, isDefault: makeDefault });
        toast.success("Address saved");
        onSaved?.(id);
      }
    } catch (err) {
      setError(errorMessage(err, "Couldn't save this address"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-describedby={error ? `${formId}-error` : undefined}>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.name} className={field.wide ? "space-y-1 sm:col-span-2" : "space-y-1"}>
            <span className="text-xs font-medium">{field.label}</span>
            <Input
              name={field.name}
              autoComplete={field.autoComplete}
              inputMode={field.inputMode}
              required={field.required}
              value={values[field.name] ?? ""}
              onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
            />
          </label>
        ))}
      </div>
      {canSetDefault && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={makeDefault}
            onChange={(event) => setMakeDefault(event.target.checked)}
          />
          Make this my default address
        </label>
      )}
      {error && (
        <p id={`${formId}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="px-4" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="lg" className="px-4" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
