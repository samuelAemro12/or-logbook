import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text, TextInput, Title, useTheme, ActivityIndicator } from 'react-native-paper';
import { signIn, createUser, fetchUserByUID } from '../firebase';

interface AuthForm {
  fullname?: string;
  email: string;
  password: string;
  title?: string;
}

export default function LoginScreen() {
  const theme = useTheme();
  const [isSignup, setIsSignup] = useState(false);
  const [role, setRole] = useState<'admin' | 'surgeon' | 'nurse'>('surgeon');
  const router = useRouter();
  const {
    control,
    handleSubmit,
  formState: { errors },
  } = useForm<AuthForm>({ mode: 'onChange', defaultValues: { fullname: '', title: '', email: '', password: '' } });

  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);


  const onSubmit = async (data: AuthForm) => {
    setLoading(true);
    setAuthError(null);
    try {
  if (isSignup) {
        // Sign up (client-side MVP) and create user doc
        const names = (data.fullname || '').trim().split(/\s+/);
        const firstName = names.shift() || '';
        const lastName = names.join(' ') || '';

        const created = await createUser(data.email, data.password, role, { fullname: data.fullname, title: data.title, firstName, lastName });

        // Fetch created user doc by UID to get authoritative role
        const userDoc = await fetchUserByUID(created.uid);
        const userRole = userDoc?.role || role;
        const path = userRole === 'admin' ? '/dashboard/admin' : userRole === 'surgeon' ? '/dashboard/surgeon' : '/dashboard/nurse';
        router.replace(path as any);
        return;
      }

      // Sign in flow: email + password only
      const signed = await signIn(data.email, data.password);
      const userDoc = await fetchUserByUID(signed.uid);
      const userRole = userDoc?.role;
      // route only if a valid role is found; otherwise fallback to unauthorized
      const pathMap: Record<string, string> = {
        admin: '/dashboard/admin',
        surgeon: '/dashboard/surgeon',
        nurse: '/dashboard/nurse',
      };
      const path = userRole ? pathMap[userRole] : undefined;
      if (path) {
        router.replace(path as any);
      } else {
        router.replace('/unauthorized');
      }
    } catch (e: any) {
      setAuthError(e?.message || (isSignup ? 'Sign up failed' : 'Sign in failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.select({ ios: 80, android: 60 })}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerContainer}>
          <Title style={styles.title}>{isSignup ? 'Sign Up' : 'Sign In'}</Title>
        </View>
        <Card style={styles.card}>
          <Card.Content>
            {isSignup ? (
              <>
                <Controller
                  control={control}
                  name="fullname"
                  rules={{ required: 'Full name is required', minLength: { value: 2, message: 'Enter a full name' } }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      label="Full Name"
                      mode="outlined"
                      dense
                      placeholder="Enter your full name"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      style={styles.input}
                    />
                  )}
                />
                {errors.fullname && <Text style={styles.errorText}>{errors.fullname.message}</Text>}

                <Controller
                  control={control}
                  name="title"
                  rules={{ required: 'Title is required' }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      label="Title"
                      mode="outlined"
                      dense
                      placeholder="e.g. Pediatric Nurse, General Surgeon"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      style={styles.input}
                    />
                  )}
                />
                {errors.title && <Text style={styles.errorText}>{errors.title.message}</Text>}

                <Controller
                  control={control}
                  name="email"
                  rules={{
                    required: 'Email is required',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
                  }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      label="Email"
                      mode="outlined"
                      dense
                      placeholder="Enter your email"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      style={styles.input}
                    />
                  )}
                />
                {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}
              </>
            ) : (
              <>
                <Controller
                  control={control}
                  name="email"
                  rules={{
                    required: 'Email is required',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
                  }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      label="Email"
                      mode="outlined"
                      dense
                      placeholder="Enter your email"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      style={styles.input}
                    />
                  )}
                />
                {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}
              </>
            )}

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="Password"
                  mode="outlined"
                  dense
                  placeholder="Enter your password"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  style={styles.input}
                />
              )}
            />

            {isSignup && (
              <View style={styles.roleRow}>
                <Button mode={role === 'admin' ? 'contained' : 'outlined'} onPress={() => setRole('admin')} style={styles.roleButton}>Admin</Button>
                <Button mode={role === 'surgeon' ? 'contained' : 'outlined'} onPress={() => setRole('surgeon')} style={styles.roleButton}>Surgeon</Button>
                <Button mode={role === 'nurse' ? 'contained' : 'outlined'} onPress={() => setRole('nurse')} style={styles.roleButton}>Nurse</Button>
              </View>
            )}

            <Button
              mode="contained"
              onPress={handleSubmit(onSubmit)}
              style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
              accessibilityLabel="auth-submit"
              disabled={loading}
            >
              {loading ? 'Signing in...' : isSignup ? 'Sign Up' : 'Sign In'}
            </Button>
            {loading && <ActivityIndicator style={{ marginTop: 8 }} />}
            {authError && <Text style={{ color: '#B00020', marginTop: 8 }}>{authError}</Text>}
            <Button
              mode="text"
              onPress={() => setIsSignup(!isSignup)}
              style={styles.switchButton}
            >
              {isSignup ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    marginVertical: 8,
  },
  card: {
    borderRadius: 12,
    paddingVertical: 4,
    backgroundColor: '#F6F8FF',
  },
  input: {
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  actionButton: {
    marginTop: 12,
  },
  switchButton: {
    marginTop: 8,
  },
  roleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  roleButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  errorText: {
    color: '#B00020',
    marginBottom: 8,
  },
  
});

