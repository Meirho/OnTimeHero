import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Icon from 'react-native-vector-icons/MaterialIcons';

GoogleSignin.configure({
  scopes: ['https://www.googleapis.com/auth/calendar', 'email', 'profile'],
  webClientId: '574885181091-rutnfbrqmiu01gjlp7gsfvo3mc2n8ecs.apps.googleusercontent.com',
  offlineAccess: true,
  forceCodeForRefreshToken: true,
});

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await auth().signInWithEmailAndPassword(email, password);
    } catch (error) {
      Alert.alert('Login Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const { idToken, user } = await GoogleSignin.signIn();
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const firebaseUser = await auth().signInWithCredential(googleCredential);
      
      // Update Firebase user profile with Google data
      if (user && firebaseUser.user) {
        await updateFirebaseUserProfile(firebaseUser.user, user);
        await importGoogleProfileData(firebaseUser.user, user);
      }
    } catch (error) {
      Alert.alert('Google Sign In Error', error.message);
    }
  };

  const updateFirebaseUserProfile = async (firebaseUser, googleUser) => {
    try {
      const updates = {};
      
      if (googleUser.name && !firebaseUser.displayName) {
        updates.displayName = googleUser.name;
      }
      
      if (googleUser.photo && !firebaseUser.photoURL) {
        updates.photoURL = googleUser.photo;
      }
      
      if (Object.keys(updates).length > 0) {
        await firebaseUser.updateProfile(updates);
        console.log('Firebase user profile updated with Google data');
      }
    } catch (error) {
      console.error('Error updating Firebase user profile:', error);
    }
  };

  const importGoogleProfileData = async (firebaseUser, googleUser) => {
    try {
      const firestoreInstance = require('@react-native-firebase/firestore').default;
      
      // Check if Firestore is available
      await firestoreInstance().enableNetwork();
      
      const userRef = firestoreInstance().collection('users').doc(firebaseUser.uid);
      
      const userData = {
        displayName: googleUser.name || firebaseUser.displayName,
        email: googleUser.email || firebaseUser.email,
        photoURL: googleUser.photo || firebaseUser.photoURL,
        googleId: googleUser.id,
        lastSignIn: firestoreInstance.FieldValue.serverTimestamp(),
        createdAt: firestoreInstance.FieldValue.serverTimestamp(),
      };
      
      await userRef.set(userData, { merge: true });
      console.log('Google profile data imported successfully');
    } catch (error) {
      console.error('Error importing Google profile data:', error);
      
      // If Firestore is unavailable, store profile data locally
      if (error.code === 'unavailable') {
        console.log('Firestore unavailable, storing profile data locally');
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const profileData = {
            displayName: googleUser.name || firebaseUser.displayName,
            email: googleUser.email || firebaseUser.email,
            photoURL: googleUser.photo || firebaseUser.photoURL,
            googleId: googleUser.id,
            lastSignIn: new Date().toISOString(),
          };
          await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));
          console.log('Profile data stored locally');
        } catch (localError) {
          console.error('Error storing profile locally:', localError);
        }
      }
      // Don't throw error to prevent sign-in failure
    }
  };

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>⏰</Text>
          <Text style={styles.appName}>OnTime Hero</Text>
          <Text style={styles.tagline}>Never Be Late Again!</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Icon name="email" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Icon name="lock" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.disabledButton]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? 'Logging in...' : 'Login'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
          >
            <Icon name="g-mobiledata" size={24} color="#fff" />
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoEmoji: {
    fontSize: 80,
    marginBottom: 10,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  formContainer: {
    paddingHorizontal: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    marginBottom: 15,
    paddingHorizontal: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#333',
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  disabledButton: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: '#4285F4',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    elevation: 3,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  signupLink: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default LoginScreen;