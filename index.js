import "dotenv/config";
import express from "express";
import cors from "cors";

// Payment backend for e-commerce with OPay integration

const app = express();
const port = Number(process.env.PORT || 3000);
const opayUrl = process.env.OPAY_CREATE_URL || "https://testapi.opaycheckout.com/api/v1/international/cashier/create";
const opayTimeoutMs = Number(process.env.OPAY_TIMEOUT_MS || 15000);
const opayNgnRate = Number(process.env.OPAY_NGN_RATE || 1500);
const opayMinimumAmount = Number(process.env.OPAY_MINIMUM_AMOUNT_NGN || 30000);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

function requireOpayConfig() {
  const required = ["OPAY_PUBLIC_KEY", "OPAY_MERCHANT_ID", "OPAY_RETURN_URL", "OPAY_CALLBACK_URL", "OPAY_CANCEL_URL"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const error = new Error(`Missing OPay configuration: ${missing.join(", ")}`);
    error.statusCode = 500;
    throw error;
  }
}

function getCashierUrl(payload) {
  return payload?.data?.cashierUrl || payload?.data?.cashier_url || payload?.cashierUrl || payload?.cashier_url;
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/payments/opay/create", async (request, response, next) => {
  try {
    requireOpayConfig();

    const { amount, customer, items } = request.body;
    const total = Math.ceil(Number(amount) * opayNgnRate);

    if (!Number.isInteger(total) || total <= 0) {
      return response.status(400).json({ error: "amount must be a positive number" });
    }

    if (total < opayMinimumAmount) {
      return response.status(400).json({
        error: `Payment amount must be at least ${opayMinimumAmount.toLocaleString()} NGN`,
        minimumAmount: opayMinimumAmount,
      });
    }

    if (!customer?.name || !customer?.email) {
      return response.status(400).json({ error: "customer name and email are required" });
    }

    const reference = `NV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), opayTimeoutMs);
    const opayResponse = await fetch(opayUrl, {
      method: "POST",
      signal: abortController.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPAY_PUBLIC_KEY}`,
        MerchantId: process.env.OPAY_MERCHANT_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        country: "NG",
        reference,
        amount: { total, currency: "NGN" },
        returnUrl: process.env.OPAY_RETURN_URL,
        callbackUrl: process.env.OPAY_CALLBACK_URL,
        cancelUrl: process.env.OPAY_CANCEL_URL,
        expireAt: Number(process.env.OPAY_EXPIRE_MINUTES || 30),
        userInfo: {
          userId: customer.id || customer.email,
          userName: customer.name,
          userMobile: customer.mobile || "",
          userEmail: customer.email,
        },
        product: {
          name: items?.length > 1 ? `${items[0]?.name || "Order"} + ${items.length - 1} more` : items?.[0]?.name || "NV service",
          description: "NV service payment",
        },
        customerVisitSource: "BROWSER",
      }),
    });
    clearTimeout(timeout);

    const payload = await opayResponse.json();
    const cashierUrl = getCashierUrl(payload);

    if (!opayResponse.ok || !cashierUrl) {
      const statusCode = payload?.code === "02001" ? 400 : 502;
      return response.status(statusCode).json({
        error: payload?.message || "OPay did not return a checkout URL",
        code: payload?.code,
        details: payload,
      });
    }

    return response.json({ reference, cashierUrl });
  } catch (error) {
    if (error.name === "AbortError") {
      error.statusCode = 504;
      error.message = "OPay did not respond before the payment request timed out";
    } else if (error.name === "TypeError" && error.message === "fetch failed") {
      error.statusCode = 502;
      error.message = "The backend could not connect to OPay. Check the server network or proxy settings.";
    }
    return next(error);
  }
});

app.post("/api/payments/opay/callback", (request, response) => {
  console.log("OPay callback received", request.body);
  response.status(200).json({ received: true });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.statusCode || 500).json({ error: error.message || "Payment service error" });
});

app.listen(port, () => {
  console.log(`Payment backend listening on http://localhost:${port}`);
});