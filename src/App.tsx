import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Brain,
  ShieldAlert,
  HelpCircle,
  Clock,
  Heart,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Award,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  XCircle,
  Compass,
  ArrowRight,
  RefreshCw,
  Volume2,
  VolumeX,
  FileText,
  Search,
  Fingerprint
} from "lucide-react";

import { sound } from "./utils/sound";

// Types corresponding to questions
interface Question {
  id: string;
  theme: string;
  difficulty: string;
  title: string;
  segments: string[];
  incorrect_segment_index: number;
  original_incorrect_text: string;
  correct_fact: string;
  explanation: string;
  baseId?: string;
}

import { PREMADE_QUESTIONS } from "./questions";

type GameState = "START" | "LOADING" | "PLAYING" | "FEEDBACK" | "RESULT";

type ThemeType = "random" | "history" | "science" | "it_tech" | "trivia" | "fraud_prevention" | "logic_flaw";

const THEMES = [
  { id: "random", name: "ランダム捜査", icon: Compass, desc: "全ジャンルからランダムに配属された未解決事件に挑みます。" },
  { id: "fraud_prevention", name: "詐欺・偽装工作", icon: ShieldAlert, desc: "不審なメールや架空請求に潜む、巧妙な騙しの手口を見抜きます。" },
  { id: "logic_flaw", name: "論理の陥穽", icon: Brain, desc: "因果関係の混同や飛躍、極端な一般化による誤謬を暴きます。" },
  { id: "history", name: "歴史の捏造", icon: Award, desc: "もっともらしく書き換えられた歴史的事件や人物の「偽情報」を検分します。" },
  { id: "science", name: "疑似科学の罠", icon: Sparkles, desc: "科学的な事実や自然現象に関する誤った言説・ハルシネーションを見抜きます。" },
  { id: "it_tech", name: "IT・技術欺瞞", icon: Lightbulb, desc: "デジタル仕様やIT用語に関するもっともらしい技術的嘘を見抜きます。" },
  { id: "trivia", name: "世間の迷信", icon: HelpCircle, desc: "一般常識やトリビアに紛れ込んだ根拠のない「俗説」を暴きます。" }
];

export default function App() {
  const [gameState, setGameState] = useState<GameState>("START");
  const [selectedTheme, setSelectedTheme] = useState<ThemeType>("random");
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0); // 0 to 5
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isCorrectFeedback, setIsCorrectFeedback] = useState<boolean>(false);
  const [feedbackType, setFeedbackType] = useState<"CORRECT" | "INCORRECT" | "TIMEOUT">("CORRECT");
  const [difficultyHistory, setDifficultyHistory] = useState<string[]>([]);
  const [seenQuestionIds, setSeenQuestionIds] = useState<string[]>([]);
  const [hasChangedThisQuestion, setHasChangedThisQuestion] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Typewriter state variables
  const [typingProgress, setTypingProgress] = useState<number>(0);
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return sound.getMuteStatus();
    }
    return false;
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean timer & sound on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      sound.stopBGM();
    };
  }, []);

  // Control BGM based on game state and mute status
  useEffect(() => {
    const activeBgmStates: GameState[] = ["PLAYING", "FEEDBACK", "LOADING"];
    if (activeBgmStates.includes(gameState) && !isMuted) {
      sound.startBGM();
    } else {
      sound.stopBGM();
    }
  }, [gameState, isMuted]);

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    sound.setMute(nextMute);
    if (!nextMute) {
      sound.playClick();
    }
  };

  // Timer countdown logic
  useEffect(() => {
    if (gameState === "PLAYING" && !isTyping) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState, isTyping]);

  // Typewriter animation effect when question loads
  useEffect(() => {
    if (gameState === "PLAYING" && currentQuestion) {
      setIsTyping(true);
      setTypingProgress(0);
      
      const fullTextLength = currentQuestion.segments.reduce((acc, s) => acc + s.length, 0);
      let progress = 0;
      
      const interval = setInterval(() => {
        progress += 1;
        setTypingProgress(progress);
        
        // Play typewriter click mechanical sound on character increments (periodically to feel organic)
        if (progress % 2 === 0) {
          sound.playClick();
        }
        
        if (progress >= fullTextLength) {
          clearInterval(interval);
          setIsTyping(false);
        }
      }, 30); // 30ms per character for brisk typing feel
      
      return () => clearInterval(interval);
    } else {
      setIsTyping(false);
      setTypingProgress(0);
    }
  }, [gameState, currentQuestion?.id]);

  // Immediately display the entire text (Skip typing)
  const handleSkipTyping = () => {
    if (isTyping && currentQuestion) {
      const fullTextLength = currentQuestion.segments.reduce((acc, s) => acc + s.length, 0);
      setTypingProgress(fullTextLength);
      setIsTyping(false);
      sound.playClick();
    }
  };

  // Helper to slice and display typed text for a segment
  const getTypedSegmentContent = (segments: string[], currentIndex: number) => {
    let prevLengthSum = 0;
    for (let i = 0; i < currentIndex; i++) {
      prevLengthSum += segments[i].length;
    }
    
    const segmentText = segments[currentIndex];
    if (typingProgress <= prevLengthSum) {
      return "";
    }
    const typedInThisSegment = typingProgress - prevLengthSum;
    return segmentText.substring(0, typedInThisSegment);
  };

  // Helper to check if typewriter cursor is currently typing inside this segment
  const isCaretInSegment = (segments: string[], currentIndex: number) => {
    if (!isTyping) return false;
    let prevLengthSum = 0;
    for (let i = 0; i < currentIndex; i++) {
      prevLengthSum += segments[i].length;
    }
    const segmentLength = segments[currentIndex].length;
    return typingProgress > prevLengthSum && typingProgress <= prevLengthSum + segmentLength;
  };

  // Generate dynamic difficulty
  const getRandomDifficulty = () => {
    return Math.random() > 0.5 ? "hard" : "normal";
  };

  // Load question from local data
  const loadNextQuestion = (theme: ThemeType, index: number, currentSeenIds: string[]) => {
    setGameState("LOADING");
    setErrorMsg(null);
    const difficulty = getRandomDifficulty();

    setTimeout(() => {
      try {
        const targetTheme = theme || "random";
        const targetDifficulty = difficulty || "normal";
        const excludedIds = currentSeenIds || [];

        let selectedThemeKey = targetTheme;
        
        if (targetTheme === "random" || !PREMADE_QUESTIONS[targetTheme]) {
          const keys = Object.keys(PREMADE_QUESTIONS);
          selectedThemeKey = keys[Math.floor(Math.random() * keys.length)] as ThemeType;
        } else {
          selectedThemeKey = targetTheme;
        }

        const questionList = PREMADE_QUESTIONS[selectedThemeKey] || [];
        
        let filteredList = questionList.filter(
          (q) => q.difficulty === targetDifficulty && !excludedIds.includes(q.id)
        );

        if (filteredList.length === 0) {
          filteredList = questionList.filter((q) => !excludedIds.includes(q.id));
        }

        if (filteredList.length === 0) {
          filteredList = questionList.filter((q) => q.difficulty === targetDifficulty);
        }

        if (filteredList.length === 0) {
          filteredList = questionList;
        }

        if (filteredList.length === 0) {
          throw new Error("問題が見つかりませんでした。");
        }

        const randomQuestion = filteredList[Math.floor(Math.random() * filteredList.length)];

        const questionData: Question = {
          ...randomQuestion,
          id: `${randomQuestion.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          baseId: randomQuestion.id,
        };

        setCurrentQuestion(questionData);
        setDifficultyHistory((prev) => [...prev, questionData.difficulty]);
        setSeenQuestionIds((prev) => [...prev, randomQuestion.id]);

        setSelectedIndex(null);
        setTimeLeft(60);
        setGameState("PLAYING");
      } catch (err: any) {
        console.error(err);
        setErrorMsg("捜査ファイルの抽出中にエラーが発生しました。");
        setTimeout(() => {
          setGameState("START");
        }, 1500);
      }
    }, 800); // 800ms to allow a smooth atmospheric load transition
  };

  const handleStartGame = () => {
    setScore(0);
    setLives(3);
    setCurrentQuestionIndex(0);
    setDifficultyHistory([]);
    setSeenQuestionIds([]);
    setHasChangedThisQuestion(false);
    loadNextQuestion(selectedTheme, 0, []);
  };

  const handleSegmentClick = (index: number) => {
    if (gameState !== "PLAYING" || !currentQuestion || isTyping) return;

    if (timerRef.current) clearInterval(timerRef.current);
    setSelectedIndex(index);

    sound.playClick();

    const isCorrect = index === currentQuestion.incorrect_segment_index;
    setIsCorrectFeedback(isCorrect);

    if (isCorrect) {
      setScore((prev) => prev + 1);
      setFeedbackType("CORRECT");
      sound.playCorrect();
    } else {
      setLives((prev) => prev - 1);
      setFeedbackType("INCORRECT");
      sound.playIncorrect();
    }

    setGameState("FEEDBACK");
  };

  const handleTimeout = () => {
    if (!currentQuestion) return;
    setSelectedIndex(null);
    setIsCorrectFeedback(false);
    setLives((prev) => prev - 1);
    setFeedbackType("TIMEOUT");
    sound.playTimeUp();
    setGameState("FEEDBACK");
  };

  const handleNextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;
    if (lives <= 0 || nextIndex >= 6) {
      setGameState("RESULT");
    } else {
      setCurrentQuestionIndex(nextIndex);
      setHasChangedThisQuestion(false);
      loadNextQuestion(selectedTheme, nextIndex, seenQuestionIds);
    }
  };

  const handleChangeQuestion = () => {
    if (!currentQuestion || gameState !== "PLAYING" || hasChangedThisQuestion || isTyping) return;
    
    sound.playChange();
    
    const realId = currentQuestion.baseId || currentQuestion.id;
    const nextSeenIds = [...seenQuestionIds];
    if (!nextSeenIds.includes(realId)) {
      nextSeenIds.push(realId);
    }
    setSeenQuestionIds(nextSeenIds);
    setHasChangedThisQuestion(true);
    
    loadNextQuestion(selectedTheme, currentQuestionIndex, nextSeenIds);
  };

  const getRank = (finalScore: number) => {
    if (finalScore === 6) return { title: "極秘特等：AIマスターファクトチェッカー", color: "text-emerald-400 border-emerald-950/40 bg-emerald-950/20", desc: "お見事！AIが編み出したあらゆる論理の罠、巧妙なハルシネーションを完璧に看破しました。現代社会において最高峰の情報リテラシーを証明するSSS級の知性です。" };
    if (finalScore === 5) return { title: "一等捜査官：プロ級ファクトチェッカー", color: "text-amber-400 border-amber-950/40 bg-amber-950/20", desc: "極めて優秀な審美眼を持っています。巧妙に仕組まれた偽りのストーリーに惑わされず、冷静かつ迅速に事実を突き止める力があります。" };
    if (finalScore >= 3) return { title: "二等捜査官：中堅ファクトチェッカー", color: "text-blue-400 border-blue-950/40 bg-blue-950/20", desc: "十分な防衛判断力を有していますが、時おり「もっともらしい裏付け」に足をすくわれる危険があります。もう一歩、疑う目を鍛えましょう。" };
    if (finalScore >= 1) return { title: "三等捜査官：駆け出しファクトチェッカー", color: "text-stone-400 border-stone-800 bg-stone-900/40", desc: "AIの流麗な語り口や、日常に潜む罠の甘い言葉に惑わされがちです。真実を見出すための習慣をここで培っていきましょう。" };
    return { title: "被疑者：騙されやすき市民", color: "text-rose-500 border-rose-950/40 bg-rose-950/20", desc: "危険信号です！もっともらしいフェイクを全て信じ込んでしまう恐れがあります。まずは立ち止まり、この「プロンプト・ノワール」でリテラシーを鍛え直してください。" };
  };

  return (
    <div id="app-container" className="min-h-screen bg-[#0d0d0c] text-stone-200 font-sans flex flex-col justify-between selection:bg-amber-900/30 selection:text-amber-200 paper-texture relative overflow-x-hidden">
      
      {/* Visual background atmospheric elements - brass-colored dim radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-amber-950/10 rounded-full blur-[120px] pointer-events-none"></div>

      <header className="max-w-4xl mx-auto w-full px-6 pt-6 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-[#1f1e1a] text-[#d4af37] p-2 rounded-lg border border-stone-800 shadow-inner">
              <Brain className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-sm tracking-[0.2em] font-bold uppercase text-stone-200">PROMPT NOIR</span>
              <span className="text-[9px] font-mono tracking-widest text-[#d4af37]/70 uppercase">Fact Investigation Bureau</span>
            </div>
          </div>

          <button
            onClick={handleToggleMute}
            className="flex items-center justify-center p-2 rounded-lg hover:bg-stone-900 active:bg-stone-950 border border-transparent hover:border-stone-800 transition-all duration-150 text-stone-500 hover:text-[#d4af37] cursor-pointer"
            title={isMuted ? "ミュート解除" : "ミュート"}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-500 animate-pulse" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Dashboard Indicators during Game */}
        {(gameState === "PLAYING" || gameState === "FEEDBACK") && (
          <div className="flex items-center gap-4">
            {/* Clock Indicator */}
            <div className="flex items-center gap-2 bg-[#171613] border border-stone-800 px-3 py-1.5 rounded-md shadow-inner">
              <Clock className={`w-4 h-4 ${timeLeft <= 15 ? "text-rose-500 animate-pulse" : "text-stone-500"}`} />
              <span className={`font-mono text-sm font-bold ${timeLeft <= 15 ? "text-rose-500" : "text-stone-300"}`}>
                {timeLeft}s
              </span>
            </div>

            {/* Lives Indicator (Vintage Bulbs) */}
            <div className="flex items-center gap-2 bg-[#171613] border border-stone-800 px-3 py-1.5 rounded-md shadow-inner">
              <span className="text-[10px] text-stone-500 font-mono tracking-wider">BULBS:</span>
              <div className="flex gap-1.5">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="relative flex items-center justify-center">
                    <Heart
                      className={`w-4 h-4 transition-all duration-300 ${
                        i < lives 
                          ? "fill-[#d4af37] text-[#d4af37] drop-shadow-[0_0_6px_rgba(212,175,55,0.6)] scale-100" 
                          : "text-stone-800 fill-transparent scale-90"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 flex flex-col justify-center relative z-10">
        <AnimatePresence mode="wait">
          
          {/* 1. START SCREEN (The Detective Agency Desk) */}
          {gameState === "START" && (
            <motion.div
              key="start"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="space-y-4 text-center md:text-left">
                <div className="inline-flex items-center gap-1.5 text-[#d4af37] text-xs font-mono tracking-[0.3em] uppercase bg-amber-950/20 px-2.5 py-1 rounded-full border border-amber-900/30">
                  <Fingerprint className="w-3.5 h-3.5" /> Special Investigation Unit
                </div>
                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight font-serif">
                  プロンプト・ノワール
                </h1>
                <p className="text-lg md:text-xl font-medium text-stone-400 tracking-wide mt-1">
                  〜 嘘つきAIが放つ「ファクトエラー」の容疑箇所を特定せよ 〜
                </p>
                <p className="text-stone-400 text-sm md:text-base max-w-2xl leading-relaxed">
                  深夜の探偵デスクに配属された、不審な言説データの数々。一見もっともらしく完璧に見える文章に、**たった1箇所だけ**「事実誤認（ハルシネーション）」や「論理の飛躍」が仕組まれています。
                  文字が打ち込まれる資料を鋭く精査し、容疑パーツを直接クリックして暴いてください。
                </p>
              </div>

              {/* Theme Selector (Folders style) */}
              <div className="bg-[#141311] border border-stone-900 rounded-xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center gap-2 border-b border-stone-800 pb-3">
                  <Search className="w-4 h-4 text-[#d4af37]" />
                  <h2 className="font-mono text-xs font-bold text-stone-400 tracking-widest uppercase">事件ファイル（調査ジャンル）を選択</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {THEMES.map((theme) => {
                    const IconComp = theme.icon;
                    const isSelected = selectedTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => {
                          setSelectedTheme(theme.id as ThemeType);
                          sound.playClick();
                        }}
                        className={`flex items-start text-left p-3.5 rounded-lg border transition-all duration-200 group relative ${
                          isSelected
                            ? "bg-[#211f1b] text-white border-[#d4af37] shadow-[0_0_15px_rgba(212,175,55,0.08)]"
                            : "bg-[#0f0e0d] text-stone-400 border-stone-900 hover:bg-[#151412] hover:border-stone-800"
                        }`}
                      >
                        <div className={`p-2 rounded-md mr-3 shrink-0 ${isSelected ? "bg-[#d4af37] text-[#121212]" : "bg-[#171614] text-stone-400 border border-stone-800"}`}>
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div>
                          <p className={`font-bold text-sm ${isSelected ? "text-stone-100" : "text-stone-300"}`}>{theme.name}</p>
                          <p className="text-xs mt-1 leading-relaxed text-stone-500 group-hover:text-stone-400">
                            {theme.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer configuration desk details */}
              <div className="flex flex-col md:flex-row items-center gap-6 justify-between pt-5 border-t border-stone-900">
                <div className="flex gap-8 text-[11px] text-stone-500 font-mono">
                  <div>
                    <span className="block text-stone-600">TIME ALLOWED</span>
                    <span className="font-bold text-stone-400">1件あたり 60秒</span>
                  </div>
                  <div>
                    <span className="block text-stone-600">STAGES</span>
                    <span className="font-bold text-stone-400">全 6 件の検証</span>
                  </div>
                  <div>
                    <span className="block text-stone-600">ALLOWED DAMAGE</span>
                    <span className="font-bold text-stone-400">3つの電球（ライフ）</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    sound.playClick();
                    handleStartGame();
                  }}
                  className="w-full md:w-auto bg-[#d4af37] hover:bg-[#ebd59b] active:bg-[#c49e29] text-stone-950 px-8 py-3.5 rounded-lg font-bold text-sm transition-all shadow-[0_4px_12px_rgba(212,175,55,0.2)] hover:shadow-[0_4px_20px_rgba(212,175,55,0.35)] flex items-center justify-center gap-2 group cursor-pointer"
                >
                  捜査ファイルを展開する
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </motion.div>
          )}

          {/* 2. LOADING SCREEN (Analyzing typewriter tape) */}
          {gameState === "LOADING" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center space-y-6 py-20"
            >
              <div className="relative flex items-center justify-center">
                <div className="w-14 h-14 border-2 border-stone-800 border-t-[#d4af37] rounded-full animate-spin"></div>
                <Search className="w-5 h-5 text-[#d4af37] absolute animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#d4af37]/80 animate-pulse">EXTRACTING EVIDENCE LOG</p>
                <h3 className="font-bold text-base text-stone-300">
                  AI発信データから「容疑文言」を構成中...
                </h3>
                <p className="text-xs text-stone-500 max-w-sm leading-relaxed">
                  検証用ファクトチェック・データバンクと、AIの記述した高密度なログ資料を同期しています。
                </p>
              </div>
            </motion.div>
          )}

          {/* 3. PLAYING & FEEDBACK SCREENS */}
          {(gameState === "PLAYING" || gameState === "FEEDBACK") && currentQuestion && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Question Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-900 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-[#d4af37] uppercase tracking-[0.25em] bg-amber-950/20 border border-amber-900/30 px-2 py-0.5 rounded">
                      CASE {currentQuestionIndex + 1} / 06
                    </span>
                    <span className={`text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded border ${
                      currentQuestion.difficulty === "hard"
                        ? "bg-rose-950/30 text-rose-400 border-rose-900/40"
                        : "bg-blue-950/30 text-blue-400 border-blue-900/40"
                    }`}>
                      {currentQuestion.difficulty === "hard" ? "要警戒 (難しめ)" : "一般案件 (普通)"}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white font-serif mt-1 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-stone-500" />
                    {currentQuestion.title}
                  </h2>
                </div>

                <span className="bg-[#1c1a17] text-stone-300 text-[11px] font-mono px-3 py-1 rounded border border-stone-800">
                  FILE: {currentQuestion.theme}
                </span>
              </div>

              {/* Instruction banner */}
              <p className="text-xs text-stone-400 leading-relaxed font-mono flex items-center gap-1.5 bg-[#141311] px-3 py-2 rounded border border-stone-900">
                <span className="inline-block w-2 h-2 bg-[#d4af37] rounded-full animate-ping"></span>
                {gameState === "PLAYING" 
                  ? (isTyping 
                    ? "📄 タイプライター打鍵中... クリックして早送りできます。" 
                    : "🔍 以下の文章の中で、もっともらしい「嘘（ハルシネーション）」が紛れている文節を1つ選んでください。")
                  : "💡 捜査結果：証言を精査し、正しい事実との対比を確認しましょう。"
                }
              </p>

              {/* The Case Document Paper (Investigative Document) */}
              <div 
                onClick={handleSkipTyping}
                className="bg-[#f4efe6] text-[#24211a] border-2 border-[#d6cbb5] rounded-lg p-6 md:p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] relative overflow-hidden paper-texture cursor-pointer group"
              >
                {/* Decorative retro confidentiality stamp */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none opacity-[0.03] rotate-12 scale-125">
                  <div className="border-8 border-red-900 px-6 py-4 rounded font-serif font-black text-7xl tracking-widest text-red-900 uppercase">
                    CLASSIFIED
                  </div>
                </div>

                {/* Left side red ledger line for aesthetic realism */}
                <div className="absolute top-0 left-6 w-[1px] h-full bg-red-400/20 pointer-events-none"></div>

                <div className="flex flex-wrap gap-x-2 gap-y-3.5 leading-relaxed text-base md:text-lg pl-4 relative z-10 select-none">
                  {currentQuestion.segments.map((segment, index) => {
                    const isSelected = selectedIndex === index;
                    const isIncorrectPart = index === currentQuestion.incorrect_segment_index;
                    
                    const typedText = getTypedSegmentContent(currentQuestion.segments, index);
                    const showCaret = isCaretInSegment(currentQuestion.segments, index);
                    
                    if (typedText === "") return null;

                    let segmentStyle = "bg-[#ebdcb9]/40 hover:bg-[#ebdcb9]/80 text-[#24211a] border-dashed border-[#bfae8f] hover:border-[#8f7d5c]";
                    
                    if (gameState === "FEEDBACK") {
                      if (isIncorrectPart) {
                        // Correctly found the error
                        segmentStyle = "bg-emerald-100 text-emerald-950 border-solid border-emerald-500 font-bold shadow-[0_0_8px_rgba(16,185,129,0.2)]";
                      } else if (isSelected && !isCorrectFeedback) {
                        // User chose a true fact incorrectly
                        segmentStyle = "bg-rose-100 text-rose-950 border-solid border-rose-400 line-through opacity-75 shadow-inner";
                      } else {
                        segmentStyle = "bg-[#fcfaf2]/20 text-stone-400 border-none opacity-40 cursor-not-allowed";
                      }
                    } else {
                      if (isTyping) {
                        segmentStyle = "bg-transparent border-transparent cursor-default pointer-events-none";
                      }
                    }

                    return (
                      <button
                        key={index}
                        disabled={gameState !== "PLAYING" || isTyping}
                        onClick={(e) => {
                          e.stopPropagation(); // Stop skipping trigger
                          handleSegmentClick(index);
                        }}
                        className={`px-2.5 py-1 rounded border transition-all duration-150 text-left font-typewriter tracking-wide relative ${segmentStyle}`}
                      >
                        <span>{typedText}</span>
                        {showCaret && <span className="inline-block w-2 h-4 bg-amber-800 animate-blink ml-1"></span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Skip Prompt during typing */}
              {isTyping && (
                <div className="text-center">
                  <button 
                    onClick={handleSkipTyping}
                    className="text-[11px] font-mono text-stone-500 hover:text-[#d4af37] bg-stone-950 border border-stone-900 rounded-md px-3 py-1 transition-colors"
                  >
                    ▶▶ クリックして文章を全て展開する
                  </button>
                </div>
              )}

              {/* Change Question (1 time only) */}
              {gameState === "PLAYING" && !isTyping && (
                <div className="flex justify-start px-1">
                  <button
                    onClick={handleChangeQuestion}
                    disabled={hasChangedThisQuestion}
                    className={`flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-2 rounded border transition-all shadow-sm ${
                      hasChangedThisQuestion
                        ? "text-stone-700 bg-transparent border-stone-900 cursor-not-allowed"
                        : "text-stone-400 hover:text-white bg-[#141311] hover:bg-[#1a1916] border-stone-800 hover:border-[#d4af37]/60 cursor-pointer"
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {hasChangedThisQuestion ? "チェンジ（使用済み）" : "別の事件に変更する (1回限り)"}
                  </button>
                </div>
              )}

              {/* FEEDBACK RESOLUTION PANEL */}
              {gameState === "FEEDBACK" && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className={`p-6 rounded-lg border-2 relative overflow-hidden flex flex-col md:flex-row items-start gap-5 ${
                    feedbackType === "CORRECT"
                      ? "bg-emerald-950/20 border-emerald-900/60 text-emerald-100"
                      : feedbackType === "TIMEOUT"
                        ? "bg-amber-950/20 border-amber-900/60 text-amber-100"
                        : "bg-rose-950/20 border-rose-900/60 text-rose-100"
                  }`}>
                    
                    {/* Retro Stamp Visual Effect (Slam down via Framer Motion) */}
                    <div className="absolute right-6 top-6 pointer-events-none select-none z-0">
                      <motion.div
                        initial={{ scale: 3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 0.15, rotate: feedbackType === "CORRECT" ? -10 : 8 }}
                        transition={{ type: "spring", damping: 12, stiffness: 100, delay: 0.15 }}
                        className={`border-4 rounded px-4 py-1.5 text-4xl font-serif font-black tracking-widest stamp-grunge ${
                          feedbackType === "CORRECT" ? "border-emerald-500 text-emerald-500" : "border-rose-500 text-rose-500"
                        }`}
                      >
                        {feedbackType === "CORRECT" ? "RESOLVED" : "FAILED"}
                      </motion.div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-stone-950/60 border border-stone-800 shrink-0 z-10 shadow-inner">
                      {feedbackType === "CORRECT" ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      ) : feedbackType === "TIMEOUT" ? (
                        <Clock className="w-6 h-6 text-amber-400" />
                      ) : (
                        <XCircle className="w-6 h-6 text-rose-400" />
                      )}
                    </div>
                    
                    <div className="space-y-2 z-10 max-w-xl">
                      <h4 className="font-serif font-bold text-lg tracking-wide">
                        {feedbackType === "CORRECT" && "🎯 容疑箇所の特定に成功。"}
                        {feedbackType === "INCORRECT" && "❌ AIの巧妙な偽装工作に惑わされました。"}
                        {feedbackType === "TIMEOUT" && "⏰ 時間切れ。慎重に検分しすぎたようです。"}
                      </h4>
                      <p className="text-xs font-mono text-stone-400">
                        【容疑文言】「{currentQuestion.segments[currentQuestion.incorrect_segment_index]}」
                      </p>
                      <p className="text-sm font-semibold text-stone-200">
                        【正しい事実】{currentQuestion.correct_fact}
                      </p>
                    </div>
                  </div>

                  {/* Fact-Check Detail Report */}
                  <div className="bg-[#12110f] border border-stone-900 rounded-lg p-6 shadow-2xl space-y-3">
                    <div className="flex items-center gap-2 text-stone-300 font-mono font-bold text-xs tracking-wider">
                      <Search className="w-3.5 h-3.5 text-[#d4af37]" />
                      <span>捜査報告書 (ファクトチェック精査)</span>
                    </div>
                    <p className="text-stone-400 text-sm leading-relaxed whitespace-pre-line font-serif pl-1">
                      {currentQuestion.explanation}
                    </p>
                  </div>

                  {/* Next Step Action Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => {
                        sound.playClick();
                        handleNextQuestion();
                      }}
                      className="bg-[#d4af37] hover:bg-[#ebd59b] text-stone-950 px-6 py-3 rounded-lg font-bold text-sm transition-colors shadow-lg flex items-center gap-2 cursor-pointer"
                    >
                      {currentQuestionIndex + 1 >= 6 || lives <= 0 ? "捜査報告を締め切る（結果確認）" : "次の未解決データに挑む"}
                      <ChevronRight className="w-4 h-4 text-stone-950" />
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* 4. RESULT SCREEN (Detective Evaluation Dossier) */}
          {gameState === "RESULT" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <div className="text-center space-y-3">
                <p className="font-mono text-xs font-bold tracking-[0.25em] text-[#d4af37] uppercase">INQUEST SUMMARY / DOSSIER</p>
                <h2 className="text-3xl md:text-5xl font-extrabold text-white font-serif">
                  {lives <= 0 ? "捜査強制打ち切り" : "すべての証拠検分を終了"}
                </h2>
                <p className="text-stone-400 max-w-md mx-auto text-xs md:text-sm leading-relaxed">
                  {lives <= 0 
                    ? "ライフの電球がすべて破壊され、捜査能力不適合により現場から解任されました。狡猾なAIは隙をうかがっています。" 
                    : "全 6 件にわたるAI言説のファクトチェック報告が受理されました。あなたの評価調書です。"
                  }
                </p>
              </div>

              {/* Big Stats Badge */}
              <div className="bg-[#141311] border border-stone-900 rounded-xl p-6 md:p-8 shadow-2xl space-y-6 text-center relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] rotate-6 scale-150 pointer-events-none select-none">
                  <Fingerprint className="w-64 h-64 text-stone-100" />
                </div>

                <div className="space-y-1 relative z-10">
                  <p className="text-[10px] font-mono text-[#d4af37] tracking-[0.3em] uppercase">事件解決実績</p>
                  <p className="text-5xl md:text-6xl font-black text-white font-serif">
                    {score} <span className="text-lg md:text-xl font-sans font-bold text-stone-500">/ 6 CASES SOLVED</span>
                  </p>
                </div>

                {/* Stamped Rank Badge */}
                <div className={`p-6 rounded-lg border-2 text-center max-w-xl mx-auto space-y-2 relative z-10 transition-colors ${getRank(score).color}`}>
                  <p className="text-[9px] uppercase tracking-[0.2em] font-mono opacity-60">リテラシー公認階級</p>
                  <h3 className="text-xl md:text-2xl font-serif font-bold">{getRank(score).title}</h3>
                  <p className="text-xs md:text-sm leading-relaxed opacity-95">{getRank(score).desc}</p>
                </div>

                {/* Detailed breakdown logs */}
                <div className="border-t border-stone-900 pt-6 max-w-md mx-auto relative z-10">
                  <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-widest font-mono mb-3">検証記録別サマリー</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#0e0d0c] border border-stone-900 p-3 rounded">
                      <span className="block text-[10px] text-stone-500 font-mono">「要警戒 (難しめ)」検証</span>
                      <span className="font-mono font-bold text-sm text-stone-300">
                        {difficultyHistory.filter(d => d === "hard").length}回
                      </span>
                    </div>
                    <div className="bg-[#0e0d0c] border border-stone-900 p-3 rounded">
                      <span className="block text-[10px] text-stone-500 font-mono">「一般案件 (普通)」検証</span>
                      <span className="font-mono font-bold text-sm text-stone-300">
                        {difficultyHistory.filter(d => d === "normal").length}回
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Try again */}
              <div className="flex flex-col md:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    sound.playClick();
                    setGameState("START");
                  }}
                  className="w-full md:w-auto bg-[#d4af37] hover:bg-[#ebd59b] text-stone-950 px-8 py-3.5 rounded-lg font-bold text-sm transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-stone-950" />
                  最初から再捜査を志願する
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-4xl mx-auto w-full px-6 py-6 border-t border-stone-900 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-stone-600 font-mono relative z-10">
        <p>© 2026 PROMPT NOIR. BUREAU OF LITERACY DEFENSE.</p>
        <div className="flex gap-4">
          <span>60S PER CASE</span>
          <span>•</span>
          <span>6 CHRONICLES</span>
          <span>•</span>
          <span>3 BACKUPS</span>
        </div>
      </footer>
    </div>
  );
}
