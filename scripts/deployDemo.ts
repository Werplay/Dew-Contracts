import { ethers, upgrades, run } from "hardhat";
const { getContractAddress } = require("@ethersproject/address");
import { VoteDemo } from "../typechain-types";
import { configService } from "../config";
import { Dew } from "../typechain-types";
const hre = require("hardhat");
const request = require("request");

async function main() {
	const addresses = await futureAddress();

	const WrpVote = await ethers.getContractFactory("voteDemo");
	const wrpVote = (await upgrades.deployProxy(
		WrpVote,
		[
			"0xc6e3a039149dcbfa195f34002e0caf56b4944873",
			configService.getValue("TOKEN_ADDRESS"),
		],
		{
			initializer: "initialize",
			kind: "uups",
		}
	)) as VoteDemo;
	await wrpVote.deployed();
	console.log(" wrpVote Proxy deployed at : ", wrpVote.address);

	// const TokenContract = await ethers.getContractFactory("Dew");
	// const tokenContract = await TokenContract.attach(
	// 	configService.getValue("TOKEN_ADDRESS")
	// );

	// console.log(" Granting Role Token Admin to Vote Contract ");
	// await tokenContract.grantRole(tokenContract.TOKEN_ADMIN(), wrpVote.address);
	// await sleep(5);

	// await wrpVote.setupCohort(
	// 	0,
	// 	"Red",
	// 	"0xCE60B14E47adDeafb2d77d564A204E215b52648a"
	// );
	// await sleep(5);

	// await wrpVote.setupCohort(
	// 	1,
	// 	"Green",
	// 	"0xFb76e954a36e595291b9fbEDF8a195F0678BBbeC"
	// );
	// await sleep(5);

	// await wrpVote.setupCohort(
	// 	2,
	// 	"Blue",
	// 	"0x3850aE6e3e6d581D8D687CC874672B61A9824a6f"
	// );
	// await sleep(5);

	// await wrpVote.setupCohort(
	// 	3,
	// 	"Purple",
	// 	"0x965b73E6e4bE825b470b644709a2E70802878990"
	// );
	// await sleep(5);

	// await wrpVote.setupCohort(
	// 	4,
	// 	"Yellow",
	// 	"0x9c3e193EF09f8D4863131D0B12bAFA6792B611ac"
	// );

	await sleep(20);

	if (wrpVote.address == addresses.proxy) {
		const args = [
			configService.getValue("CONTRACT_OWNER"),
			configService.getValue("TOKEN_ADDRESS"),
		];
		await verifyLogic(addresses.logic, args);
		await verifyProxy(addresses.proxy);
	} else {
		await verifyProxy(wrpVote.address);
	}
}

async function verifyLogic(address: string, args: any[]) {
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

async function verifyProxy(proxyAddress: string) {
	const Key = configService.getValue("POLYGONSCAN_API_KEY");

	const headers = {
		"Content-Type": "application/x-www-form-urlencoded",
	};

	const dataString = `address=${proxyAddress}`;

	const options = {
		url: `https://api.polygonscan.com/api?module=contract&action=verifyproxycontract&apikey=${Key}`,
		method: "POST",
		headers: headers,
		body: dataString,
	};

	function callback(error: any, response: { statusCode: number }, body: any) {
		if (!error && response.statusCode == 200) {
			console.log(body);
		}
	}

	await request(options, callback);
}

async function futureAddress() {
	if (process.env.PROD) {
		console.log("Environtment is PROD =", process.env.PROD);
		let RPC;
		if (process.env.PROD == "false")
			RPC = configService.getValue("TESTNET_RPC");
		else RPC = configService.getValue("MAINNET_RPC");

		const privateKey = configService.getValue("PRIVATE_KEY");
		const customHttpProvider = new ethers.providers.JsonRpcProvider(RPC);
		const wallet = new ethers.Wallet(privateKey, customHttpProvider);

		const transactionCount = await wallet.getTransactionCount();

		let futureAddress = getContractAddress({
			from: wallet.address,
			nonce: transactionCount,
		});

		const logic = futureAddress;
		//console.log("Logic contract Address: ", futureAddress);

		futureAddress = getContractAddress({
			from: wallet.address,
			nonce: transactionCount + 1,
		});

		const proxy = futureAddress;

		//console.log("Proxy contract Address: ", futureAddress);

		return { logic: logic, proxy: proxy };
	} else return { logic: "", proxy: "" };
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
