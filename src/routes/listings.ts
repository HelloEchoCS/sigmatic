import { Router, Request, Response } from "express";
import { houseListingService } from "../services/houseListingService";
import { cacheService } from "../services/cacheService";
import { SearchCriteria } from "../types";

const router = Router();

router.post("/search", async (req: Request, res: Response) => {
  try {
    const { priceRange, minSquareFootage }: SearchCriteria = req.body;

    if (priceRange && (!Array.isArray(priceRange) || priceRange.length !== 2)) {
      return res.status(400).json({
        error: "Price range must be an array of two numbers [min, max]",
      });
    }

    if (minSquareFootage && typeof minSquareFootage !== "number") {
      return res.status(400).json({
        error: "Minimum square footage must be a number",
      });
    }

    const criteria: SearchCriteria = {
      priceRange,
      minSquareFootage,
    };

    const listingIds = await houseListingService.searchListings(criteria);
    const listingDetails = await houseListingService.getListingDetails(listingIds);

    res.json(listingDetails);
  } catch (error) {
    console.error("Search endpoint error:", error);

    if (error instanceof Error) {
      if (error.message.includes("HouseSigma API error")) {
        return res.status(502).json({
          error: "Failed to communicate with HouseSigma API",
          details: error.message,
        });
      }

      if (error.message.includes("No encrypted data received")) {
        return res.status(502).json({
          error: "Invalid response format from HouseSigma API",
          details: error.message,
        });
      }

      if (
        error.message.includes("decryption") ||
        error.message.includes("decrypt")
      ) {
        return res.status(500).json({
          error: "Failed to decrypt response data",
          details: "Unable to process encrypted response from HouseSigma",
        });
      }

      if (
        error.message.includes("authentication") ||
        error.message.includes("access token")
      ) {
        return res.status(401).json({
          error: "Authentication failed with HouseSigma",
          details: error.message,
        });
      }
    }

    res.status(500).json({
      error: "Internal server error occurred while searching listings",
      details: "An unexpected error occurred during the search process",
    });
  }
});

router.get("/cache/stats", (req: Request, res: Response) => {
  res.json(cacheService.getCacheStats());
});

export default router;
