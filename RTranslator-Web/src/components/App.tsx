import { useRef, useState } from 'react'
import './App.css'
import { Global } from '@src/Global'

function App() {
    const [init, setInit] = useState(false);
    const globalRef = useRef<Global | null>(null);

    if (globalRef.current === null) {
        globalRef.current = new Global();
        globalRef.current.init().then(() => {
            setInit(true);
        });
    }

    const global = globalRef.current;

    if(init){
        return (
            <>
                <p>GUI</p>
            </>
        )
    }else{
        return (
            <>
                <p>Loading...</p>
            </>
        )
    }
}

export default App
