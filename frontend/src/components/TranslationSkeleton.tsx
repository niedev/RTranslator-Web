import './TranslationSkeleton.css';
import '@src/components/App.css'


interface Props {
   inputText: string;
}

export default function TranslationSkeleton({
   inputText,
}: Props) {

   // Generate skeleton blocks based on the input text words.
   // This method will return a span with the input text (modified a bit) for each paragraph of the input text
   // Thanks to its css the text will become invisible and its background will be filled, to take the shape of skeleton blocks;
   const renderSkeletons = () => {
      // If there's no input yet, we show nothing
      if (!inputText.trim()) {
         return (
            <></>
         );
      }

      // Split by explicit Enter key presses
      const paragraphs = inputText.split('\n');

      return paragraphs.map((paragraph, index) => {
         if (paragraph === '') {
            return <div key={index} style={{ height: '1em' }}></div>;
         }

         //if the text is too short, we fill it it to a minimum lenght
         if(paragraph.length < 10) {
            paragraph = "iiiiaaaaai";
         }

         // if the text is long, we shorten the text lenght by 20%
         if (paragraph.length > 40) {
            let wordsToRemove = (paragraph.length / 100) * 20;
            paragraph = paragraph.slice(0, paragraph.length - wordsToRemove);
         }

         return (
            <div key={index} className="skeleton-paragraph">
               {/* The text inside forces natural wrapping, but stays invisible */}
               <span className="skeleton-text-mirror">{paragraph}</span>
            </div>
         );
      });
   };

   return (
      <div className="text-area-inner-container skeleton-container">
         {renderSkeletons()}
      </div>
   );
};


/*
const renderSkeletonsLinesBased = () => {
   if (!inputText.trim()) {
      return (
         <>
            <div className="skeleton-line" style={{ width: '85%' }}></div>
            <div className="skeleton-line" style={{ width: '95%' }}></div>
            <div className="skeleton-line" style={{ width: '60%' }}></div>
         </>
      );
   }

   const paragraphs = inputText.split('\n');

   return paragraphs.map((paragraph, pIndex) => {
      // Keep empty vertical spaces if the user hits Enter twice
      if (paragraph === '') {
         return <div key={pIndex} style={{ height: '1.5em' }}></div>;
      }

      // 1. Estimate lines (adjust '65' based on your textarea's width and font size)
      const charsPerLine = 65;
      const lineCount = Math.max(1, Math.ceil(paragraph.length / charsPerLine));

      const lines = Array.from({ length: lineCount }).map((_, lIndex) => {
         const isLastLine = lIndex === lineCount - 1;

         // 2. Generate a stable, deterministic "random" number so lines don't jitter while typing
         const pseudoRandom = ((pIndex + 1) * (lIndex + 7) * 13) % 100 / 100;

         // Middle lines are mostly full (85-98%), the last line is shorter (30-65%)
         const widthPercentage = isLastLine
            ? 30 + (pseudoRandom * 35)
            : 85 + (pseudoRandom * 13);

         return (
            <div
               key={`${pIndex}-${lIndex}`}
               className="skeleton-line"
               style={{ width: `${widthPercentage}%` }}
            />
         );
      });

      return (
         <div key={pIndex} className="skeleton-paragraph-block">
            {lines}
         </div>
      );
   });
}
*/