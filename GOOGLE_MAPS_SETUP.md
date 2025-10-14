# Google Maps API Setup Guide

## Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create a New Project**
   - Click on the project dropdown at the top
   - Click "NEW PROJECT"
   - Name: `OnTimeHero Maps` (or any name you prefer)
   - Click "CREATE"

3. **Select the Project**
   - Make sure your new project is selected in the dropdown

## Step 2: Enable Required APIs

1. **Enable Distance Matrix API**
   - Go to: https://console.cloud.google.com/apis/library/distance-matrix-backend.googleapis.com
   - Click "ENABLE"

2. **Enable Places API**
   - Go to: https://console.cloud.google.com/apis/library/places-backend.googleapis.com
   - Click "ENABLE"

3. **Enable Geocoding API** (Optional but recommended)
   - Go to: https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com
   - Click "ENABLE"

## Step 3: Create API Key

1. **Go to Credentials**
   - Navigate to: https://console.cloud.google.com/apis/credentials
   - Click "CREATE CREDENTIALS"
   - Select "API key"

2. **Copy Your API Key**
   - The API key will be displayed
   - Copy it and keep it safe
   - Example: `AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

3. **Secure Your API Key (Recommended)**
   - Click on the API key to edit it
   - Under "Application restrictions":
     - Select "Android apps"
     - Add your package name: `com.ontimehero`
     - Add your SHA-1 certificate fingerprint (see Step 4 below)
   - Under "API restrictions":
     - Select "Restrict key"
     - Choose: Distance Matrix API, Places API, Geocoding API
   - Click "SAVE"

## Step 4: Get Your SHA-1 Certificate Fingerprint

### For Debug Builds:
```bash
# Navigate to your project directory
cd /Users/meir.horwitz/Documents/OnTimeHero-main\ 2

# Get the SHA-1 fingerprint
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

### For Release Builds:
```bash
# If you have a release keystore
keytool -list -v -keystore android/app/release.keystore -alias your-key-alias
```

**Copy the SHA-1 fingerprint** (it looks like: `2B:E6:35:C0:71:3C:79:19:32:18:AD:34:C7:FA:0A:D2:63:3E:44:D6`)

## Step 5: Set Up Billing

⚠️ **Important**: Google Maps APIs require billing to be enabled

1. **Go to Billing**
   - Navigate to: https://console.cloud.google.com/billing
   - Click "LINK A BILLING ACCOUNT" or "CREATE ACCOUNT"

2. **Add Payment Method**
   - Add a credit card
   - Google provides $200 free credit per month
   - This covers most small app usage

3. **Pricing Information**
   - Distance Matrix API: $5 per 1,000 requests
   - Places Autocomplete: $2.83 per 1,000 requests
   - Geocoding API: $5 per 1,000 requests
   - Free tier: $200/month credit (≈ 40,000 Distance Matrix requests)

## Step 6: Update Your App Code

1. **Open the GoogleMapsService file**
   ```bash
   # File location
   /Users/meir.horwitz/Documents/OnTimeHero-main 2/src/services/GoogleMapsService.js
   ```

2. **Replace the API key**
   ```javascript
   // Find this line (around line 12):
   this.apiKey = 'YOUR_GOOGLE_MAPS_API_KEY';
   
   // Replace with your actual API key:
   this.apiKey = 'AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
   ```

3. **Save the file**

## Step 7: Test the Integration

1. **Enable Google Maps in Settings**
   - Open your app
   - Go to Settings
   - Find "🗺️ Google Maps Integration"
   - Toggle "Enable Google Maps travel time"

2. **Set Your Home Address**
   - Click "Set your home address"
   - Enter your home address
   - Save

3. **Create a Test Event**
   - Go to Add Event
   - Enter event details
   - In the Location field, start typing an address
   - You should see autocomplete suggestions
   - Select a location
   - You should see "Estimated travel time: X min"

## Step 8: Monitor Usage

1. **Check API Usage**
   - Go to: https://console.cloud.google.com/apis/dashboard
   - View usage statistics
   - Monitor costs

2. **Set Usage Alerts** (Recommended)
   - Go to: https://console.cloud.google.com/billing/budgets
   - Create a budget alert
   - Set limit (e.g., $10/month)
   - Get email notifications

## Troubleshooting

### Common Issues:

1. **"API key not valid"**
   - Check if the API key is correct
   - Verify the key is not restricted incorrectly
   - Make sure the APIs are enabled

2. **"This API project is not authorized"**
   - Check if Distance Matrix and Places APIs are enabled
   - Verify billing is set up

3. **"Request denied"**
   - Check API restrictions on your key
   - Verify package name and SHA-1 fingerprint

4. **No autocomplete suggestions**
   - Check if Places API is enabled
   - Verify API key has Places API access
   - Check network connectivity

5. **Travel time not calculating**
   - Check if Distance Matrix API is enabled
   - Verify home address is set
   - Check if location was selected from autocomplete

### Debug Steps:

1. **Check Console Logs**
   ```bash
   # In your terminal, check React Native logs
   npx react-native log-android
   ```

2. **Verify API Key**
   - Test your API key: https://developers.google.com/maps/documentation/distance-matrix/start
   - Replace `YOUR_API_KEY` with your actual key

3. **Check Network Requests**
   - Use browser dev tools or network monitoring
   - Verify API calls are being made
   - Check response status codes

## Security Best Practices

1. **Restrict API Key**
   - Use application restrictions (Android package name)
   - Use API restrictions (only required APIs)
   - Don't commit API key to public repositories

2. **Monitor Usage**
   - Set up billing alerts
   - Monitor API usage regularly
   - Implement usage limits in your app

3. **Rotate Keys**
   - Regularly rotate API keys
   - Have backup keys ready
   - Update keys in production carefully

## Cost Optimization

1. **Cache Results**
   - Cache travel time calculations
   - Don't recalculate for same route
   - Store results locally

2. **Batch Requests**
   - Calculate multiple routes at once
   - Use efficient algorithms
   - Minimize API calls

3. **Fallback Strategies**
   - Use default travel times when API fails
   - Implement offline mode
   - Graceful degradation

---

## Quick Setup Checklist

- [ ] Created Google Cloud Project
- [ ] Enabled Distance Matrix API
- [ ] Enabled Places API
- [ ] Created API Key
- [ ] Got SHA-1 fingerprint
- [ ] Set up billing account
- [ ] Updated API key in code
- [ ] Tested autocomplete
- [ ] Tested travel time calculation
- [ ] Set up usage monitoring

---

**Need Help?**
- Google Maps API Documentation: https://developers.google.com/maps/documentation
- Distance Matrix API: https://developers.google.com/maps/documentation/distance-matrix
- Places API: https://developers.google.com/maps/documentation/places
- React Native Google Maps: https://github.com/react-native-maps/react-native-maps

**Support Contacts:**
- Google Cloud Support: https://cloud.google.com/support
- Stack Overflow: Tag questions with `google-maps-api`
