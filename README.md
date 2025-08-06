# Sigmatic - HouseSigma API Server

A TypeScript Express.js API server that interfaces with HouseSigma to search for house listings.

## Features

- **Authentication**: Automatic token management for HouseSigma API
- **House Search**: Search listings with price range and square footage filters
- **TypeScript**: Full type safety and modern JavaScript features
- **Express.js**: RESTful API with proper error handling

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Start development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
npm start
```

## API Endpoints

### Health Check
```
GET /health
```

### Search Listings
```
POST /api/listings/search
```

Request body:
```json
{
  "priceRange": [2400, 3200],
  "minSquareFootage": 700
}
```

Response:
```json
{
  "success": true,
  "data": {
    "listingIds": ["B5bO3xxrEOW3kWVP", "9w8o3m4kO5J7GKjm", ...],
    "count": 8
  }
}
```

Both `priceRange` and `minSquareFootage` are optional parameters.

## Project Structure

```
src/
├── types/          # TypeScript type definitions
├── services/       # Business logic and external API calls
├── routes/         # Express route handlers
├── app.ts         # Express app configuration
└── index.ts       # Server entry point
```