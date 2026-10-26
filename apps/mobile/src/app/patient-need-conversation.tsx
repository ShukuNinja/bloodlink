import { Link, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { PatientNeedConversationPanel } from '../features/communication/patient-need-conversation-panel';
import { appStyles } from './styles';

export default function PatientNeedConversationScreen() {
  const { patientNeedId } = useLocalSearchParams<{ patientNeedId: string }>();
  return (
    <ScrollView style={appStyles.screen}>
      <Link style={appStyles.linkText} href="/conversations">
        ← Back to conversations
      </Link>
      <Text style={appStyles.title}>Patient request conversation</Text>
      {patientNeedId ? (
        <PatientNeedConversationPanel patientNeedId={patientNeedId} />
      ) : null}
    </ScrollView>
  );
}
