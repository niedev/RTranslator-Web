import React from 'react'
import logo from '@src/assets/logo.png'
import './Toolbar.css'

export default function Toolbar() {
   return (
      <div id='toolbar'>
         <img id='logo' height={35} src={logo} alt={"logo"} />
      </div>
   )
}
