// ---------- CONFIGURATION EN DUR (pour éviter les problèmes de .env) ----------
process.env.PORT = "3000";
process.env.POLYGON_AMOY_RPC = "https://rpc-amoy.polygon.technology";
process.env.INVESTMENT_TRACKER_ADDRESS = "0x342781cb478b30C26d80cf6809DAD1AdC8B9391e";
process.env.DARVEST_SHARE_ADDRESS = "0x0cF09686bf4678e2015F1398D25d35375EB9306C";
process.env.PRIVATE_KEY = "e4ebb3da612f1ff2c939ca0daadc5dbde16a43e19959cc7ff8316a53d3373101";

const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
require('dotenv').config(); // Gardé mais plus nécessaire

const app = express();
app.use(cors());
app.use(express.json());

// ---------- SIMULATION BASE DE DONNÉES OFF-CHAIN ----------
const users = [
  {
    id: 1,
    wallet: "0xB4C0721b05014c510299F8F957653de4B158eD61",
    email: "alice.martin@example.com",
    name: "Alice Martin",
    country: "France",
    kyc_verified: true,
    registration_date: "2026-01-15T10:30:00Z"
  }
];

const projects = [
  {
    id: 1,
    name: "Mangues bio - Casamance",
    location: "Sénégal",
    description: "Plantation de 1000 manguiers en agriculture biologique",
    goal: 50000,
    raised: 32400,
    roi: 8.5,
    duration_months: 12,
    nft_count: 42,
    image: "https://ipfs.io/ipfs/QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P"
  }
];

// ---------- CONNEXION À LA BLOCKCHAIN ----------
const provider = new ethers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC);

// ABIs simplifiés
const investmentTrackerABI = [
  "function investments(address) view returns (uint256)",
  "function owner() view returns (address)",
  "function getMyInvestment() view returns (uint256)"
];

const darvestShareABI = [
  "function ownerOf(uint256) view returns (address)",
  "function investmentAmounts(uint256) view returns (uint256)",
  "function mintTimestamps(uint256) view returns (uint256)",
  "function mintPrice() view returns (uint256)"
];

// Contrat InvestmentTracker
const investmentTracker = new ethers.Contract(
  process.env.INVESTMENT_TRACKER_ADDRESS,
  investmentTrackerABI,
  provider
);

// Contrat DarvestShare
const darvestShare = new ethers.Contract(
  process.env.DARVEST_SHARE_ADDRESS,
  darvestShareABI,
  provider
);

// ---------- ROUTES OFF-CHAIN ----------
app.get('/api/users/:wallet', (req, res) => {
  const user = users.find(u => u.wallet.toLowerCase() === req.params.wallet.toLowerCase());
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'Utilisateur non trouvé' });
  }
});

app.get('/api/projects', (req, res) => {
  res.json(projects);
});

app.get('/api/projects/:id', (req, res) => {
  const project = projects.find(p => p.id === parseInt(req.params.id));
  if (project) {
    res.json(project);
  } else {
    res.status(404).json({ error: 'Projet non trouvé' });
  }
});

// ---------- ROUTES HYBRIDES (ON-CHAIN + OFF-CHAIN) ----------
app.get('/api/dashboard/:wallet', async (req, res) => {
  try {
    const walletAddress = req.params.wallet;
    
    // 1. Données off-chain : utilisateur
    const user = users.find(u => u.wallet.toLowerCase() === walletAddress.toLowerCase());
    
    // 2. Données on-chain : investissement total
    const investment = await investmentTracker.investments(walletAddress);
    const totalInvestment = ethers.formatEther(investment);
    
    // 3. Données on-chain : NFT #1
    let nftCount = 0;
    let nfts = [];
    
    try {
      const owner = await darvestShare.ownerOf(1);
      if (owner.toLowerCase() === walletAddress.toLowerCase()) {
        nftCount = 1;
        const amount = await darvestShare.investmentAmounts(1);
        const timestamp = await darvestShare.mintTimestamps(1);
        nfts.push({
          tokenId: 1,
          amount: ethers.formatEther(amount),
          date: new Date(Number(timestamp) * 1000).toISOString()
        });
      }
    } catch (e) {
      // NFT #1 n'appartient pas à cet utilisateur
    }

    // 4. Réponse hybride
    res.json({
      user: user || { 
        wallet: walletAddress, 
        kyc_verified: false,
        name: "Utilisateur non inscrit"
      },
      onchain: {
        totalInvestment,
        nftCount,
        nfts
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Erreur blockchain:", error.message);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des données blockchain',
      details: error.message 
    });
  }
});

// ---------- ROUTE DE TEST ----------
app.get('/', (req, res) => {
  res.json({
    message: "🚀 API DARVEST - Simulation On-Chain / Off-Chain",
    endpoints: [
      "/api/projects",
      "/api/users/:wallet",
      "/api/dashboard/:wallet"
    ],
    contracts: {
      investmentTracker: process.env.INVESTMENT_TRACKER_ADDRESS,
      darvestShare: process.env.DARVEST_SHARE_ADDRESS
    }
  });
});

// ---------- DÉMARRAGE DU SERVEUR ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 SERVEUR DARVEST DÉMARRÉ AVEC SUCCÈS");
  console.log("=".repeat(60));
  console.log(`\n📍 URL: http://localhost:${PORT}`);
  console.log(`\n📡 CONNEXION BLOCKCHAIN:`);
  console.log(`   • Réseau: Polygon Amoy`);
  console.log(`   • RPC: ${process.env.POLYGON_AMOY_RPC}`);
  console.log(`\n📦 CONTRATS:`);
  console.log(`   • InvestmentTracker: ${process.env.INVESTMENT_TRACKER_ADDRESS}`);
  console.log(`   • DarvestShare: ${process.env.DARVEST_SHARE_ADDRESS}`);
  console.log(`\n🔗 ENDPOINTS DISPONIBLES:`);
  console.log(`   • GET  /`);
  console.log(`   • GET  /api/projects`);
  console.log(`   • GET  /api/users/:wallet`);
  console.log(`   • GET  /api/dashboard/:wallet`);
  console.log("\n" + "=".repeat(60) + "\n");
});