import AsyncStorage from '@react-native-async-storage/async-storage';

class GoogleMapsService {
  constructor() {
    // You'll need to add your Google Maps API key here
    // Get it from: https://console.cloud.google.com/google/maps-apis
    this.apiKey = 'AIzaSyCjpfpg6D4w8nnW10Xkoz8DoWGS-0b6v6Q'; // Google Maps API key
    this.enabled = false;
    this.loadSettings();
  }

  async loadSettings() {
    try {
      const enabled = await AsyncStorage.getItem('googleMapsEnabled');
      this.enabled = enabled === 'true';
      
      const apiKey = await AsyncStorage.getItem('googleMapsApiKey');
      if (apiKey) {
        this.apiKey = apiKey;
      }
    } catch (error) {
      console.error('Error loading Google Maps settings:', error);
    }
  }

  async setApiKey(apiKey) {
    try {
      this.apiKey = apiKey;
      await AsyncStorage.setItem('googleMapsApiKey', apiKey);
    } catch (error) {
      console.error('Error saving Google Maps API key:', error);
    }
  }

  async setEnabled(enabled) {
    try {
      this.enabled = enabled;
      await AsyncStorage.setItem('googleMapsEnabled', enabled.toString());
    } catch (error) {
      console.error('Error saving Google Maps enabled state:', error);
    }
  }

  async getHomeAddress() {
    try {
      const homeAddress = await AsyncStorage.getItem('homeAddress');
      return homeAddress || null;
    } catch (error) {
      console.error('Error loading home address:', error);
      return null;
    }
  }

  async setHomeAddress(address) {
    try {
      await AsyncStorage.setItem('homeAddress', address);
    } catch (error) {
      console.error('Error saving home address:', error);
    }
  }

  async calculateTravelTime(origin, destination, arrivalTime = null) {
    if (!this.enabled || !this.apiKey || this.apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
      console.log('Google Maps integration not enabled or API key not set');
      return { duration: 15, distance: null, error: 'Google Maps not configured' };
    }

    try {
      console.log(`Calculating travel time from "${origin}" to "${destination}"`);
      
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=driving&departure_time=${arrivalTime ? new Date(arrivalTime).getTime() / 1000 : 'now'}&traffic_model=best_guess&key=${this.apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        const result = data.rows[0].elements[0];
        
        if (result.status === 'OK') {
          const durationInMinutes = Math.ceil(result.duration_in_traffic?.value / 60 || result.duration.value / 60);
          const distanceInKm = (result.distance.value / 1000).toFixed(1);
          
          console.log(`✅ Travel time calculated: ${durationInMinutes} minutes (${distanceInKm} km)`);
          
          return {
            duration: durationInMinutes,
            distance: distanceInKm,
            durationText: result.duration.text,
            distanceText: result.distance.text,
            durationInTraffic: result.duration_in_traffic?.text || result.duration.text,
          };
        } else {
          console.error('Distance Matrix result error:', result.status);
          return { duration: 15, distance: null, error: result.status };
        }
      } else {
        console.error('Distance Matrix API error:', data.status);
        return { duration: 15, distance: null, error: data.status };
      }
    } catch (error) {
      console.error('Error calculating travel time:', error);
      return { duration: 15, distance: null, error: error.message };
    }
  }

  async calculateTravelTimeFromHome(destination, arrivalTime = null) {
    const homeAddress = await this.getHomeAddress();
    
    if (!homeAddress) {
      console.log('Home address not set, using default 15 minutes');
      return { duration: 15, distance: null, error: 'Home address not set' };
    }

    return this.calculateTravelTime(homeAddress, destination, arrivalTime);
  }

  /**
   * Get autocomplete predictions for a location search query
   */
  async getPlacePredictions(input) {
    console.log('🔍 Getting place predictions for:', input);
    console.log('🔑 API Key set:', !!this.apiKey);
    console.log('🔑 API Key starts with:', this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'None');
    
    if (!this.apiKey || this.apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
      console.log('❌ Google Maps API key not set');
      return [];
    }

    try {
      console.log('📡 Making API request to Google Places...');
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=geocode&key=${this.apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();

      console.log('📡 API Response status:', data.status);
      console.log('📡 API Response data:', JSON.stringify(data, null, 2));

      if (data.status === 'OK') {
        const predictions = data.predictions.map(prediction => ({
          description: prediction.description,
          placeId: prediction.place_id,
          mainText: prediction.structured_formatting.main_text,
          secondaryText: prediction.structured_formatting.secondary_text,
        }));
        console.log('✅ Found', predictions.length, 'predictions');
        return predictions;
      } else {
        console.error('❌ API Error:', data.status, data.error_message);
        return [];
      }
    } catch (error) {
      console.error('❌ Error getting place predictions:', error);
      return [];
    }
  }

  /**
   * Get place details by place ID
   */
  async getPlaceDetails(placeId) {
    if (!this.apiKey || this.apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
      console.log('Google Maps integration not enabled');
      return null;
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${this.apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        const place = data.result;
        return {
          name: place.name,
          address: place.formatted_address,
          location: place.geometry.location,
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting place details:', error);
      return null;
    }
  }
}

export default new GoogleMapsService();

