/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  FileText, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  RefreshCcw, 
  Trophy, 
  Upload,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  BrainCircuit,
  MessageSquare,
  History,
  Trash2,
  Calendar
} from 'lucide-react';
import { Question, Quiz, AppState, FileData } from './types';
import { parseQuizContent } from './services/geminiService';
import * as mammoth from 'mammoth';

export default function App() {
  const [state, setState] = useState<AppState>('landing');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<(Quiz & { id: string; date: string })[]>([]);
  const [numQuestions, setNumQuestions] = useState(10);
  const [timeLimit, setTimeLimit] = useState(10); // in minutes
  const [timeLeft, setTimeLeft] = useState(0);
  const [showImmediateFeedback, setShowImmediateFeedback] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load history on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('quiz_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  // Save history when it changes
  useEffect(() => {
    localStorage.setItem('quiz_history', JSON.stringify(history));
  }, [history]);

  // Timer logic
  useEffect(() => {
    if (state === 'quiz' && !isSubmitted && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleSubmit();
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
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state, isSubmitted]);

  const handleStartQuiz = async () => {
    const source = selectedFile || inputText;
    if (!source) {
      setError('Vui lòng chọn file bài tập!');
      return;
    }

    setIsLoading(true);
    setState('loading');
    setError(null);

    try {
      const parsedQuiz = await parseQuizContent(source, numQuestions);
      
      // Save to history
      const historyItem = {
        ...parsedQuiz,
        id: crypto.randomUUID(),
        date: new Date().toLocaleString('vi-VN')
      };
      setHistory(prev => [historyItem, ...prev].slice(0, 10)); // Keep last 10

      setQuiz(parsedQuiz);
      setTimeLeft(timeLimit * 60);
      setState('quiz');
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setIsSubmitted(false);
    } catch (err: any) {
      console.error(err);
      const errorMessage = err?.message || 'Không thể xử lý tệp này. Vui lòng thử lại.';
      setError(`Lỗi: ${errorMessage}`);
      setState('landing');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionSelect = (questionId: string, optionIndex: number) => {
    if (isSubmitted) return;
    if (showImmediateFeedback && userAnswers[questionId] !== undefined) return;
    setUserAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleNext = () => {
    if (quiz && currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    setState('results');
  };

  const handleReset = () => {
    setState('landing');
    setQuiz(null);
    setInputText('');
    setSelectedFile(null);
    setUserAnswers({});
    setIsSubmitted(false);
    setError(null);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const loadHistoryItem = (item: Quiz) => {
    setQuiz(item);
    setTimeLeft(timeLimit * 60); // Use current settings for history load
    setState('quiz');
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setIsSubmitted(false);
    setError(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateScore = () => {
    if (!quiz) return { correct: 0, total: 0, percentage: 0 };
    let correct = 0;
    quiz.questions.forEach(q => {
      if (userAnswers[q.id] === q.correctAnswer) {
        correct++;
      }
    });
    return {
      correct,
      total: quiz.questions.length,
      percentage: Math.round((correct / quiz.questions.length) * 100)
    };
  };

  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(null);
      const isText = file.type === 'text/plain' || file.name.endsWith('.md');
      const isWord = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx');
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      
      const reader = new FileReader();

      reader.onload = async (event) => {
        const result = event.target?.result;
        if (!result) return;

        if (isText) {
          setInputText(result as string);
          setSelectedFile(null);
        } else if (isWord) {
          try {
            const arrayBuffer = result as ArrayBuffer;
            const output = await mammoth.extractRawText({ arrayBuffer });
            setInputText(output.value);
            setSelectedFile(null);
          } catch (err) {
            console.error('Error extracting text from Word file:', err);
            setError('Không thể đọc file Word này. Hãy thử chuyển sang PDF hoặc copy nội dung.');
          }
        } else if (isPdf) {
          // Send PDF as binary part to Gemini
          const base64Data = (result as string).split(',')[1];
          setSelectedFile({
            data: base64Data,
            mimeType: 'application/pdf',
            name: file.name
          });
          setInputText('');
        } else {
          setError('Định dạng file không được hỗ trợ. Vui lòng dùng PDF, Word hoặc Text.');
        }
      };

      if (isText) {
        reader.readAsText(file);
      } else if (isWord) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsDataURL(file);
      }
    }
  };

  const displaySource = selectedFile ? selectedFile.name : (inputText ? "Văn bản đã tải" : null);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans">
      <AnimatePresence mode="wait">
        {state === 'landing' && (
          <motion.div 
            key="landing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12"
          >
            <header className="mb-8 sm:mb-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-indigo-600 text-white rounded-2xl sm:rounded-3xl mb-4 sm:6 shadow-xl shadow-indigo-200">
                <BrainCircuit size={32} className="sm:w-10 sm:h-10" />
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-3 sm:mb-4 text-slate-800">QuizMaster AI</h1>
              <p className="text-base sm:text-xl text-slate-500 max-w-2xl mx-auto font-medium px-4">
                Tải lên tài liệu PDF, Office hoặc Văn bản để thiết kế bài trắc nghiệm thông minh.
              </p>
            </header>

            <div className="bg-white rounded-[2rem] sm:rounded-[40px] shadow-card p-6 sm:p-12 border border-slate-100 text-center">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="group cursor-pointer mb-6 sm:mb-8 p-6 sm:p-12 border-4 border-dashed border-slate-100 rounded-[2rem] sm:rounded-[3rem] hover:border-indigo-400 hover:bg-indigo-50/30 transition-all flex flex-col items-center"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 text-slate-400 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                  <Upload size={32} className="sm:w-10 sm:h-10" />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-2">Chọn file bài tập</h2>
                <p className="text-sm sm:text-slate-500 font-medium max-w-sm">
                  Hỗ trợ Word (.docx), PDF (.pdf) và Văn bản (.txt, .md).
                </p>
                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={onFileUpload}
                  accept=".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                />
              </div>

              {displaySource && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 s:mb-8 p-4 sm:p-6 bg-green-50 rounded-2xl sm:rounded-3xl border border-green-100 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 sm:gap-4 text-left">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-600 text-white rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                      <FileText size={20} className="sm:w-6 sm:h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-green-900 leading-tight mb-1 line-clamp-1">{displaySource}</p>
                      <p className="text-xs sm:text-sm text-green-700 font-medium">Tệp đã sẵn sàng.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setInputText('');
                      setSelectedFile(null);
                    }}
                    className="text-green-900/40 hover:text-green-900 transition-colors flex-shrink-0"
                  >
                    <XCircle size={24} />
                  </button>
                </motion.div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6 sm:mb-8 flex items-center gap-3 text-rose-600 font-bold bg-rose-50 p-4 sm:p-5 rounded-2xl border border-rose-100 text-sm sm:text-base"
                >
                  <AlertCircle size={20} className="flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 mb-8 sm:mb-12 text-left">
                <div className="bg-slate-50 p-5 sm:p-6 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center gap-3 mb-3 sm:mb-4">
                    <MessageSquare size={18} className="text-indigo-600 sm:w-5 sm:h-5" />
                    <label className="font-black text-slate-800 uppercase tracking-tight text-xs sm:text-sm">Số lượng câu hỏi</label>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="5" 
                      max="20" 
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                      className="flex-1 accent-indigo-600 cursor-pointer h-2 sm:h-auto"
                    />
                    <span className="w-10 sm:w-12 text-center font-black text-lg sm:text-xl text-indigo-600">{numQuestions}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-5 sm:p-6 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center gap-3 mb-3 sm:mb-4">
                    <Clock size={18} className="text-rose-500 sm:w-5 sm:h-5" />
                    <label className="font-black text-slate-800 uppercase tracking-tight text-xs sm:text-sm">Thời gian làm bài</label>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="5" 
                      max="60" 
                      step="5"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                      className="flex-1 accent-rose-500 cursor-pointer h-2 sm:h-auto"
                    />
                    <span className="w-16 sm:w-20 text-center font-black text-lg sm:text-xl text-rose-500">{timeLimit}p</span>
                  </div>
                </div>
              </div>

              <div className="mb-8 flex items-center justify-center">
                <button 
                  onClick={() => setShowImmediateFeedback(!showImmediateFeedback)}
                  className="group flex items-center gap-3 sm:gap-4 bg-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl sm:rounded-3xl border-2 border-slate-100 hover:border-indigo-400 transition-all cursor-pointer w-full sm:w-auto"
                >
                  <div className={`w-12 h-6 sm:w-14 sm:h-7 rounded-full relative transition-colors ${showImmediateFeedback ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                    <div className={`absolute top-0.5 sm:top-1 w-5 h-5 bg-white rounded-full transition-all ${showImmediateFeedback ? 'left-[26px] sm:left-[32px]' : 'left-0.5 sm:left-1'}`}></div>
                  </div>
                  <div className="text-left">
                    <p className="font-black text-slate-800 leading-none mb-1 text-sm sm:text-base">Hiện đáp án ngay</p>
                    <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest leading-none">Hiển thị kết quả sau mỗi câu</p>
                  </div>
                </button>
              </div>

              <div className="mt-8 max-w-md mx-auto">
                <button 
                  id="main-start-btn"
                  onClick={() => handleStartQuiz()}
                  disabled={!inputText && !selectedFile}
                  className={`
                    w-full h-16 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all
                    ${(inputText || selectedFile) 
                      ? 'bg-indigo-600 text-white hover:translate-y-[-2px] hover:shadow-xl shadow-indigo-200' 
                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'}
                  `}
                >
                  <span>BẮT ĐẦU TẠO QUIZ</span>
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>

            <footer className="mt-16 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
              <p>© 2026 QuizMaster AI • Power by Google Gemini</p>
            </footer>

            {history.length > 0 && (
              <motion.section 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-8 sm:mt-16"
              >
                <div className="flex items-center gap-3 mb-6 sm:mb-8 ml-2">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-50 text-indigo-600 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                    <History size={18} className="sm:w-5 sm:h-5" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800 uppercase tracking-tight">Bài tập gần đây</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {history.map((item) => (
                    <motion.div
                      key={item.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => loadHistoryItem(item)}
                      className="group bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 sm:gap-5 overflow-hidden">
                        <div className="w-10 h-10 sm:w-14 sm:h-14 bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white rounded-xl sm:rounded-2xl flex items-center justify-center transition-all flex-shrink-0">
                          <FileText size={20} className="sm:w-6 sm:h-6" />
                        </div>
                        <div className="text-left overflow-hidden">
                          <h4 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1 text-sm sm:text-base">{item.title}</h4>
                          <div className="flex items-center gap-2 sm:gap-3 mt-1 text-slate-400 text-[10px] sm:text-xs font-medium">
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <Calendar size={10} className="sm:w-3 sm:h-3" />
                              {item.date.split(',')[0]}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare size={10} className="sm:w-3 sm:h-3" />
                              {item.questions.length} câu
                            </span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg sm:rounded-xl flex items-center justify-center transition-all sm:opacity-0 group-hover:opacity-100 flex-shrink-0"
                      >
                        <Trash2 size={16} className="sm:w-18" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}
          </motion.div>
        )}

        {state === 'loading' && (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col items-center justify-center p-6 text-center z-50 bg-[#F8FAFC]/90 backdrop-blur-md"
          >
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 mb-6 sm:mb-8">
              <div className="absolute inset-0 border-4 sm:border-8 border-indigo-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 sm:border-8 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
                <BrainCircuit size={32} className="sm:w-12 sm:h-12 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 mb-2 sm:mb-3">Đang kiến tạo tri thức...</h2>
            <p className="text-sm sm:text-lg text-slate-500 font-medium max-w-xs sm:max-w-none">Hệ thống AI đang biên soạn nội dung trắc nghiệm cho bạn.</p>
          </motion.div>
        )}

        {state === 'quiz' && quiz && (
          <motion.div 
            key="quiz"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-12"
          >
            <header className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:justify-between mb-8 s:mb-10 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center justify-between sm:justify-start gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <button 
                    onClick={handleReset}
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 text-slate-600 rounded-xl sm:rounded-2xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm group flex-shrink-0"
                    title="Quay lại trang chủ"
                  >
                    <ArrowLeft size={20} className="sm:w-6 sm:h-6 group-hover:-translate-x-1 transition-transform" />
                  </button>
                  <div className="w-px h-6 sm:h-8 bg-slate-100 mx-0.5 sm:mx-1"></div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-600 text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 flex-shrink-0">
                    <BrainCircuit size={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 leading-none mb-0.5 sm:mb-1 text-sm sm:text-base">QuizMaster AI</h3>
                    <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest line-clamp-1">{quiz.title}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-50">
                 <div className="text-left sm:text-right">
                    <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase mb-0.5 sm:mb-1 tracking-widest">Tiến trình</p>
                    <p className="text-base sm:text-xl font-mono font-black text-indigo-600">
                      {currentQuestionIndex + 1} / {quiz.questions.length}
                    </p>
                 </div>
                 <div className="w-px h-6 sm:h-10 bg-slate-100"></div>
                 <div className="bg-rose-50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl flex items-center gap-2">
                    <Clock size={14} className={`${timeLeft < 60 ? 'animate-pulse text-rose-600' : 'text-rose-500'} sm:w-4 sm:h-4`} />
                    <span className={`font-black font-mono text-sm sm:text-base ${timeLeft < 60 ? 'text-rose-700' : 'text-rose-600'}`}>
                      {formatTime(timeLeft)}
                    </span>
                 </div>
              </div>
            </header>

            <div className="mb-8 sm:mb-12 h-3 sm:h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 sm:p-1">
              <motion.div 
                className="h-full progress-fill rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
              />
            </div>

            <div className="max-w-3xl mx-auto w-full">
              <h2 className="text-2xl sm:text-4xl font-extrabold mb-8 sm:mb-12 text-slate-800 leading-tight">
                {quiz.questions[currentQuestionIndex].text}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12">
                {quiz.questions[currentQuestionIndex].options.map((option, idx) => {
                  const userAnswer = userAnswers[quiz.questions[currentQuestionIndex].id];
                  const isSelected = userAnswer === idx;
                  const hasAnswered = userAnswer !== undefined;
                  const isCorrect = quiz.questions[currentQuestionIndex].correctAnswer === idx;

                  let borderClass = 'border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/10';
                  let bgCircleClass = 'bg-slate-50 text-slate-400';

                  if (isSelected) {
                    borderClass = 'border-indigo-400 bg-indigo-50 shadow-lg shadow-indigo-50';
                    bgCircleClass = 'bg-indigo-600 text-white shadow-md';
                  }

                  if (showImmediateFeedback && hasAnswered) {
                    if (isCorrect) {
                      borderClass = 'border-green-400 bg-green-50 shadow-lg shadow-green-50';
                      bgCircleClass = 'bg-green-600 text-white shadow-md';
                    } else if (isSelected) {
                      borderClass = 'border-rose-400 bg-rose-50 shadow-lg shadow-rose-50';
                      bgCircleClass = 'bg-rose-600 text-white shadow-md';
                    } else {
                      borderClass = 'border-slate-100 bg-white opacity-50';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      disabled={showImmediateFeedback && hasAnswered}
                      onClick={() => handleOptionSelect(quiz.questions[currentQuestionIndex].id, idx)}
                      className={`
                        min-h-[4rem] px-6 sm:px-8 py-4 rounded-2xl sm:rounded-[2rem] border-2 text-left transition-all flex items-center gap-3 sm:gap-5
                        ${borderClass}
                      `}
                    >
                      <div className={`
                        w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-lg sm:text-xl flex-shrink-0
                        ${bgCircleClass}
                      `}>
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <span className={`text-base sm:text-xl font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                        {option}
                      </span>
                      {isSelected && !showImmediateFeedback && (
                        <CheckCircle2 size={20} className="ml-auto text-indigo-600 sm:w-6 sm:h-6 flex-shrink-0" />
                      )}
                      {showImmediateFeedback && hasAnswered && isCorrect && (
                        <CheckCircle size={20} className="ml-auto text-green-600 sm:w-6 sm:h-6 flex-shrink-0" />
                      )}
                      {showImmediateFeedback && isSelected && !isCorrect && (
                        <XCircle size={20} className="ml-auto text-rose-600 sm:w-6 sm:h-6 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {showImmediateFeedback && userAnswers[quiz.questions[currentQuestionIndex].id] !== undefined && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-8 sm:mb-12 p-6 sm:p-8 bg-indigo-50/50 rounded-2xl sm:rounded-[2.5rem] border border-indigo-100"
                >
                  <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 text-white rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                      <MessageSquare size={16} className="sm:w-5 sm:h-5" />
                    </div>
                    <h4 className="font-black text-indigo-900 uppercase tracking-tight text-sm sm:text-base">Giải thích chi tiết</h4>
                  </div>
                  <p className="text-indigo-900 leading-relaxed font-medium text-sm sm:text-lg">
                    {quiz.questions[currentQuestionIndex].explanation}
                  </p>
                </motion.div>
              )}

              <div className="flex items-center justify-between mt-8 sm:mt-16 pt-6 sm:pt-8 border-t border-slate-100">
                <button 
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                  className="px-4 sm:px-8 py-3 sm:py-4 font-bold text-slate-400 hover:text-slate-800 disabled:opacity-0 transition-all uppercase tracking-widest text-xs sm:text-sm"
                >
                  Quay lại
                </button>
                
                {currentQuestionIndex === quiz.questions.length - 1 ? (
                  <button
                    onClick={handleSubmit}
                    className="px-8 sm:px-12 py-4 sm:py-5 bg-indigo-600 text-white rounded-2xl sm:rounded-[2rem] font-black text-base sm:text-lg hover:scale-105 hover:shadow-xl hover:shadow-indigo-100 active:scale-95 transition-all"
                  >
                    NỘP BÀI KẾT QUẢ
                  </button>
                ) : (
                  <button 
                    onClick={handleNext}
                    className="px-8 sm:px-12 py-4 sm:py-5 bg-slate-800 text-white rounded-2xl sm:rounded-[2rem] font-black text-base sm:text-lg hover:scale-105 active:scale-95 transition-all shadow-lg"
                  >
                    TIẾP THEO
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {state === 'results' && quiz && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12"
          >
            <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-8 sm:p-16 text-center shadow-card border border-slate-100 mb-10 relative overflow-hidden">
               {/* Decor */}
              <div className="absolute top-[-20px] right-[-20px] w-48 h-48 sm:w-64 sm:h-64 bg-indigo-50 rounded-full opacity-50 blur-3xl"></div>
              
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-20 h-20 sm:w-28 sm:h-28 bg-indigo-600 text-white rounded-[1.5rem] sm:rounded-[2.5rem] mb-6 sm:10 shadow-2xl shadow-indigo-200">
                  <Trophy size={40} className="sm:w-14 sm:h-14" />
                </div>
                
                <h2 className="text-3xl sm:text-5xl font-black text-slate-800 mb-2 sm:mb-4">Kết Quả Bài Làm</h2>
                <p className="text-base sm:text-xl text-slate-500 mb-8 sm:mb-12 font-medium px-4">Bản lĩnh học tập của bạn thật ấn tượng!</p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 mb-8 sm:mb-16">
                  <div className="text-center">
                    <div className="text-4xl sm:text-6xl font-black text-slate-800 mb-1 sm:mb-3">{calculateScore().correct} / {calculateScore().total}</div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">CÂU TRẢ LỜI ĐÚNG</div>
                  </div>
                  <div className="hidden sm:block w-px h-24 bg-slate-100"></div>
                  <div className="text-center">
                    <div className="text-4xl sm:text-6xl font-black text-indigo-600 mb-1 sm:mb-3">{calculateScore().percentage}%</div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">ĐIỂM TỔNG KẾT</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  <button 
                    onClick={handleReset}
                    className="h-16 sm:h-20 bg-indigo-600 text-white rounded-2xl sm:rounded-[2rem] font-black text-base sm:text-lg flex items-center justify-center gap-3 sm:gap-4 hover:shadow-2xl hover:shadow-indigo-100 transition-all"
                  >
                    <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
                    <span>TRANG CHỦ</span>
                  </button>
                  <button 
                    onClick={() => {
                      setState('quiz');
                      setCurrentQuestionIndex(0);
                    }}
                    className="h-16 sm:h-20 bg-slate-50 text-slate-800 rounded-2xl sm:rounded-[2rem] font-black text-base sm:text-lg border-2 border-slate-200 flex items-center justify-center gap-3 sm:gap-4 hover:bg-white hover:border-indigo-400 transition-all"
                  >
                    <FileText size={18} className="sm:w-5 sm:h-5" />
                    <span>XEM LẠI ĐÁP ÁN</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6 sm:space-y-8 mt-12 sm:mt-16 px-2 sm:px-4">
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-3 sm:gap-4">
                <div className="w-1.5 sm:w-2 h-6 sm:h-8 bg-indigo-600 rounded-full"></div>
                Phân tích chi tiết
              </h3>
              {quiz.questions.map((q, idx) => {
                const isCorrect = userAnswers[q.id] === q.correctAnswer;
                return (
                  <div key={q.id} className="bg-white rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-10 border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="sm:absolute top-0 right-0 px-0 sm:px-8 py-0 sm:py-6 mb-4 sm:mb-0">
                       {isCorrect ? (
                         <div className="inline-block bg-green-50 text-green-600 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest border border-green-100 text-center w-full sm:w-auto">Chính xác</div>
                       ) : (
                         <div className="inline-block bg-rose-50 text-rose-600 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest border border-rose-100 text-center w-full sm:w-auto">Chưa đúng</div>
                       )}
                    </div>

                    <div className="flex items-start gap-4 sm:gap-6 mb-6 sm:mb-8 sm:pr-32">
                      <div className={`
                        flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-lg sm:text-xl
                        ${isCorrect ? 'bg-green-100 text-green-600' : 'bg-rose-100 text-rose-600'}
                      `}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xl sm:text-2xl font-bold text-slate-800 leading-tight">{q.text}</h4>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 sm:ml-18 sm:pl-18">
                      {q.options.map((opt, oIdx) => {
                        const isUserChoice = userAnswers[q.id] === oIdx;
                        const isCorrectAnswer = q.correctAnswer === oIdx;
                        
                        let borderClass = 'border-slate-50 text-slate-500';
                        let bgClass = 'bg-slate-50/50';
                        let icon = null;

                        if (isUserChoice && isCorrectAnswer) {
                          borderClass = 'border-green-400 text-green-700';
                          bgClass = 'bg-green-50';
                          icon = <CheckCircle size={18} className="text-green-600 sm:w-5 sm:h-5" />;
                        } else if (isUserChoice && !isCorrectAnswer) {
                          borderClass = 'border-rose-400 text-rose-700';
                          bgClass = 'bg-rose-50';
                          icon = <XCircle size={18} className="text-rose-600 sm:w-5 sm:h-5" />;
                        } else if (isCorrectAnswer) {
                          borderClass = 'border-green-200 text-green-600';
                          bgClass = 'border-dashed border-green-400 bg-green-50/20';
                          icon = <CheckCircle size={18} className="text-green-400 sm:w-5 sm:h-5" />;
                        }

                        return (
                          <div key={oIdx} className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 flex items-center justify-between font-bold text-base sm:text-lg ${borderClass} ${bgClass}`}>
                            <span className="line-clamp-2 md:line-clamp-none">{opt}</span>
                            {icon}
                          </div>
                        );
                      })}
                    </div>
                    {q.explanation && (
                      <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-indigo-50/50 rounded-2xl sm:rounded-3xl border border-indigo-100 flex gap-3 sm:gap-4 text-indigo-900 leading-relaxed font-medium text-sm sm:text-base">
                        <MessageSquare size={20} className="flex-shrink-0 mt-0.5 text-indigo-600 sm:w-6 sm:h-6" />
                        <p>{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
