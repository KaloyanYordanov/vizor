export type Region = { x: number; y: number; width: number; height: number };
export const activeStates = [
  "QUEUED",
  "PREPARING",
  "GENERATING",
  "SAVING",
] as const;
export const styles = [
  { id: "contemporary" },
  { id: "scandinavian" },
  { id: "japandi" },
  { id: "industrial" },
  { id: "modern-classic" },
  { id: "modern-luxury" },
] as const;
export type StyleId = (typeof styles)[number]["id"];
export function isStyle(value: unknown): value is StyleId {
  return styles.some((s) => s.id === value);
}
export type PublicVisualisation = {
  id: string;
  label: string;
  styleId: string;
  imageUrl: string;
  thumbnailUrl: string;
};
