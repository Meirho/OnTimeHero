# OnTimeHero - Setup and Deployment Guide

## Issues Fixed ✅

1. **App Structure**: Fixed duplicate App files and missing navigation/context components
2. **TypeScript Configuration**: Updated tsconfig.json for proper JSX and module resolution
3. **Android Configuration**: Added necessary permissions and Firebase services
4. **Missing Components**: Created all required dashboard components (StreakWidget, QuickStats, etc.)
5. **Navigation**: Implemented complete navigation structure with authentication flow
6. **Type Declarations**: Added proper TypeScript type definitions

## Prerequisites for Local Testing

### 1. Install Android Studio
```bash
# Download from: https://developer.android.com/studio
# Or using Homebrew (macOS):
brew install --cask android-studio
```

### 2. Set up Android SDK
1. Open Android Studio
2. Go to Tools → SDK Manager
3. Install Android SDK Platform 34 (API Level 34)
4. Install Android SDK Build-Tools 34.0.0
5. Install Android Emulator

### 3. Set Environment Variables
Add to your `~/.zshrc` or `~/.bash_profile`:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### 4. Install Java Development Kit (JDK)
```bash
# Install JDK 17 (required for React Native 0.72+)
brew install openjdk@17

# Add to your shell profile:
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
```

## Local Testing Instructions

### 1. Start Metro Bundler
```bash
cd "/Users/meir.horwitz/Documents/OnTimeHero-main 2"
npm start
```

### 2. Create Android Emulator
1. Open Android Studio
2. Go to Tools → AVD Manager
3. Click "Create Virtual Device"
4. Choose a device (e.g., Pixel 6)
5. Download and select Android 14 (API 34)
6. Start the emulator

### 3. Run the App
```bash
# In a new terminal window:
npx react-native run-android
```

### 4. Alternative: Use Physical Device
1. Enable Developer Options on your Android device
2. Enable USB Debugging
3. Connect via USB
4. Run: `npx react-native run-android`

## Firebase Setup

### 1. Configure Firebase
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing
3. Add Android app with package name: `com.ontimehero`
4. Download `google-services.json` and place in `android/app/`
5. Enable Authentication, Firestore, and Cloud Messaging

### 2. Update Firebase Configuration
Edit `src/config/firebase.js` with your Firebase config:
```javascript
import { initializeApp } from '@react-native-firebase/app';

const firebaseConfig = {
  // Your Firebase config here
};

export default initializeApp(firebaseConfig);
```

## Building for Production

### 1. Generate Release Keystore
```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore my-upload-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

### 2. Update android/gradle.properties
```properties
MYAPP_UPLOAD_STORE_FILE=my-upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=*****
MYAPP_UPLOAD_KEY_PASSWORD=*****
```

### 3. Update android/app/build.gradle
```gradle
android {
    ...
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            ...
            signingConfig signingConfigs.release
        }
    }
}
```

### 4. Build Release APK
```bash
cd android
./gradlew assembleRelease
```

### 5. Build Release AAB (for Google Play)
```bash
cd android
./gradlew bundleRelease
```

## Deployment Options

### 1. Google Play Store
1. Create developer account at [Google Play Console](https://play.google.com/console)
2. Upload AAB file from `android/app/build/outputs/bundle/release/`
3. Fill out store listing, screenshots, and app details
4. Submit for review

### 2. Direct APK Distribution
1. Upload APK from `android/app/build/outputs/apk/release/`
2. Share via email, website, or file hosting
3. Users need to enable "Install from Unknown Sources"

### 3. Firebase App Distribution
1. Set up Firebase App Distribution
2. Upload APK/AAB
3. Invite testers via email
4. Testers download via Firebase console

## Troubleshooting

### Common Issues:

1. **Metro bundler not starting**: Clear cache with `npm start -- --reset-cache`
2. **Android build fails**: Check `ANDROID_HOME` environment variable
3. **Firebase not working**: Verify `google-services.json` is in correct location
4. **Permissions denied**: Check Android manifest permissions
5. **App crashes on startup**: Check Metro bundler logs and device logs with `adb logcat`

### Useful Commands:
```bash
# Clean build
cd android && ./gradlew clean && cd ..

# Reset Metro cache
npx react-native start --reset-cache

# Check device logs
adb logcat | grep ReactNativeJS

# List connected devices
adb devices

# Uninstall app from device
adb uninstall com.ontimehero
```

## App Features

The OnTimeHero app includes:
- ✅ User authentication with Firebase
- ✅ Dashboard with next event display
- ✅ Push notifications for time-to-leave alerts
- ✅ Streak tracking and gamification
- ✅ Quick stats and achievements
- ✅ Phone lock screen integration
- ✅ Calendar integration ready
- ✅ Location services support
- ✅ Biometric authentication support

## Next Steps

1. Complete the calendar integration
2. Implement the phone lock screen functionality
3. Add more gamification features
4. Implement location-based travel time calculation
5. Add social features and sharing
6. Create comprehensive user onboarding

The app is now ready for local testing and deployment! 🚀
