"use client";

import { useMutation } from "convex/react";
import { ImageUpIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import ProductImage from "@/components/client/ProductImage";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

// Uploads straight to Convex storage and reports the new storage ID. The
// product mutation re-validates that the stored file is an image.
export default function ImageUpload({
  name,
  currentUrl,
  onUploaded,
  disabled,
}: {
  name: string;
  currentUrl: string | null;
  onUploaded: (storageId: Id<"_storage">, previewUrl: string) => Promise<void> | void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.products.generateUploadUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!ACCEPT.split(",").includes(file.type)) {
      setError("Choose a JPEG, PNG, WebP, or AVIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Images must be 5 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Upload failed. Try again.");
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      await onUploaded(storageId, URL.createObjectURL(file));
    } catch (err) {
      setError(errorMessage(err, "Upload failed. Try again."));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-start gap-4">
      {currentUrl?.startsWith("blob:") ? (
        // Local previews are object URLs, which next/image cannot optimize.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt="" className="size-24 shrink-0 rounded-lg bg-muted object-cover" />
      ) : (
        <ProductImage src={currentUrl} name={name || "No image"} alt="" sizes="96px" className="size-24 shrink-0" />
      )}
      <div className="space-y-2 text-sm">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button type="button" variant="outline" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
          <ImageUpIcon aria-hidden />
          {uploading ? "Uploading…" : currentUrl ? "Replace image" : "Upload image"}
        </Button>
        <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, or AVIF, up to 5 MB.</p>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
