const https = require("https");
const fs = require("fs");

if (process.env.NODE_ENV === "production") {
  const options = {
    key: fs.readFileSync("/path/to/private-key.pem"),
    cert: fs.readFileSync("/path/to/certificate.pem"),
  };

  https.createServer(options, app).listen(443, () => {
    console.log("🔒 HTTPS Server running on port 443");
  });

  // Redirecionar HTTP para HTTPS
  const http = require("http");
  http
    .createServer((req, res) => {
      res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
      res.end();
    })
    .listen(80);
}
