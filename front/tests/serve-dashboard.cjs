// Serves a built app against the disposable dashboard-browser-api fixture only.
const express = require("express"),
    path = require("path"),
    { createProxyMiddleware } = require("http-proxy-middleware");
const app = express();
app.use(
    ["/api", "/uploads", "/socket.io"],
    createProxyMiddleware({
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
        ws: true,
    }),
);
const root = path.resolve(__dirname, "../dist/edla-ng");
app.use(express.static(root));
app.get("*", (_, res) => res.sendFile(path.join(root, "index.html")));
app.listen(4200, "0.0.0.0", () =>
    console.log("Dashboard fixture website ready on 4200"),
);
