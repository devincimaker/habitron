import { useRouter } from 'expo-router';
import { InteractiveVoiceScreen } from '../components/InteractiveVoiceScreen';

/** Voice mode, pushed over the session it talks in. Done pops back to the transcript. */
export default function InteractiveRoute() {
  const router = useRouter();
  return <InteractiveVoiceScreen onDone={() => router.back()} />;
}
