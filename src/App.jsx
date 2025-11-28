import React, { useState, useEffect, useMemo } from 'react';
<<<<<<< HEAD
import { Copy, Check, Send, ArrowRight, Shield, LogOut, CheckCircle, XCircle, Edit3 } from 'lucide-react';
=======
import { Copy, Check, Send, ArrowRight, Shield, LogOut, CheckCircle, XCircle, Edit3, Languages } from 'lucide-react';
>>>>>>> 29a8b4f (beta)
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";

// -------------------------------------------------------------
<<<<<<< HEAD
// 1. တဆိပ်ပြံၚ်လှာဲတုဲဒှ်ဒှ်
// -------------------------------------------------------------
import logoImage from './assets/nsumon_logo.svg'; 
const LOGO_URL = logoImage;

// ==========================================
// 🔧 CONFIGURATION (သွက်ဂွံပတိုန်)
// ==========================================

// 🔴 IMPORTANT: တၚ်နၚ်ဟွံထေက်ကဵုဝိုတ်ဂမၠိုၚ်
=======
// 1. LOGO CONFIGURATION
// -------------------------------------------------------------
const LOGO_URL = ""; // Image removed by user request

// ==========================================
// 🔧 CONFIGURATION (PRODUCTION ONLY - USES RENDER/LOCAL .ENV)
// ==========================================

// 🔴 IMPORTANT: This configuration pulls values from the Render Environment Variables (VITE_...)
>>>>>>> 29a8b4f (beta)
const FIREBASE_CONFIG = { 
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const ADMIN_EMAIL_SECRET = import.meta.env.VITE_ADMIN_EMAIL; 
const ADMIN_PASSWORD_SECRET = import.meta.env.VITE_ADMIN_PASSWORD;

// ==========================================

<<<<<<< HEAD
// Initialize Firebase 
let app, auth, db;
try {
    // API Key နွံဟေၚ်မှ ကၠောန်ကမၠောန်ရောၚ်။
=======
// Initialize Firebase (Error Handling Added)
let app, auth, db;
try {
    // Only attempt initialization if API Key is available
>>>>>>> 29a8b4f (beta)
    if (FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey) {
        app = initializeApp(FIREBASE_CONFIG);
        auth = getAuth(app);
        db = getFirestore(app);
    } else {
        console.error("Firebase Initialization Failed: API Key is missing. Check VITE_FIREBASE_API_KEY.");
    }
} catch (e) {
    console.error("Firebase Init Error:", e);
}

// FIX: Use a static, safe App ID
const appId = 'nsumon_translator_v1';

const MonToEngTranslator = () => {
  // Main Translation State
  const [inputText, setInputText] = useState('');
  const [outputJson, setOutputJson] = useState(null); // Stores the parsed JSON output
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false); // State to track if Auth is complete
  
  // Correction/Admin State
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestMon, setSuggestMon] = useState('');
  const [suggestEng, setSuggestEng] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [pendingSuggestions, setPendingSuggestions] = useState([]);
  const [approvedGlossary, setApprovedGlossary] = useState([]);

  // --- Utility Functions ---
  const detectLanguage = (text) => {
    // Check for Mon/Myanmar unicode range: \u1000-\u109F and extended \uAA60-\uAA7F
    const monRegex = /[\u1000-\u109F\uAA60-\uAA7F]/;
    return monRegex.test(text) ? 'Mon' : 'English';
  };
  
  // 1. Initialize Auth FIRST
  useEffect(() => {
    if (!auth) {
        setIsAuthReady(true);
        return;
    }
    const initAuth = async () => {
      try {
        if (!auth.currentUser) {
            await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // 2. Listeners - ONLY run when 'user' is authenticated
  useEffect(() => {
    if (!user || !db || !isAuthReady) return; 

    const qGlossary = query(collection(db, 'artifacts', appId, 'public', 'data', 'approved_glossary'));
    const unsubGlossary = onSnapshot(qGlossary, 
      (snapshot) => {
        const terms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setApprovedGlossary(terms);
      },
      (error) => {
        console.log("Glossary sync paused");
      }
    );

    return () => {
        unsubGlossary();
    };
  }, [user, isAuthReady]); 

  // 3. Admin Listeners
  useEffect(() => {
    if (!user || !isAdmin || !db || !isAuthReady) return;

    const qPending = query(
        collection(db, 'artifacts', appId, 'public', 'data', 'suggestions'), 
        where("status", "==", "pending")
    );
    
    const unsubPending = onSnapshot(qPending, 
      (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPendingSuggestions(list);
      },
      (error) => {
         console.log("Pending list sync paused");
      }
    );

    return () => unsubPending();
  }, [user, isAdmin, isAuthReady]);

  const saveTranslationToHistory = async (input, outputJson) => {
    if (!user || !db || !outputJson || outputJson.error) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'translations'), {
        input_text: input,
        output_text: outputJson.translation,
        direction: outputJson.source_language === 'English' ? 'eng-mon' : 'mon-eng',
        userId: user.uid,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("History Save Error (Non-fatal):", err);
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    setError('');
    setOutputJson(null); // Clear previous output
    
    const apiKey = GEMINI_API_KEY; 
    
<<<<<<< HEAD
    // Check if API key is available
=======
>>>>>>> 29a8b4f (beta)
    if (!apiKey) {
        setError("API Key is missing. Please check VITE_GEMINI_API_KEY in your environment.");
        setIsLoading(false);
        return;
    }

    try {
      const inputLang = detectLanguage(inputText);
      const isMonInput = inputLang === 'Mon';
      const sourceLang = isMonInput ? 'Mon' : 'English';
      const targetLang = isMonInput ? 'English' : 'Mon (Unicode)';

      const baseKnowledge = `
      CORE VOCABULARY (Reference):
      - Rabbit = ဗ္တာဲ (Btai)
      - Turtle = လရုတ် (La-rut)
<<<<<<< HEAD
      - Mouse/Rat = ကၞိ (Kni)
      - Lion = ဇာဒိသိုင် (Za-di-saing)
      - School = ဘာ (Bhea)
      - Eat = စ (Sa)
      - Drink = သုင် (Sung)
      - Go = အာ (Aa)
      - Come = ကၠုင် (Klung)
      - Sleep = တိက် (Tik)
      - Good = ခိုဟ် (Kho)
      - Love = ဆာန် (San)
      - Happy = မိပ်စိုတ် (Mip-soit)
      
      MON GRAMMAR RULES:
      - Sentence End: Use "... ရ" (Ra) for statements.
      - Past Tense: Use "... တုဲ" (Toe).
      - Future Tense: Use "... ရောင်" (Raung).
      - Continuous: Use "... မံင်" (Mang).
      - Questions: "ရော" (Rao) for Wh-question, "ဟာ" (Ha) for Yes/No.
      - Polite Request: "... ညိ" (Nyi).
=======
      - Mother = မိ (Mi)
      - Father = မအံက် (Maaik)
      - Education = ပရေၚ်ပညာ (Paraing Panya)
>>>>>>> 29a8b4f (beta)
      `;

      const glossaryContext = approvedGlossary.length > 0 
        ? `COMMUNITY VERIFIED GLOSSARY (PRIORITIZE THESE):
           ${approvedGlossary.map(t => `${t.mon} = ${t.eng}`).join('\n')}`
        : '';
<<<<<<< HEAD

      const encodedPrompt =
      "WW91IGFyZSBhbiBleHBlcnQgTGluZ3Vpc3Qgc3BlY2lhbGl6aW5nIGluIHRoZSBNb24gbGFuZ3VhZ2UuIFRyYW5zbGF0ZSB0aGUgZm9sbG93aW5nIE1vbiB0ZXh0IChVbmljb2RlKSBpbnRvIG5hdHVyYWwsIGZsdWVudCBFbmdsaXNoLgoKICAgICAgICBDT05URVhUOgogICAgICAgICR7YmFzZUtu b3dsZWRnZX0KICAgICAgICAke2dsb3NzYXJ5Q29udGV4dH0KCiAgICAgICAgUlVMRVM6CiAgICAgICAgMS4gUmV0dXJuIE9OTFkgdGhlIHRyYW5zbGF0ZWQgdGV4dC4gSWYgeW91IG11c3QgYWRkIGNvbnRleHQgKGUuZy4sIGdyYW1tYXIpLCBlbmNsb3NlIGl0IGNsZWFybHkgaW4gYnJhY2tldHMgW2xpa2UgdGhpcy5dIAogICAgICAgIDIuIElmIG11bHRpcGxlIHZhbGlkIHRyYW5zbGF0aW9ucyBleGlzdCwgc2VwYXJhdGUgdGhlbSB3aXRoIGEgc2xhc2ggKC8pIG9yIG5ldyBsaW5lcy4KCiAgICAgICAgSU5QVVQgVEVYVCAoTW9uKTogIiR7aW5wdXRUZXh0fSIKICAgICAgICBPVVRQVVQgKEVuZ2xpc2gpOg==";

    const prompt = atob(encodedPrompt)
      .replace("${baseKnowledge}", baseKnowledge)
      .replace("${glossaryContext}", glossaryContext)
      .replace("${inputText}", inputText);

    const encodedUrl =
      "aHR0cHM6Ly9nZW5lcmF0aXZlbGFuZ3VhZ2UuZ29vZ2xlYXBpcy5jb20vdjFiZXRhL21vZGVscy9nZW1pbmktMi41LWZsYXNoLXByZXZpZXctMDktMjAyNTpnZW5lcmF0ZUNvbnRlbnQ/a2V5PQ==";

    const url = atob(encodedUrl) + apiKey;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
=======
      
      let systemInstruction;

      if (isMonInput) {
        // MON -> ENGLISH PROMPT
        systemInstruction = `You are "Ramanya," an AI translator specializing in the Mon language. You possess deep knowledge of Mon grammar and culture.
        Task: Translate the provided Mon input (Unicode) into high-quality, natural, fluent English.
        
        RULES:
        1. Grammar: Ensure correct English grammar and idiom usage.
        2. Format: MUST return ONLY a single, valid JSON object following the specified schema.
        3. Notes: Use the 'notes' field for any cultural context or grammatical points (e.g., "(Context: This refers to the Mon new year.)").
        
        JSON SCHEMA: {"source_language": "Mon", "translation": "...", "romanization": null, "notes": "..."}`;
      } else {
        // ENGLISH -> MON PROMPT
        systemInstruction = `You are an expert Mon linguist, historian, and native speaker of the Mon language (Bhasa Mon).
        Task: Translate the provided English input into high-quality, formal Mon (Unicode standard).
        
        GUIDELINES:
        1. Tone: Use a formal, polite, and literary tone (လိက်) suitable for official and educational documents.
        2. Grammar: Follow Mon sentence structure strictly (usually Subject-Object-Verb). Ensure particles are used naturally.
        3. Vocabulary: Use Pali-derived Mon words for formal/academic concepts (like ပရေၚ်ပညာ).
        4. Format: MUST return ONLY a single, valid JSON object following the specified schema.
        
        JSON SCHEMA: {"source_language": "English", "translation": "...", "romanization": "...", "notes": null}`;
      }


      const payload = {
        contents: [{ parts: [{ text: `Input text to translate from ${sourceLang} to ${targetLang}:\n"${inputText}"` }] }],
        systemInstruction: { parts: [{ text: `${systemInstruction}\n\nCONTEXT:\n${baseKnowledge}\n${glossaryContext}` }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    source_language: { type: "STRING" },
                    translation: { type: "STRING" },
                    romanization: { type: ["STRING", "NULL"] },
                    notes: { type: ["STRING", "NULL"] }
                }
            }
        }
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
>>>>>>> 29a8b4f (beta)

      if (!response.ok) throw new Error('Translation failed');

      const data = await response.json();
      const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!rawJsonText) {
          throw new Error("AI returned no content.");
      }
      
      const parsedJson = JSON.parse(rawJsonText);
      setOutputJson(parsedJson);
      saveTranslationToHistory(inputText, parsedJson);

    } catch (err) {
      setError('Connection or Parsing Error. Check the API Key and ensure the output is valid JSON.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
<<<<<<< HEAD
  // UI တၟိ
  // -------------------------------------------------------------
  const renderFormattedOutput = useMemo(() => {
    if (!outputText) return null;

    let cleanText = outputText.replace(/^Output:\s*/i, '').trim();

    const translations = cleanText.split(/[\r\n/]+/g).filter(t => t.trim().length > 0);

    return translations.map((line, index) => {
        // Find main translation, context note, and alternative translation
        const alternativeMatch = line.match(/(.*)\*(Alternatively|ဗီုတၞဟ်):(.*)\*/);
        
        if (alternativeMatch) {
            // Found a line with alternative translation marked by asterisks
            const primary = alternativeMatch[1].replace(/\*\*/g, '').trim();
            const altLabel = alternativeMatch[2].trim();
            const altText = alternativeMatch[3].trim();

            return (
                <div key={index} className="mb-4">
                    <p className="font-bold text-slate-900 text-lg mb-1">{primary}</p>
                    <div className="border border-green-400 bg-green-50/50 p-3 rounded-lg flex gap-2">
                        <span className="text-green-700 font-bold tracking-tight whitespace-nowrap">
                            {altLabel === 'Alternatively' ? 'ဗီုတၞဟ်:' : altLabel + ':'}
                        </span>
                        <span className="text-slate-700 italic">{altText}</span>
                    </div>
                </div>
            );
        }

        // Standard line formatting (looking for bracketed context)
        const parts = line.match(/(.*?)(\s*\[.*\]|\s*\(.*\))?$/);
        const mainTranslation = parts ? parts[1].trim() : line.trim();
        const contextNote = parts && parts[2] ? parts[2].trim() : null;

        return (
            <p key={index} className="mb-2 last:mb-0">
                <span className="text-slate-700">{mainTranslation}</span>
                {contextNote && (
                    <span className="text-slate-400 text-base ml-1 italic">{contextNote}</span>
                )}
            </p>
        );
    });
  }, [outputText]);
=======
  // UI Improvement Logic - Renders output based on JSON structure
  // -------------------------------------------------------------
  const renderFormattedOutput = useMemo(() => {
    if (!outputJson || outputJson.translation === undefined) return null;

    const isMonOutput = outputJson.source_language === 'English';
    const primaryText = outputJson.translation || "Translation not provided.";
    const secondaryNote = outputJson.notes || outputJson.romanization;
    const secondaryLabel = outputJson.notes ? "Context:" : "Romanization:";
    
    // Clean up primary text by removing asterisks (if LLM uses old format)
    const cleanedPrimary = primaryText.replace(/\*\*/g, '').trim();

    // Check if the primary text contains an alternative format (e.g., / or line break)
    const primaryLines = cleanedPrimary.split(/[\r\n/]+/g).filter(t => t.trim().length > 0);
    const mainTranslation = primaryLines[0];
    const alternativeLines = primaryLines.slice(1);
    
    return (
        <>
            {/* 1. Primary Translation (Large, Bold) */}
            <p className={`font-extrabold text-slate-900 text-3xl mb-3 leading-tight ${isMonOutput ? 'font-mon' : ''}`}>
                {mainTranslation}
            </p>

            {/* 2. Alternative Translations (if any) */}
            {alternativeLines.map((alt, index) => (
                <div key={index} className="border border-green-400 bg-green-50/50 p-3 rounded-lg flex gap-2 mb-3">
                    <span className="text-green-700 font-bold tracking-tight whitespace-nowrap">
                        ဗီုတၞဟ်:
                    </span>
                    <span className={`text-slate-700 italic ${isMonOutput ? 'font-mon' : ''}`}>{alt}</span>
                </div>
            ))}

            {/* 3. Secondary Notes (Context or Romanization) */}
            {secondaryNote && (
                <div className={`border border-slate-300 bg-slate-50/70 p-3 rounded-lg flex gap-2 ${alternativeLines.length > 0 ? 'mt-4' : 'mt-0'}`}>
                    <span className="text-slate-500 font-bold tracking-tight whitespace-nowrap">
                        {isMonOutput ? (outputJson.romanization ? "Romanization:" : "Notes:") : "Context:"}
                    </span>
                    <span className={`text-slate-600 italic ${isMonOutput ? 'font-mon' : ''}`}>{secondaryNote}</span>
                </div>
            )}
        </>
    );
  }, [outputJson]);
>>>>>>> 29a8b4f (beta)
  // -------------------------------------------------------------

  const handleOpenSuggest = () => {
    // Determine Mon and English content based on output direction
    const isMonOutput = outputJson.source_language === 'English';
    
    setSuggestMon(isMonOutput ? outputJson.translation : inputText);
    setSuggestEng(isMonOutput ? inputText : outputJson.translation);
    setShowSuggestModal(true);
  };

  const submitSuggestion = async () => {
    if (!suggestMon || !suggestEng) return;
    if (!user || !db) { 
        alert("Authentication is not ready. Please wait a moment."); 
        return; 
    }
    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'suggestions'), {
            mon: suggestMon,
            eng: suggestEng,
            userId: user.uid,
            status: 'pending',
            timestamp: serverTimestamp()
        });
        alert("Suggestion submitted! Admin will review it.");
        setShowSuggestModal(false);
    } catch (e) {
        console.error("Error submitting:", e);
        alert("Error submitting. Please try again.");
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!auth) return;
    try {
        if (adminEmail === ADMIN_EMAIL_SECRET && adminPassword === ADMIN_PASSWORD_SECRET) {
            setIsAdmin(true);
            setShowAdminLogin(false);
        } else {
            await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
            setIsAdmin(true);
            setShowAdminLogin(false);
        }
    } catch (err) {
        alert("Login failed. Check your email/password.");
    }
  };

  const handleApprove = async (item) => {
    if (!user || !db) return;
    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'approved_glossary'), {
            mon: item.mon,
            eng: item.eng,
            approvedBy: user.uid,
            timestamp: serverTimestamp()
        });
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'suggestions', item.id), {
            status: 'approved'
        });
    } catch (e) { console.error(e); }
  };

  const handleReject = async (id) => {
    if (!user || !db) return;
    try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'suggestions', id), {
            status: 'rejected'
        });
    } catch (e) { console.error(e); }
  };

  const handleCopy = () => {
<<<<<<< HEAD
    if (!outputText) return;
    // Copy the original cleaned output text, not the formatted JSX elements
    const textToCopy = outputText.replace(/^Output:\s*/i, '').trim().replace(/[\r\n/]+/g, ' / ');
=======
    if (!outputJson || !outputJson.translation) return;
    const textToCopy = outputJson.translation;
>>>>>>> 29a8b4f (beta)
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setInputText('');
    setOutputJson(null);
    setError('');
  };

  if (showAdminLogin) {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
                <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                    <Shield className="text-blue-600"/> Admin Login
                </h2>
                <form onSubmit={handleAdminLogin} className="space-y-4">
                    <input type="email" placeholder="Admin Email" className="w-full p-3 border rounded-lg" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
                    <input type="password" placeholder="Password" className="w-full p-3 border rounded-lg" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} />
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setShowAdminLogin(false)} className="flex-1 p-3 text-slate-600 font-medium">Cancel</button>
                        <button type="submit" className="flex-1 p-3 bg-blue-600 text-white rounded-lg font-bold hover:-translate-y-0.5 transition-all">Login</button>
                    </div>
                </form>
            </div>
        </div>
    );
  }

  if (!isAuthReady) {
      return (
          <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
              <div className="flex flex-col items-center">
                  <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-3"></div>
                  <p className="text-slate-600 font-medium">Loading App and Connecting to Database...</p>
              </div>
<<<<<<< HEAD
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900 w-full">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
  <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">

    {/* 🔥 LOGO: Image + Text */}
    <div className="flex items-center gap-4">
      {/* SVG Image Logo */}
      <div className="h-10 w-10">
        <img
          src={LOGO_URL}
          alt="NSUMON Logo"
          className="h-full w-full object-contain"
        />
      </div>

      {/* Text Logo */}
      <div className="flex items-center space-x-2 py-1.5">
        <h1 className="font-bold text-2xl tracking-tight text-slate-900">
          MT
        </h1>
        <span className="text-2xl font-bold text-[#4f46e5] tracking-tight leading-none border border-[#4f46e5] rounded-md px-1.5 py-0.5">
          NSUMON
        </span>
      </div>
    </div>

    {/* Admin Button */}
    <div className="flex items-center">
      {isAdmin ? (
        <button
          onClick={() => { setIsAdmin(false); signOut(auth); }}
          className="px-3 flex items-center text-red-500 text-2xl font-bold transition-colors hover:bg-red-50 rounded-md border border-red-500 py-1.5"
        >
          <LogOut size={20} className="mr-1"/> Logout
        </button>
      ) : (
        <button
          onClick={() => setShowAdminLogin(true)}
          className="px-3 flex items-center gap-1 text-[#4f46e5] text-2xl font-bold transition-colors py-1.5"
        >
          <Shield size={20}/> Admin
        </button>
      )}
    </div>

  </div>
</nav>

=======
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900 w-full">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4"> 
            {/* Logo Image */}
            <div className="relative h-10 w-10 overflow-hidden rounded-xl shadow-lg shadow-blue-500/20 bg-white mr-2">
               <img src={LOGO_URL} alt="MT Logo" className="w-full h-full object-cover p-1" />
            </div>
            {/* MT NSUMON Text Logo (Same visual size as image) */}
            <div className="flex items-center space-x-2 py-1.5">
              <h1 className="font-bold text-2xl tracking-tight text-slate-900">
                MT
              </h1>
              <span className="text-2xl font-bold text-[#4f46e5] tracking-tight leading-none border border-[#4f46e5] rounded-md px-1.5 py-0.5">
                    NSUMON
              </span>
            </div>
          </div>
          <div className="flex items-center">
             {/* Admin Button - Sized to match MT NSUMON */}
             {isAdmin ? (
                 <button onClick={() => { setIsAdmin(false); signOut(auth); }} className="px-3 flex items-center text-red-500 text-2xl font-bold transition-colors hover:bg-red-50 rounded-md border border-red-500 py-1.5">
                     <LogOut size={20} className="mr-1"/> Logout
                 </button>
             ) : (
                 <button onClick={() => setShowAdminLogin(true)} className="px-3 flex items-center gap-1 text-[#4f46e5] text-2xl font-bold transition-colors py-1.5">
                    <Shield size={20}/> Admin
                 </button>
             )}
          </div>
        </div>
      </nav>

>>>>>>> 29a8b4f (beta)
      <main className="max-w-7xl mx-auto px-4 py-8 w-full">
        {isAdmin && (
            <div className="mb-8 bg-white rounded-2xl shadow-lg border border-orange-100 overflow-hidden">
                <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center">
                    <h3 className="font-bold text-orange-800 flex items-center gap-2"><Shield size={18}/> Admin Dashboard: Pending</h3>
                    <span className="text-xs bg-white px-2 py-1 rounded text-orange-600 font-bold">{pendingSuggestions.length} Pending</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                    {pendingSuggestions.length === 0 ? <div className="p-8 text-center text-slate-400 italic">No pending suggestions.</div> : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Mon</th><th className="p-3">English</th><th className="p-3 text-right">Action</th></tr></thead>
                            <tbody className="divide-y">{pendingSuggestions.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50"><td className="p-3 font-medium font-mon">{String(item.mon)}</td><td className="p-3">{String(item.eng)}</td><td className="p-3 text-right flex justify-end gap-2">
                                    <button onClick={() => handleApprove(item)} className="p-1 text-green-600 hover:bg-green-50 rounded"><CheckCircle size={18}/> Approve</button>
                                    <button onClick={() => handleReject(item.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><XCircle size={18}/> Reject</button>
                                </td></tr>
                            ))}</tbody>
                        </table>
                    )}
                </div>
            </div>
        )}

        <div className="text-center mb-6 space-y-2">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
<<<<<<< HEAD
                Translate <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Mon Language</span>
            </h2>
            <p className="text-slate-500 text-lg">သွက်ဂွံကၠာဲဘာသာအၚ်္ဂလိက်ဂှ်တက်စုတ်ဝေါဟာမန်ညိ</p>
=======
                Translate <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Mon $\leftrightarrow$ English</span>
            </h2>
            <p className="text-slate-500 text-lg">Ramanya AI: Input Mon or English below</p>
>>>>>>> 29a8b4f (beta)
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
            <div className="grid md:grid-cols-[1fr,auto,1fr] divide-y md:divide-y-0 md:divide-x divide-slate-100">
<<<<<<< HEAD
                <div className="flex flex-col h-[300px] md:h-[400px] relative">
                    <div className="p-4 md:p-6 flex justify-between items-center bg-slate-50/50 border-b border-slate-100">
                        <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-blue-100 text-blue-700">ဘာသာမန်</span>
                        {inputText && (<button onClick={handleClear} className="text-slate-400 hover:text-red-500 text-xs font-medium px-2 py-1 rounded">ဇိုတ်သ္အးထောံ</button>)}
                    </div>
                    <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="ချူစုတ်လိက်မန် ပ္ဍဲဒၞာဲဏအ်ညိ..." className="flex-1 w-full p-6 md:p-8 bg-transparent resize-none outline-none text-xl md:text-2xl leading-loose text-slate-800 placeholder:text-slate-300 font-medium font-mon" spellCheck="false"/>
                </div>
                <div className="hidden md:flex flex-col items-center justify-center bg-slate-50 w-16 relative z-10">
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-slate-200"></div>
                    <div className="bg-white border border-slate-200 p-2 rounded-full shadow-sm z-20"><ArrowRight size={20} className="text-slate-400" /></div>
                </div>
                <div className="flex flex-col h-[300px] md:h-[400px] bg-slate-50/30 relative">
                    <div className="p-4 md:p-6 flex justify-between items-center bg-slate-50/80 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">ဘာသာအၚ်္ဂလိက်</span>
                        <div className="flex gap-2">
                            {outputText && (<button onClick={handleOpenSuggest} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-500 hover:bg-orange-50 rounded transition-colors"><Edit3 size={14} /> ပလေဝ်</button>)}
                            {outputText && (<button onClick={handleCopy} className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded">{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'ဆာဲကေတ်တုဲ' : 'ဆာဲကေတ်'}</button>)}
=======
                
                {/* Input Area */}
                <div className="flex flex-col h-[300px] md:h-[400px] relative">
                    <div className="p-4 md:p-6 flex justify-between items-center bg-slate-50/50 border-b border-slate-100">
                        <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${detectLanguage(inputText) === 'Mon' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            Input: {detectLanguage(inputText)}
                        </span>
                        {inputText && (<button onClick={handleClear} className="text-slate-400 hover:text-red-500 text-xs font-medium px-2 py-1 rounded">Clear</button>)}
                    </div>
                    <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type Mon or English here..." className={`flex-1 w-full p-6 md:p-8 bg-transparent resize-none outline-none text-xl md:text-2xl leading-loose text-slate-800 placeholder:text-slate-300 font-medium ${detectLanguage(inputText) === 'Mon' ? 'font-mon' : ''}`} spellCheck="false"/>
                </div>
                
                {/* Arrow Divider */}
                <div className="hidden md:flex flex-col items-center justify-center bg-slate-50 w-16 relative z-10">
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-slate-200"></div>
                    <div className="bg-white border border-slate-200 p-2 rounded-full shadow-sm z-20">
                        <Languages size={20} className="text-blue-500" />
                    </div>
                </div>
                
                {/* Output Area */}
                <div className="flex flex-col h-[300px] md:h-[400px] bg-slate-50/30 relative">
                    <div className="p-4 md:p-6 flex justify-between items-center bg-slate-50/80 border-b border-slate-100">
                        <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-indigo-100 text-indigo-700">
                            Output: {outputJson ? outputJson.source_language === 'Mon' ? 'English' : 'Mon' : 'N/A'}
                        </span>
                        <div className="flex gap-2">
                            {outputJson && (<button onClick={handleOpenSuggest} className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-orange-500 hover:bg-orange-50 rounded"><Edit3 size={14}/> Fix</button>)}
                            {outputJson && (<button onClick={handleCopy} className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded">{copied ? <Check size={14}/> : <Copy size={14}/>} Copy</button>)}
>>>>>>> 29a8b4f (beta)
                        </div>
                    </div>
                    <div className="flex-1 p-6 md:p-8 overflow-y-auto">
                         {isLoading ? (
<<<<<<< HEAD
                            <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400"><div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div><span className="text-sm font-medium animate-pulse">အဃောကၠာဲဒၟံၚ်ဘာသာရ...</span></div>
                        ) : (
                            <div className={`text-xl md:text-2xl leading-loose h-full ${!outputText ? 'text-slate-300 italic flex items-center justify-center' : 'text-slate-700'}`}>
                                 {error ? <span className="text-red-500 text-base">{error}</span> : renderFormattedOutput || "မလိက်ဝေါဟာမကၠာဲလဝ်တံဂှ် မံက်တိတ်ဒၞာဲဏံရောၚ်"}
=======
                            <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
                                <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                                <span className="text-sm font-medium animate-pulse">Consulting Ramanya AI...</span>
                            </div>
                        ) : (
                            <div className={`leading-loose h-full ${!outputJson ? 'text-slate-300 italic flex items-center justify-center text-xl' : 'text-slate-700'}`}>
                                 {error ? <span className="text-red-500 text-base">{error}</span> : renderFormattedOutput || "Translation will appear here"}
>>>>>>> 29a8b4f (beta)
                            </div>
                        )}
                    </div>
                </div>
            </div>
<<<<<<< HEAD
            <div className="bg-white p-4 md:p-6 flex justify-center border-t border-slate-100">
                <button onClick={handleTranslate} disabled={isLoading || !inputText.trim()} className="group flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"><span className="text-lg">ကၠာဲဘာသာ</span><Send className={`w-5 h-5 ${isLoading ? 'opacity-0' : ''}`} /></button>
=======
            
            {/* Translation Button */}
            <div className="bg-white p-4 md:p-6 flex justify-center border-t border-slate-100">
                <button onClick={handleTranslate} disabled={isLoading || !inputText.trim()} className="group flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50">
                    <span className="text-lg">Translate</span>
                    <Send className={`w-5 h-5 ${isLoading ? 'opacity-0' : ''}`} />
                </button>
>>>>>>> 29a8b4f (beta)
            </div>
        </div>

        {showSuggestModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl">
<<<<<<< HEAD
                    <h3 className="text-xl font-bold text-slate-800 mb-2">ဝေါဟာဒးပလေဝ်</h3>
                    <p className="text-slate-500 text-sm mb-4">လိက်ပတ်ဘာသာပိုဲဂွံသၠုၚ်တိုန်မာန်ဂှ် သြဝ်ဘိုၚ်ရီုဗၚ်အိုတ်ညိ။ ညးစၟဳစၟတ်တအ် သ္ၚဳဂၠိပ်အာ ကသပ်မၞးရောၚ်</p>
                    <div className="space-y-4">
                        <div><label className="text-xs font-bold text-slate-500 uppercase">မလိက်မန်</label><input className="w-full p-3 bg-slate-50 rounded-lg border font-mon" value={suggestMon} onChange={e => setSuggestMon(e.target.value)} /></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase">မလိက်အၚ်္ဂလိက်</label><input className="w-full p-3 bg-slate-50 rounded-lg border" value={suggestEng} onChange={e => setSuggestEng(e.target.value)} /></div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setShowSuggestModal(false)} className="flex-1 p-3 text-slate-600 font-medium">ပဲါပလီုထောံ</button>
                        <button onClick={submitSuggestion} className="flex-1 p-3 bg-blue-600 text-white rounded-lg font-bold hover:-translate-y-0.5 transition-all">ပတိုန်ထ္ၜး ကသပ်</button>
=======
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Suggest Correction</h3>
                    <div className="space-y-4">
                        <div><label className="text-xs font-bold text-slate-500">MON</label><input className="w-full p-3 border rounded-lg font-mon" value={suggestMon} onChange={e=>setSuggestMon(e.target.value)}/></div>
                        <div><label className="text-xs font-bold text-slate-500">ENGLISH</label><input className="w-full p-3 border rounded-lg" value={suggestEng} onChange={e=>setSuggestEng(e.target.value)}/></div>
>>>>>>> 29a8b4f (beta)
                    </div>
                    <div className="flex gap-3 mt-6"><button onClick={()=>setShowSuggestModal(false)} className="flex-1 p-3 text-slate-600 font-bold">Cancel</button><button onClick={submitSuggestion} className="flex-1 p-3 bg-blue-600 text-white rounded-lg font-bold">Submit</button></div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default MonToEngTranslator;