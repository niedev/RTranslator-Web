import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import './App.css'
import { Global } from '@src/Global'
import LanguagesDialog from './LanguagesDialog';
import switchIcon from '@src/assets/invert_arrows.svg';

function App() {
   type LanguageListType = "first" | "second" | "none";

   const [inputText, setInputText] = useState("");
   const [outputText, setOutputText] = useState("");
   const [languagesListType, setLanguageListType] = useState<LanguageListType>("none");

   const [translationContainer, setTranslationContainer] = useState<HTMLDivElement|null>(null);
   const [inputTextArea, setInputTextArea] = useState<HTMLTextAreaElement|null>(null);
   const [outputTextArea, setOutputTextArea] = useState<HTMLTextAreaElement|null>(null);

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
      if(inputTextArea){
         inputTextArea.style.height = "auto";              // collapse first, so it can shrink too
         inputTextArea.style.height = `${inputTextArea.scrollHeight}px`;
      }
   }, [inputText, inputTextArea]);

   //this is used to enlarge or shrink the output textarea based on the text
   useLayoutEffect(() => {
      if(outputTextArea){
         outputTextArea.style.height = "auto";              // collapse first, so it can shrink too
         outputTextArea.style.height = `${outputTextArea.scrollHeight}px`;
      }
   }, [outputText, outputTextArea]);



   const browserLanguage = navigator.languages?.[0] || navigator.language || 'en';
   const languageNames = new Intl.DisplayNames([browserLanguage], { type: 'language' });

   if (!state.isInitialized) {
      return <p>Loading...</p>
   }

   function getLanguageName(languageCode: string | undefined | null): string | undefined {
      try {
         let language = languageCode ? languageNames.of(languageCode) : undefined;
         if (language) {
            // Capitalize the first letter and keep the rest of the string intact
            return language.charAt(0).toUpperCase() + language.slice(1);
         } else {
            return undefined;
         }
      } catch (e) {
         return undefined;
      }
   }

   return (
      <>
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
                  onClick={() => { }}
                  className="image-button"
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
               <div id='text-areas-main-container'>
                  <label className="translation-wrapper">
                     <textarea
                        ref={setInputTextArea}
                        className='translation-text-area'
                        name="InputText"
                        cols={40}
                        rows={5}   // minimum
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                     />
                  </label>
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
               </div>
               <button
                  className='text-button'
                  onClick={async () => {
                     setOutputText(await global.translate(inputText));
                  }}
               >
                  Translate
               </button>
            </div>
         </div>

         {languagesListType != "none" &&
            <LanguagesDialog
               languages={[...global.getMozillaModels()]}
               onSelectedLanguage={(lang) => {
                  if (languagesListType == "first") {
                     global.setFirstLanguage(lang);
                  } else {
                     global.setSecondLanguage(lang);
                  }
                  setLanguageListType("none");  //close the dialog
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
                     }
                  }
               }}
               onCancelPressed={async (lang) => {
                  global.cancelModelDownload(lang);
               }}
               onClose={() => { setLanguageListType("none") }}
            />
         }
      </>
   );
}

export default App
