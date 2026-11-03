import { v } from "convex/values";
import { MutationCtx, internalMutation, mutation } from "./_generated/server";
import { requireAdmin } from "./auth";
import { Id } from "./_generated/dataModel";

interface CategoryFixture {
  name: string;
  slug: string;
  archived: boolean;
}

interface ProductFixture {
  categorySlug: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  packLabel: string;
  pricePaise: bigint;
  stock: bigint;
  archived: boolean;
}

export const FIXTURE_CATEGORIES: CategoryFixture[] = [
  {
    name: "Dairy & Bakery",
    slug: "dairy-bakery",
    archived: false,
  },
  {
    name: "Fruits & Vegetables",
    slug: "fruits-vegetables",
    archived: false,
  },
  {
    name: "Staples & Grains",
    slug: "staples-grains",
    archived: false,
  },
  {
    name: "Snacks & Beverages",
    slug: "snacks-beverages",
    archived: false,
  },
  {
    name: "Personal & Home Care",
    slug: "personal-home-care",
    archived: false,
  },
];

export const FIXTURE_PRODUCTS: ProductFixture[] = [
  // Dairy & Bakery
  {
    categorySlug: "dairy-bakery",
    name: "Farm Fresh Whole Milk 1L",
    slug: "farm-fresh-whole-milk-1l",
    sku: "MILK-WHOLE-1L",
    description: "Pasteurized, homogenized fresh whole milk rich in calcium and vitamin D.",
    packLabel: "1 L",
    pricePaise: BigInt(6500),
    stock: BigInt(50),
    archived: false,
  },
  {
    categorySlug: "dairy-bakery",
    name: "Farm Fresh Cow Milk 500ml",
    slug: "farm-fresh-cow-milk-500ml",
    sku: "MILK-COW-500ML",
    description: "Light and nutritious fresh cow milk for everyday use.",
    packLabel: "500 ml",
    pricePaise: BigInt(3400),
    stock: BigInt(50),
    archived: false,
  },
  {
    categorySlug: "dairy-bakery",
    name: "Artisanal Whole Wheat Bread 400g",
    slug: "artisanal-whole-wheat-bread-400g",
    sku: "BREAD-WHEAT-400G",
    description: "Freshly baked 100% whole wheat bread loaf with high fiber content.",
    packLabel: "400 g",
    pricePaise: BigInt(4500),
    stock: BigInt(40),
    archived: false,
  },
  {
    categorySlug: "dairy-bakery",
    name: "Salted Table Butter 100g",
    slug: "salted-table-butter-100g",
    sku: "BUTTER-SALTED-100G",
    description: "Creamy pasteurized salted table butter made from fresh cream.",
    packLabel: "100 g",
    pricePaise: BigInt(5800),
    stock: BigInt(60),
    archived: false,
  },
  {
    categorySlug: "dairy-bakery",
    name: "Natural Plain Curd 500g",
    slug: "natural-plain-curd-500g",
    sku: "CURD-PLAIN-500G",
    description: "Thick, probiotic natural curd made from farm-fresh cow milk.",
    packLabel: "500 g",
    pricePaise: BigInt(4000),
    stock: BigInt(40),
    archived: false,
  },
  {
    categorySlug: "dairy-bakery",
    name: "Fresh Malai Paneer 200g",
    slug: "fresh-malai-paneer-200g",
    sku: "PANEER-MALAI-200G",
    description: "Soft, succulent cottage cheese cubes packed fresh.",
    packLabel: "200 g",
    pricePaise: BigInt(9500),
    stock: BigInt(30),
    archived: false,
  },

  // Fruits & Vegetables
  {
    categorySlug: "fruits-vegetables",
    name: "Alphonso Mangoes 1kg",
    slug: "alphonso-mangoes-1kg",
    sku: "MANGO-ALPH-1KG",
    description: "Hand-picked, naturally ripened sweet Alphonso mangoes.",
    packLabel: "1 kg",
    pricePaise: BigInt(45000),
    stock: BigInt(25),
    archived: false,
  },
  {
    categorySlug: "fruits-vegetables",
    name: "Red Crisp Apples 1kg",
    slug: "red-crisp-apples-1kg",
    sku: "APPLE-RED-1KG",
    description: "Sweet, juicy, and crisp mountain apples.",
    packLabel: "1 kg",
    pricePaise: BigInt(18000),
    stock: BigInt(35),
    archived: false,
  },
  {
    categorySlug: "fruits-vegetables",
    name: "Robusta Bananas 1 Dozen",
    slug: "robusta-bananas-1-dozen",
    sku: "BANANA-ROB-1DOZ",
    description: "Naturally ripened Robusta bananas rich in potassium.",
    packLabel: "12 pcs",
    pricePaise: BigInt(6000),
    stock: BigInt(40),
    archived: false,
  },
  {
    categorySlug: "fruits-vegetables",
    name: "Farm Fresh Tomatoes 1kg",
    slug: "farm-fresh-tomatoes-1kg",
    sku: "TOMATO-FRESH-1KG",
    description: "Ripe, firm red salad tomatoes grown on local farms.",
    packLabel: "1 kg",
    pricePaise: BigInt(3500),
    stock: BigInt(50),
    archived: false,
  },
  {
    categorySlug: "fruits-vegetables",
    name: "Red Onions 1kg",
    slug: "red-onions-1kg",
    sku: "ONION-RED-1KG",
    description: "Pungent, dry, medium-sized cooking onions.",
    packLabel: "1 kg",
    pricePaise: BigInt(4000),
    stock: BigInt(60),
    archived: false,
  },
  {
    categorySlug: "fruits-vegetables",
    name: "Fresh Potatoes 1kg",
    slug: "fresh-potatoes-1kg",
    sku: "POTATO-FRESH-1KG",
    description: "Starchy, firm potatoes ideal for baking, frying, and curries.",
    packLabel: "1 kg",
    pricePaise: BigInt(3000),
    stock: BigInt(60),
    archived: false,
  },

  // Staples & Grains
  {
    categorySlug: "staples-grains",
    name: "Premium Basmati Rice 1kg",
    slug: "premium-basmati-rice-1kg",
    sku: "RICE-BASMATI-1KG",
    description: "Long grain, aged aromatic basmati rice for daily meals and biryani.",
    packLabel: "1 kg",
    pricePaise: BigInt(14000),
    stock: BigInt(50),
    archived: false,
  },
  {
    categorySlug: "staples-grains",
    name: "Premium Basmati Rice 5kg",
    slug: "premium-basmati-rice-5kg",
    sku: "RICE-BASMATI-5KG",
    description: "Value pack of long grain aged aromatic basmati rice.",
    packLabel: "5 kg",
    pricePaise: BigInt(65000),
    stock: BigInt(20),
    archived: false,
  },
  {
    categorySlug: "staples-grains",
    name: "Sharbati Whole Wheat Atta 5kg",
    slug: "sharbati-whole-wheat-atta-5kg",
    sku: "ATTA-WHEAT-5KG",
    description: "Stone-ground chakki whole wheat flour for soft, fluffy rotis.",
    packLabel: "5 kg",
    pricePaise: BigInt(27500),
    stock: BigInt(30),
    archived: false,
  },
  {
    categorySlug: "staples-grains",
    name: "Unpolished Toor Dal 1kg",
    slug: "unpolished-toor-dal-1kg",
    sku: "DAL-TOOR-1KG",
    description: "Protein-rich unpolished pigeon pea lentils without artificial color.",
    packLabel: "1 kg",
    pricePaise: BigInt(16500),
    stock: BigInt(40),
    archived: false,
  },
  {
    categorySlug: "staples-grains",
    name: "Cold Pressed Mustard Oil 1L",
    slug: "cold-pressed-mustard-oil-1l",
    sku: "OIL-MUSTARD-1L",
    description: "Kachi ghani raw cold-pressed mustard oil with natural pungency.",
    packLabel: "1 L",
    pricePaise: BigInt(19000),
    stock: BigInt(25),
    archived: false,
  },

  // Snacks & Beverages
  {
    categorySlug: "snacks-beverages",
    name: "Assam Gold CTC Tea 250g",
    slug: "assam-gold-ctc-tea-250g",
    sku: "TEA-ASSAM-250G",
    description: "Rich, brisk, aromatic black tea granules from select Assam gardens.",
    packLabel: "250 g",
    pricePaise: BigInt(12000),
    stock: BigInt(45),
    archived: false,
  },
  {
    categorySlug: "snacks-beverages",
    name: "South Indian Filter Coffee 200g",
    slug: "south-indian-filter-coffee-200g",
    sku: "COFFEE-FILTER-200G",
    description: "80:20 roasted coffee and chicory blend for authentic filter coffee.",
    packLabel: "200 g",
    pricePaise: BigInt(16000),
    stock: BigInt(30),
    archived: false,
  },
  {
    categorySlug: "snacks-beverages",
    name: "Roasted Salted California Almonds 200g",
    slug: "roasted-salted-california-almonds-200g",
    sku: "ALMONDS-ROAST-200G",
    description: "Slow-roasted crunchy California almonds seasoned with Himalayan pink salt.",
    packLabel: "200 g",
    pricePaise: BigInt(24000),
    stock: BigInt(35),
    archived: false,
  },
  {
    categorySlug: "snacks-beverages",
    name: "Spicy Masala Potato Chips 150g",
    slug: "spicy-masala-potato-chips-150g",
    sku: "CHIPS-MASALA-150G",
    description: "Thin, crispy golden potato wafers tossed in a fiery Indian masala blend.",
    packLabel: "150 g",
    pricePaise: BigInt(4000),
    stock: BigInt(50),
    archived: false,
  },

  // Personal & Home Care
  {
    categorySlug: "personal-home-care",
    name: "Eco-Friendly Lemon Dishwash Gel 500ml",
    slug: "eco-friendly-lemon-dishwash-gel-500ml",
    sku: "DISHWASH-LEMON-500ML",
    description: "Tough on grease, gentle on hands with natural lemon extracts.",
    packLabel: "500 ml",
    pricePaise: BigInt(8500),
    stock: BigInt(40),
    archived: false,
  },
  {
    categorySlug: "personal-home-care",
    name: "Herbal Neem & Aloe Handwash 250ml",
    slug: "herbal-neem-aloe-handwash-250ml",
    sku: "HANDWASH-NEEM-250ML",
    description: "Antibacterial protection with soothing aloe vera and neem extracts.",
    packLabel: "250 ml",
    pricePaise: BigInt(6500),
    stock: BigInt(50),
    archived: false,
  },
];

async function executeSeeding(
  ctx: MutationCtx,
  resetStock: boolean
): Promise<{
  categoriesCreated: number;
  categoriesUpdated: number;
  productsCreated: number;
  productsUpdated: number;
  totalCategories: number;
  totalProducts: number;
}> {
  let categoriesCreated = 0;
  let categoriesUpdated = 0;
  let productsCreated = 0;
  let productsUpdated = 0;

  const categoryMap = new Map<string, Id<"categories">>();

  // 1. Seed Categories idempotently
  for (const cat of FIXTURE_CATEGORIES) {
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", cat.slug))
      .unique();

    if (existing) {
      await ctx.db.patch("categories", existing._id, {
        name: cat.name,
        archived: cat.archived,
      });
      categoryMap.set(cat.slug, existing._id);
      categoriesUpdated++;
    } else {
      const id = await ctx.db.insert("categories", {
        name: cat.name,
        slug: cat.slug,
        archived: cat.archived,
      });
      categoryMap.set(cat.slug, id);
      categoriesCreated++;
    }
  }

  // 2. Seed Products idempotently
  for (const prod of FIXTURE_PRODUCTS) {
    const categoryId = categoryMap.get(prod.categorySlug);
    if (!categoryId) continue;

    const existing = await ctx.db
      .query("products")
      .withIndex("by_sku", (q) => q.eq("sku", prod.sku))
      .unique();

    if (existing) {
      const patchData: {
        categoryId: Id<"categories">;
        name: string;
        slug: string;
        description: string;
        packLabel: string;
        pricePaise: bigint;
        archived: boolean;
        stock?: bigint;
      } = {
        categoryId,
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        packLabel: prod.packLabel,
        pricePaise: prod.pricePaise,
        archived: prod.archived,
      };
      if (resetStock) {
        patchData.stock = prod.stock;
      }
      await ctx.db.patch("products", existing._id, patchData);
      productsUpdated++;
    } else {
      await ctx.db.insert("products", {
        categoryId,
        name: prod.name,
        slug: prod.slug,
        sku: prod.sku,
        description: prod.description,
        packLabel: prod.packLabel,
        pricePaise: prod.pricePaise,
        stock: prod.stock,
        archived: prod.archived,
      });
      productsCreated++;
    }
  }

  const allCategories = await ctx.db.query("categories").collect();
  const allProducts = await ctx.db.query("products").collect();

  return {
    categoriesCreated,
    categoriesUpdated,
    productsCreated,
    productsUpdated,
    totalCategories: allCategories.length,
    totalProducts: allProducts.length,
  };
}

export const seedDevelopmentFixtures = mutation({
  args: {
    resetStock: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Check if categories already exist; if so, require admin privileges
    const existingCats = await ctx.db.query("categories").take(1);
    if (existingCats.length > 0) {
      await requireAdmin(ctx);
    }

    return await executeSeeding(ctx, args.resetStock ?? false);
  },
});

export const seedInternalFixtures = internalMutation({
  args: {
    resetStock: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await executeSeeding(ctx, args.resetStock ?? false);
  },
});
