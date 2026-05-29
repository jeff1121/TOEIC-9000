import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BookOpen, 
  Search, 
  BrainCircuit, 
  Trophy, 
  Settings as SettingsIcon, 
  Star, 
  Check, 
  CheckCircle2, 
  Volume2, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  RefreshCw, 
  Trash2, 
  X, 
  Flame, 
  Info, 
  ExternalLink,
  GitBranch
} from 'lucide-react';
import { toeicWords } from './data/words';

// Define levels based on index (frequency rank)
const getWordLevel = (index: number): number => {
  if (index < 1500) return 1;
  if (index < 4000) return 2;
  if (index < 6500) return 3;
  return 4;
};

const LEVEL_NAMES: Record<number, string> = {
  1: "基礎奠基 (Essential)",
  2: "核心高頻 (Core)",
  3: "進階挑戰 (Intermediate)",
  4: "高分衝刺 (Advanced)"
};

const LEVEL_RANGES: Record<number, string> = {
  1: "1 - 1500",
  2: "1501 - 4000",
  3: "4001 - 6500",
  4: "6501 - 9000"
};

// Interface for API Word Definition
interface Phonetic {
  text?: string;
  audio?: string;
}

interface Definition {
  definition: string;
  example?: string;
}

interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
}

interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics: Phonetic[];
  meanings: Meaning[];
}

export default function App() {
  // Navigation & Tab State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'search' | 'flashcard' | 'quiz' | 'settings'>('dashboard');
  
  // Settings State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('toeic_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [voiceSpeed, setVoiceSpeed] = useState<number>(() => {
    const saved = localStorage.getItem('toeic_voice_speed');
    return saved ? parseFloat(saved) : 0.9;
  });
  const [voiceAccent, setVoiceAccent] = useState<string>(() => {
    const saved = localStorage.getItem('toeic_voice_accent');
    return saved || 'en-US';
  });
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    const saved = localStorage.getItem('toeic_daily_goal');
    return saved ? parseInt(saved) : 20;
  });

  // Learning Progress State
  const [starredWords, setStarredWords] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('toeic_starred_words');
    return saved ? JSON.parse(saved) : {};
  });
  const [masteredWords, setMasteredWords] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('toeic_mastered_words');
    return saved ? JSON.parse(saved) : {};
  });
  const [recentWords, setRecentWords] = useState<string[]>(() => {
    const saved = localStorage.getItem('toeic_recent_words');
    return saved ? JSON.parse(saved) : [];
  });
  const [streak, setStreak] = useState<number>(() => {
    const saved = localStorage.getItem('toeic_streak');
    return saved ? parseInt(saved) : 0;
  });
  const [lastStudyDate, setLastStudyDate] = useState<string>(() => {
    return localStorage.getItem('toeic_last_study_date') || '';
  });

  // Search Tab State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLevel, setSearchLevel] = useState<string>('all');
  const [searchStatus, setSearchStatus] = useState<'all' | 'starred' | 'mastered' | 'unmastered'>('all');
  const [searchPage, setSearchPage] = useState(1);
  const wordsPerPage = 50;

  // Flashcards Tab State
  const [flashcardLevel, setFlashcardLevel] = useState<string>('1');
  const [flashcardFilter, setFlashcardFilter] = useState<'all' | 'starred' | 'unmastered'>('all');
  const [flashcardMode, setFlashcardMode] = useState<'sequential' | 'random'>('sequential');
  const [flashcardList, setFlashcardList] = useState<string[]>([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flashcardLoading, setFlashcardLoading] = useState(false);
  const [flashcardError, setFlashcardError] = useState<string | null>(null);
  const [flashcardDictData, setFlashcardDictData] = useState<DictionaryEntry | null>(null);

  // Quiz Tab State
  const [quizLevel, setQuizLevel] = useState<string>('1');
  const [quizType, setQuizType] = useState<'meaning' | 'spelling'>('meaning');
  const [quizActive, setQuizActive] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<Array<{
    word: string;
    options?: string[];
    correctOption?: string;
    scrambled?: string[];
    definition?: string;
  }>>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({}); // { questionIdx: chosenOption }
  const [quizSpellingInput, setQuizSpellingInput] = useState('');
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // Word Detail Modal State
  const [modalWord, setModalWord] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalDictData, setModalDictData] = useState<DictionaryEntry | null>(null);

  // In-Memory Dictionary Cache
  const dictCache = useRef<Record<string, DictionaryEntry>>({});

  // Theme Sync
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('toeic_theme', theme);
  }, [theme]);

  // Sync Progress to LocalStorage
  useEffect(() => {
    localStorage.setItem('toeic_starred_words', JSON.stringify(starredWords));
  }, [starredWords]);

  useEffect(() => {
    localStorage.setItem('toeic_mastered_words', JSON.stringify(masteredWords));
  }, [masteredWords]);

  useEffect(() => {
    localStorage.setItem('toeic_recent_words', JSON.stringify(recentWords));
  }, [recentWords]);

  // Text-To-Speech function
  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voiceSpeed;
    utterance.lang = voiceAccent;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith(voiceAccent));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };

  // Update Streak and Study Activity
  const recordStudyActivity = () => {
    const today = new Date().toISOString().split('T')[0];
    if (lastStudyDate === today) return;

    let newStreak = streak;
    if (lastStudyDate) {
      const lastDate = new Date(lastStudyDate);
      const diffTime = Math.abs(new Date(today).getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1) {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    setStreak(newStreak);
    setLastStudyDate(today);
    localStorage.setItem('toeic_streak', newStreak.toString());
    localStorage.setItem('toeic_last_study_date', today);
  };

  const addRecentWord = (word: string) => {
    setRecentWords(prev => {
      const filtered = prev.filter(w => w !== word);
      return [word, ...filtered].slice(0, 10);
    });
    recordStudyActivity();
  };

  // Toggle Star / Mastered
  const toggleStar = (word: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    setStarredWords(prev => {
      const updated = { ...prev };
      if (updated[word]) {
        delete updated[word];
      } else {
        updated[word] = true;
      }
      return updated;
    });
  };

  const toggleMastery = (word: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    setMasteredWords(prev => {
      const updated = { ...prev };
      if (updated[word]) {
        delete updated[word];
      } else {
        updated[word] = true;
        addRecentWord(word);
      }
      return updated;
    });
  };

  // Reset progress functionality
  const handleResetProgress = () => {
    if (window.confirm("確定要重設所有學習記錄與單字庫嗎？此動作無法復原！")) {
      setStarredWords({});
      setMasteredWords({});
      setRecentWords([]);
      setStreak(0);
      setLastStudyDate('');
      localStorage.removeItem('toeic_starred_words');
      localStorage.removeItem('toeic_mastered_words');
      localStorage.removeItem('toeic_recent_words');
      localStorage.removeItem('toeic_streak');
      localStorage.removeItem('toeic_last_study_date');
      alert("學習紀錄已成功重設！");
    }
  };

  // Fetch from Free Dictionary API with cache
  const fetchDictionaryData = async (word: string): Promise<DictionaryEntry> => {
    if (dictCache.current[word]) {
      return dictCache.current[word];
    }
    
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    if (!response.ok) {
      throw new Error(`Word not found in dictionary`);
    }
    const data = await response.json();
    const entry = data[0] as DictionaryEntry;
    dictCache.current[word] = entry;
    return entry;
  };

  // Open Detail Modal
  const openWordDetails = async (word: string) => {
    setModalWord(word);
    setModalLoading(true);
    setModalError(null);
    setModalDictData(null);
    addRecentWord(word);

    try {
      const data = await fetchDictionaryData(word);
      setModalDictData(data);
    } catch (err) {
      setModalError("無法取得英英釋義，可能為複合字或離線狀態。");
    } finally {
      setModalLoading(false);
    }
  };

  // Dashboard Stats Calculations
  const stats = useMemo(() => {
    const total = 9000;
    const mastered = Object.keys(masteredWords).length;
    const starred = Object.keys(starredWords).length;
    const progress = total > 0 ? Math.round((mastered / total) * 100) : 0;
    
    // Level progress calculations
    const levelCounts = { 1: 1500, 2: 2500, 3: 2500, 4: 2500 };
    const levelMastered = { 1: 0, 2: 0, 3: 0, 4: 0 };
    
    toeicWords.forEach((word, idx) => {
      if (masteredWords[word]) {
        const lvl = getWordLevel(idx);
        levelMastered[lvl as 1|2|3|4] += 1;
      }
    });

    const levelPercentages = {
      1: Math.round((levelMastered[1] / levelCounts[1]) * 100),
      2: Math.round((levelMastered[2] / levelCounts[2]) * 100),
      3: Math.round((levelMastered[3] / levelCounts[3]) * 100),
      4: Math.round((levelMastered[4] / levelCounts[4]) * 100)
    };

    // Calculate today's words studied progress
    const todayStudiedCount = recentWords.length; // Approximate from recent list for simplicity

    return {
      total,
      mastered,
      starred,
      progress,
      levelPercentages,
      todayStudiedCount
    };
  }, [masteredWords, starredWords, recentWords]);

  // Search Results Filtering
  const filteredWords = useMemo(() => {
    let result = toeicWords.map((word, index) => ({ word, index }));

    // Text Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(item => item.word.includes(query));
    }

    // Level Filter
    if (searchLevel !== 'all') {
      const lvl = parseInt(searchLevel);
      result = result.filter(item => getWordLevel(item.index) === lvl);
    }

    // Status Filter
    if (searchStatus !== 'all') {
      if (searchStatus === 'starred') {
        result = result.filter(item => starredWords[item.word]);
      } else if (searchStatus === 'mastered') {
        result = result.filter(item => masteredWords[item.word]);
      } else if (searchStatus === 'unmastered') {
        result = result.filter(item => !masteredWords[item.word]);
      }
    }

    return result;
  }, [searchQuery, searchLevel, searchStatus, starredWords, masteredWords]);

  // Reset Search Page when Filters change
  useEffect(() => {
    setSearchPage(1);
  }, [searchQuery, searchLevel, searchStatus]);

  // Paginated Words
  const paginatedWords = useMemo(() => {
    const start = (searchPage - 1) * wordsPerPage;
    return filteredWords.slice(start, start + wordsPerPage);
  }, [filteredWords, searchPage]);

  const totalSearchPages = Math.ceil(filteredWords.length / wordsPerPage);

  // Initialize Flashcard Session
  const initFlashcardSession = () => {
    let list = toeicWords.map((word, index) => ({ word, index }));
    
    // Apply Level Filter
    if (flashcardLevel !== 'all') {
      const lvl = parseInt(flashcardLevel);
      list = list.filter(item => getWordLevel(item.index) === lvl);
    }

    // Apply Starred / Unmastered Filter
    if (flashcardFilter === 'starred') {
      list = list.filter(item => starredWords[item.word]);
    } else if (flashcardFilter === 'unmastered') {
      list = list.filter(item => !masteredWords[item.word]);
    }

    let finalWords = list.map(item => item.word);

    // Shuffle if random mode
    if (flashcardMode === 'random') {
      finalWords = [...finalWords].sort(() => Math.random() - 0.5);
    }

    setFlashcardList(finalWords);
    setCurrentCardIdx(0);
    setIsFlipped(false);
    setFlashcardDictData(null);
    setFlashcardError(null);
  };

  // Sync Flashcard Word Data when Card Index or List changes
  useEffect(() => {
    if (activeTab === 'flashcard' && flashcardList.length > 0) {
      const word = flashcardList[currentCardIdx];
      if (word) {
        loadFlashcardData(word);
      }
    }
  }, [currentCardIdx, flashcardList, activeTab]);

  const loadFlashcardData = async (word: string) => {
    setFlashcardLoading(true);
    setFlashcardError(null);
    setIsFlipped(false);
    
    try {
      const data = await fetchDictionaryData(word);
      setFlashcardDictData(data);
    } catch (err) {
      setFlashcardError("無法載入字典釋義。");
    } finally {
      setFlashcardLoading(false);
    }
  };

  const nextFlashcard = () => {
    if (currentCardIdx < flashcardList.length - 1) {
      setCurrentCardIdx(prev => prev + 1);
    }
  };

  const prevFlashcard = () => {
    if (currentCardIdx > 0) {
      setCurrentCardIdx(prev => prev - 1);
    }
  };

  // Initialize Quiz Session
  const initQuizSession = async () => {
    setQuizLoading(true);
    setQuizActive(false);
    setQuizFinished(false);
    setQuizAnswers({});
    setCurrentQuestionIdx(0);
    setQuizScore(0);
    setQuizSpellingInput('');

    // Filter words matching level
    let candidates = toeicWords.map((word, index) => ({ word, index }));
    if (quizLevel !== 'all') {
      const lvl = parseInt(quizLevel);
      candidates = candidates.filter(item => getWordLevel(item.index) === lvl);
    }
    
    // Choose 10 random words
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const quizWords = shuffled.slice(0, 10).map(item => item.word);

    try {
      const questionsData = await Promise.all(
        quizWords.map(async (word) => {
          if (quizType === 'spelling') {
            // Spelling Quiz Question Form
            // Get scrambled letters
            const scrambled = word.split('').sort(() => Math.random() - 0.5);
            let definition = "No definition found";
            try {
              const dict = await fetchDictionaryData(word);
              definition = dict.meanings[0]?.definitions[0]?.definition || "Vocabulary check";
            } catch (e) {
              definition = "TOEIC core word";
            }

            return {
              word,
              scrambled,
              definition
            };
          } else {
            // Multiple Choice Meaning Match Question Form
            let definition = "";
            try {
              const dict = await fetchDictionaryData(word);
              definition = dict.meanings[0]?.definitions[0]?.definition || "Vocabulary check";
            } catch (e) {
              definition = "TOEIC core word definition";
            }

            // Distractor definitions from other words
            const distractors: string[] = [];
            while (distractors.length < 3) {
              const randWord = toeicWords[Math.floor(Math.random() * toeicWords.length)];
              if (randWord !== word) {
                try {
                  const distDict = await fetchDictionaryData(randWord);
                  const distDef = distDict.meanings[0]?.definitions[0]?.definition;
                  if (distDef && distDef !== definition && !distractors.includes(distDef)) {
                    distractors.push(distDef);
                  }
                } catch (e) {
                  // Fallback distractor if API fails
                  const fallbackDef = `Definition option for word: ${randWord}`;
                  if (!distractors.includes(fallbackDef)) {
                    distractors.push(fallbackDef);
                  }
                }
              }
            }

            // Shuffle option list
            const options = [definition, ...distractors].sort(() => Math.random() - 0.5);

            return {
              word,
              options,
              correctOption: definition
            };
          }
        })
      );

      setQuizQuestions(questionsData);
      setQuizActive(true);
    } catch (err) {
      alert("測驗生成失敗，請檢查網路連線後再試。");
    } finally {
      setQuizLoading(false);
    }
  };

  const handleQuizAnswerSubmit = (selectedOption: string) => {
    // If already answered, do nothing
    if (quizAnswers[currentQuestionIdx] !== undefined) return;

    setQuizAnswers(prev => ({
      ...prev,
      [currentQuestionIdx]: selectedOption
    }));

    const isCorrect = selectedOption === quizQuestions[currentQuestionIdx].correctOption;
    if (isCorrect) {
      setQuizScore(prev => prev + 10);
      toggleMastery(quizQuestions[currentQuestionIdx].word);
    }
  };

  const handleSpellingSubmit = () => {
    const inputClean = quizSpellingInput.trim().toLowerCase();
    const correctWord = quizQuestions[currentQuestionIdx].word;

    setQuizAnswers(prev => ({
      ...prev,
      [currentQuestionIdx]: inputClean
    }));

    const isCorrect = inputClean === correctWord;
    if (isCorrect) {
      setQuizScore(prev => prev + 10);
      toggleMastery(correctWord);
    }
  };

  const nextQuizQuestion = () => {
    if (currentQuestionIdx < quizQuestions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      setQuizSpellingInput('');
    } else {
      setQuizFinished(true);
      recordStudyActivity();
    }
  };

  // Keypress event handler inside quiz (for spelling)
  const handleSpellingKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && quizSpellingInput.trim() && quizAnswers[currentQuestionIdx] === undefined) {
      handleSpellingSubmit();
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon-container">
            <BookOpen size={24} />
          </div>
          <span className="logo-text">TOEIC-9000</span>
        </div>

        <nav style={{ width: '100%' }}>
          <ul className="nav-links">
            <li>
              <button 
                className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                <Trophy size={18} />
                <span>學習儀表板</span>
              </button>
            </li>
            <li>
              <button 
                className={`nav-btn ${activeTab === 'search' ? 'active' : ''}`}
                onClick={() => setActiveTab('search')}
              >
                <Search size={18} />
                <span>核心字庫搜尋</span>
              </button>
            </li>
            <li>
              <button 
                className={`nav-btn ${activeTab === 'flashcard' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('flashcard');
                  initFlashcardSession();
                }}
              >
                <BrainCircuit size={18} />
                <span>3D 記憶卡片</span>
              </button>
            </li>
            <li>
              <button 
                className={`nav-btn ${activeTab === 'quiz' ? 'active' : ''}`}
                onClick={() => setActiveTab('quiz')}
              >
                <Sparkles size={18} />
                <span>智慧單字測驗</span>
              </button>
            </li>
            <li>
              <button 
                className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <SettingsIcon size={18} />
                <span>設定與重設</span>
              </button>
            </li>
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Flame size={16} color="#ef4444" fill="#ef4444" />
              連續學習： {streak} 天
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GitBranch size={14} />
              版本： v1.0.0
            </span>
          </div>
          <button 
            className="theme-toggle-btn"
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? '切換深色模式' : '切換淺色模式'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        
        {/* Dynamic Header */}
        <header className="page-header">
          <div className="page-title">
            <h1>
              {activeTab === 'dashboard' && '學習儀表板'}
              {activeTab === 'search' && '核心字庫搜尋'}
              {activeTab === 'flashcard' && '3D 記憶卡片學習'}
              {activeTab === 'quiz' && '智慧單字測驗'}
              {activeTab === 'settings' && '學習設定與重設'}
            </h1>
            <p>
              {activeTab === 'dashboard' && '追蹤您的多益單字學習進度與每日目標'}
              {activeTab === 'search' && `在多益 9000 單字中快速查找單字、查看英英釋義並儲存卡片`}
              {activeTab === 'flashcard' && '利用 3D 卡片與雙向翻轉功能高效率記單字'}
              {activeTab === 'quiz' && '測試您對多益高頻單字的辨識能力與拼寫正確度'}
              {activeTab === 'settings' && '調整發音速度、腔調與重設學習歷程記錄'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="recent-word-meta">TOEIC 9000 Vocabulary</span>
          </div>
        </header>

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon primary">
                  <BookOpen size={24} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">{stats.total}</span>
                  <span className="stat-label">總收錄單字數</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon success">
                  <CheckCircle2 size={24} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">{stats.mastered}</span>
                  <span className="stat-label">已掌握單字</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon warning">
                  <Star size={24} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">{stats.starred}</span>
                  <span className="stat-label">已收藏單字</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon purple">
                  <Flame size={24} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">{stats.progress}%</span>
                  <span className="stat-label">整體學習進度</span>
                </div>
              </div>
            </div>

            {/* Main Dashboard Section */}
            <div className="dashboard-sections">
              {/* Level Progress */}
              <div className="dashboard-panel">
                <div className="panel-header">
                  <h3>多益單字分級掌握度</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>依據單字使用頻率分類</span>
                </div>
                <div className="level-progress-list">
                  {[1, 2, 3, 4].map(lvl => (
                    <div className="level-progress-item" key={lvl}>
                      <div className="level-progress-header">
                        <span className="level-name">Level {lvl}：{LEVEL_NAMES[lvl]}</span>
                        <span className="level-percentage">{stats.levelPercentages[lvl as 1|2|3|4]}%</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div 
                          className="progress-bar-fill" 
                          style={{ width: `${stats.levelPercentages[lvl as 1|2|3|4]}%` }}
                        ></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>頻率排名: {LEVEL_RANGES[lvl]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity & Quick Start */}
              <div className="dashboard-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h3>最近熟記的單字</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>最近標示為「已掌握」的單字清單</p>
                </div>
                <div className="recent-words-list">
                  {recentWords.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      暫無學習紀錄，快去背單字吧！
                    </div>
                  ) : (
                    recentWords.map(word => (
                      <div className="recent-word-item" key={word} onClick={() => openWordDetails(word)}>
                        <span className="recent-word-text">{word}</span>
                        <span className="recent-word-meta">點擊查詢</span>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', gap: '12px' }}>
                  <button 
                    className="quiz-next-btn" 
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => {
                      setActiveTab('flashcard');
                      initFlashcardSession();
                    }}
                  >
                    <BrainCircuit size={18} />
                    開始字卡學習
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SEARCH */}
        {activeTab === 'search' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flexGrow: 1 }}>
            {/* Search Controls */}
            <div className="search-controls">
              <div className="search-input-wrapper">
                <Search size={18} className="search-icon-inside" />
                <input 
                  type="text" 
                  placeholder="輸入單字搜尋... (例如: active, coordinate)" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select 
                className="filter-select"
                value={searchLevel}
                onChange={(e) => setSearchLevel(e.target.value)}
              >
                <option value="all">所有難度分級</option>
                <option value="1">Level 1 (基礎奠基)</option>
                <option value="2">Level 2 (核心高頻)</option>
                <option value="3">Level 3 (進階挑戰)</option>
                <option value="4">Level 4 (高分衝刺)</option>
              </select>

              <select 
                className="filter-select"
                value={searchStatus}
                onChange={(e) => setSearchStatus(e.target.value as any)}
              >
                <option value="all">所有學習狀態</option>
                <option value="starred">僅已收藏</option>
                <option value="mastered">僅已掌握</option>
                <option value="unmastered">僅未掌握</option>
              </select>
            </div>

            {/* Words Table */}
            <div className="words-table-container">
              <div style={{ overflowX: 'auto', flexGrow: 1 }}>
                <table className="words-table">
                  <thead>
                    <tr>
                      <th>單字 (Vocabulary)</th>
                      <th>頻率級別 (Rank Level)</th>
                      <th style={{ textAlign: 'right' }}>操作與收藏</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedWords.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          找不到符合條件的單字，請重新調整搜尋條件。
                        </td>
                      </tr>
                    ) : (
                      paginatedWords.map(item => (
                        <tr key={item.word} onClick={() => openWordDetails(item.word)}>
                          <td className="word-column">{item.word}</td>
                          <td>
                            <span className="recent-word-meta">
                              Lvl {getWordLevel(item.index)} - {LEVEL_NAMES[getWordLevel(item.index)].split(' ')[0]}
                            </span>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="word-actions-cell">
                              <button 
                                className="action-icon-btn" 
                                title="發音"
                                onClick={() => speak(item.word)}
                              >
                                <Volume2 size={16} />
                              </button>
                              <button 
                                className={`action-icon-btn ${starredWords[item.word] ? 'active-star' : ''}`}
                                title={starredWords[item.word] ? "取消收藏" : "收藏單字"}
                                onClick={(e) => toggleStar(item.word, e)}
                              >
                                <Star size={16} fill={starredWords[item.word] ? "#eab308" : "none"} />
                              </button>
                              <button 
                                className={`action-icon-btn ${masteredWords[item.word] ? 'active-check' : ''}`}
                                title={masteredWords[item.word] ? "移出已熟記" : "標記為已熟記"}
                                onClick={(e) => toggleMastery(item.word, e)}
                              >
                                <Check size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalSearchPages > 1 && (
                <div className="table-pagination">
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    顯示第 {(searchPage - 1) * wordsPerPage + 1} - {Math.min(searchPage * wordsPerPage, filteredWords.length)} 筆，共 {filteredWords.length} 筆單字
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="pagination-btn"
                      disabled={searchPage === 1}
                      onClick={() => setSearchPage(prev => Math.max(1, prev - 1))}
                    >
                      <ChevronLeft size={16} />
                      上一頁
                    </button>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontWeight: 600, fontSize: '0.9rem' }}>
                      {searchPage} / {totalSearchPages}
                    </span>
                    <button 
                      className="pagination-btn"
                      disabled={searchPage === totalSearchPages}
                      onClick={() => setSearchPage(prev => Math.min(totalSearchPages, prev + 1))}
                    >
                      下一頁
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: FLASHCARDS */}
        {activeTab === 'flashcard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Flashcard Filters Configuration */}
            {!flashcardList.length ? (
              <div className="dashboard-panel" style={{ maxWidth: '500px', margin: '40px auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ textAlign: 'center' }}>設定學習字卡</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>選擇單字分級</label>
                  <select 
                    className="filter-select" 
                    style={{ width: '100%' }}
                    value={flashcardLevel}
                    onChange={(e) => setFlashcardLevel(e.target.value)}
                  >
                    <option value="all">所有級別 (All Levels)</option>
                    <option value="1">Level 1 (基礎奠基 - Essential)</option>
                    <option value="2">Level 2 (核心高頻 - Core)</option>
                    <option value="3">Level 3 (進階挑戰 - Intermediate)</option>
                    <option value="4">Level 4 (高分衝刺 - Advanced)</option>
                  </select>

                  <label style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '8px' }}>過濾學習狀態</label>
                  <select 
                    className="filter-select" 
                    style={{ width: '100%' }}
                    value={flashcardFilter}
                    onChange={(e) => setFlashcardFilter(e.target.value as any)}
                  >
                    <option value="all">所有單字 (包含已熟記)</option>
                    <option value="unmastered">僅未掌握 (排除已熟記)</option>
                    <option value="starred">僅已收藏單字</option>
                  </select>

                  <label style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '8px' }}>播放排序</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      className="flashcard-action-btn"
                      style={{ border: flashcardMode === 'sequential' ? '2px solid var(--primary)' : '1px solid var(--panel-border)' }}
                      onClick={() => setFlashcardMode('sequential')}
                    >
                      依順序 (頻率高至低)
                    </button>
                    <button 
                      className="flashcard-action-btn"
                      style={{ border: flashcardMode === 'random' ? '2px solid var(--primary)' : '1px solid var(--panel-border)' }}
                      onClick={() => setFlashcardMode('random')}
                    >
                      隨機打亂
                    </button>
                  </div>
                </div>

                <button 
                  className="quiz-next-btn"
                  style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}
                  onClick={initFlashcardSession}
                >
                  開始學習卡片
                </button>
              </div>
            ) : (
              <div className="flashcard-area">
                {/* Session Header Stats */}
                <div className="flashcard-stage-info">
                  <span>進度: {currentCardIdx + 1} / {flashcardList.length}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    已熟記: {Object.keys(masteredWords).length} / 9000
                  </span>
                </div>

                {/* 3D Flashcard Container */}
                <div className="flashcard-perspective" onClick={() => setIsFlipped(!isFlipped)}>
                  <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
                    
                    {/* Front Card */}
                    <div className="flashcard-side flashcard-front">
                      <span className="flashcard-number">RANK #{toeicWords.indexOf(flashcardList[currentCardIdx]) + 1}</span>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <h2 style={{ fontSize: '3.6rem', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-1px' }}>
                          {flashcardList[currentCardIdx]}
                        </h2>
                        {flashcardDictData?.phonetic && (
                          <span className="modal-phonetic">{flashcardDictData.phonetic}</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '16px' }} onClick={(e) => e.stopPropagation()}>
                        <button 
                          className="action-icon-btn" 
                          style={{ width: '48px', height: '48px', borderRadius: '50%' }}
                          title="播放發音"
                          onClick={() => speak(flashcardList[currentCardIdx])}
                        >
                          <Volume2 size={20} />
                        </button>
                        <button 
                          className={`action-icon-btn ${starredWords[flashcardList[currentCardIdx]] ? 'active-star' : ''}`}
                          style={{ width: '48px', height: '48px', borderRadius: '50%' }}
                          title="收藏"
                          onClick={() => toggleStar(flashcardList[currentCardIdx])}
                        >
                          <Star size={20} fill={starredWords[flashcardList[currentCardIdx]] ? "#eab308" : "none"} />
                        </button>
                      </div>

                      <span className="flashcard-hint-text">點擊卡片以翻面查看英英釋義</span>
                    </div>

                    {/* Back Card */}
                    <div className="flashcard-side flashcard-back">
                      <span className="flashcard-number">釋義 (Definitions)</span>
                      
                      <div className="modal-body" style={{ padding: 0, margin: '20px 0', width: '100%' }}>
                        {flashcardLoading ? (
                          <div className="modal-loading">
                            <div className="spinner"></div>
                            <span>正在載入釋義...</span>
                          </div>
                        ) : flashcardError ? (
                          <div className="modal-error">
                            <Info size={32} />
                            <span>{flashcardError}</span>
                            <a 
                              href={`https://dictionary.cambridge.org/zht/詞典/英語-漢語-繁體/${flashcardList[currentCardIdx]}`}
                              target="_blank"
                              rel="noreferrer"
                              className="pagination-btn"
                              style={{ marginTop: '12px' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              線上查詢劍橋詞典
                              <ExternalLink size={14} />
                            </a>
                          </div>
                        ) : (
                          flashcardDictData?.meanings.slice(0, 2).map((meaning, mIdx) => (
                            <div className="dict-entry" key={mIdx}>
                              <span className="part-of-speech">{meaning.partOfSpeech}</span>
                              {meaning.definitions.slice(0, 2).map((def, dIdx) => (
                                <div className="definition-item" key={dIdx}>
                                  <div className="definition-text">{dIdx + 1}. {def.definition}</div>
                                  {def.example && (
                                    <div className="example-text">Ex: {def.example}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ))
                        )}
                      </div>

                      <span className="flashcard-hint-text" style={{ textAlign: 'left' }}>點擊卡片以翻回正面</span>
                    </div>

                  </div>
                </div>

                {/* Flip Actions */}
                <div className="flashcard-action-bar">
                  <button 
                    className="flashcard-action-btn again"
                    onClick={() => {
                      setIsFlipped(false);
                      // Set word as unmastered (requires practice)
                      setMasteredWords(prev => {
                        const updated = { ...prev };
                        delete updated[flashcardList[currentCardIdx]];
                        return updated;
                      });
                      setTimeout(nextFlashcard, 200);
                    }}
                  >
                    還不熟 (Again)
                  </button>
                  <button 
                    className="flashcard-action-btn know"
                    onClick={() => {
                      setIsFlipped(false);
                      // Set word as mastered
                      toggleMastery(flashcardList[currentCardIdx]);
                      setTimeout(nextFlashcard, 200);
                    }}
                  >
                    已掌握 (Mastered)
                  </button>
                </div>

                {/* Session Navigation */}
                <div className="card-nav-controls">
                  <button className="card-nav-btn" onClick={prevFlashcard} disabled={currentCardIdx === 0}>
                    <ChevronLeft size={20} />
                  </button>
                  <button 
                    className="card-nav-btn" 
                    title="重設卡片設定"
                    onClick={() => setFlashcardList([])}
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button className="card-nav-btn" onClick={nextFlashcard} disabled={currentCardIdx === flashcardList.length - 1}>
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: QUIZ */}
        {activeTab === 'quiz' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Quiz setup panel */}
            {!quizActive && !quizFinished && (
              <div className="dashboard-panel" style={{ maxWidth: '500px', margin: '40px auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ textAlign: 'center' }}>開始單字智慧測驗</h3>
                <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  每次測驗將隨機抽出 10 個核心單字，答對將自動標示為已掌握單字！
                </p>

                {quizLoading ? (
                  <div className="modal-loading">
                    <div className="spinner"></div>
                    <span>正在下載單字與釋義，請稍候...</span>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>選擇單字分級</label>
                      <select 
                        className="filter-select"
                        style={{ width: '100%' }}
                        value={quizLevel}
                        onChange={(e) => setQuizLevel(e.target.value)}
                      >
                        <option value="all">所有級別混合測驗</option>
                        <option value="1">Level 1 (基礎奠基單字)</option>
                        <option value="2">Level 2 (核心高頻單字)</option>
                        <option value="3">Level 3 (進階挑戰單字)</option>
                        <option value="4">Level 4 (高分衝刺單字)</option>
                      </select>

                      <label style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '8px' }}>測驗題型</label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                          className="flashcard-action-btn"
                          style={{ border: quizType === 'meaning' ? '2px solid var(--primary)' : '1px solid var(--panel-border)' }}
                          onClick={() => setQuizType('meaning')}
                        >
                          英英釋義多選題
                        </button>
                        <button 
                          className="flashcard-action-btn"
                          style={{ border: quizType === 'spelling' ? '2px solid var(--primary)' : '1px solid var(--panel-border)' }}
                          onClick={() => setQuizType('spelling')}
                        >
                          拼寫字元重組題
                        </button>
                      </div>
                    </div>

                    <button 
                      className="quiz-next-btn"
                      style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}
                      onClick={initQuizSession}
                    >
                      開始測驗
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Quiz Active Panel */}
            {quizActive && !quizFinished && (
              <div className="quiz-area">
                {/* Progress bar */}
                <div className="quiz-progress-bar-container">
                  <div className="quiz-progress-header">
                    <span>問題 {currentQuestionIdx + 1} / 10</span>
                    <span>目前得分: {quizScore} / 100</span>
                  </div>
                  <div className="progress-bar-bg" style={{ height: '6px' }}>
                    <div 
                      className="progress-bar-fill" 
                      style={{ width: `${(currentQuestionIdx + 1) * 10}%` }}
                    ></div>
                  </div>
                </div>

                {/* Multiple choice type */}
                {quizType === 'meaning' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="quiz-question-title">請選出最符合此單字釋義的選項:</div>
                    <div className="quiz-question-word">{quizQuestions[currentQuestionIdx].word}</div>
                    
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button 
                        className="action-icon-btn" 
                        onClick={() => speak(quizQuestions[currentQuestionIdx].word)}
                        title="單字發音"
                      >
                        <Volume2 size={16} /> 點擊發音
                      </button>
                    </div>

                    <div className="quiz-options-list">
                      {quizQuestions[currentQuestionIdx].options?.map((option, idx) => {
                        const chosen = quizAnswers[currentQuestionIdx];
                        const isCorrect = option === quizQuestions[currentQuestionIdx].correctOption;
                        const isChosen = option === chosen;
                        
                        let optionClass = '';
                        if (chosen !== undefined) {
                          if (isCorrect) optionClass = 'correct';
                          else if (isChosen) optionClass = 'incorrect';
                        }

                        return (
                          <button
                            key={idx}
                            className={`quiz-option-btn ${optionClass}`}
                            disabled={chosen !== undefined}
                            onClick={() => handleQuizAnswerSubmit(option)}
                          >
                            <span>{option}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Spelling type */}
                {quizType === 'spelling' && (
                  <div className="spelling-box">
                    <div className="quiz-question-title">根據英釋義拼寫出正確的單字:</div>
                    <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '0 16px' }}>
                      "{quizQuestions[currentQuestionIdx].definition}"
                    </div>

                    {/* Scrambled letters suggestion */}
                    <div className="scrambled-letters">
                      {quizQuestions[currentQuestionIdx].scrambled?.map((char, index) => (
                        <div className="scrambled-letter-tile" key={index}>{char}</div>
                      ))}
                    </div>

                    <input 
                      type="text" 
                      className="spelling-input"
                      placeholder="輸入答案..."
                      value={quizSpellingInput}
                      onChange={(e) => setQuizSpellingInput(e.target.value)}
                      onKeyDown={handleSpellingKeyDown}
                      disabled={quizAnswers[currentQuestionIdx] !== undefined}
                      autoFocus
                    />

                    {quizAnswers[currentQuestionIdx] === undefined ? (
                      <button 
                        className="quiz-next-btn"
                        style={{ alignSelf: 'center' }}
                        onClick={handleSpellingSubmit}
                        disabled={!quizSpellingInput.trim()}
                      >
                        送出答案
                      </button>
                    ) : (
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        {quizSpellingInput.trim().toLowerCase() === quizQuestions[currentQuestionIdx].word ? (
                          <div className="quiz-status-alert correct">恭喜答對！正確答案為: {quizQuestions[currentQuestionIdx].word}</div>
                        ) : (
                          <div className="quiz-status-alert incorrect">答錯了！正確答案為: {quizQuestions[currentQuestionIdx].word}</div>
                        )}
                        <button 
                          className="action-icon-btn" 
                          onClick={() => speak(quizQuestions[currentQuestionIdx].word)}
                        >
                          <Volume2 size={16} /> 聽正確發音
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Next button */}
                {quizAnswers[currentQuestionIdx] !== undefined && (
                  <button className="quiz-next-btn" onClick={nextQuizQuestion}>
                    {currentQuestionIdx < 9 ? "下一題" : "查看測驗結果"}
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            )}

            {/* Quiz Finished Results Panel */}
            {quizFinished && (
              <div className="dashboard-panel" style={{ maxWidth: '500px', margin: '40px auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <Trophy size={64} color="#eab308" />
                <h2>測驗完成！</h2>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>
                  得分: {quizScore} / 100
                </div>
                <p style={{ color: 'var(--text-secondary)' }}>
                  {quizScore >= 80 ? '太棒了！您的單字掌握度非常高！' : 
                   quizScore >= 60 ? '表現不錯，再接再厲！' : '別灰心，持續練習就能拿高分！'}
                </p>

                <div style={{ width: '100%', borderTop: '1px solid var(--panel-border)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                  <h4 style={{ marginBottom: '8px' }}>本次測驗字表學習回顧:</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {quizQuestions.map((q, idx) => {
                      const ans = quizAnswers[idx];
                      const correct = quizType === 'meaning' ? (ans === q.correctOption) : (ans === q.word);
                      return (
                        <div 
                          key={idx} 
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}
                          onClick={() => openWordDetails(q.word)}
                        >
                          <span style={{ color: correct ? 'var(--success)' : 'var(--danger)' }}>
                            {correct ? '✓' : '✗'}
                          </span>
                          <span style={{ fontWeight: 600, textDecoration: 'underline' }}>{q.word}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '12px' }}>
                  <button 
                    className="flashcard-action-btn" 
                    onClick={() => {
                      setQuizActive(false);
                      setQuizFinished(false);
                    }}
                  >
                    返回測驗設定
                  </button>
                  <button className="quiz-next-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={initQuizSession}>
                    再測一次
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="settings-section">
            <div className="settings-card">
              <h3>語音發音設定</h3>
              <p>設定單字學習卡與搜尋結果的發音腔調與語音朗讀速度。</p>

              <div className="settings-row">
                <div className="settings-label">
                  <span className="settings-title">英文發音腔調 (Accent)</span>
                  <span className="settings-desc">選擇單字朗讀的發音腔調</span>
                </div>
                <select 
                  className="filter-select"
                  value={voiceAccent}
                  onChange={(e) => {
                    setVoiceAccent(e.target.value);
                    localStorage.setItem('toeic_voice_accent', e.target.value);
                  }}
                >
                  <option value="en-US">美式英語 (en-US)</option>
                  <option value="en-GB">英式英語 (en-GB)</option>
                  <option value="en-CA">加拿大英語 (en-CA)</option>
                  <option value="en-AU">澳洲英語 (en-AU)</option>
                </select>
              </div>

              <div className="settings-row">
                <div className="settings-label">
                  <span className="settings-title">發音速度 (Speech Rate)</span>
                  <span className="settings-desc">調整語音朗讀單字的播放速度</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="1.5" 
                    step="0.1" 
                    value={voiceSpeed}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVoiceSpeed(val);
                      localStorage.setItem('toeic_voice_speed', val.toString());
                    }}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span style={{ fontWeight: 600, width: '40px', textAlign: 'right' }}>{voiceSpeed}x</span>
                </div>
              </div>
            </div>

            <div className="settings-card">
              <h3>學習目標設定</h3>
              <p>設定您的每日學習目標，隨時保持學習進度。</p>

              <div className="settings-row">
                <div className="settings-label">
                  <span className="settings-title">每日目標掌握單字數</span>
                  <span className="settings-desc">每天計畫背誦熟記的目標單字量</span>
                </div>
                <select 
                  className="filter-select"
                  value={dailyGoal}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setDailyGoal(val);
                    localStorage.setItem('toeic_daily_goal', val.toString());
                  }}
                >
                  <option value="10">10 個單字 / 天</option>
                  <option value="20">20 個單字 / 天</option>
                  <option value="30">30 個單字 / 天</option>
                  <option value="50">50 個單字 / 天</option>
                  <option value="100">100 個單字 / 天</option>
                </select>
              </div>
            </div>

            <div className="settings-card" style={{ border: '1px solid rgba(225, 29, 72, 0.2)' }}>
              <h3 style={{ color: 'var(--danger)' }}>危險區域</h3>
              <p>重置您的所有學習紀錄。請注意，此動作將會清除所有已掌握單字、收藏單字及每日連續學習天數。</p>
              
              <div className="settings-row" style={{ border: 'none', padding: 0 }}>
                <div className="settings-label">
                  <span className="settings-title" style={{ color: 'var(--text-primary)' }}>清除所有學習記錄</span>
                  <span className="settings-desc">將您的資料重設為初始狀態</span>
                </div>
                <button className="danger-btn" onClick={handleResetProgress}>
                  <Trash2 size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  清除並重設
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* GLOBAL: WORD DETAIL MODAL */}
      {modalWord && (
        <div className="modal-overlay" onClick={() => setModalWord(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="modal-header">
              <div className="modal-title-area">
                <h2 className="modal-word">{modalWord}</h2>
                <div className="modal-subtitle">
                  <span className="recent-word-meta">RANK #{toeicWords.indexOf(modalWord) + 1}</span>
                  {modalDictData?.phonetic && (
                    <span className="modal-phonetic">{modalDictData.phonetic}</span>
                  )}
                </div>
              </div>
              <button className="action-icon-btn" onClick={() => setModalWord(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body">
              {modalLoading ? (
                <div className="modal-loading">
                  <div className="spinner"></div>
                  <span>正在從英英字典載入釋義...</span>
                </div>
              ) : modalError ? (
                <div className="modal-error">
                  <Info size={32} />
                  <span>{modalError}</span>
                  <a 
                    href={`https://dictionary.cambridge.org/zht/詞典/英語-漢語-繁體/${modalWord}`}
                    target="_blank"
                    rel="noreferrer"
                    className="pagination-btn"
                    style={{ marginTop: '12px' }}
                  >
                    線上查詢劍橋詞典
                    <ExternalLink size={14} />
                  </a>
                </div>
              ) : (
                modalDictData?.meanings.map((meaning, mIdx) => (
                  <div className="dict-entry" key={mIdx}>
                    <span className="part-of-speech">{meaning.partOfSpeech}</span>
                    {meaning.definitions.slice(0, 3).map((def, dIdx) => (
                      <div className="definition-item" key={dIdx}>
                        <div className="definition-text">{dIdx + 1}. {def.definition}</div>
                        {def.example && (
                          <div className="example-text">Ex: {def.example}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button 
                className="pagination-btn" 
                onClick={() => speak(modalWord)}
              >
                <Volume2 size={16} />
                聽發音
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`pagination-btn ${starredWords[modalWord] ? 'active-star' : ''}`}
                  onClick={() => toggleStar(modalWord)}
                >
                  <Star size={16} fill={starredWords[modalWord] ? "#eab308" : "none"} />
                  {starredWords[modalWord] ? "取消收藏" : "收藏"}
                </button>
                <button 
                  className={`pagination-btn ${masteredWords[modalWord] ? 'active-check' : ''}`}
                  onClick={() => toggleMastery(modalWord)}
                >
                  <Check size={16} />
                  {masteredWords[modalWord] ? "取消已掌握" : "已熟記"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
