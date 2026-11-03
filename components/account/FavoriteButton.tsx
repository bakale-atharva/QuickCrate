"use client";

import { SignInButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { HeartIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAccount } from "@/components/AccountProvider";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

export default function FavoriteButton({ productId, productName }: { productId: Id<"products">; productName: string }) {
  const account = useAccount();

  if (account.status === "guest") {
    return (
      <SignInButton mode="modal">
        <Button variant="outline" size="lg" aria-label={`Sign in to save ${productName} to favorites`}>
          <HeartIcon aria-hidden />
          Save
        </Button>
      </SignInButton>
    );
  }

  if (account.status !== "ready") {
    return (
      <Button variant="outline" size="lg" disabled>
        <HeartIcon aria-hidden />
        Save
      </Button>
    );
  }

  return <AccountFavoriteButton key={account.clerkUserId} productId={productId} productName={productName} />;
}

function AccountFavoriteButton({ productId, productName }: { productId: Id<"products">; productName: string }) {
  const isFavorite = useQuery(api.favorites.isFavorite, { productId });
  const toggle = useMutation(api.favorites.toggle);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const result = await toggle({ productId });
      toast.success(result.isFavorite ? "Saved to favorites" : "Removed from favorites");
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't update favorites"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="lg"
      aria-pressed={isFavorite === true}
      aria-label={isFavorite ? `Remove ${productName} from favorites` : `Save ${productName} to favorites`}
      onClick={() => void handleClick()}
      disabled={isFavorite === undefined || pending}
    >
      <HeartIcon aria-hidden className={cn(isFavorite && "fill-primary text-primary")} />
      {isFavorite ? "Saved" : "Save"}
    </Button>
  );
}
