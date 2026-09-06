const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const source = fs.readFileSync(
  path.join(__dirname, "../lib/discovery.ts"),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
});
const scope = { exports: {} };
vm.runInNewContext(compiled.outputText, scope);
const {
  buildQuery,
  refinementCount,
  DEFAULT_REFINEMENTS,
  distanceMeters,
  formatDistance,
  restaurantSummary,
} = scope.exports;

test("plain searches preserve the user query without adding restrictions", () => {
  assert.equal(buildQuery("  cozy ramen  ", DEFAULT_REFINEMENTS), "cozy ramen");
  assert.equal(refinementCount(DEFAULT_REFINEMENTS), 0);
});
test("refinements reach the existing natural-language parser and do not mutate defaults", () => {
  const choices = {
    ...DEFAULT_REFINEMENTS,
    price: 2,
    rating: 4.5,
    dietary: ["gluten_free"],
    mood: "date night",
    cuisine: "Italian",
    radius: 5000,
  };
  assert.equal(
    buildQuery("quiet dinner", choices),
    "quiet dinner, Italian, price at most $$, rated at least 4.5 stars, gluten free, date night",
  );
  assert.equal(refinementCount(choices), 6);
  assert.equal(DEFAULT_REFINEMENTS.dietary.length, 0);
  assert.equal(DEFAULT_REFINEMENTS.radius, 3000);
});
test("dietary-only searches remain usable", () => {
  assert.equal(
    buildQuery("", { ...DEFAULT_REFINEMENTS, dietary: ["vegan"] }),
    "vegan",
  );
});
test("distance displays known great-circle distances without changing ranking", () => {
  assert.equal(distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0);
  assert.ok(
    Math.abs(distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111195) <
      2,
  );
  assert.equal(distanceMeters({ lat: NaN, lng: 0 }, { lat: 0, lng: 0 }), null);
  assert.equal(formatDistance(0), "0.0 mi");
  assert.equal(formatDistance(50), "<0.1 mi");
  assert.equal(formatDistance(1609.344), "1.0 mi");
  assert.equal(formatDistance(3000), "1.9 mi");
  assert.equal(formatDistance(840), "0.5 mi");
  assert.equal(formatDistance(2350), "1.5 mi");
});
test("missing match explanations fall back to available facts only", () => {
  assert.equal(
    restaurantSummary({
      rating: 4.5,
      user_ratings_total: 12,
      cuisine: null,
      price_tier: null,
    }),
    "Rated 4.5 out of 5 from 12 diner reviews.",
  );
  assert.ok(
    !restaurantSummary({
      rating: null,
      user_ratings_total: null,
      cuisine: null,
      price_tier: null,
    }).includes("personalized"),
  );
});
