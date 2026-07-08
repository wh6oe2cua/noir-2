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
  VolumeX
} from "lucide-react";

import { sound } from "./utils/sound";

// Types corresponding to backend
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
  { id: "random", name: "ランダム", icon: Compass, desc: "全ジャンルからランダムに出題されます。" },
  { id: "fraud_prevention", name: "詐欺対策", icon: ShieldAlert, desc: "不審なメールや架空請求など、騙しの手口を見抜きます。" },
  { id: "logic_flaw", name: "論理の飛躍", icon: Brain, desc: "因果関係の混同や極端な一般化などの誤謬を見抜きます。" },
  { id: "history", name: "歴史", icon: Award, desc: "もっともらしく書き換えられた歴史的事件や人物の嘘を見抜きます。" },
  { id: "science", name: "科学", icon: Sparkles, desc: "科学的な事実や自然現象に関する誤った説明を見抜きます。" },
  { id: "it_tech", name: "IT・技術", icon: Lightbulb, desc: "技術用語やデジタル仕様に関する間違いを見抜きます。" },
  { id: "trivia", name: "日常雑学", icon: HelpCircle, desc: "一般常識や面白いトリビアに潜む嘘を見抜きます。" }
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
    if (gameState === "PLAYING") {
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
  }, [gameState]);

  // Generate dynamic difficulty
  const getRandomDifficulty = () => {
    return Math.random() > 0.5 ? "hard" : "normal";
  };

  // Load question from local data
  const loadNextQuestion = (theme: ThemeType, index: number, currentSeenIds: string[]) => {
    setGameState("LOADING");
    setErrorMsg(null);
    const difficulty = getRandomDifficulty();

    // 擬似的な読み込み時間を設定して、スムーズなトランジションを演出
    setTimeout(() => {
      try {
        const targetTheme = theme || "random";
        const targetDifficulty = difficulty || "normal";
        const excludedIds = currentSeenIds || [];

        let selectedThemeKey = targetTheme;
        
        // If random, select a random theme from the keys
        if (targetTheme === "random" || !PREMADE_QUESTIONS[targetTheme]) {
          const keys = Object.keys(PREMADE_QUESTIONS);
          selectedThemeKey = keys[Math.floor(Math.random() * keys.length)] as ThemeType;
        } else {
          selectedThemeKey = targetTheme;
        }

        const questionList = PREMADE_QUESTIONS[selectedThemeKey] || [];
        
        // Filter by difficulty and exclude already seen questions
        let filteredList = questionList.filter(
          (q) => q.difficulty === targetDifficulty && !excludedIds.includes(q.id)
        );

        // If no questions match after filtering, try ignoring difficulty but excluding seen
        if (filteredList.length === 0) {
          filteredList = questionList.filter((q) => !excludedIds.includes(q.id));
        }

        // If still empty (all questions in category are seen), fallback to allowing seen questions
        if (filteredList.length === 0) {
          filteredList = questionList.filter((q) => q.difficulty === targetDifficulty);
        }

        // Final fallback to the full list in the category
        if (filteredList.length === 0) {
          filteredList = questionList;
        }

        if (filteredList.length === 0) {
          throw new Error("問題が見つかりませんでした。");
        }

        // Pick a random question from the filtered list
        const randomQuestion = filteredList[Math.floor(Math.random() * filteredList.length)];

        // Return the question with a unique run ID to avoid caching issues in client state
        const questionData: Question = {
          ...randomQuestion,
          id: `${randomQuestion.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          baseId: randomQuestion.id, // Keep the real ID separate for seenIds tracking
        };

        setCurrentQuestion(questionData);
        setDifficultyHistory((prev) => [...prev, questionData.difficulty]);
        setSeenQuestionIds((prev) => [...prev, randomQuestion.id]);

        setSelectedIndex(null);
        setTimeLeft(60);
        setGameState("PLAYING");
      } catch (err: any) {
        console.error(err);
        setErrorMsg("問題のロード中にエラーが発生しました。");
        setTimeout(() => {
          setGameState("START");
        }, 1500);
      }
    }, 400);
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
    if (gameState !== "PLAYING" || !currentQuestion) return;

    if (timerRef.current) clearInterval(timerRef.current);
    setSelectedIndex(index);

    // Play tactile mechanical key/click sound
    sound.playClick();

    const isCorrect = index === currentQuestion.incorrect_segment_index;
    setIsCorrectFeedback(isCorrect);

    if (isCorrect) {
      setScore((prev) => prev + 1);
      setFeedbackType("CORRECT");
      // Delay slightly or play immediately
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
    if (!currentQuestion || gameState !== "PLAYING" || hasChangedThisQuestion) return;
    
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
    if (finalScore === 6) return { title: "AIマスターファクトチェッカー", color: "text-purple-600 border-purple-200 bg-purple-50", desc: "素晴らしい！AIのあらゆる論理の飛躍や詐欺手口、ハルシネーションを完璧に見破りました。現代最高峰の情報強者です。" };
    if (finalScore === 5) return { title: "プロ級ファクトチェッカー", color: "text-emerald-600 border-emerald-200 bg-emerald-50", desc: "極めて優秀なリテラシーを持っています。もっともらしい嘘に騙されず、冷静に事実を精査できる知性の持ち主です。" };
    if (finalScore >= 3) return { title: "中堅ファクトチェッカー", color: "text-blue-600 border-blue-200 bg-blue-50", desc: "平均以上の判断力です。しかし、巧妙に仕組まれた「難しめ」の嘘や、リアルな詐欺手口には時折足元をすくわれるかもしれません。" };
    if (finalScore >= 1) return { title: "駆け出しファクトチェッカー", color: "text-amber-600 border-amber-200 bg-amber-50", desc: "まだAIの甘い言葉や詐欺の手口に惑わされがちです。怪しいと感じたら、立ち止まって検索する習慣をつけましょう。" };
    return { title: "AIに騙されやすい一般市民", color: "text-red-600 border-red-200 bg-red-50", desc: "危険信号です！もっともらしい説明をすべて鵜呑みにしてしまう傾向があります。このゲームでリテラシーを鍛え直しましょう！" };
  };

  return (
    <div id="app-container" className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col justify-between selection:bg-gray-200">
      {/* Upper Brand Border */}
      <div className="h-1 bg-gray-900 w-full"></div>

      <header className="max-w-4xl mx-auto w-full px-6 pt-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-gray-900 text-white p-1.5 rounded-lg">
              <Brain className="w-5 h-5" />
            </div>
            <span className="font-mono text-sm tracking-widest font-bold uppercase text-gray-600">PROMPT NOIR</span>
          </div>

          <button
            onClick={handleToggleMute}
            className="flex items-center justify-center p-1.5 rounded-lg hover:bg-gray-200 active:bg-gray-300 border border-transparent hover:border-gray-200 transition-all duration-150 text-gray-500 hover:text-gray-800 cursor-pointer"
            title={isMuted ? "ミュート解除" : "ミュート"}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-red-500 animate-pulse" />
            ) : (
              <Volume2 className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>

        {gameState === "PLAYING" || gameState === "FEEDBACK" ? (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
              <Clock className={`w-4 h-4 ${timeLeft <= 15 ? "text-red-500 animate-pulse" : "text-gray-500"}`} />
              <span className={`font-mono text-sm font-bold ${timeLeft <= 15 ? "text-red-500" : "text-gray-700"}`}>
                {timeLeft}s
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
              <span className="text-xs text-gray-500 font-medium">LIVES:</span>
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <Heart
                    key={i}
                    className={`w-4 h-4 transition-all duration-300 ${
                      i < lives ? "fill-red-500 text-red-500 scale-100" : "text-gray-300 scale-90"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {/* 1. START SCREEN */}
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
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
                  プロンプト・ノワール
                </h1>
                <p className="text-xl md:text-2xl font-bold text-gray-700 tracking-wide mt-1">
                  〜嘘つきAIの嘘を見抜け〜
                </p>
                <p className="text-gray-600 text-base md:text-lg max-w-2xl">
                  AIが驚くほど自然に語る文章。しかし、その中に【巧妙な嘘】【詐欺の罠】【論理の飛躍】が1箇所だけ隠されています。
                  あなたは騙されずに、正しくファクトチェック（真偽検証）できますか？
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <Compass className="w-5 h-5 text-gray-500" />
                  <h2 className="font-bold text-gray-800 text-sm tracking-wider uppercase">ジャンルを選択して挑戦</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {THEMES.map((theme) => {
                    const IconComp = theme.icon;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => {
                          setSelectedTheme(theme.id as ThemeType);
                          sound.playClick();
                        }}
                        className={`flex items-start text-left p-4 rounded-xl border transition-all duration-200 group ${
                          selectedTheme === theme.id
                            ? "bg-gray-950 text-white border-gray-950 shadow-md"
                            : "bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100 hover:border-gray-300"
                        }`}
                      >
                        <div className={`p-2 rounded-lg mr-3 ${selectedTheme === theme.id ? "bg-gray-800 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{theme.name}</p>
                          <p className={`text-xs mt-1 leading-relaxed ${selectedTheme === theme.id ? "text-gray-300" : "text-gray-500"}`}>
                            {theme.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-6 justify-between pt-4 border-t border-gray-200">
                <div className="flex gap-8 text-xs text-gray-500 font-mono">
                  <div>
                    <span className="block text-gray-400">LIMIT TIME</span>
                    <span className="font-bold text-gray-700">1問 60秒</span>
                  </div>
                  <div>
                    <span className="block text-gray-400">TOTAL STAGES</span>
                    <span className="font-bold text-gray-700">全 6問</span>
                  </div>
                  <div>
                    <span className="block text-gray-400">LIVES</span>
                    <span className="font-bold text-gray-700">3 ハート</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    sound.playClick();
                    handleStartGame();
                  }}
                  className="w-full md:w-auto bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-950 px-8 py-4 rounded-xl font-bold text-base transition-colors shadow-sm flex items-center justify-center gap-2 group"
                >
                  ゲームを開始する
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </motion.div>
          )}

          {/* 2. LOADING SCREEN */}
          {gameState === "LOADING" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center space-y-6 py-20"
            >
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
                <Brain className="w-6 h-6 text-gray-800 absolute" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-mono text-xs tracking-wider uppercase text-gray-400">Analyzing AI Log</p>
                <h3 className="font-bold text-lg text-gray-800 animate-pulse">
                  嘘つきAIのログを解析中...
                </h3>
                <p className="text-xs text-gray-500 max-w-sm">
                  AIが記述した文章ログから、ハルシネーション（嘘）の痕跡と解説データをロードしています。
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
              {/* Question Header Status */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
                <div className="space-y-1">
                  <span className="font-mono text-xs font-bold text-gray-400 uppercase tracking-widest block">
                    STAGE {currentQuestionIndex + 1} OF 6
                  </span>
                  <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                    {currentQuestion.title}
                  </h2>
                </div>

                <div className="flex gap-2">
                  <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200">
                    {currentQuestion.theme}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    currentQuestion.difficulty === "hard"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>
                    {currentQuestion.difficulty === "hard" ? "難しめ" : "普通"}
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <p className="text-sm text-gray-500">
                {gameState === "PLAYING" 
                  ? "👇 以下の文章の中で、もっともらしい「嘘」や「不審な罠・論理の飛躍」が含まれる文節を1つ選んでタップしてください。"
                  : "💡 判定結果とファクトチェック解説を確認しましょう。"
                }
              </p>

              {/* Interactive Paragraph Segments */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
                <div className="flex flex-wrap gap-2 leading-loose text-base md:text-lg">
                  {currentQuestion.segments.map((segment, index) => {
                    const isSelected = selectedIndex === index;
                    const isIncorrectPart = index === currentQuestion.incorrect_segment_index;
                    
                    let segmentStyle = "bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100 hover:border-gray-300 cursor-pointer";
                    
                    if (gameState === "FEEDBACK") {
                      if (isIncorrectPart) {
                        // The actual wrong segment is highlighted in green
                        segmentStyle = "bg-green-50 text-green-800 border-green-300 font-bold scale-[1.02] shadow-sm";
                      } else if (isSelected && !isCorrectFeedback) {
                        // If player chose wrong segment
                        segmentStyle = "bg-red-50 text-red-800 border-red-300 line-through scale-95 opacity-80";
                      } else {
                        segmentStyle = "bg-gray-50 text-gray-400 border-gray-150 cursor-not-allowed opacity-50";
                      }
                    } else {
                      // Playing state hover animations handled by css or framer
                    }

                    return (
                      <button
                        key={index}
                        disabled={gameState !== "PLAYING"}
                        onClick={() => handleSegmentClick(index)}
                        className={`px-3 py-1.5 rounded-lg border text-left transition-all duration-200 ${segmentStyle}`}
                      >
                        {segment}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Change Question Button - Only visible in PLAYING state */}
              {gameState === "PLAYING" && (
                <div className="flex justify-start px-1 pt-1">
                  <button
                    onClick={handleChangeQuestion}
                    disabled={hasChangedThisQuestion}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors duration-150 shadow-sm ${
                      hasChangedThisQuestion
                        ? "text-gray-300 bg-gray-100 border-gray-200 cursor-not-allowed"
                        : "text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border border-gray-200 hover:border-gray-300 cursor-pointer"
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${hasChangedThisQuestion ? "" : "animate-spin-hover"}`} />
                    {hasChangedThisQuestion ? "チェンジ（使用済み）" : "チェンジ（1回のみ）"}
                  </button>
                </div>
              )}

              {/* Feedback Content Area */}
              {gameState === "FEEDBACK" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className={`p-5 rounded-2xl border flex flex-col md:flex-row items-start gap-4 ${
                    feedbackType === "CORRECT"
                      ? "bg-green-50 border-green-200 text-green-900"
                      : feedbackType === "TIMEOUT"
                        ? "bg-amber-50 border-amber-200 text-amber-900"
                        : "bg-red-50 border-red-200 text-red-900"
                  }`}>
                    <div className="p-2 rounded-xl bg-white shadow-sm shrink-0">
                      {feedbackType === "CORRECT" ? (
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      ) : feedbackType === "TIMEOUT" ? (
                        <Clock className="w-6 h-6 text-amber-600" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-600" />
                      )}
                    </div>
                    
                    <div className="space-y-1.5">
                      <h4 className="font-extrabold text-base">
                        {feedbackType === "CORRECT" && "🎯 見破り成功！素晴らしいファクトチェックです。"}
                        {feedbackType === "INCORRECT" && "❌ 見破り失敗... AIの巧妙な嘘に騙されてしまいました。"}
                        {feedbackType === "TIMEOUT" && "⏰ 時間切れ！ じっくり読んでいる間にタイムアップしました。"}
                      </h4>
                      <p className="text-sm font-semibold opacity-90">
                        【問題箇所】「{currentQuestion.segments[currentQuestion.incorrect_segment_index]}」
                      </p>
                      <p className="text-sm font-semibold opacity-90">
                        【正しい事実】{currentQuestion.correct_fact}
                      </p>
                    </div>
                  </div>

                  {/* Fact-Check Detailed Explanation Card */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-gray-800 font-bold text-sm">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      <span>ファクトチェック解説</span>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                      {currentQuestion.explanation}
                    </p>
                  </div>

                  {/* Action Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => {
                        sound.playClick();
                        handleNextQuestion();
                      }}
                      className="bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-950 px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center gap-2"
                    >
                      {currentQuestionIndex + 1 >= 6 || lives <= 0 ? "結果を確認する" : "次の問題へ進む"}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* 4. RESULT SCREEN */}
          {gameState === "RESULT" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <div className="text-center space-y-3">
                <p className="font-mono text-xs font-bold tracking-wider uppercase text-gray-400">Game Over / Complete</p>
                <h2 className="text-3xl md:text-4xl font-black text-gray-900">
                  {lives <= 0 ? "リサーチリタイア..." : "検証完了！"}
                </h2>
                <p className="text-gray-500 max-w-md mx-auto text-sm">
                  {lives <= 0 
                    ? "ライフが尽きてしまいました。AIやネット詐欺の技術は巧妙です。日頃から疑う目を持ってみましょう。" 
                    : "全6問のファクトチェック調査お疲れ様でした！あなたの最終リテラシー格付けです。"
                  }
                </p>
              </div>

              {/* Score and Rank Card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-6 text-center">
                <div className="space-y-1">
                  <p className="text-xs font-mono text-gray-400 uppercase font-medium">YOUR FINAL SCORE</p>
                  <p className="text-5xl md:text-6xl font-black text-gray-900">
                    {score} <span className="text-xl md:text-2xl font-bold text-gray-400">/ 6問正解</span>
                  </p>
                </div>

                <div className={`p-6 rounded-2xl border text-center max-w-xl mx-auto space-y-2 ${getRank(score).color}`}>
                  <p className="text-xs uppercase tracking-wider font-mono opacity-60">リテラシー格付け</p>
                  <h3 className="text-xl md:text-2xl font-black">{getRank(score).title}</h3>
                  <p className="text-xs md:text-sm leading-relaxed opacity-90">{getRank(score).desc}</p>
                </div>

                {/* Question Stats Overview */}
                <div className="border-t border-gray-100 pt-6 max-w-md mx-auto">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">難易度別正答率</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl">
                      <span className="block text-xs text-gray-500">挑戦した「難しめ」</span>
                      <span className="font-mono font-bold text-lg text-gray-800">
                        {difficultyHistory.filter(d => d === "hard").length}問
                      </span>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl">
                      <span className="block text-xs text-gray-500">挑戦した「普通」</span>
                      <span className="font-mono font-bold text-lg text-gray-800">
                        {difficultyHistory.filter(d => d === "normal").length}問
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action area */}
              <div className="flex flex-col md:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    sound.playClick();
                    setGameState("START");
                  }}
                  className="w-full md:w-auto bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-950 px-8 py-3.5 rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  もう一度プレイする
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-4xl mx-auto w-full px-6 py-6 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-400 font-mono">
        <p>© 2026 プロンプト・ノワール. All rights reserved.</p>
        <div className="flex gap-4">
          <span>60S LIMIT</span>
          <span>•</span>
          <span>6 STAGES</span>
          <span>•</span>
          <span>3 LIVES</span>
        </div>
      </footer>
    </div>
  );
}
