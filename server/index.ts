import { app } from "./app.js";

const port = Number(process.env.PORT || 5174);

app.listen(port, "0.0.0.0", () => {
  console.log(`payphone api listening on http://0.0.0.0:${port}`);
});
