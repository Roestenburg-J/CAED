import React from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Typography,
} from "@mui/material";

interface PromptMetadata {
  completion_tokens: number;
  elapsed_time: string;
  prompt_name: string;
  prompt_tokens: number;
  total_tokens: number;
}

interface attributeAnnotation {
  [key: string]: number; // Allows for a flexible structure with any string keys
}

// Schema for attribute results
interface AttributeResult {
  annotated_output: attributeAnnotation[]; // Allows for a flexible structure with any string keys
  prompt_metadata: PromptMetadata[];
}

interface DetectionAttributeProps {
  attributeResults: AttributeResult;
  isLoading: boolean; // Track loading state
  isRequested: boolean; // Track if data has been fetched
  error: boolean; // Error flag
}

const DetectionAttribute: React.FC<DetectionAttributeProps> = ({
  attributeResults,
  isLoading,
  isRequested,
  error,
}) => {
  return (
    <Box>
      <h2>Attribute Results</h2>
      {!isRequested ? (
        <Typography variant="body1" align="center">
          Select Attribute Detection
        </Typography>
      ) : error ? (
        <Typography variant="body1" color="error" align="center">
          An error occurred while fetching data.
        </Typography>
      ) : attributeResults.prompt_metadata.length === 0 ? (
        <Typography variant="body1" align="center">
          No results available.
        </Typography>
      ) : (
        <Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Prompt Name</TableCell>
                  <TableCell>Completion Tokens</TableCell>
                  <TableCell>Elapsed Time</TableCell>
                  <TableCell>Prompt Tokens</TableCell>
                  <TableCell>Total Tokens</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : attributeResults.prompt_metadata.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body1">
                        No data available.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  attributeResults.prompt_metadata.map((meta, index) => (
                    <TableRow key={index}>
                      <TableCell>{meta.prompt_name}</TableCell>
                      <TableCell>{meta.completion_tokens}</TableCell>
                      <TableCell>{meta.elapsed_time}</TableCell>
                      <TableCell>{meta.prompt_tokens}</TableCell>
                      <TableCell>{meta.total_tokens}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
      {isRequested && <Box mt={2}>{/* <h2>Prompt Metadata</h2> */}</Box>}
    </Box>
  );
};

export default DetectionAttribute;
