import React, { useEffect, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { Title, Text, Button, ActivityIndicator } from 'react-native-paper';
import { fetchUserByUID, getCurrentUser, onAuthStateChanged, UserProfile } from '../../firebase';
import { useRouter } from 'expo-router';
import { blue100 } from 'react-native-paper/lib/typescript/styles/themes/v2/colors';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | null = null;

    const loadForUid = async (uid?: string | null) => {
      if (!uid) {
        setLoading(false);
        setProfile(null);
        return;
      }
      try {
        setLoading(true);
        const doc = await fetchUserByUID(uid);
        setProfile(doc);
      } catch (err: any) {
        console.error('Failed to load profile', err);
      } finally {
        setLoading(false);
      }
    };

    const current = getCurrentUser();
    if (current && current.uid) {
      loadForUid(current.uid);
    } else {
      // subscribe to auth changes and fetch when available
      unsub = onAuthStateChanged((u) => {
        if (!u) {
          setProfile(null);
          setLoading(false);
          return;
        }
        loadForUid(u.uid);
      });
    }

    return () => {
      if (unsub) unsub();
    };
  }, []);

  if (loading) return (
    <ProtectedRoute>
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator animating={true} />
      </SafeAreaView>
    </ProtectedRoute>
  );

  if (!profile) return (
    <ProtectedRoute>
      <SafeAreaView style={styles.safe}>
        <View style={styles.card}>
          <Text style={styles.label}>Not signed in</Text>
          <Button mode="contained" onPress={() => router.replace('/login')}>Go to Login</Button>
        </View>
      </SafeAreaView>
    </ProtectedRoute>
  );

  return (
    <ProtectedRoute>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
        {/* Use Avatar.Text instead of external placeholder image */}
        <View style={[styles.avatar, { alignItems: 'center', justifyContent: 'center' }]}>
          <Title style={{ fontSize: 28 }}>{profile.firstName ? profile.firstName.charAt(0).toUpperCase() : 'U'}</Title>
        </View>
        <View style={styles.userInfo}>
          <Title style={styles.name}>{profile.firstName? `${profile.firstName} ${profile.lastName}`: profile.email}</Title>
          <Text style={styles.role}>{profile.title || profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text>{profile.email}</Text>

        {profile.uid && (
          <>
            <Text style={[styles.label, { marginTop: 12 }]}>Licence Number</Text>
            <Text>{profile.licenseNumber}</Text>
          </>
        )}

        {profile.role && (
          <>
            <Text style={[styles.label, { marginTop: 12 }]}>Role</Text>
            <Text>{profile.role}</Text>
          </>
        )}

        {profile.createdAt && (
          <>
            <Text style={[styles.label, { marginTop: 12 }]}>Joined</Text>
            <Text>{new Date(profile.createdAt).toLocaleString()}</Text>
          </>
        )}

        <Button mode="contained" style={styles.editBtn} onPress={() => console.log('Edit profile')}>Edit Profile</Button>
        </View>
      </SafeAreaView>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: 16, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#eee' },
  userInfo: { marginLeft: 12 },
  license: {color: 'rgba(128, 223, 128, 1)'},
  name: { marginBottom: 4 },
  role: { color: '#666' },
  card: { backgroundColor: '#fafafa', padding: 16, borderRadius: 10, elevation: 2 },
  label: { fontWeight: '700', color: '#333' },
  editBtn: { marginTop: 16 },
});
