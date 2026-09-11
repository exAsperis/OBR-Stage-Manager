import type { Item } from "@owlbear-rodeo/sdk";
import { formatVirtualLayerPath, parseVirtualLayerPath } from "./virtualLayerName.ts";
import { normalizedVirtualLayerName, type VirtualLayerDefinition } from "./virtualLayers.ts";

function currentLayerStatePrefix(name: string) {
  const path = parseVirtualLayerPath(name);
  const finalSegment = path?.segments[path.segments.length - 1];
  if (!path || !finalSegment || finalSegment.kind !== "state") return undefined;
  const prefix = path.segments.slice(0, -1);
  return `${prefix.length ? `${formatVirtualLayerPath({ segments: prefix })}/` : ""}${finalSegment.group}: `;
}

export function virtualLayerNameSuggestions(definitions: VirtualLayerDefinition[], currentLayer: Item["layer"]) {
  const suggestions = definitions.flatMap((definition) => {
    if (definition.obrLayer !== currentLayer) return [definition.name];
    const prefix = currentLayerStatePrefix(definition.name);
    return prefix === undefined ? [] : [prefix];
  });
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const identity = normalizedVirtualLayerName(suggestion);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
