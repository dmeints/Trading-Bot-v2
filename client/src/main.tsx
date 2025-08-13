import { mountClientErrorReporter } from "./lib/errorReporter";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
mountClientErrorReporter();
