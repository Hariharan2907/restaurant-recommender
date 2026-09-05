import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Chip } from "./Chip";
import { colors, type } from "@/lib/theme";
import { SearchRefinements } from "@/lib/discovery";

export function SearchFilters({
  value,
  onChange,
}: {
  value: SearchRefinements;
  onChange: (v: SearchRefinements) => void;
}) {
  const update = (next: Partial<SearchRefinements>) =>
    onChange({ ...value, ...next });
  return (
    <>
      <Group label="Cuisine">
        <Chip
          label="Any cuisine"
          selected={!value.cuisine}
          onPress={() => update({ cuisine: null })}
        />
        {[
          "Italian",
          "Japanese",
          "Mexican",
          "Indian",
          "Thai",
          "Mediterranean",
        ].map((c) => (
          <Chip
            key={c}
            label={c}
            selected={value.cuisine === c}
            onPress={() => update({ cuisine: value.cuisine === c ? null : c })}
          />
        ))}
      </Group>
      <Group label="Price · maximum tier">
        <Chip
          label="Any price"
          selected={!value.price}
          onPress={() => update({ price: null })}
        />
        {[1, 2, 3, 4].map((p) => (
          <Chip
            key={p}
            label={"$".repeat(p)}
            selected={value.price === p}
            onPress={() => update({ price: value.price === p ? null : p })}
          />
        ))}
      </Group>
      <Group
        label="Dietary requests"
        note="We include these in your search. Dietary suitability is not verified; confirm with the restaurant."
      >
        {["vegetarian", "vegan", "gluten_free"].map((d) => (
          <Chip
            key={d}
            label={d.replace("_", "-")}
            selected={value.dietary.includes(d)}
            onPress={() =>
              update({
                dietary: value.dietary.includes(d)
                  ? value.dietary.filter((i) => i !== d)
                  : [...value.dietary, d],
              })
            }
          />
        ))}
      </Group>
      <Group label="Minimum rating">
        {[null, 4, 4.5].map((r) => (
          <Chip
            key={String(r)}
            label={r ? `${r}+ stars` : "Any rating"}
            selected={value.rating === r}
            onPress={() => update({ rating: r })}
          />
        ))}
      </Group>
      <Group label="Search distance">
        {[1000, 3000, 5000, 10000].map((r) => (
          <Chip
            key={r}
            label={`${r / 1000} km`}
            selected={value.radius === r}
            onPress={() => update({ radius: r })}
          />
        ))}
      </Group>
      <Group label="Set the mood">
        {["cozy", "date night", "quick bite", "healthy", "celebration"].map(
          (m) => (
            <Chip
              key={m}
              label={m}
              selected={value.mood === m}
              onPress={() => update({ mood: value.mood === m ? null : m })}
            />
          ),
        )}
      </Group>
    </>
  );
}
function Group({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>{children}</View>
      {note && <Text style={styles.note}>{note}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  group: { gap: 12 },
  label: { ...type.inputLabel, color: colors.text },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  note: { ...type.meta, color: colors.textMuted, fontWeight: "400" },
});
