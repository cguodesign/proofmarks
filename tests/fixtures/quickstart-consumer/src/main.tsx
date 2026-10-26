import { createRoot } from "react-dom/client";
import { Example } from "./Example";

const root = document.querySelector("#root");
if (!root) throw new Error("Missing root element.");
createRoot(root).render(<Example />);
