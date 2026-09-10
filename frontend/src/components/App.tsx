import { useReducer, useRef, useState, useSyncExternalStore } from 'react'
import './App.css'
import { Global } from '@src/Global'
import LanguagesDialog from './LanguagesDialog';

function App() {
   type LanguageListType = "first" | "second" | "none";

   const [inputText, setInputText] = useState("");
   const [outputText, setOutputText] = useState("");
   const [languagesListType, setLanguageListType] = useState<LanguageListType>("none");

   const globalRef = useRef<Global | null>(null);
   if (globalRef.current === null) {
      globalRef.current = new Global();
      globalRef.current.init();
   }
   const global = globalRef.current;

   // with this hook, react will do a re-render every time the getSnapshot state changes (controlled by Global)
   const state = useSyncExternalStore(global.subscribe, global.getSnapshot);

   if (!state.isInitialized) {
      return <p>Loading...</p>
   }

   return (
      <>
         <button onClick={() => setLanguageListType("first")}>{state.firstLanguage}</button>
         <button onClick={() => setLanguageListType("second")}>{state.secondLanguage}</button>
         <textarea
            name="InputText"
            cols={40}
            rows={5}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
         />
         <textarea
            name="OutputText"
            cols={40}
            rows={5}
            value={outputText}
            onChange={e => setOutputText(e.target.value)}
         />
         <button
            onClick={async () => {
               setOutputText(await global.translate(inputText));
            }}
         >
            Translate
         </button>
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
