import { createContext, useContext } from "react";
import { PALETTES, type Palette } from "./layout";

export type Theme = "dark" | "light";

export const PaletteContext = createContext<Palette>(PALETTES.dark);

/** The 3D colours for the current theme. */
export function useColors(): Palette {
  return useContext(PaletteContext);
}
