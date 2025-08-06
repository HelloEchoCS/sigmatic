interface CachedListing {
  id_listing: string;
  data: any;
  cachedAt: number;
}

class CacheService {
  private cache = new Map<string, CachedListing>();

  has(listingId: string): boolean {
    return this.cache.has(listingId);
  }

  get(listingId: string): any | undefined {
    const cached = this.cache.get(listingId);
    return cached?.data;
  }

  add(listing: any): void {
    if (listing.id_listing) {
      this.cache.set(listing.id_listing, {
        id_listing: listing.id_listing,
        data: listing,
        cachedAt: Date.now()
      });
    }
  }

  addListings(listings: any[]): void {
    listings.forEach(listing => this.add(listing));
  }

  filterNewListingIds(listingIds: string[]): string[] {
    return listingIds.filter(id => !this.has(id));
  }

  getNewListings(listings: any[]): any[] {
    return listings.filter(listing => {
      if (!listing.id_listing) return true;
      return !this.has(listing.id_listing);
    });
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      listings: Array.from(this.cache.keys())
    };
  }
}

export const cacheService = new CacheService();