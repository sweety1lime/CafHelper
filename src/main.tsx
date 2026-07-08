import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PinApp } from "./components/PinApp";

// Один бандл на все окна: если открыто с ?pin=<id> — это мини-окно пина,
// иначе основной оверлей. Так пины переиспользуют весь код и стор.
const pinId = new URLSearchParams(window.location.search).get("pin");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{pinId ? <PinApp pinId={pinId} /> : <App />}</React.StrictMode>,
);
