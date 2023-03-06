import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { Dew } from "../typechain-types";
import { Signer } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";

describe("Dew", function () {
	let dew: Dew;
	let owner: SignerWithAddress, otherAccount: SignerWithAddress;

	before("Deployment and variables setup", async () => {
		[owner, otherAccount] = await ethers.getSigners();

		const Dew = await ethers.getContractFactory("Dew");

		dew = (await upgrades.deployProxy(Dew, {
			initializer: "initialize",
			kind: "uups",
		})) as Dew;

		await dew.deployed();
	});

	describe("Parameters Test", function () {
		it("Should set the right owner", async function () {
			expect(
				await dew.hasRole(await dew.DEFAULT_ADMIN_ROLE(), owner.address)
			).to.be.equal(true);
		});

		it("Symbol should be right", async function () {
			expect(await dew.symbol()).to.be.equal("Dew");
		});
	});

	describe("Mint Test", function () {
		it("Total Supply should be 0", async function () {
			expect(await dew.totalSupply()).to.be.equal(0);
		});

		it("Reverts : Non Minter tries to mint", async function () {
			await expect(
				dew.connect(otherAccount).mint(owner.address, (1 * 10) ^ 18)
			).to.be.revertedWith(
				`AccessControl: account ${otherAccount.address.toLowerCase()} is missing role ${await dew.TOKEN_ADMIN()}`
			);
		});

		it("Minter Mints", async function () {
			await dew
				.connect(owner)
				.mint(owner.address, ethers.utils.parseEther("1"));
		});

		it("TotalSupply is 1", async function () {
			const totalSupply = ethers.utils.formatEther(await dew.totalSupply());
			expect(totalSupply).to.be.equal("1.0");
		});
	});
});
