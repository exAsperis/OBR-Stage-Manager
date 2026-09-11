import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRef, useState, type FormEvent } from "react";

export interface GuardianLayerOption { id: string; name: string }

export function NameDialog({ title, initialValue = "", submitLabel, item = false, linkedLayerCount = 1,
  dependentLayerCount = 0, guardianOptions = [], nameOptions, onCancel, onSubmit }: {
  title: string;
  initialValue?: string;
  submitLabel: string;
  item?: boolean;
  linkedLayerCount?: number;
  dependentLayerCount?: number;
  guardianOptions?: GuardianLayerOption[];
  nameOptions?: string[];
  onCancel: () => void;
  onSubmit: (name: string, renameLinked: boolean) => Promise<void>;
}) {
  const [name, setName] = useState(initialValue);
  const [renameLinked, setRenameLinked] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(undefined);
    try {
      await onSubmit(name, renameLinked);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : item ? "Unable to rename the item." : "Unable to save the virtual layer name.");
      setSaving(false);
    }
  };

  const fieldLabel = item ? "Item name" : "Virtual layer name";
  return <Dialog
    open
    onClose={saving ? undefined : onCancel}
    fullWidth
    maxWidth="xs"
    aria-labelledby="name-dialog-title"
    TransitionProps={{ onEntered: () => nameInputRef.current?.focus() }}
  >
    <Stack component="form" onSubmit={(event) => void submit(event)}>
      <DialogTitle id="name-dialog-title">{title}</DialogTitle>
      <DialogContent>
        {nameOptions ? <Autocomplete
          freeSolo
          options={nameOptions}
          value={name}
          inputValue={name}
          disabled={saving}
          onChange={(_event, value) => setName(value ?? "")}
          onInputChange={(_event, value) => setName(value)}
          renderInput={(params) => <TextField
            {...params}
            autoFocus
            inputRef={nameInputRef}
            fullWidth
            margin="dense"
            label={fieldLabel}
            helperText="Use group: state for alternatives and / for guardian dependencies."
            inputProps={{ ...params.inputProps, "aria-label": fieldLabel }}
          />}
        /> : <TextField
          autoFocus
          inputRef={nameInputRef}
          fullWidth
          margin="dense"
          label={fieldLabel}
          value={name}
          disabled={saving}
          onChange={(event) => setName(event.target.value)}
          helperText={item ? undefined : "Use group: state for alternatives and / for guardian dependencies."}
          inputProps={{ "aria-label": fieldLabel }}
        />}
        {!item && guardianOptions.length > 0 && <TextField
          select
          fullWidth
          margin="dense"
          label="Prepend guardian layer"
          value=""
          disabled={saving}
          onChange={(event) => {
            const guardian = guardianOptions.find((option) => option.id === event.target.value);
            if (guardian) setName(`${guardian.name}/${name}`);
          }}
          InputLabelProps={{ shrink: true }}
          SelectProps={{ displayEmpty: true }}
          inputProps={{ "aria-label": "Prepend guardian layer" }}
        >
          <MenuItem value="" disabled>Select a virtual layer…</MenuItem>
          {guardianOptions.map((option) => <MenuItem key={option.id} value={option.id}>{option.name}</MenuItem>)}
        </TextField>}
        {!item && linkedLayerCount > 1 && <Stack>
          <FormControlLabel
            control={<Switch checked={renameLinked} disabled={saving} onChange={(event) => setRenameLinked(event.target.checked)} />}
            label={`Rename all ${linkedLayerCount} linked virtual layers`}
          />
          {dependentLayerCount > 0 && <Typography variant="caption" color="text.secondary" sx={{ ml: 6 }}>
            {dependentLayerCount} dependent layers will also be renamed to maintain their dependent relationship.
          </Typography>}
        </Stack>}
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={saving}>{submitLabel}</Button>
      </DialogActions>
    </Stack>
  </Dialog>;
}
