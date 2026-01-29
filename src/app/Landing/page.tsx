// app/page.tsx
"use client";

import React, { useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import SendToken from '../SendToken/page'
import MintTokens from "../minttoken/page";
import  UpdateMetadata  from "../updatemetadata/page";
import TokenLaunchpad  from "../token_launchpad/page";
import LiquidityPool from "../LiquidityPool/page";

export default function Home() {
  const [activePage, setActivePage] = useState('landing');

  const features = [
    {
      title: 'Create Token',
      description: 'Launch your own SPL token with custom metadata, supply & authority settings',
      icon: '🪙',
      page: 'token_launchpad',
      color: 'from-purple-600 via-purple-500 to-pink-500'
    },
    {
      title: 'Mint Tokens',
      description: 'Mint additional supply to your wallet (mint authority required)',
      icon: '⚡',
      page: 'minttoken',
      color: 'from-blue-600 via-blue-500 to-cyan-500'
    },
    {
      title: 'Send Tokens',
      description: 'Transfer tokens to any Solana address — fast & low-cost',
      icon: '📤',
      page: 'sendtoken',
      color: 'from-emerald-600 via-emerald-500 to-teal-500'
    },
    {
      title: 'Liquidity Pool',
      description: 'Create or manage pools — add/remove liquidity on Raydium / Orca',
      icon: '💧',
      page: 'liquidityPool',
      color: 'from-indigo-600 via-indigo-500 to-blue-500'
    },
    {
      title: 'Update Metadata',
      description: 'Change name, symbol, image, URI and other token details',
      icon: '🔄',
      page: 'updatemetadata',
      color: 'from-orange-600 via-orange-500 to-red-500'
    }
  ];

  const navItems = [
    { label: 'Create',       page: 'token_launchpad',   icon: '🪙', color: 'purple'   },
    { label: 'Mint',         page: 'minttoken',         icon: '⚡', color: 'blue'     },
    { label: 'Send',         page: 'sendtoken',         icon: '📤', color: 'emerald'  },
    { label: 'Liquidity',    page: 'liquidityPool',     icon: '💧', color: 'indigo'   },
    { label: 'Update',       page: 'updatemetadata',    icon: '🔄', color: 'orange'   },
  ];

  const renderPage = () => {
    switch (activePage) {
      case 'token_launchpad':   return <TokenLaunchpad />;
      case 'minttoken':         return <MintTokens />;
      case 'sendtoken':         return <SendToken />;
      case 'updatemetadata':    return <UpdateMetadata />;
      case 'liquidityPool':     return <LiquidityPool />;
      default:                  return null;
    }
  };

  // ────────────────────────────────────────────────
  // Inner page layout (when a tool is selected)
  // ────────────────────────────────────────────────
  if (activePage !== 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/40 to-gray-950 text-white">
        <header className="sticky top-0 z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setActivePage('landing')}
                className="flex items-center gap-3 group"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-purple-500/30 transition-transform group-hover:scale-110">
                  🚀
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-lg font-bold tracking-tight">Token Launchpad</h1>
                  <p className="text-xs text-purple-300/60">Solana • SPL</p>
                </div>
              </button>

              {/* Navigation Pills – now includes Liquidity */}
              <nav className="hidden md:flex items-center gap-2 bg-black/30 rounded-full px-2 py-1.5 border border-white/5 overflow-x-auto max-w-full">
                {navItems.map(item => (
                  <button
                    key={item.page}
                    onClick={() => setActivePage(item.page)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap
                      ${activePage === item.page
                        ? `bg-gradient-to-r from-${item.color}-600 to-${item.color}-500 text-white shadow-lg shadow-${item.color}-500/40 scale-105`
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                      }
                    `}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>

              <WalletMultiButton 
                className="
                  !bg-gradient-to-r !from-purple-600 !via-pink-600 !to-purple-600
                  hover:!brightness-110 hover:!scale-105
                  !rounded-full !px-5 !py-2.5 !font-medium
                  !shadow-lg !shadow-purple-600/30
                  transition-all duration-300
                " 
              />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          {renderPage()}
        </main>
      </div>
    );
  }

  // ────────────────────────────────────────────────
  // Landing page – now with Liquidity Pool card
  // ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/30 to-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/30 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center text-2xl shadow-xl shadow-purple-500/30">
                🚀
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">Token Launchpad</h1>
                <p className="text-sm text-purple-300/60">Solana Token Suite</p>
              </div>
            </div>

            <WalletMultiButton 
              className="
                !bg-gradient-to-r !from-purple-600 !via-pink-600 !to-purple-600
                hover:!brightness-110
                !rounded-full !px-6 !py-3 !font-medium
                !shadow-lg !shadow-purple-600/30
                transition-all duration-300
              " 
            />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 md:pt-28 md:pb-32 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.15),transparent_50%)] pointer-events-none" />

        <h2 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-tight mb-6">
          Manage Your Solana Tokens
          <span className="block mt-3 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 animate-gradient-x">
            All in One Place
          </span>
        </h2>

        <p className="text-lg sm:text-xl md:text-2xl text-gray-300/90 max-w-4xl mx-auto mb-10 leading-relaxed">
          Create, mint, transfer, update metadata and manage liquidity pools — beautiful & secure Solana interface.
        </p>

        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm">
          <div className="flex items-center gap-2.5 bg-black/40 px-5 py-2.5 rounded-full border border-white/5 shadow-inner">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></span>
            Mainnet
          </div>
          <div className="bg-black/40 px-5 py-2.5 rounded-full border border-white/5 shadow-inner">~0.000005 SOL fees</div>
          <div className="bg-black/40 px-5 py-2.5 rounded-full border border-white/5 shadow-inner">Sub-second confirmations</div>
        </div>
      </section>

      {/* Features Grid – Liquidity Pool added */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 lg:gap-8">
          {features.map((feature, i) => (
            <div
              key={i}
              onClick={() => setActivePage(feature.page)}
              className={`
                group relative overflow-hidden rounded-2xl p-7 md:p-8
                bg-black/30 backdrop-blur-xl border border-white/5
                hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-500/20
                transition-all duration-500 ease-out
                hover:scale-[1.03] cursor-pointer
              `}
            >
              <div className={`
                absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 
                group-hover:opacity-20 transition-opacity duration-700
              `} />

              <div className="relative z-10">
                <div className="text-6xl md:text-7xl mb-6 transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                  {feature.icon}
                </div>

                <h3 className="
                  text-2xl font-bold tracking-tight mb-4
                  group-hover:text-transparent group-hover:bg-clip-text
                  group-hover:bg-gradient-to-r group-hover:from-purple-200 group-hover:to-pink-200
                  transition-all duration-500
                ">
                  {feature.title}
                </h3>

                <p className="text-gray-300/80 text-base leading-relaxed mb-6">
                  {feature.description}
                </p>

                <div className="
                  inline-flex items-center gap-2 text-purple-400 font-medium
                  group-hover:text-purple-300 group-hover:translate-x-2 transition-all duration-300
                ">
                  Launch
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 mt-8 border-t border-white/5 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} Token Launchpad • Built on Solana</p>
        <p className="mt-2">Connect your wallet to start managing tokens</p>
      </footer>
    </div>
  );
}