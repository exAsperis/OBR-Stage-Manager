import Box from "@mui/material/Box";
import packageJson from "../../../package.json";

type StageIconProps = {
  fontSize?: "inherit" | "small" | "medium" | "large";
};

const fontSizes = { inherit: "inherit", small: 20, medium: 24, large: 35 } as const;

function StageIcon({ file, label, fontSize = "medium" }: StageIconProps & { file: string; label: string }) {
  const url = `/${file}.svg?v=${packageJson.version}`;
  return <Box
    component="span"
    role="img"
    aria-label={label}
    sx={{
      display: "inline-block",
      flexShrink: 0,
      width: "1em",
      height: "1em",
      fontSize: fontSizes[fontSize],
      bgcolor: "currentColor",
      mask: `url("${url}") center / contain no-repeat`,
      WebkitMask: `url("${url}") center / contain no-repeat`,
    }}
  />;
}

export function OnStageIcon(props: StageIconProps) {
  return <StageIcon {...props} file="on-stage" label="On stage" />;
}

export function OffStageIcon(props: StageIconProps) {
  return <StageIcon {...props} file="off-stage" label="Off stage" />;
}
