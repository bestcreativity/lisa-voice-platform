import VoiceAgent from '../components/VoiceAgent';
import { useSessionPersistence } from '../hooks/useSessionPersistence';

export default function WorkspacePage() {
  useSessionPersistence();
  return <VoiceAgent embedded />;
}
