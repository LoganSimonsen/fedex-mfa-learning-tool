const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;
const buildPath = path.join(__dirname, "..", "build");
const hasBuild = fs.existsSync(buildPath);

app.use(cors());
app.use(express.json());

if (hasBuild) {
  app.use(express.static(buildPath));
}

function getApiKey(req) {
  const apiKey = req.get("x-easypost-api-key");

  if (!apiKey || !apiKey.trim()) {
    return null;
  }

  return apiKey.trim();
}

async function callEasyPost(path, body, apiKey) {
  const response = await fetch(`https://api.easypost.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const error = new Error("EasyPost request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

app.post("/api/fedex/address-validation", async (req, res) => {
  try {
    const apiKey = getApiKey(req);
    const { accountNumber, payload } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        error: "Missing EasyPost API key",
      });
    }

    if (!accountNumber || !payload) {
      return res.status(400).json({
        error: "Missing required fields: accountNumber and payload",
      });
    }

    const data = await callEasyPost(
      `/v2/fedex_registrations/${accountNumber}/address`,
      payload,
      apiKey,
    );

    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.message,
      details: err.data || null,
    });
  }
});

app.post("/api/fedex/pin-generate", async (req, res) => {
  try {
    const apiKey = getApiKey(req);
    const { accountNumber, payload } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        error: "Missing EasyPost API key",
      });
    }

    if (!accountNumber || !payload) {
      return res.status(400).json({
        error: "Missing required fields: accountNumber and payload",
      });
    }

    const data = await callEasyPost(
      `/v2/fedex_registrations/${accountNumber}/pin`,
      payload,
      apiKey,
    );

    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.message,
      details: err.data || null,
    });
  }
});

app.post("/api/fedex/pin-validate", async (req, res) => {
  try {
    const apiKey = getApiKey(req);
    const { accountNumber, payload } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        error: "Missing EasyPost API key",
      });
    }

    if (!accountNumber || !payload) {
      return res.status(400).json({
        error: "Missing required fields: accountNumber and payload",
      });
    }

    const data = await callEasyPost(
      `/v2/fedex_registrations/${accountNumber}/pin/validate`,
      payload,
      apiKey,
    );

    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.message,
      details: err.data || null,
    });
  }
});

app.post("/api/fedex/invoice-validate", async (req, res) => {
  try {
    const apiKey = getApiKey(req);
    const { accountNumber, payload } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        error: "Missing EasyPost API key",
      });
    }

    if (!accountNumber || !payload) {
      return res.status(400).json({
        error: "Missing required fields: accountNumber and payload",
      });
    }

    const data = await callEasyPost(
      `/v2/fedex_registrations/${accountNumber}/invoice`,
      payload,
      apiKey,
    );

    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.message,
      details: err.data || null,
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

if (hasBuild) {
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
