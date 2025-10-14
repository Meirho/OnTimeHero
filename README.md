# 🕐 OnTimeHero

**Never be late again!** OnTimeHero is a smart calendar app that helps you stay punctual by locking your phone before important events and tracking your punctuality habits.

## ✨ Features

### 📅 **Smart Calendar Integration**
- **Google Calendar Sync** - Automatically sync with your Google Calendar
- **Real-time Updates** - Events update in real-time across devices
- **Timezone Support** - Accurate time display across all timezones
- **Event Management** - Create, edit, and delete events with ease

### 🔒 **Phone Lock Feature**
- **Pre-Event Locking** - Phone locks automatically before important events
- **Emergency Unlock** - 4-digit PIN for emergency situations
- **Location-based Unlock** - Automatically unlock when you arrive at the event location
- **Customizable Lock Duration** - Set how long before events to lock (15-120 minutes)

### 🎯 **Gamification System**
- **XP Points** - Earn 50 XP for arriving on time
- **Achievement Badges** - Unlock badges for consistent punctuality
- **Streak Tracking** - Track your punctuality streaks
- **Progress Visualization** - See your improvement over time

### 🔔 **Smart Notifications**
- **Dual Reminders** - Get ready reminder (30 min) + time to leave (15 min)
- **Customizable Timing** - Adjust reminder times in settings
- **Push Notifications** - Never miss an important event
- **Location-aware** - Travel time calculations for accurate reminders

### 🗺️ **Google Maps Integration**
- **Location Autocomplete** - Smart address suggestions
- **Travel Time Calculation** - Real-time traffic-aware travel estimates
- **Home Address Setting** - Set your home for accurate departure times
- **Current Location** - Use GPS to set your home address

### 📊 **Dashboard & Analytics**
- **Recent Activity** - View your completed events and punctuality
- **Quick Stats** - Points, badges, and punctuality rate
- **Next Event Display** - Always see your upcoming event
- **Offline Support** - Works even without internet connection

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v16 or higher)
- **React Native CLI**
- **Android Studio** (for Android development)
- **Xcode** (for iOS development, macOS only)
- **Firebase Account**
- **Google Cloud Console Account**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ontimehero.git
   cd ontimehero
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **iOS Setup** (macOS only)
   ```bash
   cd ios && pod install && cd ..
   ```

4. **Configure Firebase**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Download `google-services.json` and place it in `android/app/`
   - Download `GoogleService-Info.plist` and place it in `ios/`
   - Follow the [Firebase Setup Guide](GOOGLE_MAPS_SETUP.md)

5. **Configure Google Services**
   - Enable Google Calendar API
   - Enable Google Maps APIs (Places, Distance Matrix, Geocoding)
   - Set up OAuth 2.0 credentials
   - Follow the [Google Maps Setup Guide](GOOGLE_MAPS_SETUP.md)

6. **Run the app**
   ```bash
   # Android
   npx react-native run-android
   
   # iOS
   npx react-native run-ios
   ```

## 🔧 Configuration

### Firebase Setup
1. Create a Firebase project
2. Enable Authentication (Google Sign-In)
3. Enable Firestore Database
4. Enable Cloud Messaging
5. Download configuration files

### Google APIs Setup
1. Enable Google Calendar API
2. Enable Google Maps APIs:
   - Places API
   - Distance Matrix API
   - Geocoding API
3. Create OAuth 2.0 credentials
4. Set up API keys

### Environment Variables
Create a `.env` file in the root directory:
```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
FIREBASE_PROJECT_ID=your_firebase_project_id
```

## 📱 Usage

### First Time Setup
1. **Sign In** - Use Google Sign-In to authenticate
2. **Grant Permissions** - Allow calendar and location access
3. **Set Home Address** - Configure your home location for travel calculations
4. **Enable Notifications** - Allow push notifications for reminders

### Creating Events
1. Tap **"Add Event"** from the dashboard
2. Fill in event details (title, date, time, location)
3. The app will automatically calculate travel time
4. Event syncs to your Google Calendar

### Using Phone Lock
1. Tap **"Leave Now"** on an upcoming event
2. Phone locks automatically
3. Use **"I've Arrived"** to unlock when you reach the location
4. Earn XP points for arriving on time!

## 🏗️ Architecture

### Tech Stack
- **React Native** - Cross-platform mobile development
- **Firebase** - Backend services (Auth, Firestore, Cloud Messaging)
- **Google APIs** - Calendar and Maps integration
- **React Navigation** - Navigation library
- **AsyncStorage** - Local data persistence
- **Moment.js** - Date/time manipulation

### Project Structure
```
src/
├── components/          # Reusable UI components
├── screens/            # Screen components
├── services/           # API and service integrations
├── navigation/         # Navigation configuration
├── contexts/           # React contexts
└── config/             # Configuration files
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Known Issues

- **Firestore Unavailable**: App includes retry logic and offline support
- **Notification Permissions**: Users need to manually enable in device settings
- **Location Services**: Requires GPS permissions for location features

## 🚧 Roadmap

- [ ] **Apple Watch Integration** - Quick event viewing and unlock
- [ ] **Team/Family Sharing** - Share events with family members
- [ ] **Advanced Analytics** - Detailed punctuality insights
- [ ] **Custom Themes** - Personalize app appearance
- [ ] **Voice Commands** - Create events using voice
- [ ] **Smart Suggestions** - AI-powered event recommendations

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yourusername/ontimehero/issues) page
2. Create a new issue with detailed information
3. Include device type, OS version, and error logs

## 🙏 Acknowledgments

- **Firebase** - Backend infrastructure
- **Google APIs** - Calendar and Maps integration
- **React Native Community** - Excellent documentation and tools
- **Contributors** - Thank you to all contributors!

---

**Made with ❤️ for punctual people everywhere!**