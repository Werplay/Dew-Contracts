import { ethers, upgrades, run, network } from "hardhat";
const { getContractAddress } = require("@ethersproject/address");
import { Jambro } from "../typechain-types";
import { configService } from "../config";
const hre = require("hardhat");

const proxyAddress = configService.getValue("proxyAddress");
const proxyAdminPrivateKey = configService.getValue("proxyAdminPrivateKey");
const ABI = require("../artifacts/contracts/Jambro.sol/Jambro.json");
async function main() {
	const Jambro = await ethers.getContractFactory("Jambro");
	const jambro = (await Jambro.deploy()) as Jambro;
	await jambro.deployed();
	console.log(" Jambro Logic deployed at : ", jambro.address);

	await sleep(20);

	await verify(jambro.address, []);

	await upgradeProxyToNewLogic(jambro.address);
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
	) as Jambro;

	const res = await contract.upgradeTo(logic);
	console.log(res);
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
