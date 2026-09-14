import type { DownloadInfo } from '@src/downloader/DownloadInfo'
import React, { useEffect, useRef, useState } from 'react'
import './Dialog.css'
import deleteIcon from '@src/assets/delete_icon.svg';
import downloadIcon from '@src/assets/download_icon.svg';
import checkIcon from '@src/assets/check_icon.svg'
import { getLanguageName, getLanguageNameWithLocal } from '@src/tools/language_tools';
import CircularProgress from '../tools/CircularProgress';
import ConfirmDialog from './ConfirmDialog';

interface Props {
   languages: DownloadInfo[];
   selectedLanguage: string;
   onSelectedLanguage(lang: string): void;
   onDownloadPressed(lang: string): void;
   onCancelPressed(lang: string): void;
   onClose(): void;
}

export default function LanguagesDialog({ languages, selectedLanguage, onSelectedLanguage, onDownloadPressed, onCancelPressed, onClose }: Props) {
   const [confirmingDeleteLang, setConfirmingDeleteLang] = useState<string|null>(null);

   const dialogRef = useRef<HTMLDialogElement>(null);
   useEffect(() => {
      // Opens the dialog as a modal when the component mounts
      if (dialogRef.current && !dialogRef.current.open) {
         dialogRef.current.showModal();
      }
   }, []);

   // Handle clicks on the dialog element
   const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
      const dialogElement = dialogRef.current;
      if (!dialogElement) return;

      const rect = dialogElement.getBoundingClientRect();
      const clickedInside = (
         rect.top <= e.clientY &&
         e.clientY <= rect.top + rect.height &&
         rect.left <= e.clientX &&
         e.clientX <= rect.left + rect.width
      );

      // If the click is outside the bounding box, it hit the backdrop
      if (!clickedInside) {
         dialogElement.close();
         // todo: check if in this case the onClose of the dialog is called, if not call onClose() here
      }
   };


   let installedLanguages: DownloadInfo[] = [];
   let availableLanguages: DownloadInfo[] = [];

   for (let lang of languages) {
      if (lang.downloadCompleted) {
         installedLanguages.push(lang);
      } else {
         availableLanguages.push(lang);
      }
   }


   return (
      <>
      <dialog ref={dialogRef} id='dialog-languages' className="dialog" onClose={onClose} onClick={handleBackdropClick}>
         <div className='dialog-content'>
            <>
            <p className='list-header'>Installed</p>
            <ul className='list'>
               <li key={"en"} className='list-element'>   {/** English lang */}
                  <p className='lang-name' onClick={() => onSelectedLanguage("en")}>{getLanguageName("en") ?? "en"}</p>
                  {"en" == selectedLanguage && <img id='selected-icon' src={checkIcon} alt={"selected language"} />}
                  <p id='preinstalled' className='lang-size'>Pre-installed</p>
               </li>
               {installedLanguages.map((item) => {
                  return (
                     <li key={item.name} className='list-element'>
                        <p className='lang-name' onClick={() => onSelectedLanguage(item.name)}>{getLanguageName(item.name) ?? item.name}</p>
                        {item.name == selectedLanguage && <img id='selected-icon' src={checkIcon} alt={"selected language"} />}
                        <p className='lang-size'>{Math.round(item.size / 1000)} MB</p>
                        <button className='delete-button' onClick={() => setConfirmingDeleteLang(item.name)}>
                           <img src={deleteIcon} alt={"delete"+(getLanguageName(item.name) ?? item.name)+"language"} />
                        </button>
                     </li>
                  )
               })}
            </ul>
            </>
            {availableLanguages.length > 0 &&
               <>
               <p className='list-header'>Available</p>
               <ul className='list'>
                  {availableLanguages.map((item) => {
                     return (
                        <li key={item.name} className='list-element'>
                           <p className='lang-name'>{getLanguageName(item.name) ?? item.name}</p>
                           {item.downloading ?
                                 <>
                                 <p className='lang-size'>{item.unzipping ? "Unzipping..." : Math.round((item.currentProgress/100)*(item.size/1000)) +" / "+ Math.round(item.size/1000)+" MB"}</p>
                                 <CircularProgress className='lang-progress' value={item.unzipping ? undefined : item.currentProgress} color='#388e3c' size={36} thickness={5}/>
                                 <button className='delete-button' onClick={() => onCancelPressed(item.name)}>
                                    <img src={deleteIcon} alt={"delete"+(getLanguageName(item.name) ?? item.name)+"language"} />
                                 </button>
                                 </>
                              :
                                 <>
                                 <p className='lang-size'>{Math.round(item.size / 1000)} MB</p>
                                 <button className='download-button' onClick={() => onDownloadPressed(item.name)}>
                                    <img src={downloadIcon} alt={"download"+(getLanguageName(item.name) ?? item.name)+"language"} />
                                 </button>
                                 </>
                           }
                        </li>
                     )
                  })}
               </ul>
               </>
            }
         </div>
      </dialog>
      {confirmingDeleteLang &&
         <ConfirmDialog
            message={"Are you sure you wanto to delete "+(getLanguageNameWithLocal("en", confirmingDeleteLang) ?? confirmingDeleteLang)+" language resources?"}
            onConfirmPressed={() => {
               setConfirmingDeleteLang(null);
               onCancelPressed(confirmingDeleteLang);
            }}
            onCancelPressed={() => {
               setConfirmingDeleteLang(null);
            }}
            onClose={() => {
               setConfirmingDeleteLang(null);
            }}
         />
      }
      </>
   )
}
