"use client";
import React, { useState } from "react";
import styles from "./page.module.css";

import { Box, Button, Grid2, TextField, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";

import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

// Component Imports
import DatasetUpload from "../../components/DatasetUpload/DatasetUpload";

//Placeholder data
function createData(
  name: string,
  calories: number,
  fat: number,
  carbs: number,
  protein: number
) {
  return { name, calories, fat, carbs, protein };
}

const rows = [
  createData("Frozen yoghurt", 159, 6.0, 24, 4.0),
  createData("Ice cream sandwich", 237, 9.0, 37, 4.3),
  createData("Eclair", 262, 16.0, 24, 6.0),
  createData("Cupcake", 305, 3.7, 67, 4.3),
  createData("Gingerbread", 356, 16.0, 49, 3.9),
];

const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
});

export default function Home() {
  const [name, setName] = useState("");

  return (
    <div className={styles.page}>
      <Typography variant="h3">Detect</Typography>
      <DatasetUpload />
      {/* <DatasetUpload /> */}
      {/* <TextField
        label="Detection Name"
        margin="dense"
        name="name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
        }}
      />
      <Button
        variant="outlined"
        component="label"
        startIcon={<UploadFileIcon />}
      >
        Upload Dataset
        <VisuallyHiddenInput
          type="file"
          onChange={(event) => console.log(event.target.files)}
          multiple
        />
      </Button>
      <Box>
        <FormGroup className={styles.formgroup}>
          <FormControlLabel
            control={<Checkbox />}
            label="Attribute Level Detection"
          />
          <FormControlLabel
            control={<Checkbox />}
            label="Dependency Detection"
          />
          <FormControlLabel
            control={<Checkbox />}
            label="Dependency Violation Detection"
          />
        </FormGroup>
      </Box>
      <Button variant="outlined">Detect Errors</Button> */}
      <Grid2 container className={styles.outputClasses} spacing={2}>
        <Grid2 size={{ xs: 2, md: 4 }} className={styles.output}>
          <Typography>Attribute Errors</Typography>
        </Grid2>
        <Grid2 size={{ xs: 2, md: 4 }} className={styles.output}>
          <Typography>Dependencies</Typography>
        </Grid2>
        <Grid2 size={{ xs: 2, md: 4 }} className={styles.output}>
          <Typography>Dependecy Violations</Typography>
        </Grid2>
      </Grid2>
      <Box>
        <Typography>Errors</Typography>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} size="small" aria-label="a dense table">
            <TableHead>
              <TableRow>
                <TableCell>Dessert (100g serving)</TableCell>
                <TableCell align="right">Calories</TableCell>
                <TableCell align="right">Fat&nbsp;(g)</TableCell>
                <TableCell align="right">Carbs&nbsp;(g)</TableCell>
                <TableCell align="right">Protein&nbsp;(g)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.name}
                  sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                >
                  <TableCell component="th" scope="row">
                    {row.name}
                  </TableCell>
                  <TableCell align="right">{row.calories}</TableCell>
                  <TableCell align="right">{row.fat}</TableCell>
                  <TableCell align="right">{row.carbs}</TableCell>
                  <TableCell align="right">{row.protein}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </div>
  );
}
