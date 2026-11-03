"use client";

import { useMutation, useQuery } from "convex/react";
import { MapPinIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import AddressForm from "@/components/account/AddressForm";
import RequireAccount from "@/components/account/RequireAccount";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";

export default function AddressesView() {
  return (
    <RequireAccount message="Sign in to manage your delivery addresses." fallback={<AddressesSkeleton />}>
      {() => <Addresses />}
    </RequireAccount>
  );
}

function Addresses() {
  const addresses = useQuery(api.addresses.list, {});
  const [editing, setEditing] = useState<Id<"addresses"> | "new" | null>(null);

  if (addresses === undefined) return <AddressesSkeleton />;

  return (
    <div className="space-y-4">
      {addresses.length === 0 && editing !== "new" && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <MapPinIcon aria-hidden className="size-10 text-muted-foreground" strokeWidth={1.25} />
          <h3 className="font-medium">No saved addresses</h3>
          <p className="text-sm text-muted-foreground">Save an address to check out faster.</p>
        </div>
      )}
      {addresses.length > 0 && (
        <ul className="space-y-3">
          {addresses.map((doc) => (
            <li key={doc._id} className="rounded-xl border bg-card p-4">
              {editing === doc._id ? (
                <AddressForm
                  addressId={doc._id}
                  initial={doc.address}
                  canSetDefault={!doc.isDefault}
                  onSaved={() => setEditing(null)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <AddressCard doc={doc} onEdit={() => setEditing(doc._id)} />
              )}
            </li>
          ))}
        </ul>
      )}
      {editing === "new" ? (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-4 font-medium">New address</h3>
          <AddressForm onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} />
        </div>
      ) : (
        <Button variant="outline" size="lg" onClick={() => setEditing("new")}>
          <PlusIcon aria-hidden />
          Add address
        </Button>
      )}
    </div>
  );
}

function AddressCard({ doc, onEdit }: { doc: Doc<"addresses">; onEdit: () => void }) {
  const setDefault = useMutation(api.addresses.setDefault);
  const remove = useMutation(api.addresses.deleteAddress);
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const a = doc.address;

  async function run(action: () => Promise<unknown>, success: string) {
    setPending(true);
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <address className="space-y-0.5 text-sm text-muted-foreground not-italic">
        <span className="flex items-center gap-2 font-medium text-foreground">
          {a.fullName}
          {doc.isDefault && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-normal text-muted-foreground">Default</span>
          )}
        </span>
        <span className="block">{[a.line1, a.line2].filter(Boolean).join(", ")}</span>
        <span className="block">
          {a.city}, {a.region} {a.postalCode}, {a.country}
        </span>
        {a.phone && <span className="block">{a.phone}</span>}
      </address>
      <div className="flex flex-wrap gap-2">
        {confirmingDelete ? (
          <>
            <Button variant="destructive" disabled={pending} onClick={() => void run(() => remove({ id: doc._id }), "Address deleted")}>
              Delete address
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setConfirmingDelete(false)}>
              Keep
            </Button>
          </>
        ) : (
          <>
            {!doc.isDefault && (
              <Button variant="outline" disabled={pending} onClick={() => void run(() => setDefault({ id: doc._id }), "Default address updated")}>
                Make default
              </Button>
            )}
            <Button variant="outline" disabled={pending} onClick={onEdit}>
              Edit
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function AddressesSkeleton() {
  return (
    <div className="space-y-3" aria-busy aria-label="Loading addresses">
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}
