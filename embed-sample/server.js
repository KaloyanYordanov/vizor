const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;

// serve the static HTML page from /public
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Embed sample server running at http://localhost:${PORT}`);
});
