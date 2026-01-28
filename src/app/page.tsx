'use client'
import dynamic from "next/dynamic"
const Handle= dynamic(()=>import("./Wallethandling"),{ssr:false} )
export default function Home(){

  return (
    <div>
       <Handle/>
       
    </div>
  )
}