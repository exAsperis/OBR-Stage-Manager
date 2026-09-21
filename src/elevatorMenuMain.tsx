import CssBaseline from "@mui/material/CssBaseline";
import React from "react";
import ReactDOM from "react-dom/client";
import { ElevatorMenuApp } from "./ElevatorMenuApp";
import { PluginGate } from "./PluginGate";
import { PluginThemeProvider } from "./PluginThemeProvider";
import "./sendMenu.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode><PluginGate><PluginThemeProvider><CssBaseline /><ElevatorMenuApp /></PluginThemeProvider></PluginGate></React.StrictMode>,
);
