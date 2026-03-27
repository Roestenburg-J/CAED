"use client";
import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Divider,
  Alert,
  CircularProgress,
} from "@mui/material";
import { getSettings, updateSettings } from "@/services/Utils/Utils";
import ModelSelector from "@/components/ModelSelector/ModelSelector";

interface Settings {
  model: string;
  openai_api_key: string;
  openai_organization: string;
  openai_project: string;
  minhash_attribute_threshold: number;
  minhash_attribute_num_perm: number;
  minhash_dependency_threshold: number;
  minhash_dependency_num_perm: number;
  max_batch_tokens: number;
}

const defaultSettings: Settings = {
  model: "",
  openai_api_key: "",
  openai_organization: "",
  openai_project: "",
  minhash_attribute_threshold: 0.5,
  minhash_attribute_num_perm: 128,
  minhash_dependency_threshold: 0.5,
  minhash_dependency_num_perm: 128,
  max_batch_tokens: 3000,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getSettings()
      .then((data) => setSettings({ ...defaultSettings, ...data }))
      .catch(() => setMessage({ type: "error", text: "Failed to load settings." }))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field: keyof Settings, value: string | number) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateSettings(settings);
      setMessage({ type: "success", text: "Settings saved successfully." });
    } catch {
      setMessage({ type: "error", text: "Failed to save settings." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", mt: 10, p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Settings
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <ModelSelector
        model={settings.model}
        onModelChange={(v: string) => handleChange("model", v)}
        sx={{ mb: 3 }}
      />

      <Divider sx={{ mb: 3 }} />

      <Typography variant="subtitle1" gutterBottom>
        OpenAI
      </Typography>
      <TextField
        fullWidth
        label="API Key"
        value={settings.openai_api_key}
        onChange={(e) => handleChange("openai_api_key", e.target.value)}
        type="password"
        sx={{ mb: 2 }}
      />
      <TextField
        fullWidth
        label="Organization (optional)"
        value={settings.openai_organization}
        onChange={(e) => handleChange("openai_organization", e.target.value)}
        sx={{ mb: 2 }}
      />
      <TextField
        fullWidth
        label="Project (optional)"
        value={settings.openai_project}
        onChange={(e) => handleChange("openai_project", e.target.value)}
        sx={{ mb: 3 }}
      />

      <Divider sx={{ mb: 3 }} />

      <Typography variant="subtitle1" gutterBottom>
        MinHash – Attribute Bucketing
      </Typography>
      <TextField
        fullWidth
        label="Similarity Threshold"
        value={settings.minhash_attribute_threshold}
        onChange={(e) => handleChange("minhash_attribute_threshold", parseFloat(e.target.value))}
        type="number"
        inputProps={{ min: 0, max: 1, step: 0.05 }}
        helperText="Jaccard similarity threshold for grouping unique column values (0–1)"
        sx={{ mb: 2 }}
      />
      <TextField
        fullWidth
        label="Number of Permutations"
        value={settings.minhash_attribute_num_perm}
        onChange={(e) => handleChange("minhash_attribute_num_perm", parseInt(e.target.value, 10))}
        type="number"
        inputProps={{ min: 1, step: 1 }}
        helperText="Higher values increase accuracy but use more memory"
        sx={{ mb: 3 }}
      />

      <Divider sx={{ mb: 3 }} />

      <Typography variant="subtitle1" gutterBottom>
        MinHash – Dependency Bucketing
      </Typography>
      <TextField
        fullWidth
        label="Similarity Threshold"
        value={settings.minhash_dependency_threshold}
        onChange={(e) => handleChange("minhash_dependency_threshold", parseFloat(e.target.value))}
        type="number"
        inputProps={{ min: 0, max: 1, step: 0.05 }}
        helperText="Jaccard similarity threshold for grouping dataset rows (0–1)"
        sx={{ mb: 2 }}
      />
      <TextField
        fullWidth
        label="Number of Permutations"
        value={settings.minhash_dependency_num_perm}
        onChange={(e) => handleChange("minhash_dependency_num_perm", parseInt(e.target.value, 10))}
        type="number"
        inputProps={{ min: 1, step: 1 }}
        helperText="Higher values increase accuracy but use more memory"
        sx={{ mb: 3 }}
      />

      <Divider sx={{ mb: 3 }} />

      <Typography variant="subtitle1" gutterBottom>
        Batching
      </Typography>
      <TextField
        fullWidth
        label="Max Tokens Per Batch"
        value={settings.max_batch_tokens}
        onChange={(e) => handleChange("max_batch_tokens", parseInt(e.target.value, 10))}
        type="number"
        inputProps={{ min: 500, step: 500 }}
        helperText="Estimated token budget for the data payload in each LLM call. Larger values mean fewer calls but bigger requests (default: 3000)."
        sx={{ mb: 3 }}
      />

      <Button
        variant="contained"
        onClick={handleSave}
        disabled={saving}
        sx={{ minWidth: 120 }}
      >
        {saving ? <CircularProgress size={20} color="inherit" /> : "Save"}
      </Button>
    </Box>
  );
}
