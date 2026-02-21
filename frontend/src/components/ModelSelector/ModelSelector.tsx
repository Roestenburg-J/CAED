import React from "react";
import { Box, FormControl, InputLabel, MenuItem, Select } from "@mui/material";

export const MODEL_OPTIONS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: [
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
  ],
  gemini: [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ],
};

interface ModelSelectorProps {
  provider: string;
  model: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  disabled?: boolean;
  sx?: object;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  provider,
  model,
  onProviderChange,
  onModelChange,
  disabled = false,
  sx,
}) => {
  const models = MODEL_OPTIONS[provider] ?? [];
  // If the current model is not in the predefined list, include it so the Select doesn't show blank
  const availableModels = models.includes(model) ? models : [model, ...models];

  return (
    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", ...sx }}>
      <FormControl sx={{ minWidth: 160 }} disabled={disabled}>
        <InputLabel>Provider</InputLabel>
        <Select
          value={provider}
          label="Provider"
          onChange={(e) => {
            const newProvider = e.target.value;
            onProviderChange(newProvider);
            onModelChange(MODEL_OPTIONS[newProvider]?.[0] ?? "");
          }}
        >
          <MenuItem value="openai">OpenAI</MenuItem>
          <MenuItem value="anthropic">Anthropic (Claude)</MenuItem>
          <MenuItem value="gemini">Google (Gemini)</MenuItem>
        </Select>
      </FormControl>

      <FormControl sx={{ minWidth: 260 }} disabled={disabled}>
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
    </Box>
  );
};

export default ModelSelector;
