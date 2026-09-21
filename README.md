# E-Commerce Backend

Express.js backend for the e-commerce application with OPay payment integration.

## Features

- Payment processing via OPay API
- CORS configuration for frontend integration
- Environment-based configuration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory based on `.env.example`:
```
PORT=3000
FRONTEND_ORIGIN=http://localhost:5173
OPAY_CREATE_URL=https://testapi.opaycheckout.com/api/v1/international/cashier/create
OPAY_PUBLIC_KEY=your-opay-public-key
OPAY_MERCHANT_ID=your-merchant-id
OPAY_RETURN_URL=http://localhost:5173/order/success
OPAY_CALLBACK_URL=https://your-public-domain.com/api/payments/opay/callback
OPAY_CANCEL_URL=http://localhost:5173/checkout
OPAY_EXPIRE_MINUTES=30
OPAY_TIMEOUT_MS=15000
OPAY_NGN_RATE=1500
OPAY_MINIMUM_AMOUNT_NGN=30000
```

3. Start the server:
```bash
npm run dev
```

## API Endpoints

- `POST /api/payments/opay/create` - Create OPay payment checkout

## Dependencies

- express
- cors
- dotenv
