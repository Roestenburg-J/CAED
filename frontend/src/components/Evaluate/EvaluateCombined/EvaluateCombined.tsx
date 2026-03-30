import React from "react";
import styles from "./EvaluateCombined.module.css";
import { Box, CircularProgress, Typography } from "@mui/material";

interface ClassOutput {
  [key: string]: number | string;
}

interface CombinedResult {
  true_positives: ClassOutput[];
  false_positives: ClassOutput[];
  false_negatives: ClassOutput[];
  metrics: {
    accuracy: string;
    precision: string;
    recall: string;
    f1_score: string;
    roc_auc: string;
    predicted_positives_count: string;
  };
}

interface EvaluateCombinedProps {
  combinedResult: CombinedResult;
  isLoading: boolean;
  isRequested: boolean;
  error: boolean;
}

const EvaluateCombined: React.FC<EvaluateCombinedProps> = ({
  combinedResult,
  isLoading,
  isRequested,
  error,
}) => {
  if (!isRequested) return null;

  return (
    <Box className={styles.container}>
      <Typography variant="h6" className={styles.header}>
        Consolidated Detection Performance
      </Typography>

      {error ? (
        <Box className={styles.feedback}>
          <Typography variant="body1" color="error" align="center">
            An error occurred while fetching consolidated results.
          </Typography>
        </Box>
      ) : isLoading ? (
        <Box className={styles.feedback}>
          <CircularProgress className={styles.loading} />
        </Box>
      ) : (
        <Box className={styles.output}>
          <Box className={styles.metrics}>
            <Box sx={{ display: "flex" }}>
              {/* Metric labels */}
              <Box>
                <Typography sx={{ fontWeight: "bold" }}>Accuracy:</Typography>
                <Typography sx={{ fontWeight: "bold" }}>Precision:</Typography>
                <Typography sx={{ fontWeight: "bold" }}>Recall:</Typography>
                <Typography sx={{ fontWeight: "bold" }}>f-score:</Typography>
                <Typography sx={{ fontWeight: "bold" }}>ROC AUC:</Typography>
                <Typography sx={{ fontWeight: "bold" }}>
                  Predicted error count:
                </Typography>
              </Box>
              {/* Metric values */}
              <Box sx={{ ml: 1, mr: 4 }}>
                <Typography>{combinedResult.metrics.accuracy}</Typography>
                <Typography>{combinedResult.metrics.precision}</Typography>
                <Typography>{combinedResult.metrics.recall}</Typography>
                <Typography>{combinedResult.metrics.f1_score}</Typography>
                <Typography>{combinedResult.metrics.roc_auc}</Typography>
                <Typography>
                  {combinedResult.metrics.predicted_positives_count}
                </Typography>
              </Box>
              {/* Classification counts labels */}
              <Box>
                <Typography sx={{ fontWeight: "bold" }}>
                  True Positives:
                </Typography>
                <Typography sx={{ fontWeight: "bold" }}>
                  False Positives:
                </Typography>
                <Typography sx={{ fontWeight: "bold" }}>
                  False Negatives:
                </Typography>
              </Box>
              {/* Classification counts values */}
              <Box sx={{ ml: 1 }}>
                <Typography>{combinedResult.true_positives.length}</Typography>
                <Typography>{combinedResult.false_positives.length}</Typography>
                <Typography>{combinedResult.false_negatives.length}</Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default EvaluateCombined;
