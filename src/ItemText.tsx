import ListItemText from "@mui/material/ListItemText";
import { Item } from "@owlbear-rodeo/sdk";
import { useMemo } from "react";
import { useOwlbearStore } from "./useOwlbearStore";
import { Textable, isTextable, toPlainText } from "./helpers";
import { OverflowTooltipText } from "./OverflowTooltipText";
import { itemDisplayName } from "./itemDisplay";

export function ItemText({ item }: { item: Item }) {
  const role = useOwlbearStore((state) => state.role);
  const name = useMemo(() => itemDisplayName(item, role), [item, role]);

  if (isTextable(item)) {
    return <TextableText item={item} name={name} zIndex={item.zIndex} />;
  } else {
    return (
      <ListItemText sx={{ minWidth: 0 }} primary={<OverflowTooltipText text={name} detail={`Z-index: ${item.zIndex}`} />} />
    );
  }
}

function TextableText({ item, name, zIndex }: { item: Textable; name: string; zIndex: number }) {
  const plainText = useMemo(() => {
    if (item.text.type === "PLAIN") {
      return item.text.plainText;
    } else {
      return toPlainText(item.text.richText);
    }
  }, [item.text]);

  return (
    <ListItemText
      sx={{ minWidth: 0 }}
      primary={<OverflowTooltipText text={plainText || name} detail={`Z-index: ${zIndex}`} />}
    />
  );
}
