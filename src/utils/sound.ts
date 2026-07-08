// Web Audio APIを用いたレトロ探偵風シンセサイザーBGM・効果音（SE）生成クラス
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private bgmIntervalId: number | null = null;
  private currentBgmNodes: { base: OscillatorNode; gain: GainNode }[] = [];
  private bpm: number = 105;
  private beatCount: number = 0;

  // ウォーキングベース用のジャジーなコード進行 (Am - Dm - E7 - Am)
  // 1拍ごとに鳴らすノートの周波数
  private bassNotes: number[][] = [
    [110.00, 130.81, 146.83, 164.81], // A2 -> C3 -> D3 -> E3
    [146.83, 174.61, 196.00, 220.00], // D3 -> F3 -> G3 -> A3
    [164.81, 207.65, 246.94, 196.00], // E3 -> G#3 -> B3 -> G3
    [110.00, 164.81, 130.81, 123.47]  // A2 -> E3 -> C3 -> B2
  ];

  constructor() {
    // クライアントサイドでのみ動作するように初期化
    if (typeof window !== "undefined") {
      // ユーザーのローカルストレージからミュート設定を復元
      const savedMute = localStorage.getItem("prompt_noir_mute");
      this.isMuted = savedMute === "true";
    }
  }

  private init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public setMute(mute: boolean) {
    this.isMuted = mute;
    if (typeof window !== "undefined") {
      localStorage.setItem("prompt_noir_mute", mute ? "true" : "false");
    }
    if (mute) {
      this.stopBGM();
    } else {
      this.startBGM();
    }
  }

  public getMuteStatus(): boolean {
    return this.isMuted;
  }

  // BGMの開始 (レトロなウッドベース調のウォーキングベース & 軽めバッキング)
  public startBGM() {
    this.init();
    if (this.isMuted || !this.ctx) return;
    if (this.bgmIntervalId) return; // 既に再生中

    const intervalMs = (60 / this.bpm) * 1000;
    this.beatCount = 0;

    const playBeat = () => {
      if (!this.ctx || this.isMuted) return;

      const time = this.ctx.currentTime;
      const measure = Math.floor(this.beatCount / 4) % this.bassNotes.length;
      const step = this.beatCount % 4;
      const frequency = this.bassNotes[measure][step];

      // 1. ウッドベースを模したサイン波＋三角波の極太低音
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = "triangle";
      osc.frequency.setValueAtTime(frequency / 2, time); // 低音オクターブ下
      
      // 指で弾くピチカートの音量エンベロープ (立ち上がり速く、じわっと減衰)
      gain.gain.setValueAtTime(0.0, time);
      gain.gain.linearRampToValueAtTime(0.25, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

      // 高域をローパスフィルタで削って、レトロで温かみのあるアコースティック感を出す
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(350, time);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.6);

      // 2. 偶数拍（2拍目、4拍目）にジャジーなバッキングオルガンを小さく鳴らす
      if (step === 1 || step === 3) {
        this.playOrganBacking(measure, time);
      }

      this.beatCount++;
    };

    // 初回拍を鳴らす
    playBeat();
    this.bgmIntervalId = window.setInterval(playBeat, intervalMs);
  }

  // 偶数拍の柔らかいオルガン風のバッキングコード
  private playOrganBacking(measure: number, time: number) {
    if (!this.ctx) return;

    // Am, Dm, E7, Amに対応するコードトーン (高めの帯域で鳴らす)
    const chords: number[][] = [
      [220.00, 261.63, 329.63], // Am (A3, C4, E4)
      [220.00, 293.66, 349.23], // Dm (A3, D4, F4)
      [246.94, 311.13, 392.00], // E7 (B3, D#4, G4)
      [220.00, 261.63, 329.63]  // Am (A3, C4, E4)
    ];

    const chord = chords[measure];
    chord.forEach((freq) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // サイン波と三角波のミックスを模した柔らかい矩形波＋ローパスフィルタ
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.0, time);
      gain.gain.linearRampToValueAtTime(0.03, time + 0.05); // かなり控えめな音量
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(600, time);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.5);
    });
  }

  // BGMの停止
  public stopBGM() {
    if (this.bgmIntervalId) {
      window.clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }
  }

  // SE: 文節またはボタンをクリックした時 (古いタイプライターや木のクリック音)
  public playClick() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const time = this.ctx.currentTime;
    
    // 1. カチッという高音ピッチの短い矩形波
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1200, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.03);

    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(time);
    osc.stop(time + 0.04);

    // 2. 乾いたタイプライター風のノイズ成分
    try {
      const bufferSize = this.ctx.sampleRate * 0.02; // 20ms
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(2000, time);
      noiseFilter.Q.setValueAtTime(3, time);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.08, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start(time);
      noise.stop(time + 0.025);
    } catch (e) {
      // 古いブラウザなどのエラーフォールバック
    }
  }

  // SE: 正解（謎を解き明かしたジャジーで澄んだチャイム音）
  public playCorrect() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const time = this.ctx.currentTime;
    // シャキーンと上がる小粋なジャズアルペジオ: A4 -> C5 -> E5 -> A5
    const notes = [440.00, 523.25, 659.25, 880.00];
    
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const noteTime = time + idx * 0.07;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.0, noteTime);
      gain.gain.linearRampToValueAtTime(0.15, noteTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.4);

      // 少しのビブラート効果（周波数を揺らす）
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(8, noteTime);
      lfoGain.gain.setValueAtTime(4, noteTime);
      
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      lfo.start(noteTime);
      osc.start(noteTime);
      
      lfo.stop(noteTime + 0.45);
      osc.stop(noteTime + 0.45);
    });
  }

  // SE: 不正解（シリアスなミュートトランペット調の不協和音スライド 「プゥーーン（下降）」）
  public playIncorrect() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const time = this.ctx.currentTime;
    
    // 不協和音トリオ: G#3 (207.65), A3 (220.00), D#4 (311.13)
    const baseFreqs = [207.65, 220.00, 311.13];

    baseFreqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // 金管楽器らしい歪みを出すため鋸歯状波（sawtooth）と三角波のミックスにローパス
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, time);
      // ピッチを下降させる（ノワール風がっかり感）
      osc.frequency.exponentialRampToValueAtTime(freq * 0.65, time + 0.65);

      gain.gain.setValueAtTime(0.0, time);
      gain.gain.linearRampToValueAtTime(0.12 - idx * 0.02, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.7);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(500, time);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.85);
    });
  }

  // SE: タイムアップ（レトロブザー音）
  public playTimeUp() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const time = this.ctx.currentTime;
    const duration = 0.8;

    // ジーーという金属的な低音ブザー
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(130, time); // 低音
    
    osc2.type = "square";
    osc2.frequency.setValueAtTime(133, time); // わずかにデチューンしてうねりを出す

    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(0.15, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(400, time);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(time);
    osc2.start(time);
    
    osc1.stop(time + duration);
    osc2.stop(time + duration);
  }

  // SE: チェンジ（紙をサッとめくる・カードをシャッフルする軽快なノイズシンセ）
  public playChange() {
    this.init();
    if (this.isMuted || !this.ctx) return;

    const time = this.ctx.currentTime;
    
    try {
      const duration = 0.25;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      // バンドパスフィルタを時間とともに高域へスイープさせ、「サッ」という音を再現
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.setValueAtTime(4, time);
      filter.frequency.setValueAtTime(800, time);
      filter.frequency.exponentialRampToValueAtTime(3000, time + duration);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0, time);
      gain.gain.linearRampToValueAtTime(0.15, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(time);
      noise.stop(time + duration);
    } catch (e) {
      // エラーフォールバック
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, time);
      osc.frequency.exponentialRampToValueAtTime(1200, time + 0.15);
      gain.gain.setValueAtTime(0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(time);
      osc.stop(time + 0.16);
    }
  }
}

export const sound = new SoundEngine();
