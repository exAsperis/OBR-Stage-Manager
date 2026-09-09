import { Outliner } from "./Outliner";
import { Header } from "./Header";
import { useOwlbearStoreSync } from "./useOwlbearStoreSync";
import { useOwlbearStore } from "./useOwlbearStore";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";

export function App() {
  const roleReady = useOwlbearStoreSync();

  const sceneReady = useOwlbearStore((state) => state.sceneReady);
  const role = useOwlbearStore((state) => state.role);

  if (!roleReady) return null;

  if (role !== "GM") {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Stage Manager is a GM-only tool.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Check out{" "}
          <Link
            href="https://www.ex-asperis.com/"
            target="_blank"
            rel="noreferrer"
          >
            www.ex-asperis.com
          </Link>{" "}
          for other OBR extensions.
        </Typography>
      </Box>
    );
  }

  if (sceneReady) {
    return <Outliner />;
  } else {
    return (
      <Header title="Stage Manager" subtitle="Open a scene to manage it" />
    );
  }
}
