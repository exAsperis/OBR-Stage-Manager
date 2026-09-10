import { type Item, isShape } from "@owlbear-rodeo/sdk";
import { capitalize, isTextable, toPlainText } from "./helpers";

export function itemDisplayName(item: Item, role: "GM" | "PLAYER") {
  if (role !== "PLAYER") return item.name;
  return isShape(item) ? capitalize(item.shapeType) : capitalize(item.type);
}

export function itemDisplayText(item: Item, role: "GM" | "PLAYER") {
  const name = itemDisplayName(item, role);
  return isTextable(item) ? (item.text.type === "PLAIN" ? item.text.plainText : toPlainText(item.text.richText)) || name : name;
}
