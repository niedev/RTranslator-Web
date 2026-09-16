import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import './App.css'
import { Global } from '@src/Global'
import LanguagesDialog from './dialogs/LanguagesDialog';
import switchIcon from '@src/assets/invert_arrows.svg';
import cancelIcon from '@src/assets/cancel_icon.svg'
import copyIcon from '@src/assets/copy_icon.svg'
import { getLanguageName } from '@src/tools/language_tools';
import CircularProgress from './tools/CircularProgress';
import Toolbar from './Toolbar';
import { Toaster, toast } from 'sonner';
import TranslationSkeleton from './TranslationSkeleton';

function App() {
   type LanguageListType = "first" | "second" | "none";

   const [inputText, setInputText] = useState("");
   const [outputText, setOutputText] = useState("");
   const [languagesListType, setLanguageListType] = useState<LanguageListType>("none");
   const [translateDisabled, setTranslateDisabled] = useState(false);
   const [isTranslating, setIsTranslating] = useState(false);

   const [translationContainer, setTranslationContainer] = useState<HTMLDivElement | null>(null);
   const [inputTextArea, setInputTextArea] = useState<HTMLTextAreaElement | null>(null);
   const [outputTextArea, setOutputTextArea] = useState<HTMLTextAreaElement | null>(null);

   const globalRef = useRef<Global | null>(null);
   if (globalRef.current === null) {
      globalRef.current = new Global();
      globalRef.current.init();
   }
   const global = globalRef.current;

   // with this hook, react will do a re-render every time the getSnapshot state changes (controlled by Global)
   const state = useSyncExternalStore(global.subscribe, global.getSnapshot);


   // this is used to remove the button corners when the translation-container touches the buttom border of the window
   useEffect(() => {
      if (!translationContainer) return;
      const update = () => {
         const flush = Math.abs(translationContainer.getBoundingClientRect().bottom - window.innerHeight) < 1;
         translationContainer.classList.toggle("is-bottom-clamped", flush);
      };
      const ro = new ResizeObserver(update);
      ro.observe(translationContainer);
      window.addEventListener("resize", update);
      update();
      return () => { ro.disconnect(); window.removeEventListener("resize", update); };
   }, [translationContainer]);

   //this is used to enlarge or shrink the input textarea based on the text
   useLayoutEffect(() => {
      if (inputTextArea) {
         inputTextArea.style.height = "auto";              // collapse first, so it can shrink too
         inputTextArea.style.height = `${inputTextArea.scrollHeight}px`;
      }
   }, [inputText, inputTextArea]);

   //this is used to enlarge or shrink the output textarea based on the text
   useLayoutEffect(() => {
      if (outputTextArea) {
         outputTextArea.style.height = "auto";              // collapse first, so it can shrink too
         outputTextArea.style.height = `${outputTextArea.scrollHeight}px`;
      }
   }, [outputText, outputTextArea]);


   //functions
   function copyToClipboard(text: string) {
      navigator.clipboard.writeText(outputText);
      toast("Copied to clipboard!", {
         icon: <img width={20} src={copyIcon} alt={""} />,
      });
   }

   async function translate(text: string) {
      setIsTranslating(true);
      try{
         setOutputText(await global.translate(inputText));
      } catch (e) {
         console.log(e);
      }
      setIsTranslating(false);
   }



   if (!state.isInitialized) {
      return (
         <>
            <Toolbar />
            <div id='loading-father-container' className='container'>
               <div className='loading-container'>
                  <CircularProgress className='loadingbar' value={undefined} color='#388e3c' size={70} thickness={6} />
                  <p>Loading of initial resources...</p>
               </div>
            </div>
         </>
      );
   }

   return (
      <>
         <Toolbar />
         <div id='main-container' className='container'>
            <div id='translation-container' ref={setTranslationContainer}>
               <div id='language-selection-container'>
                  <button
                     className='language-selector'
                     id='left-language-selector'
                     onClick={() => setLanguageListType("first")}
                  >
                     {getLanguageName(state.firstLanguage) ?? "Loading..."}
                  </button>
                  <button
                     id='switch-image'
                     className="image-button"
                     onClick={async () => {
                        setTranslateDisabled(true);
                        try {
                           await global.switchSelectedLanguages();
                        } catch (e) {
                           console.log(e);
                           toast.error("Error loading the new language models");
                        } finally {
                           setTranslateDisabled(false);
                        }
                     }}
                  >
                     <img src={switchIcon} alt={"switch languages"} />
                  </button>
                  <button
                     className='language-selector'
                     id='right-language-selector'
                     onClick={() => setLanguageListType("second")}
                  >
                     {getLanguageName(state.secondLanguage) ?? "Loading..."}
                  </button>
               </div>
               <div id='text-areas-container'>
                  <div id='text-areas-scroll-wrapper'>
                     <div id='text-areas-main-container'>
                        <div className='text-area-inner-container' >
                           <label className="translation-wrapper">
                              <textarea
                                 ref={setInputTextArea}
                                 className='translation-text-area'
                                 name="InputText"
                                 placeholder='Insert text'
                                 onKeyDown={async (e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                       e.preventDefault();
                                       translate(inputText);
                                    }
                                 }}
                                 cols={40}
                                 rows={5}   // minimum
                                 value={inputText}
                                 onChange={e => setInputText(e.target.value)}
                              />
                           </label>
                           {(inputText || outputText) &&
                              <div className='text-buttons-container'>
                                 <button className="image-button" onClick={() => {
                                    setInputText("");
                                    setOutputText("");
                                 }}>
                                    <img src={cancelIcon} alt={"cancel input text"} />
                                 </button>
                                 {inputText &&
                                    <button className="image-button" onClick={() => copyToClipboard(inputText)}>
                                       <img src={copyIcon} alt={"copy input text"} />
                                    </button>
                                 }
                              </div>
                           }
                        </div>
                        <div id='text-areas-divider' />          {/* text areas divider mobile: in flow */}
                        {isTranslating ? 
                           <TranslationSkeleton inputText={inputText}/>
                        :
                           <div className='text-area-inner-container' >
                           <label className="translation-wrapper">
                              <textarea
                                 ref={setOutputTextArea}
                                 className='translation-text-area'
                                 name="OutputText"
                                 cols={40}
                                 rows={5}   // minimum
                                 value={outputText}
                                 onChange={e => setOutputText(e.target.value)}
                              />
                           </label>
                           {outputText &&
                              <div className='text-buttons-container'>
                                 <button className="image-button" onClick={() => copyToClipboard(outputText)}>
                                    <img src={copyIcon} alt={"copy output text"} />
                                 </button>
                              </div>
                           }
                        </div>
                        }
                     </div>
                     <div id='text-areas-divider-pinned' />    {/* text areas divider desktop: pinned */}
                  </div>
                  <button
                     className='text-button'
                     onClick={async () => {
                        translate(inputText);
                     }}
                     disabled={translateDisabled}
                  >
                     Translate
                  </button>
               </div>
            </div>

            {languagesListType != "none" &&
               <LanguagesDialog
                  languages={[...global.getMozillaModels()]}
                  selectedLanguage={languagesListType == "first" ? global.getFirstLanguage() : global.getSecondLanguage()}
                  onSelectedLanguage={async (lang) => {
                     console.log("Selected: " + lang);
                     setLanguageListType("none");  //close the dialog
                     setTranslateDisabled(true);
                     try {
                        if (languagesListType == "first") {
                           await global.setFirstLanguage(lang);

                        } else {
                           await global.setSecondLanguage(lang);
                        }
                     } catch (e) {
                        console.log(e);
                        toast.error("Error loading the new language models");
                     } finally {
                        setTranslateDisabled(false);
                     }
                  }}
                  onDownloadPressed={async (lang) => {
                     try {
                        await global.downloadModel(lang);
                     } catch (e: any) {
                        if (e instanceof DOMException && e.name == "AbortError") {
                           //the user interrupted the download, we do nothing for now
                           console.log("Aborted download");
                        } else {
                           //we notify an unexpected error
                           console.log(e)
                           toast.error("Error in the download, please try again");
                        }
                     }
                  }}
                  onCancelPressed={async (lang) => {
                     setTranslateDisabled(true);
                     try{
                        await global.cancelModelDownload(lang);
                     } catch (e) {
                        console.log(e);
                        toast.error("Error canceling the language");
                     } finally {
                        setTranslateDisabled(false);
                     }
                  }}
                  onClose={() => { setLanguageListType("none") }}
               />
            }
         </div>
         <Toaster position='bottom-right' />
      </>
   );
}

export default App
