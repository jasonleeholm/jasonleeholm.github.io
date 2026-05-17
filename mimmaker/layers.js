// ============================================================
//  layers.js  —  edit this file to configure the character creator
//  The index.html reads everything from here; you never need to
//  touch index.html.
// ============================================================

// ── Layer definitions ────────────────────────────────────────
//  Order = render order: LAST entry = TOP of stack (frontmost).
//  Add a new string here to add a new layer; remove one to drop it.
//  The two accessory layers are kept in sync automatically —
//  their names must start with "accessories_" to trigger that logic.

const LAYER_NAMES = [
  "background",
  "accessories_under",
  "legs",
  "arms",
  "torso",
  "head",
  "mouth",
  "eyeballs",
  "irises",
  "eyebrows",
  "accessories_over"
];

// ── Dummy palette ─────────────────────────────────────────────
//  Use EXACTLY these hex values in your SVG files.
//  base  → main body color
//  shade → shadows / darker areas
//  tint  → highlights / lighter areas
//  black (#000000) and white (#ffffff) pass through unchanged.

const DUMMY_PALETTE = {
  base:  "#999",
  shade: "#444",
  tint:  "#ccc"
};

// ── Default starting palette shown to the user ────────────────
//  Change these to whatever looks good as a first impression.

const DEFAULT_PALETTE = {
  base:  "#ff6600",
  shade: "#883300",
  tint:  "#ffbb77"
};
