import React from "react";

import Box from "@mui/material/Box";
import CardHeader from "@mui/material/CardHeader";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import packageJson from "../package.json";

export function Header({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <>
      <CardHeader
        avatar={title ? <Box component="img" src="/icon-color.svg" alt="" aria-hidden sx={{ width: 24, height: 24 }} /> : undefined}
        title={title && <>{title}{" "}<Typography component="span" variant="caption" color="text.secondary">v{packageJson.version}</Typography></>}
        action={action}
        sx={{ bgcolor: "background.paper" }}
        titleTypographyProps={{
          sx: {
            fontSize: "1.125rem",
            fontWeight: "bold",
            lineHeight: "32px",
            color: "text.primary",
          },
        }}
      />
      <Divider variant={subtitle ? "middle" : "fullWidth"} />
      {subtitle && (
        <Typography
          variant="caption"
          sx={{
            px: 2,
            py: 1,
            display: "inline-block",
            color: "text.secondary",
          }}
        >
          {subtitle}
        </Typography>
      )}
    </>
  );
}
