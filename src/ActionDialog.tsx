import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

export function ActionDialog({
  title,
  message,
  error,
  actionLabel,
  actionColor = "primary",
  busy = false,
  onCancel,
  onAction,
}: {
  title: string;
  message: string;
  error?: string;
  actionLabel?: string;
  actionColor?: "primary" | "error";
  busy?: boolean;
  onCancel: () => void;
  onAction?: () => void;
}) {
  const titleId = "action-dialog-title";
  const descriptionId = "action-dialog-description";
  return <Dialog
    open
    fullWidth
    maxWidth="xs"
    onClose={busy ? undefined : onCancel}
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
  >
    <DialogTitle id={titleId}>{title}</DialogTitle>
    <DialogContent>
      <DialogContentText id={descriptionId} sx={{ whiteSpace: "pre-line" }}>{message}</DialogContentText>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </DialogContent>
    <DialogActions>
      {onAction && <Button onClick={onCancel} disabled={busy}>Cancel</Button>}
      <Button autoFocus={!onAction} variant={onAction ? "contained" : "text"} color={actionColor} disabled={busy} onClick={onAction ?? onCancel}>
        {actionLabel ?? "OK"}
      </Button>
    </DialogActions>
  </Dialog>;
}
