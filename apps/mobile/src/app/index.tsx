import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { appStyles } from './styles';

export default function HomeScreen() {
  return (
    <View style={appStyles.screen}>
      <Text style={appStyles.title}>BloodLink</Text>
      <Text style={appStyles.subtitle}>
        Hospital-centered blood coordination. Submit a patient need to a nearby
        hospital and track its review status.
      </Text>

      <View style={appStyles.card}>
        <Text style={appStyles.subtitle}>Get started</Text>
        <Link style={appStyles.linkText} href="/auth">
          Sign in or create an account
        </Link>
        <Link style={appStyles.linkText} href="/hospitals">
          Find a nearby hospital
        </Link>
        <Link style={appStyles.linkText} href="/organizations">
          Find hospitals and blood banks
        </Link>
        <Link style={appStyles.linkText} href="/conversations">
          Conversations
        </Link>
        <Link style={appStyles.linkText} href="/subscriptions">
          Subscribed organizations
        </Link>
        <Link style={appStyles.linkText} href="/notifications">
          Request alerts
        </Link>
        <Link style={appStyles.linkText} href="/patient-needs/new">
          Submit a patient need
        </Link>
        <Link style={appStyles.linkText} href="/patient-needs">
          Track your request history
        </Link>
      </View>
    </View>
  );
}
