import { ethers, upgrades, run, network } from "hardhat";
const { getContractAddress } = require("@ethersproject/address");
import { WrpVote } from "../typechain-types";
import { configService } from "../config";
import { Dew } from "../typechain-types";
const hre = require("hardhat");

const proxyAddress = configService.getValue("VOTE_ADDRESS");
const proxyAdminPrivateKey = configService.getValue("PRIVATE_KEY");
const ABI = require("../artifacts/contracts/wrpVote.sol/wrpVote.json");
async function main() {
	const Vote = await ethers.getContractFactory("wrpVote");
	const vote = (await Vote.deploy()) as WrpVote;
	await vote.deployed();
	console.log(" vote Logic deployed at : ", vote.address);

	await sleep(20);

	await verify(vote.address, []);

	await upgradeProxyToNewLogic(vote.address);
}

async function upgradeProxyToNewLogic(logic: string) {
	let RPC;
	if (process.env.PROD == "false") RPC = configService.getValue("TESTNET_RPC");
	else RPC = configService.getValue("MAINNET_RPC");

	const customHttpProvider = new ethers.providers.JsonRpcProvider(RPC);

	const wallet = new ethers.Wallet(proxyAdminPrivateKey, customHttpProvider);

	const contract = new ethers.Contract(
		proxyAddress,
		ABI["abi"],
		wallet
	) as WrpVote;

	const res = await contract.upgradeTo(logic);
	console.log("Proxy contract is now upgraded to new Logic");
}

async function verify(address: string, args: any[]) {
	console.log("Verifying contract...");

	try {
		await run("verify:verify", {
			address: address,
			constructorArguments: args,
		});

		console.log("Verified");
	} catch (e: any) {
		if (e.message.toLowerCase().includes("already verified")) {
			console.log("Already Verified");
		}
	}
}

async function sleep(s: number) {
	return new Promise((resolve) => {
		console.log(`\nsleeping for ${s}\n`);
		setTimeout(resolve, s * 1000);
	});
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
