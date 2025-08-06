import { houseSigmaAuth } from './houseSigmaAuth';
import { PayloadEncryption } from './payloadEncryption';
import { cacheService } from './cacheService';
import { SearchCriteria, SearchRequest, HouseListingResponse } from '../types';

class HouseListingService {
  private encryptionSystem: PayloadEncryption;

  constructor() {
    this.encryptionSystem = new PayloadEncryption({
      rsaPublicKeyPem: `
-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDQlOcjEbqprurl2xjoEP0QdjGI
rZhLVn5vzwCorG4+2AtSi4AAHjghSXM//ljqE5rA13gfTc58JvM6I75Dmqr5r5Vv
o57CAbxBXHsXu5ojtgvb5rOd2lrZeckwJL0Z7euvRsA/FjbFdGMcGeSJ8JoePq+H
0RFOt285bSb8hVq0LQIDAQAB
-----END PUBLIC KEY-----
`,
    });
  }

  private baseSearchRequest: Omit<SearchRequest, 'price' | 'square_footage'> = {
    lang: 'en_US',
    province: 'ON',
    house_type: ['all'],
    list_type: [2],
    rent_list_type: [2],
    listing_days: 1,
    sold_days: 90,
    de_list_days: 90,
    basement: [],
    open_house_date: 0,
    description: '',
    listing_type: ['all'],
    max_maintenance_fee: 0,
    building_age_min: 999,
    building_age_max: 0,
    front_feet: [0, 100],
    bedroom_range: [0],
    bathroom_min: 0,
    garage_min: 0,
    id: '',
    filter_name: '',
    lat1: 43.685727740437414,
    lon1: -79.31676821124077,
    lat2: 43.63263652332526,
    lon2: -79.42242578875548,
    zoom: 14
  };

  async searchListings(criteria: SearchCriteria): Promise<string[]> {
    try {
      const accessToken = await houseSigmaAuth.getAccessToken();

      const searchRequest: SearchRequest = {
        ...this.baseSearchRequest,
        price: criteria.priceRange || [2400, 3200],
        square_footage: [criteria.minSquareFootage || 700, 4000]
      };

      const response = await fetch('https://housesigma.com/bkv2/api/search/mapsearchv3/listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(searchRequest)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as HouseListingResponse;

      if (!data.status) {
        throw new Error(`Search failed: ${data.error.message}`);
      }

      const allIds: string[] = [];
      data.data.list.forEach(listing => {
        allIds.push(...listing.ids);
      });

      return allIds;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  async getListingDetails(listingIds: string[]): Promise<any> {
    try {
      // Filter out cached listing IDs to only fetch new ones
      const newListingIds = cacheService.filterNewListingIds(listingIds);
      
      if (newListingIds.length === 0) {
        // All listings are cached, return empty array as per requirements
        return [];
      }

      const requestPayload = {
        lang: "en_US",
        province: "ON",
        id_listing: newListingIds,
      };

      const encryptedPayload = await this.encryptionSystem.encryptRequest(
        requestPayload,
        await houseSigmaAuth.getSecretKey(),
      );

      const accessToken = await houseSigmaAuth.getAccessToken();
      const apiResponse = await fetch(
        "https://housesigma.com/bkv2/api/listing/preview/many",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "HS-Request-Timestamp":
              this.encryptionSystem.lastEncryptionMetadata?.timestamp ?? "",
          },
          body: JSON.stringify(encryptedPayload),
        },
      );

      if (!apiResponse.ok) {
        throw new Error(`HouseSigma API error! status: ${apiResponse.status}`);
      }

      const responseText = await apiResponse.text();
      let encryptedResponse: { data?: string; [key: string]: any };

      try {
        encryptedResponse = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse API response as JSON:", responseText);
        throw new Error("Invalid JSON response from HouseSigma API");
      }

      if (!encryptedResponse.data) {
        throw new Error("No encrypted data received from HouseSigma API");
      }

      const decryptedData = await this.encryptionSystem.decryptResponse(
        encryptedResponse.data,
      );

      const newListings = decryptedData.houseList || [];
      
      // Add new listings to cache
      cacheService.addListings(newListings);

      return newListings;
    } catch (error) {
      console.error('Get listing details error:', error);
      throw error;
    }
  }
}

export const houseListingService = new HouseListingService();
