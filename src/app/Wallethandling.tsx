'use client'
import {ConnectionProvider,WalletProvider} from "@solana/wallet-adapter-react";
import {WalletModalProvider,WalletMultiButton} from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import Home from "./Landing/page";



export default function Wallethandling(){
    const wallet=[new PhantomWalletAdapter()]
    return (
        <div>
            <ConnectionProvider endpoint="https://api.devnet.solana.com">
                <WalletProvider wallets={wallet} autoConnect>
                    <WalletModalProvider>
                        <Home/>
                        
                    </WalletModalProvider>

                </WalletProvider>


            </ConnectionProvider>

        </div>
    )
}