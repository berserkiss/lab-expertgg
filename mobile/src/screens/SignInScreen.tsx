import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AuthBackground from '../components/AuthBackground';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function SignInScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const handleSubmit = async () => {
    const nextErrors: FormErrors = {};
    if (!email.trim()) nextErrors.email = 'Enter your email';
    if (!password) nextErrors.password = 'Enter your password';
    if (nextErrors.email || nextErrors.password) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 400) {
        setErrors({ general: 'Incorrect email or password.' });
      } else {
        setErrors({ general: 'Could not connect. Check your network and try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthBackground style={styles.container}>
      <View style={styles.logo}>
        <Logo size={60} />
      </View>

      <View style={styles.fieldGroup}>
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={text => {
            setEmail(text);
            if (errors.email || errors.general) setErrors(prev => ({ ...prev, email: undefined, general: undefined }));
          }}
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>

      <View style={styles.fieldGroup}>
        <TextInput
          style={[styles.input, errors.password && styles.inputError]}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={text => {
            setPassword(text);
            if (errors.password || errors.general) setErrors(prev => ({ ...prev, password: undefined, general: undefined }));
          }}
        />
        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
      </View>

      {errors.general && <Text style={[styles.errorText, styles.generalError]}>{errors.general}</Text>}

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? '...' : 'Log in'}</Text>
      </TouchableOpacity>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-start',
    paddingTop: 140,
    paddingHorizontal: 46,
  },
  logo: { marginBottom: 40 },
  fieldGroup: { marginBottom: 18 },
  input: {
    borderWidth: 1,
    borderColor: colors.navIconInactive,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.text,
    fontFamily: fonts.regular,
  },
  inputError: { borderColor: colors.lose },
  errorText: {
    color: colors.lose,
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  generalError: {
    textAlign: 'center',
    fontSize: 13,
    marginTop: -6,
    marginBottom: 8,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 16 },
});
