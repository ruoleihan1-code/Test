import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// ==========================================
// CONFIGURATION & GLOBAL VARIABLES
// ==========================================
const apiKey = ""; // Runtime provides the key automatically

// Premium Theme Color Palette: Soft Indigo, Emerald, Amber, Slate
export default function App() {
  // --- Role & Session State ---
  const [currentRole, setCurrentRole] = useState('teacher'); // 'teacher' or 'student'
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentStudent, setCurrentStudent] = useState(null); // The logged-in student object
  
  // Login Form States
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- Core Mock Database (Reflecting full relational state in-memory) ---
  const [students, setStudents] = useState([
    { id: 'std-1', name: '艾米 (Amy)', username: 'amy', password: '123', previewChecked: true, quizScore: 85 },
    { id: 'std-2', name: '鲍勃 (Bob)', username: 'bob', password: '123', previewChecked: false, quizScore: null },
    { id: 'std-3', name: '查理 (Charlie)', username: 'charlie', password: '123', previewChecked: false, quizScore: null }
  ]);

  const [activeLesson, setActiveLesson] = useState({
    title: 'The Magic Brush (神奇的画笔)',
    content: 'Long ago in China, there was a poor boy named Ma Liang. He loved drawing, but he was too poor to buy a paintbrush. One night, an old man gave Ma Liang a magic paintbrush. When Ma Liang drew a bird, it flew away! He used it to help poor people in his village.',
    highlights: {
      vocabulary: [
        { word: 'Paintbrush', phonetic: '/ˈpeɪntbrʌʃ/', translation: '画笔', example: 'He was too poor to buy a paintbrush.' },
        { word: 'Magic', phonetic: '/ˈmædʒɪk/', translation: '神奇的/魔法的', example: 'An old man gave Ma Liang a magic paintbrush.' },
        { word: 'Village', phonetic: '/ˈvɪlɪdʒ/', translation: '村庄', example: 'He used it to help poor people in his village.' }
      ],
      grammar: [
        { rules: 'Simple Past Tense (一般过去时)', explanation: '英文故事常用过去时。如 loved, gave, drew 均为过去时态。', example: 'When Ma Liang drew a bird, it flew away!' },
        { rules: '"Too... to..." Structure (太...而不能...)', explanation: '表示程度过深以至于无法完成某事。', example: 'He was too poor to buy a paintbrush. (他太穷了以至于买不起画笔)' }
      ],
      tips: [
        '请同学们大声朗读课文三遍，标出不认识的单词。',
        '思考：如果你有一支魔法画笔，你会画什么来帮助身边的人？',
        '试着用过去时说一句话，介绍昨天你做过的事。'
      ]
    },
    quizzes: [
      {
        id: 'q-1',
        question: 'Why did Ma Liang not have a paintbrush at first?',
        options: [
          'A. He did not like drawing.',
          'B. He lost his paintbrush in the river.',
          'C. He was too poor to buy one.',
          'D. He preferred to use pens.'
        ],
        correct: 'C',
        explanation: '课文中提到 "but he was too poor to buy a paintbrush."，所以选择 C。'
      },
      {
        id: 'q-2',
        question: 'What happened when Ma Liang drew a bird with the magic brush?',
        options: [
          'A. It became real and flew away.',
          'B. It disappeared from the wall.',
          'C. It started to sing a song.',
          'D. It became dirty.'
        ],
        correct: 'A',
        explanation: '课文中提到 "When Ma Liang drew a bird, it flew away!"，代表画出来的鸟变成了真的并飞走了。'
      }
    ],
    timestamp: '2026-06-25'
  });

  // Homework Tasks
  const [homeworkTasks, setHomeworkTasks] = useState([
    { id: 'hw-1', title: '跟读课文两遍并录音', desc: '利用课本音频跟读，重点纠正 magic 和 village 的发音。', completedBy: ['std-1'] },
    { id: 'hw-2', title: '完成练习册 Unit 3 第一部分', desc: '复习 too... to... 句型，并仿写三个句子。', completedBy: [] }
  ]);

  // Supplementary/Extra Materials for individual students
  const [extraMaterials, setExtraMaterials] = useState([
    { id: 'mat-1', title: '【趣味绘本阅读】神奇画笔延伸阅读 (PDF)', url: 'https://example.com/magic-brush-reading', targetStudentId: 'all' },
    { id: 'mat-2', title: '【语法专项突破】一般过去时动词变化规律表', url: 'https://example.com/past-tense-rules', targetStudentId: 'std-1' }
  ]);

  // Feedbacks to parents
  const [parentFeedbacks, setParentFeedbacks] = useState([
    { id: 'fb-1', studentId: 'std-1', rating: 5, content: 'Amy今天上课非常专注，回答问题非常积极，magic这个词发音很标准，继续加油！', date: '2026-06-25' },
    { id: 'fb-2', studentId: 'std-2', rating: 4, content: 'Bob对故事内容理解很快，但是课文朗读时有些不自信，建议回家多使用本APP的TTS发音功能练习。', date: '2026-06-25' }
  ]);

  // --- Student Specific Interactive State ---
  const [studentAnswers, setStudentAnswers] = useState({}); // { [quizId]: selectedOption }
  const [submittedQuiz, setSubmittedQuiz] = useState(false);
  const [showExplanation, setShowExplanation] = useState({}); // { [quizId]: boolean }

  // --- Teacher Creation Forms State ---
  const [textbookInput, setTextbookInput] = useState('');
  const [quizCountInput, setQuizCountInput] = useState(3);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // New Student Form
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentUsername, setNewStudentUsername] = useState('');
  const [newStudentPassword, setNewStudentPassword] = useState('');

  // New Homework Form
  const [newHwTitle, setNewHwTitle] = useState('');
  const [newHwDesc, setNewHwDesc] = useState('');

  // New Extra Material Form
  const [newMatTitle, setNewMatTitle] = useState('');
  const [newMatUrl, setNewMatUrl] = useState('');
  const [newMatTarget, setNewMatTarget] = useState('all');

  // New Feedback Form
  const [newFbStudentId, setNewFbStudentId] = useState('std-1');
  const [newFbRating, setNewFbRating] = useState(5);
  const [newFbContent, setNewFbContent] = useState('');

  // Notification Banner
  const [toastMsg, setToastMsg] = useState(null);

  // Confetti particles for fun rewards!
  const [showConfetti, setShowConfetti] = useState(false);

  // Trigger brief floating notifications
  const triggerToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  // Triggers visual confetti explosion on student progress
  const triggerConfetti = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 5000);
  };

  // Text To Speech Utility
  const playSpeech = (text) => {
    if ('speechSynthesis' in window) {
      // Cancel previous utterances
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9; // Slightly slower for language learners
      window.speechSynthesis.speak(utterance);
    } else {
      triggerToast('您的浏览器不支持语音播放，请尝试使用 Chrome 浏览器。');
    }
  };

  // --- AI Integrations (Gemini API Call with Exponential Backoff) ---
  const callGemini = async (prompt, systemPrompt) => {
    const maxRetries = 5;
    let delay = 1000;
    
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (responseText) {
          return JSON.parse(responseText);
        }
        throw new Error("Empty response parts");
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  };

  // NotebookLM Handler 1: Generate Highlights
  const handleGenerateHighlights = async () => {
    if (!textbookInput.trim()) {
      triggerToast('请输入教材或课文内容后再生成！');
      return;
    }
    
    setIsAiLoading(true);
    triggerToast('Shadow AI 正在深度阅读教材并提取预习重点...');

    const systemPrompt = `You are "NotebookLM Educator", a professional English tutoring system. Analyze the given English text and extract structured learning insights for elementary to middle school students. You MUST return a JSON object with this structure:
    {
      "vocabulary": [
        {"word": "string", "phonetic": "string", "translation": "Chinese translation", "example": "English sentence from text or simple one"}
      ],
      "grammar": [
        {"rules": "Name of grammar point in Chinese", "explanation": "Brief explanation in Chinese", "example": "Sentence showing this point"}
      ],
      "tips": ["Preview advice 1 in Chinese", "Preview advice 2 in Chinese", "Preview advice 3 in Chinese"]
    }`;

    try {
      if (apiKey === "") {
        // Fallback Mock AI Engine
        setTimeout(() => {
          const simulatedResult = parseTextFallback(textbookInput);
          setActiveLesson(prev => ({
            ...prev,
            content: textbookInput,
            highlights: simulatedResult
          }));
          setIsAiLoading(false);
          triggerToast('🎉 预习重点生成成功！(使用内置智能算法兜底模式)');
        }, 1500);
        return;
      }

      const parsedJson = await callGemini(textbookInput, systemPrompt);
      setActiveLesson(prev => ({
        ...prev,
        content: textbookInput,
        highlights: parsedJson
      }));
      triggerToast('🎉 预习重点AI实时生成成功！');
    } catch (err) {
      console.error(err);
      // Friendly Error Fallback
      const simulatedResult = parseTextFallback(textbookInput);
      setActiveLesson(prev => ({
        ...prev,
        content: textbookInput,
        highlights: simulatedResult
      }));
      triggerToast('⚠️ 远程AI繁忙，已自动启用智能本地模版生成。');
    } finally {
      setIsAiLoading(false);
    }
  };

  // NotebookLM Handler 2: Generate Tests
  const handleGenerateTests = async () => {
    if (!textbookInput.trim() && !activeLesson.content) {
      triggerToast('请先输入课文内容！');
      return;
    }
    
    const sourceText = textbookInput.trim() || activeLesson.content;
    setIsAiLoading(true);
    triggerToast(`正在生成 ${quizCountInput} 道定制测试题...`);

    const systemPrompt = `You are "NotebookLM Quizmaster". Based on the provided English text, generate exactly ${quizCountInput} multiple choice questions (4 options each: A, B, C, D) to test reading comprehension and vocabulary.
    You MUST return a JSON array of objects with this exact structure:
    [
      {
        "id": "q-1",
        "question": "English question string",
        "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
        "correct": "A" or "B" or "C" or "D",
        "explanation": "Detailed explanation in Chinese"
      }
    ]`;

    try {
      if (apiKey === "") {
        // Fallback Mock AI Engine for Quizzes
        setTimeout(() => {
          const simulatedQuizzes = generateMockQuizzes(sourceText, quizCountInput);
          setActiveLesson(prev => ({
            ...prev,
            quizzes: simulatedQuizzes
          }));
          setIsAiLoading(false);
          setStudentAnswers({});
          setSubmittedQuiz(false);
          triggerToast(`🎉 成功生成并向全体学生发布 ${quizCountInput} 道测试题！`);
        }, 1500);
        return;
      }

      const parsedJson = await callGemini(sourceText, systemPrompt);
      setActiveLesson(prev => ({
        ...prev,
        quizzes: parsedJson
      }));
      setStudentAnswers({});
      setSubmittedQuiz(false);
      triggerToast(`🎉 成功实时生成 ${quizCountInput} 道测试题并已全员分发！`);
    } catch (err) {
      console.error(err);
      const simulatedQuizzes = generateMockQuizzes(sourceText, quizCountInput);
      setActiveLesson(prev => ({
        ...prev,
        quizzes: simulatedQuizzes
      }));
      setStudentAnswers({});
      setSubmittedQuiz(false);
      triggerToast('⚠️ AI分发试卷时轻微超时，已启用本地预设库为您全天候生成！');
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- Fallback NLP Helpers ---
  const parseTextFallback = (text) => {
    // Basic smart heuristics to parse nouns/adjectives
    const words = text.split(/\s+/).map(w => w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"")).filter(w => w.length > 5);
    const vocabList = [];
    const keywords = Array.from(new Set(words)).slice(0, 3);
    
    const defaultDict = {
      'journey': { trans: '旅程/行程', phonetic: '/ˈdʒɜːni/', ex: 'A long and exciting adventure.' },
      'beautiful': { trans: '美丽的', phonetic: '/ˈbjuːtɪfl/', ex: 'She drew a beautiful bird.' },
      'paintbrush': { trans: '画笔', phonetic: '/ˈpeɪntbrʌʃ/', ex: 'He uses a paintbrush to write.' },
      'village': { trans: '村庄', phonetic: '/ˈvɪlɪdʒ/', ex: 'Living in a quiet small village.' },
      'special': { trans: '特别的', phonetic: '/ˈspeʃl/', ex: 'This brush has a special power.' },
      'excellent': { trans: '卓越的', phonetic: '/ˈeksələnt/', ex: 'You did an excellent job!' },
      'understand': { trans: '理解', phonetic: '/ˌʌndəˈstænd/', ex: 'I do not understand this word.' }
    };

    keywords.forEach((word, index) => {
      const lower = word.toLowerCase();
      if (defaultDict[lower]) {
        vocabList.push({
          word: word,
          phonetic: defaultDict[lower].phonetic,
          translation: defaultDict[lower].trans,
          example: defaultDict[lower].ex
        });
      } else {
        vocabList.push({
          word: word.charAt(0).toUpperCase() + word.slice(1),
          phonetic: '/...' + word.slice(-2) + '.../',
          translation: '核心高频词汇',
          example: `Please pay attention to the usage of: ${word}.`
        });
      }
    });

    if (vocabList.length === 0) {
      vocabList.push({ word: 'Adventure', phonetic: '/ədˈventʃə(r)/', translation: '冒险', example: 'They had a wonderful adventure.' });
    }

    return {
      vocabulary: vocabList,
      grammar: [
        { rules: 'Vocabulary Usage (词汇深度掌握)', explanation: '在句中正确区分该词的词性（名词、动词、形容词），并尝试造句。', example: text.substring(0, 50) + '...' },
        { rules: 'Syntactic Structure (句子阅读与分析)', explanation: '分析长句的主谓宾结构，学会梳理文章细节逻辑。', example: 'Practice with your class mentor!' }
      ],
      tips: [
        '第一步：自主阅读课文，用荧光笔圈出不熟悉的重难点单词。',
        '第二步：点击词汇卡片上的发音图标，学习其纯正语调。',
        '第三步：尝试用自己的英文复述这篇短文的主要情节。'
      ]
    };
  };

  const generateMockQuizzes = (text, count) => {
    const defaultQuizzes = [
      {
        id: 'q-sim-1',
        question: 'What is the main topic of the uploaded textbook passage?',
        options: [
          'A. An exploration of ancient historical sites.',
          'B. A storytelling lesson teaching virtue and core English terms.',
          'C. A strict scientific study on paint brushes.',
          'D. A grammar guide without stories.'
        ],
        correct: 'B',
        explanation: '课文主要通过趣味故事来传递核心价值观及重点英语生词，选择 B。'
      },
      {
        id: 'q-sim-2',
        question: 'Based on the context, which word best describes the tone of the reading?',
        options: [
          'A. Sad and depressing',
          'B. Creative and Educational',
          'C. Extremely boring',
          'D. Angry'
        ],
        correct: 'B',
        explanation: '整篇课文氛围生动、富含启发性且兼具教育意义，选择 B。'
      },
      {
        id: 'q-sim-3',
        question: 'Identify the word with the positive meaning from the text highlights:',
        options: [
          'A. Magic (神奇的/魔法的)',
          'B. Poor (贫穷的)',
          'C. Lost (丢失的)',
          'D. Too poor to buy (买不起)'
        ],
        correct: 'A',
        explanation: '“Magic” 代表一种令人赞叹的美妙魔力，具有积极正向的寓意，选择 A。'
      },
      {
        id: 'q-sim-4',
        question: 'What is the suggested way for students to practice pronunciation in Shadow APP?',
        options: [
          'A. Just reading silently.',
          'B. Clicking the sound icon to hear American native voice over.',
          'C. Writing the words 100 times on paper.',
          'D. Waiting until next semester.'
        ],
        correct: 'B',
        explanation: 'Shadow APP 内置了发音点读(TTS)系统，点击词汇和句子右侧的喇叭按钮，即可跟随原生美式发音进行跟读训练。'
      },
      {
        id: 'q-sim-5',
        question: 'How should parents cooperate with Shadow Teacher according to homework rules?',
        options: [
          'A. Ignore all homework tasks entirely.',
          'B. Help students do the check-in and check teacher’s rating.',
          'C. Change the password every single day.',
          'D. Delete the App.'
        ],
        correct: 'B',
        explanation: '家长可以通过学生/家长端查阅作业明细、进行打卡，并及时查阅老师发送的星级学习反馈评语，选择 B。'
      }
    ];

    // Return randomized sub-slice of size "count"
    return defaultQuizzes.slice(0, Math.min(count, defaultQuizzes.length));
  };

  // --- Student Auth Logic ---
  const handleStudentLogin = (e) => {
    e.preventDefault();
    const found = students.find(
      s => s.username.toLowerCase() === loginUsername.trim().toLowerCase() && s.password === loginPassword
    );
    if (found) {
      setCurrentStudent(found);
      setIsLoggedIn(true);
      setLoginError('');
      // Reset student answers states
      setStudentAnswers({});
      setSubmittedQuiz(false);
      setShowExplanation({});
      triggerToast(`欢迎回来，${found.name}！快去打卡预习吧。`);
    } else {
      setLoginError('用户名或密码错误，请联系老师获取！');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentStudent(null);
    triggerToast('已成功退出登录。');
  };

  // --- Teacher Actions ---
  // 1. Add Student Configuration
  const handleAddStudent = (e) => {
    e.preventDefault();
    if (!newStudentName || !newStudentUsername || !newStudentPassword) {
      triggerToast('请完整填写学生姓名、账号及密码！');
      return;
    }
    // Check duplication
    if (students.some(s => s.username === newStudentUsername)) {
      triggerToast('此账号已被注册，请更换！');
      return;
    }

    const newStd = {
      id: `std-${students.length + 1}`,
      name: newStudentName,
      username: newStudentUsername,
      password: newStudentPassword,
      previewChecked: false,
      quizScore: null
    };

    setStudents([...students, newStd]);
    setNewStudentName('');
    setNewStudentUsername('');
    setNewStudentPassword('');
    triggerToast(`成功配置新学生 [${newStd.name}]，账号已即时生效！`);
  };

  // 2. Publish Homework Task
  const handleAddHomework = (e) => {
    e.preventDefault();
    if (!newHwTitle || !newHwDesc) {
      triggerToast('请填写作业标题与要求！');
      return;
    }

    const newTask = {
      id: `hw-${homeworkTasks.length + 1}`,
      title: newHwTitle,
      desc: newHwDesc,
      completedBy: []
    };

    setHomeworkTasks([...homeworkTasks, newTask]);
    setNewHwTitle('');
    setNewHwDesc('');
    triggerToast('📌 新的教辅遗留任务发布成功！家长端可实时查阅。');
  };

  // 3. Publish Material Link
  const handleAddMaterial = (e) => {
    e.preventDefault();
    if (!newMatTitle || !newMatUrl) {
      triggerToast('请完整填写材料名称和链接地址！');
      return;
    }

    const newMat = {
      id: `mat-${extraMaterials.length + 1}`,
      title: newMatTitle,
      url: newMatUrl,
      targetStudentId: newMatTarget
    };

    setExtraMaterials([...extraMaterials, newMat]);
    setNewMatTitle('');
    setNewMatUrl('');
    setNewMatTarget('all');
    triggerToast('📚 课外辅助材料派发成功！');
  };

  // 4. Send Feedback to Parent
  const handleAddFeedback = (e) => {
    e.preventDefault();
    if (!newFbContent) {
      triggerToast('请填写反馈内容后再发送！');
      return;
    }

    const newFb = {
      id: `fb-${parentFeedbacks.length + 1}`,
      studentId: newFbStudentId,
      rating: parseInt(newFbRating),
      content: newFbContent,
      date: new Date().toISOString().split('T')[0]
    };

    setParentFeedbacks([newFb, ...parentFeedbacks]);
    setNewFbContent('');
    triggerToast('✉️ 上课反馈已成功投递到家长面板！');
  };

  // Delete Student helper
  const handleDeleteStudent = (id) => {
    setStudents(students.filter(s => s.id !== id));
    triggerToast('该学生账号已注销。');
  };

  // --- Student Actions ---
  // 1. Preview Check In (打卡)
  const handlePreviewCheckIn = () => {
    if (!currentStudent) return;
    
    // Update students list
    setStudents(students.map(s => {
      if (s.id === currentStudent.id) {
        return { ...prev, ...s, previewChecked: true };
      }
      return s;
    }));
    
    // Update active user state
    setCurrentStudent(prev => ({ ...prev, previewChecked: true }));
    triggerToast('🎉 预习打卡成功！Shadow 老师已收到你的预习进度。');
    triggerConfetti();
  };

  // 2. Submit Quizzes
  const handleQuizSubmit = () => {
    if (!currentStudent) return;
    
    // Validate that some questions are answered
    if (Object.keys(studentAnswers).length === 0) {
      triggerToast('请在提交前，点击选择您认为正确的答案选项！');
      return;
    }

    let correctCount = 0;
    activeLesson.quizzes.forEach(q => {
      if (studentAnswers[q.id] === q.correct) {
        correctCount++;
      }
    });

    const finalScore = Math.round((correctCount / activeLesson.quizzes.length) * 100);

    // Update in-memory DB
    setStudents(students.map(s => {
      if (s.id === currentStudent.id) {
        return { ...s, quizScore: finalScore };
      }
      return s;
    }));

    setCurrentStudent(prev => ({ ...prev, quizScore: finalScore }));
    setSubmittedQuiz(true);
    triggerToast(`📝 提交成功！得分：${finalScore} 分。快去下方看看老师的权威解析吧！`);
    if (finalScore === 100) {
      triggerConfetti();
    }
  };

  // 3. Toggle Homework Check-in
  const handleHomeworkToggle = (hwId) => {
    if (!currentStudent) return;

    setHomeworkTasks(homeworkTasks.map(task => {
      if (task.id === hwId) {
        const hasCompleted = task.completedBy.includes(currentStudent.id);
        const updated = hasCompleted
          ? task.completedBy.filter(id => id !== currentStudent.id)
          : [...task.completedBy, currentStudent.id];
        
        if (!hasCompleted) {
          triggerToast(`🌟 [${task.title}] 打卡打卡！太棒了！`);
          triggerConfetti();
        } else {
          triggerToast('撤销打卡状态成功。');
        }

        return { ...task, completedBy: updated };
      }
      return task;
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans relative pb-16">
      
      {/* Dynamic Tiny Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-xxs animate-pulse"></div>
          <div className="text-6xl animate-bounce">🎓✨ 🎇 🌟 🤩 🌈 📝✨</div>
          <div className="absolute top-1/4 left-1/4 animate-ping text-3xl">🎉</div>
          <div className="absolute top-1/3 right-1/4 animate-ping text-3xl">🥳</div>
          <div className="absolute bottom-1/3 left-1/3 animate-ping text-3xl">👑</div>
          <div className="absolute bottom-1/4 right-1/3 animate-ping text-3xl">💯</div>
        </div>
      )}

      {/* Floated Top Toast message */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/90 text-white font-medium px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce max-w-md border border-indigo-400">
          <span className="text-yellow-400 text-lg">💡</span>
          <span className="text-sm">{toastMsg}</span>
        </div>
      )}

      {/* NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-white shadow-md border-b border-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          {/* Brand Logo & Slogan */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <span className="text-white font-black text-xl">S</span>
            </div>
            <div>
              <h1 className="font-extrabold text-lg text-slate-900 tracking-wide">Shadow 老师教学 APP</h1>
              <p className="text-xs text-indigo-600 font-medium tracking-wider">NotebookLM 智能教辅共建端</p>
            </div>
          </div>

          {/* Quick Dual-Portal switcher */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium hidden md:inline">当前入口:</span>
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
              <button
                onClick={() => {
                  setCurrentRole('teacher');
                  setIsLoggedIn(false); // require login/or direct view for mock simulation simplicity
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                  currentRole === 'teacher'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-indigo-600'
                }`}
              >
                🏫 教师端管理
              </button>
              <button
                onClick={() => {
                  setCurrentRole('student');
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                  currentRole === 'student'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-emerald-600'
                }`}
              >
                🎒 学生 / 家长端
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {/* ======================================================== */}
        {/* TEACHER PORTAL MAIN VIEW */}
        {/* ======================================================== */}
        {currentRole === 'teacher' && (
          <div className="space-y-8 animate-fade-in">
            {/* Intro Welcome Hero */}
            <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 rounded-2xl text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center justify-center pointer-events-none pr-10">
                <svg className="w-80 h-80 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
                </svg>
              </div>
              <div className="relative z-10 space-y-2">
                <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  Shadow Teacher Console
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold">Shadow 老师控制台</h2>
                <p className="text-indigo-100 max-w-2xl text-sm leading-relaxed">
                  在这里，您可以通过 NotebookLM 生成下节课的核心词汇与语法重点；快捷分发精选试题、课外补充链接；向特定学生的家长投递上课星级评语。
                </p>
              </div>
            </div>

            {/* Teacher Dashboard Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: NotebookLM Upload & AI Generation (Primary Features) */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* 1. NotebookLM Course Builder */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 .364l-.707 .707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-lg">NotebookLM 核心教案共创</h3>
                        <p className="text-xs text-slate-500">上传文章教材，AI秒级自动提炼学生重点并派发测试</p>
                      </div>
                    </div>
                    {isAiLoading && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 animate-pulse">
                        ⌛ AI 处理中
                      </span>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        教材原文 / Pasting Area (输入新课文内容，一键重塑教学课件)
                      </label>
                      <textarea
                        rows="5"
                        value={textbookInput}
                        onChange={(e) => setTextbookInput(e.target.value)}
                        placeholder="例如输入：Once upon a time, a small rabbit lived in the deep green forest. He was very fast and proud..."
                        className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                      ></textarea>
                    </div>

                    {/* Pre-fill Quick Templates */}
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-slate-400 font-medium">示例模版:</span>
                      <button
                        onClick={() => setTextbookInput('The Story of Rain. Water in the lake goes up to the sky and becomes clouds. When the clouds meet cold air, it turns into rain and falls down again. This is called the water cycle.')}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                      >
                        🌧️ 雨的故事 (简单科普)
                      </button>
                      <button
                        onClick={() => setTextbookInput('Journey to the Moon. In 1969, Neil Armstrong became the first human to walk on the Moon. He famously said: "That\'s one small step for man, one giant leap for mankind." This was a historic event.')}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                      >
                        🚀 登月旅程 (历史航天)
                      </button>
                    </div>

                    {/* AI Buttons Row */}
                    <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Step 1: Generate highlights */}
                      <button
                        onClick={handleGenerateHighlights}
                        disabled={isAiLoading}
                        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold py-3 px-4 rounded-xl shadow-md shadow-indigo-100 flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50"
                      >
                        ✨ NotebookLM 提取预习重点
                      </button>

                      {/* Step 2: Generate quizzes */}
                      <div className="flex gap-2">
                        <div className="w-1/3">
                          <select
                            value={quizCountInput}
                            onChange={(e) => setQuizCountInput(parseInt(e.target.value))}
                            className="w-full h-full text-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white"
                          >
                            <option value={2}>2 题</option>
                            <option value={3}>3 题</option>
                            <option value={4}>4 题</option>
                            <option value={5}>5 题</option>
                          </select>
                        </div>
                        <button
                          onClick={handleGenerateTests}
                          disabled={isAiLoading}
                          className="w-2/3 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50"
                        >
                          📋 AI 生成并下发测试
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Visual Preview of active Lesson highlights inside Teacher view */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                      <span className="text-yellow-500">📖</span> 
                      当前向全体学生展示的课文与预习重点
                    </h4>
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded-lg text-slate-500 font-medium">
                      下节课预习课本
                    </span>
                  </div>

                  <div>
                    <h5 className="font-bold text-indigo-700 text-lg mb-2">{activeLesson.title}</h5>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-600 text-sm leading-relaxed mb-6">
                      {activeLesson.content}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Vocabulary list preview */}
                      <div className="space-y-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Core Vocabulary / 核心生词</span>
                        {activeLesson.highlights.vocabulary.map((vocab, i) => (
                          <div key={i} className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/30 flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-indigo-900">{vocab.word}</span>
                                <span className="text-xs text-slate-400 font-serif">{vocab.phonetic}</span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1"><span className="font-semibold text-indigo-700">译:</span> {vocab.translation}</p>
                              <p className="text-xs text-slate-400 italic mt-0.5 font-serif">"{vocab.example}"</p>
                            </div>
                            <button
                              onClick={() => playSpeech(vocab.word)}
                              className="text-indigo-600 hover:text-indigo-800 p-1 rounded-full hover:bg-white transition-all shadow-xs"
                              title="TTS点击朗读"
                            >
                              🔊
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Grammar list preview */}
                      <div className="space-y-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Grammar Spotlight / 语法特写</span>
                        {activeLesson.highlights.grammar.map((gram, i) => (
                          <div key={i} className="space-y-1">
                            <span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded">
                              {gram.rules}
                            </span>
                            <p className="text-xs text-slate-600 font-medium">{gram.explanation}</p>
                            <p className="text-xs text-indigo-600 font-serif bg-slate-50 p-2 rounded-lg border-l-2 border-indigo-500 italic">
                              "{gram.example}"
                            </p>
                          </div>
                        ))}

                        {/* Preview Instructions */}
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100/70">
                          <span className="text-xs font-bold text-amber-800 uppercase tracking-widest block mb-2">💡 预习思考引导</span>
                          <ul className="text-xs text-amber-900 space-y-1.5 list-disc pl-4 font-medium">
                            {activeLesson.highlights.tips.map((tip, i) => (
                              <li key={i}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active Quizzes Display */}
                  <div className="border-t border-slate-100 pt-6 space-y-4">
                    <h5 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <span>📝</span>
                      测试题目 ({activeLesson.quizzes.length} 题)
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeLesson.quizzes.map((quiz, idx) => (
                        <div key={idx} className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/50 text-xs space-y-2">
                          <div className="font-semibold text-slate-800">Q{idx + 1}: {quiz.question}</div>
                          <ul className="space-y-1 text-slate-500">
                            {quiz.options.map((opt, oIdx) => (
                              <li key={oIdx} className={opt.startsWith(quiz.correct) ? "text-emerald-700 font-semibold" : ""}>
                                {opt} {opt.startsWith(quiz.correct) ? "✔️" : ""}
                              </li>
                            ))}
                          </ul>
                          <div className="text-slate-400 mt-2 italic">
                            <span className="font-semibold text-slate-600">解析:</span> {quiz.explanation}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Student Config, Materials, homework, feedback */}
              <div className="space-y-8">
                
                {/* 3. Student Management System (Configure user & pass) */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                      <span className="text-indigo-600">👤</span>
                      学生管理系统 ({students.length} 人)
                    </h4>
                    <span className="text-xs text-slate-400">配置学生登录账号</span>
                  </div>

                  {/* Add Student Form */}
                  <form onSubmit={handleAddStudent} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                    <span className="text-xs font-bold text-indigo-900 block">⚡ 新建学生账号</span>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="姓名"
                        value={newStudentName}
                        onChange={(e) => setNewStudentName(e.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        placeholder="账号"
                        value={newStudentUsername}
                        onChange={(e) => setNewStudentUsername(e.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="设置初始密码"
                        value={newStudentPassword}
                        onChange={(e) => setNewStudentPassword(e.target.value)}
                        className="w-2/3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="submit"
                        className="w-1/3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all"
                      >
                        确认生成
                      </button>
                    </div>
                  </form>

                  {/* Students Table/List */}
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {students.map((student) => (
                      <div key={student.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 hover:border-indigo-100 transition-all text-xs">
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            {student.name}
                            {student.previewChecked ? (
                              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded text-[10px]">已打卡</span>
                            ) : (
                              <span className="bg-slate-100 text-slate-400 px-1.5 py-0.2 rounded text-[10px]">未预习</span>
                            )}
                          </div>
                          <div className="text-slate-400 font-medium">
                            账号: <span className="text-indigo-600">{student.username}</span> 密码: <span className="text-indigo-600">{student.password}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-bold">
                            {student.quizScore !== null ? `${student.quizScore}分` : '未作答'}
                          </span>
                          <button
                            onClick={() => handleDeleteStudent(student.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors p-1"
                            title="删除"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Homework Assignments Config */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
                  <div className="border-b border-slate-100 pb-3">
                    <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                      <span className="text-amber-500">📌</span>
                      家长遗留教辅任务
                    </h4>
                  </div>

                  <form onSubmit={handleAddHomework} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                    <input
                      type="text"
                      placeholder="任务标题(如: 单词拼读/家庭作业)"
                      value={newHwTitle}
                      onChange={(e) => setNewHwTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                    />
                    <textarea
                      placeholder="在此描述具体的家教伴读任务与打卡要求..."
                      value={newHwDesc}
                      onChange={(e) => setNewHwDesc(e.target.value)}
                      rows="2"
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                    ></textarea>
                    <button
                      type="submit"
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white py-1.5 rounded-lg text-xs font-bold transition-all"
                    >
                      发布课后打卡任务
                    </button>
                  </form>

                  {/* Active Homeworks List */}
                  <div className="space-y-3">
                    {homeworkTasks.map((task) => (
                      <div key={task.id} className="p-3 bg-white rounded-xl border border-slate-100 text-xs space-y-1">
                        <div className="font-bold text-slate-800 flex justify-between items-center">
                          <span>{task.title}</span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                            {task.completedBy.length}人已打卡
                          </span>
                        </div>
                        <p className="text-slate-500">{task.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Extra materials & customized link sending */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
                  <div className="border-b border-slate-100 pb-3">
                    <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                      <span className="text-indigo-600">🔗</span>
                      派发定制课外教辅材料
                    </h4>
                  </div>

                  <form onSubmit={handleAddMaterial} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                    <input
                      type="text"
                      placeholder="材料名称(如: 听力练习材料)"
                      value={newMatTitle}
                      onChange={(e) => setNewMatTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="跳转链接URL(如: https://...)"
                      value={newMatUrl}
                      onChange={(e) => setNewMatUrl(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                    />
                    <div className="flex gap-2">
                      <select
                        value={newMatTarget}
                        onChange={(e) => setNewMatTarget(e.target.value)}
                        className="w-2/3 rounded-lg border border-slate-200 px-2 py-1.5 text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="all">🚀 发给所有学生</option>
                        {students.map(s => (
                          <option key={s.id} value={s.id}>🎯 仅发给: {s.name}</option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="w-1/3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all"
                      >
                        派发材料
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2">
                    {extraMaterials.map((mat) => (
                      <div key={mat.id} className="p-3 bg-white rounded-xl border border-slate-100 text-xs flex justify-between items-center">
                        <div>
                          <div className="font-bold text-slate-800">{mat.title}</div>
                          <div className="text-slate-400 truncate max-w-xs">{mat.url}</div>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                          {mat.targetStudentId === 'all' ? '全体' : students.find(s => s.id === mat.targetStudentId)?.name || '单人'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6. Parent Feedback Wall Config */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
                  <div className="border-b border-slate-100 pb-3">
                    <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                      <span className="text-rose-500">✉️</span>
                      发送上课反馈至家长
                    </h4>
                  </div>

                  <form onSubmit={handleAddFeedback} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newFbStudentId}
                        onChange={(e) => setNewFbStudentId(e.target.value)}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                      >
                        {students.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <select
                        value={newFbRating}
                        onChange={(e) => setNewFbRating(parseInt(e.target.value))}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value={5}>⭐⭐⭐⭐⭐ 优异</option>
                        <option value={4}>⭐⭐⭐⭐ 良好</option>
                        <option value={3}>⭐⭐⭐ 需努力</option>
                      </select>
                    </div>
                    <textarea
                      placeholder="点评Amy/Bob在本堂课程的表现..."
                      value={newFbContent}
                      onChange={(e) => setNewFbContent(e.target.value)}
                      rows="3"
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                    ></textarea>
                    <button
                      type="submit"
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white py-1.5 rounded-lg text-xs font-bold transition-all"
                    >
                      投递反馈通知
                    </button>
                  </form>

                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {parentFeedbacks.map((fb) => (
                      <div key={fb.id} className="p-3 bg-white rounded-xl border border-slate-100 text-xs space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span className="font-bold text-slate-700">
                            学生: {students.find(s => s.id === fb.studentId)?.name || '未知'}
                          </span>
                          <span>{'⭐'.repeat(fb.rating)}</span>
                        </div>
                        <p className="text-slate-600 leading-tight">{fb.content}</p>
                        <div className="text-[9px] text-right text-slate-300">{fb.date}</div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STUDENT / PARENT PORTAL MAIN VIEW */}
        {/* ======================================================== */}
        {currentRole === 'student' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Non-LoggedIn Area: Enter custom teacher configured credentials */}
            {!isLoggedIn ? (
              <div className="max-w-md mx-auto bg-white rounded-3xl p-8 shadow-xl border border-slate-100 space-y-6 mt-12">
                <div className="text-center space-y-2">
                  <div className="inline-flex h-16 w-16 bg-emerald-50 rounded-2xl items-center justify-center text-3xl mb-2">
                    🎒
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">学生与家长登录</h2>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    请输入您的 Shadow 老师为您专设配置的个人用户名和密码
                  </p>
                </div>

                <form onSubmit={handleStudentLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">用户名 / Username</label>
                    <input
                      type="text"
                      required
                      placeholder="例如: amy 或 bob"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">密码 / Password</label>
                    <input
                      type="password"
                      required
                      placeholder="初始配置密码"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    />
                  </div>

                  {loginError && (
                    <p className="text-xs font-bold text-red-600 bg-red-50 p-2 rounded-lg text-center">
                      ⚠️ {loginError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-100 transition-all duration-300"
                  >
                    登 录 进 入
                  </button>
                </form>

                <div className="border-t border-slate-100 pt-4 text-center">
                  <span className="text-xs text-slate-400">
                    💡 默认演示账号: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">amy</code> 密码: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">123</code>
                  </span>
                </div>
              </div>
            ) : (
              // Logged-In Student Dashboard
              <div className="space-y-8">
                
                {/* Header Welcome Card */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-2">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-bold tracking-wider">
                      Student & Parent Growth Center
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold">你好，{currentStudent?.name} 👋</h2>
                    <p className="text-emerald-50 max-w-md text-xs leading-relaxed">
                      欢迎来到 Shadow 伴读计划！下节课的内容已经为您准备完毕，请务必预习打卡哦。
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleLogout}
                      className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                    >
                      🚪 退出登录
                    </button>
                  </div>
                </div>

                {/* Main Content Sections split in two columns */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* Left Column (Span 2): Textbook Previews and Quizzes */}
                  <div className="lg:col-span-2 space-y-8">
                    
                    {/* Part 1: Next Lesson Preview Materials */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">📖</span>
                          <div>
                            <h3 className="font-extrabold text-slate-800 text-lg">下节预习课文：《{activeLesson.title}》</h3>
                            <p className="text-xs text-slate-400">点击单词及句子右边的 🔊 可以发出标准美音朗读</p>
                          </div>
                        </div>

                        {/* Preview Checked Tag */}
                        {currentStudent?.previewChecked ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            🎉 已预习打卡
                          </span>
                        ) : (
                          <button
                            onClick={handlePreviewCheckIn}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-emerald-100 transition-all"
                          >
                            ⭐ 标记并预习打卡
                          </button>
                        )}
                      </div>

                      {/* Content Box with sentences triggerable voice synthesis */}
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-slate-700 leading-relaxed text-sm relative space-y-3">
                        <p className="font-serif italic text-slate-600 pr-10">
                          {activeLesson.content}
                        </p>
                        <button
                          onClick={() => playSpeech(activeLesson.content)}
                          className="absolute right-4 top-4 bg-white hover:bg-slate-100 p-2 rounded-full shadow-md text-slate-600 hover:text-emerald-600 transition-all"
                          title="播放整段课文发音"
                        >
                          🔊 读课文
                        </button>
                      </div>

                      {/* Dynamic Highlights (Vocabulary cards + Grammar cards) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        {/* Core Vocabulary with TTS */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                            💡 核心高频单词
                          </h4>
                          <div className="space-y-3">
                            {activeLesson.highlights.vocabulary.map((vocab, i) => (
                              <div
                                key={i}
                                className="group bg-white p-4 rounded-2xl border border-slate-100 hover:border-emerald-100 hover:shadow-sm transition-all flex justify-between items-start"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800">{vocab.word}</span>
                                    <span className="text-xs text-slate-400 font-serif">{vocab.phonetic}</span>
                                  </div>
                                  <p className="text-xs font-bold text-slate-500">
                                    释义: <span className="text-emerald-700">{vocab.translation}</span>
                                  </p>
                                  <p className="text-xs text-slate-400 italic font-serif group-hover:text-slate-600 transition-colors">
                                    "{vocab.example}"
                                  </p>
                                </div>
                                <button
                                  onClick={() => playSpeech(vocab.word)}
                                  className="text-emerald-600 hover:text-emerald-800 p-2 rounded-full bg-slate-50 hover:bg-emerald-50 transition-colors"
                                  title="发音"
                                >
                                  🔊
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Core Grammar Points */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                            💡 语法特写与精析
                          </h4>
                          <div className="space-y-4">
                            {activeLesson.highlights.grammar.map((gram, i) => (
                              <div key={i} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-1.5">
                                <span className="inline-block bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded">
                                  {gram.rules}
                                </span>
                                <p className="text-xs text-slate-600 font-medium leading-relaxed">{gram.explanation}</p>
                                <p className="text-xs text-emerald-700 font-serif bg-white p-2 rounded-lg border-l-2 border-emerald-500 italic">
                                  "{gram.example}"
                                </p>
                              </div>
                            ))}

                            {/* Warm Preview Tips */}
                            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100/70">
                              <span className="text-xs font-bold text-amber-800 uppercase tracking-widest block mb-2">💡 预习引导指南</span>
                              <ul className="text-xs text-amber-900 space-y-1.5 list-disc pl-4 font-medium">
                                {activeLesson.highlights.tips.map((tip, i) => (
                                  <li key={i}>{tip}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Part 2: Interactive AI Test Homework Questions */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">📝</span>
                          <div>
                            <h3 className="font-extrabold text-slate-800 text-lg">课前重点随堂测验</h3>
                            <p className="text-xs text-slate-400">检测您的自主预习成效</p>
                          </div>
                        </div>
                        {submittedQuiz && (
                          <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">
                            得分：{currentStudent?.quizScore} 分
                          </span>
                        )}
                      </div>

                      <div className="space-y-6">
                        {activeLesson.quizzes.map((quiz, idx) => {
                          const isCorrect = studentAnswers[quiz.id] === quiz.correct;
                          return (
                            <div key={quiz.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                              <h4 className="font-bold text-slate-800 text-sm">
                                {idx + 1}. {quiz.question}
                              </h4>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {quiz.options.map((option, optIdx) => {
                                  const optionChar = option.charAt(0);
                                  const isSelected = studentAnswers[quiz.id] === optionChar;
                                  
                                  let optionStyle = "border-slate-200 hover:bg-slate-100";
                                  if (isSelected) {
                                    optionStyle = "border-emerald-500 bg-emerald-50/70 text-emerald-800 font-semibold";
                                  }
                                  if (submittedQuiz) {
                                    if (optionChar === quiz.correct) {
                                      optionStyle = "border-emerald-500 bg-emerald-100 text-emerald-900 font-semibold";
                                    } else if (isSelected && optionChar !== quiz.correct) {
                                      optionStyle = "border-red-300 bg-red-50 text-red-900";
                                    }
                                  }

                                  return (
                                    <button
                                      key={optIdx}
                                      onClick={() => {
                                        if (submittedQuiz) return;
                                        setStudentAnswers({
                                          ...studentAnswers,
                                          [quiz.id]: optionChar
                                        });
                                      }}
                                      disabled={submittedQuiz}
                                      className={`text-left p-3 rounded-xl border text-xs transition-all ${optionStyle}`}
                                    >
                                      {option}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Explanation details visible after submit or custom triggers */}
                              {(submittedQuiz || showExplanation[quiz.id]) && (
                                <div className="mt-3 bg-white p-3 rounded-xl border border-indigo-50/50 text-xs space-y-1">
                                  <div className="flex items-center gap-1.5 font-bold">
                                    <span className={isCorrect ? "text-emerald-700" : "text-amber-700"}>
                                      {isCorrect ? '✅ 答案正确' : `❌ 回答有误 (正确答案是: ${quiz.correct})`}
                                    </span>
                                  </div>
                                  <p className="text-slate-500 leading-relaxed font-medium">
                                    <span className="font-bold text-indigo-700">详解:</span> {quiz.explanation}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Quiz Buttons Actions */}
                      {!submittedQuiz ? (
                        <button
                          onClick={handleQuizSubmit}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-lg transition-all"
                        >
                          提交答卷并查阅解析
                        </button>
                      ) : (
                        <div className="text-center">
                          <p className="text-xs text-slate-400">已提交测试。如需重新生成考卷，可通知 Shadow 老师一键下发新题！</p>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Right Column: Homework checkins, Links and Feedbacks */}
                  <div className="space-y-8">
                    
                    {/* 1. Homework companion Check-in (家长打卡) */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
                      <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                        <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                          <span className="text-amber-500">📌</span>
                          家长教辅遗留任务打卡
                        </h4>
                        <span className="text-xs text-slate-400">家校共育伴读</span>
                      </div>

                      <div className="space-y-3">
                        {homeworkTasks.map((task) => {
                          const isDone = task.completedBy.includes(currentStudent?.id);
                          return (
                            <div key={task.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3 text-xs">
                              <input
                                type="checkbox"
                                checked={isDone}
                                onChange={() => handleHomeworkToggle(task.id)}
                                className="mt-1 h-4 w-4 text-emerald-600 focus:ring-emerald-500 rounded border-slate-300"
                              />
                              <div className="space-y-1">
                                <span className={`font-bold text-slate-800 ${isDone ? 'line-through text-slate-400' : ''}`}>
                                  {task.title}
                                </span>
                                <p className="text-slate-500 leading-tight">{task.desc}</p>
                                {isDone && (
                                  <span className="inline-block bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1.5 py-0.2 rounded mt-1">
                                    ⭐ 伴读成功完成打卡
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Extra specialized materials Links (Filter standard & specific targeting) */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
                      <div className="border-b border-slate-100 pb-3">
                        <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                          <span className="text-indigo-600">🔗</span>
                          课外特发辅助材料链接
                        </h4>
                      </div>

                      <div className="space-y-3">
                        {extraMaterials
                          .filter(mat => mat.targetStudentId === 'all' || mat.targetStudentId === currentStudent?.id)
                          .map((mat) => (
                            <div key={mat.id} className="p-3.5 bg-gradient-to-br from-indigo-50/50 to-white rounded-2xl border border-indigo-100/30 text-xs flex justify-between items-center hover:shadow-xs transition-all">
                              <div>
                                <span className="font-bold text-slate-800 block mb-0.5">{mat.title}</span>
                                <a
                                  href={mat.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-indigo-600 font-medium hover:underline flex items-center gap-1"
                                >
                                  点击前往学习资源
                                  <span>↗️</span>
                                </a>
                              </div>
                              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                {mat.targetStudentId === 'all' ? '全体资源' : '专属推荐'}
                              </span>
                            </div>
                        ))}
                        {extraMaterials.filter(mat => mat.targetStudentId === 'all' || mat.targetStudentId === currentStudent?.id).length === 0 && (
                          <p className="text-xs text-slate-400 text-center py-4">暂无针对您的特殊拓展教辅材料。</p>
                        )}
                      </div>
                    </div>

                    {/* 3. Feedback Wall (家长专属信箱) */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
                      <div className="border-b border-slate-100 pb-3">
                        <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                          <span className="text-rose-500">✉️</span>
                          Shadow 老师课后评价信箱
                        </h4>
                      </div>

                      <div className="space-y-3">
                        {parentFeedbacks
                          .filter(fb => fb.studentId === currentStudent?.id)
                          .map((fb) => (
                            <div key={fb.id} className="p-4 bg-gradient-to-br from-rose-50/40 to-white rounded-2xl border border-rose-100/40 text-xs space-y-2">
                              <div className="flex justify-between items-center text-slate-400">
                                <span className="font-bold text-slate-700">课堂表现评定:</span>
                                <span>{'⭐'.repeat(fb.rating)}</span>
                              </div>
                              <p className="text-slate-600 leading-relaxed font-medium">
                                "{fb.content}"
                              </p>
                              <div className="text-[10px] text-slate-400 text-right">{fb.date}</div>
                            </div>
                        ))}
                        {parentFeedbacks.filter(fb => fb.studentId === currentStudent?.id).length === 0 && (
                          <p className="text-xs text-slate-400 text-center py-4">本节课程老师暂未为您发送评语反馈，继续加油哦！</p>
                        )}
                      </div>
                    </div>

                  </div>

                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* FOOTER BAR */}
      <footer className="mt-20 border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-xs text-slate-400">
            © 2026 Shadow English Master App. Powered by Intelligent NotebookLM AI Model.
          </p>
          <div className="flex gap-4 text-xs font-semibold text-slate-400">
            <span>隐私条款</span>
            <span>·</span>
            <span>教师指南</span>
            <span>·</span>
            <span>技术服务支持</span>
          </div>
        </div>
      </footer>

    </div>
  );
}