import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";

import { configService } from "./config";

const config: HardhatUserConfig = {
	paths: {
		sources: `./contracts/`,
		tests: "./test",
		cache: "./cache",
		artifacts: "./artifacts",
	},
	solidity: {
		compilers: [
			{
				version: "0.8.15",
				settings: {
					optimizer: {
						enabled: true,
						runs: 1000,
					},
				},
			},
		],
	},
	networks: {
		testnet: {
			url: configService.getValue("TESTNET_RPC"),
			accounts: [configService.getValue("PRIVATE_KEY")],
		},

		mainnet: {
			url: configService.getValue("MAINNET_RPC"),
			accounts: [configService.getValue("PRIVATE_KEY")],
		},
	},
	etherscan: {
		apiKey: configService.getValue("POLYGONSCAN_API_KEY"),
	},
};

export default config;
