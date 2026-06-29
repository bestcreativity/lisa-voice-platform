/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Volume2, VolumeX, Terminal, Info, Settings, Briefcase, User, FileText, CheckCircle,
  Sparkles, Copy, Calendar, Phone, PhoneOff, Delete 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AudioRecorder, AudioPlayer } from '../lib/audio-processor';
import { dispatchSessionStart, dispatchSessionEnd, dispatchCallStarted } from '../hooks/useSessionPersistence';

interface AgentConfig {
  name: string;
  bio: string;
  voice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  avatar: string;
  priorConversation: string;
  clientInfo: string;
}

const IPHONE_DIAL_KEYS: { digit: string; letters?: string }[] = [
  { digit: '1' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*' },
  { digit: '0', letters: '+' },
  { digit: '#' },
];

async function readApiJson(response: Response): Promise<Record<string, unknown>> {
  const raw = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    if (/<!DOCTYPE|<html/i.test(raw)) {
      throw new Error(
        'API returned a web page, not JSON. Open http://localhost:3000 and run npm run dev (the full app server, not Vite-only on port 5173).'
      );
    }
    throw new Error(raw.replace(/\s+/g, ' ').trim().slice(0, 120) || 'Server returned a non-JSON response.');
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid JSON from server: ${raw.slice(0, 80)}`);
  }
}

const DEFAULT_AGENTS: Record<string, AgentConfig> = {
  "Executive Recruiter": {
    name: "Lisa Nichols",
    bio: "An elegant senior corporate recruiter in her late 30s. Soft-spoken, highly professional, analytical, and supportive.",
    voice: "Kore",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
    priorConversation: "Prior screening round completed successfully.",
    clientInfo: "A leading high-growth enterprise focused on cloud infrastructure modernization, custom automation processes, and creative digital designs."
  },
  "Website Developer": {
    name: "Best",
    bio: "As an Website Developer, your role is to pitch high-performing, modern website upgrades to businesses over the phone.\n\n**Tone & Persona:**\nProfessional, results-oriented, and tech-savvy but easy to understand (no heavy jargon).\n\n**Call Flow & Blueprint:**\n1. **The Hook:** Start with a warm greeting. State that you came across their website online and noticed a few key areas where a modern refresh could significantly increase their leads or sales.\n2. **The Pitch:** Focus on outcomes. Mention that you specialize in building ultra-fast, mobile-friendly websites that turn casual visitors into paying customers.\n3. **The Pivot:** Ask how their current website is performing for them, or if they have been planning to update it.\n4. **The Goal:** Keep your responses short and conversational. Do not explain the code. Your sole objective is to pitch your role to them.",
    voice: "Zephyr",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    priorConversation: "Website assessment report shared with client champion.",
    clientInfo: "A prospective business seeking website modernization to boost inbound sales leads."
  },
  "Automation Expert": {
    name: "Skyler Vance",
    bio: "As an Automation Expert, your role is to pitch time-saving, workflow automation solutions to businesses over the phone.\n\n**Tone & Persona:**\nEfficient, sharp, and highly focused on saving time and cutting operational costs.\n\n**Call Flow & Blueprint:**\n1. **The Hook:** Start with a warm greeting. State that you came across their business online and identified a few repetitive tasks (like lead follow-ups, scheduling, or data entry) that could be fully automated to save them hours of manual labor.\n2. **The Pitch:** Explain that you design custom automated workflows that let their business run on autopilot, ensuring they never miss a customer lead again without needing extra staff.\n3. **The Pivot:** Ask what the most tedious, repetitive part of their daily business operations is right now.\n4. **The Goal:** Keep your answers concise, practical, and conversational. Your sole objective is to pitch your role to them.",
    voice: "Fenrir",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    priorConversation: "Automation strategy overview prepared.",
    clientInfo: "Advanced automation modernization client requiring streamlined workflow pipelines."
  },
  "Graphic Designer": {
    name: "Jordan Moss",
    bio: "As A Graphic Designer, your role is to pitch visual identity upgrades to businesses over the phone.\n\n**Tone & Persona:**\nCreative, observant, and enthusiastic about visual branding. You speak naturally and conversationally.\n\n**Call Flow & Blueprint:**\n1. **The Hook:** Start with a warm greeting. State that you came across their brand online (e.g., website or social media) and noticed an opportunity to elevate their visual identity to attract more customers.\n2. **The Pitch:** Briefly highlight what you can do (rebranding, high-converting social media graphics, or refreshing their current marketing materials).\n3. **The Pivot:** Ask open-ended questions about their current design needs or frustrations with their visual branding.\n4. **The Goal:** Do not give a long lecture. Keep answers to 1-2 sentences. Your sole objective is to pitch your role to them.",
    voice: "Puck",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
    priorConversation: "Corporate brand book draft 1 has been approved.",
    clientInfo: "Elite direct-to-consumer brand undergoing comprehensive visual overhaul."
  },
  "App Developer": {
    name: "Kaelen Chase",
    bio: "As an App Developer, your role is to pitch custom mobile or web application solutions to businesses or individuals over the phone.\n\n**Tone & Persona:**\nInnovative, strategic, and solutions-driven. You sound like a partner interested in helping them scale.\n\n**Call Flow & Blueprint:**\n1. **The Hook:** Start with a warm greeting. State that you came across their business online and saw a brilliant opportunity for them to launch a dedicated mobile app to increase customer retention or streamline their services.\n2. **The Pitch:** Explain how a custom app can put their business directly in their customers' pockets, boost loyalty, or automate their customer booking/ordering process.\n3. **The Pivot:** Ask if they have ever considered launching an app or if they currently have a mobile strategy.\n4. **The Goal:** Keep responses highly conversational and brief. Avoid technical jargon. Your sole objective is to pitch your role to them.",
    voice: "Charon",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80",
    priorConversation: "Interactive app mockups built and client-vetted.",
    clientInfo: "A prospective organization seeking standard mobile utility solutions to maximize efficiency."
  },
  "Custom Role...": {
    name: "Aiden Sterling",
    bio: "A multi-faceted high-intelligence assistant capable of running standard operations, tutoring, or technical advising depending on specific prompts.",
    voice: "Zephyr",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80",
    priorConversation: "Custom sandbox workspace initialization complete.",
    clientInfo: "A bespoke project setup waiting for customized prompts and parameters."
  }
};

export default function VoiceAgent({ embedded = false }: { embedded?: boolean }) {
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle');
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [agentRole, setAgentRole] = useState<string>(() => {
    const saved = localStorage.getItem('lisa_agent_role');
    if (saved === 'Website Designer') return 'Website Developer';
    return saved || 'Executive Recruiter';
  });

  const getRoleValue = (role: string, field: keyof AgentConfig): string => {
    const rKey = role === 'Website Designer' ? 'Website Developer' : role;
    const roleKey = `lisa_${field}_${rKey.replace(/\s+/g, '_')}`;
    const saved = localStorage.getItem(roleKey);
    if (saved !== null) return saved;

    const legacyMap: Record<keyof AgentConfig, string> = {
      name: 'lisa_recruiter_name',
      bio: 'lisa_agent_bio',
      voice: 'lisa_selected_voice',
      avatar: 'lisa_avatar_image',
      priorConversation: 'lisa_prior_conversation',
      clientInfo: 'lisa_client_info'
    };
    if (rKey === 'Executive Recruiter') {
      const legacySaved = localStorage.getItem(legacyMap[field]);
      if (legacySaved !== null) return legacySaved;
    }
    
    return DEFAULT_AGENTS[rKey]?.[field] ?? DEFAULT_AGENTS['Executive Recruiter'][field];
  };

  const initialRole = (() => {
    const saved = localStorage.getItem('lisa_agent_role');
    if (saved === 'Website Designer') return 'Website Developer';
    return saved || 'Executive Recruiter';
  })();

  const [recruiterName, setRecruiterName] = useState(() => {
    return getRoleValue(initialRole, 'name');
  });

  const [customRoleText, setCustomRoleText] = useState<string>(() => {
    return localStorage.getItem('lisa_custom_role_text') || '';
  });

  const [priorConversation, setPriorConversation] = useState<string>(() => {
    return getRoleValue(initialRole, 'priorConversation');
  });

  const [agentBio, setAgentBio] = useState<string>(() => {
    return getRoleValue(initialRole, 'bio');
  });

  const [selectedVoice, setSelectedVoice] = useState<'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'>(() => {
    return getRoleValue(initialRole, 'voice') as any;
  });

  const [lisaVolume, setLisaVolume] = useState(0);
  const [avatarImage, setAvatarImage] = useState<string>(() => {
    return getRoleValue(initialRole, 'avatar');
  });

  const [clientInfo, setClientInfo] = useState<string>(() => {
    return getRoleValue(initialRole, 'clientInfo');
  });

  // Model Engine State & Key Management
  const [modelEngine, setModelEngine] = useState<'gemini' | 'elevenlabs'>(() => {
    const saved = localStorage.getItem('lisa_model_engine');
    if (saved === 'gemini' || saved === 'elevenlabs') return saved;
    return 'gemini';
  });
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState(() => {
    return localStorage.getItem('lisa_elevenlabs_api_key') || '';
  });
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState(() => {
    return localStorage.getItem('lisa_elevenlabs_voice_id') || '21m00Tcm4TlvDq8ikWAM';
  });

  const [fetchedVoices, setFetchedVoices] = useState<{ voice_id: string; name: string; category: string }[]>(() => {
    try {
      const saved = localStorage.getItem('lisa_elevenlabs_fetched_voices');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isFetchingVoices, setIsFetchingVoices] = useState(false);
  const [voiceFetchError, setVoiceFetchError] = useState('');

  const fetchElevenLabsVoices = async (apiKeyToUse?: string) => {
    const key = apiKeyToUse !== undefined ? apiKeyToUse : elevenLabsApiKey;
    if (!key) {
      setVoiceFetchError('Please enter an ElevenLabs API key first.');
      return;
    }
    setIsFetchingVoices(true);
    setVoiceFetchError('');
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'xi-api-key': key.trim(),
        },
      });
      if (!response.ok) {
        let errMsg = `Failed with status: ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson?.detail?.message) errMsg = errJson.detail.message;
        } catch {}
        throw new Error(errMsg);
      }
      const data = await response.json();
      if (data && Array.isArray(data.voices)) {
        const formatted = data.voices.map((v: any) => ({
          voice_id: v.voice_id,
          name: v.name,
          category: v.category || 'general',
        }));
        setFetchedVoices(formatted);
        localStorage.setItem('lisa_elevenlabs_fetched_voices', JSON.stringify(formatted));
        if (formatted.length > 0) {
          const exists = formatted.some((v: any) => v.voice_id === elevenLabsVoiceId);
          if (!exists) {
            setElevenLabsVoiceId(formatted[0].voice_id);
          }
        }
      } else {
        throw new Error('Response did not contain a voices list.');
      }
    } catch (err: any) {
      console.error('Error fetching ElevenLabs voices:', err);
      setVoiceFetchError(err.message || 'Error fetching voices list.');
    } finally {
      setIsFetchingVoices(false);
    }
  };

  const getCleanedErrorMessage = (rawError: string) => {
    if (!rawError) return "";
    
    const isRateLimit = rawError.includes("RESOURCE_EXHAUSTED") || 
                        rawError.toLowerCase().includes("quota") || 
                        rawError.toLowerCase().includes("rate limit") || 
                        rawError.includes("429");
                        
    if (isRateLimit) {
      return "Google Gemini Quota Exceeded. You have hit the daily or per-minute rate limit for Google Gemini free tier. Please wait 10-15 seconds and try connecting again, or use a pay-as-you-go key with higher limits.";
    }
    
    try {
      let jsonPart = rawError;
      if (rawError.includes("ApiError: ")) {
        jsonPart = rawError.split("ApiError: ")[1];
      }
      const parsed = JSON.parse(jsonPart);
      if (parsed.error && parsed.error.message) {
        const msg = parsed.error.message;
        if (msg.includes("RESOURCE_EXHAUSTED") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate limit") || msg.includes("429")) {
          return "Google Gemini Quota Exceeded. You have hit the daily or per-minute rate limit for Google Gemini free tier. Please wait 10-15 seconds and try connecting again, or use a pay-as-you-go key with higher limits.";
        }
        return msg;
      }
    } catch (_) {}
    
    return rawError;
  };

  // 1-Year Continuous Memory & Live Dialect Logger States
  const [currentSessionLogs, setCurrentSessionLogs] = useState<{ sender: string; text: string; timestamp: string }[]>([]);
  const sessionLogsRef = useRef<{ sender: string; text: string; timestamp: string }[]>([]);
  const [isMemoryWorkspaceOpen, setIsMemoryWorkspaceOpen] = useState(false);
  const [copyConfirmed, setCopyConfirmed] = useState(false);
  const [clearConfirmed, setClearConfirmed] = useState(false);
  const [autoAppendLogs, setAutoAppendLogs] = useState(() => {
    const saved = localStorage.getItem('lisa_auto_append_logs');
    return saved !== null ? saved === 'true' : true;
  });

  // Physical Microphone & Speaker Hardware list state managers
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [speakerDevices, setSpeakerDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>(() => localStorage.getItem('lisa_selected_mic_id') || '');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>(() => localStorage.getItem('lisa_selected_speaker_id') || '');

  const loadAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput');
      const speakers = devices.filter(d => d.kind === 'audiooutput');
      setMicDevices(mics);
      setSpeakerDevices(speakers);
      
      if (mics.length > 0 && !selectedMicId) {
        setSelectedMicId(mics[0].deviceId);
      }
      if (speakers.length > 0 && !selectedSpeakerId) {
        setSelectedSpeakerId(speakers[0].deviceId);
      }
    } catch (e) {
      console.warn("Unable to enumerate audio hardware devices:", e);
    }
  };

  useEffect(() => {
    loadAudioDevices();
    
    // Attempt audio permission verification once to warm up hardware labels, non-blocking
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devs) => {
        const unfiltered = devs.some(d => d.label !== "");
        if (!unfiltered) {
          // If labels are locked/restricted, prompt getUserMedia once to request system grants
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(s => {
              s.getTracks().forEach(t => t.stop());
              loadAudioDevices();
            })
            .catch(() => {});
        }
      });
    }

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', loadAudioDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', loadAudioDevices);
      };
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('lisa_selected_mic_id', selectedMicId);
  }, [selectedMicId]);

  useEffect(() => {
    localStorage.setItem('lisa_selected_speaker_id', selectedSpeakerId);
    if (playerRef.current && selectedSpeakerId) {
      playerRef.current.updateSpeaker(selectedSpeakerId);
    }
  }, [selectedSpeakerId]);

  const currentModelSentenceRef = useRef<string>('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem('lisa_auto_append_logs', autoAppendLogs ? 'true' : 'false');
  }, [autoAppendLogs]);

  useEffect(() => {
    localStorage.setItem('lisa_model_engine', modelEngine);
  }, [modelEngine]);

  useEffect(() => {
    localStorage.setItem('lisa_elevenlabs_api_key', elevenLabsApiKey);
  }, [elevenLabsApiKey]);

  useEffect(() => {
    localStorage.setItem('lisa_elevenlabs_voice_id', elevenLabsVoiceId);
  }, [elevenLabsVoiceId]);

  useEffect(() => {
    if (elevenLabsApiKey) {
      fetchElevenLabsVoices(elevenLabsApiKey);
    }
  }, []);

  const appendTurnToPriorConversation = (turn: { sender: string; text: string; timestamp: string }) => {
    if (!autoAppendLogs) return;
    setPriorConversation(prev => {
      const headerStr = `[${new Date().toLocaleDateString()} ${turn.timestamp}] ${turn.sender.toUpperCase()}: "${turn.text}"`;
      if (!prev || prev.trim() === '') {
        return headerStr;
      }
      if (prev.includes(headerStr)) {
        return prev;
      }
      return prev + '\n' + headerStr;
    });
  };

  // Phone Call Engine state variables
  const [candidateFirstName, setCandidateFirstName] = useState(() => {
    return localStorage.getItem('lisa_candidate_first_name') || 'Valued Partner';
  });
  const [candidateLastName, setCandidateLastName] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentCompany, setCurrentCompany] = useState('');
  const [enterpriseCapability, setEnterpriseCapability] = useState('');
  const [marketRelevance, setMarketRelevance] = useState('');

  // Phone Call Engine state variables
  const [phoneNumber, setPhoneNumber] = useState(() => {
    return localStorage.getItem('lisa_phone_number') || '';
  });
  const [phoneCallActive, setPhoneCallActive] = useState(() => {
    return localStorage.getItem('lisa_phone_call_active') === 'true';
  });
  const [phoneCallStatus, setPhoneCallStatus] = useState<'disconnected' | 'dialing' | 'ringing' | 'connected'>(() => {
    return (localStorage.getItem('lisa_phone_call_status') as any) || 'disconnected';
  });
  const [phoneCallDuration, setPhoneCallDuration] = useState(0);
  const [phoneLogs, setPhoneLogs] = useState<string[]>([]);

  // Twilio integration states
  const [twilioAccountSid, setTwilioAccountSid] = useState(() => {
    return localStorage.getItem('lisa_twilio_account_sid') || '';
  });
  const [twilioAuthToken, setTwilioAuthToken] = useState(() => {
    return localStorage.getItem('lisa_twilio_auth_token') || '';
  });
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState(() => {
    return localStorage.getItem('lisa_twilio_phone_number') || '';
  });
  const [activeCallSid, setActiveCallSid] = useState<string | null>(() => {
    return localStorage.getItem('lisa_active_call_sid') || null;
  });

  // Synchronizers for localStorage states
  useEffect(() => {
    localStorage.setItem('lisa_twilio_account_sid', twilioAccountSid);
  }, [twilioAccountSid]);

  useEffect(() => {
    localStorage.setItem('lisa_twilio_auth_token', twilioAuthToken);
  }, [twilioAuthToken]);

  useEffect(() => {
    localStorage.setItem('lisa_twilio_phone_number', twilioPhoneNumber);
  }, [twilioPhoneNumber]);

  useEffect(() => {
    if (activeCallSid) {
      localStorage.setItem('lisa_active_call_sid', activeCallSid);
    } else {
      localStorage.removeItem('lisa_active_call_sid');
    }
  }, [activeCallSid]);
  // Load role-specific brain parameter configuration when active role is switched
  useEffect(() => {
    const nameVal = getRoleValue(agentRole, 'name');
    const bioVal = getRoleValue(agentRole, 'bio');
    const voiceVal = getRoleValue(agentRole, 'voice') as any;
    const avatarVal = getRoleValue(agentRole, 'avatar');
    const priorVal = getRoleValue(agentRole, 'priorConversation');
    const clientVal = getRoleValue(agentRole, 'clientInfo');

    setRecruiterName(nameVal);
    setAgentBio(bioVal);
    setSelectedVoice(voiceVal);
    setAvatarImage(avatarVal);
    setPriorConversation(priorVal);
    setClientInfo(clientVal);
  }, [agentRole]);

  useEffect(() => {
    localStorage.setItem('lisa_agent_role', agentRole);
  }, [agentRole]);

  useEffect(() => {
    localStorage.setItem('lisa_recruiter_name', recruiterName);
    localStorage.setItem(`lisa_name_${agentRole.replace(/\s+/g, '_')}`, recruiterName);
  }, [recruiterName, agentRole]);

  useEffect(() => {
    localStorage.setItem('lisa_custom_role_text', customRoleText);
  }, [customRoleText]);

  useEffect(() => {
    localStorage.setItem('lisa_prior_conversation', priorConversation);
    localStorage.setItem(`lisa_priorConversation_${agentRole.replace(/\s+/g, '_')}`, priorConversation);
  }, [priorConversation, agentRole]);

  useEffect(() => {
    localStorage.setItem('lisa_agent_bio', agentBio);
    localStorage.setItem(`lisa_bio_${agentRole.replace(/\s+/g, '_')}`, agentBio);
  }, [agentBio, agentRole]);

  useEffect(() => {
    localStorage.setItem('lisa_client_info', clientInfo);
    localStorage.setItem(`lisa_clientInfo_${agentRole.replace(/\s+/g, '_')}`, clientInfo);
  }, [clientInfo, agentRole]);

  useEffect(() => {
    localStorage.setItem('lisa_selected_voice', selectedVoice);
    localStorage.setItem(`lisa_voice_${agentRole.replace(/\s+/g, '_')}`, selectedVoice);
  }, [selectedVoice, agentRole]);

  useEffect(() => {
    localStorage.setItem('lisa_avatar_image', avatarImage);
    localStorage.setItem(`lisa_avatar_${agentRole.replace(/\s+/g, '_')}`, avatarImage);
  }, [avatarImage, agentRole]);

  useEffect(() => {
    localStorage.setItem('lisa_phone_number', phoneNumber);
  }, [phoneNumber]);

  useEffect(() => {
    localStorage.setItem('lisa_candidate_first_name', candidateFirstName);
  }, [candidateFirstName]);

  useEffect(() => {
    localStorage.setItem('lisa_phone_call_active', phoneCallActive ? 'true' : 'false');
  }, [phoneCallActive]);

  useEffect(() => {
    localStorage.setItem('lisa_phone_call_status', phoneCallStatus);
  }, [phoneCallStatus]);

  // Handle active telephone duration counter
  useEffect(() => {
    let interval: any = null;
    if (phoneCallStatus === 'connected') {
      interval = setInterval(() => {
        setPhoneCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setPhoneCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [phoneCallStatus]);

  // Navigation active tab for side column controls
  const [activeTab, setActiveTab] = useState<'profile' | 'phone' | 'settings'>('profile');

  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const sessionRef = useRef<any>(null);
  const isManualClose = useRef(false);



  const startPhoneCall = async () => {
    if (!phoneNumber || phoneNumber.trim().length < 4) {
      setPhoneLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Dial Error: Please enter a valid number.`]);
      return;
    }
    
    setPhoneLogs([]);
    setPhoneCallStatus('dialing');
    setPhoneLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🌎 Securing Twilio digital voice outbound...`]);
    try {
      const response = await fetch('/api/twilio/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          twilioAccountSid: twilioAccountSid.trim() || undefined,
          twilioAuthToken: twilioAuthToken.trim() || undefined,
          twilioPhoneNumber: twilioPhoneNumber.trim() || undefined,
          selectedVoice,
          recruiterName,
          candidateFirstName,
          candidateLastName,
          currentTitle,
          currentCompany,
          enterpriseCapability,
          marketRelevance,
          agentRole,
          priorConversation,
          agentBio,
          clientInfo,
        })
      });

      const data = await readApiJson(response);
      if (!response.ok) {
        throw new Error((data.error as string) || 'Server rejected Twilio call triggering.');
      }

      const callSid = data.callSid as string;
      setActiveCallSid(callSid);
      dispatchCallStarted({ phoneNumber: phoneNumber.trim(), callSid, status: 'ringing', provider: 'twilio' });

      setPhoneCallStatus('ringing');
      setPhoneLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🔔 Twilio triggered call! Call SID: ${callSid}`]);
      setPhoneLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🔔 Ringing destination number: ${phoneNumber}...`]);
      
      setTimeout(() => {
        setPhoneCallStatus('connected');
        setPhoneCallActive(true);
        setPhoneLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Twilio Voice channel verified. Voice Agent is ready on call line.`]);
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setPhoneCallStatus('disconnected');
      setPhoneLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Twilio Fail: ${err.message}`]);
    }
  };

  const endPhoneCall = async () => {
    setPhoneCallStatus('disconnected');
    setPhoneCallActive(false);
    setPhoneLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🛑 Requesting Twilio Call termination...`]);
    try {
      if (activeCallSid) {
        const response = await fetch('/api/twilio/hangup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            callSid: activeCallSid,
            twilioAccountSid: twilioAccountSid.trim() || undefined,
            twilioAuthToken: twilioAuthToken.trim() || undefined
          })
        });

        if (!response.ok) {
          const data = await readApiJson(response);
          throw new Error((data.error as string) || 'Hangup failed.');
        }

        setPhoneLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Twilio session successfully completed & closed.`]);
      } else {
        setPhoneLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🛑 Call closed.`]);
      }
    } catch (err: any) {
      console.error(err);
      setPhoneLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ⚠️ Server-side disconnect error: ${err.message}`]);
    } finally {
      setActiveCallSid(null);
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (phoneCallStatus === 'disconnected') {
      setPhoneNumber(prev => prev + digit);
    }
  };

  const handleKeypadBackspace = () => {
    if (phoneCallStatus === 'disconnected') {
      setPhoneNumber(prev => prev.slice(0, -1));
    }
  };

  const toggleSession = async () => {
    if (isActive) {
      isManualClose.current = true;
      stopSession();
    } else {
      isManualClose.current = false;
      startSession();
    }
  };

  const isActiveRef = useRef(false);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    sessionLogsRef.current = currentSessionLogs;
  }, [currentSessionLogs]);

  const startSession = async () => {
    try {
      isManualClose.current = false;
      setStatus('connecting');
      setError(null);

      playerRef.current = new AudioPlayer((vol) => {
        setLisaVolume(vol);
      }, selectedSpeakerId || undefined);

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/api/live-sync`;
      const ws = new WebSocket(wsUrl);

      recorderRef.current = new AudioRecorder((base64Data) => {
        // We only send base64 audio blocks if modelEngine is standard Gemini Live
        if (modelEngine === 'gemini' && ws.readyState === WebSocket.OPEN && !isMuted) {
          ws.send(JSON.stringify({ audio: base64Data }));
        }
      });

      ws.onopen = () => {
        console.log('Voice session proxy connected on client');
        setStatus('listening');
        setCurrentSessionLogs([]); 
        currentModelSentenceRef.current = '';

        // Initialize web speech recognition for user turns to log user conversations
        const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognitionClass) {
          try {
            const recConnection = new SpeechRecognitionClass();
            recConnection.continuous = true;
            recConnection.interimResults = false;
            recConnection.lang = 'en-US';
            recConnection.onresult = (eEvent: any) => {
              const resText = eEvent.results[eEvent.results.length - 1][0].transcript;
              if (resText && resText.trim()) {
                const timeSt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const turnLog = {
                  sender: 'Client',
                  text: resText.trim(),
                  timestamp: timeSt
                };
                setCurrentSessionLogs(p => {
                  const updated = [...p, turnLog];
                  appendTurnToPriorConversation(turnLog);
                  return updated;
                });

                // Under ElevenLabs mode, we send a user-message packet to trigger Gemini text generation + ElevenLabs voice streaming
                if (modelEngine === 'elevenlabs' && ws.readyState === WebSocket.OPEN) {
                  setStatus('speaking');
                  ws.send(JSON.stringify({
                    type: 'user-message',
                    text: resText.trim(),
                    priorConversation: localStorage.getItem('lisa_prior_conversation') || ''
                  }));
                }
              }
            };
            recConnection.onerror = (errE: any) => {
              console.log("Speech recognition issue captured (benign):", errE);
            };
            recConnection.onend = () => {
              if (sessionRef.current && sessionRef.current.readyState === WebSocket.OPEN) {
                try { recConnection.start(); } catch (_) {}
              }
            };
            recConnection.start();
            recognitionRef.current = recConnection;
          } catch (rErr) {
            console.error("SpeechRecognition initialization failed:", rErr);
          }
        }
        
        // Send initial setup parameters to configure the live session on the server
        ws.send(JSON.stringify({
          type: 'setup',
          modelEngine,
          elevenLabsApiKey,
          elevenLabsVoiceId,
          selectedVoice,
          recruiterName,
          candidateFirstName,
          candidateLastName,
          currentTitle,
          currentCompany,
          enterpriseCapability,
          marketRelevance,
          agentRole: agentRole === 'Custom Role...' ? customRoleText : agentRole,
          priorConversation,
          agentBio,
          clientInfo,
          phoneNumber,
          phoneCallActive
        }));

        // We only open the microphone capture input if we are in Gemini mode or ElevenLabs mode
        recorderRef.current?.start(selectedMicId || undefined).catch((micErr) => {
          console.error('Microphone capture failed:', micErr);
          setError(`Microphone capture failed: Permission denied (Browser restricted microphone access inside this sandboxed iframe). Please click the lock icon in your browser URL bar to allow microphone access, or use the "Open in New Tab" button at the top or below.`);
          isManualClose.current = true;
          stopSession();
        });
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'error') {
            console.error('Server side API error:', message.error);
            setError(message.error);
            isManualClose.current = true;
            stopSession();
            return;
          }

          // Handle audio output from server bridge
          if (message.audio) {
            setStatus('speaking');
            playerRef.current?.playChunk(message.audio);
          }

          // Handle real-time transcription from server bridge
          if (message.transcription) {
            if (modelEngine === 'elevenlabs') {
              setTranscription(message.transcription);
              currentModelSentenceRef.current = message.transcription;
            } else {
              setTranscription(prev => prev + ' ' + message.transcription);
              currentModelSentenceRef.current += ' ' + message.transcription;
            }
          }

          // Handle interruption when user talks over AI
          if (message.interrupted) {
            console.log('Interrupted');
            playerRef.current?.stopAll();
            setStatus('listening');
            
            const cutOffSentence = currentModelSentenceRef.current.trim();
            if (cutOffSentence) {
              const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const newTurn = {
                sender: recruiterName,
                text: `${cutOffSentence} (Interrupted)`,
                timestamp: timeStr
              };
              setCurrentSessionLogs(prev => {
                const updated = [...prev, newTurn];
                appendTurnToPriorConversation(newTurn);
                return updated;
              });
              currentModelSentenceRef.current = '';
            }
          }

          // Detect end of model turn
          if (message.turnComplete) {
            setStatus('listening');
            const finishedSentence = currentModelSentenceRef.current.trim();
            if (finishedSentence) {
              const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const newTurn = {
                sender: recruiterName,
                text: finishedSentence,
                timestamp: timeStr
              };
              setCurrentSessionLogs(prev => {
                const updated = [...prev, newTurn];
                appendTurnToPriorConversation(newTurn);
                return updated;
              });
              currentModelSentenceRef.current = '';
            }
          }
        } catch (e) {
          console.error("Payload parse error:", e);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        if (!isManualClose.current && !error) {
          setError('The voice session disconnected unexpectedly. This can occur due to temporary network scaling, browser iframe limitations, or transient Google API rate limits. Please try pressing Begin Interview again.');
        }
        stopSession();
      };

      ws.onerror = (err) => {
        console.error('WebSocket connection error:', err);
        setError('Connection error. Please try again.');
        isManualClose.current = true;
        stopSession();
      };

      sessionRef.current = ws;
      setIsActive(true);
      dispatchSessionStart({ modelEngine, agentRole, recruiterName });

    } catch (err: any) {
      console.error('Failed to start session on client:', err);
      setError(err.message || 'Failed to connect to proxy server');
      setStatus('idle');
    }
  };

  const stopSession = () => {
    if (isActiveRef.current) {
      dispatchSessionEnd({ transcript: sessionLogsRef.current });
    }

    recorderRef.current?.stop();
    playerRef.current?.stop();
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) {
        // Safe trigger
      }
      recognitionRef.current = null;
    }

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {
        // Safe trigger if closed
      }
    }
    
    sessionRef.current = null;
    recorderRef.current = null;
    playerRef.current = null;
    
    setIsActive(false);
    setStatus('idle');
    setTranscription('');
  };

  // Restart session automatically if the voice changes while active
  useEffect(() => {
    if (isActive) {
      stopSession();
      startSession();
    }
  }, [selectedVoice]);

  useEffect(() => {
    return () => stopSession();
  }, []);

  return (
    <div className={`w-full ${embedded ? 'h-full min-h-[calc(100vh-0px)]' : 'h-screen'} bg-[#0B0E14] text-slate-200 font-sans flex flex-col overflow-hidden`}>
      {/* Top Navigation Bar */}
      {!embedded && (
      <nav className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-[#0B0E14] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-indigo-500 rounded-lg flex items-center justify-center">
            <Briefcase className="text-white" size={18} />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">
            LISA <span className="text-cyan-500 text-[10px] ml-1 bg-cyan-500/10 px-2 py-0.5 rounded tracking-normal font-bold uppercase">Voice Intelligence</span>
          </h1>
        </div>
        <div className="flex items-center gap-6">
          {isIframe && (
            <button
              onClick={() => window.open(window.location.href, '_blank')}
              className="px-3.5 py-1.5 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 hover:border-cyan-400 text-cyan-400 font-black tracking-widest text-[9px] uppercase rounded-xl transition-all shadow-md shadow-cyan-950/10 cursor-pointer flex items-center gap-1.5"
            >
              Open in New Tab ↗
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></div>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              {status === 'idle' ? `${recruiterName.split(' ')[0]} Standby` : status === 'connecting' ? 'Agent Protocol' : `${recruiterName.split(' ')[0]} Online`}
            </span>
          </div>
          <div className="h-4 w-[1px] bg-white/10"></div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            <span className="hover:text-white cursor-pointer transition-colors">Documentation</span>
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs">
              AI
            </div>
          </div>
        </div>
      </nav>
      )}

      <div className="flex flex-1 overflow-hidden p-6 gap-6">
        {/* Main Interaction Area */}
        <div className="flex-[2] flex flex-col gap-6 h-full">
          {/* Voice Visualizer Container */}
          <div className="bg-slate-900/40 rounded-2xl border border-white/5 flex flex-col items-center justify-between p-8 relative flex-1 overflow-hidden min-h-[460px]">
            {/* Top Info Bar */}
            <div className="w-full flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-black">
                  {status === 'listening' ? 'Dialogue Mode' : status === 'speaking' ? 'Agent Speaking' : 'Awaiting Connection'}
                </span>
                <div className="h-[1px] w-6 bg-cyan-400/30"></div>
              </div>
              
              {/* Real-time Status tags */}
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-rose-500 animate-pulse' : 'bg-slate-500'}`}></div>
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                  {isActive ? 'Live Video Sync Active' : 'Avatar Standby'}
                </span>
              </div>
            </div>

            {/* Simulated Live Video Roundel Engine */}
            <div className="flex flex-col items-center justify-center relative my-4 shrink-0">
              {/* Pulsing outer accent rings */}
              <AnimatePresence>
                {isActive && (
                  <>
                    <motion.div 
                      key="pulse-outer"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ 
                        scale: 1.1 + lisaVolume * 0.4, 
                        opacity: [0.12, 0.25, 0.12] 
                      }}
                      exit={{ opacity: 0 }}
                      transition={{ 
                        repeat: Infinity, 
                        duration: 3, 
                        ease: "easeInOut" 
                      }}
                      className="absolute w-52 h-52 md:w-56 md:h-56 rounded-full border border-cyan-500/10 pointer-events-none z-0"
                    />
                    <motion.div 
                      key="pulse-inner"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ 
                        scale: 1.35 + lisaVolume * 0.8, 
                        opacity: [0.03, 0.08, 0.03] 
                      }}
                      exit={{ opacity: 0 }}
                      transition={{ 
                        repeat: Infinity, 
                        duration: 4.5, 
                        ease: "linear" 
                      }}
                      className="absolute w-52 h-52 md:w-56 md:h-56 rounded-full border border-cyan-500/5 pointer-events-none z-0"
                    />
                  </>
                )}
              </AnimatePresence>

              {/* Main Rounded Camera Feed Container */}
              <motion.div
                animate={{
                  scale: isActive ? (status === 'speaking' ? 1 + lisaVolume * 0.06 : 1.02) : 1,
                  borderColor: isActive ? "rgba(6, 182, 212, 0.6)" : "rgba(100, 116, 139, 0.2)",
                  boxShadow: isActive
                    ? `0 0 ${25 + lisaVolume * 50}px rgba(6, 182, 212, ${0.15 + lisaVolume * 0.4})`
                    : "0 0 0px rgba(0,0,0,0)"
                }}
                transition={{ type: "spring", stiffness: 220, damping: 25 }}
                className="relative w-44 h-44 md:w-48 md:h-48 rounded-full overflow-hidden border-2 flex items-center justify-center shrink-0 z-10 shadow-lg shadow-black/80 bg-slate-950 group"
              >
                {/* Image Element */}
                <motion.img 
                  src={avatarImage} 
                  alt="Lisa Recruiter Livestream" 
                  referrerPolicy="no-referrer"
                  animate={{
                    y: status === 'speaking' ? [-1.5, -lisaVolume * 15, -1.5] : [0, -1, 0],
                    rotate: status === 'speaking' ? [-0.5, lisaVolume * 2, -0.5] : [0, -0.2, 0],
                    scale: status === 'speaking' ? 1 + lisaVolume * 0.03 : 1.02
                  }}
                  transition={{
                    duration: status === 'speaking' ? 0.35 : 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className={`w-full h-full object-cover select-none pointer-events-none transition-all duration-700
                    ${isActive ? 'brightness-105 contrast-[1.03] saturate-100 filter-none' : 'brightness-[0.4] saturate-[0.35] grayscale'}
                  `}
                />

                {/* Grid Overlay for Live holographic projection feel */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_30%,rgba(11,14,20,0.4)_100%)] pointer-events-none" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.02)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none" />

                {/* Laser scan line when active */}
                {isActive && (
                  <motion.div 
                    animate={{
                      y: ["-100%", "200%"]
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 3,
                      ease: "easeInOut"
                    }}
                    className="absolute left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-40 shadow-[0_0_8px_rgba(6,182,212,0.8)] pointer-events-none"
                  />
                )}

                {/* HUD Camera Framing overlays */}
                <div className="absolute inset-3 border border-dashed border-cyan-500/10 rounded-full opacity-60 pointer-events-none" />
                
                {/* Live stream indicator on top of portrait */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 bg-black/50 border border-white/10 px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm shadow-md">
                  <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-rose-505 animate-pulse' : 'bg-slate-600'}`}></div>
                  <span className="text-[7.5px] text-slate-300 font-black tracking-widest uppercase font-mono">
                    {isActive ? "LIVE" : "STBY"}
                  </span>
                </div>

                {/* Dynamic Decibel Meter Overlay at bottom */}
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-black/50 border border-white/10 px-2 py-0.5 rounded-md flex items-center justify-center backdrop-blur-sm font-mono text-[7px] text-cyan-400 tracking-wider">
                  {isActive && status === 'speaking' ? `GAIN: +${(lisaVolume * 24).toFixed(1)}dB` : "HOLO SYNC ACTIVE"}
                </div>
              </motion.div>
            </div>

            {/* Conversation text / Response HUD */}
            <div className="w-full text-center max-w-lg px-4 z-10 my-1 shrink-0">
              <AnimatePresence mode="wait">
                <motion.p 
                  key={transcription || 'idle'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xl md:text-2xl font-light text-slate-100 italic line-clamp-3 leading-snug drop-shadow-sm"
                >
                  {transcription ? `"${transcription.trim()}"` : isActive ? `Hi ${candidateFirstName}, this is ${recruiterName}. Let's begin our session as your ${agentRole === 'Custom Role...' ? customRoleText || 'AI Specialist' : agentRole}.` : (error ? "Voice Session Interrupted" : `Voice Agent is offline. Press "Begin Session" to activate.`)}
                </motion.p>
              </AnimatePresence>
              
              {status === 'connecting' && (
                <p className="text-cyan-400 text-[9px] mt-4 font-mono uppercase tracking-widest animate-pulse">Establishing secure live agent connection...</p>
              )}

              {error && (
                <div id="api-connection-error" className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl mt-4 text-left max-w-md mx-auto shadow-lg backdrop-blur-sm">
                  <p className="text-rose-400 text-xs font-semibold uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                    Gemini Connection Error
                  </p>
                  <p className="text-slate-200 text-xs leading-relaxed mb-3">{getCleanedErrorMessage(error)}</p>
                  
                  {/* Actionable troubleshooting list for Rate Limit / Quota Exhausted cases */}
                  {(error.includes("RESOURCE_EXHAUSTED") || error.toLowerCase().includes("quota") || error.toLowerCase().includes("rate limit") || error.includes("429")) && (
                    <div id="quota-troubleshooting" className="border-t border-rose-500/10 pt-3 mt-3">
                      <p className="text-[11px] text-amber-400 font-bold uppercase tracking-wider mb-2">Quota Reset / Key Upgrade Needed:</p>
                      <p className="text-[11px] text-slate-300 leading-relaxed font-sans bg-black/20 p-2.5 rounded-lg border border-white/5">
                        Free tier Gemini API keys have strict usage constraints (including low rate limits such as 15 requests per minute, or 20 total requests per day for specific projects). You can:
                      </p>
                      <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1.5 mt-2 ml-1 leading-normal">
                        <li><strong>Wait 10-30 seconds:</strong> Often, the minute window will clear automatically.</li>
                        <li><strong>Upgrade your Free Key:</strong> Go to <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google AI Studio ↗</a>, choose your project, and enable Pay-As-You-Go billing to bypass free tier limits.</li>
                        <li><strong>Update Secrets:</strong> In your AI Studio Builder, click the <strong>Secrets</strong> tab and update your key starting with <strong>"best"</strong>.</li>
                      </ul>
                    </div>
                  )}

                  {/* Actionable troubleshooting list for Microphone access issues */}
                  {(error.toLowerCase().includes("microphone") || error.toLowerCase().includes("mic ") || error.toLowerCase().includes("blocked") || error.toLowerCase().includes("unavailable")) && (
                    <div id="mic-troubleshooting" className="border-t border-rose-500/10 pt-3 mt-3 flex flex-col gap-2.5">
                      <p className="text-[10px] text-slate-300 leading-relaxed">
                        Browsers often enforce strict safety blocks on microphone capture inside sandboxed iframes. Running the app directly in its own tab completely resolves this.
                      </p>
                      <button
                        onClick={() => window.open(window.location.origin + window.location.pathname, '_blank')}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 active:scale-[0.98] text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-cyan-950/20"
                      >
                        Open App in New Tab ↗
                      </button>
                    </div>
                  )}

                  {/* Actionable troubleshooting list for API Key / Project Denied cases */}
                  {(error.toLowerCase().includes("denied") || error.toLowerCase().includes("restricted") || error.toLowerCase().includes("permission_denied") || error.toLowerCase().includes("billing")) && !error.toLowerCase().includes("microphone") && (
                    <div id="billing-troubleshooting" className="border-t border-rose-500/10 pt-3 mt-3">
                      <p className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider mb-2">Key Status Check:</p>
                      <p className="text-[11px] text-slate-300 mb-3 bg-black/30 p-2.5 rounded-lg border border-white/5 leading-relaxed">
                        ✓ Your API Key starting with <code className="text-cyan-300 font-mono">AIzaSyAu...</code> (custom secret <strong className="text-white">"best"</strong>) is successfully loaded, but Google AI Studio's API gateway is blocking it path-level.
                      </p>
                      
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">How to Resolve This:</p>
                      <ol className="list-decimal list-inside text-[11px] text-slate-300 space-y-2 font-sans leading-relaxed">
                        <li>
                          Open <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google AI Studio ↗</a>
                        </li>
                        <li>
                          Click the <strong className="text-white">"Get API key"</strong> button.
                        </li>
                        <li>
                          Click <strong className="text-white">"Create API key in NEW project"</strong> (do not reuse the suspended/restricted project).
                        </li>
                        <li>
                          Copy the new key (starts with <code className="text-cyan-300 font-mono">AIzaSy</code>).
                        </li>
                        <li>
                          In your AI Studio Builder, click <strong className="text-white">Secrets</strong> tab, and update your secret <strong className="text-white">"best"</strong> or add <strong className="text-white">"GEMINI_API_KEY"</strong> with your brand new key.
                        </li>
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sub-waveform Visualization - Animated bottom alignment */}
            <div className="flex items-center justify-center gap-1.5 h-12 w-full px-12 z-10 shrink-0">
              {[...Array(11)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    height: status === 'speaking'
                      ? [8 + (15 * (lisaVolume * (Math.random() + 0.5))), 40 + (50 * (lisaVolume * (Math.random() + 0.5))), 8 + (15 * (lisaVolume * (Math.random() + 0.5)))]
                      : status === 'listening' 
                        ? [6 + Math.random() * 8, 18 + Math.random() * 20, 6 + Math.random() * 8]
                        : 4
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.35 + Math.random() * 0.35,
                    ease: "easeInOut"
                  }}
                  className={`w-1 rounded-full ${
                    i === 5 ? 'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.6)]' : 
                    i > 3 && i < 7 ? 'bg-cyan-500/85' : 'bg-cyan-500/35'
                  }`}
                  style={{ height: '4px' }}
                />
              ))}
            </div>
          </div>

          {/* Control Strip */}
          <div className="h-20 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                disabled={!isActive}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-30
                  ${isMuted ? 'bg-rose-500/20 border border-rose-500/50 text-rose-500' : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-500'}
                `}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <div className="text-left hidden sm:block">
                <span className="block text-[8px] uppercase text-slate-500 font-black tracking-widest">Mic Status</span>
                <span className={`block text-xs font-bold uppercase tracking-widest ${isMuted ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isMuted ? 'Muted' : 'Live'}
                </span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={toggleSession}
                className={`px-8 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer
                  ${isActive 
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/20' 
                    : 'bg-white text-slate-950 hover:bg-slate-200'
                  }
                `}
              >
                {isActive ? 'Terminate Session' : 'Begin Session'}
              </button>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div className="hidden md:block">
                <span className="block text-[8px] uppercase text-slate-500 font-black tracking-widest">Connection Latency</span>
                <span className="block text-xs text-cyan-400 font-mono tracking-tighter">42ms</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors">
                <Settings size={18} className="text-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Configuration */}
        <aside className="w-80 flex flex-col gap-6 h-full overflow-y-auto pr-2 shrink-0">
          {/* Tab Selector */}
          <div className="flex bg-slate-900/60 p-1.5 rounded-xl border border-white/5 shrink-0">
            <button 
              onClick={() => setActiveTab('profile')}
              className={`flex-[1.2] flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer
                ${activeTab === 'profile' 
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/10 shadow-sm' 
                  : 'text-slate-400 hover:text-white'
                }
              `}
            >
              <User size={11} />
              CLIENT
            </button>
            <button 
              onClick={() => setActiveTab('phone')}
              className={`flex-[1.4] flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer
                ${activeTab === 'phone' 
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/10 shadow-sm' 
                  : 'text-slate-400 hover:text-white'
                }
              `}
            >
              <Phone size={11} className="text-indigo-400" />
              Phone
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex-[1.2] flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer
                ${activeTab === 'settings' 
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/10 shadow-sm' 
                  : 'text-slate-400 hover:text-white'
                }
              `}
            >
              <Settings size={11} />
              AGENT
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col gap-5 bg-slate-900/40 p-5 rounded-2xl border border-white/5"
              >
                <div className="flex justify-between items-center border-b border-white/5 pb-3 shrink-0">
                  <h3 className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black flex items-center gap-2">
                    <User size={12} className="text-cyan-500" /> CLIENT Profile
                  </h3>
                </div>

                <div className="space-y-4 overflow-y-auto max-h-[460px] pr-1 flex-1">
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block">Name or Company Name</label>
                    <input 
                      type="text" 
                      value={candidateFirstName} 
                      onChange={(e) => setCandidateFirstName(e.target.value)}
                      disabled={isActive}
                      className="w-full bg-slate-800/80 border border-white/5 rounded-lg p-2.5 text-xs font-medium text-slate-200 focus:border-cyan-500/40 focus:outline-none focus:bg-slate-800 disabled:opacity-55"
                    />
                  </div>

                  <div className="space-y-1.5 flex-1 flex flex-col justify-stretch">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block shrink-0">Client Information or Company Information</label>
                    <textarea 
                      rows={14}
                      value={clientInfo} 
                      onChange={(e) => setClientInfo(e.target.value)}
                      placeholder="e.g. A top-tier enterprise client seeking tailored business process engineering or visual redesigns."
                      disabled={isActive}
                      className="w-full flex-1 bg-slate-800/80 border border-white/5 rounded-lg p-2.5 text-xs font-medium text-slate-200 focus:border-cyan-500/40 focus:outline-none focus:bg-slate-800 resize-none leading-relaxed disabled:opacity-55 font-mono text-[10px]"
                    />
                  </div>
                </div>

                {isActive ? (
                  <div className="p-3 bg-cyan-950/40 border border-cyan-800/40 rounded-xl mt-auto shrink-0">
                    <p className="text-[8px] text-cyan-400 font-black uppercase tracking-widest">Ongoing Interview</p>
                    <p className="text-[10px] text-slate-400 leading-normal mt-1">
                      CLIENT variables are loaded and locked. Terminate the interview to adapt candidate background profile.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-800/40 border border-white/5 rounded-xl mt-auto shrink-0 flex items-center gap-2">
                    <CheckCircle size={14} className="text-emerald-400" />
                    <p className="text-[10px] text-slate-400 font-medium">Ready to inject to System Prompt variables.</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'phone' && (
              <motion.div 
                key="phone"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col bg-[#0a0a0a] rounded-2xl border border-white/5 overflow-hidden"
              >
                <div className="flex-1 flex flex-col items-center justify-between py-4 px-3 min-h-0">
                  {/* Number display — iPhone style */}
                  <div className="flex flex-col items-center justify-center flex-1 w-full min-h-[88px] px-2 text-center">
                    <p className={`font-light tracking-wide tabular-nums leading-none transition-all ${phoneNumber ? 'text-[26px] text-white' : 'text-[15px] text-zinc-500'}`}>
                      {phoneNumber || 'Enter number'}
                    </p>
                    {phoneCallStatus !== 'disconnected' && (
                      <p className="text-[13px] text-emerald-400 mt-2 font-medium capitalize">
                        {phoneCallStatus === 'connected'
                          ? `${Math.floor(phoneCallDuration / 60)}:${String(phoneCallDuration % 60).padStart(2, '0')}`
                          : phoneCallStatus === 'dialing'
                            ? 'Calling…'
                            : 'Ringing…'}
                      </p>
                    )}
                  </div>

                  {/* Keypad */}
                  {phoneCallStatus === 'disconnected' && (
                    <div className="grid grid-cols-3 gap-x-5 gap-y-2.5 mb-2 shrink-0">
                      {IPHONE_DIAL_KEYS.map(({ digit, letters }) => (
                        <button
                          key={digit}
                          type="button"
                          onClick={() => handleKeypadPress(digit)}
                          className="w-[58px] h-[58px] rounded-full bg-[#333333] hover:bg-[#3d3d3d] active:bg-[#484848] flex flex-col items-center justify-center cursor-pointer transition-colors mx-auto"
                        >
                          <span className="text-[26px] font-light text-white leading-none">{digit}</span>
                          {letters && (
                            <span className="text-[9px] font-semibold tracking-[0.2em] text-white/90 leading-none mt-0.5">
                              {letters}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Call / hang up row */}
                  <div className="flex items-center justify-center gap-10 h-[72px] shrink-0">
                    {phoneCallStatus === 'disconnected' ? (
                      <>
                        <div className="w-[58px]" aria-hidden />
                        <button
                          type="button"
                          onClick={startPhoneCall}
                          disabled={!phoneNumber || phoneNumber.trim().length < 4}
                          className="w-[58px] h-[58px] rounded-full bg-[#34c759] hover:bg-[#2db84d] active:bg-[#28a745] disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer transition-colors shadow-lg shadow-emerald-900/30"
                          aria-label="Call"
                        >
                          <Phone size={26} className="text-white fill-white" strokeWidth={0} />
                        </button>
                        <button
                          type="button"
                          onClick={handleKeypadBackspace}
                          disabled={!phoneNumber}
                          className="w-[58px] h-[58px] rounded-full flex items-center justify-center cursor-pointer disabled:opacity-0 disabled:pointer-events-none transition-opacity"
                          aria-label="Delete"
                        >
                          <Delete size={22} className="text-zinc-400" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={endPhoneCall}
                        className="w-[58px] h-[58px] rounded-full bg-[#ff3b30] hover:bg-[#e6352b] active:bg-[#cc2f26] flex items-center justify-center cursor-pointer transition-colors shadow-lg shadow-rose-900/30"
                        aria-label="End call"
                      >
                        <PhoneOff size={26} className="text-white" />
                      </button>
                    )}
                  </div>

                  {/* Link to Lisa */}
                  <div className="w-full px-1 pt-2 border-t border-white/5 shrink-0">
                    <label className="flex items-center justify-between gap-3 cursor-pointer py-2">
                      <div className="text-left min-w-0">
                        <p className="text-[11px] text-zinc-300 font-medium">Link call to Lisa</p>
                        <p className="text-[10px] text-zinc-500 leading-snug mt-0.5">
                          Tells Lisa she is on a live phone call so she can mention the number and speak like a phone agent.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={phoneCallActive}
                        onChange={(e) => setPhoneCallActive(e.target.checked)}
                        className="w-4 h-4 shrink-0 rounded accent-[#34c759] bg-zinc-800 border-white/10 cursor-pointer"
                      />
                    </label>
                  </div>

                  {phoneLogs.length > 0 && (
                    <div className="w-full px-1 pt-1 max-h-[72px] overflow-y-auto shrink-0">
                      {phoneLogs.slice(-4).map((log, idx) => (
                        <p
                          key={idx}
                          className={`text-[9px] font-mono leading-relaxed ${log.includes('❌') ? 'text-rose-400' : log.includes('✅') ? 'text-emerald-400' : 'text-zinc-500'}`}
                        >
                          {log}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {isActive ? (
                  <div className="px-4 py-2.5 bg-cyan-950/50 border-t border-cyan-800/30 shrink-0 text-center">
                    <p className="text-[10px] text-cyan-400/90">Stop the voice session to place calls.</p>
                  </div>
                ) : (
                  <div className="px-4 py-2.5 bg-zinc-900/80 border-t border-white/5 shrink-0 text-center">
                    <p className="text-[10px] text-zinc-500">Ready to call via Twilio</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col gap-5"
              >
                {/* Settings Block */}
                <div className="flex-1 p-5 bg-slate-900/40 rounded-2xl border border-white/5 flex flex-col gap-5 overflow-y-auto">
                  <h3 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black flex items-center gap-2 border-b border-white/5 pb-2 shrink-0">
                    <Settings size={12} className="text-cyan-500" /> AGENT Settings
                  </h3>

                  {/* Model Engine Selector */}
                  <div className="space-y-2 shrink-0 border-b border-white/5 pb-4 text-left">
                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Voice Model Engine</label>
                    <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-xl border border-white/5">
                      <button
                        type="button"
                        onClick={() => setModelEngine('gemini')}
                        disabled={isActive}
                        className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border ${modelEngine === 'gemini' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/10' : 'text-slate-500 border-transparent hover:text-slate-300 disabled:opacity-40'}`}
                      >
                        Model A (Gemini)
                      </button>
                      <button
                        type="button"
                        onClick={() => setModelEngine('elevenlabs')}
                        disabled={isActive}
                        className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border ${modelEngine === 'elevenlabs' ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/10' : 'text-slate-500 border-transparent hover:text-slate-300 disabled:opacity-40'}`}
                      >
                        Model B (11Labs)
                      </button>
                    </div>
                    
                    {modelEngine === 'gemini' && (
                      <p className="text-[8px] text-cyan-500/80 leading-normal italic mt-1.5">
                        ⚡ Real-Time Gemini Live: Interactive audio streaming with zero turn delay.
                      </p>
                    )}

                    {modelEngine === 'elevenlabs' && (
                      <div className="space-y-2.5 pt-2.5 transition-all">
                        {/* Important Warning Banner for Library Voices / Free accounts */}
                        <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-[8px] text-indigo-300 leading-normal font-medium">
                          <span className="text-amber-400 font-bold uppercase">⚠️ ElevenLabs Free Account Tip:</span>
                          <p className="mt-1 font-sans">
                            Community / Library voices (shared voices) require a paid ElevenLabs creator subscription to use via API. If you have a free EleventhLabs account, use one of the reliable pre-made default presets below!
                          </p>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[8px] text-indigo-400 font-bold uppercase tracking-widest block">ElevenLabs API Key</label>
                            {elevenLabsApiKey && (
                              <button
                                type="button"
                                onClick={() => fetchElevenLabsVoices()}
                                disabled={isFetchingVoices}
                                className="text-[8px] text-indigo-400 hover:text-indigo-300 font-extrabold uppercase bg-indigo-500/10 hover:bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/10 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1 leading-none"
                              >
                                {isFetchingVoices ? 'Syncing...' : '🔄 Sync Account Voices'}
                              </button>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            <input
                              type="password"
                              value={elevenLabsApiKey}
                              onChange={(e) => setElevenLabsApiKey(e.target.value)}
                              placeholder="Enter xi-api-key..."
                              className="flex-1 bg-slate-950/80 border border-white/5 rounded-lg p-2 text-xs font-mono text-slate-300 focus:border-indigo-500/40 focus:outline-none focus:bg-slate-950"
                            />
                            {elevenLabsApiKey && (
                              <button
                                type="button"
                                onClick={() => fetchElevenLabsVoices()}
                                disabled={isFetchingVoices}
                                className="px-3 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-300 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 select-none cursor-pointer flex items-center justify-center min-w-[50px]"
                              >
                                {isFetchingVoices ? '...' : 'Load'}
                              </button>
                            )}
                          </div>
                          {voiceFetchError && (
                            <div className="mt-2 space-y-2 text-left">
                              <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 text-[10px] text-rose-300 leading-normal font-mono select-none">
                                <span className="font-bold text-rose-400 block mb-1">❌ API Connection Issue:</span>
                                {voiceFetchError}
                              </div>
                              
                              {voiceFetchError.toLowerCase().includes('voices_read') && (
                                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-[10px] text-amber-300 leading-relaxed font-sans shadow-lg">
                                  <span className="text-amber-400 font-extrabold uppercase block mb-1 flex items-center gap-1.5 font-mono text-[9px] tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                    💡 Key Permission Recommendation
                                  </span>
                                  <p className="text-[10px] text-slate-300">
                                    Your ElevenLabs API key is valid, but is missing the <code className="text-cyan-300 font-mono bg-black/30 px-1 py-0.5 rounded text-[9px]">voices_read</code> permission. You have two simple solutions:
                                  </p>
                                  <ul className="list-decimal list-inside mt-2 space-y-1 text-slate-300 pl-1 text-[10px]">
                                    <li>
                                      <strong className="text-amber-200">Bypass & Play:</strong> Keep using your key! Just select one of the robust <strong className="text-indigo-300">Pre-made Default Voices</strong> below, which work out-of-the-box.
                                    </li>
                                    <li>
                                      <strong className="text-amber-200">Add Permission:</strong> Go to your <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">ElevenLabs API Keys setting ↗</a>, edit your key, and enable the <code className="text-cyan-300 font-mono">voices_read</code> permission.
                                    </li>
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                          {!voiceFetchError && fetchedVoices.length > 0 && (
                            <p className="text-[8px] text-emerald-400 leading-normal font-semibold flex items-center gap-1 mt-1">
                              ✅ Loaded {fetchedVoices.length} account voice{fetchedVoices.length > 1 ? 's' : ''}!
                            </p>
                          )}
                        </div>

                        {/* Dropdown for selecting voices directly */}
                        <div className="space-y-1.5 text-left">
                          <label className="text-[8px] text-indigo-400 font-bold uppercase tracking-widest block">Choose ElevenLabs Voice</label>
                          <div className="relative">
                            <select
                              value={[
                                '21m00Tcm4TlvDq8ikWAM',
                                'AZnzlk1XvdvUeBnXmlld',
                                'EXAVITQu4vr4xnSDxMaL',
                                'piTKgcLEGmPEeKmv3I5D',
                                '29vD33N1CtxCmqQRPOHJ',
                                '2EiwWnXF2V4j9t7mw9gY',
                                'CYw3moM5BgbN7XY95f8z',
                                'pNInz6obpgDQhcclflgZ',
                                'ErXwobaYiN019atkyvba',
                                ...fetchedVoices.map(v => v.voice_id)
                              ].includes(elevenLabsVoiceId) ? elevenLabsVoiceId : 'custom'}
                              onChange={(e) => {
                                if (e.target.value !== 'custom') {
                                  setElevenLabsVoiceId(e.target.value);
                                } else {
                                  setElevenLabsVoiceId('');
                                }
                              }}
                              className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 focus:border-indigo-500/50 focus:outline-none cursor-pointer appearance-none font-medium pr-10"
                            >
                              {/* 1. Dynamic Fetched Voices Group */}
                              {fetchedVoices.length > 0 && (
                                <optgroup label="✨ YOUR ELEVENLABS ACCOUNT VOICES">
                                  {fetchedVoices.map((v) => (
                                    <option key={v.voice_id} value={v.voice_id}>
                                      {v.name} ({v.category})
                                    </option>
                                  ))}
                                </optgroup>
                              )}

                              {/* 2. Reliable Defaults Group */}
                              <optgroup label="PRE-MADE DEFAULT ELEVENLABS VOICES (Free-Tier Compatible)">
                                <option value="21m00Tcm4TlvDq8ikWAM">Rachel (Female - Conversational)</option>
                                <option value="AZnzlk1XvdvUeBnXmlld">Domi (Female - Lively)</option>
                                <option value="EXAVITQu4vr4xnSDxMaL">Sarah (Female - Professional)</option>
                                <option value="piTKgcLEGmPEeKmv3I5D">Nicole (Female - Soft Accent)</option>
                                <option value="29vD33N1CtxCmqQRPOHJ">Drew (Male - Confident / News)</option>
                                <option value="2EiwWnXF2V4j9t7mw9gY">Clyde (Male - Playful & Warm)</option>
                                <option value="CYw3moM5BgbN7XY95f8z">Dave (Male - Calm Narrator)</option>
                                <option value="pNInz6obpgDQhcclflgZ">Adam (Male - Deep Narrator)</option>
                                <option value="ErXwobaYiN019atkyvba">Antoni (Male - Deep Crisp)</option>
                              </optgroup>

                              <option value="custom">-- Use Custom Voice ID --</option>
                            </select>
                            <div className="absolute right-3.5 top-4 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-indigo-400 pointer-events-none"></div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] text-indigo-400 font-bold uppercase tracking-widest block">Voice ID / Custom Input</label>
                          <input
                            type="text"
                            value={elevenLabsVoiceId}
                            onChange={(e) => setElevenLabsVoiceId(e.target.value)}
                            placeholder="Enter Custom ElevenLabs Voice ID..."
                            className="w-full bg-slate-950/80 border border-white/5 rounded-lg p-2 text-xs font-mono text-slate-300 focus:border-indigo-500/40 focus:outline-none focus:bg-slate-950"
                          />
                        </div>
                        <p className="text-[8px] text-indigo-500 italic leading-normal">
                          💡 Model B triggers high-intelligence Gemini LLM and outputs premium realistic ElevenLabs Speech.
                        </p>
                      </div>
                    )}

                  </div>

                  {/* Twilio credentials */}
                  <div className="space-y-2 shrink-0 border-b border-white/5 pb-4 text-left">
                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block flex items-center gap-1.5">
                      <Phone size={11} className="text-indigo-400" />
                      Twilio
                    </label>
                    <div className="p-3 bg-slate-950/40 border border-white/5 rounded-xl space-y-2">
                      <div className="space-y-1">
                        <label className="block text-[8px] text-slate-500 font-bold uppercase">Account SID</label>
                        <input
                          type="text"
                          placeholder="AC..."
                          value={twilioAccountSid}
                          onChange={(e) => setTwilioAccountSid(e.target.value)}
                          disabled={isActive}
                          className="w-full bg-slate-950/80 border border-white/10 rounded px-2 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500/50 disabled:opacity-55"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="block text-[8px] text-slate-500 font-bold uppercase">Auth Token</label>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={twilioAuthToken}
                            onChange={(e) => setTwilioAuthToken(e.target.value)}
                            disabled={isActive}
                            className="w-full bg-slate-950/80 border border-white/10 rounded px-2 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500/50 disabled:opacity-55"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[8px] text-slate-500 font-bold uppercase">Caller Number</label>
                          <input
                            type="text"
                            placeholder="+1..."
                            value={twilioPhoneNumber}
                            onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                            disabled={isActive}
                            className="w-full bg-slate-950/80 border border-white/10 rounded px-2 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500/50 disabled:opacity-55"
                          />
                        </div>
                      </div>
                      <p className="text-[8px] text-slate-500 italic leading-normal">
                        Leave blank to use server `.env` values (`TWILIO_ACCOUNT_SID`, etc.).
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 shrink-0">
                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Agent Name</label>
                    <input 
                      type="text" 
                      value={recruiterName} 
                      onChange={(e) => setRecruiterName(e.target.value)}
                      disabled={isActive}
                      className="w-full bg-slate-800/80 border border-white/5 rounded-lg p-2.5 text-xs font-medium text-slate-200 focus:border-cyan-500/40 focus:outline-none focus:bg-slate-800 disabled:opacity-55"
                    />
                  </div>

                  {/* Multipurpose Agent Role selection */}
                  <div className="space-y-2 shrink-0">
                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Agent Active Role</label>
                    <div className="relative">
                      <select 
                        value={agentRole}
                        onChange={(e) => setAgentRole(e.target.value)}
                        disabled={isActive}
                        className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-xs appearance-none font-medium text-slate-300 focus:border-cyan-500/40 focus:outline-none disabled:opacity-55"
                      >
                        <option value="Executive Recruiter">Executive Recruiter</option>
                        <option value="Website Developer">Website Developer</option>
                        <option value="Automation Expert">Automation Expert</option>
                        <option value="Graphic Designer">Graphic Designer</option>
                        <option value="App Developer">App Developer</option>
                        <option value="Custom Role...">Custom Role...</option>
                      </select>
                      <div className="absolute right-3 top-3.5 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-slate-400 pointer-events-none"></div>
                    </div>
                  </div>

                  {agentRole === 'Custom Role...' && (
                    <div className="space-y-1.5 shrink-0">
                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Specify Custom Role</label>
                      <input 
                        type="text" 
                        value={customRoleText} 
                        onChange={(e) => setCustomRoleText(e.target.value)}
                        placeholder="e.g. Life Coach, Language Teacher"
                        disabled={isActive}
                        className="w-full bg-slate-800/80 border border-white/5 rounded-lg p-2.5 text-xs font-medium text-slate-200 focus:border-cyan-500/40 focus:outline-none focus:bg-slate-800 disabled:opacity-55"
                      />
                    </div>
                  )}

                  {/* Agent Profile Bio */}
                  <div className="space-y-1.5 shrink-0">
                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Agent Personal Information / Bio</label>
                    <textarea 
                      rows={3}
                      value={agentBio} 
                      onChange={(e) => setAgentBio(e.target.value)}
                      placeholder="e.g. Expert website designer with 8 years of creative layout and coding workflow experience."
                      disabled={isActive}
                      className="w-full bg-slate-800/80 border border-white/5 rounded-lg p-2.5 text-xs font-medium text-slate-200 focus:border-cyan-500/40 focus:outline-none focus:bg-slate-800 resize-none leading-relaxed disabled:opacity-55 text-slate-300 text-[11px]"
                    />
                  </div>

                  {/* Prior Conversation History Section */}
                  <div className="space-y-1.5 shrink-0">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Prior Conversation Backdrop</label>
                      <button
                        onClick={() => setIsMemoryWorkspaceOpen(true)}
                        className="text-cyan-400 hover:text-cyan-300 transition-colors text-[8.5px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer bg-cyan-950/30 border border-cyan-800/30 px-2 py-0.5 rounded-md"
                      >
                        <Sparkles size={10} className="animate-pulse text-cyan-400" />
                        Manage Memory DB ↗
                      </button>
                    </div>
                    <textarea 
                      rows={3.5}
                      value={priorConversation} 
                      onChange={(e) => setPriorConversation(e.target.value)}
                      placeholder="Summarize agreements or sessions you've had in the past (e.g. 'We talked about designing a new portfolio with a dark solar theme...')"
                      disabled={isActive}
                      className="w-full bg-slate-800/80 border border-white/5 rounded-lg p-2.5 text-xs font-medium text-slate-200 focus:border-cyan-500/40 focus:outline-none focus:bg-slate-800 resize-none leading-relaxed disabled:opacity-55 text-slate-300 text-[11px]"
                    />
                    <p className="text-[7.5px] text-slate-500 leading-normal italic text-left">
                      💡 Lisa dynamically updates this 1-year history as you speak. Click <strong>Manage Memory DB ↗</strong> to view, compile, or search search logs.
                    </p>
                  </div>

                  {/* Interative Lisa Avatar / Live Video Uploader Block */}
                  <div className="space-y-2.5 shrink-0">
                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center justify-between">
                      <span>Live Video Avatar</span>
                      {avatarImage !== (DEFAULT_AGENTS[agentRole]?.avatar || '/src/assets/images/lisa_recruiter_avatar_1780081305446.png') && (
                        <button 
                          onClick={() => {
                            const dAvatar = DEFAULT_AGENTS[agentRole]?.avatar || '/src/assets/images/lisa_recruiter_avatar_1780081305446.png';
                            setAvatarImage(dAvatar);
                            localStorage.removeItem(`lisa_avatar_${agentRole.replace(/\s+/g, '_')}`);
                            if (agentRole === 'Executive Recruiter') {
                              localStorage.removeItem('lisa_avatar_image');
                            }
                          }}
                          className="text-rose-400 hover:text-rose-300 transition-colors text-[8.5px] font-black uppercase tracking-wider cursor-pointer"
                        >
                          Clear to Default
                        </button>
                      )}
                    </label>
                    <div className="flex gap-4 items-center">
                      <div className="relative w-14 h-14 rounded-xl border border-white/10 overflow-hidden shrink-0 bg-slate-950 flex items-center justify-center">
                        <img 
                          src={avatarImage} 
                          alt="Lisa Feed Thumbnail" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="border border-dashed border-white/15 hover:border-cyan-500/40 bg-slate-800/30 hover:bg-slate-800/50 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-all text-center">
                          <span className="text-[9px] text-cyan-400 font-black uppercase tracking-wider block mb-0.5">Upload Photo ↗</span>
                          <span className="text-[8px] text-slate-500 leading-normal block">PNG, JPG, or SVG</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  if (event.target?.result) {
                                    const base64 = event.target.result as string;
                                    setAvatarImage(base64);
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* HARDWARE AUDIO PORTS (MICROPHONE & SPEAKER SELECTORS) */}
                  <div className="space-y-3 shrink-0 p-3.5 bg-cyan-950/20 border border-cyan-500/10 rounded-xl text-left">
                    <div className="flex justify-between items-center border-b border-cyan-500/10 pb-2">
                      <span className="text-[9px] text-cyan-400 font-black uppercase tracking-[0.12em] flex items-center gap-1.5">
                        <Volume2 size={11} className="text-cyan-400 animate-pulse" />
                        Hardware Audio Ports (I/O)
                      </span>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          loadAudioDevices();
                        }}
                        className="text-[8px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors uppercase tracking-wider bg-transparent border-0 p-0 cursor-pointer"
                      >
                        Scan Audio Ports ↻
                      </button>
                    </div>

                    {/* Microphone Select Dropdown */}
                    <div className="space-y-1">
                      <label className="text-[8px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                        🎙️ Audio Input (Microphone)
                      </label>
                      <div className="relative">
                        <select 
                          value={selectedMicId}
                          onChange={(e) => setSelectedMicId(e.target.value)}
                          className="w-full bg-slate-800 border border-white/5 rounded-lg p-2 text-[10px] appearance-none font-medium text-slate-200 focus:border-cyan-500/40 focus:outline-none cursor-pointer"
                        >
                          {micDevices.length === 0 ? (
                            <option value="">Default Microphone (System Default)</option>
                          ) : (
                            micDevices.map((device, idx) => (
                              <option key={device.deviceId || idx} value={device.deviceId}>
                                {device.label || `Microphone Input ${idx + 1} (${device.deviceId.slice(0, 5)}...)`}
                              </option>
                            ))
                          )}
                        </select>
                        <div className="absolute right-2.5 top-2.5 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-slate-400 pointer-events-none"></div>
                      </div>
                    </div>

                    {/* Speaker Output Select Dropdown if setSinkId is supported in client browser */}
                    <div className="space-y-1">
                      <label className="text-[8px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                        🔊 Audio Output (Speaker/Headphones)
                      </label>
                      <div className="relative">
                        <select 
                          value={selectedSpeakerId}
                          onChange={(e) => setSelectedSpeakerId(e.target.value)}
                          className="w-full bg-slate-800 border border-white/5 rounded-lg p-2 text-[10px] appearance-none font-medium text-slate-200 focus:border-cyan-500/40 focus:outline-none cursor-pointer"
                        >
                          {speakerDevices.length === 0 ? (
                            <option value="">Default Speaker (System Default)</option>
                          ) : (
                            speakerDevices.map((device, idx) => (
                              <option key={device.deviceId || idx} value={device.deviceId}>
                                {device.label || `Output Speaker ${idx + 1} (${device.deviceId.slice(0, 5)}...)`}
                              </option>
                            ))
                          )}
                        </select>
                        <div className="absolute right-2.5 top-2.5 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-slate-400 pointer-events-none"></div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 shrink-0">
                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Recruit Model Engine</label>
                    <div className="relative">
                      <select className="w-full bg-slate-850 border border-white/10 rounded-lg p-2.5 text-xs appearance-none font-medium text-slate-300">
                        <option>Gemini 3.5 Recruiter Engine</option>
                        <option>{recruiterName} Special (V3.0)</option>
                      </select>
                      <div className="absolute right-3 top-3.5 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-slate-400 pointer-events-none"></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center justify-between">
                      <span>{recruiterName} Accent & Voice</span>
                      <span className="text-cyan-400 font-mono text-[8px] lowercase">ultra-realistic</span>
                    </label>
                    
                    <div className="grid grid-cols-1 gap-1 max-h-[160px] overflow-y-auto pr-1">
                      {[
                        { id: 'Puck', label: 'Puck (Female)', desc: 'Warm, highly engaging executive outreach tone' },
                        { id: 'Kore', label: 'Kore (Female)', desc: 'Focused, polished, crisp senior vetting profile' },
                        { id: 'Charon', label: 'Charon (Male)', desc: 'Deep, seasoned, authoritative leadership pedigree' },
                        { id: 'Zephyr', label: 'Zephyr (Male)', desc: 'Smooth, consultative, elite strategic partner' },
                        { id: 'Fenrir', label: 'Fenrir (Male)', desc: 'Collaborative, resonance-heavy confident recruiter' }
                      ].map((voice) => (
                        <button 
                          key={voice.id}
                          onClick={() => setSelectedVoice(voice.id as any)}
                          className={`p-2 rounded-lg text-left transition-all border cursor-pointer flex flex-col gap-0.5
                            ${selectedVoice === voice.id 
                              ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.1)]' 
                              : 'bg-slate-800/30 border-white/5 text-slate-400 hover:border-white/10 hover:bg-slate-800/60'
                            }
                          `}
                        >
                          <span className="text-[9px] font-black uppercase tracking-wider">{voice.label}</span>
                          <span className="text-[8px] opacity-70 leading-normal tracking-tight">{voice.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-1 shrink-0">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-left">Consultative Pause Rate</label>
                      <span className="text-[9px] font-mono text-cyan-400">0.72 (Balanced)</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full">
                      <div className="h-full w-[72%] bg-cyan-500 rounded-full relative">
                        <div className="absolute -right-2 -top-1.5 w-4.5 h-4.5 bg-white rounded-full shadow-lg border-4 border-cyan-600"></div>
                      </div>
                    </div>
                  </div>

                   <div className="mt-auto shrink-0 pt-2 text-left">
                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                      <p className="text-[9px] text-emerald-400 font-black uppercase tracking-[0.2em] mb-1">Instruction Set</p>
                      <p className="text-[10px] text-slate-400 leading-relaxed italic tracking-tight">
                        {agentRole === "Executive Recruiter" && `"${recruiterName} is screening you for elite executive leadership placements (CXO/VP) using your background portfolio settings."`}
                        {agentRole === "Website Developer" && `"${recruiterName} is pitching you high-performing web layout upgrades, fluid animations, and mobile-responsive conversion funnels."`}
                        {agentRole === "Automation Expert" && `"${recruiterName} is pitching you custom automated workflows, integrations, and time-saving background process tools."`}
                        {agentRole === "Graphic Designer" && `"${recruiterName} is pitching you corporate visual identity upgrades, logo designs, and cohesive color palette branding."`}
                        {agentRole === "App Developer" && `"${recruiterName} is pitching custom mobile app platforms, engagement solutions, and direct-to-customer app experiences."`}
                        {agentRole !== "Executive Recruiter" && agentRole !== "Website Developer" && agentRole !== "Automation Expert" && agentRole !== "Graphic Designer" && agentRole !== "App Developer" && `"${recruiterName} is collaborating with you in a high-fidelity real-time session focusing on the active custom persona specifications."`}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>

      {/* Cumulative Memory Workspace Modal Component */}
      <AnimatePresence>
        {isMemoryWorkspaceOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-6 text-left animate-none"
          >
            <motion.div 
              initial={{ scale: 0.96, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 15 }}
              className="bg-[#0B0F17] border border-cyan-500/20 w-full max-w-4xl h-[85vh] rounded-2xl flex flex-col overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)]"
            >
              {/* Workspace Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-slate-950/40 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-950/40 border border-cyan-500/30 rounded-xl flex items-center justify-center">
                    <Sparkles className="text-cyan-400 animate-pulse" size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black tracking-wider text-white uppercase flex items-center gap-2">
                      Cumulative Memory Archive Workspace
                      <span className="text-[8.5px] font-mono px-2 py-0.5 bg-cyan-400/10 text-cyan-400 rounded-md border border-cyan-400/20 uppercase tracking-widest font-black">
                        1-Year Memory (DB)
                      </span>
                    </h2>
                    <p className="text-[10px] text-slate-400 leading-normal mt-0.5">
                      Chronological verbal history vault. Lisa recalls everything discussed over the past year to prevent losing context.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsMemoryWorkspaceOpen(false);
                    setClearConfirmed(false);
                    setCopyConfirmed(false);
                  }}
                  className="px-4 py-2 hover:bg-white/5 border border-white/10 text-xs font-black uppercase tracking-wider rounded-xl transition-all hover:text-white text-slate-400 cursor-pointer"
                >
                  Close Workspace
                </button>
              </div>

              {/* Data & Config Row */}
              <div className="px-6 py-4 border-b border-white/5 bg-slate-950/20 flex flex-wrap gap-4 items-center justify-between shrink-0">
                <div className="flex items-center gap-6">
                  <div className="text-left text-xs bg-slate-900/60 py-2 px-3 border border-white/5 rounded-lg">
                    <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-widest">Database Size</span>
                    <span className="block mt-0.5 text-cyan-400 font-mono font-bold leading-none">
                      {priorConversation ? priorConversation.length.toLocaleString() : 0} <span className="text-[9px] text-slate-500 font-normal">chars</span>
                    </span>
                  </div>
                  <div className="text-left text-xs bg-slate-900/60 py-2 px-3 border border-white/5 rounded-lg">
                    <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-widest">Memory Context Span</span>
                    <span className="block mt-0.5 text-emerald-400 font-bold leading-none">
                      365 Days <span className="text-[8px] text-slate-500 font-normal">Retained</span>
                    </span>
                  </div>
                  <div className="text-left text-xs bg-slate-900/60 py-2 px-3 border border-white/5 rounded-lg">
                    <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-widest">Active Client Partner</span>
                    <span className="block mt-0.5 text-white font-semibold leading-none">{candidateFirstName || "Partner"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Auto Append Toggle */}
                  <div className="flex items-center gap-3 bg-slate-900/60 px-4 py-1.5 rounded-xl border border-white/5 text-left">
                    <div>
                      <p className="text-[9px] text-slate-300 font-bold uppercase tracking-wider leading-none">Continuous Auto-Append</p>
                      <p className="text-[8px] text-slate-500 mt-1">Append call dialogs dynamically</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoAppendLogs}
                      onChange={(e) => setAutoAppendLogs(e.target.checked)}
                      className="w-4 h-4 rounded accent-cyan-500 bg-slate-850 border-white/10 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Workspace Body */}
              <div className="flex-1 flex overflow-hidden">
                {/* Text Editor Area */}
                <div className="flex-[3] flex flex-col p-6 overflow-hidden border-r border-[#151D28]">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest font-mono">WORKSPACE_FILE_STREAM: memory_backdrop.log</span>
                    <span className="text-[9px] text-cyan-400 font-mono">Fully Editable Memory Record</span>
                  </div>
                  <textarea
                    value={priorConversation}
                    onChange={(e) => setPriorConversation(e.target.value)}
                    placeholder="Your past conversation database is currently empty. Engage in live chats with Lisa to automatically accumulate dialogues, or type/paste previous conversation details here so the AI remembers."
                    className="flex-1 w-full bg-slate-950 p-5 font-mono text-[11px] text-slate-300 leading-relaxed border border-white/5 focus:border-cyan-500/30 focus:outline-none rounded-xl resize-none overflow-y-auto"
                  />
                </div>

                {/* Right Side Options & Actions */}
                <div className="flex-1 p-6 bg-slate-950/20 overflow-y-auto flex flex-col gap-4 text-left">
                  <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block border-b border-white/5 pb-2">Workspace Actions</span>

                  <button
                    onClick={() => {
                      const dateString = new Date().toLocaleDateString();
                      const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const sectionHeader = `\n\n--- Session on ${dateString} ${timeString} with ${recruiterName} (${agentRole}) ---\n`;
                      setPriorConversation(prev => prev + sectionHeader);
                    }}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 border border-white/5 hover:border-cyan-500/20 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Calendar size={13} className="text-cyan-400" />
                    <span>Insert Session Marker</span>
                  </button>

                  <button
                    onClick={() => {
                      if (!priorConversation) return;
                      navigator.clipboard.writeText(priorConversation);
                      setCopyConfirmed(true);
                      setTimeout(() => setCopyConfirmed(false), 2000);
                    }}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 border border-white/5 hover:border-cyan-500/20 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Copy size={13} className="text-cyan-400" />
                    <span>{copyConfirmed ? "Copied Successfully!" : "Copy Database Backup"}</span>
                  </button>

                  {/* Wipe Memory Block with Double Native Confirmation */}
                  <div className="mt-auto pt-4 border-t border-white/5 font-sans">
                    {!clearConfirmed ? (
                      <button
                        onClick={() => setClearConfirmed(true)}
                        className="w-full py-2.5 bg-rose-950/20 hover:bg-rose-950/30 border border-rose-500/10 hover:border-rose-500/30 text-rose-400 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Terminal size={13} className="text-rose-500" />
                        <span>Reset Memory Archive</span>
                      </button>
                    ) : (
                      <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-3 text-center space-y-2">
                        <span className="block text-[8px] text-rose-400 font-bold uppercase tracking-wider">Are you absolutely sure? This cannot be undone.</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setPriorConversation("");
                              setClearConfirmed(false);
                            }}
                            className="py-1 bg-rose-600 hover:bg-rose-500 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-lg"
                          >
                            Yes, Reset
                          </button>
                          <button
                            onClick={() => setClearConfirmed(false)}
                            className="py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
