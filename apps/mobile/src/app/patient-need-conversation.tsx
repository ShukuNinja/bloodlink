import { Link, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { KeyboardAwareScreen } from '../components/keyboard-aware-screen';
import { PatientNeedConversationPanel } from '../features/communication/patient-need-conversation-panel';
import { appStyles } from './styles';

export default function PatientNeedConversationScreen() {
  const { patientNeedId } = useLocalSearchParams<{ patientNeedId: string }>();
  return (
    <KeyboardAwareScreen>
      <Link style={appStyles.linkText} href="/conversations">
        ← Back to conversations
      </Link>
      <Text style={appStyles.title}>Patient request conversation</Text>
      {patientNeedId ? (
        <PatientNeedConversationPanel patientNeedId={patientNeedId} />
      ) : null}
    </KeyboardAwareScreen>
  );
}
