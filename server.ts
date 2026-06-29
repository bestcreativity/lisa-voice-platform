import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import { diagLog, initLogger, getLogPath } from "./server/lib/logger.js";
import { getApiKey, getTwilioConfig, getPublicAppUrl, isLocalhostUrl, toTwilioStreamUrl, logStartupConfig } from "./server/lib/config.js";
import { buildSystemInstruction } from "./server/lib/prompts.js";

// Load .env then .env.local (local overrides) — matches Vite behavior
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });
initLogger();
logStartupConfig();

// Pure JS dynamic standard G.711 mu-law encoder & decoder
function decodeMulaw(u: number): number {
  u = ~u & 0xFF;
  const sign = u & 0x80;
  let exponent = (u & 0x70) >> 4;
  let mantissa = u & 0x0F;
  let sample = (mantissa << 3) + 132;
  sample <<= exponent;
  sample -= 132;
  return sign ? -sample : sample;
}

function encodeMulaw(sample: number): number {
  const sign = sample < 0 ? 0x80 : 0x00;
  if (sample < 0) sample = -sample;
  if (sample > 32635) sample = 32635;
  sample += 132;
  
  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent--;
  }
  let mantissa = (sample >> (exponent + 3)) & 0x0F;
  let u = ~(sign | (exponent << 4) | mantissa) & 0xFF;
  return u;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Mount standard JSON and urlencoded request body parsers for API interactions
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Create HTTP server to share both Express and WebSocket Server
  const server = http.createServer(app);

  // Initialize WebSocket Servers
  const wss = new WebSocketServer({ noServer: true });
  const twilioWss = new WebSocketServer({ noServer: true });

  // Memory mapping to securely retain customer outbound setup parameters keyed by callSid
  const activeCalls = new Map<string, any>();

  // Handle upgrade request to route /api/live-sync and /api/twilio-stream
  server.on('upgrade', (request, socket, head) => {
    try {
      const url = request.url || '';
      const pathname = url.split('?')[0];
      diagLog(`Incoming upgrade request: ${url} | Parsed: pathname = ${pathname}`);

      if (pathname === '/api/live-sync') {
        diagLog(`Routing upgrade into wss handleUpgrade for: ${url}`);
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else if (pathname === '/api/twilio-stream') {
        diagLog(`Routing upgrade into twilioWss handleUpgrade for: ${url}`);
        twilioWss.handleUpgrade(request, socket, head, (ws) => {
          twilioWss.emit('connection', ws, request);
        });
      } else {
        // Do NOT call socket.destroy() for other paths, as they might belong to Vite's own dev-server upgrades
        diagLog(`Unaligned upgrade path: ${pathname} - letting other handlers proceed.`);
      }
    } catch (err: any) {
      diagLog(`Upgrade error caught:`, { error: err.stack || err.message || err });
      socket.destroy();
    }
  });

  // Handle WebSocket connections
  wss.on("connection", (clientWs) => {
    diagLog("New WebSocket client connected successfully to live-sync gateway");
    let session: any = null;
    let modelEngine = 'gemini';
    let elevenLabsApiKey = '';
    let elevenLabsVoiceId = '21m00Tcm4TlvDq8ikWAM';
    let cachedSetupParams: any = null;
    let isProcessingElevenLabs = false;

    clientWs.on("message", async (data) => {
      try {
        const payload = JSON.parse(data.toString());
        diagLog(`Received message type: ${payload.type || "raw audio chunk"}`);

        if (payload.type === 'setup') {
          const currentApiKey = getApiKey();
          if (!currentApiKey) {
            diagLog("Verification failed: No valid Gemini API Key was found in your environment keys or Secrets panel.");
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'error',
                error: 'No valid Gemini API key was found. Please make sure to add one in your Secrets panel or .env file.'
              }));
            }
            return;
          }

          const ai = new GoogleGenAI({
            apiKey: currentApiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              }
            }
          });

          modelEngine = payload.modelEngine || 'gemini';
          elevenLabsApiKey = payload.elevenLabsApiKey || '';
          elevenLabsVoiceId = payload.elevenLabsVoiceId || '21m00Tcm4TlvDq8ikWAM';

          const {
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
            zoomMeetUrl,
            zoomMeetActive,
            googleMeetUrl,
            googleMeetActive,
            phoneNumber,
            phoneCallActive
          } = payload;

          diagLog(`Configuring live session for ${candidateFirstName} ${candidateLastName} with voice ${selectedVoice}. Role: ${agentRole}`);

          diagLog("Running API key pre-flight verification check...");
          try {
            await ai.models.generateContent({
              model: "gemini-3.5-flash",
              contents: "pre-flight key check",
              config: { maxOutputTokens: 1 }
            });
            diagLog("API key verification check passed successfully.");
          } catch (verifyErr: any) {
            const rawErrorMsg = verifyErr.message || "";
            diagLog("Pre-flight API check returned warning/error code:", { rawError: rawErrorMsg });

            // Check if error indicates a fatal key validation issue or permission block
            const isFatalKeyError = 
              rawErrorMsg.includes("API_KEY_INVALID") || 
              rawErrorMsg.includes("invalid key") || 
              rawErrorMsg.includes("PERMISSION_DENIED") || 
              rawErrorMsg.includes("denied access");

            let cleanMsg = "Your API key is invalid, or has been restricted by Google.";
            if (rawErrorMsg.includes("PERMISSION_DENIED") || rawErrorMsg.includes("denied access")) {
              cleanMsg = "Gemini API Error: Your API key/project has been denied access by Google AI Studio. Please verify billing, permissions, or try creating a fresh API key in Google AI Studio.";
            } else if (rawErrorMsg.includes("API_KEY_INVALID") || rawErrorMsg.includes("invalid key")) {
              cleanMsg = "Gemini API Error: The configured GEMINI_API_KEY is invalid. Please double-check it is copied correctly.";
            } else {
              // Parse JSON messages if needed
              try {
                const parsed = JSON.parse(rawErrorMsg);
                if (parsed.error && parsed.error.message) {
                  const errMsg = parsed.error.message.toLowerCase();
                  if (errMsg.includes("key is") || errMsg.includes("invalid") || errMsg.includes("permission")) {
                    cleanMsg = `Gemini API Error: ${parsed.error.message}`;
                  } else {
                    // Try to identify other errors if they are not key-related
                    cleanMsg = "";
                  }
                }
              } catch (_) {}
            }

            if (isFatalKeyError && cleanMsg) {
              diagLog("Pre-flight API key check failed with fatal authorization error: " + cleanMsg, { rawError: rawErrorMsg });
              if (clientWs.readyState === clientWs.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'error',
                  error: cleanMsg
                }));
              }
              return;
            } else {
              // Non-blocking for 503 (high demand), 429 (rate limit), or other transient service loads
              diagLog("Pre-flight check encountered a non-authorization transient error. Bypassing check and initiating Live Connection anyway.", { rawError: rawErrorMsg });
            }
          }

          const activeRole = agentRole || "Executive Recruiter";
          const activeBio = agentBio || `${recruiterName} is an elegant senior corporate recruiter in her late 30s. Soft-spoken, highly professional, analytical, and supportive.`;

          const systemInstruction = buildSystemInstruction({
            recruiterName,
            agentRole: activeRole,
            agentBio: activeBio,
            candidateFirstName,
            clientInfo: clientInfo || "A selective industry-leading organization seeking premier talent.",
            priorConversation,
            zoomMeetActive,
            zoomMeetUrl,
            googleMeetActive,
            googleMeetUrl,
            phoneCallActive,
            phoneNumber,
          });

          if (modelEngine === 'elevenlabs') {
            cachedSetupParams = {
              systemInstruction,
              recruiterName,
              candidateFirstName,
              candidateLastName,
              agentRole,
              priorConversation
            };
            diagLog("ElevenLabs hybrid setup cached on backend.");
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'status',
                status: 'ready',
                message: 'ElevenLabs Hybrid Connection Active'
              }));
            }
            return;
          }

          try {
            diagLog("Attempting connection to Gemini Live API...");
            session = await ai.live.connect({
              model: "gemini-3.1-flash-live-preview",
              callbacks: {
                onopen: () => {
                  diagLog("Connected server-side to Gemini Live API");
                },
                onclose: () => {
                  diagLog("Server session close callback triggered");
                  clientWs.close();
                },
                onerror: (err: any) => {
                  diagLog("Gemini server-side Live API error:", { error: err.stack || err.message || err });
                  if (clientWs.readyState === clientWs.OPEN) {
                    clientWs.send(JSON.stringify({ type: 'error', error: err.message || 'Gemini API Connection Error' }));
                  }
                },
                onmessage: (message: LiveServerMessage) => {
                  const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                  const text = message.serverContent?.modelTurn?.parts?.[0]?.text;
                  const isInterrupted = message.serverContent?.interrupted;
                  const turnComplete = message.serverContent?.turnComplete;

                  if (clientWs.readyState === clientWs.OPEN) {
                    clientWs.send(JSON.stringify({
                      audio: audio || null,
                      transcription: text || null,
                      interrupted: isInterrupted || false,
                      turnComplete: turnComplete || false
                    }));
                  }
                }
              },
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } }
                },
                systemInstruction,
                outputAudioTranscription: {},
              }
            });
            diagLog("Gemini live session initialization trigger completed successfully");
          } catch (connectErr: any) {
            diagLog("Error establishing Gemini Live proxy connect:", { error: connectErr.stack || connectErr.message || connectErr });
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ type: 'error', error: connectErr.message || "Failed to initiate Gemini Live connection." }));
            }
          }
        } else if (payload.type === 'user-message' && modelEngine === 'elevenlabs') {
          if (isProcessingElevenLabs) {
            diagLog("Already generating feedback under ElevenLabs scope. Let it complete.");
            return;
          }
          isProcessingElevenLabs = true;
          try {
            const currentApiKey = getApiKey();
            if (!currentApiKey) {
              throw new Error("No Gemini API Key found for Model B.");
            }
            const elKey = elevenLabsApiKey || process.env.ELEVENLABS_API_KEY;
            if (!elKey) {
              throw new Error("Missing ElevenLabs API Key. Please configure your ElevenLabs API Key in the settings drawer or add it to system secrets.");
            }

            const ai = new GoogleGenAI({
              apiKey: currentApiKey,
              httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
            });

            diagLog(`[ElevenLabs Mode] Input: "${payload.text}"`);

            const response = await ai.models.generateContent({
              model: "gemini-3.5-flash",
              config: {
                systemInstruction: cachedSetupParams?.systemInstruction || "You are a helpful recruitment partner.",
                maxOutputTokens: 200,
                temperature: 0.7
              },
              contents: [
                ...(payload.priorConversation ? [{ role: 'user', parts: [{ text: payload.priorConversation }] }] : []),
                { role: 'user', parts: [{ text: `User spoken message: "${payload.text}". Keep your response organic, warm, and highly professional. Limit to 1 to 3 short sentences.` }] }
              ]
            });

            const txt = response.text || "";
            diagLog(`[ElevenLabs Mode] Reply Text: "${txt}"`);

            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({
                transcription: txt
              }));
            }

            const voiceIdToUse = elevenLabsVoiceId || '21m00Tcm4TlvDq8ikWAM';
            const elUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceIdToUse}/stream?output_format=pcm_16000`;
            diagLog(`Sending text to ElevenLabs stream...`);

            const ttsRes = await fetch(elUrl, {
              method: 'POST',
              headers: {
                'xi-api-key': elKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                text: txt,
                model_id: 'eleven_turbo_v2_5',
                voice_settings: {
                  stability: 0.5,
                  similarity_boost: 0.75
                }
              })
            });

            if (!ttsRes.ok) {
              const errBody = await ttsRes.text();
              throw new Error(`ElevenLabs Synthesis Error: ${errBody || ttsRes.statusText}`);
            }

            if (ttsRes.body) {
              const bIterable = ttsRes.body as any;
              if (typeof bIterable[Symbol.asyncIterator] === 'function') {
                for await (const chunk of bIterable) {
                  if (clientWs.readyState === clientWs.OPEN) {
                    clientWs.send(JSON.stringify({
                      audio: Buffer.from(chunk).toString('base64')
                    }));
                  }
                }
              } else {
                const reader = bIterable.getReader();
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  if (value) {
                    if (clientWs.readyState === clientWs.OPEN) {
                      clientWs.send(JSON.stringify({
                        audio: Buffer.from(value).toString('base64')
                      }));
                    }
                  }
                }
              }
            }

            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({
                turnComplete: true
              }));
            }

          } catch (err: any) {
            diagLog("ElevenLabs flow error:", { error: err.stack || err.message || err });
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'error',
                error: err.message || "ElevenLabs flow crashed."
              }));
            }
          } finally {
            isProcessingElevenLabs = false;
          }
        } else if (payload.audio && session) {
          session.sendRealtimeInput({
            audio: { data: payload.audio, mimeType: 'audio/pcm;rate=16000' }
          });
        }
      } catch (wsErr: any) {
        diagLog("WebSocket payload error on server:", { error: wsErr.stack || wsErr.message || wsErr });
      }
    });

    clientWs.on("close", () => {
      diagLog("WebSocket client disconnected");
      if (session) {
        session.close();
      }
    });

    clientWs.on("error", (err: any) => {
      diagLog("WebSocket client connection error:", { error: err.stack || err.message || err });
      if (session) {
        session.close();
      }
    });
  });

  // Handle Twilio stream connections
  twilioWss.on("connection", (twilioWs) => {
    diagLog("Twilio: Gateway WebSocket connected successfully.");
    let streamSid: string | null = null;
    let callSid: string | null = null;
    let geminiSession: any = null;

    twilioWs.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        if (msg.event === "start") {
          streamSid = msg.start.streamSid;
          callSid = msg.start.callSid;
          diagLog(`Twilio: stream started | StreamSid = ${streamSid} | CallSid = ${callSid}`);

          // Retrieve memory configs for this call
          const config = activeCalls.get(callSid!) || {};
          const selectedVoice = config.selectedVoice || "Kore";
          const recruiterName = config.recruiterName || "Lisa";
          const candidateFirstName = config.candidateFirstName || "Jane";
          const candidateLastName = config.candidateLastName || "Doe";
          const currentTitle = config.currentTitle || "";
          const currentCompany = config.currentCompany || "";
          const enterpriseCapability = config.enterpriseCapability || "";
          const marketRelevance = config.marketRelevance || "";
          const agentRole = config.agentRole || "Executive Recruiter";
          const priorConversation = config.priorConversation || "";
          const agentBio = config.agentBio || "";
          const clientInfo = config.clientInfo || "";
          const zoomMeetUrl = config.zoomMeetUrl || "";
          const zoomMeetActive = config.zoomMeetActive || false;
          const googleMeetUrl = config.googleMeetUrl || "";
          const googleMeetActive = config.googleMeetActive || false;

          const currentApiKey = getApiKey();
          if (!currentApiKey) {
            diagLog("Twilio: stream connection rejected. Gemini API Key is missing.");
            twilioWs.close();
            return;
          }

          const ai = new GoogleGenAI({
            apiKey: currentApiKey,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
          });

          const systemInstruction = buildSystemInstruction({
            recruiterName,
            agentRole: agentRole || "Executive Recruiter",
            agentBio: agentBio || `${recruiterName} is an elegant corporate specialist. Soft-spoken, professional, supportive, and active listener.`,
            candidateFirstName,
            clientInfo: clientInfo || "A selective industry-leading organization seeking premier talent.",
            priorConversation,
            zoomMeetActive,
            zoomMeetUrl,
            googleMeetActive,
            googleMeetUrl,
            isPhoneLine: true,
          });

          diagLog("Twilio: Connecting live streaming channel to Gemini Live API...");
          try {
            geminiSession = await ai.live.connect({
              model: "gemini-3.1-flash-live-preview",
              callbacks: {
                onopen: async () => {
                  diagLog("Twilio: Connected successfully to Gemini Live API session.");
                  
                  // Instantly prompt Gemini to greet the contact naturally
                  try {
                    await geminiSession.send({
                      clientContent: {
                        turns: [{
                          role: "user",
                          parts: [{ text: "Hello, call answered. Please introduce yourself and start the call." }]
                        }],
                        turnComplete: true
                      }
                    });
                    diagLog("Twilio: Greeting trigger sent successfully to Gemini Live session");
                  } catch (introErr: any) {
                    diagLog("Twilio: Failed to send dynamic greeting trigger", introErr);
                  }
                },
                onclose: () => {
                  diagLog("Twilio: Gemini session closed");
                  twilioWs.close();
                },
                onerror: (err: any) => {
                  diagLog(`Twilio: Gemini session error: ${err.message || err}`);
                },
                onmessage: (message: LiveServerMessage) => {
                  const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                  const isInterrupted = message.serverContent?.interrupted;

                  if (isInterrupted && streamSid) {
                    diagLog(`Twilio Interruption: Clearing audio stream buffer on stream ${streamSid}`);
                    if (twilioWs.readyState === twilioWs.OPEN) {
                      twilioWs.send(JSON.stringify({
                        event: "clear",
                        streamSid: streamSid
                      }));
                    }
                  }

                  if (audio && streamSid) {
                    // Convert raw 24kHz PCM to 8kHz mu-law
                    const rPcm24 = Buffer.from(audio, "base64");
                    const pcm24 = new Int16Array(rPcm24.buffer, rPcm24.byteOffset, rPcm24.byteLength / 2);
                    const length8k = Math.floor(pcm24.length / 3);
                    const outMulaw = Buffer.alloc(length8k);
                    
                    for (let i = 0; i < length8k; i++) {
                      outMulaw[i] = encodeMulaw(pcm24[i * 3]);
                    }

                    if (twilioWs.readyState === twilioWs.OPEN) {
                      twilioWs.send(JSON.stringify({
                        event: "media",
                        streamSid: streamSid,
                        media: {
                          payload: outMulaw.toString("base64")
                        }
                      }));
                    }
                  }
                }
              },
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } }
                },
                systemInstruction,
                outputAudioTranscription: {},
              }
            });
          } catch (cErr: any) {
            diagLog("Twilio: error setting up Gemini Live session:", cErr);
            twilioWs.close();
          }

        } else if (msg.event === "media" && geminiSession) {
          // Convert incoming mu-law (8kHz) to PCM Linear16 (16kHz)
          const mulawPayload = Buffer.from(msg.media.payload, "base64");
          const p16 = new Int16Array(mulawPayload.length * 2);
          
          for (let i = 0; i < mulawPayload.length; i++) {
            const rawSample = decodeMulaw(mulawPayload[i]);
            // Duplicate sample for linear 2x upsampling (8kHz -> 16kHz)
            p16[i * 2] = rawSample;
            p16[i * 2 + 1] = rawSample;
          }

          const b64Data = Buffer.from(p16.buffer, p16.byteOffset, p16.byteLength).toString("base64");
          geminiSession.sendRealtimeInput({
            audio: { data: b64Data, mimeType: "audio/pcm;rate=16000" }
          });

        } else if (msg.event === "stop") {
          diagLog(`Twilio: stream stopped event received.`);
          if (geminiSession) {
            geminiSession.close();
          }
        }
      } catch (err: any) {
        diagLog("Twilio error parsing WebSocket payload:", err);
      }
    });

    twilioWs.on("close", () => {
      diagLog("Twilio: WebSocket server connection closed.");
      if (geminiSession) {
        geminiSession.close();
      }
    });

    twilioWs.on("error", (err: any) => {
      diagLog("Twilio: WebSocket server connection error:", err);
      if (geminiSession) {
        geminiSession.close();
      }
    });
  });

  // Outbound Telephone Triggering Endpoint via Twilio API
  app.post("/api/twilio/call", async (req, res) => {
    const {
      phoneNumber,
      twilioAccountSid,
      twilioAuthToken,
      twilioPhoneNumber,

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
      zoomMeetUrl,
      zoomMeetActive,
      googleMeetUrl,
      googleMeetActive
    } = req.body;

    const twilio = getTwilioConfig({ twilioAccountSid, twilioAuthToken, twilioPhoneNumber });
    const { sid: activeSid, token: activeToken, from: activeFrom } = twilio;

    if (!activeSid || !activeToken || !activeFrom) {
      return res.status(400).json({ error: "Missing Twilio credentials. Please make sure Twilio Account SID, Auth Token, and Twilio Outbound Number are all set up." });
    }

    if (!phoneNumber) {
      return res.status(400).json({ error: "Destination target phone number is missing." });
    }

    diagLog(`Twilio Call request initiated: ${phoneNumber} | From: ${activeFrom}`);

    const auth = Buffer.from(`${activeSid}:${activeToken}`).toString("base64");

    try {
      const appUrl = getPublicAppUrl(req);

      if (isLocalhostUrl(appUrl)) {
        return res.status(400).json({
          error:
            'Twilio cannot call localhost. Add APP_URL to .env.local with your public HTTPS URL (e.g. from ngrok: https://your-subdomain.ngrok-free.app), restart the server, then try again.',
        });
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${activeSid}/Calls.json`;
      const response = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          To: phoneNumber,
          From: activeFrom,
          Url: `${appUrl}/api/twilio/twiml`
        })
      });

      if (!response.ok) {
        const rawRes = await response.text();
        diagLog(`Twilio Trigger Error Response:`, rawRes);
        return res.status(500).json({ error: `Twilio API: ${rawRes}` });
      }

      const data: any = await response.json();
      const callSid = data.sid;
      diagLog(`Twilio Call Trigger Success! CallSid: ${callSid}`);

      // Synchronize memory profiles match
      activeCalls.set(callSid, {
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
        zoomMeetUrl,
        zoomMeetActive,
        googleMeetUrl,
        googleMeetActive
      });

      return res.json({ success: true, callSid, status: data.status });
    } catch (err: any) {
      diagLog("Twilio Server triggering error:", err);
      return res.status(500).json({ error: err.message || "Twilio outbound request error" });
    }
  });

  // Outbound Telephone Terminate Endpoint via Twilio API
  app.post("/api/twilio/hangup", async (req, res) => {
    const { callSid, twilioAccountSid, twilioAuthToken } = req.body;

    const { sid: activeSid, token: activeToken } = getTwilioConfig({ twilioAccountSid, twilioAuthToken });

    if (!callSid) {
      return res.status(400).json({ error: "Missing Call SID reference." });
    }
    if (!activeSid || !activeToken) {
      return res.status(400).json({ error: "Missing Twilio secrets to process termination." });
    }

    diagLog(`Twilio terminating active call: ${callSid}`);
    const auth = Buffer.from(`${activeSid}:${activeToken}`).toString("base64");

    try {
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${activeSid}/Calls/${callSid}.json`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({ Status: "completed" })
      });

      if (!response.ok) {
        const rawRes = await response.text();
        diagLog(`Twilio hangup failed:`, rawRes);
        return res.status(500).json({ error: `Could not terminate active trunk call: ${rawRes}` });
      }

      return res.json({ success: true });
    } catch (err: any) {
      diagLog("Twilio hangup server error:", err);
      return res.status(500).json({ error: err.message || "Failed to hang up active call." });
    }
  });

  // Twilio standard XML payload endpoints
  app.all("/api/twilio/twiml", (req, res) => {
    const appUrl = getPublicAppUrl(req);
    const streamUrl = toTwilioStreamUrl(appUrl);
    res.setHeader("Content-Type", "text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`);
  });

  // API health route
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", hasKey: !!getApiKey() });
  });

  // Route to view server diagnostics (development only)
  app.get("/api/logs", (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "Logs are disabled in production." });
    }
    try {
      const logPath = getLogPath();
      if (fs.existsSync(logPath)) {
        res.setHeader("Content-Type", "text/plain");
        res.sendFile(logPath);
      } else {
        res.status(404).send("No logs found.");
      }
    } catch (e: any) {
      res.status(500).send("Error reading logs: " + e.message);
    }
  });

  // Mount Vite middleware inside Dev, serve static dist inside Production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
    app.use('/api', (req, res) => {
      res.status(404).json({ error: 'API route not found.' });
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    diagLog(`Server running and listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  diagLog("Express startup issue caught at bottom:", err);
});
