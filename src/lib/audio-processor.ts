/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onData: (base64Data: string) => void;

  constructor(onData: (base64Data: string) => void) {
    this.onData = onData;
  }

  async start(deviceId?: string) {
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const constraints: MediaStreamConstraints = {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true
    };
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    const source = this.audioContext.createMediaStreamSource(this.stream);

    // Using ScriptProcessorNode for simplicity in this environment. 
    // AudioWorklet is better but requires a separate file which can be tricky to manage.
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = this.floatTo16BitPCM(inputData);
      const base64Data = this.arrayBufferToBase64(pcm16.buffer);
      this.onData(base64Data);
    };
  }

  stop() {
    this.processor?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    this.audioContext?.close();
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

export class AudioPlayer {
  private audioContext: AudioContext;
  private analyser: AnalyserNode | null = null;
  private onVolume?: (v: number) => void;
  private nextStartTime: number = 0;
  private sampleRate: number = 24000; // Gemini output sample rate
  private activeSources: Set<AudioBufferSourceNode> = new Set();

  constructor(onVolume?: (v: number) => void, speakerDeviceId?: string) {
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    this.onVolume = onVolume;

    if (speakerDeviceId && (this.audioContext as any).setSinkId) {
      (this.audioContext as any).setSinkId(speakerDeviceId).catch((err: any) => {
        console.error("Failed to set initial output speaker sinkId:", err);
      });
    }

    try {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.connect(this.audioContext.destination);

      if (this.onVolume) {
        this.startVolumePolling();
      }
    } catch (e) {
      console.error("Failed to initialize AudioPlayer analyser:", e);
    }
  }

  async updateSpeaker(speakerDeviceId: string) {
    if ((this.audioContext as any).setSinkId) {
      try {
        await (this.audioContext as any).setSinkId(speakerDeviceId);
        console.log(`Speaker sink updated to: ${speakerDeviceId}`);
      } catch (err) {
        console.error("Trouble dynamically changing speaker sink ID:", err);
      }
    }
  }

  private startVolumePolling() {
    if (!this.analyser || !this.onVolume) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    const poll = () => {
      if (!this.analyser || this.audioContext.state === 'closed') return;
      
      this.analyser.getByteTimeDomainData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const floatVal = (dataArray[i] - 128) / 128; // center around 0
        sum += floatVal * floatVal;
      }
      
      const rms = Math.sqrt(sum / dataArray.length);
      // smooth or cap the RMS slightly for smoother visual scaling
      this.onVolume?.(rms);
      requestAnimationFrame(poll);
    };
    
    requestAnimationFrame(poll);
  }

  playChunk(base64Data: string) {
    const binary = window.atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const buffer = this.audioContext.createBuffer(1, float32.length, this.sampleRate);
    buffer.getChannelData(0).set(float32);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    
    // Route source through the analyser if initialized
    if (this.analyser) {
      source.connect(this.analyser);
    } else {
      source.connect(this.audioContext.destination);
    }

    const startTime = Math.max(this.audioContext.currentTime, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + buffer.duration;

    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
    };
  }

  stopAll() {
    this.activeSources.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Source might have already stopped
      }
    });
    this.activeSources.clear();
    this.nextStartTime = this.audioContext.currentTime;
  }

  stop() {
    this.stopAll();
    try {
      this.audioContext.close();
    } catch (e) {
      // already closed
    }
  }
}
