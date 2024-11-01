"use client";
import { Open_Sans } from "next/font/google";
import { createTheme } from "@mui/material/styles";

// Load Open Sans with specified weights
const openSans = Open_Sans({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

// Create the MUI theme
const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#212121",
    },
    secondary: {
      main: "#00bcd4",
    },
  },
  shape: {
    borderRadius: 4,
  },
  typography: {
    // Set fontFamily using the CSS font family string
    fontFamily: "'Open Sans', sans-serif",
  },
});

export default theme;
