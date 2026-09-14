import React, { useEffect, useRef } from 'react'
import './Dialog.css'

interface Props {
   message: string;
   onConfirmPressed(): void;
   onCancelPressed(): void;
   onClose(): void;
}

export default function ConfirmDialog({ message, onConfirmPressed, onCancelPressed, onClose }: Props) {
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


   return (
      <dialog ref={dialogRef} id='dialog-confirm' className="dialog" onClose={onClose} onClick={handleBackdropClick}>
         <div className='dialog-content'>
            <p className='message'>{message}</p>
            <div className='buttons-container'>
               <button className='button' onClick={onCancelPressed}>No</button>
               <button className='button' onClick={onConfirmPressed}>Yes</button>
            </div>
         </div>
      </dialog>
   )
}
