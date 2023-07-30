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
	const addressList = [
		"0xCE60B14E47adDeafb2d77d564A204E215b52648a",
		"0xFb76e954a36e595291b9fbEDF8a195F0678BBbeC",
		"0x3850aE6e3e6d581D8D687CC874672B61A9824a6f",
		"0x965b73E6e4bE825b470b644709a2E70802878990",
		"0x9c3e193ef09f8d4863131d0b12bafa6792b611ac",
	];
	await sendMatic(addressList, "0.1");
}

async function sendMatic(addressList: string[], amountForEachAddress: string) {
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

	const value = addressList.length * parseFloat(amountForEachAddress);

	await contract.batchNativeTransfer(
		addressList,
		ethers.utils.parseEther(amountForEachAddress),
		{
			value: ethers.BigNumber.from(value.toString()),
		}
	);
	console.log("Matic Sent ");
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
