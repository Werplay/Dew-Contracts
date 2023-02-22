import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { WeRplay } from "../typechain-types";
import { Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";

describe("weRplay", function () {
	let weRplay: WeRplay;
	let owner: SignerWithAddress, otherAccount: SignerWithAddress;

	before("Deployment and variables setup", async () => {
		[owner, otherAccount] = await ethers.getSigners();

		const WeRplay = await ethers.getContractFactory("WeRplay");

		weRplay = (await upgrades.deployProxy(WeRplay, {
			initializer: "initialize",
			kind: "uups",
		})) as WeRplay;

		await weRplay.deployed();
	});

	describe("Parameters Test", function () {
		it("Should set the right owner", async function () {
			expect(
				await weRplay.hasRole(await weRplay.DEFAULT_ADMIN_ROLE(), owner.address)
			).to.be.equal(true);
		});

		it("Symbol should be right", async function () {
			expect(await weRplay.symbol()).to.be.equal("WRP");
		});
	});

	describe("Mint Test", function () {
		it("Total Supply should be 0", async function () {
			expect(await weRplay.totalSupply()).to.be.equal(0);
		});

		it("Reverts : Non Minter tries to mint", async function () {
			await expect(
				weRplay.connect(otherAccount).mint(owner.address, (1 * 10) ^ 18)
			).to.be.revertedWith(
				`AccessControl: account ${otherAccount.address.toLowerCase()} is missing role ${await weRplay.TOKEN_ADMIN()}`
			);
		});

		it("Minter Mints", async function () {
			await weRplay
				.connect(owner)
				.mint(owner.address, ethers.utils.parseEther("1"));
		});

		it("TotalSupply is 1", async function () {
			const totalSupply = ethers.utils.formatEther(await weRplay.totalSupply());
			expect(totalSupply).to.be.equal("1.0");
		});
	});
});
