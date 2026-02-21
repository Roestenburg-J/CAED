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

type Provider = "openai" | "anthropic" | "gemini";

interface Settings {
  provider: Provider;
  model: string;
  openai_api_key: string;
  openai_organization: string;
  openai_project: string;
  anthropic_api_key: string;
  gemini_api_key: string;
  minhash_attribute_threshold: number;
  minhash_attribute_num_perm: number;
  minhash_dependency_threshold: number;
  minhash_dependency_num_perm: number;
}

const defaultSettings: Settings = {
  provider: "openai",
  model: "",
  openai_api_key: "",
  openai_organization: "",
  openai_project: "",
  anthropic_api_key: "",
  gemini_api_key: "",
  minhash_attribute_threshold: 0.5,
  minhash_attribute_num_perm: 128,
  minhash_dependency_threshold: 0.5,
  minhash_dependency_num_perm: 128,
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
        provider={settings.provider}
        model={settings.model}
        onProviderChange={(v: string) => handleChange("provider", v)}
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
        Anthropic (Claude)
      </Typography>
      <TextField
        fullWidth
        label="API Key"
        value={settings.anthropic_api_key}
        onChange={(e) => handleChange("anthropic_api_key", e.target.value)}
        type="password"
        sx={{ mb: 3 }}
      />

      <Divider sx={{ mb: 3 }} />

      <Typography variant="subtitle1" gutterBottom>
        Google (Gemini)
      </Typography>
      <TextField
        fullWidth
        label="API Key"
        value={settings.gemini_api_key}
        onChange={(e) => handleChange("gemini_api_key", e.target.value)}
        type="password"
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
