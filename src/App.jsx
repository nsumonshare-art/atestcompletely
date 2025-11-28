import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Check, Send, ArrowRight, Shield, LogOut, CheckCircle, XCircle, Edit3, Languages } from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";

// -------------------------------------------------------------
// 1. LOGO CONFIGURATION
// -------------------------------------------------------------
const LOGO_URL = "https://cdn-icons-png.flaticon.com/512/3898/3898150.png"; // Placeholder URL for image logo

// ==========================================
// 🔧 CONFIGURATION (PRODUCTION ONLY - USES RENDER/LOCAL .ENV)
// ==========================================

// This configuration pulls values from the Render Environment Variables (VITE_...)
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

// Initialize Firebase (Error Handling Added)
let app, auth, db;
try {
    // Only attempt initialization if API Key is available
    if (FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey) {
        app = initializeApp(FIREBASE_CONFIG);
        auth = getAuth(app);
        db = getFirestore(app);
    } else {
        // In production, this means environment variables are missing
        console.error("Firebase Initialization Failed: API Key is missing. Check VITE_FIREBASE_API_KEY.");
    }
} catch (e) {
    console.error("Firebase Init Error:", e);
}

// FIX: Use a static, safe App ID
const appId = 'nsumon_translator_v1';

const MonToEngTranslator = () => {
  const [inputText, setInputText] = useState('');
  const [outputJson, setOutputJson] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false); 
  
  // Admin State
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestMon, setSuggestMon] = useState('');
  const [suggestEng, setSuggestEng] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [pendingSuggestions, setPendingSuggestions] = useState([]);
  const [approvedGlossary, setApprovedGlossary] = useState([]);

  // Helper: Detect Language
  const detectLanguage = (text) => {
    if (!text) return 'Detecting...';
    const monRegex = /[\u1000-\u109F\uAA60-\uAA7F]/;
    return monRegex.test(text) ? 'Mon' : 'English';
  };

  // 1. Auth
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

  // 2. Data Listeners
  useEffect(() => {
    if (!user || !db || !isAuthReady) return; 
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'approved_glossary'));
    const unsub = onSnapshot(q, (s) => setApprovedGlossary(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [user, isAuthReady]); 

  useEffect(() => {
    if (!user || !isAdmin || !db || !isAuthReady) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'suggestions'), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (s) => setPendingSuggestions(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
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
    setOutputJson(null);
    
    const apiKey = GEMINI_API_KEY; 
    
    // Check if API key is available
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

      const glossaryContext = approvedGlossary.length > 0 
        ? `COMMUNITY VERIFIED GLOSSARY: ${approvedGlossary.map(t => `${t.mon} = ${t.eng}`).join('\n')}`
        : '';
      
      let systemInstruction;

      if (isMonInput) {
        // MON -> ENGLISH PROMPT
        systemInstruction = `You are "Ramanya," an AI translator specializing in the Mon language.
        Task: Translate the provided Mon input (Unicode) into high-quality, natural, fluent English.
        
        RULES:
        1. Format: MUST return ONLY a single, valid JSON object following the specified schema.
        
        JSON SCHEMA: {"source_language": "Mon", "translation": "...", "romanization": null, "notes": "..."}`;
      } else {
        // ENGLISH -> MON PROMPT
        systemInstruction = `You are "Ramanya," an expert Mon linguist.
        Task: Translate the provided English input into high-quality, formal Mon (Unicode standard).
        
        GUIDELINES:
        1. Tone: Use a formal, polite, and literary tone (လိက်).
        2. Grammar: Follow Mon sentence structure strictly (Subject-Object-Verb).
        3. Vocabulary: Use Pali-derived Mon words for formal/academic concepts.
        4. Format: MUST return ONLY a single, valid JSON object following the specified schema.
        
        JSON SCHEMA: {"source_language": "English", "translation": "...", "romanization": "...", "notes": null}`;
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Input text to translate from ${sourceLang} to ${targetLang}:\n"${inputText}"` }] }],
            systemInstruction: { parts: [{ text: `${systemInstruction}\n\nCONTEXT:\n${glossaryContext}` }] },
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
          }),
        }
      );

      if (!response.ok) throw new Error('Translation failed');

      const data = await response.json();
      const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!rawJsonText) throw new Error("AI returned no content.");
      
      let parsedJson;
      try {
          parsedJson = JSON.parse(rawJsonText);
      } catch (e) {
          const jsonMatch = rawJsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
              parsedJson = JSON.parse(jsonMatch[0]);
          } else {
              throw new Error("Invalid JSON format received from AI.");
          }
      }

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
  // UI Logic
  // -------------------------------------------------------------
  const renderFormattedOutput = useMemo(() => {
    if (!outputJson || outputJson.translation === undefined) return null;

    const isMonOutput = outputJson.source_language === 'English';
    const primaryText = outputJson.translation || "Translation not provided.";
    const secondaryNote = outputJson.notes || outputJson.romanization;
    
    const cleanedPrimary = primaryText.replace(/\*\*/g, '').trim();
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

  const handleOpenSuggest = () => {
    const isMonOutput = outputJson?.source_language === 'English';
    setSuggestMon(isMonOutput ? outputJson.translation : inputText);
    setSuggestEng(isMonOutput ? inputText : outputJson.translation);
    setShowSuggestModal(true);
  };

  const submitSuggestion = async () => {
    if (!suggestMon || !suggestEng) return;
    if (!user || !db) { alert("Database not connected."); return; }
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'suggestions'), {
        mon: suggestMon, eng: suggestEng, userId: user.uid, status: 'pending', timestamp: serverTimestamp()
    });
    setShowSuggestModal(false);
    alert("Submitted!");
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!auth) return;
    try {
        if (adminEmail === ADMIN_EMAIL_SECRET && adminPassword === ADMIN_PASSWORD_SECRET) {
            setIsAdmin(true); setShowAdminLogin(false);
        } else {
            await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
            setIsAdmin(true); setShowAdminLogin(false);
        }
    } catch (err) { alert("Login Failed"); }
  };

  const handleApprove = async (item) => {
    if (!user || !db) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'approved_glossary'), { mon: item.mon, eng: item.eng, approvedBy: user.uid, timestamp: serverTimestamp() });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'suggestions', item.id), { status: 'approved' });
  };
  const handleReject = async (id) => { if (user && db) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'suggestions', id), { status: 'rejected' }); };
  const handleCopy = () => { if (!outputJson?.translation) return; navigator.clipboard.writeText(outputJson.translation); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleClear = () => { setInputText(''); setOutputJson(null); setError(''); };

  if (showAdminLogin) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Shield className="text-blue-600"/> Admin Login</h2>
            <form onSubmit={handleAdminLogin} className="space-y-4">
                <input className="w-full p-3 border rounded-lg" placeholder="Email" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)}/>
                <input className="w-full p-3 border rounded-lg" type="password" placeholder="Password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)}/>
                <div className="flex gap-2"><button type="button" onClick={()=>setShowAdminLogin(false)} className="flex-1 p-3 text-slate-500">Cancel</button><button className="flex-1 p-3 bg-blue-600 text-white rounded-lg font-bold">Login</button></div>
            </form>
        </div>
    </div>
  );

  if (!isAuthReady) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading App...</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900 w-full">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4"> 
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
                Translate <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Mon $\leftrightarrow$ English</span>
            </h2>
            <p className="text-slate-500 text-lg">Ramanya AI: Input Mon or English below</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
            <div className="grid md:grid-cols-[1fr,auto,1fr] divide-y md:divide-y-0 md:divide-x divide-slate-100">
                
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
                            Output: {outputJson ? (outputJson.source_language === 'Mon' ? 'English' : 'Mon') : 'N/A'}
                        </span>
                        <div className="flex gap-2">
                            {outputJson && (<button onClick={handleOpenSuggest} className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-orange-500 hover:bg-orange-50 rounded"><Edit3 size={14}/> Fix</button>)}
                            {outputJson && (<button onClick={handleCopy} className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded">{copied ? <Check size={14}/> : <Copy size={14}/>} Copy</button>)}
                        </div>
                    </div>
                    <div className="flex-1 p-6 md:p-8 overflow-y-auto">
                         {isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
                                <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                                <span className="text-sm font-medium animate-pulse">Consulting Ramanya AI...</span>
                            </div>
                        ) : (
                            <div className={`leading-loose h-full ${!outputJson ? 'text-slate-300 italic flex items-center justify-center text-xl' : 'text-slate-700'}`}>
                                 {error ? <span className="text-red-500 text-base">{error}</span> : renderFormattedOutput || "Translation will appear here"}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Translation Button */}
            <div className="bg-white p-4 md:p-6 flex justify-center border-t border-slate-100">
                <button onClick={handleTranslate} disabled={isLoading || !inputText.trim()} className="group flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50">
                    <span className="text-lg">Translate</span>
                    <Send className={`w-5 h-5 ${isLoading ? 'opacity-0' : ''}`} />
                </button>
            </div>
        </div>

        {/* Suggestion Modal */}
        {showSuggestModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Suggest Correction</h3>
                    <div className="space-y-4">
                        <div><label className="text-xs font-bold text-slate-500">MON</label><input className="w-full p-3 border rounded-lg font-mon" value={suggestMon} onChange={e=>setSuggestMon(e.target.value)}/></div>
                        <div><label className="text-xs font-bold text-slate-500">ENGLISH</label><input className="w-full p-3 border rounded-lg" value={suggestEng} onChange={e=>setSuggestEng(e.target.value)}/></div>
                    </div>
                    <div className="flex gap-3 mt-6"><button onClick={()=>setShowSuggestModal(false)} className="flex-1 p-3 text-slate-500">Cancel</button><button onClick={submitSuggestion} className="flex-1 p-3 bg-blue-600 text-white rounded-lg font-bold">Submit</button></div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default MonToEngTranslator;