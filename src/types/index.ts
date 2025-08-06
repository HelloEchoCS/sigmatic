export interface HouseSigmaAuthResponse {
  status: boolean;
  data: {
    message: string;
    access_token: string;
    secret: {
      secret_key: string;
      created_at: number;
      expired_at: number;
      version: string;
      is_encrypted: number;
    };
  };
  error: {
    code: number;
    message: string;
  };
  debug: {
    API: string;
    environment: string;
    server_group: string;
    server: string;
  };
}

export interface SearchCriteria {
  priceRange?: [number, number];
  minSquareFootage?: number;
}

export interface SearchRequest {
  lang: string;
  province: string;
  house_type: string[];
  list_type: number[];
  rent_list_type: number[];
  listing_days: number;
  sold_days: number;
  de_list_days: number;
  basement: any[];
  open_house_date: number;
  description: string;
  listing_type: string[];
  max_maintenance_fee: number;
  building_age_min: number;
  building_age_max: number;
  price: [number, number];
  front_feet: [number, number];
  square_footage: [number, number];
  bedroom_range: number[];
  bathroom_min: number;
  garage_min: number;
  id: string;
  filter_name: string;
  lat1: number;
  lon1: number;
  lat2: number;
  lon2: number;
  zoom: number;
}

export interface HouseListingResponse {
  status: boolean;
  data: {
    message: string;
    list: Array<{
      location: {
        lat: number;
        lon: number;
      };
      count: number;
      type: string;
      marker: string;
      label: string;
      ids: string[];
    }>;
    alert_steps: number;
    alert_message: string;
  };
  error: {
    code: number;
    message: string;
  };
  debug: {
    API: string;
    environment: string;
    server_group: string;
    server: string;
  };
}