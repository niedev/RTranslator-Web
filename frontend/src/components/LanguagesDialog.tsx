import type { DownloadInfo } from '@src/downloader/DownloadInfo'
import React, { useEffect, useRef } from 'react'

interface Props {
   languages: DownloadInfo[];
   onSelectedLanguage(lang: string): void;
   onDownloadPressed(lang: string): void;
   onCancelPressed(lang: string): void;
   onClose(): void;
}

export default function LanguagesDialog({ languages, onSelectedLanguage, onDownloadPressed, onCancelPressed, onClose }: Props) {
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
      <dialog ref={dialogRef} id="my-dialog" onClose={onClose} onClick={handleBackdropClick}>
         {installedLanguages.length > 0 &&
            <>
            <p>Installed</p>
            <ul>
               {installedLanguages.map((item) => {
                  return (
                     <li key={item.name}>
                        <p onClick={() => onSelectedLanguage(item.name)}>{item.name}</p>
                        <p>{item.size / 1000} MB</p>
                        <button onClick={() => onCancelPressed(item.name)}>Delete</button>
                     </li>
                  )
               })}
            </ul>
            </>
         }
         {availableLanguages.length > 0 &&
            <>
            <p>Available</p>
            <ul>
               {availableLanguages.map((item) => {
                  return (
                     <li key={item.name}>
                        <p>{item.name}</p>
                        {item.downloading ?
                           <>
                           <p>{item.unzipping ? "Unzipping..." : (item.currentProgress/100)*(item.size/1000) +" / "+ (item.size/1000)+" MB" }</p>
                           <progress id="file" max={item.unzipping ? undefined : 100} value={item.unzipping ? undefined : item.currentProgress}/>
                           <button onClick={() => onCancelPressed(item.name)}>Delete</button>
                           </>
                           :
                           <>
                           <p>{item.size / 1000} MB</p>
                           <button onClick={() => onDownloadPressed(item.name)}>Download</button>
                           </>
                        }
                     </li>
                  )
               })}
            </ul>
            </>
         }
      </dialog>
   )
}
