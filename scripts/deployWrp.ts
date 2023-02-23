import { ethers, upgrades, run } from "hardhat";
const { getContractAddress } = require("@ethersproject/address");
import { WeRplay } from "../typechain-types";
import { configService } from "../config";
const hre = require("hardhat");
const request = require("request");

const MINTER = configService.getValue("MINTER");

async function main() {
	const addresses = await futureAddress();
	console.log("predicted addresses : ", addresses);

	const args: any[] = [];
	const WeRplay = await ethers.getContractFactory("WeRplay");
	const weRplay = (await upgrades.deployProxy(WeRplay, {
		initializer: "initialize",
		kind: "uups",
	})) as WeRplay;
	await weRplay.deployed();
	console.log(" weRplay Proxy deployed at : ", weRplay.address);

	await sleep(20);

	if (weRplay.address == addresses.proxy) {
		await verifyLogic(addresses.logic, args);
		await verifyProxy(addresses.proxy);
	} else {
		await verifyProxy(weRplay.address);
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
