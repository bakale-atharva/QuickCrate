import Image from "next/image";
import { cn } from "@/lib/utils";

// Products without an uploaded image (including the development fixtures)
// show a neutral placeholder labelled with the product name.
function placeholderUrl(name: string) {
  return `https://placehold.co/600x600/f4f4f5/71717a/png?font=roboto&text=${encodeURIComponent(name)}`;
}

export default function ProductImage({
  src,
  name,
  alt,
  sizes,
  className,
  priority,
}: {
  src: string | null;
  name: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative aspect-square overflow-hidden rounded-lg bg-muted", className)}>
      <Image
        src={src ?? placeholderUrl(name)}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
