import React from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";

export const MODEL_OPTIONS: string[] = [
  "gpt-5",       "gpt-5-mini",
  "gpt-5.1",     "gpt-5.1-mini",
  "gpt-5.2",     "gpt-5.2-mini",
  "gpt-5.3",     "gpt-5.3-mini",
  "gpt-5.4",     "gpt-5.4-mini",    "gpt-5.4-nano",
  "gpt-4o",      "gpt-4o-mini",
  "gpt-4-turbo", "gpt-3.5-turbo",
];

interface ModelSelectorProps {
  model: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
  sx?: object;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  model,
  onModelChange,
  disabled = false,
  sx,
}) => {
  const availableModels = MODEL_OPTIONS.includes(model)
    ? MODEL_OPTIONS
    : [model, ...MODEL_OPTIONS];

  return (
    <FormControl sx={{ minWidth: 260, ...sx }} disabled={disabled}>
      <InputLabel>Model</InputLabel>
      <Select
        value={availableModels.includes(model) ? model : availableModels[0] ?? ""}
        label="Model"
        onChange={(e) => onModelChange(e.target.value)}
      >
        {availableModels.map((m) => (
          <MenuItem key={m} value={m}>
            {m}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default ModelSelector;
